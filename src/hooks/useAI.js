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

  // 🤖 財務教練執行邏輯 (已修復：錯誤捕捉、網路檢查、自動觸發寫入)
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

      // 成功後寫入觸發紀錄
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

  // 每日智慧觸發機制
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


  // 🚀 核心：語音記帳解析引擎 (加入代記邏輯、時間推演)
  const processVoiceText = async (voiceText, currentMember) => {
    if (!sysConfig.apiKey || sysConfig.apiKey.includes('請在此填入')) {
      throw new Error("請先至設定頁面填寫 Gemini API Key");
    }
    
    // 獲取現在的真實時間，讓 AI 有基準點推算「昨天」、「前天」
    const now = new Date();
    const currentDateStr = now.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/') + ' ' + now.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute:'2-digit' });

    const systemInstruction = `
你是一位精準的家庭記帳助手。請解析使用者的語音輸入，並輸出結構化 JSON。
使用者當前登入身分 (說話者)：「${currentMember}」。
現在的真實時間是：「${currentDateStr}」。請以此時間為基準推算相對日期。

【核心解析規則】：
1. **多筆判斷與數量計算**：
   - 不同地點/時間的消費請拆成 array 內多個物件。
   - 同地點的多個物品，\`isGroup\` 設為 true，\`parentTitle\` 設為該地點名稱。
   - 包含「單價」與「數量」時 (如: 3個30元蘋果)，務必計算「總價」填入 \`amount\`(90)。

2. **消費日期推算 (date) - 新增**：
   - 若語音提到「昨天、前天、上週五、3月15日」等，請依照現在時間「${currentDateStr}」推算出正確的日期時間，格式為 "YYYY/MM/DD HH:mm"。
   - 若未提及任何時間，請直接回傳 "${currentDateStr}"。

3. **代記功能與帳務歸屬 (member) & 受益人 (beneficiary) - 新增**：
   - \`member\` 代表「誰出的錢 (扣誰的帳)」。\`beneficiary\` 代表「這筆錢是花在誰身上」。
   - 例如：登入者是爸爸，說「媽媽幫我買便當100元」 -> 媽媽出的錢 (\`member\`: "媽媽")，爸爸吃掉的 (\`beneficiary\`: "爸爸")。
   - 例如：登入者是媽媽，說「我幫爸爸買衣服」 -> 媽媽出的錢 (\`member\`: "媽媽")，爸爸穿的 (\`beneficiary\`: "爸爸")。
   - 若未明確指出誰出的錢，\`member\` 預設為登入者「${currentMember}」。

4. **人物判定字典**：
   - 系統標準對象只有：["爸爸", "媽媽", "洋洋", "其他"]。
   - 「老公/先生」-> 爸爸；「老婆」-> 媽媽；「兒子/屁孩/洋洋」-> 洋洋。
   - 提到「我爸/我媽」(家外長輩)，\`beneficiary\` 一律填寫「其他」，並在 \`desc\` 加註 "(幫我爸/媽買)"。

5. **模糊判定與容錯 (重要)**：
   - 若你無法 100% 確定對象、日期或分類，請以你的邏輯做出「最合理的猜測」。使用者在 APP 內會有確認面板可以進行二次修改，不用擔心出錯。

6. **類別 (category)**：必須且只能從下列清單挑選：
${JSON.stringify(EXPENSE_CATEGORIES)}

【回傳格式】：
{
  "transactions": [
    {
      "amount": 總金額(Number),
      "category": "主類別/子類別",
      "desc": "[店家] 物品x數量",
      "member": "出錢者姓名(如: 媽媽)",
      "beneficiary": "受益者姓名(如: 爸爸)",
      "date": "YYYY/MM/DD HH:mm",
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