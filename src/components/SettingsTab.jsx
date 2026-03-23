import React, { useState } from 'react';
import { SvgIcon } from './Icons';
import { formatDateOnly, getSafeCycleRange } from '../utils/helpers';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';

const SettingsTab = ({
  handleForceAIEval, isAIEvaluating, isSyncing, triggerVibration,
  billingStartDay, setBillingStartDay, currentCycleRange,
  customSubtitle, setCustomSubtitle, handleSaveGreeting,
  currentUser, setShowChangePinModal, bioBound, setUnbindPin,
  setShowUnbindModal, bindDeviceBio, setShowClearCacheModal,
  setCurrentUser, setSelectingUser, setPinInput, setActiveTab,
  syncQueue, setShowClearQueueModal, isLogOpen, setIsLogOpen,
  txCache
}) => {

  const [exportRangeType, setExportRangeType] = useState('current');
  const [includeAnalysis, setIncludeAnalysis] = useState(true); 
  const [showCustomModal, setShowCustomModal] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);

  const safeFormat = (ts) => {
    if (!ts) return "計算中...";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "日期錯誤";
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  const myTxs = (txCache || []).filter(tx => String(tx.member).trim() === String(currentUser?.name).trim());

  const handleExportCSV = async (mode = 'download') => {
    if (myTxs.length === 0) {
      alert("目前沒有您的記帳資料可以匯出喔！");
      return;
    }
    if (triggerVibration) triggerVibration(10);

    const now = new Date();
    let rStart = 0, rEnd = Infinity, label = "";

    const fmtLabel = (ts) => {
      const d = new Date(ts);
      return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    };

    if (exportRangeType === 'all') {
      rStart = 0; rEnd = Infinity;
      label = "全部時間";
    } else if (exportRangeType === 'current') {
      const r = getSafeCycleRange(now, billingStartDay, 0);
      rStart = r.start; rEnd = r.end;
      label = `${fmtLabel(r.start)}-${fmtLabel(r.end)}`;
    } else if (exportRangeType === 'last') {
      const r = getSafeCycleRange(now, billingStartDay, -1);
      rStart = r.start; rEnd = r.end;
      label = `${fmtLabel(r.start)}-${fmtLabel(r.end)}`;
    } else if (exportRangeType === 'last_3') {
      const rStartRange = getSafeCycleRange(now, billingStartDay, -2);
      const rEndRange = getSafeCycleRange(now, billingStartDay, 0);
      rStart = rStartRange.start; rEnd = rEndRange.end;
      label = `${fmtLabel(rStart)}-${fmtLabel(rEnd)}`;
    } else if (exportRangeType === 'custom') {
      rStart = new Date(customStart.replace(/-/g, '/') + " 00:00:00").getTime();
      rEnd = new Date(customEnd.replace(/-/g, '/') + " 23:59:59").getTime();
      label = `${customStart.replace(/-/g, '')}-${customEnd.replace(/-/g, '')}`;
    }

    const targetTxs = myTxs.filter(tx => {
      if (!tx.date) return false;
      const t = new Date(tx.date.replace(/-/g, '/')).getTime();
      return t >= rStart && t <= rEnd;
    });

    if (targetTxs.length === 0) {
      alert("⚠️ 在您選擇的區間內，沒有找到任何記帳資料喔！");
      return;
    }

    const escapeCSV = (str) => `"${String(str || "").replace(/"/g, '""')}"`; 
    
    const detailHeaders = ["日期", "類型", "大類別", "小類別", "金額", "消費對象", "明細備註", "母項目名稱(發票群組)", "母項目備註", "紀錄來源"].map(escapeCSV);
    const sortedTxs = [...targetTxs].sort((a, b) => new Date(b.date.replace(/-/g,'/')).getTime() - new Date(a.date.replace(/-/g,'/')).getTime());
    
    const detailDataRows = sortedTxs.map(tx => {
      const typeStr = tx.type === 'income' ? '收入' : '支出';
      const [parentCat, childCat] = (tx.category || "其他/雜項").split("/");
      const isGroup = !!tx.groupId;
      
      let sourceStr = "本人";
      if (tx.recorder && tx.recorder !== currentUser?.name) {
        sourceStr = isGroup ? `${tx.recorder}的群組發票` : `${tx.recorder}代記`;
      }

      let pTitle = tx.parentTitle || "";
      let pDesc = tx.parentDesc || "";
      if (!pTitle && pDesc.includes("|||")) {
        const parts = pDesc.split("|||");
        pTitle = parts[0] || ""; pDesc = parts[1] || "";
      } else if (!pTitle && isGroup) {
        pTitle = "發票拆分"; 
      }

      return [
        escapeCSV(tx.date), escapeCSV(typeStr), escapeCSV(parentCat), escapeCSV(childCat),
        tx.amount, escapeCSV(tx.beneficiary), escapeCSV(tx.desc), escapeCSV(pTitle), escapeCSV(pDesc), escapeCSV(sourceStr)
      ];
    });

    const analysisDataRows = [];
    if (includeAnalysis) {
      let totalIncome = 0;
      let totalExpense = 0;
      const expenseByCategory = {};
      const expenseByBeneficiary = {};

      targetTxs.forEach(tx => {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') {
          totalIncome += amt;
        } else {
          totalExpense += amt;
          const parentCat = (tx.category || "其他/雜項").split("/")[0];
          expenseByCategory[parentCat] = (expenseByCategory[parentCat] || 0) + amt;
          
          const ben = tx.beneficiary || "未知";
          expenseByBeneficiary[ben] = (expenseByBeneficiary[ben] || 0) + amt;
        }
      });

      const sortedCategories = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);
      const sortedBens = Object.entries(expenseByBeneficiary).sort((a, b) => b[1] - a[1]);

      analysisDataRows.push([escapeCSV(`--- 財務分析總表 (${label}) ---`), ""]);
      analysisDataRows.push([escapeCSV("總收入"), totalIncome]);
      analysisDataRows.push([escapeCSV("總支出"), totalExpense]);
      analysisDataRows.push([escapeCSV("淨結餘"), totalIncome - totalExpense]);
      
      analysisDataRows.push(["", ""]);
      analysisDataRows.push([escapeCSV("--- 支出大類別統計 ---"), ""]);
      sortedCategories.forEach(([cat, amt]) => {
        analysisDataRows.push([escapeCSV(cat), amt]);
      });
      
      analysisDataRows.push(["", ""]);
      analysisDataRows.push([escapeCSV("--- 消費對象統計 ---"), ""]);
      sortedBens.forEach(([ben, amt]) => {
        analysisDataRows.push([escapeCSV(ben), amt]);
      });
    }

    const finalCsvRows = [];
    const maxRows = Math.max(detailDataRows.length + 1, analysisDataRows.length);

    for (let i = 0; i < maxRows; i++) {
      let row = [];
      
      if (i === 0) {
        row.push(...detailHeaders);
      } else if (i - 1 < detailDataRows.length) {
        row.push(...detailDataRows[i - 1]);
      } else {
        row.push("", "", "", "", "", "", "", "", "", ""); 
      }

      if (includeAnalysis) {
        row.push(""); 
        if (i < analysisDataRows.length) {
          row.push(...analysisDataRows[i]); 
        } else {
          row.push("", ""); 
        }
      }

      finalCsvRows.push(row.join(","));
    }

    const csvContent = "\uFEFF" + finalCsvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const fileName = `帳單_${currentUser?.name}_${label}.csv`;

    if (mode === 'share') {
      if (navigator.canShare && navigator.share) {
        const file = new File([blob], fileName, { type: 'text/csv' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: '記帳資料匯出',
              text: `這是 ${currentUser?.name} 的記帳資料 (${label})`
            });
            return;
          } catch (error) {
            if (error.name !== 'AbortError') console.error("分享失敗:", error);
            return;
          }
        }
      } else {
        alert("您的瀏覽器不支援原生分享功能，將為您直接下載檔案。");
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 animate-in text-left pb-20 text-gray-800 relative">
      
      {showCustomModal && (
        <div className="fixed inset-0 z-[1200] bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-8 animate-in text-white" onClick={(e) => { if(e.target === e.currentTarget) setShowCustomModal(false); }}>
          <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 text-gray-900 relative shadow-2xl">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <SvgIcon name="calendar" size={32} />
            </div>
            <h3 className="font-black text-xl mb-2 text-gray-800 text-center">自訂匯出區間</h3>
            <p className="text-xs text-gray-500 mb-6 font-bold text-center">請選擇您要匯出的起訖日期</p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">開始日期</label>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full bg-gray-50 rounded-2xl px-4 py-3 font-black outline-none border border-gray-200 focus:border-green-500 transition-colors text-gray-800" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">結束日期 (含)</label>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full bg-gray-50 rounded-2xl px-4 py-3 font-black outline-none border border-gray-200 focus:border-green-500 transition-colors text-gray-800" />
              </div>
            </div>

            <div className="flex gap-3">
               <button onClick={() => { setShowCustomModal(false); setExportRangeType('current'); }} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black active:scale-95">取消</button>
               <button onClick={() => setShowCustomModal(false)} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-black active:scale-95 shadow-md shadow-green-500/30">確認範圍</button>
            </div>
          </div>
        </div>
      )}

      {/* 記帳週期設定 */}
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm border-gray-100">
        <h3 className="font-black text-xs mb-4 uppercase flex items-center gap-2 text-gray-800 tracking-widest px-1">
          <SvgIcon name="calendar" size={16} className="text-blue-500 shrink-0" /> 記帳週期設定
        </h3>
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-blue-200 transition-colors">
          <label className="text-[9px] font-black text-gray-400 uppercase block mb-2 leading-none tracking-widest">起始日 (個人獨立設定)</label>
          <div className="flex items-center gap-2">
            
            {/* 🚀 寫入個人的專屬設定檔 */}
            <select value={billingStartDay} onChange={async (e) => { 
              const newDay = Number(e.target.value); 
              setBillingStartDay(newDay); 
              localStorage.setItem('billing_start_day_v1', String(newDay)); 
              if (db) {
                try {
                  await setDoc(doc(db, 'members', currentUser.name), { billingStartDay: newDay }, { merge: true });
                } catch(err) { console.error("同步週期失敗", err); }
              }
            }} className="flex-1 bg-transparent font-black border-none outline-none text-blue-600 text-sm min-w-0">
              {[...Array(28)].map((_, i) => <option key={i+1} value={i+1}>每月 {i+1} 號</option>)}
            </select>

          </div>
          <div className="mt-3 text-[10px] text-gray-500 font-bold bg-white p-2 rounded-xl border border-gray-100 leading-relaxed">
            設定後，歷史清單與圖表的「本期/上期」將以此為基準。<br/>👉 目前本期範圍：
            <span className="text-blue-600 ml-1">{safeFormat(currentCycleRange?.start)} ~ {safeFormat(currentCycleRange?.end)}</span>
          </div>
        </div>
      </div>

      {/* 介面自訂 */}
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

      {/* AI 財務教練區塊 */}
      {currentUser?.name === '爸爸' && (
        <div className="bg-white p-6 rounded-[2rem] border shadow-sm border-gray-100">
          <h3 className="font-black text-xs mb-5 uppercase flex items-center gap-2 text-gray-800 tracking-widest px-1">
            <SvgIcon name="sparkles" size={16} className="text-purple-500 shrink-0" /> 智慧輔助功能
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 gap-2">
              <div className="min-w-0">
                <p className="text-gray-400 text-[10px] font-black uppercase mb-1 leading-none truncate">AI 財務教練</p>
                <p className="font-black text-gray-800 text-sm leading-none mt-1 truncate">重新分析最近30天帳單</p>
              </div>
              <button 
                onClick={() => { triggerVibration(10); handleForceAIEval(); }} 
                disabled={isAIEvaluating}
                className="bg-purple-600 text-white px-4 py-2 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all shrink-0 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isAIEvaluating ? <SvgIcon name="spinner" size={14} className="animate-spin" /> : null}
                {isAIEvaluating ? "分析中" : "強制分析"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 資料備份與匯出 */}
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm border-gray-100">
        <h3 className="font-black text-xs mb-5 uppercase flex items-center gap-2 text-gray-800 tracking-widest px-1">
          <SvgIcon name="download" size={16} className="text-green-500 shrink-0" /> 資料備份與匯出
        </h3>
        <div className="space-y-3">
          
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-green-200 transition-colors">
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-2 leading-none tracking-widest">請選擇匯出範圍</label>
            <div className="flex items-center gap-2">
              <select 
                value={exportRangeType} 
                onChange={(e) => {
                  const val = e.target.value;
                  setExportRangeType(val);
                  if (val === 'custom') setShowCustomModal(true);
                }} 
                className="flex-1 bg-transparent font-black border-none outline-none text-green-600 text-[13px] min-w-0"
              >
                <option value="all">全部時間 (共 {myTxs.length} 筆)</option>
                <option value="current">當期明細 ({safeFormat(currentCycleRange?.start)}起)</option>
                <option value="last">上一期明細</option>
                <option value="last_3">近三期明細</option>
                <option value="custom">
                  {exportRangeType === 'custom' ? `自訂: ${customStart.replace(/-/g,'/')} ~ ${customEnd.replace(/-/g,'/')}` : "自訂區間..."}
                </option>
              </select>
              {exportRangeType === 'custom' && (
                <button onClick={() => setShowCustomModal(true)} className="p-1.5 bg-green-100 text-green-600 rounded-lg active:scale-95 shrink-0 transition-transform">
                  <SvgIcon name="edit" size={14} />
                </button>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 px-1 cursor-pointer">
            <input 
              type="checkbox" 
              checked={includeAnalysis} 
              onChange={(e) => setIncludeAnalysis(e.target.checked)} 
              className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
            />
            <span className="text-xs font-black text-gray-600 select-none">附加「財務分析總表」於 CSV 右側</span>
          </label>

          <div className="flex gap-2 mt-2">
            <button 
              onClick={() => handleExportCSV('download')} 
              className="flex-[1.2] bg-green-600 text-white px-3 py-3.5 rounded-xl font-black text-[13px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-green-600/30"
            >
              <SvgIcon name="download" size={16} className="shrink-0" /> 儲存至本機
            </button>
            <button 
              onClick={() => handleExportCSV('share')} 
              className="flex-1 bg-blue-500 text-white px-3 py-3.5 rounded-xl font-black text-[13px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-blue-500/30"
            >
              <SvgIcon name="share" size={16} className="shrink-0" /> 分享/雲端
            </button>
          </div>

        </div>
      </div>

      {/* 安全與帳戶管理 */}
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
                <li>🚀 實裝：記帳週期與捷徑自動依照「登入者」獨立雲端同步</li>
                <li>新增「消費對象統計」至 CSV 分析總表</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsTab;