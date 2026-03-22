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
      if (showStatus) showStatus("error", "寫入失敗");
    }
  };

  const handleAdd = (newTxPayload) => {
    if (triggerVibration) triggerVibration(10);
    const safeName = stateRef.current.currentUser?.name || "未知";
    const txsToAdd = Array.isArray(newTxPayload) ? newTxPayload : [newTxPayload];
    const batchOps = [];

    txsToAdd.forEach(newTx => {
      if (typeof newTx !== 'object' || newTx === null) return;

      // 🚀 核心修正 1：深拷貝物件，徹底切斷與其他明細的記憶體連動
      const item = JSON.parse(JSON.stringify(newTx));

      let txDate = nowStr();
      if (item.date && String(item.date).trim() !== "") txDate = String(item.date).replace('T', ' ');
      let txTimestamp = Date.now();
      try {
         const parsed = new Date(txDate).getTime();
         if (!isNaN(parsed) && parsed > 0) txTimestamp = parsed;
      } catch(e) {}

      const txId = item.id || `T_${txTimestamp}_${safeName}_${Math.random().toString(36).substring(2, 7)}`;
      const finalTx = {
        ...item, id: txId, date: txDate, timestamp: txTimestamp,
        member: item.member || safeName, recorder: safeName, beneficiary: item.beneficiary || safeName,
        type: item.type || "expense", category: item.category || "其他/雜項",
        amount: Number(item.amount) || 0, desc: item.desc || "",
        lastModified: Date.now(), editHistory: []
      };

      Object.keys(finalTx).forEach(k => { if (!isNaN(k)) delete finalTx[k]; });

      // 1. 寫入「帳本主人」家
      batchOps.push({ collection: `transactions_${finalTx.member}`, id: finalTx.id, type: 'set', data: finalTx });
      
      // 2. 如果是代記，也在記錄者家存一份（確保多筆紀錄在記錄者這邊是完整的）
      if (finalTx.member !== safeName) {
        batchOps.push({ collection: `transactions_${safeName}`, id: finalTx.id, type: 'set', data: finalTx });
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
    
    // 🚀 核心修正 2：同樣進行深拷貝，避免修改 A 影響 B
    const tx = JSON.parse(JSON.stringify(updatedTx));
    const oldTx = txCache.find(t => t.id === tx.id);

    let txDate = tx.date ? String(tx.date).replace('T', ' ') : nowStr();
    let txTimestamp = Date.now();
    try {
       const parsed = new Date(txDate).getTime();
       if (!isNaN(parsed) && parsed > 0) txTimestamp = parsed;
    } catch(e) {}

    let finalTx = { ...tx, date: txDate, timestamp: txTimestamp, amount: Number(tx.amount) || 0, lastModified: Date.now() };

    const batchOps = [];

    if (oldTx) {
      // 如果修改了帳本主人 (member)，要把舊人家的資料刪掉
      if (oldTx.member !== finalTx.member) {
        batchOps.push({ collection: `transactions_${oldTx.member}`, id: finalTx.id, type: 'delete' });
      }
      
      // 如果記錄者家裡有這筆（代記），且這次修改把 member 改回自己了，要把記錄者家以外的備份刪除
      // (這部分邏輯較複雜，統一採「更新目前所在帳本」最安全)
      
      const snapshot = { "金額": oldTx.amount, "類別": oldTx.category, "日期": oldTx.date, "成員": oldTx.member, "對象": oldTx.beneficiary, "備註": oldTx.desc || "" };
      const newHistory = [...(oldTx.editHistory || [])];
      newHistory.push({ time: nowStr(), recorder: safeName, snapshot });
      finalTx.editHistory = newHistory;
    }
    
    // 🎯 關鍵：只更新「當前登入者帳本」裡的這一筆，絕對不連動其他資料
    batchOps.push({ collection: `transactions_${safeName}`, id: finalTx.id, type: 'set', data: finalTx });

    // 如果 member 不是自己（代記），同步更新主人家
    if (finalTx.member !== safeName) {
      batchOps.push({ collection: `transactions_${finalTx.member}`, id: finalTx.id, type: 'set', data: finalTx });
    }
    
    if (setEditingTx) setEditingTx(null);
    firestoreBatch(batchOps);
    if (showStatus) showStatus("success", "✅ 修改成功");
  };

  const handleUpdateGroupParent = (updatedGroup) => {
    if (triggerVibration) triggerVibration(10);
    const safeName = stateRef.current.currentUser?.name || "未知";
    const children = stateRef.current.txCache.filter(t => t.groupId === updatedGroup.groupId);
    const ops = [];

    children.forEach(child => {
      const updatedChild = { 
        ...child, 
        parentTitle: updatedGroup.parentTitle, 
        parentDesc: updatedGroup.parentDesc, 
        lastModified: Date.now() 
      };
      ops.push({ collection: `transactions_${safeName}`, id: child.id, type: 'set', data: updatedChild });
      if (child.member !== safeName) {
        ops.push({ collection: `transactions_${child.member}`, id: child.id, type: 'set', data: updatedChild });
      }
    });

    if (setEditingGroup) setEditingGroup(null);
    firestoreBatch(ops);
    if (showStatus) showStatus("success", "✅ 群組修改成功");
  };

  const handleDeleteTx = (txToDelete) => {
    if (triggerVibration) triggerVibration(20);
    const safeName = stateRef.current.currentUser?.name || "未知";
    let txObj = typeof txToDelete === 'string' ? stateRef.current.txCache.find(t => t.id === txToDelete) : txToDelete;

    if (!txObj || !txObj.id) return;

    const ops = [
      { collection: `transactions_${safeName}`, id: txObj.id, type: 'delete' },
      { collection: `trash_${safeName}`, id: txObj.id, type: 'set', data: { ...txObj, lastModified: Date.now() } }
    ];

    if (txObj.member !== safeName) {
      ops.push({ collection: `transactions_${txObj.member}`, id: txObj.id, type: 'delete' });
    }

    firestoreBatch(ops);
    if (setEditingTx) setEditingTx(null);
    if (showStatus) showStatus("success", "🗑️ 已移至回收桶");
  };

  const handleRestoreTrash = (tx) => {
    if (triggerVibration) triggerVibration(15);
    const safeName = stateRef.current.currentUser?.name || "未知";
    firestoreBatch([
      { collection: `trash_${safeName}`, id: tx.id, type: 'delete' },
      { collection: `transactions_${safeName}`, id: tx.id, type: 'set', data: { ...tx, lastModified: Date.now() } }
    ]);
    if (tx.member !== safeName) {
      firestoreBatch([{ collection: `transactions_${tx.member}`, id: tx.id, type: 'set', data: { ...tx, lastModified: Date.now() } }]);
    }
    if (showStatus) showStatus("success", "✅ 已還原");
  };

  const handleHardDeleteTrash = (tx) => {
    if (triggerVibration) triggerVibration([30, 50, 30]);
    const safeName = stateRef.current.currentUser?.name || "未知";
    firestoreBatch([{ collection: `trash_${safeName}`, id: tx.id, type: 'delete' }]);
    if (setConfirmHardDeleteId) setConfirmHardDeleteId(null);
    if (showStatus) showStatus("success", "🔥 已永久刪除");
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