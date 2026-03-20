import json
import datetime
import os
import time
import itertools
import google.generativeai as genai
import firebase_admin
from firebase_admin import credentials, firestore

# ================= 🛡️ 安全與雙重 API 配置 (彈匣系統) =================
# 請在 GitHub Secrets 中設定 GEMINI_API_KEY_1 和 GEMINI_API_KEY_2
API_KEYS = [
    os.environ.get("GEMINI_API_KEY_1"),
    os.environ.get("GEMINI_API_KEY_2")
]

# 過濾掉空的變數，確保彈匣裡都是真槍實彈
VALID_KEYS = [key for key in API_KEYS if key]

if not VALID_KEYS:
    raise ValueError("❌ 找不到任何 GEMINI_API_KEY，請確認環境變數設定！")

# 建立無限循環的彈匣 (1 -> 2 -> 1 -> 2...)
key_pool = itertools.cycle(VALID_KEYS)

# ================= 🗄️ 雲端資料庫初始化 =================
if not firebase_admin._apps:
    cred = credentials.Certificate("firebase_key.json")
    firebase_admin.initialize_app(cred)
db = firestore.client()

# ================= 1. 讀取「老闆的教訓」 (AI 記憶庫) =================
def get_ai_memory():
    """讀取你在網頁上給 AI 下達的糾正與自訂規則"""
    print("📖 AI 正在翻閱「老闆的教訓與規定」記憶庫...")
    memory_rules = []
    rules_query = db.collection("AI_Rules_Memory").where("is_active", "==", True).stream()
    
    for rule in rules_query:
        memory_rules.append(rule.to_dict().get("rule_text", ""))
    
    if memory_rules:
        print(f"🧠 AI 已載入 {len(memory_rules)} 條最高優先級的老闆指令！")
    else:
        print("🧠 目前沒有額外的老闆指令，依預設邏輯運行。")
    
    return "\n".join([f"- {r}" for r in memory_rules])

# ================= 2. 讀取模式設定 (大腦的框架) =================
def get_mode_settings(mode_name):
    """讀取各個模式的動態限制、自訂欄位與急單條件"""
    mode_doc = db.collection("system_modes").where("mode_name", "==", mode_name).limit(1).get()
    if not mode_doc:
        return None
    data = mode_doc[0].to_dict()
    return {
        "constraint": data.get("domain_constraint", "請過濾掉不相關雜訊。"),
        "custom_fields": data.get("custom_extraction_fields", {"summary": "重點摘要"}),
        "emergency_rule": data.get("emergency_triggers", "無特殊緊急條件")
    }

# ================= 3. 核心處理邏輯：大腦開始提煉「原始資料池」 =================
def process_raw_data():
    print(f"\n⏰ AI 大腦開工時間：{datetime.datetime.now()}")
    
    # 載入老闆的教訓
    boss_memory = get_ai_memory()
    
    # 去 Raw_Data_Pool 抓出所有「還沒處理過」的資料 (每次最多處理 50 筆，避免超載)
    raw_docs = db.collection("Raw_Data_Pool").where("ai_processed", "==", False).limit(50).stream()
    
    # 將資料依照 mode (模式) 分類
    data_by_mode = {}
    doc_refs = [] # 記住處理了哪些文件，等一下要打勾
    
    for doc in raw_docs:
        data = doc.to_dict()
        mode = data.get("mode", "未分類")
        if mode not in data_by_mode:
            data_by_mode[mode] = []
        data_by_mode[mode].append(data)
        doc_refs.append(doc.reference)
        
    if not data_by_mode:
        print("📭 原始資料池目前沒有新資料，AI 繼續睡覺。")
        return

    # 開始按模式逐一批次處理
    for mode, items in data_by_mode.items():
        print(f"\n🚀 正在處理【{mode}】模式的 {len(items)} 筆全新資料...")
        settings = get_mode_settings(mode)
        if not settings:
            print(f"⚠️ 找不到 {mode} 的設定檔，跳過。")
            continue

        # 組裝要給 AI 看的文章 (主文+留言)
        posts_text = ""
        for i, item in enumerate(items):
            replies_str = "\n".join([f"- {r}" for r in item.get("replies", [])])
            posts_text += f"\n\n【貼文 {i+1}】\n網址: {item['url']}\n[主文]: {item['main_text']}\n[留言區]:\n{replies_str}"

        # 將自訂欄位轉為 JSON 字串
        custom_fields_json = json.dumps(settings['custom_fields'], ensure_ascii=False)
        
        # 👑 終極動態 Prompt
        prompt = f"""
        【任務設定】
        請交叉比對以下 Threads 貼文的「主文」與「留言區」。
        ⚠️ 核心守則：請務必使用平易近人的白話文總結。絕對不要賣弄艱澀的專業知識。自動校正錯字。
        
        【🚨 最高指導原則：老闆的自訂規定 (務必嚴格遵守)】
        {boss_memory if boss_memory else "無額外規定"}
        
        【動態領域限制】
        {settings['constraint']}
        
        【急單警報條件】
        {settings['emergency_rule']}
        
        請嚴格輸出 JSON 格式：
        {{
            "posts": [
                {{
                    "url": "保留原文網址",
                    "is_emergency": true/false, // 若符合【急單警報條件】請設為 true
                    "dynamic_tags": ["標籤1", "標籤2"], // 請根據文章氛圍自動生成 2~3 個精準標籤 (如：慘痛翻車、優質工法、急尋工班)
                    "data": {custom_fields_json} // 🌟 嚴格依照此 JSON 結構，從文章中萃取對應資訊
                }}
            ],
            "keyword_insights": {{
                "new_trending_keywords": ["提煉出2~3個符合上述【動態領域限制】的新詞彙。若無則填空陣列 []"]
            }}
        }}
        {posts_text}
        """

        # ================= 🌟 雙 API Key 自動切換與重試機制 =================
        ai_result = None
        
        for attempt in range(len(VALID_KEYS)):
            current_key = next(key_pool) # 從彈匣拿下一把鑰匙
            genai.configure(api_key=current_key) 
            model = genai.GenerativeModel('gemini-2.5-flash', generation_config={"response_mime_type": "application/json"})
            
            try:
                key_display = f"{current_key[:5]}...{current_key[-3:]}"
                print(f"🔄 [AI 啟動] 正在使用 API Key ({key_display}) 進行深度分析 (嘗試 {attempt + 1}/{len(VALID_KEYS)})...")
                
                response = model.generate_content(prompt)
                ai_result = json.loads(response.text)
                print("✅ 分析成功！")
                break 
                
            except Exception as e:
                print(f"⚠️ 警告：本把 API Key 分析失敗。錯誤訊息：{e}")
                if attempt < len(VALID_KEYS) - 1:
                    print("🔄 系統正在切換下一把備用 API Key，3 秒後重新嘗試...")
                    time.sleep(3)
                else:
                    print("❌ 嚴重錯誤：所有 API Key 皆已嘗試且失敗，跳過此模式。")
        
        if not ai_result:
            continue
        # ====================================================================

        # --- 解析 AI 回傳的結果並寫入資料庫 ---
        try:
            current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            saved_count = 0
            
            # 1. 寫入正式的動態情報庫
            for item in ai_result.get("posts", []):
                # 過濾掉毫無價值的閒聊
                if any("閒聊" in tag for tag in item.get("dynamic_tags", [])): continue
                
                # 🚨 急單警報攔截機制
                if item.get("is_emergency") == True:
                    print(f"🔔 【急單警報觸發】發現高價值緊急商機！網址：{item['url']}")
                    # 未來可在此處加入 LINE Notify 推播程式碼
                
                item.update({"created_at": current_time, "mode": mode})
                db.collection("database_dynamic_insights").add(item)
                saved_count += 1
                
            print(f"📦 【{mode}】成功提煉 {saved_count} 筆正式情報！")

            # 2. 寫入 AI 自動發現的新關鍵字 (沙盒待審核)
            for new_kw in ai_result.get("keyword_insights", {}).get("new_trending_keywords", []):
                if not new_kw.strip(): continue
                # 查重機制
                if not db.collection("search_config").where("keyword", "==", new_kw).get():
                    db.collection("search_config").add({
                        "keyword": new_kw, 
                        "mode": mode, 
                        "status": "pending", 
                        "source": "AI_auto", 
                        "created_at": current_time
                    })
                    print(f"✨ AI 發現新詞彙：【{new_kw}】(已放入沙盒待審核)")
                    
        except Exception as e:
            print(f"❌ 寫入資料庫時發生錯誤：{e}")

    # ================= 4. 將處理完的原始資料打勾 (標記為已處理) =================
    if doc_refs:
        print("\n📝 正在將原始資料標記為已處理...")
        batch = db.batch()
        for doc_ref in doc_refs:
            batch.update(doc_ref, {"ai_processed": True})
        batch.commit()
        print("✅ 所有新資料皆已標記完畢！")
        
    print("\n🎉 AI 大腦任務圓滿結束，下班！")

if __name__ == "__main__":
    process_raw_data()