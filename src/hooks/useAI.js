import { useState, useEffect, useRef } from 'react';
import { postGAS, getDeviceToken, deviceValid } from '../utils/api';
import { parseDateForSort, displayDateClean, nowStr } from '../utils/helpers';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';

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
  const [aiEvalData, setAiEvalData] = useState(null);
  const [sysConfig, setSysConfig] = useState({ apiKey: "", prompt: "" });
  const [isAIEvaluating, setIsAIEvaluating] = useState(false);

  useEffect(() => {
    if (!db) return;
    const unsubSettings = onSnapshot(doc(db, 'sysConfig', 'ai_settings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSysConfig({ apiKey: data.geminiKey || "", prompt: data.aiPrompt || "" });
      }
    }, (err) => console.error("讀取 AI 設定失敗:", err));

    const unsubResult = onSnapshot(doc(db, 'sysConfig', 'ai_result'), (docSnap) => {
      if (docSnap.exists()) setAiEvalData(docSnap.data());
      else setAiEvalData(null);
    }, (err) => console.error("讀取 AI 評語失敗:", err));

    return () => { unsubSettings(); unsubResult(); };
  }, []);

  const executeFrontendAI = async (isManual = false) => {
    if (!sysConfig.apiKey || sysConfig.apiKey.includes('請在此填入')) {
      if (isManual) showStatus("error", "尚未設定 API Key"); return;
    }
    if (!isOnline) {
      if (isManual) showStatus("error", "請確認網路連線以呼叫 AI"); return;
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
      parsedResult.meta_last_eval_date = todayStr;
      parsedResult.meta_last_eval_tx_count = txCache.length;
      
      await setDoc(doc(db, 'sysConfig', 'ai_result'), parsedResult);
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
    if (!aiEvalData) return;

    const todayStr = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
    const lastEvalDate = aiEvalData.meta_last_eval_date || "2000/01/01";
    const lastEvalCount = parseInt(aiEvalData.meta_last_eval_tx_count || "0", 10);

    if (todayStr !== lastEvalDate && txCache.length > lastEvalCount) {
      executeFrontendAI(false); 
    }
  }, [currentUser, txCache, isAIEvaluating, sysConfig.apiKey, aiEvalData]);

  const processVoiceText = async (voiceText, currentMember) => {
    if (!sysConfig.apiKey || sysConfig.apiKey.includes('請在此填入')) throw new Error("請先至設定頁面填寫 Gemini API Key");
    
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16); 

    const fullSystemInstruction = `
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
    }
  ]
}
使用者語音內容：
"${voiceText}"
    `;

    const reqBody = { contents: [{ role: "user", parts: [{ text: fullSystemInstruction }] }], generationConfig: { responseMimeType: "application/json" } };
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${sysConfig.apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reqBody)
    });
    const jsonRes = await response.json();
    if (jsonRes.error) throw new Error(jsonRes.error.message);
    const aiText = jsonRes.candidates[0].content.parts[0].text;
    const match = aiText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI 解析格式錯誤");
    const parsed = JSON.parse(match[0]);
    
    const sharedGroupId = `G_${Date.now()}_${currentMember}_${Math.random().toString(36).substring(2, 7)}`;
    
    return parsed.transactions.map(tx => {
      const isMultiGroup = parsed.transactions.length > 1 && tx.isGroup;
      return {
        ...tx,
        date: (tx.date || localISOTime).replace(/\//g, '-').replace(' ', 'T').substring(0, 16),
        category: tx.category && tx.category.includes('/') ? tx.category : "其他/雜項",
        member: tx.member || currentMember,
        beneficiary: tx.beneficiary || currentMember,
        groupId: isMultiGroup ? sharedGroupId : undefined,
        parentDesc: isMultiGroup ? `${tx.parentTitle || '多筆紀錄'}|||` : tx.parentDesc || ""
      };
    });
  };

  const processImageReceipt = async (base64Image, mimeType, currentMember) => {
    if (!sysConfig.apiKey || sysConfig.apiKey.includes('請在此填入')) throw new Error("請先至設定頁面填寫 Gemini API Key");
    
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);

    // 🚀 核心黑科技：本地原生 QR Code 掃描器 (免收費、速度快)
    let qrText = "";
    try {
      if ('BarcodeDetector' in window) {
        const img = new Image();
        img.src = `data:${mimeType};base64,${base64Image}`;
        await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
        
        // 呼叫手機/瀏覽器底層的條碼掃描引擎
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await detector.detect(img);
        
        if (barcodes.length > 0) {
          // 台灣發票通常有兩個 QR Code，把它們的隱藏字串接起來
          qrText = barcodes.map(b => b.rawValue).join('\\n');
          console.log("✅ 成功從圖片提取 QR Code 隱藏資訊！", qrText);
        }
      }
    } catch (e) {
      console.log("⚠️ 本地 QR 掃描略過 (環境可能不支援): ", e);
    }

    const systemInstruction = `
你是一個專業的會計助手，具備超強的視覺辨識能力。請分析這張單據照片（可能是電子發票、傳統收據、薪資單、帳單等）。
使用者當前登入身分：「${currentMember}」。
現在基準時間為：「${localISOTime}」。請以此基準推算日期。

${qrText ? `【🚨 極度重要：系統已成功提取發票的 QR Code 隱藏資訊！】
以下是 QR Code 解碼後的原始字串（台灣電子發票格式通常包含 發票號碼、日期、總金額 以及 品名:數量:單價 等明細）：
---
${qrText}
---
請你「絕對優先」依據上述 QR Code 字串內容來還原商品明細與金額，圖片僅作為輔助（例如辨識店名）。` : `【提示：若圖片中有 QR Code 且文字模糊，請盡全力解析圖像中的商品明細。】`}

【極度重要：你必須嚴格依照以下規則，輸出 JSON 陣列格式】

1. 🎯 強制拆分多筆明細：
   - 請仔細看單據上有幾個獨立的購買品項。如果有 N 個品項，你的 \`transactions\` 陣列就【必須輸出 N 個獨立的 JSON 物件】！絕對不允許把多個品項合併成一筆。
   - 若單據上有「折扣、折價、折讓」，請將其視為獨立的一筆物件，金額為負數 (例如 -150)，或者自行平均攤提至各品項中。

2. 店名/來源轉換 (parentTitle)：
   - 找出單據上的營業人名稱或店名。由於發票通常印「商業登記名稱」，請務必轉換為大眾熟知的「常用店名/品牌名稱」（例如：「統一超商」->「7-11」、「全聯實業」->「全聯」、「好市多股份有限公司」->「Costco」）。

3. 群組標記 (isGroup)：
   - 如果這張單據你拆出了 2 筆(含)以上的物件，這代表它們屬於同一張發票，請將這些物件的 \`isGroup\` 【全部設為 true】，並且它們的 \`parentTitle\` 必須完全一致。
   - 如果整張單據真的只有 1 個品項，該物件的 \`isGroup\` 請設為 false。

4. 金額與強制校驗 (amount)：
   - 抓取該品項的 (單價 * 數量) 作為該明細的最終金額。
   - 【強制校驗】：請你自己把輸出的所有物件 \`amount\` 加總，這個加總值必須 100% 完全等於單據上的「總計 / 應付金額」。

5. 日期優先級 (date)：
   - 【優先】尋找單據上印製的日期與時間，並格式化為 YYYY-MM-DDTHH:mm。找不到時才使用基準時間「${localISOTime}」。

6. 分類 (category) 與 備註 (desc)：
   - 備註 (desc) 必須填寫單據上的具體商品名稱。沒印明細的發票請建一筆總額紀錄，desc 填「電子發票無明細」。
   - 挑選最適合的分類。

7. 成員 (member) 與 對象 (beneficiary)：請一律預設為 "${currentMember}"。

系統可用分類如下：
${JSON.stringify(ALL_CATEGORIES)}

【強制輸出格式範例 (以同張發票買了兩樣東西為例)】：
{
  "transactions": [
    {
      "type": "expense",
      "amount": 599,
      "category": "居家/日用品",
      "desc": "萬用紙抹布10入",
      "member": "${currentMember}",
      "beneficiary": "${currentMember}",
      "date": "2026-03-25T14:30",
      "isGroup": true,
      "parentTitle": "Costco"
    },
    {
      "type": "expense",
      "amount": 249,
      "category": "食/生鮮食材",
      "desc": "日本山藥950G",
      "member": "${currentMember}",
      "beneficiary": "${currentMember}",
      "date": "2026-03-25T14:30",
      "isGroup": true,
      "parentTitle": "Costco"
    }
  ]
}
    `;
    
    const reqBody = { contents: [{ role: "user", parts: [{ text: systemInstruction }, { inlineData: { mimeType: mimeType, data: base64Image } }] }], generationConfig: { responseMimeType: "application/json" } };
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${sysConfig.apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reqBody)
    });
    const jsonRes = await response.json();
    if (jsonRes.error) throw new Error(jsonRes.error.message);
    const aiText = jsonRes.candidates[0].content.parts[0].text;
    const match = aiText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI 解析格式錯誤");
    const parsed = JSON.parse(match[0]);
    
    const sharedGroupId = `G_${Date.now()}_${currentMember}_${Math.random().toString(36).substring(2, 7)}`;
    
    return parsed.transactions.map(tx => {
      const isMultiGroup = parsed.transactions.length > 1 && tx.isGroup;
      return {
        ...tx,
        date: (tx.date || localISOTime).replace(/\//g, '-').replace('T', ' ').substring(0, 16),
        category: tx.category && tx.category.includes('/') ? tx.category : "其他/雜項",
        amount: Number(tx.amount) || 0,
        member: tx.member || currentMember,
        beneficiary: tx.beneficiary || currentMember,
        groupId: isMultiGroup ? sharedGroupId : undefined,
        parentDesc: isMultiGroup ? `${tx.parentTitle || '多筆紀錄'}|||` : tx.parentDesc || ""
      };
    });
  };

  return { aiEvalData, setAiEvalData, sysConfig, setSysConfig, isAIEvaluating, handleForceAIEval, processVoiceText, processImageReceipt };
};