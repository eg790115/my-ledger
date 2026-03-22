import { useMemo, useRef, useEffect } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { parseDateForSort, nowStr } from '../utils/helpers';

export const useTransactions = ({
  currentUser, txCache, trashCache, triggerVibration, showStatus,
  setActiveTab, setEditingTx, setEditingGroup, setConfirmHardDeleteId,
  setShowConfirmEmptyTrash, setShowTrashModal
}) => {
  const stateRef = useRef({ currentUser, txCache, trashCache });
  useEffect(() => {
    stateRef.current = { currentUser, txCache, trashCache };
  }, [currentUser, txCache, trashCache]);

  const visibleTransactions = useMemo(() => txCache || [], [txCache]);
  const visibleTrash = useMemo(() => trashCache || [], [trashCache]);
  const myTransactions = useMemo(() => {
    if (!currentUser?.name) return [];
    return visibleTransactions.filter(t => String(t.member).trim() === String(currentUser.name).trim());
  }, [visibleTransactions, currentUser?.name]);

  const firestoreBatch = async (operations) => {
    try {
      const batch = writeBatch(db);
      operations.forEach(op => {
         const ref = doc(db, op.collection, String(op.id));
         if (op.type === 'set') batch.set(ref, op.data, { merge: true });
         if (op.type === 'delete') batch.delete(ref);
      });
      await batch.commit();
    } catch (error) {
      console.error("Firestore 寫入錯誤:", error);
      if (showStatus) showStatus("error", "同步失敗");
    }
  };

  const handleAdd = (newTxPayload) => {
    if (triggerVibration) triggerVibration(10);
    const safeName = stateRef.current.currentUser?.name || "未知";
    const txsToAdd = Array.isArray(newTxPayload) ? newTxPayload : [newTxPayload];
    const batchOps = [];

    const isMultiEntry = txsToAdd.length > 1 || txsToAdd.some(t => t.groupId);

    txsToAdd.forEach(newTx => {
      if (typeof newTx !== 'object' || newTx === null) return;
      const item = JSON.parse(JSON.stringify(newTx));
      let txDate = item.date && String(item.date).trim() !== "" ? String(item.date).replace('T', ' ') : nowStr();
      
      // 🚀 核心修復：優先使用傳入的精確毫秒級時間戳
      let txTimestamp = item.timestamp || Date.now();
      
      if (!item.timestamp) {
          try {
             const parsed = new Date(txDate).getTime();
             if (!isNaN(parsed) && parsed > 0) txTimestamp = parsed;
          } catch(e) {}
      }

      const txId = item.id || `T_${txTimestamp}_${safeName}_${Math.random().toString(36).substring(2, 7)}`;
      const finalTx = {
        ...item, id: txId, date: txDate, timestamp: txTimestamp,
        member: item.member || safeName, recorder: safeName, beneficiary: item.beneficiary || safeName,
        type: item.type || "expense", category: item.category || "其他/雜項",
        amount: Number(item.amount) || 0, desc: item.desc || "",
        lastModified: Date.now(), editHistory: []
      };

      Object.keys(finalTx).forEach(k => { if (!isNaN(k)) delete finalTx[k]; });

      if (isMultiEntry) {
        batchOps.push({ collection: `transactions_爸爸`, id: finalTx.id, type: 'set', data: finalTx });
        batchOps.push({ collection: `transactions_媽媽`, id: finalTx.id, type: 'set', data: finalTx });
      } else {
        batchOps.push({ collection: `transactions_${finalTx.member}`, id: finalTx.id, type: 'set', data: finalTx });
      }
    });

    if (batchOps.length > 0) firestoreBatch(batchOps);
    if (setActiveTab) setActiveTab("dashboard");
    if (showStatus) showStatus("success", "✅ 新增成功");
  };

  const handleUpdateTx = (updatedTx) => {
    if (triggerVibration) triggerVibration(10);
    const { txCache, currentUser } = stateRef.current;
    const safeName = currentUser?.name || "未知";
    
    const tx = JSON.parse(JSON.stringify(updatedTx));
    const oldTx = txCache.find(t => t.id === tx.id);
    const isMultiEntry = !!tx.groupId;

    let txDate = tx.date ? String(tx.date).replace('T', ' ') : nowStr();
    let txTimestamp = Date.now();
    try {
       const parsed = new Date(txDate).getTime();
       if (!isNaN(parsed) && parsed > 0) txTimestamp = parsed;
    } catch(e) {}

    let finalTx = { ...tx, date: txDate, timestamp: txTimestamp, amount: Number(tx.amount) || 0, lastModified: Date.now() };

    const batchOps = [];
    if (oldTx) {
      const snapshot = { "金額": oldTx.amount, "類別": oldTx.category, "日期": oldTx.date, "成員": oldTx.member, "對象": oldTx.beneficiary, "備註": oldTx.desc || "" };
      const newHistory = [...(oldTx.editHistory || [])];
      newHistory.push({ time: nowStr(), recorder: safeName, snapshot });
      finalTx.editHistory = newHistory;
    }

    if (isMultiEntry) {
      batchOps.push({ collection: `transactions_爸爸`, id: finalTx.id, type: 'set', data: finalTx });
      batchOps.push({ collection: `transactions_媽媽`, id: finalTx.id, type: 'set', data: finalTx });
    } else {
      batchOps.push({ collection: `transactions_${finalTx.member}`, id: finalTx.id, type: 'set', data: finalTx });
      if (oldTx && oldTx.member !== finalTx.member) {
        batchOps.push({ collection: `transactions_${oldTx.member}`, id: finalTx.id, type: 'delete' });
      }
    }
    
    if (setEditingTx) setEditingTx(null);
    firestoreBatch(batchOps);
    if (showStatus) showStatus("success", "✅ 帳務已同步更新");
  };

  const handleUpdateGroupParent = (updatedGroup) => {
    if (triggerVibration) triggerVibration(10);
    const children = stateRef.current.txCache.filter(t => t.groupId === updatedGroup.groupId);
    const ops = [];
    children.forEach(child => {
      const updatedChild = { ...child, parentTitle: updatedGroup.parentTitle, parentDesc: updatedGroup.parentDesc, lastModified: Date.now() };
      ops.push({ collection: `transactions_爸爸`, id: child.id, type: 'set', data: updatedChild });
      ops.push({ collection: `transactions_媽媽`, id: child.id, type: 'set', data: updatedChild });
    });
    if (setEditingGroup) setEditingGroup(null);
    firestoreBatch(ops);
    if (showStatus) showStatus("success", "✅ 群組標題已同步");
  };

  const handleDeleteTx = (payload) => {
    if (triggerVibration) triggerVibration(20);
    const safeName = stateRef.current.currentUser?.name || "未知";
    
    let txsToDelete = [];
    if (Array.isArray(payload)) {
      txsToDelete = payload;
    } else {
      let txObj = typeof payload === 'string' ? stateRef.current.txCache.find(t => t.id === payload) : payload;
      if (txObj) txsToDelete.push(txObj);
    }

    if (txsToDelete.length === 0) return;

    const ops = [];
    const deleteBatchId = txsToDelete.length > 1 ? `del_${Date.now()}` : null;

    txsToDelete.forEach(txObj => {
      const isMultiEntry = !!txObj.groupId;
      if (isMultiEntry) {
        ops.push({ collection: `transactions_爸爸`, id: txObj.id, type: 'delete' });
        ops.push({ collection: `transactions_媽媽`, id: txObj.id, type: 'delete' });
      } else {
        ops.push({ collection: `transactions_${txObj.member}`, id: txObj.id, type: 'delete' });
      }
      
      ops.push({ collection: `trash_${safeName}`, id: txObj.id, type: 'set', data: { ...txObj, deleteBatchId, lastModified: Date.now() } });
    });

    firestoreBatch(ops);
    if (setEditingTx) setEditingTx(null);
    if (showStatus) showStatus("success", txsToDelete.length > 1 ? `🗑️ 已將 ${txsToDelete.length} 筆明細移至回收桶` : "🗑️ 帳項已移除");
  };

  const handleRestoreTrash = (payload) => {
    if (triggerVibration) triggerVibration(15);
    const safeName = stateRef.current.currentUser?.name || "未知";
    
    const txsToRestore = Array.isArray(payload) ? payload : [payload];
    const ops = [];

    txsToRestore.forEach(tx => {
      ops.push({ collection: `trash_${safeName}`, id: tx.id, type: 'delete' });
      const isMultiEntry = !!tx.groupId;
      
      const restoredTx = { ...tx, lastModified: Date.now() };
      delete restoredTx.deleteBatchId;

      if (isMultiEntry) {
        ops.push({ collection: `transactions_爸爸`, id: tx.id, type: 'set', data: restoredTx });
        ops.push({ collection: `transactions_媽媽`, id: tx.id, type: 'set', data: restoredTx });
      } else {
        ops.push({ collection: `transactions_${tx.member}`, id: tx.id, type: 'set', data: restoredTx });
      }
    });

    firestoreBatch(ops);
    if (showStatus) showStatus("success", "✅ 已還原至帳本");
  };

  const handleHardDeleteTrash = (payload) => {
    if (triggerVibration) triggerVibration([30, 50, 30]);
    const safeName = stateRef.current.currentUser?.name || "未知";
    const txsToDelete = Array.isArray(payload) ? payload : [payload];
    const ops = [];

    txsToDelete.forEach(tx => {
      ops.push({ collection: `trash_${safeName}`, id: tx.id, type: 'delete' });
    });

    firestoreBatch(ops);
    if (setConfirmHardDeleteId) setConfirmHardDeleteId(null);
    if (showStatus) showStatus("success", "🔥 永久刪除成功");
  };

  const handleEmptyTrash = () => {
    if (triggerVibration) triggerVibration([50, 50, 50]);
    const safeName = stateRef.current.currentUser?.name || "未知";
    const ops = stateRef.current.trashCache.map(tx => ({ collection: `trash_${safeName}`, id: tx.id, type: 'delete' }));
    firestoreBatch(ops);
    if (setShowConfirmEmptyTrash) setShowConfirmEmptyTrash(false);
    if (setShowTrashModal) setShowTrashModal(false);
    if (showStatus) showStatus("success", "🔥 回收桶已清空");
  };

  return {
    pendingMap: {}, visibleTransactions, visibleTrash, myTransactions,
    handleAdd, handleUpdateTx, handleUpdateGroupParent, handleDeleteTx,
    handleRestoreTrash, handleHardDeleteTrash, handleEmptyTrash
  };
};