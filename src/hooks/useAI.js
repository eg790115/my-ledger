// src/hooks/useAI.js
import { useState, useEffect, useRef } from 'react';
import { postGAS, getDeviceToken, deviceValid } from '../utils/api';
import { parseDateForSort, displayDateClean } from '../utils/helpers';

export const useAI = ({ currentUser, isOnline, txCache, showStatus }) => {
  const [aiEvalData, setAiEvalData] = useState(() => { 
    try { return JSON.parse(localStorage.getItem('ai_eval_data')) || null; } catch { return null; } 
  });
  
  const [sysConfig, setSysConfig] = useState(() => { 
    try { return JSON.parse(localStorage.getItem('sys_config')) || { apiKey: "", prompt: "" }; } catch { return { apiKey: "", prompt: "" }; } 
  });
  
  const [isAIEvaluating, setIsAIEvaluating] = useState(false);
  const hasTriggeredAutoAI = useRef(false);

  // 狀態變更時自動存入 LocalStorage
  useEffect(() => localStorage.setItem('ai_eval_data', JSON.stringify(aiEvalData || {})), [aiEvalData]);
  useEffect(() => localStorage.setItem('sys_config', JSON.stringify(sysConfig || {})), [sysConfig]);

  // 🚀 執行前端 AI 深度分析
  const executeFrontendAI = async (isManual = false) => {
    if (!sysConfig.apiKey || sysConfig.apiKey.includes('請在此填入')) {
      if (isManual) showStatus("error", "尚未設定 API Key");
      return;
    }

    setIsAIEvaluating(true);
    if (isManual) showStatus("info", "🤖 正在連線 AI 分析...");

    try {
      // 擷取近半年的資料給 AI 判斷
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

      const promptTemplate = sysConfig.prompt || "你是一位專業的家庭理財教練。請針對以下帳單給予財務建議。";
      const finalPrompt = `
      ${promptTemplate}

      【以下為帳本資料 (近半年歷史，請大膽抓漏)】：
      爸爸資料：
      ${dadStr}

      媽媽資料：
      ${momStr}
      `;

      const reqBody = {
        contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      };

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${sysConfig.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody)
      });

      const jsonRes = await response.json();

      if (jsonRes.error) throw new Error(jsonRes.error.message);
      if (!jsonRes.candidates || jsonRes.candidates.length === 0) throw new Error("AI 沒有回傳內容或 API 暫時無回應");

      const aiText = jsonRes.candidates[0].content.parts[0].text;
      const match = aiText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI 回傳格式錯誤 (非 JSON)");

      const parsedResult = JSON.parse(match[0]);
      
      // 加上更新時間標記
      const todayStr = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
      parsedResult.lastUpdated = `${todayStr} ${new Date().toLocaleTimeString('zh-TW', { hour12: false })}`;

      setAiEvalData(parsedResult);
      // 在背景將分析結果回寫至雲端，失敗也不影響前端顯示
      postGAS({ action: "SAVE_AI_RESULT", aiData: parsedResult, deviceToken: getDeviceToken() }).catch(()=>{});

      if (isManual) showStatus("success", "✨ AI 深度分析完成！");

    } catch (e) {
      if (isManual) showStatus("error", `❌ AI 錯誤: ${e.message}`);
    } finally {
      setIsAIEvaluating(false);
    }
  };

  const handleForceAIEval = () => executeFrontendAI(true);

  // 🚀 自動觸發機制：一天最多一次，且有新資料才觸發
  useEffect(() => {
    if (currentUser && isOnline && txCache.length > 0 && sysConfig.apiKey && !hasTriggeredAutoAI.current && deviceValid()) {
      const checkTimer = setTimeout(() => {
        hasTriggeredAutoAI.current = true;
        let shouldTrigger = false;

        if (!aiEvalData || !aiEvalData.lastUpdated) {
          shouldTrigger = true;
        } else {
          const todayStr = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
          const lastEvalDateStr = aiEvalData.lastUpdated.split(' ')[0];

          if (lastEvalDateStr !== todayStr) {
            const lastTimeMs = new Date(aiEvalData.lastUpdated.replace(/-/g, "/")).getTime();
            const latestTxTime = txCache.reduce((max, tx) => Math.max(max, tx.lastModified || tx.timestamp || 0), 0);

            if (latestTxTime > lastTimeMs) {
              shouldTrigger = true;
            }
          }
        }

        if (shouldTrigger) executeFrontendAI(false);
      }, 5000); // 延遲 5 秒執行，避免阻塞主執行緒

      return () => clearTimeout(checkTimer);
    }
  }, [currentUser, isOnline, txCache, sysConfig, aiEvalData]);

  return {
    aiEvalData,
    setAiEvalData,
    sysConfig,
    setSysConfig,
    isAIEvaluating,
    handleForceAIEval
  };
};