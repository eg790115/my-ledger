import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SvgIcon } from './Icons';

const HistoryTab = ({
  setQuickDateFilter, historyDateFilter, setHistoryDateFilter,
  setHistorySearch, setHistoryExcludeSearch, setHistoryTypeFilter,
  historySearch, historyExcludeSearch, triggerVibration,
  setShowTrashModal, showSearchFilterModal, setShowSearchFilterModal,
  debouncedHistorySearch, debouncedHistoryExcludeSearch, historyTypeFilter,
  isHistoryFiltered, historyFilteredStats, filteredHistoryGroups,
  renderItemOrGroup,
  // 🌟 接收從 App.jsx 傳來的觀看歷程觸發函數
  onViewHistory 
}) => {
  const safeGroups = filteredHistoryGroups || [];
  const safeStats = historyFilteredStats || { balance: 0, income: 0, expense: 0 };

  const [displayLimit, setDisplayLimit] = useState(30);
  const loaderRef = useRef(null);

  const hasAdvancedFilters = debouncedHistorySearch !== "" || debouncedHistoryExcludeSearch !== "" || historyTypeFilter !== "all";

  useEffect(() => {
    setDisplayLimit(30);
  }, [historyDateFilter, debouncedHistorySearch, debouncedHistoryExcludeSearch, historyTypeFilter, safeGroups.length]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const target = entries[0];
      if (target.isIntersecting) {
        setDisplayLimit(prev => Math.min(prev + 30, safeGroups.length));
      }
    }, { root: null, rootMargin: "0px", threshold: 0.1 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => { if (loaderRef.current) observer.unobserve(loaderRef.current); };
  }, [safeGroups.length]);

  const displayedGroups = safeGroups.slice(0, displayLimit);

  return (
    <div className="flex flex-col animate-in w-full relative px-1 text-left">
      
      {/* 🌟 頂部過濾區與垃圾桶 */}
      <div className="flex justify-between items-center mb-4 gap-2">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
          <h3 className="font-black text-xl text-gray-800 shrink-0">歷史紀錄</h3>
          <div className="flex bg-gray-200/60 p-0.5 rounded-xl gap-0.5 shrink-0">
            <button onClick={()=>{ triggerVibration(10); setQuickDateFilter("current_month"); }} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${historyDateFilter==='current_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>本期</button>
            <button onClick={()=>{ triggerVibration(10); setQuickDateFilter("last_month"); }} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${historyDateFilter==='last_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>上期</button>
            <button onClick={()=>{ triggerVibration(10); setQuickDateFilter("all"); }} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${historyDateFilter==='all'?'bg-white text-gray-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>全部</button>
          </div>
        </div>
        <button onClick={() => { triggerVibration(10); setShowTrashModal(true); }} className="w-9 h-9 shrink-0 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center text-gray-500 active:scale-90 transition-transform">
          <SvgIcon name="trash" size={18} />
        </button>
      </div>

      {/* 🌟 進階搜尋按鈕 + 一鍵清除按鈕 */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => { triggerVibration(10); setShowSearchFilterModal(true); }} className={`flex-1 bg-white p-3 rounded-2xl border flex items-center justify-between shadow-sm active:bg-gray-50 transition-colors ${hasAdvancedFilters ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2 text-gray-600 font-bold text-sm">
            <SvgIcon name="search" size={18} className={hasAdvancedFilters ? "text-blue-500" : ""} />
            {hasAdvancedFilters ? <span className="text-blue-600 font-black">已套用搜尋</span> : <span className="text-[12px] font-black">搜尋與進階過濾...</span>}
          </div>
          <SvgIcon name="chevronRight" size={16} className="text-gray-400" />
        </button>

        {hasAdvancedFilters && (
          <button 
            onClick={() => { 
              triggerVibration([10, 20]); 
              setHistorySearch(""); 
              setHistoryExcludeSearch(""); 
              setHistoryTypeFilter("all"); 
              setQuickDateFilter("current_month");
            }} 
            className="shrink-0 px-4 bg-red-50 text-red-600 rounded-2xl border border-red-200 font-black text-[13px] active:scale-95 transition-all flex items-center justify-center gap-1 shadow-sm"
          >
            <SvgIcon name="close" size={14} /> 清除
          </button>
        )}
      </div>

      {/* 🌟 統計面板 */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm mb-4 flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-[11px] font-black text-gray-400">篩選區間結餘</span>
          <span className={`text-xl font-black tabular-nums tracking-tight ${safeStats.balance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
            ${safeStats.balance.toLocaleString()}
          </span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-50/80 rounded-2xl p-2.5 flex items-center justify-between border border-gray-100">
            <div className="text-[10px] font-black text-gray-400">總收入</div>
            <div className="text-[13px] font-black text-green-600">${safeStats.income.toLocaleString()}</div>
          </div>
          <div className="flex-1 bg-gray-50/80 rounded-2xl p-2.5 flex items-center justify-between border border-gray-100">
            <div className="text-[10px] font-black text-gray-400">總支出</div>
            <div className="text-[13px] font-black text-red-500">${safeStats.expense.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* 🌟 歷史清單 */}
      <div className="space-y-3 pb-6 relative">
        {displayedGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 animate-in">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <SvgIcon name="search" size={24} className="opacity-50" />
            </div>
            <p className="font-black text-sm tracking-widest">沒有符合條件的紀錄</p>
          </div>
        ) : (
          displayedGroups.map(item => {
            // 檢查這筆紀錄（或這個群組的任一子紀錄）是否被編輯過
            const isItemEdited = item.isGroup 
                ? item.children.some(child => child.isEdited) 
                : item.isEdited;
            
            // 決定要看哪一筆的歷程（群組就看第一筆代表）
            const historyIdTarget = item.isGroup ? item.children[0].id : item.id;

            return (
              <div key={item.isGroup ? item.groupId : item.id} className="relative group">
                {/* 呼叫你原本的渲染函數 */}
                {renderItemOrGroup(item, true)}
                
                {/* 🌟 若有被編輯過，疊加「已編輯」標籤上去 */}
                {isItemEdited && onViewHistory && (
                  <button 
                    onClick={(e) => { 
                       e.stopPropagation(); 
                       triggerVibration(10); 
                       onViewHistory(historyIdTarget); 
                    }}
                    className="absolute top-2 right-12 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-sm text-gray-500 px-2 py-1 rounded-lg border border-gray-200 shadow-sm active:scale-95 transition-all hover:bg-gray-50"
                  >
                    <SvgIcon name="edit" size={12} />
                    <span className="text-[9px] font-black tracking-widest">已編輯</span>
                  </button>
                )}
              </div>
            );
          })
        )}

        {/* 🚀 隱形感測器與載入提示 */}
        {displayLimit < safeGroups.length && (
          <div ref={loaderRef} className="py-8 w-full flex flex-col items-center justify-center gap-2 text-gray-400 animate-pulse">
             <SvgIcon name="spinner" size={20} className="animate-spin text-gray-300" />
             <span className="text-[10px] font-black tracking-widest">正在載入更多紀錄...</span>
          </div>
        )}
      </div>

      {/* 🚀 空間傳送門 Modal */}
      {showSearchFilterModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-gray-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in text-left" onClick={(e) => { if (e.target === e.currentTarget) setShowSearchFilterModal(false); }}>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative flex flex-col max-h-[85vh] overflow-y-auto scrollbar-hide">
            <button onClick={() => setShowSearchFilterModal(false)} className="absolute top-6 right-6 text-gray-400 active:scale-90 transition-transform"><SvgIcon name="close" size={24} /></button>
            <h3 className="font-black text-xl mb-6 text-gray-800 flex items-center gap-2"><SvgIcon name="filter" size={24} className="text-blue-500" /> 進階篩選</h3>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">關鍵字搜尋</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SvgIcon name="search" size={16} className="text-gray-400" /></div>
                  <input type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="例如：早餐、全聯、100..." className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3.5 font-bold text-sm outline-none focus:border-blue-400 focus:bg-white transition-all" />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">排除關鍵字</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SvgIcon name="close" size={16} className="text-gray-400" /></div>
                  <input type="text" value={historyExcludeSearch} onChange={(e) => setHistoryExcludeSearch(e.target.value)} placeholder="例如：排除某個類別" className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3.5 font-bold text-sm outline-none focus:border-red-400 focus:bg-white transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">收支類型</label>
                <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                  {["all", "expense", "income"].map(type => (
                    <button key={type} onClick={() => setHistoryTypeFilter(type)} className={`flex-1 py-2 rounded-lg font-black text-[13px] transition-all ${historyTypeFilter === type ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {type === "all" ? "全部" : type === "expense" ? "支出" : "收入"}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">快速日期範圍</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "7d", label: "近7天" }, { value: "14d", label: "近14天" }, { value: "1m", label: "近1個月" },
                    { value: "3m", label: "近3個月" }, { value: "6m", label: "近半年" }, { value: "1y", label: "近1年" }
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setHistoryDateFilter(opt.value)} className={`py-2.5 rounded-xl border font-black text-[12px] transition-all ${historyDateFilter === opt.value ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={() => { triggerVibration(10); setShowSearchFilterModal(false); }} className="w-full mt-8 py-4 bg-blue-600 text-white rounded-2xl font-black active:scale-95 transition-transform shadow-xl shadow-blue-500/30">
              套用並關閉
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default HistoryTab;