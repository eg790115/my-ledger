import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../utils/firebase';

export const useSyncEngine = ({ currentUser }) => {
  const [txCache, setTxCache] = useState([]);
  const [trashCache, setTrashCache] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const userName = currentUser?.name;

  useEffect(() => {
    if (!userName) {
      setTxCache([]);
      setTrashCache([]);
      return;
    }

    setIsSyncing(true);
    let allTxs = { "爸爸": [], "媽媽": [] };

    const mergeAndSet = () => {
      const merged = [...allTxs["爸爸"], ...allTxs["媽媽"]];
      merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || String(b.id).localeCompare(String(a.id)));
      setTxCache(merged);
    };

    const unsubDad = onSnapshot(query(collection(db, "transactions_爸爸")), (snapshot) => {
      allTxs["爸爸"] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      mergeAndSet();
      setIsSyncing(false);
    });

    const unsubMom = onSnapshot(query(collection(db, "transactions_媽媽")), (snapshot) => {
      allTxs["媽媽"] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      mergeAndSet();
    });

    // 🎯 關鍵修正：監聽「個人化」回收桶
    const unsubTrash = onSnapshot(query(collection(db, `trash_${userName}`)), (snapshot) => {
      setTrashCache(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubDad();
      unsubMom();
      unsubTrash();
    };
  }, [userName]);

  return { txCache, trashCache, isSyncing };
};