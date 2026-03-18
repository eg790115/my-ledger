import { useState, useEffect, useRef } from 'react';
import { postGAS, getDeviceToken } from '../utils/api';
import { parseDateForSort, displayDateClean } from '../utils/helpers';

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
  "收入/爸爸薪資", "收入/媽媽薪資", "收入/獎金", "收入/投資收益", "收入/利息", "收入/其他收入"
];

export const useAI = ({ currentUser, isOnline, txCache, showStatus }) => {
  const [aiEvalData, setAiEvalData] = useState(() => { try { return JSON.parse(localStorage.getItem('ai_eval_data')) || null; } catch { return null; } });
  const [sysConfig, setSysConfig] = useState(() => { try { return JSON.parse(localStorage.getItem('sys_config')) || { apiKey: "", prompt: "" }; } catch { return { apiKey: "", prompt: "" }; } });
  const [isAIEvaluating, setIsAIEvaluating] = useState(false);

  useEffect(() => {
    const handleCloudSync = (e) => {
      const data = e.detail;
      if (data.aiData !== undefined) { setAiEvalData(data.aiData); localStorage.setItem('ai_eval_data', JSON.stringify(data.aiData)); }
      if (data.sysConfig !== undefined) { setSysConfig(data.sysConfig); localStorage.setItem('sys_config', JSON.stringify(data.sysConfig)); }
    };
    window.addEventListener('cloud_data_synced', handleCloudSync);
    return () => window.removeEventListener('cloud_data_synced', handleCloudSync);
  }, []);

  const handleForceAIEval = () => { /* 這裡保留，實際由 SettingsTab 呼叫時處理 */ };

  const processVoiceText = async (voiceText, currentMember) => {
    if (!sysConfig.apiKey || sysConfig.apiKey.includes('請在此填入')) throw new Error("請先至設定頁面填寫 Gemini API Key");
    
    const systemInstruction = `
你是一位精準的家庭記帳助手。請解析使用者的語音輸入，並輸出結構化 JSON。
使用者當前登入身分：「${currentMember}」。

【核心解析規則 (極度重要)】：
1. **明細嚴格拆分 (絕對不可擅自加總不同品項)**：
   - 若使用者說出多個「不同的品項」，**必須拆分成陣列內的多個獨立物件**！
   - 例如：「買牛奶100元、雞蛋90元」 -> 必須輸出 2 筆物件，一筆100，一筆90。
   - 只有「同一品項有多個數量」時才計算總價，例如「3個30元蘋果」 -> 輸出 1 筆 90。

2. **同地點多筆 (發票群組情境)**：
   - 若在「同一個地點/店家」買了多樣東西（例如：「在全聯買牛奶100、可樂50」）。
   - 必須輸出 2 筆物件，且這兩筆的 \`isGroup\` 都要設為 true，\`parentTitle\` 都要設為該店家名稱 (如 "全聯")。

3. **不同地點 或 混合情境**：
   - 若在不同地點購買（例如：「A店買牛奶100，B店買雞蛋90」），這是不相干的獨立消費。
   - 必須輸出 2 筆物件，\`isGroup\` 皆設為 false，並將店名寫在備註的最前面：\`desc\`: "[A店] 牛奶"、"[B店] 雞蛋"。
   - 若是混合情境 (如全聯買兩樣，小七買一樣)，請準確為全聯的兩樣設定 isGroup: true，小七的設定 isGroup: false。

4. **備註 (desc) 智慧精簡**：
   - 若為群組 (\`isGroup: true\`)，店名已有 \`parentTitle\`，備註只需填物品名 (如: "牛奶")。
   - 請將分類字眼 (如: 早餐、午餐、晚餐、消夜) 從備註中**徹底刪除**。
   - 若有提到「我爸/我媽」等長輩，請在備註後方加註 "(幫我媽買)"。

5. **對象 (beneficiary) 與收支判定**：
   - \`type\`: 預設 "expense"，若是獲得金錢/薪水則為 "income"。
   - 對象名單：["爸爸", "媽媽", "洋洋", "其他"]。
   - 「我爸/我媽」-> 填「其他」。
   - 「老公/先生」-> 填「爸爸」；「老婆」-> 填「媽媽」；「兒子/屁孩」-> 填「洋洋」。
   - 若未提及對象，填入登入者「${currentMember}」。

6. **類別 (category)**：必須從下列清單挑選最符合的：
${JSON.stringify(ALL_CATEGORIES)}

【回傳格式範例】：
{
  "transactions": [
    {
      "type": "expense",
      "amount": 100,
      "category": "食/生鮮食材",
      "desc": "牛奶",
      "beneficiary": "媽媽",
      "isGroup": true,
      "parentTitle": "全聯"
    },
    {
      "type": "expense",
      "amount": 90,
      "category": "食/生鮮食材",
      "desc": "雞蛋",
      "beneficiary": "媽媽",
      "isGroup": true,
      "parentTitle": "全聯"
    },
    {
      "type": "expense",
      "amount": 50,
      "category": "食/零食/飲料",
      "desc": "[7-11] 可樂",
      "beneficiary": "媽媽",
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
    return JSON.parse(match[0]).transactions;
  };

  return { aiEvalData, sysConfig, isAIEvaluating, handleForceAIEval, processVoiceText };
};