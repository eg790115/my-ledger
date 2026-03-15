// src/components/AnalysisTab.jsx
import React from 'react';
import { SvgIcon } from './Icons';
import AIAssistant from './AIAssistant';
import { CHART_COLORS } from '../utils/constants';
import { getCycleRange, parseDateForSort, getParentCat, getChildCat } from '../utils/helpers';
// 🌟 重新引入 recharts，讓圓餅圖恢復專業水準！
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const AnalysisTab = ({
  analysisDateFilter, setAnalysisDateFilter, setSelectedAnalysisLevel1, setSelectedAnalysisLevel2,
  analysisCustomStart, setAnalysisCustomStart, analysisCustomEnd, setAnalysisCustomEnd,
  analysisType, setAnalysisType, aiEvalData, currentUser, isAIEvaluating, handleForceAIEval,
  myTransactions, billingStartDay, pendingMap, selectedAnalysisLevel1, setAnalysisDetailData,
  animTrigger, triggerVibration
}) => {
  return (
    <div className="space-y-4 animate-in pb-20 text-left">
      {/* 1. 頂部篩選器 */}
      <div className="flex flex-col gap-2 px-1">
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
            <h3 className="font-black text-xl text-gray-800 shrink-0">📊 儀表板</h3>
            <div className="flex bg-gray-200/60 p-0.5 rounded-xl gap-0.5 shrink-0">
              <button onClick={()=>{ triggerVibration(10); setAnalysisDateFilter("current_month"); setSelectedAnalysisLevel1(null);}} className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${analysisDateFilter==='current_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>本期</button>
              <button onClick={()=>{ triggerVibration(10); setAnalysisDateFilter("last_month"); setSelectedAnalysisLevel1(null);}} className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${analysisDateFilter==='last_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>上期</button>
              <button onClick={()=>{ triggerVibration(10); setAnalysisDateFilter("all"); setSelectedAnalysisLevel1(null);}} className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${analysisDateFilter==='all'?'bg-white text-gray-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>還原</button>
            </div>
          </div>
          <div className="relative shrink-0 border-l pl-2 border-gray-200">
            <select value={analysisDateFilter} onChange={(e) => { triggerVibration(10); setAnalysisDateFilter(e.target.value); setSelectedAnalysisLevel1(null);}} className="appearance-none bg-transparent py-1 pl-1 pr-4 font-black text-[10px] text-gray-400 outline-none text-right">
              <option value="all">全部</option><option value="current_month">本期</option><option value="last_month">上期</option><option value="7d">近7日</option><option value="1m">近一期</option><option value="3m">近3期</option><option value="6m">近半年</option><option value="custom">自訂</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none"><span className="text-[8px] text-gray-400">▼</span></div>
          </div>
        </div>
        {analysisDateFilter === "custom" && ( 
          <div className="flex gap-2 items-center bg-gray-100 p-2 rounded-xl border border-gray-200 shadow-inner">
            <input type="date" value={analysisCustomStart} onChange={e => setAnalysisCustomStart(e.target.value)} className="flex-1 bg-transparent font-black text-[10px] text-gray-700 outline-none text-center" />
            <span className="text-gray-400 font-bold text-xs">~</span>
            <input type="date" value={analysisCustomEnd} onChange={e => setAnalysisCustomEnd(e.target.value)} className="flex-1 bg-transparent font-black text-[10px] text-gray-700 outline-none text-center" />
          </div> 
        )}
      </div>
      
      {/* 收支切換按鈕 */}
      <div className="flex bg-gray-100 p-1 rounded-xl text-xs text-gray-500">
        <button onClick={() => { triggerVibration(10); setAnalysisType("expense"); setSelectedAnalysisLevel1(null);}} className={`flex-1 py-1.5 rounded-lg font-black transition-all ${analysisType === "expense" ? "bg-white text-red-500 shadow-sm" : ""}`}>支出分析</button>
        <button onClick={() => { triggerVibration(10); setAnalysisType("income"); setSelectedAnalysisLevel1(null);}} className={`flex-1 py-1.5 rounded-lg font-black transition-all ${analysisType === "income" ? "bg-white text-green-500 shadow-sm" : ""}`}>收入分析</button>
      </div>

      {/* 核心計算邏輯 */}
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
              if (analysisDateFilter === "7d") cutoff.setDate(now.getDate() - 7); else if (analysisDateFilter === "14d") cutoff.setDate(now.getDate() - 14); else if (analysisDateFilter === "1m") cutoff.setMonth(now.getMonth() - 1); else if (analysisDateFilter === "3m") cutoff.setMonth(now.getMonth() - 3); else if (analysisDateFilter === "6m") cutoff.setMonth(now.getMonth() - 6); else if (analysisDateFilter === "1y") cutoff.setFullYear(now.getFullYear() - 1); 
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
        
        const currentColors = CHART_COLORS[analysisType] || CHART_COLORS.expense; 
        let level1Totals = {}; let grandTotal = 0; let prevLevel1Totals = {}; let totalPrev = 0; let yoyLevel1Totals = {}; let totalYoy = 0;
        
        const aggregateTotals = (txs, totalsObj) => { let total = 0; txs.forEach(t => { if (pendingMap[t.id] === 'DELETE_TX' || pendingMap[t.id] === 'HARD_DELETE_TX') return; const amt = Number(t.amount) || 0; total += amt; const pCat = getParentCat(t.category); totalsObj[pCat] = (totalsObj[pCat] || 0) + amt; }); return total; };
        grandTotal = aggregateTotals(analysisTxs, level1Totals); 
        if (showCompare) { totalPrev = aggregateTotals(prevAnalysisTxs, prevLevel1Totals); totalYoy = aggregateTotals(yoyAnalysisTxs, yoyLevel1Totals); }

        const sortedLevel1 = Object.entries(level1Totals).sort((a,b) => b[1] - a[1]); 
        
        // 🌟 為 Recharts 準備資料格式
        const pieData = sortedLevel1.map(([name, value]) => ({ name, value }));

        let level2Totals = {}; let level1SelectedTotal = 0; let prevLevel2Totals = {}; let yoyLevel2Totals = {};
        if (selectedAnalysisLevel1) { 
          const aggregateLevel2 = (txs, totalsObj) => { txs.forEach(t => { if (pendingMap[t.id] === 'DELETE_TX' || pendingMap[t.id] === 'HARD_DELETE_TX') return; if (getParentCat(t.category) === selectedAnalysisLevel1) { const cCat = getChildCat(t.category); const amt = Number(t.amount) || 0; totalsObj[cCat] = (totalsObj[cCat] || 0) + amt; } }); }; 
          aggregateLevel2(analysisTxs, level2Totals); Object.values(level2Totals).forEach(v => level1SelectedTotal += v); 
          if (showCompare) { aggregateLevel2(prevAnalysisTxs, prevLevel2Totals); aggregateLevel2(yoyAnalysisTxs, yoyLevel2Totals); } 
        }
        const sortedLevel2 = Object.entries(level2Totals).sort((a,b) => b[1] - a[1]);

        const activeColorClass = analysisType === "expense" ? "blue" : "green"; const isExp = analysisType === "expense";
        let diffTotalPrev = grandTotal - totalPrev; let diffTotalYoy = grandTotal - totalYoy; let topIncreases = []; let topDecreases = [];

        if (showCompare && isExp) { 
          const allCats = new Set([...Object.keys(level1Totals), ...Object.keys(prevLevel1Totals)]); 
          allCats.delete("理財"); allCats.delete("投資"); allCats.delete("教育"); allCats.delete("育"); allCats.delete("醫療"); allCats.delete("醫"); 
          allCats.forEach(cat => { const curAmt = level1Totals[cat] || 0; const prevAmt = prevLevel1Totals[cat] || 0; const diff = curAmt - prevAmt; if (diff > 100) topIncreases.push({ cat, diff }); else if (diff < -100) topDecreases.push({ cat, diff }); }); 
          topIncreases.sort((a, b) => b.diff - a.diff); topDecreases.sort((a, b) => a.diff - b.diff); 
        }

        return (
          <div className="space-y-4">
            
            {/* 2. 核心 KPI 網格 */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-4 rounded-3xl shadow-sm border ${isExp ? 'bg-red-50/50 border-red-100' : 'bg-green-50/50 border-green-100'} flex flex-col justify-center`}>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">本期總{isExp ? '支出' : '收入'}</span>
                <span className={`text-2xl font-black ${isExp ? 'text-red-600' : 'text-green-600'} tabular-nums`}>${grandTotal.toLocaleString()}</span>
              </div>
              
              {showCompare ? (
                <div className="p-4 rounded-3xl shadow-sm border bg-white border-gray-100 flex flex-col justify-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">較上期相比</span>
                  <span className={`text-lg font-black tabular-nums ${diffTotalPrev > 0 ? (isExp ? 'text-red-500' : 'text-green-500') : (diffTotalPrev < 0 ? (isExp ? 'text-green-500' : 'text-red-500') : 'text-gray-500')}`}>
                    {diffTotalPrev > 0 ? `+ $${diffTotalPrev.toLocaleString()}` : (diffTotalPrev < 0 ? `- $${Math.abs(diffTotalPrev).toLocaleString()}` : '持平')}
                  </span>
                  {diffTotalYoy !== 0 && <span className="text-[8px] text-gray-400 mt-1 font-bold">較去年 {diffTotalYoy > 0 ? '↑' : '↓'} {Math.abs(diffTotalYoy).toLocaleString()}</span>}
                </div>
              ) : (
                <div className="p-4 rounded-3xl shadow-sm border bg-gray-50 border-gray-100 flex flex-col justify-center items-center text-center">
                  <SvgIcon name="chart" size={20} className="text-gray-300 mb-1" />
                  <span className="text-[9px] text-gray-400 font-bold">自訂區間無比較數據</span>
                </div>
              )}
            </div>

            {/* 🌟 3. 重點區：Recharts 專業圖表 + 右側清單 (作為圖例) */}
            <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex items-center gap-2">
              
              {/* 左側：精美的 Recharts 圓餅圖 */}
              <div className="relative w-36 h-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius="65%"
                      outerRadius="100%"
                      paddingAngle={3} /* 🌟 加上間距，顏色再像也不會黏在一起 */
                      dataKey="value"
                      stroke="none"
                      isAnimationActive={true}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={currentColors[index % currentColors.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value) => `$${Number(value).toLocaleString()}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: '900' }}
                      itemStyle={{ fontWeight: '900', color: '#1f2937' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* 圓餅圖中心的文字 */}
                <div className="absolute inset-0 m-auto flex flex-col items-center justify-center pointer-events-none w-16 h-16 bg-white rounded-full shadow-inner">
                  <span className="text-[10px] text-gray-400 font-black uppercase leading-none">佔比</span>
                </div>
              </div>
              
              {/* 右側：可滑動的圖例清單 (保證所有有消費的分類都在這) */}
              <div className="flex-1 min-w-0 max-h-[140px] overflow-y-auto pr-1 space-y-2 scrollbar-hide relative">
                {(sortedLevel1 || []).map(([cat, amt], idx) => {
                  const isSelected = selectedAnalysisLevel1 === cat;
                  return (
                    <div key={cat} onClick={() => { triggerVibration(10); setSelectedAnalysisLevel1(isSelected ? null : cat); }} className={`flex items-center justify-between p-2 rounded-xl cursor-pointer border transition-colors ${isSelected ? `bg-${activeColorClass}-50 border-${activeColorClass}-200` : 'bg-gray-50 hover:bg-gray-100 border-transparent'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: currentColors[idx % currentColors.length] }}></div>
                        <span className="font-bold text-[11px] truncate text-gray-700">{cat}</span>
                      </div>
                      <div className="flex flex-col items-end shrink-0 pl-1">
                        <span className={`font-black text-xs tabular-nums ${isSelected ? `text-${activeColorClass}-700` : 'text-gray-800'}`}>${Math.round(amt).toLocaleString()}</span>
                        <span className="text-[9px] text-gray-400 font-bold">{grandTotal > 0 ? ((amt/grandTotal)*100).toFixed(1) : 0}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. 子分類詳細進度條 */}
            {selectedAnalysisLevel1 && (
              <div className="bg-gray-50 p-4 rounded-[2rem] shadow-inner border border-gray-200 animate-in">
                <h4 className="font-black text-gray-800 mb-3 text-xs flex justify-between items-center">
                  <span>「{selectedAnalysisLevel1}」明細</span>
                  <span className="text-[9px] bg-white px-2 py-0.5 rounded border text-gray-500">佔 ${(level1SelectedTotal).toLocaleString()}</span>
                </h4>
                <div className="space-y-3">
                  {(sortedLevel2 || []).map(([cat, amt]) => {
                    const pct = level1SelectedTotal > 0 ? (amt / level1SelectedTotal) * 100 : 0; 
                    return (
                      <div key={cat} className="group cursor-pointer" onClick={(e) => { triggerVibration(10); setAnalysisDetailData({ title: `「${selectedAnalysisLevel1} - ${cat}」明細`, txs: analysisTxs.filter(t => getParentCat(t.category) === selectedAnalysisLevel1 && getChildCat(t.category) === cat) }); }}>
                        <div className="flex justify-between text-[11px] font-bold mb-1">
                          <span className="text-gray-700 truncate pr-2 group-active:text-blue-600 transition-colors">{cat} <span className="text-gray-400 text-[9px] ml-1">(點擊看明細)</span></span>
                          <span className="text-gray-600 tabular-nums">${Math.round(amt).toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full bg-${activeColorClass}-400 rounded-full transition-all duration-1000 ease-out`} style={{ width: animTrigger ? `${pct}%` : '0%' }}></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 5. 抓漏警示區 (橫向捲動卡片) */}
            {showCompare && isExp && (topIncreases.length > 0 || topDecreases.length > 0) && (
               <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                 {topIncreases.length > 0 && (
                   <div className="shrink-0 w-[85%] bg-red-50 p-3 rounded-2xl border border-red-100 flex items-center gap-3">
                     <span className="text-lg">⚠️</span>
                     <div className="min-w-0 flex-1">
                       <div className="text-[10px] text-red-500 font-black uppercase">超支警示</div>
                       <div className="text-xs font-bold text-gray-800 truncate">【{topIncreases[0].cat}】較上期多 <span className="text-red-600 font-black">${topIncreases[0].diff.toLocaleString()}</span></div>
                     </div>
                   </div>
                 )}
                 {topDecreases.length > 0 && (
                   <div className="shrink-0 w-[85%] bg-green-50 p-3 rounded-2xl border border-green-100 flex items-center gap-3">
                     <span className="text-lg">👍</span>
                     <div className="min-w-0 flex-1">
                       <div className="text-[10px] text-green-600 font-black uppercase">省錢達人</div>
                       <div className="text-xs font-bold text-gray-800 truncate">【{topDecreases[0].cat}】較上期省 <span className="text-green-600 font-black">${Math.abs(topDecreases[0].diff).toLocaleString()}</span></div>
                     </div>
                   </div>
                 )}
               </div>
            )}

            {/* 6. AI 顧問卡片 */}
            <AIAssistant 
               evaluationText={aiEvalData ? (currentUser.name === "爸爸" ? aiEvalData.dad_eval : aiEvalData.mom_eval) : null} 
               lastUpdated={aiEvalData ? aiEvalData.lastUpdated : null}
               isEvaluating={isAIEvaluating} 
               onManualTrigger={handleForceAIEval}
            />

          </div>
        );
      })()}
    </div>
  );
};

export default AnalysisTab;