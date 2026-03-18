import { useState, useEffect, useRef } from 'react';
import { postGAS, getDeviceToken, deviceValid } from '../utils/api';
import { parseDateForSort, displayDateClean, nowStr } from '../utils/helpers';

const EXPENSE_CATEGORIES = [
  "食/早餐", "食/午餐", "食/晚餐", "食/生鮮食材", "食/零食/飲料", "食/外食聚餐", "食/其他",
  "衣/爸爸服飾", "衣/媽媽服飾", "衣/小孩服飾", "衣/鞋包/配件", "衣/保養/美妝", "衣/其他",
  "居家/房貸", "居家/管理費", "居家/水費", "居家/電費", "居家/瓦斯費", "居家/網路/電信", "居家/家具/家電", "居家/日用品", "居家/房屋稅/地價稅", "居家/其他",
  "行/大眾運輸", "行/計程車/共享", "行/加油", "行/停車費", "行/保養維修", "行/牌照/燃料稅", "行/eTag/過路費", "行/其他",
  "教育/學校學費", "教育/安親/才藝班", "教育/教材/文具", "教育/童書/玩具", "教育/零用錢", "教育/其他",
  "娛樂/國內旅遊", "娛樂/國外旅遊", "娛樂/串流訂閱", "娛樂/運動健身", "娛樂/聚會活動", "娛樂/電影/展覽", "娛樂/其他",
  "醫療/保健食品", "醫療/診所門診", "醫療/牙醫/眼科", "醫療/醫美", "醫療/住院", "醫療/其他",
  "理財/股票/ETF", "理財/定期定額", "理財/基金", "理財/儲蓄險", "理財/外匯", "理財/加密貨幣", "理財/其他",
  "其他/保險費", "其他/孝親費", "其他/紅白包", "其他/捐款/贈與", "其他/雜項"
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

  const executeFrontendAI = async (isManual = false) => {
    if (!sysConfig.apiKey || sysConfig.apiKey.includes('請在此填入')) {
      if (isManual) showStatus("error", "尚未設定 API Key");
      return;
    }
    setIsAIEvaluating(true);
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
      const aiText = jsonRes.candidates[0].content.parts[0].text;
      const match = aiText.match(/\{[\s\S]*\}/);
      const parsedResult = JSON.parse(match[0]);
      const todayStr = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
      parsedResult.lastUpdated = `${todayStr} ${new Date().toLocaleTimeString('zh-TW', { hour12: false })}`;
      setAiEvalData(parsedResult);
      postGAS({ action: "SAVE_AI_RESULT", aiData: parsedResult, deviceToken: getDeviceToken() }).catch(()=>{});
    } catch (e) {
    } finally {
      setIsAIEvaluating(false);
    }
  };

  const handleForceAIEval = () => executeFrontendAI(true);

  // 🚀 核心：語音記帳解析引擎 (終極進化版：人物族譜 + 數量數學 + 店家提取)
  const processVoiceText = async (voiceText, currentMember) => {
    if (!sysConfig.apiKey || sysConfig.apiKey.includes('請在此填入')) {
      throw new Error("請先至設定頁面填寫 Gemini API Key");
    }
    
    const systemInstruction = `
你是一位精準的家庭記帳助手。請解析使用者的語音輸入，並輸出結構化 JSON。
使用者當前登入身分：「${currentMember}」。

【核心解析規則】：
1. **多筆判斷**：
   - 不同地點/時間的消費請拆成 array 內多個物件。
   - 同地點的多個物品，請拆成多個物件，\`isGroup\` 設為 true，\`parentTitle\` 設為該地點名稱(例如: 全聯、大潤發)。

2. **金額與數量計算 (重要)**：
   - 語音若包含「單價」與「數量」，請務必計算出「總價」填入 \`amount\`。
   - 例如：「買了三個30元的蘋果」-> amount: 90。
   - 例如：「3個蘋果90元」-> amount: 90。

3. **備註格式 (desc)**：
   - 格式：[地點/店家] 物品名稱 x數量。
   - 若提到人物長輩，需加註於括號。
   - 例如：「[全聯] 蘋果x3」、「[7-11] 咖啡」。

4. ⚠️ **人物稱謂與 Beneficiary (受益人) 判定邏輯**：
   - 系統標準對象只有：["爸爸", "媽媽", "洋洋", "其他"]。
   - **對象「洋洋」(兒子標籤)**：兒子, 小子, 屁孩, 小屁孩, 洋洋, 奕洋, 邱奕洋。
   - **對象「爸爸」**：老公, 先生, 丈夫, 奕舉, 邱奕舉, 爸爸(限非登入者提及時)。
   - **對象「媽媽」**：老婆, 亮亮, 亮穎, 邱亮穎, 媽媽(限非登入者提及時)。
   - **「我」字長輩特別規則 (關鍵)**：
     - 若提到「**我**爸」或「**我**媽」，不論是誰登入，這代表「家外長輩」，\`beneficiary\` 一律填寫「其他」，並在 \`desc\` 加註 "(幫我爸/媽買)"。
     - 若登入者是爸爸，卻說「幫爸爸買」，指的也是長輩，\`beneficiary\` 填「其他」。
     - **注意**：若單純說「幫爸爸買」或「幫媽媽買」(沒加「我」字)，則視為核心成員。
   - **預設值**：若未提及對象，填入登入者「${currentMember}」。

5. **類別 (category)**：必須且只能從下列清單挑選：
${JSON.stringify(EXPENSE_CATEGORIES)}

【回傳格式】：
{
  "transactions": [
    {
      "amount": 總金額(Number),
      "category": "主類別/子類別",
      "desc": "[店家] 物品x數量",
      "beneficiary": "對象姓名",
      "isGroup": true/false,
      "parentTitle": "地點名稱"
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
    return parsed.transactions;
  };

  return {
    aiEvalData, setAiEvalData,
    sysConfig, setSysConfig,
    isAIEvaluating, handleForceAIEval,
    processVoiceText
  };
};