import React from 'react';
import { SvgIcon } from './Icons';

/**
 * AIAssistant 組件
 * @param {string} evaluationText - AI 產生的分析文字
 * @param {string} lastUpdated - 最後更新時間字串
 * @param {boolean} isEvaluating - 是否正在連線 AI 中
 * @param {function} onManualTrigger - 手動觸發 AI 分析的函式
 */
const AIAssistant = ({ evaluationText, lastUpdated, isEvaluating, onManualTrigger }) => {
  return (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden transition-all">
      {/* 裝飾背景色塊 */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[40px] rounded-full -mr-10 -mt-10"></div>
      
      {/* 標題區域 */}
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <h3 className="font-black text-gray-800 text-lg flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
              <SvgIcon name="spinner" size={16} className={isEvaluating ? "animate-spin" : ""} />
            </span>
            智慧財管顧問
          </h3>
          <p className="text-[10px] text-gray-400 font-black mt-1 uppercase tracking-widest">
            {isEvaluating ? "AI 正在思考您的消費習慣..." : `最後更新：${lastUpdated || "尚未分析"}`}
          </p>
        </div>
        
        {/* 手動按鈕 */}
        {onManualTrigger && (
          <button 
            onClick={onManualTrigger}
            disabled={isEvaluating}
            className="p-2 bg-indigo-50 text-indigo-600 rounded-xl active:scale-90 transition-all disabled:opacity-30"
            title="手動重新分析"
          >
            <SvgIcon name="refresh" size={18} />
          </button>
        )}
      </div>

      {/* 分析內容區 */}
      <div className="relative z-10">
        {evaluationText ? (
          <div className="bg-indigo-50/50 p-5 rounded-[2rem] border border-indigo-100/50">
            <div className="text-sm text-indigo-900 leading-relaxed font-black whitespace-pre-wrap">
              {/* 這裡顯示 AI 的回傳內容 */}
              {evaluationText}
            </div>
            
            {/* 底部小提示 */}
            <div className="mt-4 pt-4 border-t border-indigo-100 flex items-center gap-2">
              <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-lg font-black uppercase">Tips</span>
              <p className="text-[10px] text-indigo-400 font-black italic">此建議僅供參考，理財需謹慎。</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
            <div className="text-gray-300 mb-3"><SvgIcon name="chart" size={40} /></div>
            <p className="text-xs text-gray-400 font-black text-center leading-relaxed">
              點擊右上角按鈕<br />
              讓 Gemini 為您進行深度財務分析
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// 🌟 這行最重要！解決您遇到的 "does not provide an export named 'default'" 錯誤
export default AIAssistant;