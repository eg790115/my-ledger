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
  renderItemOrGroup
}) => {
  const safeGroups = filteredHistoryGroups || [];
  const safeStats = historyFilteredStats || { balance: 0, income: 0, expense: 0 };

  // 🚀 黃金 30 筆：無限下滑載入狀態與感測器
  const [displayLimit, setDisplayLimit] = useState(30);
  const loaderRef = useRef(null);

  // 當任何過濾條件改變，或是總資料量改變時，重置回只顯示前 30 筆
  useEffect(() => {
    setDisplayLimit(30);
  }, [historyDateFilter, debouncedHistorySearch, debouncedHistoryExcludeSearch, historyTypeFilter, safeGroups.length]);

  // 隱形感測器：當滑到底部時，自動增加 30 筆的顯示額度
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const target = entries[0];
      if (target.isIntersecting) {
        setDisplayLimit(prev => Math.min(prev + 30, safeGroups.length));
      }
    }, {
      root: null,
      rootMargin: "0px",
      threshold: 0.1 // 感測器露出 10% 就觸發
    });

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) observer.unobserve(loaderRef.current);
    };
  }, [safeGroups.length]);

  // 只擷取允許顯示的額度來渲染
  const displayedGroups = safeGroups.slice(0, displayLimit);

  return (
    <div className="flex flex-col animate-in w-full relative">
      {/* 🌟 頂部過濾區與垃圾桶 */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button onClick={() => setQuickDateFilter("current_month")} className={`px-4 py-2 rounded-2xl font-black text-sm transition-all shadow-sm ${historyDateFilter === "current_month" ? "bg-gray-800 text-white" : "bg-white text-gray-500 border border-gray-200"}`}>本月</button>
          <button onClick={() => setQuickDateFilter("last_month")} className={`px-4 py-2 rounded-2xl font-black text-sm transition-all shadow-sm ${historyDateFilter === "last_month" ? "bg-gray-800 text-white" : "bg-white text-gray-500 border border-gray-200"}`}>上月</button>
          <button onClick={() => setQuickDateFilter("all")} className={`px-4 py-2 rounded-2xl font-black text-sm transition-all shadow-sm ${historyDateFilter === "all" ? "bg-gray-800 text-white" : "bg-white text-gray-500 border border-gray-200"}`}>全部</button>
        </div>
        <button onClick={() => { triggerVibration(10); setShowTrashModal(true); }} className="w-10 h-10 bg-white rounded-2xl shadow-sm border border-gray-200 flex items-center justify-center text-gray-500 active:scale-90 transition-transform">
          <SvgIcon name="trash" size={20} />
        </button>
      </div>

      {/* 🌟 進階搜尋按鈕 */}
      <button onClick={() => { triggerVibration(10); setShowSearchFilterModal(true); }} className={`w-full bg-white p-3 rounded-2xl border flex items-center justify-between mb-4 shadow-sm active:bg-gray-50 transition-colors ${isHistoryFiltered ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2 text-gray-600 font-bold text-sm">
          <SvgIcon name="search" size={18} className={isHistoryFiltered ? "text-blue-500" : ""} />
          {isHistoryFiltered ? <span className="text-blue-600">已套用進階搜尋過濾器</span> : <span>搜尋與進階過濾...</span>}
        </div>
        <SvgIcon name="chevronRight" size={16} className="text-gray-400" />
      </button>

      {/* 🌟 統計面板 */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-4">
        <div className="flex justify-between items-end mb-3">
          <span className="text-xs font-black text-gray-500 tracking-wider">篩選區間結餘</span>
          <span className={`text-2xl font-black tabular-nums tracking-tight ${safeStats.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${safeStats.balance.toLocaleString()}
          </span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-green-50 rounded-2xl p-3 border border-green-100">
            <div className="text-[10px] font-black text-green-600/70 mb-1">總收入</div>
            <div className="text-sm font-black text-green-700">${safeStats.income.toLocaleString()}</div>
          </div>
          <div className="flex-1 bg-red-50 rounded-2xl p-3 border border-red-100">
            <div className="text-[10px] font-black text-red-600/70 mb-1">總支出</div>
            <div className="text-sm font-black text-red-700">${safeStats.expense.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* 🌟 歷史清單：套用黃金 30 筆渲染 */}
      <div className="space-y-3 pb-6">
        {displayedGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 animate-in">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <SvgIcon name="search" size={24} className="opacity-50" />
            </div>
            <p className="font-black text-sm tracking-widest">沒有符合條件的紀錄</p>
          </div>
        ) : (
          displayedGroups.map(item => renderItemOrGroup(item, true))
        )}

        {/* 🚀 隱形感測器與載入提示：如果還沒顯示完所有資料，就顯示這個區塊 */}
        {displayLimit < safeGroups.length && (
          <div ref={loaderRef} className="py-8 w-full flex flex-col items-center justify-center gap-2 text-gray-400 animate-pulse">
             <SvgIcon name="spinner" size={20} className="animate-spin text-gray-300" />
             <span className="text-[10px] font-black tracking-widest">正在載入更多紀錄...</span>
          </div>
        )}
      </div>

      {/* 🚀 空間傳送門 Modal */}
      {showSearchFilterModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-gray-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in" onClick={(e) => { if (e.target === e.currentTarget) setShowSearchFilterModal(false); }}>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative flex flex-col max-h-[85vh] overflow-y-auto scrollbar-hide">
            <button onClick={() => setShowSearchFilterModal(false)} className="absolute top-6 right-6 text-gray-400 active:scale-90 transition-transform"><SvgIcon name="close" size={24} /></button>
            <h3 className="font-black text-xl mb-6 text-gray-800 flex items-center gap-2"><SvgIcon name="filter" size={24} className="text-blue-500" /> 進階篩選</h3>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-black text-gray-500 mb-2">關鍵字搜尋 (項目/備註/金額)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SvgIcon name="search" size={16} className="text-gray-400" /></div>
                  <input type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="例如：早餐、全聯、100..." className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 font-bold text-sm outline-none focus:border-blue-400 focus:bg-white transition-all" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-black text-gray-500 mb-2">排除關鍵字</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SvgIcon name="close" size={16} className="text-gray-400" /></div>
                  <input type="text" value={historyExcludeSearch} onChange={(e) => setHistoryExcludeSearch(e.target.value)} placeholder="例如：排除某個類別" className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 font-bold text-sm outline-none focus:border-red-400 focus:bg-white transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 mb-2">收支類型</label>
                <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                  {["all", "expense", "income"].map(type => (
                    <button key={type} onClick={() => setHistoryTypeFilter(type)} className={`flex-1 py-2 rounded-lg font-black text-xs transition-all ${historyTypeFilter === type ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>
                      {type === "all" ? "全部" : type === "expense" ? "支出" : "收入"}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-black text-gray-500 mb-2">快速日期範圍</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "7d", label: "近7天" }, { value: "14d", label: "近14天" }, { value: "1m", label: "近1個月" },
                    { value: "3m", label: "近3個月" }, { value: "6m", label: "近半年" }, { value: "1y", label: "近1年" }
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setHistoryDateFilter(opt.value)} className={`py-2 rounded-xl border font-black text-[11px] transition-all ${historyDateFilter === opt.value ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={() => { triggerVibration(10); setShowSearchFilterModal(false); }} className="w-full mt-6 py-4 bg-gray-900 text-white rounded-2xl font-black shadow-lg shadow-gray-900/20 active:scale-95 transition-transform">
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