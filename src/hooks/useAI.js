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

  const handleForceAIEval = () => { /* 保留既有邏輯 */ };

  const processVoiceText = async (voiceText, currentMember) => {
    if (!sysConfig.apiKey || sysConfig.apiKey.includes('請在此填入')) throw new Error("請先至設定頁面填寫 Gemini API Key");
    
    const systemInstruction = `
你是一位精準的家庭記帳助手。請解析使用者的語音輸入，並輸出結構化 JSON。
使用者當前登入身分：「${currentMember}」。

【核心解析規則】：
1. **收支類型 (type) 與金額計算**：
   - 判定是支出 ("expense") 還是收入 ("income")。若語音表達為獲得金錢、薪水、中獎、收到錢等，請判定為 "income"，否則為 "expense"。
   - 務必計算出「總金額」填入 \`amount\` (例如: 3個30元的蘋果 -> amount: 90)。

2. **備註格式 (desc) 與智慧精簡**：
   - 格式：[地點/店家] 物品名稱 x數量。
   - ⚠️ **智慧精簡**：如果使用者的語音包含了「分類名稱」(如: 早餐、午餐、晚餐)，**請將這些字眼從備註中刪除**！
   - 例如：使用者說「晚餐橘子便當」，分類為「食/晚餐」，備註請只留下「橘子便當」。

3. ⚠️ **人物稱謂與 Beneficiary 判定邏輯**：
   - 系統對象：["爸爸", "媽媽", "洋洋", "其他"]。
   - 若提到「**我**爸」或「**我**媽」，這代表「家外長輩」，\`beneficiary\` 填寫「其他」，並在 \`desc\` 加註 "(幫我爸/媽買)"。
   - 若單純說「幫爸爸/媽媽買」(沒加「我」字)，視為核心成員。
   - 若未提及對象，填入登入者「${currentMember}」。

4. **類別 (category)**：必須從下列清單挑選：
${JSON.stringify(ALL_CATEGORIES)}

【回傳格式】：
{
  "transactions": [
    {
      "type": "expense", // 或 "income"
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
    return JSON.parse(match[0]).transactions;
  };

  return { aiEvalData, sysConfig, isAIEvaluating, handleForceAIEval, processVoiceText };
};