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
  // 恢復為標準的 0
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

      if (syncQueueRef.current.length > 0) {
         while (syncQueueRef.current.length > 0 && navigator.onLine) {
            const CHUNK_SIZE = 50; 
            const currentBatch = syncQueueRef.current.slice(0, CHUNK_SIZE);
            
            if (!isSilent) {
              showStatus("info", `⏳ 正在上傳 ${currentBatch.length} 筆資料... (佇列剩餘 ${syncQueueRef.current.length - currentBatch.length} 筆)`);
            }

            const res = await postGAS({ 
              action: "BATCH_PROCESS", 
              operations: currentBatch, 
              deviceToken: getDeviceToken(), 
              lastSyncTime: lastServerTimeRef.current, 
              enableArchiving: true 
            });
            
            if (res.result !== "success") throw new Error(res.message || "批次同步處理失敗");

            const hardDeletedIds = new Set(currentBatch.filter(q => q.action === 'HARD_DELETE_TX').map(q => String(q.id)));
            const restoredIds = new Set(currentBatch.filter(q => q.action === 'RESTORE_TX').map(q => String(q.id)));
            const deletedIds = new Set(currentBatch.filter(q => q.action === 'DELETE_TX').map(q => String(q.id)));

            if (hardDeletedIds.size > 0 || restoredIds.size > 0) {
              const filteredTrash = trashCacheRef.current.filter(t => !hardDeletedIds.has(String(t.id)) && !restoredIds.has(String(t.id)));
              trashCacheRef.current = filteredTrash;
              setTrashCache(filteredTrash);
              saveToIndexedDB("trash_store", filteredTrash);
            }
            if (deletedIds.size > 0) {
              const filteredTx = txCacheRef.current.filter(t => !deletedIds.has(String(t.id)));
              txCacheRef.current = filteredTx;
              setTxCache(filteredTx);
              saveToIndexedDB(STORE_NAME, filteredTx);
            }

            if (res.transactions) {
              applyCloudData(res, isDelta);
              if (res.serverTime) setLastServerTime(res.serverTime);
            }

            const sentIds = currentBatch.map(q => q.id).filter(Boolean);
            const sentGroupIds = currentBatch.map(q => q.groupId).filter(Boolean);

            setSyncQueue(prevQueue => {
              const nextQ = prevQueue.filter(p => {
                if (p.id && sentIds.includes(p.id)) return false;
                if (p.groupId && sentGroupIds.includes(p.groupId)) return false;
                return true;
              });
              saveToIndexedDB("sync_queue", nextQ);
              syncQueueRef.current = nextQ;
              return nextQ;
            });

            if (res.conflicts && res.conflicts.length > 0) { 
              showStatus("error", `⚠️ 發現 ${res.conflicts.length} 筆資料衝突，已保留雲端最新版！`); 
            }
            
            if (syncQueueRef.current.length > 0) {
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
         } 
         
         if (!isSilent && syncQueueRef.current.length === 0) {
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
         
         if (res.transactions) { 
            applyCloudData(res, isDelta); 
            if (res.serverTime) setLastServerTime(res.serverTime);
            if (!isSilent) showStatus("success", "🔄 已載入雲端最新資料"); 
         } else {
            if (!isSilent) showStatus("success", "✅ 已是最新資料");
         }
      }
    } catch (e) {
      const msg = e.message || "未知錯誤";
      if (msg.includes("憑證") || msg.includes("過期")) forceReloginForToken(); else showStatus("error", `❌ 同步失敗: ${msg}`);
    } finally {
      isSyncingRef.current = false; setIsSyncing(false);
    }
  }, [forceReloginForToken, applyCloudData, showStatus, getDeviceToken]);

  const silentPollEngine = useCallback(async () => {
    if (!navigator.onLine || !currentUser || isSyncingRef.current) { pollingTimerRef.current = setTimeout(silentPollEngine, 5000); return; }
    if (!deviceValid()) { forceReloginForToken(); return; }
    try {
      const data = await postGAS({ action:"GET_TX", deviceToken: getDeviceToken(), lastSyncTime: lastServerTimeRef.current, enableArchiving: true });
      if (data.result === "success") {
        const isDelta = lastServerTimeRef.current > 0;
        if (data.transactions) {
           if (applyCloudData(data, isDelta)) showStatus("success", "🔄 已載入雲端最新資料");
           if (data.serverTime) setLastServerTime(data.serverTime);
        }
      }
    } catch (e) {
      if (e.message && (e.message.includes("憑證") || e.message.includes("過期"))) forceReloginForToken();
    }
    pollingTimerRef.current = setTimeout(silentPollEngine, 5000);
  }, [forceReloginForToken, applyCloudData, showStatus, currentUser]);

  const requestSync = useCallback((isSilent = false, immediate = false) => {
    if (!navigator.onLine) return;
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    if (immediate) syncManager(isSilent); else syncDebounceRef.current = setTimeout(() => syncManager(isSilent), 1000);
  }, [syncManager]);

  const processRef = useRef(requestSync);
  useEffect(() => { processRef.current = requestSync; }, [requestSync]);

  useEffect(() => {
    if (isOnline && currentUser) {
      if (syncQueue.length === 0) silentPollEngine();
      else { if (processRef.current) processRef.current(true, true); pollingTimerRef.current = setTimeout(silentPollEngine, 5000); }
    }
    return () => { if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current); };
  }, [isOnline, currentUser, silentPollEngine, syncQueue.length]);

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
    else requestSync(false, false);
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