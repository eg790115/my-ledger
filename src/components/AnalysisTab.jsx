import React, { useState, useEffect, useMemo } from 'react';
import { SvgIcon } from './Icons';
import { CHART_COLORS } from '../utils/constants';
import { getCycleRange, parseDateForSort, getParentCat, getChildCat } from '../utils/helpers';

// 🌟 大聲公廣播版卡片式 AI 幻燈片模組
const AiInsightsCarousel = ({ aiReport, isEvaluating }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);

  const defaultMessages = [
    "正在等待最新的財務洞察... 到「設定」點擊 🤖 手動分析吧！✨"
  ];

  // 將 AI 長篇報告切成一則則的「洞察卡片」
  const messages = useMemo(() => {
    if (!aiReport) return defaultMessages;
    // 優先使用直線「|」來分隔每一段具體的分析 (對應新版緊箍咒)
    if (aiReport.includes('|')) {
      return aiReport.split('|').map(s => s.trim()).filter(s => s.length > 5);
    }
    // 舊版相容
    const parsed = aiReport.split(/(?<=[。！？!\?])\s*/).filter(s => s.trim().length > 5);
    return parsed.length > 0 ? parsed : defaultMessages;
  }, [aiReport]);

  useEffect(() => {
    if (isEvaluating || messages.length <= 1) return;
    const interval = setInterval(() => {
      setFade(false); // 先淡出
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % messages.length);
        setFade(true); // 換句話後再淡入
      }, 500); // 淡出動畫時間
    }, 6000); // 每 6 秒切換一張卡片
    return () => clearInterval(interval);
  }, [messages.length, isEvaluating]);

  if (isEvaluating) {
    return (
      <div className="bg-indigo-50/80 border border-indigo-100 rounded-2xl p-4 flex items-center justify-center gap-3 shadow-sm animate-in mb-4 min-h-[4.5rem]">
        <SvgIcon name="spinner" size={20} className="text-indigo-500 animate-spin shrink-0" />
        <span className="text-sm font-black text-indigo-600">AI 管家正在為您精算本期帳本...</span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100/50 rounded-2xl p-4 flex items-start gap-3 shadow-sm relative mb-4 min-h-[4.5rem] transition-all">
      <span className="shrink-0 text-lg mt-0.5 opacity-80">📢</span>
      <div className="flex-1 w-full relative flex items-center h-full min-h-[3rem]">
        <span className={`text-[12px] font-black text-indigo-800 transition-opacity duration-500 leading-relaxed absolute inset-0 flex items-center ${fade ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
          {messages[currentIndex]}
        </span>
      </div>
    </div>
  );
};

const AnalysisTab = ({
  analysisDateFilter, setAnalysisDateFilter,
  setSelectedAnalysisLevel1, setSelectedAnalysisLevel2,
  analysisCustomStart, setAnalysisCustomStart,
  analysisCustomEnd, setAnalysisCustomEnd,
  analysisType, setAnalysisType,
  aiEvalData, currentUser, isAIEvaluating, handleForceAIEval,
  myTransactions, billingStartDay, pendingMap,
  selectedAnalysisLevel1, setAnalysisDetailData,
  animTrigger, triggerVibration
}) => {
  return (
    <div className="space-y-6 animate-in pb-20 text-left">
      {/* 1. 頂部篩選列 */}
      <div className="flex flex-col gap-3 px-1">
        <div className="flex justify-between items-center mb-2 gap-2">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
            <h3 className="font-black text-xl text-gray-800 shrink-0">圖表分析</h3>
            <div className="flex bg-gray-200/60 p-0.5 rounded-xl gap-0.5 shrink-0">
              <button onClick={()=>{ triggerVibration(10); setAnalysisDateFilter("current_month"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${analysisDateFilter==='current_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>本期</button>
              <button onClick={()=>{ triggerVibration(10); setAnalysisDateFilter("last_month"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${analysisDateFilter==='last_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>上期</button>
              <button onClick={()=>{ triggerVibration(10); setAnalysisDateFilter("all"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${analysisDateFilter==='all'?'bg-white text-gray-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>還原</button>
            </div>
          </div>
          <div className="relative shrink-0 border-l pl-2 border-gray-200">
            <select value={analysisDateFilter} onChange={(e) => { triggerVibration(10); setAnalysisDateFilter(e.target.value); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className="appearance-none bg-transparent py-1.5 pl-1 pr-4 font-black text-[10px] text-gray-400 outline-none text-right">
              <option value="all">全部</option><option value="current_month">本期</option><option value="last_month">上期</option><option value="7d">近7日</option><option value="14d">近14日</option><option value="1m">近一期</option><option value="3m">近3期</option><option value="6m">近半年</option><option value="1y">近1年</option><option value="custom">自訂</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none"><span className="text-[8px] text-gray-400">▼</span></div>
          </div>
        </div>
        {analysisDateFilter === "custom" && ( 
          <div className="flex gap-2 items-center bg-gray-100 p-2.5 rounded-xl border border-gray-200 animate-in shadow-inner">
            <input type="date" value={analysisCustomStart} onChange={e => setAnalysisCustomStart(e.target.value)} className="flex-1 bg-transparent font-black text-[10px] text-gray-700 outline-none text-center" />
            <span className="text-gray-400 font-bold text-xs">~</span>
            <input type="date" value={analysisCustomEnd} onChange={e => setAnalysisCustomEnd(e.target.value)} className="flex-1 bg-transparent font-black text-[10px] text-gray-700 outline-none text-center" />
          </div> 
        )}
      </div>

      {/* 🌟 2. AI 幻燈片移到這裡 (在收支切換按鈕的上方) */}
      <AiInsightsCarousel 
         aiReport={aiEvalData ? (currentUser?.name === "爸爸" ? aiEvalData.dad_eval : aiEvalData.mom_eval) : null} 
         isEvaluating={isAIEvaluating} 
      />
      
      {/* 3. 收支切換按鈕 */}
      <div className="flex bg-gray-100 p-1.5 rounded-2xl text-sm text-gray-500">
        <button onClick={() => { triggerVibration(10); setAnalysisType("expense"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`flex-1 py-2 rounded-xl font-black transition-all ${analysisType === "expense" ? "bg-white text-red-500 shadow-sm" : ""}`}>支出分析</button>
        <button onClick={() => { triggerVibration(10); setAnalysisType("income"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`flex-1 py-2 rounded-xl font-black transition-all ${analysisType === "income" ? "bg-white text-green-500 shadow-sm" : ""}`}>收入分析</button>
      </div>

      {/* 4. 核心資料與圖表區 */}
      {(() => {
        let analysisTxs = myTransactions || []; let prevAnalysisTxs = []; let yoyAnalysisTxs = []; const showCompare = (analysisDateFilter === "current_month" || analysisDateFilter === "last_month");
        if (analysisDateFilter !== "all") {
          if (analysisDateFilter === "custom") { 
            const start = analysisCustomStart ? new Date(`${analysisCustomStart}T00:00:00`).getTime() : 0; const end = analysisCustomEnd ? new Date(`${analysisCustomEnd}T23:59:59`).getTime() : Infinity; 
            analysisTxs = analysisTxs.filter(item => { const txTime = parseDateForSort(item); return txTime >= start && txTime <= end; }); 
          } else {
            const now = new Date(); let startTime = 0; let endTime = now.getTime();
            if (analysisDateFilter === "current_month") { const range = getCycleRange(now, billingStartDay, 0); startTime = range.start; endTime = range.end; } 
            else if (analysisDateFilter === "last_month") { const range = getCycleRange(now, billingStartDay, -1); startTime = range.start; endTime = range.end; } 
            else { 
              const cutoff = new Date(); 
              if (analysisDateFilter === "7d") cutoff.setDate(now.getDate() - 7); 
              else if (analysisDateFilter === "14d") cutoff.setDate(now.getDate() - 14); 
              else if (analysisDateFilter === "1m") cutoff.setMonth(now.getMonth() - 1); 
              else if (analysisDateFilter === "3m") cutoff.setMonth(now.getMonth() - 3); 
              else if (analysisDateFilter === "6m") cutoff.setMonth(now.getMonth() - 6); 
              else if (analysisDateFilter === "1y") cutoff.setFullYear(now.getFullYear() - 1); 
              startTime = cutoff.getTime(); 
            }
            analysisTxs = analysisTxs.filter(item => { const tTime = parseDateForSort(item); return tTime >= startTime && tTime <= endTime; });
            if (showCompare) { 
              const baseOffset = analysisDateFilter === "current_month" ? 0 : -1; 
              const prevR = getCycleRange(now, billingStartDay, baseOffset - 1); const yoyR = getCycleRange(now, billingStartDay, baseOffset - 12); 
              prevAnalysisTxs = myTransactions.filter(item => { const tTime = parseDateForSort(item); return tTime >= prevR.start && tTime <= prevR.end; }); 
              yoyAnalysisTxs = myTransactions.filter(item => { const tTime = parseDateForSort(item); return tTime >= yoyR.start && tTime <= yoyR.end; }); 
            }
          }
        }

        if (analysisType === "expense" || analysisType === "income") { analysisTxs = analysisTxs.filter(t => t.type === analysisType); prevAnalysisTxs = prevAnalysisTxs.filter(t => t.type === analysisType); yoyAnalysisTxs = yoyAnalysisTxs.filter(t => t.type === analysisType); }
        if (analysisTxs.length === 0) return <div className="text-center text-gray-400 py-10 text-sm font-bold bg-white rounded-[2rem] border border-gray-100 shadow-sm">該區間尚無紀錄</div>;
        
        const currentColors = CHART_COLORS[analysisType] || CHART_COLORS.expense; let level1Totals = {}; let grandTotal = 0; let prevLevel1Totals = {}; let totalPrev = 0; let yoyLevel1Totals = {}; let totalYoy = 0;
        const aggregateTotals = (txs, totalsObj) => { let total = 0; txs.forEach(t => { if (pendingMap[t.id] === 'DELETE_TX' || pendingMap[t.id] === 'HARD_DELETE_TX') return; const amt = Number(t.amount) || 0; total += amt; const pCat = getParentCat(t.category); totalsObj[pCat] = (totalsObj[pCat] || 0) + amt; }); return total; };
        grandTotal = aggregateTotals(analysisTxs, level1Totals); if (showCompare) { totalPrev = aggregateTotals(prevAnalysisTxs, prevLevel1Totals); totalYoy = aggregateTotals(yoyAnalysisTxs, yoyLevel1Totals); }

        const sortedLevel1 = Object.entries(level1Totals).sort((a,b) => b[1] - a[1]); let conicStr = ""; let currentPct = 0; 
        sortedLevel1.forEach(([cat, amt], idx) => { const pct = grandTotal > 0 ? (amt / grandTotal) * 100 : 0; const color = currentColors[idx % currentColors.length]; conicStr += color + " " + currentPct + "% " + (currentPct + pct) + "%, "; currentPct += pct; }); conicStr = conicStr.slice(0, -2);

        let level2Totals = {}; let level1SelectedTotal = 0; let prevLevel2Totals = {}; let yoyLevel2Totals = {};
        if (selectedAnalysisLevel1) { 
          const aggregateLevel2 = (txs, totalsObj) => { txs.forEach(t => { if (pendingMap[t.id] === 'DELETE_TX' || pendingMap[t.id] === 'HARD_DELETE_TX') return; if (getParentCat(t.category) === selectedAnalysisLevel1) { const cCat = getChildCat(t.category); const amt = Number(t.amount) || 0; totalsObj[cCat] = (totalsObj[cCat] || 0) + amt; } }); }; 
          aggregateLevel2(analysisTxs, level2Totals); Object.values(level2Totals).forEach(v => level1SelectedTotal += v); 
          if (showCompare) { aggregateLevel2(prevAnalysisTxs, prevLevel2Totals); aggregateLevel2(yoyAnalysisTxs, yoyLevel2Totals); } 
        }
        const sortedLevel2 = Object.entries(level2Totals).sort((a,b) => b[1] - a[1]);

        const activeColorClass = analysisType === "expense" ? "blue" : "green"; const isExp = analysisType === "expense"; const clrUp = isExp ? "text-red-500" : "text-green-500"; const clrDn = isExp ? "text-green-500" : "text-red-500";
        let diffTotalPrev = grandTotal - totalPrev; let diffTotalYoy = grandTotal - totalYoy;

        return (
          <div className="space-y-4">
            
            {/* 簡潔的一行文字摘要 */}
            {showCompare && (diffTotalPrev !== 0 || diffTotalYoy !== 0) && (
              <div className="text-center text-[11px] font-bold text-gray-500 bg-gray-100/80 py-2.5 rounded-xl border border-gray-100 px-2 animate-in">
                較上期 {diffTotalPrev > 0 ? (isExp ? '增加' : '增加') : (diffTotalPrev < 0 ? (isExp ? '減少' : '減少') : '持平')}
                <span className={`mx-1 font-black ${diffTotalPrev > 0 ? clrUp : clrDn}`}>
                  {diffTotalPrev !== 0 ? `$${Math.abs(diffTotalPrev).toLocaleString()}` : ''}
                </span>
                
                {diffTotalYoy !== 0 && (
                  <>
                    <span className="mx-2 text-gray-300 font-normal">|</span>
                    較去年 {diffTotalYoy > 0 ? (isExp ? '增加' : '增加') : '減少'}
                    <span className={`ml-1 font-black ${diffTotalYoy > 0 ? clrUp : clrDn}`}>
                      ${Math.abs(diffTotalYoy).toLocaleString()}
                    </span>
                  </>
                )}
              </div>
            )}

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 relative">
              <div className="relative w-48 h-48 mx-auto mb-8 rounded-full shadow-lg" style={{ background: `conic-gradient(${conicStr})` }}>
                <div className="absolute inset-0 m-auto w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                  <span className="text-[10px] text-gray-400 font-black uppercase mb-1">{analysisType === "expense" ? "總支出" : "總收入"}</span>
                  <span className="text-xl font-black text-gray-800">${grandTotal.toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-[9px] text-center font-black text-gray-400 uppercase tracking-widest mb-3 bg-gray-50 py-1.5 rounded-lg border border-gray-100">點擊下方分類查看細項</div>
                {(sortedLevel1 || []).map(([cat, amt], idx) => {
                  const isSelected = selectedAnalysisLevel1 === cat; const diffP = amt - (prevLevel1Totals[cat] || 0); const diffY = amt - (yoyLevel1Totals[cat] || 0); 
                  return (
                    <div key={cat} onClick={() => { triggerVibration(10); setSelectedAnalysisLevel1(isSelected ? null : cat); setSelectedAnalysisLevel2(null); }} className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-colors border ${isSelected ? `bg-${activeColorClass}-50/50 border-${activeColorClass}-200` : 'bg-gray-50/50 hover:bg-gray-100 border-transparent'}`}>
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ background: currentColors[idx % currentColors.length] }}></div>
                        <span className={`font-bold text-sm truncate ${isSelected ? `text-${activeColorClass}-700` : 'text-gray-700'}`}>{cat}</span>
                      </div>
                      <div className="flex flex-col items-end shrink-0 pl-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-bold w-10 text-right">{grandTotal > 0 ? ((amt/grandTotal)*100).toFixed(1) : 0}%</span>
                          <span className={`font-black w-16 text-right ${isSelected ? `text-${activeColorClass}-700` : 'text-gray-800'}`}>${Math.round(amt).toLocaleString()}</span>
                        </div>
                        {showCompare && (diffP !== 0 || diffY !== 0) && (
                          <div className="flex gap-1.5 justify-end mt-1 text-[9px] font-bold opacity-90">
                            {diffP !== 0 && <span className={diffP > 0 ? clrUp : clrDn}>上期 {diffP > 0 ? '↑' : '↓'}{Math.abs(diffP).toLocaleString()}</span>}
                            {diffY !== 0 && <span className={diffY > 0 ? clrUp : clrDn}>去年 {diffY > 0 ? '↑' : '↓'}{Math.abs(diffY).toLocaleString()}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedAnalysisLevel1 && (
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 animate-in relative overflow-hidden mt-4">
                <div className={`absolute top-0 left-0 w-full h-1.5 bg-${activeColorClass}-500`}></div>
                <h4 className="font-black text-gray-800 mb-5 flex items-center gap-2 text-sm pt-2">「{selectedAnalysisLevel1}」子項目明細</h4>
                <div className="space-y-4">
                  {(sortedLevel2 || []).map(([cat, amt]) => {
                    const pct = level1SelectedTotal > 0 ? (amt / level1SelectedTotal) * 100 : 0; const diffP = amt - (prevLevel2Totals[cat] || 0); const diffY = amt - (yoyLevel2Totals[cat] || 0); 
                    return (
                      <div key={cat}>
                        <div className="flex justify-between items-start text-xs font-bold mb-1.5 gap-2">
                          <span className="text-gray-700 flex-1 min-w-0 flex items-center gap-1 mt-0.5"><span className="truncate">{cat}</span></span>
                          <div className="flex flex-col items-end shrink-0">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 tabular-nums">${Math.round(amt).toLocaleString()} <span className="text-[9px] text-gray-400 ml-1">({pct.toFixed(1)}%)</span></span>
                              <button onClick={(e) => { triggerVibration(10); e.stopPropagation(); setAnalysisDetailData({ title: `「${selectedAnalysisLevel1} - ${cat}」明細`, txs: analysisTxs.filter(t => { return getParentCat(t.category) === selectedAnalysisLevel1 && getChildCat(t.category) === cat; }) }); }} className="px-2 py-0.5 rounded-md text-[9px] font-black active:scale-95 transition-all bg-gray-100 text-gray-500 hover:bg-gray-200">明細</button>
                            </div>
                            {showCompare && (diffP !== 0 || diffY !== 0) && (
                              <div className="flex gap-1.5 justify-end mt-1 text-[9px] font-bold opacity-90 pr-10">
                                {diffP !== 0 && <span className={diffP > 0 ? clrUp : clrDn}>上期 {diffP > 0 ? '↑' : '↓'}{Math.abs(diffP).toLocaleString()}</span>}
                                {diffY !== 0 && <span className={diffY > 0 ? clrUp : clrDn}>去年 {diffY > 0 ? '↑' : '↓'}{Math.abs(diffY).toLocaleString()}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                          <div className={`h-full bg-${activeColorClass}-400 rounded-full transition-all duration-1000 ease-out`} style={{ width: animTrigger ? `${pct}%` : '0%' }}></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default AnalysisTab;