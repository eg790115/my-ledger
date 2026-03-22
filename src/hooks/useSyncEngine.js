import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../utils/firebase';

export const useSyncEngine = ({ currentUser }) => {
  const [txCache, setTxCache] = useState([]);
  const [trashCache, setTrashCache] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // 🛡️ 防呆：只依賴使用者的名字來決定要不要重新載入，避免無限迴圈
  const userName = currentUser?.name;

  useEffect(() => {
    // 沒登入就清空畫面
    if (!userName) {
      setTxCache([]);
      setTrashCache([]);
      return;
    }

    setIsSyncing(true);

    // 🎧 監聽主帳本
    const unsubTx = onSnapshot(query(collection(db, "transactions")), (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      txs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || String(b.id).localeCompare(String(a.id)));
      setTxCache(txs);
      setIsSyncing(false);
    }, (err) => {
      console.error("主帳本讀取失敗:", err);
      setIsSyncing(false);
    });

    // 🎧 監聽垃圾桶
    const unsubTrash = onSnapshot(query(collection(db, "trash")), (snapshot) => {
      const trashTxs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      trashTxs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || String(b.id).localeCompare(String(a.id)));
      setTrashCache(trashTxs);
    }, (err) => console.error("垃圾桶讀取失敗:", err));

    return () => {
      unsubTx();
      unsubTrash();
    };
  }, [userName]);

  // 🛡️ 防呆：給予安全的預設空陣列，保護舊 UI 不當機
  return { 
    txCache: txCache || [], 
    trashCache: trashCache || [], 
    isSyncing, 
    syncQueue: [], 
    requestSync: () => {} 
  };
};