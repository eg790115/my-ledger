import React, { useState, useRef, useEffect } from 'react';
import { SvgIcon } from './Icons';
import BottomNav from './components/BottomNav';
import SettingsTab from './components/SettingsTab';
import EditTransactionModal from './components/EditTransactionModal';
import LoginUI from './components/LoginUI';
import DashboardTab from './components/DashboardTab';
import HistoryTab from './components/HistoryTab';

// ... 🌟 此處略過其他 import 與 constants，請保留你原本的！

const App = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [currentUser, setCurrentUser] = useState(() => { try { return JSON.parse(localStorage.getItem('current_user')) || null; } catch { return null; } });
  
  // 各種資料載入狀態
  const [txCache, setTxCache] = useState([]);
  const [trashCache, setTrashCache] = useState([]);
  
  // 🌟 核心升級：編輯歷程與狀態管理
  const [modLogsCache, setModLogsCache] = useState([]); // 儲存所有的 ModificationLogs
  const [viewHistoryId, setViewHistoryId] = useState(null); // 當前正在觀看歷程的紀錄 ID

  // ... 略過 syncQueue, proxyNotify, isLoading, isOnline, showStatus, triggerVibration 狀態，請保留！
  // ... 略過 processSyncQueue 輔助函數

  // =======================================================
1.  // 🌟 核心升級：編輯儲存邏輯 - 建立「100% 完整舊資料 ArrayString」
  // =======================================================
  const handleEditSave = (updatedTx) => {
    triggerVibration(20);
    // 1. 找到修改前的原始舊資料
    const oldTx = txCache.find(t => t.id === updatedTx.id);
    if (!oldTx) return;

    // 🌟 任務 1：建立 100% 完整、無一缺漏的「舊資料 Array 格式」
    // 順序必須完全貼合 Code.gs 的交易格式陣列！
    const fullOldRecordArray = [
      oldTx.date,
      oldTx.category,
      oldTx.amount,
      oldTx.member,
      oldTx.desc,
      oldTx.type,
      oldTx.recorder,
      oldTx.id,
      oldTx.groupId || "",
      oldTx.parentDesc || "",
      oldTx.beneficiary || oldTx.member // 🌟 包含「對象 (Beneficiary)」！死無對證問題解決！
    ];

    // 2. 建立同步佇列項目
    const syncItem = {
      id: updatedTx.id,
      action: "EDIT", // 🌟 核心升級：告訴 Code.gs 這是一筆編輯
      data: updatedTx, // 這是新的紀錄內容
      oldDataArray: fullOldRecordArray // 🌟 核心升級：告訴 Code.gs 100% 完整的舊資料 Array！
    };

    // 3. 前端先進行樂觀更新 (不用等雲端)
    const newTxs = txCache.map(t => t.id === updatedTx.id ? { ...updatedTx, isEdited: true } : t);
    setTxCache(newTxs);
    
    // 4. 將同步項目丟入排程佇列
    appendToQueueAndSync([syncItem]);
    
    setEditTx(null); 
    showStatus("success", "✅ 紀錄已修改，正在與雲端同步...");
  };

  // ... 🌟 略過 handleAITransStop, appendToQueueAndSync 等

  // =======================================================
  // 🌟 核心升級：載入邏輯 - 接收 ModificationLogs
  // =======================================================
  const loadCloudData = async (force = false, showStatusMsg = false) => {
    if (!isOnline && force) { showStatus("error", "目前處於離線狀態，無法載入新資料。"); return; }
    if (!isOnline) return;

    try {
      const startTime = Date.now();
      setLoadingCard({ show: true, text: "正在從 Google Sheet 載入雲端資料庫..." });

      const response = await postGAS({ action: "LOAD_DATA" }, force);
      if (response.result !== "success") throw new Error(response.message);

      // 🌟 核心升級：存入 ModificationLogs 雲端快取
      setModLogsCache(response.modificationLogs || []); // 將完整歷程存起來
      
      // 🌟 核心升級：處理收支紀錄， Code.gs 已幫我們加掛 "isEdited" 旗標
      setTxCache(response.transactions || []);
      setTrashCache(response.trash || []);
      
      localStorage.setItem('family_ledger_tx_cache', JSON.stringify(response.transactions || []));
      
      const endTime = Date.now();
      setLoadingCard({ show: false, text: "" });
      if (showStatusMsg) showStatus("success", `✅ 雲端資料同步完成！ (${((endTime - startTime) / 1000).toFixed(1)}s)`);

    } catch (error) {
      console.error("LOAD_DATA Error", error);
      setLoadingCard({ show: false, text: "" });
      if (showStatusMsg) showStatus("error", `載入失敗：${error.message}`);
    }
  };

  // ... 🌟 此處略過 useEffect, 快捷設定, AI 分析邏輯，請保留！

  // =======================================================
2.  // 🌟 核心升級：UI：單筆紀錄的歷史歷程卡片元件
  // =======================================================
  const HistoryCard = ({ oldArrayStr }) => {
    // 🌟 解析 100% 完整的 Array JSON
    let r;
    try { r = JSON.parse(oldArrayStr); } catch { return <div className="p-4 bg-red-50 text-red-500 rounded-2xl">舊資料格式錯誤</div>; }
    
    // 將 array 還原為前台卡片格式
    const t = { date: r[0], category: r[1], amount: r[2], member: r[3], desc: r[4], type: r[5], id: r[7], groupId: r[8], parentDesc: r[9], beneficiary: r[10] || r[3] };

    // 🌟 卡片 UI 完全對齊首頁高級圖卡樣式 (只是改為灰色調)
    return (
      <div className="bg-gray-50/70 p-4 rounded-3xl border border-gray-100 flex items-start gap-3 relative overflow-hidden transition-colors mb-2.5">
        <div className="relative shrink-0 mt-0.5">
           <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-[17px] leading-none ${t.type==="income" ? "bg-green-100/50 text-green-700/80" : "bg-red-100/50 text-red-700/80"}`}>{t.type==="income" ? "收入" : "支出"}</div>
        </div>
        
        <div className="flex-1 min-w-0 pl-1 pt-1.5 pb-2">
          <div className="font-bold text-[14px] leading-tight text-gray-700 flex items-center gap-1.5 flex-wrap">
            <span className="truncate flex-shrink">{t.category}</span>
            {/* 🌟 100% 完整紀錄：包含對象 (Beneficiary)！ */}
            <span className="text-[9px] px-1.5 py-0.5 rounded-md border font-black bg-white text-gray-500 border-gray-100 truncate flex-shrink">
               {t.beneficiary} ({t.member})
            </span>
          </div>
          <div className="flex flex-col gap-1.5 mt-1.5 w-full items-start">
             {t.isGroup && t.parentTitle && (
                <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 self-start truncate">🏷️ 群組: {t.parentTitle}</span>
             )}
             {t.desc && <div className="text-[11px] text-gray-600 font-bold bg-gray-100 px-2.5 py-1.5 rounded-lg break-words w-full border border-gray-100 shadow-sm leading-relaxed">{t.desc}</div>}
          </div>
        </div>
        
        <div className="flex flex-col items-end justify-start shrink-0 pl-1 z-10 mt-1">
           <div className={`font-black tabular-nums text-[17px] leading-none ${t.type==="income" ? "text-green-600" : "text-red-600"}`}>${Number(t.amount||0).toLocaleString()}</div>
        </div>
      </div>
    );
  };


  return (
    <>
      {isLoading && LoadingModal()}
      {loginUserValid === false && <LoginUI onLoginSuccess={() => setLoginUserValid(true)} />}
      
      {loginUserValid === true && (
        <>
          <nav className="fixed top-0 inset-x-0 h-16 bg-white/95 backdrop-blur-sm border-b border-gray-100 flex items-center justify-between px-5 z-[700] pb-safe shadow-sm">
             <div className="flex items-center gap-2">
                <img src="/logo.png" className="w-8 h-8 rounded-xl shadow-lg border-2 border-white" />
                <h1 className="text-xl font-black text-gray-900 tracking-tight">Family <span className="text-blue-600">Ledger</span></h1>
             </div>
             <SettingsTab currentUser={currentUser} onLogout={() => setLoginUserValid(false)} onForceAIEval={handleForceAIEval} />
          </nav>

          <main className="pt-[5.5rem] pb-[7.5rem] min-h-screen px-4">
            {activeTab === "dashboard" && (
               <DashboardTab txCache={txCache} currentUser={currentUser} />
            )}
            {activeTab === "history" && (
               // 🌟 核心升級：將完整的歷程與觀看函數丟給 HistoryTab
               <HistoryTab txCache={txCache} trashCache={trashCache} currentUser={currentUser} onEditTx={setEditTx} onTrashDelete={handleEmptyTrash} modLogs={modLogsCache} onViewHistory={setViewHistoryId} />
            )}
            {activeTab === "add" && <div className="text-center py-20 text-gray-400">請按下方 + 按鈕新增紀錄</div>}
          </main>
          
          <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} triggerVibration={triggerVibration} onAITranscription={handleAITranscription} loadingCard={loadingCard} onVoiceRecordStop={handleVoiceRecordStop} />
          
          {editTx && (
            <EditTransactionModal tx={editTx} currentUser={currentUser} onSave={handleEditSave} onCancel={() => setEditTx(null)} />
          );
          }

          {/* 🌟 🌟 🌟 核心升級：【觀看編輯歷程】滿版彈窗 UI */}
          {viewHistoryId && (
            <div className="fixed inset-0 z-[1200] bg-gray-900/80 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-in">
              <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-5 sm:p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
                <h3 className="font-black text-xl mb-2 text-gray-800 flex items-center gap-2">
                   <div className="w-9 h-9 bg-gray-100 text-gray-600 rounded-xl flex items-center justify-center border-2 border-white shadow-lg">
                      <SvgIcon name="history" size={20} />
                   </div>
                   編輯歷程追溯
                </h3>
                <p className="text-[10px] text-gray-500 font-bold mb-5 bg-gray-50 p-2.5 rounded-lg border border-gray-100">以下為本筆紀錄在不同時間修改前的「完整樣子」。逆序排列，最上方為最近期的舊資料。</p>
                
                {/* 🌟 任務 5：最新編輯的在上方 (逆序排列) */}
                <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide space-y-3 mb-5">
                   {(() => {
                      const logs = modLogsCache
                         .filter(log => log.id === viewHistoryId) // 篩選該 ID
                         .sort((a, b) => new Date(b.time) - new Date(a.time)); // 🌟 最新在上方
                      
                      if (logs.length === 0) return <div className="text-center text-gray-400 py-10 text-sm font-bold">本筆紀錄尚無編輯歷程。</div>;
                      
                      return logs.map((log, idx) => (
                         <div key={idx} className="relative">
                            <div className="absolute top-0 -left-2 w-0.5 h-full bg-blue-100/50 rounded-full"></div>
                            <div className="absolute top-2 -left-[1.1rem] w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
                            
                            <div className="pl-3">
                               <div className="flex items-center gap-1.5 mb-1.5 ml-0.5">
                                  <span className="text-[10px] font-mono text-blue-600 font-black bg-blue-50 px-1.5 py-0.5 rounded">{displayDateTimeClean(log.time)}</span>
                                  <span className="text-[9px] font-black text-gray-400">{log.recorder} 編輯</span>
                               </div>
                               {/* 🌟 任務 3 & 4：觀看編輯卡片功能 */}
                               <HistoryCard oldArrayStr={log.oldArrayStr} />
                            </div>
                         </div>
                      ));
                   })()}
                </div>
                
                <div className="pt-2">
                   <button onClick={() => setViewHistoryId(null)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[15px] active:scale-95 transition-all shadow-xl shadow-blue-500/30">
                      我明白了
                   </button>
                </div>
              </div>
            </div>
          )}

          {proxyNotify && (
            <ProxyNotification notification={proxyNotify} onCancel={handleProxyCancelSync} onForceClear={handleForceClearQueue} />
          )}
        </>
      )}
    </>
  );
};

export default App;