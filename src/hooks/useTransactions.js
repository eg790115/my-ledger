// src/hooks/useTransactions.js
import { useMemo } from 'react';
import { parseDateForSort, nowStr } from '../utils/helpers';

export const useTransactions = ({
  currentUser,
  txCache,
  trashCache,
  syncQueue,
  appendToQueueAndSync,
  triggerVibration,
  showStatus,
  setActiveTab,
  setEditingTx,
  setEditingGroup,
  setConfirmHardDeleteId,
  setShowConfirmEmptyTrash,
  setShowTrashModal
}) => {
  // 1. 待處理狀態映射表 (O(1) 查詢用，極大提升渲染效能)
  const pendingMap = useMemo(() => {
    const map = {};
    [...syncQueue].filter(Boolean).forEach(item => {
      if (item.isOffline) {
        if (item.id && item.action !== "UPDATE_GROUP_PARENT") map[item.id] = item.action;
        if (item.groupId && item.action === "UPDATE_GROUP_PARENT") map[item.groupId] = item.action;
      }
    });
    return map;
  }, [syncQueue]);

  // 2. 計算「可視主清單」(將快取與離線待辦佇列進行合併與抵銷)
  const visibleTransactions = useMemo(() => {
    if (!currentUser) return [];
    let base = [...(txCache || [])].filter(t => t && t.id);
    const combinedQueue = [...syncQueue].filter(Boolean);
    
    // 濾除已標記刪除的項目
    base = base.filter(t => !combinedQueue.some(q => String(q.id) === String(t.id) && (q.action === 'DELETE_TX' || q.action === 'HARD_DELETE_TX')));
    
    // 疊加未上傳的修改
    base = base.map(t => {
      let mod = { ...t };
      const pendingGUpdate = combinedQueue.find(q => String(q.groupId) === String(t.groupId) && q.action === 'UPDATE_GROUP_PARENT');
      if (pendingGUpdate) { mod.date = pendingGUpdate.date; mod.parentDesc = pendingGUpdate.parentDesc; }
      const pendingUpdate = combinedQueue.find(q => String(q.id) === String(t.id) && q.action === 'UPDATE_TX');
      if (pendingUpdate) mod = { ...mod, ...pendingUpdate }; 
      return mod;
    });

    const baseIds = new Set(base.map(t => String(t.id)));
    // 加入全新的新增與還原項目
    const pendingAdds = combinedQueue.filter(q => (q.action === 'ADD' || q.action === 'RESTORE_TX') && q.id && !baseIds.has(String(q.id)));
    base = [...pendingAdds, ...base];
    return base.sort((a,b) => parseDateForSort(b) - parseDateForSort(a) || String(b.id).localeCompare(String(a.id)));
  }, [currentUser, txCache, syncQueue]);

  // 3. 計算「垃圾桶清單」
  const visibleTrash = useMemo(() => {
    if (!currentUser) return [];
    let base = [...(trashCache || [])].filter(t => t && t.id);
    const combinedQueue = [...syncQueue].filter(Boolean);
    
    base = base.filter(t => !combinedQueue.some(q => String(q.id) === String(t.id) && (q.action === 'HARD_DELETE_TX' || q.action === 'RESTORE_TX')));
    const pendingDeletes = combinedQueue.filter(q => q.action === 'DELETE_TX');
    base = [...pendingDeletes, ...base];
    return base.sort((a,b) => parseDateForSort(b) - parseDateForSort(a) || String(b.id).localeCompare(String(a.id)));
  }, [currentUser, trashCache, syncQueue]);

  // 4. 計算「個人的專屬帳單」
  const myTransactions = useMemo(() => {
    if (!currentUser) return [];
    return (visibleTransactions || []).filter(t => String(t.member).trim() === String(currentUser.name).trim());
  }, [visibleTransactions, currentUser]);

  // 🚀 CRUD 操作邏輯：負責打包資料，並交給 SyncEngine 去排隊上傳
  const handleAdd = async (newTxs) => {
    triggerVibration([20, 40, 20]);
    const baseDate = newTxs[0].date ? newTxs[0].date.replace("T"," ").replace(/-/g,"/") : nowStr();
    const baseTimestamp = Date.now(); const isMulti = newTxs.length > 1; const randomSuffix = () => Math.random().toString(36).substring(2, 8);
    const groupId = isMulti ? `G_${baseTimestamp}_${currentUser.name}_${randomSuffix()}` : ""; const parentDesc = isMulti ? newTxs[0].parentDesc : "";
    const isOfflineOp = !navigator.onLine;
    const completeTxs = newTxs.map((tx, idx) => ({ ...tx, date: baseDate, recorder: currentUser.name, id: `${baseTimestamp + idx}_${currentUser.name}_${randomSuffix()}`, groupId, parentDesc, isOffline: isOfflineOp, action: "ADD" }));
    
    setActiveTab("dashboard"); 
    appendToQueueAndSync(completeTxs);
  };

  const handleUpdateTx = async (updatedTx) => {
    triggerVibration([20, 40, 20]);
    let fd = updatedTx.date; if (fd && fd.includes("T")) fd = fd.replace("T"," ").replace(/-/g,"/").slice(0, 16);
    const payload = { ...updatedTx, date: fd, editHistory: [], isOffline: !navigator.onLine, action: "UPDATE_TX", lastModified: updatedTx.lastModified || 0 };
    delete payload.EditHistory;
    
    setEditingTx(null);
    appendToQueueAndSync([payload]); 
  };

  const handleUpdateGroupParent = async (groupData) => {
    triggerVibration([20, 40, 20]);
    let fd = groupData.date; if (fd && fd.includes("T")) fd = fd.replace("T"," ").replace(/-/g,"/").slice(0, 16);
    const newOpId = Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const newItem = { ...groupData, date: fd, editHistory: [], isOffline: !navigator.onLine, action: "UPDATE_GROUP_PARENT", opId: newOpId };
    delete newItem.EditHistory;
    delete newItem.children;
    
    setEditingGroup(null);
    appendToQueueAndSync([newItem]);
  };

  const handleDeleteTx = async (id) => {
    triggerVibration([30, 50, 30]);
    const txToDelete = (visibleTransactions || []).find(t => String(t.id) === String(id)) || (txCache || []).find(t => String(t.id) === String(id));
    if (!txToDelete) return;
    
    setEditingTx(null);
    appendToQueueAndSync([{ ...txToDelete, isOffline: !navigator.onLine, action: "DELETE_TX", lastModified: txToDelete.lastModified || 0 }]); 
  };

  const handleRestoreTrash = (tx) => { 
    triggerVibration(15); 
    const newOpId = Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    appendToQueueAndSync([{ ...tx, isOffline: !navigator.onLine, action: "RESTORE_TX", opId: newOpId }]); 
    showStatus("success", "🔄 已加入復原排程"); 
  };

  const handleHardDeleteTrash = (tx) => { 
    triggerVibration([30, 50, 30]); 
    const newOpId = Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    setConfirmHardDeleteId(null);
    appendToQueueAndSync([{ ...tx, isOffline: !navigator.onLine, action: "HARD_DELETE_TX", opId: newOpId }]); 
  };

  const handleEmptyTrash = () => { 
    triggerVibration([50, 50, 50]); 
    const ops = visibleTrash.map(tx => ({ ...tx, isOffline: !navigator.onLine, action: "HARD_DELETE_TX", opId: Date.now() + '_' + Math.random().toString(36).substring(2, 9) }));
    setShowConfirmEmptyTrash(false); 
    setShowTrashModal(false); 
    appendToQueueAndSync(ops); 
    showStatus("success", "🗑️ 已清空資源回收桶"); 
  };

  return {
    pendingMap,
    visibleTransactions,
    visibleTrash,
    myTransactions,
    handleAdd,
    handleUpdateTx,
    handleUpdateGroupParent,
    handleDeleteTx,
    handleRestoreTrash,
    handleHardDeleteTrash,
    handleEmptyTrash
  };
};