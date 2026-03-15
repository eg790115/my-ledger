import React, { useState, useEffect, useMemo } from 'react';
import { SvgIcon } from './Icons';
import { CHART_COLORS } from '../utils/constants';
import { getCycleRange, parseDateForSort, getParentCat, getChildCat } from '../utils/helpers';

const AiInsightsCarousel = ({ aiReport, isEvaluating }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const defaultMessages = ["正在等待最新的財務洞察... 到「設定」點擊 🤖 手動分析吧！✨"];

  const messages = useMemo(() => {
    if (!aiReport) return defaultMessages;
    if (aiReport.includes('|')) return aiReport.split('|').map(s => s.trim()).filter(s => s.length > 5);
    const parsed = aiReport.split(/(?<=[。！？!\?])\s*/).filter(s => s.trim().length > 5);
    return parsed.length > 0 ? parsed : defaultMessages;
  }, [aiReport]);

  useEffect(() => {
    if (isEvaluating) return;
    let i = 0; const fullText = messages[currentIndex] || ""; setDisplayText(""); setIsTyping(true);
    const typingTimer = setInterval(() => {
      if (i < fullText.length) { setDisplayText(fullText.substring(0, i + 1)); i++; } 
      else { setIsTyping(false); clearInterval(typingTimer); }
    }, 50);
    return () => clearInterval(typingTimer);
  }, [currentIndex, messages, isEvaluating]);

  useEffect(() => {
    if (isEvaluating || messages.length <= 1) return;
    const interval = setInterval(() => setCurrentIndex((prev) => (prev + 1) % messages.length), 8000); 
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
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100/50 rounded-2xl p-4 flex items-start gap-3 shadow-sm relative mb-4 min-h-[4.8rem] transition-all overflow-hidden">
      <span className="shrink-0 text-lg mt-0.5 opacity-80 animate-bounce">📢</span>
      <div className="flex-1 w-full relative flex items-center h-full min-h-[3rem]">
        <span className="text-[12px] font-black text-indigo-800 leading-relaxed">{displayText}</span>
      </div>
    </div>
  );
};

const normalizeBen = (rawBen, currentUserName) => {
  if (!rawBen) return '未分類';
  if (rawBen === '全家') return '全家';
  
  let arr = rawBen.split(',').map(s => s.trim()).filter(Boolean);
  arr = [...new Set(arr)]; 
  
  const order = { '爸爸': 1, '媽媽': 2, '妈妈': 2, '兒子': 3 };
  arr.sort((a, b) => (order[a] || 99) - (order[b] || 99));
  
  const hasDad = arr.includes('爸爸');
  const hasMom = arr.includes('媽媽') || arr.includes('妈妈');
  const hasSon = arr.includes('兒子');
  
  if (hasDad && hasMom && hasSon) return '全家';
  if (hasDad && hasMom && arr.length === 2) return '夫妻';
  if (hasDad && hasSon && arr.length === 2) return '父子'; 
  if (hasMom && hasSon && arr.length === 2) return '母子'; 
  if (arr.length === 1 && arr[0] === currentUserName) return '自己';
  
  return arr.join(', ');
};

const PRETTY_COLORS = ['#8B5CF6', '#14B8A6', '#F43F5E', '#F97316', '#6366F1', '#10B981', '#EC4899', '#F59E0B'];
const getDisplayColor = (analysisType, cat, idx, fallbackColors) => {
  if (analysisType === "beneficiary") {
    if (cat === '自己') return '#3B82F6'; 
    if (cat === '全家') return '#F59E0B'; 
    if (cat === '夫妻') return '#EC4899'; 
    if (cat === '父子') return '#0EA5E9'; 
    if (cat === '母子') return '#8B5CF6'; 
    if (cat === '兒子') return '#10B981'; 
    return PRETTY_COLORS[idx % PRETTY_COLORS.length];
  }
  return fallbackColors[idx % fallbackColors.length];
};

const getThemeColors = (type) => {
  if (type === "income") return {
    l1SelectedBg: "bg-green-50/60", l1SelectedBorder: "border-green-200", l1SelectedRing: "ring-green-100", l1SelectedText: "text-green-800", l1Amount: "text-green-600",
    l2IconBg: "bg-green-50", l2IconText: "text-green-600", l2IconBorder: "border-green-100", l2BarFill: "bg-green-400", titleIcon: "text-green-500", indicator: "bg-green-400"
  };
  if (type === "beneficiary") return {
    l1SelectedBg: "bg-purple-50/60", l1SelectedBorder: "border-purple-200", l1SelectedRing: "ring-purple-100", l1SelectedText: "text-purple-800", l1Amount: "text-purple-600",
    l2IconBg: "bg-purple-50", l2IconText: "text-purple-600", l2IconBorder: "border-purple-100", l2BarFill: "bg-purple-400", titleIcon: "text-purple-500", indicator: "bg-purple-400"
  };
  return {
    l1SelectedBg: "bg-blue-50/60", l1SelectedBorder: "border-blue-200", l1SelectedRing: "ring-blue-100", l1SelectedText: "text-blue-800", l1Amount: "text-blue-600",
    l2IconBg: "bg-blue-50", l2IconText: "text-blue-600", l2IconBorder: "border-blue-100", l2BarFill: "bg-blue-400", titleIcon: "text-blue-500", indicator: "bg-blue-400"
  };
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
      <div className="flex flex-col gap-3 px-1">
        <div className="flex justify-between items-center mb-2 gap-2">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
            <h3 className="font-black text-xl text-gray-800 shrink-0">圖表分析</h3>
            <div className="flex bg-gray-200/60 p-0.5 rounded-xl gap-0.5 shrink-0">
              <button onClick={()=>{ triggerVibration(10); setAnalysisDateFilter("current_month"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${analysisDateFilter==='current_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>本期</button>
              <button onClick={()=>{ triggerVibration(10); setAnalysisDateFilter("last_month"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${analysisDateFilter==='last_month'?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>上期</button>
              <button onClick={()=>{ triggerVibration(10); setAnalysisDateFilter("all"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${analysisDateFilter==='all'?'bg-white text-gray-800 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>全部</button>
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

      <AiInsightsCarousel aiReport={aiEvalData ? (currentUser?.name === "爸爸" ? aiEvalData.dad_eval : aiEvalData.mom_eval) : null} isEvaluating={isAIEvaluating} />
      
      <div className="flex bg-gray-100 p-1.5 rounded-2xl text-[13px] text-gray-500 relative z-10">
        <button onClick={() => { triggerVibration(10); setAnalysisType("expense"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`flex-1 py-1.5 rounded-xl font-black transition-all ${analysisType === "expense" ? "bg-white text-red-500 shadow-sm" : ""}`}>支出</button>
        <button onClick={() => { triggerVibration(10); setAnalysisType("income"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`flex-1 py-1.5 rounded-xl font-black transition-all ${analysisType === "income" ? "bg-white text-green-500 shadow-sm" : ""}`}>收入</button>
        <button onClick={() => { triggerVibration(10); setAnalysisType("beneficiary"); setSelectedAnalysisLevel1(null); setSelectedAnalysisLevel2(null);}} className={`flex-1 py-1.5 rounded-xl font-black transition-all ${analysisType === "beneficiary" ? "bg-white text-purple-600 shadow-sm" : ""}`}>對象</button>
      </div>

      {(() => {
        let analysisTxs = myTransactions || []; 
        let prevAnalysisTxs = []; 
        let yoyAnalysisTxs = []; 
        const showCompare = (analysisDateFilter === "current_month" || analysisDateFilter === "last_month");
        
        if (analysisDateFilter !== "all") {
          if (analysisDateFilter === "custom") { 
            const start = analysisCustomStart ? new Date(`${analysisCustomStart}T00:00:00`).getTime() : 0; const end = analysisCustomEnd ? new Date(`${analysisCustomEnd}T23:59:59`).getTime() : Infinity; 
            analysisTxs = analysisTxs.filter(item => { const txTime = parseDateForSort(item); return txTime >= start && txTime <= end; }); 
          } else {
            const now = new Date(); let startTime = 0; let endTime = now.getTime();
            const bDay = Number(billingStartDay) || 1;

            if (analysisDateFilter === "current_month") { 
              let start = new Date(now.getFullYear(), now.getMonth(), bDay, 0, 0, 0);
              if (now.getDate() < bDay) start.setMonth(start.getMonth() - 1);
              let end = new Date(start);
              end.setMonth(end.getMonth() + 1);
              end.setDate(end.getDate() - 1);
              end.setHours(23, 59, 59, 999);
              startTime = start.getTime(); endTime = end.getTime();
            } 
            else if (analysisDateFilter === "last_month") { 
              let start = new Date(now.getFullYear(), now.getMonth(), bDay, 0, 0, 0);
              if (now.getDate() < bDay) start.setMonth(start.getMonth() - 1);
              start.setMonth(start.getMonth() - 1);
              let end = new Date(start);
              end.setMonth(end.getMonth() + 1);
              end.setDate(end.getDate() - 1);
              end.setHours(23, 59, 59, 999);
              startTime = start.getTime(); endTime = end.getTime();
            } 
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

        if (analysisType === "expense" || analysisType === "beneficiary") { 
          analysisTxs = analysisTxs.filter(t => t.type === "expense"); prevAnalysisTxs = prevAnalysisTxs.filter(t => t.type === "expense"); yoyAnalysisTxs = yoyAnalysisTxs.filter(t => t.type === "expense"); 
        } else if (analysisType === "income") {
          analysisTxs = analysisTxs.filter(t => t.type === "income"); prevAnalysisTxs = prevAnalysisTxs.filter(t => t.type === "income"); yoyAnalysisTxs = yoyAnalysisTxs.filter(t => t.type === "income"); 
        }
        
        if (analysisTxs.length === 0) return <div className="text-center text-gray-400 py-10 text-sm font-bold bg-white rounded-[2rem] border border-gray-100 shadow-sm mt-4">該區間尚無紀錄</div>;
        
        const getL1Key = (t) => analysisType === "beneficiary" ? normalizeBen(t.beneficiary || t.member, currentUser?.name) : getParentCat(t.category);
        const getL2Key = (t) => analysisType === "beneficiary" ? getParentCat(t.category) : getChildCat(t.category);

        const currentFallbackColors = CHART_COLORS[analysisType] || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']; 
        let level1Totals = {}; let grandTotal = 0; let prevLevel1Totals = {}; let totalPrev = 0; let yoyLevel1Totals = {}; let totalYoy = 0;
        
        const aggregateTotals = (txs, totalsObj) => { let total = 0; txs.forEach(t => { if (pendingMap && (pendingMap[t.id] === 'DELETE_TX' || pendingMap[t.id] === 'HARD_DELETE_TX')) return; const amt = Number(t.amount) || 0; total += amt; const pCat = getL1Key(t); totalsObj[pCat] = (totalsObj[pCat] || 0) + amt; }); return total; };
        grandTotal = aggregateTotals(analysisTxs, level1Totals); 
        if (showCompare) { totalPrev = aggregateTotals(prevAnalysisTxs, prevLevel1Totals); totalYoy = aggregateTotals(yoyAnalysisTxs, yoyLevel1Totals); }

        const sortedLevel1 = Object.entries(level1Totals).sort((a,b) => {
          if (analysisType === "beneficiary") {
            if (a[0] === '自己') return -1;
            if (b[0] === '自己') return 1;
          }
          return b[1] - a[1];
        }); 

        let conicStr = ""; let currentPct = 0; 
        sortedLevel1.forEach(([cat, amt], idx) => { 
          const pct = grandTotal > 0 ? (amt / grandTotal) * 100 : 0; 
          const color = getDisplayColor(analysisType, cat, idx, currentFallbackColors); 
          conicStr += color + " " + currentPct + "% " + (currentPct + pct) + "%, "; 
          currentPct += pct; 
        }); 
        conicStr = conicStr.slice(0, -2);

        let level2Totals = {}; let level1SelectedTotal = 0; let prevLevel2Totals = {}; let yoyLevel2Totals = {};
        if (selectedAnalysisLevel1) { 
          const aggregateLevel2 = (txs, totalsObj) => { txs.forEach(t => { if (pendingMap && (pendingMap[t.id] === 'DELETE_TX' || pendingMap[t.id] === 'HARD_DELETE_TX')) return; if (getL1Key(t) === selectedAnalysisLevel1) { const cCat = getL2Key(t); const amt = Number(t.amount) || 0; totalsObj[cCat] = (totalsObj[cCat] || 0) + amt; } }); }; 
          aggregateLevel2(analysisTxs, level2Totals); Object.values(level2Totals).forEach(v => level1SelectedTotal += v); 
          if (showCompare) { aggregateLevel2(prevAnalysisTxs, prevLevel2Totals); aggregateLevel2(yoyAnalysisTxs, yoyLevel2Totals); } 
        }
        const sortedLevel2 = Object.entries(level2Totals).sort((a,b) => b[1] - a[1]);

        const theme = getThemeColors(analysisType);
        
        const isExp = analysisType === "expense" || analysisType === "beneficiary"; 
        const clrUp = isExp ? "text-red-500" : "text-green-500"; 
        const clrDn = isExp ? "text-green-500" : "text-red-500";
        let diffTotalPrev = grandTotal - totalPrev; let diffTotalYoy = grandTotal - totalYoy;

        return (
          <div className="space-y-4">
            
            {showCompare && (diffTotalPrev !== 0 || diffTotalYoy !== 0) && (
              <div className="text-center text-[11px] font-bold text-gray-500 bg-gray-100/80 py-2.5 rounded-xl border border-gray-100 px-2 animate-in mt-2">
                較上期 {diffTotalPrev > 0 ? '增加' : '減少'}
                <span className={`mx-1 font-black ${diffTotalPrev > 0 ? clrUp : clrDn}`}>
                  {diffTotalPrev !== 0 ? `$${Math.abs(diffTotalPrev).toLocaleString()}` : ''}
                </span>
                {diffTotalYoy !== 0 && (
                  <>
                    <span className="mx-2 text-gray-300 font-normal">|</span>
                    較去年 {diffTotalYoy > 0 ? '增加' : '減少'}
                    <span className={`ml-1 font-black ${diffTotalYoy > 0 ? clrUp : clrDn}`}>
                      ${Math.abs(diffTotalYoy).toLocaleString()}
                    </span>
                  </>
                )}
              </div>
            )}

            <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-gray-100 relative mt-2 mb-6">
              <div className="relative w-48 h-48 mx-auto rounded-full shadow-lg transition-all duration-500 mb-8 mt-2" style={{ background: `conic-gradient(${conicStr})` }}>
                <div className="absolute inset-0 m-auto w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                  <span className="text-[10px] text-gray-400 font-black uppercase mb-1">
                    {analysisType === "expense" ? "總支出" : analysisType === "income" ? "總收入" : "總花費"}
                  </span>
                  <span className="text-xl font-black text-gray-800">${grandTotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-3 relative z-10">
                <div className="text-[10px] text-center font-black text-gray-400 uppercase tracking-widest mb-4 bg-gray-50 py-2 rounded-xl border border-gray-100">
                  {analysisType === "beneficiary" ? "點擊下方對象查看花費類別" : "點擊下方分類查看細項"}
                </div>
                
                {(sortedLevel1 || []).map(([cat, amt], idx) => {
                  const isSelected = selectedAnalysisLevel1 === cat; 
                  const diffP = amt - (prevLevel1Totals[cat] || 0); 
                  const rowColor = getDisplayColor(analysisType, cat, idx, currentFallbackColors);
                  const pct = grandTotal > 0 ? ((amt/grandTotal)*100).toFixed(1) : 0;
                  
                  return (
                    <div key={cat} onClick={() => { triggerVibration(10); setSelectedAnalysisLevel1(isSelected ? null : cat); setSelectedAnalysisLevel2(null); }} 
                         className={`p-3.5 rounded-2xl cursor-pointer transition-all border flex items-center gap-3 relative overflow-hidden ${isSelected ? `${theme.l1SelectedBg} ${theme.l1SelectedBorder} ring-2 ${theme.l1SelectedRing}` : 'bg-gray-50/60 border-gray-100 hover:bg-gray-100'}`}>
                      
                      {isSelected && <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${theme.indicator}`}></div>}
                      
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-[15px] text-white shadow-sm" style={{ backgroundColor: rowColor }}>
                          {cat.substring(0, 2)}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold text-[14px] leading-tight flex items-center gap-1.5 flex-wrap ${isSelected ? theme.l1SelectedText : 'text-gray-800'}`}>
                          <span className="truncate flex-shrink">{cat}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-bold mt-1">佔比 {pct}%</div>
                      </div>
                      
                      <div className="flex flex-col items-end justify-center shrink-0 pl-1 z-10">
                        <div className={`font-black tabular-nums text-[16px] leading-none ${isSelected ? theme.l1Amount : 'text-gray-800'}`}>
                          ${Math.round(amt).toLocaleString()}
                        </div>
                        {showCompare && diffP !== 0 && (
                          <div className={`mt-2 text-[9px] font-black px-1.5 py-0.5 rounded border shadow-sm ${diffP > 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                            {diffP > 0 ? '↑' : '↓'} {Math.abs(diffP).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedAnalysisLevel1 && (
              <div className="animate-in mt-2 space-y-3 p-4 bg-gray-100/80 rounded-[2.5rem] border border-gray-100 shadow-inner">
                <h4 className="font-black text-gray-800 flex items-center gap-2 pl-1 mb-3 text-sm">
                  <SvgIcon name="pieChart" size={16} className={theme.titleIcon} />
                  {analysisType === "beneficiary" ? `花在「${selectedAnalysisLevel1}」的類別明細` : `「${selectedAnalysisLevel1}」的子項目明細`}
                </h4>
                
                {(sortedLevel2 || []).map(([cat, amt]) => {
                  const pct = level1SelectedTotal > 0 ? (amt / level1SelectedTotal) * 100 : 0;
                  return (
                    <div key={cat} className="bg-white p-3.5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${theme.l2IconBg} flex items-center justify-center font-black text-[13px] ${theme.l2IconText} border ${theme.l2IconBorder} shrink-0`}>
                        {cat.substring(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="font-bold text-[14px] text-gray-800 truncate mb-1">{cat}</div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full ${theme.l2BarFill} rounded-full`} style={{ width: animTrigger ? `${pct}%` : '0%', transition: 'width 1s ease-out' }}></div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <div className="font-black text-[15px] text-gray-800">${Math.round(amt).toLocaleString()}</div>
                        <button onClick={(e) => { 
                            triggerVibration(10); e.stopPropagation(); 
                            setAnalysisDetailData({ 
                              title: `「${selectedAnalysisLevel1} - ${cat}」明細`, 
                              txs: analysisTxs.filter(t => getL1Key(t) === selectedAnalysisLevel1 && getL2Key(t) === cat) 
                            }); 
                          }} 
                          className="mt-1.5 px-2.5 py-1 bg-gray-50 text-gray-500 rounded-lg text-[10px] font-black active:scale-95 border border-gray-200">
                          查看明細
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            
          </div>
        );
      })()}
    </div>
  );
};

export default AnalysisTab;