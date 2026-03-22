import { useMemo } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { parseDateForSort, nowStr } from '../utils/helpers';

export const useTransactions = ({
  currentUser, txCache, trashCache, triggerVibration, showStatus,
  setActiveTab, setEditingTx, setEditingGroup, setConfirmHardDeleteId,
  setShowConfirmEmptyTrash, setShowTrashModal
}) => {
  const visibleTransactions = useMemo(() => txCache || [], [txCache]);
  const visibleTrash = useMemo(() => trashCache || [], [trashCache]);
  const myTransactions = useMemo(() => {
    if (!currentUser?.name) return [];
    return visibleTransactions.filter(t => String(t.member).trim() === String(currentUser.name).trim());
  }, [visibleTransactions, currentUser?.name]);

  // 🚀 核心寫入引擎：直連 Firebase
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
      if (showStatus) showStatus("error", "目前離線，資料將於連線後自動同步");
    }
  };

  const handleAdd = (newTx) => {
    if (triggerVibration) triggerVibration(10);
    const finalTx = {
      ...newTx,
      id: newTx.id || `${Date.now()}_${newTx.member}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: parseDateForSort(newTx),
      lastModified: Date.now(),
      editHistory: []
    };
    if (setActiveTab) setActiveTab("dashboard");
    firestoreBatch([{ collection: 'transactions', id: finalTx.id, type: 'set', data: finalTx }]);
    if (showStatus) showStatus("success", "✅ 新增成功");
  };

  const handleUpdateTx = (tx) => {
    if (triggerVibration) triggerVibration(10);
    const oldTx = visibleTransactions.find(t => t.id === tx.id);
    const safeName = currentUser?.name || "未知";
    let finalTx = { ...tx, lastModified: Date.now() };

    if (oldTx) {
      const snapshot = {
        "金額": oldTx.amount, "類別": oldTx.category, "日期": oldTx.date,
        "成員": oldTx.member, "對象": oldTx.beneficiary, "備註": oldTx.desc || ""
      };
      const newHistory = [...(oldTx.editHistory || [])];
      newHistory.push({ time: nowStr(), recorder: safeName, snapshot });
      finalTx.editHistory = newHistory;
    }

    if (setEditingTx) setEditingTx(null);
    firestoreBatch([{ collection: 'transactions', id: finalTx.id, type: 'set', data: finalTx }]);
    if (showStatus) showStatus("success", "✅ 修改成功");
  };

  const handleUpdateGroupParent = (updatedGroup) => {
    if (triggerVibration) triggerVibration(10);
    const children = visibleTransactions.filter(t => t.groupId === updatedGroup.groupId);
    const ops = children.map(child => ({
      collection: 'transactions', id: child.id, type: 'set',
      data: { ...child, parentTitle: updatedGroup.parentTitle, parentDesc: updatedGroup.parentDesc, lastModified: Date.now() }
    }));
    if (setEditingGroup) setEditingGroup(null);
    firestoreBatch(ops);
    if (showStatus) showStatus("success", "✅ 群組修改成功");
  };

  const handleDeleteTx = (txToDelete) => {
    if (triggerVibration) triggerVibration(20);
    if (setEditingTx) setEditingTx(null);
    firestoreBatch([
      { collection: 'transactions', id: txToDelete.id, type: 'delete' },
      { collection: 'trash', id: txToDelete.id, type: 'set', data: { ...txToDelete, lastModified: Date.now() } }
    ]);
    if (showStatus) showStatus("success", "🗑️ 已移至垃圾桶");
  };

  const handleRestoreTrash = (tx) => {
    if (triggerVibration) triggerVibration(15);
    firestoreBatch([
      { collection: 'trash', id: tx.id, type: 'delete' },
      { collection: 'transactions', id: tx.id, type: 'set', data: { ...tx, lastModified: Date.now() } }
    ]);
    if (showStatus) showStatus("success", "✅ 已成功復原");
  };

  const handleHardDeleteTrash = (tx) => {
    if (triggerVibration) triggerVibration([30, 50, 30]);
    if (setConfirmHardDeleteId) setConfirmHardDeleteId(null);
    firestoreBatch([{ collection: 'trash', id: tx.id, type: 'delete' }]);
    if (showStatus) showStatus("success", "🔥 已永久刪除");
  };

  const handleEmptyTrash = () => {
    if (triggerVibration) triggerVibration([50, 50, 50]);
    const ops = visibleTrash.map(tx => ({ collection: 'trash', id: tx.id, type: 'delete' }));
    firestoreBatch(ops);
    if (setShowConfirmEmptyTrash) setShowConfirmEmptyTrash(false);
    if (setShowTrashModal) setShowTrashModal(false);
    if (showStatus) showStatus("success", "🔥 資源回收桶已清空");
  };

  return {
    pendingMap: {}, // 🛡️ 徹底廢除待辦地圖，強制空物件不當機
    visibleTransactions, visibleTrash, myTransactions,
    handleAdd, handleUpdateTx, handleUpdateGroupParent, handleDeleteTx,
    handleRestoreTrash, handleHardDeleteTrash, handleEmptyTrash
  };
};