import React from 'react';
import { SvgIcon } from './Icons';

const HistoryTab = ({
  setQuickDateFilter, historyDateFilter, setHistoryDateFilter,
  setHistorySearch, setHistoryExcludeSearch, setHistoryTypeFilter,
  historySearch, historyExcludeSearch, triggerVibration,
  setShowTrashModal, setConfirmHardDeleteId, setShowConfirmEmptyTrash,
  showSearchFilterModal, setShowSearchFilterModal,
  debouncedHistorySearch, debouncedHistoryExcludeSearch,
  historyTypeFilter, isHistoryFiltered, historyFilteredStats,
  filteredHistoryGroups, renderItemOrGroup
}) => {
  return (
    <div className="space-y-4 animate-in pb-20">
      
      {/* 🌟 頂部標題與按鈕區 (完美還原圖表分析的 UI 配置) */}
      <div className="flex justify-between items-center gap-2 px-1">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
          <h3 className="font-black text-xl text-gray-800 shrink-0">歷史清單</h3>
          <div className="flex bg-gray-200/60 p-0.5 rounded-xl gap-0.5 shrink-0">
            <button onClick={() => { triggerVibration(10); setQuickDateFilter('current_month'); }} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${historyDateFilter === 'current_month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>本期</button>
            <button onClick={() => { triggerVibration(10); setQuickDateFilter('last_month'); }} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${historyDateFilter === 'last_month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>上期</button>
            <button onClick={() => { triggerVibration(10); setQuickDateFilter('all'); }} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${historyDateFilter === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>全部</button>
          </div>
        </div>
        
        {/* 右側：垃圾桶與搜尋按鈕縮小並收納 */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { triggerVibration(10); setShowTrashModal(true); setConfirmHardDeleteId(null); setShowConfirmEmptyTrash(false); }} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center active:scale-90 transition-transform">
            <SvgIcon name="trash" size={16} />
          </button>
          <button onClick={() => { triggerVibration(10); setShowSearchFilterModal(true); }} className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center active:scale-90 transition-transform relative">
            <SvgIcon name="search" size={16} />
            {isHistoryFiltered && <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></div>}
          </button>
        </div>
      </div>

      {/* 進階搜尋條件提示 */}
      {(debouncedHistorySearch || debouncedHistoryExcludeSearch || historyTypeFilter !== 'all') && (
        <div className="flex flex-wrap gap-2 px-1">
           {debouncedHistorySearch && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">包含: {debouncedHistorySearch}</span>}
           {debouncedHistoryExcludeSearch && <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">排除: {debouncedHistoryExcludeSearch}</span>}
           {historyTypeFilter !== 'all' && <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">類型: {historyTypeFilter === 'expense' ? '支出' : '收入'}</span>}
        </div>
      )}

      {/* 解除置頂的大卡片 */}
      <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-gray-100 flex items-center justify-center gap-4 relative overflow-hidden">
         <div className="absolute top-4 bottom-4 left-1/2 w-px bg-gray-100"></div>
         <div className="flex-1 flex flex-col items-center">
           <span className="text-[10px] font-black text-gray-400 mb-1">總支出</span>
           <span className="text-xl sm:text-2xl font-black text-red-600">${Math.round(historyFilteredStats.expense).toLocaleString()}</span>
         </div>
         <div className="flex-1 flex flex-col items-center">
           <span className="text-[10px] font-black text-gray-400 mb-1">總收入</span>
           <span className="text-xl sm:text-2xl font-black text-green-600">${Math.round(historyFilteredStats.income).toLocaleString()}</span>
         </div>
      </div>

      {/* 清單顯示區塊 */}
      <div className="space-y-3">
         {filteredHistoryGroups.length === 0 ? (
            <div className="text-center text-gray-400 py-10 text-sm font-bold bg-white rounded-[2rem] border border-gray-100 shadow-sm mt-4">沒有符合條件的紀錄</div>
         ) : (
            filteredHistoryGroups.map(item => renderItemOrGroup(item, true))
         )}
      </div>
      
      {/* 搜尋與進階篩選彈跳窗 */}
      {showSearchFilterModal && (
        <div className="fixed inset-0 z-[800] bg-gray-900/90 backdrop-blur-sm flex flex-col items-center justify-end sm:justify-center p-0 sm:p-6 animate-in fade-in slide-in-from-bottom-10">
           <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
              <button onClick={() => setShowSearchFilterModal(false)} className="absolute top-6 right-6 text-gray-400 active:scale-90 transition-transform"><SvgIcon name="close" size={24}/></button>
              <h3 className="font-black text-xl mb-6 text-gray-800">搜尋與進階篩選</h3>
              
              <div className="space-y-5 overflow-y-auto scrollbar-hide pb-6">
                 <div>
                    <label className="block text-xs font-black text-gray-500 mb-2">關鍵字搜尋 (包含)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SvgIcon name="search" size={16} className="text-blue-500"/></div>
                      <input type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="輸入分類、備註或金額..." className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-9 pr-4 text-sm font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                    </div>
                 </div>
                 
                 <div>
                    <label className="block text-xs font-black text-gray-500 mb-2">排除關鍵字 (不包含)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SvgIcon name="close" size={16} className="text-red-400"/></div>
                      <input type="text" value={historyExcludeSearch} onChange={(e) => setHistoryExcludeSearch(e.target.value)} placeholder="不要顯示包含此文字的紀錄..." className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-9 pr-4 text-sm font-bold outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 transition-all" />
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-black text-gray-500 mb-2">收支類型</label>
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                       <button onClick={()=>{triggerVibration(10); setHistoryTypeFilter('all');}} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${historyTypeFilter==='all'?'bg-white text-gray-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>全部</button>
                       <button onClick={()=>{triggerVibration(10); setHistoryTypeFilter('expense');}} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${historyTypeFilter==='expense'?'bg-white text-red-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>支出</button>
                       <button onClick={()=>{triggerVibration(10); setHistoryTypeFilter('income');}} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${historyTypeFilter==='income'?'bg-white text-green-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>收入</button>
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-black text-gray-500 mb-2">時間範圍</label>
                    <select value={historyDateFilter} onChange={(e) => { triggerVibration(10); setHistoryDateFilter(e.target.value); }} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none">
                       <option value="all">全部時間</option>
                       <option value="current_month">本期</option>
                       <option value="last_month">上期</option>
                       <option value="7d">近 7 日</option>
                       <option value="14d">近 14 日</option>
                       <option value="1m">近一個月</option>
                       <option value="3m">近三個月</option>
                       <option value="6m">近半年</option>
                       <option value="1y">近一年</option>
                    </select>
                 </div>
              </div>
              
              <div className="mt-auto pt-4 border-t border-gray-100 flex gap-3">
                 <button onClick={() => { triggerVibration(10); setHistorySearch(""); setHistoryExcludeSearch(""); setHistoryTypeFilter("all"); setHistoryDateFilter("current_month"); }} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-sm active:scale-95 transition-transform">清除條件</button>
                 <button onClick={() => { triggerVibration(10); setShowSearchFilterModal(false); }} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-sm shadow-md shadow-blue-500/30 active:scale-95 transition-transform">檢視結果</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default HistoryTab;