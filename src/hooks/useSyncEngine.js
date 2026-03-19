import { useState, useEffect, useRef, useCallback } from 'react';
import { STORE_NAME } from '../utils/constants';
import { saveToIndexedDB, loadFromIndexedDB, safeNumberLS } from '../utils/helpers';
import { postGAS, getDeviceToken, deviceValid } from '../utils/api';

export const useSyncEngine = ({
  currentUser,
  isOnline,
  txCacheRef,
  trashCacheRef,
  setTxCache,
  setTrashCache,
  applyCloudData,
  showStatus,
  forceReloginForToken
}) => {
  const [syncQueue, setSyncQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastServerTime, setLastServerTime] = useState(() => safeNumberLS('last_server_time_v1', 0));

  const syncQueueRef = useRef(syncQueue);
  const isSyncingRef = useRef(false);
  const syncDebounceRef = useRef(null);
  const pollingTimerRef = useRef(null);
  const lastServerTimeRef = useRef(lastServerTime);

  useEffect(() => { syncQueueRef.current = syncQueue; }, [syncQueue]);
  useEffect(() => { lastServerTimeRef.current = lastServerTime; }, [lastServerTime]);

  useEffect(() => {
    loadFromIndexedDB("sync_queue").then(data => { 
      if (data) { setSyncQueue(data); syncQueueRef.current = data; } 
    });
  }, []);

  const syncManager = useCallback(async (isSilent = false) => {
    if (!navigator.onLine || !deviceValid() || isSyncingRef.current) return;
    
    isSyncingRef.current = true; 
    if (!isSilent) setIsSyncing(true);
    
    try {
      const isDelta = lastServerTimeRef.current > 0;
      let processingQueue = [...syncQueueRef.current];

      if (processingQueue.length > 0) {
         while (processingQueue.length > 0 && navigator.onLine) {
            const CHUNK_SIZE = 50; 
            const currentBatch = processingQueue.slice(0, CHUNK_SIZE);
            const currentBatchOpIds = new Set(currentBatch.map(q => q.opId || q.id));
            
            if (!isSilent) {
              showStatus("info", `⏳ 正在上傳 ${currentBatch.length} 筆資料...`);
            }

            // 🚀 極速上傳，直接對接後端快照比對 (Idempotency)
            const res = await postGAS({ 
              action: "BATCH_PROCESS", 
              operations: currentBatch, 
              deviceToken: getDeviceToken(), 
              lastSyncTime: lastServerTimeRef.current, 
              enableArchiving: true 
            });
            
            if (res.result !== "success") throw new Error(res.message || "批次同步處理失敗");

            // 🛡️ 核心瘦身：刪除所有前端「自作主張」的快取刪除邏輯！
            // 100% 信任雲端回傳的結果，讓 applyCloudData 處理所有的新增、修改與刪除
            if (res.transactions || res.trash) {
              applyCloudData(res, isDelta);
              if (res.serverTime) setLastServerTime(res.serverTime);
            }

            // 處理完成，俐落切除佇列，打破無窮迴圈
            processingQueue = processingQueue.filter(p => !currentBatchOpIds.has(p.opId || p.id));
            
            syncQueueRef.current = processingQueue;
            setSyncQueue(processingQueue);
            saveToIndexedDB("sync_queue", processingQueue);

            if (res.conflicts && res.conflicts.length > 0) { 
              showStatus("error", `⚠️ 發現 ${res.conflicts.length} 筆資料衝突，已保留雲端最新版！`); 
            }
         } 
         
         if (!isSilent && processingQueue.length === 0) {
            showStatus("success", "✅ 已全部同步至雲端");
         }
      } else {
         const res = await postGAS({ 
           action: "GET_TX", 
           deviceToken: getDeviceToken(), 
           lastSyncTime: lastServerTimeRef.current, 
           enableArchiving: true 
         });
         
         if (res.result !== "success") throw new Error(res.message || "拉取失敗");
         
         if (res.transactions && res.transactions.length > 0) { 
            applyCloudData(res, isDelta); 
            if (res.serverTime) setLastServerTime(res.serverTime);
            if (!isSilent) showStatus("success", "🔄 已載入雲端最新資料"); 
         } else {
            if (res.serverTime) setLastServerTime(res.serverTime);
            if (!isSilent) showStatus("success", "✅ 已是最新資料");
         }
      }
    } catch (e) {
      const msg = e.message || "未知錯誤";
      if (msg.includes("憑證") || msg.includes("過期")) forceReloginForToken(); 
      else if (!isSilent) showStatus("error", `❌ 同步失敗: ${msg}`);
    } finally {
      isSyncingRef.current = false; 
      setIsSyncing(false);
    }
  }, [forceReloginForToken, applyCloudData, showStatus]);

  const silentPollEngine = useCallback(async () => {
    if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);

    if (!navigator.onLine || !currentUser || isSyncingRef.current) { 
      pollingTimerRef.current = setTimeout(silentPollEngine, 5000); 
      return; 
    }
    if (!deviceValid()) { forceReloginForToken(); return; }
    
    try {
      if (syncQueueRef.current.length > 0) {
        await syncManager(true); 
      } else {
        const data = await postGAS({ action:"GET_TX", deviceToken: getDeviceToken(), lastSyncTime: lastServerTimeRef.current, enableArchiving: true });
        if (data.result === "success") {
          const isDelta = lastServerTimeRef.current > 0;
          if (data.transactions && data.transactions.length > 0) {
             applyCloudData(data, isDelta);
          }
          if (data.serverTime) setLastServerTime(data.serverTime);
        }
      }
    } catch (e) {
      if (e.message && (e.message.includes("憑證") || e.message.includes("過期"))) forceReloginForToken();
    }
    
    pollingTimerRef.current = setTimeout(silentPollEngine, 5000);
  }, [forceReloginForToken, applyCloudData, currentUser, syncManager]);

  const requestSync = useCallback((isSilent = false, immediate = false) => {
    if (!navigator.onLine) return;
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    if (immediate) syncManager(isSilent); 
    // ⚡️ 極速優化：將防抖延遲從 500ms 降至 100ms，按下的瞬間幾乎就發車！
    else syncDebounceRef.current = setTimeout(() => syncManager(isSilent), 100); 
  }, [syncManager]);

  const processRef = useRef(requestSync);
  useEffect(() => { processRef.current = requestSync; }, [requestSync]);

  useEffect(() => {
    if (isOnline && currentUser) {
      silentPollEngine();
    }
    return () => { if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current); };
  }, [isOnline, currentUser, silentPollEngine]);

  const appendToQueueAndSync = useCallback((newItemList) => {
    setSyncQueue(prevQueue => {
      let currentQ = [...prevQueue];
      newItemList.forEach(newItem => {
        const newOpId = Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const idx = currentQ.findIndex(p => String(p.id) === String(newItem.id) && p.action !== "UPDATE_GROUP_PARENT");
        
        if (idx >= 0) {
          if (currentQ[idx].action === "ADD" && (newItem.action === "DELETE_TX" || newItem.action === "HARD_DELETE_TX")) {
            currentQ = currentQ.filter((_, i) => i !== idx);
          } else {
            currentQ[idx] = { ...newItem, action: currentQ[idx].action === 'ADD' ? 'ADD' : newItem.action, opId: newOpId };
          }
        } else {
          currentQ.push({ ...newItem, opId: newOpId });
        }
      });
      
      saveToIndexedDB("sync_queue", currentQ);
      syncQueueRef.current = currentQ;
      return currentQ;
    });

    if (!navigator.onLine) showStatus("info", `💾 已暫存於本機 (離線中)`); 
    else requestSync(false, true); // 🌟 immediate = true，直接秒速發車不等待
  }, [requestSync, showStatus]);

  return {
    syncQueue,
    setSyncQueue,
    isSyncing,
    lastServerTime,
    setLastServerTime,
    requestSync,
    appendToQueueAndSync
  };
};