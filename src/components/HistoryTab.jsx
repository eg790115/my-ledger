// src/components/HistoryTab.jsx
import React from 'react';
import { SvgIcon } from './Icons';
import { Virtuoso } from 'react-virtuoso';

const HistoryTab = ({
  setQuickDateFilter, historyDateFilter, setHistoryDateFilter,
  setHistorySearch, setHistoryExcludeSearch, setHistoryTypeFilter,
  historySearch, historyExcludeSearch, triggerVibration,
  setShowTrashModal, setConfirmHardDeleteId, setShowConfirmEmptyTrash,
  setShowSearchFilterModal, debouncedHistorySearch, debouncedHistoryExcludeSearch,
  historyTypeFilter, isHistoryFiltered, historyFilteredStats,
  filteredHistoryGroups, renderItemOrGroup
}) => {
  return (
    <div className="space-y-4 animate-in text-left flex flex-col h-full relative">
      <div className="flex justify-between items-center px-1 gap-2 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
          <h3 className="font-black text-xl text-gray-800 shrink-0">歷史清單</h3>
          <div className="flex bg-gray-200/60 p-0.5 rounded-xl gap-0.5 shrink-0">
            <button onClick={()=>setQuickDateFilter("current_month")} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${historyDateFilter==='current_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>本期</button>
            <button onClick={()=>setQuickDateFilter("last_month")} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${historyDateFilter==='last_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>上期</button>
            <button onClick={()=>{triggerVibration(10); setHistoryDateFilter("all"); setHistorySearch(""); setHistoryExcludeSearch(""); setHistoryTypeFilter("all");}} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${historyDateFilter==='all' && !historySearch && !historyExcludeSearch && historyTypeFilter==='all'?'bg-white text-gray-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>還原</button>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { triggerVibration(10); setShowTrashModal(true); setConfirmHardDeleteId(null); setShowConfirmEmptyTrash(false);}} className="flex items-center justify-center w-8 h-8 bg-red-50 rounded-full border border-red-100 active:scale-95 transition-all text-red-500"><SvgIcon name="trash" size={14} /></button>
          <button onClick={() => { triggerVibration(10); setShowSearchFilterModal(true); }} className="flex items-center justify-center w-8 h-8 bg-blue-50 rounded-full border border-blue-100 active:scale-95 transition-all text-blue-600"><SvgIcon name="search" size={14} /></button>
        </div>
      </div>

      {(debouncedHistorySearch || debouncedHistoryExcludeSearch || historyTypeFilter !== "all" || historyDateFilter !== "all") && ( 
        <div className="flex flex-wrap gap-2 px-1 mt-3 shrink-0">
          {debouncedHistorySearch && <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-bold">🔍 包含: {debouncedHistorySearch}</span>}
          {debouncedHistoryExcludeSearch && <span className="text-[9px] bg-red-100 text-red-700 px-2 py-1 rounded-md font-bold">🚫 排除: {debouncedHistoryExcludeSearch}</span>}
          {historyTypeFilter !== "all" && <span className="text-[9px] bg-gray-200 text-gray-700 px-2 py-1 rounded-md font-bold">類型: {historyTypeFilter === 'expense' ? '支出' : '收入'}</span>}
          {historyDateFilter !== "all" && <span className="text-[9px] bg-gray-200 text-gray-700 px-2 py-1 rounded-md font-bold">時間: {historyDateFilter === 'current_month' ? '本期' : historyDateFilter === 'last_month' ? '上期' : historyDateFilter === '1m' ? '近一期' : historyDateFilter === '3m' ? '近3期' : historyDateFilter === '6m' ? '近半年' : historyDateFilter === '1y' ? '近1年' : '全部'}</span>}
        </div> 
      )}
      
      {isHistoryFiltered && ( 
        <div className="bg-white p-4 mt-3 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-around animate-in shrink-0">
          <div className="text-center w-1/2"><div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">總支出</div><div className="text-xl font-black text-red-500">${historyFilteredStats.expense.toLocaleString()}</div></div>
          <div className="w-px h-10 bg-gray-100"></div>
          <div className="text-center w-1/2"><div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">總收入</div><div className="text-xl font-black text-green-500">${historyFilteredStats.income.toLocaleString()}</div></div>
        </div> 
      )}
      
      <div className="mt-4">
        {(filteredHistoryGroups || []).length === 0 ? (
            <div className="text-center py-10 flex flex-col items-center gap-2"><span className="text-gray-400 text-sm font-bold">尚無符合條件的紀錄</span></div>
        ) : (
            <Virtuoso style={{ height: 'calc(100vh - 240px)' }} className="scrollbar-hide" data={filteredHistoryGroups} itemContent={(index, item) => <div className="pb-3 px-1">{renderItemOrGroup(item, true)}</div>} />
        )}
      </div>
    </div>
  );
};

export default HistoryTab;