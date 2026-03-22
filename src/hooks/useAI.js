import { useState, useEffect, useRef } from 'react';
import { postGAS, getDeviceToken, deviceValid } from '../utils/api';
import { parseDateForSort, displayDateClean, nowStr } from '../utils/helpers';
// 🚀 加上 Firebase 的引入
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebase';

// 🌟 補回收入類別，並改名為 ALL_CATEGORIES，讓 AI 收入支出都能精準分類
const ALL_CATEGORIES = [
  "食/早餐", "食/午餐", "食/晚餐", "食/生鮮食材", "食/零食/飲料", "食/外食聚餐", "食/其他",
  "衣/爸爸服飾", "衣/媽媽服飾", "衣/小孩服飾", "衣/鞋包/配件", "衣/保養/美妝", "衣/其他",
  "居家/房貸", "居家/管理費", "居家/水費", "居家/電費", "居家/瓦斯費", "居家/網路/電信", "居家/家具/家電", "居家/日用品", "居家/房屋稅/地價稅", "居家/其他",
  "行/大眾運輸", "行/計程車/共享", "行/加油", "行/停車費", "行/保養維修", "行/牌照/燃料稅", "行/eTag/過路費", "行/其他",
  "教育/學校學費", "教育/安親/才藝班", "教育/教材/文具", "教育/童書/玩具", "教育/零用錢", "教育/其他",
  "娛樂/國內旅遊", "娛樂/國外旅遊", "娛樂/串流訂閱", "娛樂/運動健身", "娛樂/聚會活動", "娛樂/電影/展覽", "娛樂/其他",
  "醫療/保健食品", "醫療/診所門診", "醫療/牙醫/眼科", "醫療/醫美", "醫療/住院", "醫療/其他",
  "理財/股票/ETF", "理財/定期定額", "理財/基金", "理財/儲蓄險", "理財/外匯", "理財/加密貨幣", "理財/其他",
  "其他/保險費", "其他/孝親費", "其他/紅白包", "其他/捐款/贈與", "其他/雜項",
  "收入/薪資", "收入/獎金", "收入/投資收益", "收入/利息", "收入/其他收入"
];

export const useAI = ({ currentUser, isOnline, txCache, showStatus }) => {
  const [aiEvalData, setAiEvalData] = useState(() => { 
    try { return JSON.parse(localStorage.getItem('ai_eval_data')) || null; } catch { return null; } 
  });
  
  const [sysConfig, setSysConfig] = useState(() => { 
    try { return JSON.parse(localStorage.getItem('sys_config')) || { apiKey: "", prompt: "" }; } catch { return { apiKey: "", prompt: "" }; } 
  });
  
  const [isAIEvaluating, setIsAIEvaluating] = useState(false);
  const hasTriggeredAutoAI = useRef(false);

  useEffect(() => localStorage.setItem('ai_eval_data', JSON.stringify(aiEvalData || {})), [aiEvalData]);
  useEffect(() => localStorage.setItem('sys_config', JSON.stringify(sysConfig || {})), [sysConfig]);

  // 🚀 核心修復：直接向 Firebase 拿取截圖中的 ai_settings 資料
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'sysConfig', 'ai_settings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSysConfig(prev => {
          const newConfig = {
            // 將 Firebase 的 geminiKey 對應到你原本程式碼用的 apiKey
            apiKey: data.geminiKey || prev.apiKey || "", 
            // 將 Firebase 的 aiPrompt 對應到你原本程式碼用的 prompt
            prompt: data.aiPrompt || prev.prompt || ""
          };
          return newConfig;
        });
      }
    }, (err) => console.error("讀取 AI 設定失敗:", err));

    return () => unsub();
  }, []);

  const executeFrontendAI = async (isManual = false) => {
    if (!sysConfig.apiKey || sysConfig.apiKey.includes('請在此填入')) {
      if (isManual) showStatus("error", "尚未設定 API Key");
      return;
    }
    if (!isOnline) {
      if (isManual) showStatus("error", "請確認網路連線以呼叫 AI");
      return;
    }

    setIsAIEvaluating(true);
    if (isManual) showStatus("info", "🤖 AI 財務教練正在分析中...");

    try {
      const cutoffTime = Date.now() - (180 * 24 * 60 * 60 * 1000);
      let dadStr = ""; let momStr = "";
      txCache.forEach(tx => {
        const ts = parseDateForSort(tx);
        if (ts > cutoffTime) {
          const line = `日期:${displayDateClean(tx.date).substring(0,5)} | 類型:${tx.type==='income'?'收入':'支出'} | 項目:${tx.category} | 金額:$${tx.amount} | 對象:${tx.beneficiary || tx.member} | 備註:${tx.desc || '無'}\n`;
          if (String(tx.member).trim() === "爸爸") dadStr += line;
          else if (String(tx.member).trim() === "媽媽" || String(tx.member).trim() === "妈妈") momStr += line;
        }
      });
      const promptTemplate = sysConfig.prompt || "你是一位專業的家庭理財教練。";
      const finalPrompt = `${promptTemplate}\n\n爸爸資料：\n${dadStr}\n\n媽媽資料：\n${momStr}`;
      const reqBody = { contents: [{ role: "user", parts: [{ text: finalPrompt }] }], generationConfig: { responseMimeType: "application/json" } };
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${sysConfig.apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reqBody)
      });
      
      const jsonRes = await response.json();
      if (jsonRes.error) throw new Error(jsonRes.error.message); 
      
      const aiText = jsonRes.candidates[0].content.parts[0].text;
      const match = aiText.match(/\{[\s\S]*\}/);
      const parsedResult = JSON.parse(match[0]);
      
      const todayStr = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
      parsedResult.lastUpdated = `${todayStr} ${new Date().toLocaleTimeString('zh-TW', { hour12: false })}`;
      setAiEvalData(parsedResult);
      postGAS({ action: "SAVE_AI_RESULT", aiData: parsedResult, deviceToken: getDeviceToken() }).catch(()=>{});

      localStorage.setItem('last_ai_eval_date', new Date().toLocaleDateString('zh-TW'));
      localStorage.setItem('last_ai_eval_tx_count', txCache.length.toString());

      if (isManual) showStatus("success", "✅ AI 分析完成！");

    } catch (e) {
      console.error("AI 執行錯誤:", e);
      if (isManual) showStatus("error", `分析失敗: ${e.message || '發生未知錯誤'}`);
    } finally {
      setIsAIEvaluating(false);
    }
  };

  const handleForceAIEval = () => executeFrontendAI(true);

  useEffect(() => {
    if (!currentUser || !txCache || txCache.length === 0 || isAIEvaluating) return;
    if (!sysConfig.apiKey || sysConfig.apiKey.includes('請在此填入')) return;

    const todayStr = new Date().toLocaleDateString('zh-TW');
    const lastEvalDate = localStorage.getItem('last_ai_eval_date');
    const lastEvalCount = parseInt(localStorage.getItem('last_ai_eval_tx_count') || "0", 10);

    if (todayStr !== lastEvalDate && txCache.length > lastEvalCount) {
      console.log("🤖 偵測到有新帳單，背景自動觸發 AI 教練...");
      executeFrontendAI(false); 
    }
  }, [currentUser, txCache, isAIEvaluating, sysConfig.apiKey]);


  // 🚀 核心：語音記帳解析引擎 (補強了收入類別、純數字限制與外人判定)
  const processVoiceText = async (voiceText, currentMember) => {
    if (!sysConfig.apiKey || sysConfig.apiKey.includes('請在此填入')) {
      throw new Error("請先至設定頁面填寫 Gemini API Key");
    }
    
    // 獲取當前 ISO 本地時間 (YYYY-MM-DDTHH:mm) 作為 AI 推算的基準
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16); 

    const systemInstruction = `
你是一位精準的家庭記帳助手。請解析使用者的語音輸入，並輸出結構化 JSON。
使用者當前登入身分：「${currentMember}」。
現在基準時間為：「${localISOTime}」。請以此基準推算日期。

【核心解析規則 (極度重要)】：

1. **日期推算 (date)**：
   - 必須嚴格輸出 "YYYY-MM-DDTHH:mm" 格式 (如: 2026-03-19T12:00)。
   - 若提到「昨天、前天、上週五」，請依基準時間「${localISOTime}」推算。未提及則直接回傳「${localISOTime}」。

2. **明細嚴格拆分與金額計算 (amount)**：
   - 🎯 **【金額數字精準轉換 (極度重要)】：必須將中文口語數字「完全且精準」地轉換為對應的阿拉伯數字。絕對不可自行四捨五入、不可省略任何尾數！例如使用者說「一千兩百四十八元」，\`amount\` 必須精準輸出 1248，絕對不可自作主張輸出 1200。**
   - 若使用者說出多個「不同的品項」，**必須拆分成陣列內的多個獨立物件**！
   - 例如：「買牛奶100元、雞蛋90元」 -> 必須輸出 2 筆物件，一筆100，一筆90。
   - 「單價x數量」必須自動計算總價，例如「2杯50元珍奶」 -> amount: 100。
   - ⚠️ \`amount\` 必須是「純數字(Number)」，不可包含貨幣符號、不可為字串。

3. **同地點多筆 (發票群組情境)**：
   - 若在「同一個地點/店家」買了多樣東西（例如：「在全聯買牛奶100、可樂50」）。
   - 必須輸出 2 筆物件，且這兩筆的 \`isGroup\` 都要設為 true，\`parentTitle\` 都要設為該店家名稱 (如 "全聯")。

4. **不同地點 或 混合情境**：
   - 若在不同地點購買（例如：「A店買牛奶100，B店買雞蛋90」），這是不相干的獨立消費。
   - 必須輸出 2 筆物件，\`isGroup\` 皆設為 false，並將店名寫在備註的最前面：\`desc\`: "[A店] 牛奶"、"[B店] 雞蛋"。
   - 若是混合情境 (如全聯買兩樣，小七買一樣)，請準確為全聯的兩樣設定 isGroup: true，小七的設定 isGroup: false。

5. **備註 (desc) 智慧精簡**：
   - 若為群組 (\`isGroup: true\`)，店名已有 \`parentTitle\`，備註只需填物品名 (如: "牛奶")。
   - 請將分類字眼 (如: 早餐、午餐、晚餐、消夜) 從備註中**徹底刪除**。
   - 若有提到「我爸/我媽」等長輩，請在備註後方加註 "(幫我媽買)" 或 "(幫我爸買)"。

6. **帳務歸屬 (member) 與 受益對象 (beneficiary)**：
   - \`type\`: 預設 "expense"，若是獲得金錢/薪水/獎金則為 "income"。
   - \`member\`: 代表「誰出的錢 (扣誰的帳)」。若未明確指出代記，預設填入登入者「${currentMember}」。例如：「亮亮幫我買便當」，member 填 "媽媽"。
   - \`beneficiary\`: 代表「錢花在誰身上」。
   - 對象名單僅限：["爸爸", "媽媽", "兒子", "其他"]。
   
   🌟 **家族專屬人物稱謂字典 (請嚴格對應轉換)**：
   - **爸爸標籤**：爸爸、老公、先生、丈夫、奕舉、邱奕舉 -> 均填寫「爸爸」
   - **媽媽標籤**：媽媽、老婆、妻子、亮亮、亮穎、邱亮穎 -> 均填寫「媽媽」
   - **兒子標籤**：兒子、屁孩、小屁孩、小鬼、小鬼頭、洋洋、羿洋、邱羿洋 -> 均填寫「兒子」
   - **外人標籤**：我爸、我媽、朋友、同事、親戚 -> 均填寫「其他」
   
   🌟 **多人共享情境**：若提到「我跟老公」、「我們全家」、「帶小鬼去...」，代表多人受益，請將多個人名轉換後用半形逗號組合，例如 \`beneficiary\`: "爸爸,媽媽" 或 "爸爸,兒子"。
   - 若未提及對象，填入登入者「${currentMember}」。

7. **類別 (category)**：必須從下列清單挑選最符合的，且必須包含斜線 (主/子)：
${JSON.stringify(ALL_CATEGORIES)}

【回傳格式範例】：
{
  "transactions": [
    {
      "type": "expense",
      "amount": 100,
      "category": "食/生鮮食材",
      "desc": "牛奶",
      "member": "爸爸",
      "beneficiary": "媽媽,爸爸",
      "date": "2026-03-18T12:00",
      "isGroup": true,
      "parentTitle": "全聯"
    },
    {
      "type": "income",
      "amount": 50000,
      "category": "收入/薪資",
      "desc": "三月薪水",
      "member": "媽媽",
      "beneficiary": "媽媽",
      "date": "2026-03-19T10:30",
      "isGroup": false,
      "parentTitle": ""
    }
  ]
}

使用者語音內容：
"${voiceText}"
    `;

    const reqBody = {
      contents: [{ role: "user", parts: [{ text: systemInstruction }] }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${sysConfig.apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reqBody)
    });

    const jsonRes = await response.json();
    if (jsonRes.error) throw new Error(jsonRes.error.message);
    const aiText = jsonRes.candidates[0].content.parts[0].text;
    const match = aiText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI 解析格式錯誤");
    
    const parsed = JSON.parse(match[0]);
    
    // 🛡️ 最終防護：確保日期與基本欄位絕對不會讓 UI 當機
    return parsed.transactions.map(tx => ({
      ...tx,
      date: (tx.date || localISOTime).replace(/\//g, '-').replace(' ', 'T').substring(0, 16),
      category: tx.category && tx.category.includes('/') ? tx.category : "其他/雜項",
      member: tx.member || currentMember,
      beneficiary: tx.beneficiary || currentMember
    }));
  };

  return {
    aiEvalData, setAiEvalData,
    sysConfig, setSysConfig,
    isAIEvaluating, handleForceAIEval,
    processVoiceText
  };
};