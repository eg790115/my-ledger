import React, { useState } from 'react';
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
  const [historyVisibleCount, setHistoryVisibleCount] = useState(20);

  return (
    <div className="space-y-4 animate-in pb-20 text-left">
      
      {/* 🌟 頂部標題與按鈕區 */}
      <div className="flex justify-between items-center px-1 mb-2 gap-2">
         <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
            <h3 className="font-black text-xl text-gray-800 shrink-0">歷史清單</h3>
            <div className="flex bg-gray-200/60 p-0.5 rounded-xl gap-0.5 shrink-0">
               <button onClick={()=>{triggerVibration(10); setQuickDateFilter("current_month");}} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${historyDateFilter==='current_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>本期</button>
               <button onClick={()=>{triggerVibration(10); setQuickDateFilter("last_month");}} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${historyDateFilter==='last_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>上期</button>
               <button onClick={()=>{triggerVibration(10); setQuickDateFilter("all"); setHistorySearch(""); setHistoryExcludeSearch(""); setHistoryTypeFilter("all");}} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${historyDateFilter==='all' && !historySearch && !historyExcludeSearch && historyTypeFilter==='all'?'bg-white text-gray-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>還原</button>
            </div>
         </div>

         {/* 垃圾桶與搜尋按鈕 */}
         <div className="flex items-center gap-2 shrink-0 relative z-20">
             <button onClick={() => {triggerVibration(10); setShowTrashModal(true); setConfirmHardDeleteId(null); setShowConfirmEmptyTrash(false);}} className="flex items-center justify-center w-8 h-8 bg-red-50 rounded-full border border-red-100 active:scale-95 transition-all text-red-500 shadow-sm">
               <SvgIcon name="trash" size={14} />
             </button>
             <button 
               onClick={() => { triggerVibration(10); setShowSearchFilterModal(!showSearchFilterModal); }} 
               className={`flex items-center justify-center w-8 h-8 rounded-full border active:scale-95 transition-all relative ${showSearchFilterModal ? 'bg-blue-700 border-blue-800 text-white shadow-inner' : 'bg-blue-600 border-blue-700 text-white shadow-md shadow-blue-500/30'}`}
             >
               <SvgIcon name={showSearchFilterModal ? "close" : "search"} size={14} />
               {!showSearchFilterModal && isHistoryFiltered && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm"></div>}
             </button>
         </div>
      </div>

      {/* ========================================= */}
      {/* 🚀 與列表等寬的推擠式搜尋面板 (優化排版) */}
      {/* ========================================= */}
      {showSearchFilterModal && (
        <div className="bg-white rounded-[2rem] p-5 shadow-lg border border-blue-100 flex flex-col gap-4 animate-in slide-in-from-top-4 fade-in duration-300 relative overflow-hidden mt-2">
          {/* 裝飾線條 */}
          <div className="absolute left-0 top-0 w-1.5 h-full bg-blue-500"></div>
          
          <h4 className="font-black text-gray-800 text-sm pl-2 flex items-center gap-2">
            <SvgIcon name="search" size={16} className="text-blue-500" />
            進階篩選面板
          </h4>

          {/* 包含與排除關鍵字 */}
          <div className="flex flex-col gap-3 pl-2">
            <div className="bg-gray-50 flex items-center p-2.5 rounded-xl border border-gray-100 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50 transition-all">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><SvgIcon name="search" size={14}/></div>
              <input type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="包含關鍵字 (品項、金額...)" className="flex-1 bg-transparent font-bold text-xs outline-none text-gray-800 px-3 w-full" />
            </div>
            
            <div className="bg-gray-50 flex items-center p-2.5 rounded-xl border border-gray-100 focus-within:border-red-300 focus-within:ring-2 focus-within:ring-red-50 transition-all">
              <div className="w-7 h-7 rounded-lg bg-red-100 text-red-500 flex items-center justify-center shrink-0"><SvgIcon name="close" size={14}/></div>
              <input type="text" value={historyExcludeSearch} onChange={(e) => setHistoryExcludeSearch(e.target.value)} placeholder="排除不想看的關鍵字..." className="flex-1 bg-transparent font-bold text-xs outline-none text-gray-800 px-3 w-full" />
            </div>
          </div>

          {/* 雙欄設計：收支類型 & 時間範圍 */}
          <div className="flex gap-3 pl-2">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">收支類型</label>
              <select value={historyTypeFilter} onChange={(e) => {triggerVibration(10); setHistoryTypeFilter(e.target.value);}} className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-3 text-xs font-black text-gray-800 outline-none focus:border-blue-300 transition-all appearance-none">
                <option value="all">全部收支</option>
                <option value="expense">僅看支出</option>
                <option value="income">僅看收入</option>
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">時間範圍</label>
              <select value={historyDateFilter} onChange={(e) => {triggerVibration(10); setHistoryDateFilter(e.target.value);}} className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-3 text-xs font-black text-blue-600 outline-none focus:border-blue-300 transition-all appearance-none">
                <option value="all">全部時間</option>
                <option value="current_month">本期</option>
                <option value="last_month">上期</option>
                <option value="7d">近 7 日</option>
                <option value="1m">近一個月</option>
                <option value="3m">近三個月</option>
                <option value="6m">近半年</option>
                <option value="1y">近一年</option>
              </select>
            </div>
          </div>

          {/* 底部按鈕區 */}
          <div className="flex gap-3 pt-3 pl-2 mt-1 border-t border-gray-50">
            <button onClick={() => { triggerVibration(10); setHistorySearch(""); setHistoryExcludeSearch(""); setHistoryTypeFilter("all"); setHistoryDateFilter("current_month"); }} className="px-5 py-3 bg-gray-100 text-gray-500 rounded-xl font-black text-xs active:scale-95 transition-transform hover:bg-gray-200">
              清空
            </button>
            <button onClick={() => { triggerVibration(10); setShowSearchFilterModal(false); }} className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-xs active:scale-95 transition-transform flex items-center justify-center gap-1 border border-blue-100">
              收起面板 <span className="text-[10px]">▲</span>
            </button>
          </div>
        </div>
      )}

      {/* 🌟 篩選條件輕量級標籤 (縮攏時顯示) */}
      {!showSearchFilterModal && (debouncedHistorySearch || debouncedHistoryExcludeSearch || historyTypeFilter !== "all" || historyDateFilter !== "all") && (
         <div className="flex flex-wrap gap-2 mb-2 px-1 animate-in fade-in">
            {debouncedHistorySearch && <span className="text-[10px] bg-blue-50 border border-blue-100 text-blue-600 px-2.5 py-1 rounded-md font-black flex items-center gap-1 shadow-sm">🔍 {debouncedHistorySearch}</span>}
            {debouncedHistoryExcludeSearch && <span className="text-[10px] bg-red-50 border border-red-100 text-red-600 px-2.5 py-1 rounded-md font-black flex items-center gap-1 shadow-sm">🚫 {debouncedHistoryExcludeSearch}</span>}
            {historyTypeFilter !== "all" && <span className="text-[10px] bg-gray-100 border border-gray-200 text-gray-600 px-2.5 py-1 rounded-md font-black flex items-center gap-1 shadow-sm">💰 {historyTypeFilter === 'expense' ? '只看支出' : '只看收入'}</span>}
         </div>
      )}

      {/* 🌟 總計看板 */}
      {isHistoryFiltered && (
          <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-around mt-2 mb-4 animate-in fade-in">
             <div className="text-center w-1/2">
               <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">符合支出的總計</div>
               <div className="text-xl font-black text-red-500">${historyFilteredStats.expense.toLocaleString()}</div>
             </div>
             <div className="w-px h-10 bg-gray-100"></div>
             <div className="text-center w-1/2">
               <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">符合收入的總計</div>
               <div className="text-xl font-black text-green-500">${historyFilteredStats.income.toLocaleString()}</div>
             </div>
          </div>
      )}

      {/* 🌟 歷史紀錄清單 */}
      <div className="space-y-3 mt-4">
        {(filteredHistoryGroups || []).slice(0, historyVisibleCount).map(item => renderItemOrGroup ? renderItemOrGroup(item, true) : null)}
        
        {historyVisibleCount < (filteredHistoryGroups || []).length && ( 
          <button onClick={() => {triggerVibration(10); setHistoryVisibleCount(prev => prev + 20);}} className="w-full py-4 bg-white border border-gray-200 text-blue-600 rounded-2xl font-black text-xs active:bg-gray-50 transition-colors shadow-sm mt-4 flex justify-center items-center gap-2">
            <SvgIcon name="refresh" size={14} className="text-blue-500" /> 載入更多紀錄 ({historyVisibleCount} / {(filteredHistoryGroups || []).length})
          </button> 
        )}
        
        {(filteredHistoryGroups || []).length === 0 && (
          <div className="text-center py-12 bg-white rounded-[2rem] border border-gray-100 shadow-sm mt-4 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-300"><SvgIcon name="search" size={20} /></div>
            <span className="text-sm font-black text-gray-400">沒有符合條件的紀錄</span>
          </div>
        )}
      </div>

    </div>
  )
}

export default HistoryTab;