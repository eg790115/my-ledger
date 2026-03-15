// src/components/SettingsTab.jsx
import React from 'react';
import { SvgIcon } from './Icons';
import { APP_VERSION, LS } from '../utils/constants';
import { formatDateOnly } from '../utils/helpers';

const SettingsTab = ({
  handleForceAIEval, isAIEvaluating, isSyncing, triggerVibration,
  billingStartDay, setBillingStartDay, currentCycleRange,
  customSubtitle, setCustomSubtitle, handleSaveGreeting,
  currentUser, setShowChangePinModal, bioBound, setUnbindPin,
  setShowUnbindModal, bindDeviceBio, setShowClearCacheModal,
  setCurrentUser, setSelectingUser, setPinInput, setActiveTab,
  syncQueue, setShowClearQueueModal, isLogOpen, setIsLogOpen
}) => {
  return (
    <div className="space-y-4 animate-in text-left pb-20 text-gray-800">
      
      {/* AI 手動分析按鈕 */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-[2rem] border shadow-sm border-indigo-100/50 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-purple-400/10 blur-[40px] rounded-full"></div>
         <h3 className="font-black text-xs mb-4 uppercase flex items-center gap-2 text-indigo-900 tracking-widest px-1">
           <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] shadow-sm">🤖</div>
           專屬理財 AI 顧問
         </h3>
         <p className="text-[10px] text-indigo-500 font-bold mb-4 leading-relaxed px-1">系統會在您每天第一次登入時，於背景偷偷產生最新 AI 評估。若您剛記完大筆開銷，也可點擊下方按鈕強制 AI 重新分析。</p>
         <button onClick={handleForceAIEval} disabled={isAIEvaluating || isSyncing} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black active:scale-95 transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 disabled:opacity-50">
            {isAIEvaluating ? <SvgIcon name="spinner" size={18} className="animate-spin" /> : "✨"}
            {isAIEvaluating ? "AI 正在思考中..." : "手動強制重新分析"}
         </button>
      </div>

      {/* 記帳週期設定 */}
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm border-gray-100">
        <h3 className="font-black text-xs mb-4 uppercase flex items-center gap-2 text-gray-800 tracking-widest px-1"><SvgIcon name="calendar" size={16} className="text-blue-500 shrink-0" /> 記帳週期設定</h3>
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-blue-200 transition-colors">
          <label className="text-[9px] font-black text-gray-400 uppercase block mb-2 leading-none tracking-widest">起始日 (如信用卡結帳日)</label>
          <div className="flex items-center gap-2">
            <select value={billingStartDay} onChange={(e) => { triggerVibration(10); const newDay = Number(e.target.value); setBillingStartDay(newDay); localStorage.setItem(LS.billingStartDay, String(newDay)); }} className="flex-1 bg-transparent font-black border-none outline-none text-blue-600 text-sm min-w-0">
              {[...Array(28)].map((_, i) => <option key={i+1} value={i+1}>每月 {i+1} 號</option>)}
            </select>
          </div>
          <div className="mt-3 text-[10px] text-gray-500 font-bold bg-white p-2 rounded-xl border border-gray-100 leading-relaxed">設定後，歷史清單與圖表的「本期/上期」將以此為基準。<br/>👉 目前本期範圍：<span className="text-blue-600 ml-1">{formatDateOnly(currentCycleRange.start)} ~ {formatDateOnly(currentCycleRange.end)}</span></div>
        </div>
      </div>
      
      {/* 介面自訂 */}
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm border-gray-100">
        <h3 className="font-black text-xs mb-4 uppercase flex items-center gap-2 text-gray-800 tracking-widest px-1"><SvgIcon name="edit" size={16} className="text-blue-500 shrink-0" /> 介面自訂</h3>
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-blue-200 transition-colors">
          <label className="text-[9px] font-black text-gray-400 uppercase block mb-2 leading-none tracking-widest">首頁副標題問候語 (支援 {"{name}"} 變數)</label>
          <div className="flex items-center gap-2">
            <input type="text" className="flex-1 bg-transparent font-bold border-none outline-none text-gray-800 placeholder:text-gray-300 text-sm min-w-0" placeholder="例如：{name}，你好！" value={customSubtitle || ""} onChange={(e) => setCustomSubtitle(e.target.value)} />
            <button onClick={handleSaveGreeting} disabled={isSyncing} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black shadow-sm active:scale-95 disabled:opacity-50 shrink-0">儲存</button>
          </div>
        </div>
      </div>
      
      {/* 安全與帳戶管理 */}
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm border-gray-100">
        <h3 className="font-black text-xs mb-5 uppercase flex items-center gap-2 text-gray-800 tracking-widest px-1"><SvgIcon name="info" size={16} className="text-blue-500 shrink-0" /> 安全與帳戶管理</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 gap-2">
            <div className="min-w-0"><p className="text-gray-400 text-[10px] font-black uppercase mb-1 leading-none truncate">使用身份</p><p className="font-black text-gray-800 text-base leading-none mt-1 truncate">{currentUser.name}</p></div>
            <button onClick={() => { triggerVibration(10); setShowChangePinModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all shrink-0">更換密碼</button>
          </div>
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 gap-2">
            <div className="min-w-0"><p className="text-gray-400 text-[10px] font-black uppercase mb-1 leading-none truncate">生物辨識 / 裝置解鎖</p><p className="font-black text-gray-800 text-sm leading-none mt-1 truncate">{bioBound ? "設備已綁定" : "設備未綁定"}</p></div>
            <button onClick={() => { triggerVibration(10); bioBound ? (setUnbindPin(""), setShowUnbindModal(true)) : bindDeviceBio(); }} className={`px-4 py-2 rounded-xl font-black text-xs active:scale-95 transition-all shrink-0 ${bioBound ? "bg-red-50 text-red-600 border border-red-100" : "bg-green-600 text-white shadow-lg"}`}>{bioBound ? "解除綁定" : "綁定設備"}</button>
          </div>
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 gap-2">
              <div className="min-w-0"><p className="text-gray-400 text-[10px] font-black uppercase mb-1 leading-none truncate">系統深度清理</p><p className="font-black text-gray-800 text-sm leading-none mt-1 truncate">清空本地所有快取</p></div>
              <button onClick={() => { triggerVibration(10); setShowClearCacheModal(true); }} className="px-4 py-2 bg-red-600 text-white rounded-xl font-black text-xs active:scale-95 transition-all shadow-lg shadow-red-500/30 shrink-0">執行清理</button>
          </div>
        </div>
        <button onClick={() => { triggerVibration(15); setCurrentUser(null); setSelectingUser(null); setPinInput(""); setActiveTab("dashboard"); }} className="w-full mt-6 py-4 bg-red-50 text-red-600 rounded-2xl font-black active:scale-95 transition-all flex items-center justify-center gap-2 border border-red-100"><SvgIcon name="logout" size={20} className="shrink-0" /> 登出 / 切換使用者</button>
        
        {syncQueue && syncQueue.length > 0 && (
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mt-4 flex justify-between items-center gap-2">
            <div className="min-w-0"><p className="text-red-400 text-[10px] font-black uppercase mb-1 leading-none truncate">異常排解</p><p className="font-black text-red-600 text-sm leading-none mt-1 truncate">有 {syncQueue.length} 筆資料卡住</p></div>
            <button onClick={() => { triggerVibration([50, 50]); setShowClearQueueModal(true); }} className="px-4 py-2 bg-red-600 text-white rounded-xl font-black text-xs active:scale-95 transition-all shadow-lg shadow-red-500/30 shrink-0">強制清除</button>
          </div>
        )}
      </div>

      {/* 系統資訊 & 更新歷程 */}
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm border-gray-100">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsLogOpen(!isLogOpen)}>
          <h3 className="font-black text-xs uppercase flex items-center gap-2 text-gray-800 tracking-widest px-1"><SvgIcon name="chart" size={16} className="text-blue-500 shrink-0" /> 系統資訊 & 更新歷程</h3>
          <span className={`text-gray-400 text-[10px] transition-transform duration-300 ${isLogOpen ? 'rotate-180' : ''}`}>▼</span>
        </div>
        {isLogOpen && (
          <div className="mt-5 space-y-5 font-bold text-gray-600 animate-in border-t border-gray-100 pt-4">
            <div className="border-l-2 border-blue-500 pl-3">
              <p className="text-gray-800 text-xs mb-1 flex items-center gap-2">APP 前端 <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-mono">{APP_VERSION}</span></p>
              <ul className="list-disc pl-4 text-[10px] space-y-1 text-gray-500">
                <li>正式轉換為 Vite + React 多檔案專案架構，大幅提升開發與維護效率。</li>
                <li>全面升級 IndexedDB 取代 LocalStorage 儲存資料，突破 5MB 限制。</li>
                <li>導入增量同步 (Delta Sync) 演算法與衝突防護機制，流量消耗降低 90%。</li>
                <li>歷史清單導入 react-virtuoso 虛擬列表技術，萬筆資料滑動依然順暢不卡頓。</li>
                <li>加入原生的震動回饋 (Haptic Feedback) 引擎，強化點擊手感。</li>
                <li>切換為前端直連 AI 架構，徹底解決 GAS 外部連線權限問題。</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsTab;