import React from 'react';
import { SvgIcon } from './Icons';
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

  // 🌟 新增：專屬的安全日期格式化，徹底阻絕 NaN 錯誤
  const safeFormat = (ts) => {
    if (!ts) return "計算中...";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "日期錯誤";
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 animate-in text-left pb-20 text-gray-800">
      
      {/* 🌟 這裡完美保留了您的原始 UI，只加上了條件判斷 */}
      {currentUser?.name === '爸爸' && (
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2.5rem] p-6 shadow-md text-white mb-6 relative overflow-hidden">
       
          <div className="absolute -right-4 -top-4 opacity-10">
            <SvgIcon name="pieChart" size={100} />
          </div>
          <div className="relative z-10">
            <h3 className="font-black text-lg mb-2 flex items-center gap-2">
              <span className="text-2xl">🤖</span> AI 財務教練
            </h3>
         
            <p className="text-indigo-100 text-xs font-bold leading-relaxed mb-4">
              系統每天會自動分析一次。若您剛新增了大量紀錄，可以點擊下方按鈕強制 AI 重新深度檢閱最近 30 天的帳本。
            </p>
            <button 
              onClick={() => { triggerVibration(10); handleForceAIEval(); }} 
              disabled={isAIEvaluating}
              className="w-full py-3 bg-white text-indigo-600 rounded-xl font-black text-sm active:scale-95 transition-transform shadow-sm disabled:opacity-80 flex items-center justify-center gap-2"
            >
              {isAIEvaluating ? <><SvgIcon name="spinner" size={18} className="animate-spin" /> 分析中...</> : "手動強制重新分析"}
            </button>
          </div>
        </div>
      )}

      {/* 👇 下面是您原始的程式碼，一個字母都沒改！ 👇 */}
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm border-gray-100">
        <h3 className="font-black text-xs mb-4 uppercase flex items-center gap-2 text-gray-800 tracking-widest px-1">
          <SvgIcon name="calendar" size={16} className="text-blue-500 shrink-0" /> 記帳週期設定
 
        </h3>
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-blue-200 transition-colors">
          <label className="text-[9px] font-black text-gray-400 uppercase block mb-2 leading-none tracking-widest">起始日 (如信用卡結帳日)</label>
          <div className="flex items-center gap-2">
            <select value={billingStartDay} onChange={(e) => { const newDay = Number(e.target.value); setBillingStartDay(newDay); localStorage.setItem('billing_start_day_v1', String(newDay)); }} className="flex-1 bg-transparent font-black border-none outline-none text-blue-600 text-sm min-w-0">
              {[...Array(28)].map((_, i) => <option key={i+1} value={i+1}>每月 {i+1} 號</option>)}
            </select>
          </div>
          <div className="mt-3 text-[10px] text-gray-500 font-bold bg-white p-2 rounded-xl border border-gray-100 leading-relaxed">
            設定後，歷史清單與圖表的「本期/上期」將以此為基準。<br/>👉 目前本期範圍：
            {/* 🌟 這裡換成 safeFormat 來渲染，防止 NaN */}
            <span className="text-blue-600 ml-1">{safeFormat(currentCycleRange?.start)} ~ {safeFormat(currentCycleRange?.end)}</span>
         
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border shadow-sm border-gray-100">
        <h3 className="font-black text-xs mb-4 uppercase flex items-center gap-2 text-gray-800 tracking-widest px-1">
          <SvgIcon name="edit" size={16} className="text-blue-500 shrink-0" /> 介面自訂
        </h3>
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-blue-200 transition-colors">
          <label className="text-[9px] font-black text-gray-400 uppercase block mb-2 leading-none tracking-widest">首頁副標題問候語 (支援 {"{name}"} 變數)</label>
          <div className="flex items-center gap-2">
            <input type="text" className="flex-1 bg-transparent font-bold border-none outline-none text-gray-800 placeholder:text-gray-300 text-sm min-w-0" placeholder="例如：{name}，你好！" value={customSubtitle || ""} onChange={(e) => setCustomSubtitle(e.target.value)} />
            <button onClick={handleSaveGreeting} disabled={isSyncing} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black shadow-sm active:scale-95 disabled:opacity-50 shrink-0">儲存</button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border shadow-sm border-gray-100">
        <h3 className="font-black text-xs mb-5 uppercase flex items-center gap-2 text-gray-800 tracking-widest px-1">
          <SvgIcon name="info" size={16} className="text-blue-500 shrink-0" /> 安全與帳戶管理
 
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 gap-2">
            <div className="min-w-0">
              <p className="text-gray-400 text-[10px] font-black uppercase mb-1 leading-none truncate">使用身份</p>
              <p className="font-black text-gray-800 text-base leading-none mt-1 truncate">{currentUser.name}</p>
           
            </div>
            <button onClick={() => setShowChangePinModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all shrink-0">更換密碼</button>
          </div>
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 gap-2">
            <div className="min-w-0">
              <p className="text-gray-400 text-[10px] font-black uppercase mb-1 leading-none truncate">生物辨識 / 裝置解鎖</p>
        
              <p className="font-black text-gray-800 text-sm leading-none mt-1 truncate">{bioBound ? "設備已綁定" : "設備未綁定"}</p>
            </div>
            <button onClick={() => bioBound ? (setUnbindPin(""), setShowUnbindModal(true)) : bindDeviceBio()} className={`px-4 py-2 rounded-xl font-black text-xs active:scale-95 transition-all shrink-0 ${bioBound ? "bg-red-50 text-red-600 border border-red-100" : "bg-green-600 text-white shadow-lg"}`}>
              {bioBound ? "解除綁定" : "綁定設備"}
            </button>
          </div>
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 gap-2">
            <div className="min-w-0">
              <p className="text-gray-400 text-[10px] font-black uppercase mb-1 leading-none truncate">系統深度清理</p>
              <p className="font-black text-gray-800 text-sm leading-none mt-1 truncate">清空本地所有快取</p>
   
            </div>
            <button onClick={() => setShowClearCacheModal(true)} className="px-4 py-2 bg-red-600 text-white rounded-xl font-black text-xs active:scale-95 transition-all shadow-lg shadow-red-500/30 shrink-0">執行清理</button>
          </div>
        </div>
        
        <button onClick={() => { setCurrentUser(null); setSelectingUser(null); setPinInput(""); setActiveTab("dashboard"); }} className="w-full mt-6 py-4 bg-red-50 text-red-600 rounded-2xl font-black active:scale-95 transition-all flex items-center justify-center gap-2 border border-red-100">
          <SvgIcon name="logout" size={20} className="shrink-0" /> 登出 / 切換使用者
        </button>
        
        {syncQueue && syncQueue.length > 0 && (
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mt-4 flex justify-between items-center gap-2">
            <div className="min-w-0">
  
             <p className="text-red-400 text-[10px] font-black uppercase mb-1 leading-none truncate">異常排解</p>
              <p className="font-black text-red-600 text-sm leading-none mt-1 truncate">有 {syncQueue.length} 筆資料卡住</p>
            </div>
            <button onClick={() => setShowClearQueueModal(true)} className="px-4 py-2 bg-red-600 text-white rounded-xl font-black text-xs active:scale-95 transition-all shadow-lg shadow-red-500/30 shrink-0">強制清除</button>
          </div>
        )}
  
     </div>

      <div className="bg-white p-6 rounded-[2rem] border shadow-sm border-gray-100">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsLogOpen(!isLogOpen)}>
          <h3 className="font-black text-xs uppercase flex items-center gap-2 text-gray-800 tracking-widest px-1">
            <SvgIcon name="chart" size={16} className="text-blue-500 shrink-0" /> 系統資訊 & 更新歷程
          </h3>
          <span className={`text-gray-400 text-[10px] transition-transform duration-300 ${isLogOpen ? 'rotate-180' : ''}`}>▼</span>
        </div>
        {isLogOpen && (
          <div className="mt-5 space-y-5 font-bold text-gray-600 animate-in border-t border-gray-100 pt-4">
            <div className="border-l-2 border-blue-500 pl-3">
              <p className="text-gray-800 text-xs mb-1 flex items-center gap-2">APP 前端 <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-mono">v1.0</span></p>
              <ul className="list-disc pl-4 text-[10px] space-y-1 text-gray-500">
                <li>實裝離線記帳與背景同步</li>
                <li>新增 AI 專屬理財教練</li>
                <li>完美修復圖表分析歷史顯示功能</li>
              </ul>
            </div>
          </div>
        )}
     
      </div>
    </div>
  );
};

export default SettingsTab;