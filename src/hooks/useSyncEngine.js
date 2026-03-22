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

    // 用一個物件來暫存兩邊的資料，方便隨時合併
    let allTxs = { "爸爸": [], "媽媽": [] };

    // 🔄 合併並排序資料的函式
    const mergeAndSet = () => {
      const merged = [...allTxs["爸爸"], ...allTxs["媽媽"]];
      
      // 🚀 核心修復：去除重複的 ID (因為多筆明細會雙向寫入，確保畫面上只顯示一筆本尊)
      const uniqueMap = new Map();
      merged.forEach(tx => uniqueMap.set(tx.id, tx));
      const uniqueTxs = Array.from(uniqueMap.values());

      // 依照時間戳記由新到舊排序
      uniqueTxs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || String(b.id).localeCompare(String(a.id)));
      setTxCache(uniqueTxs);
    };

    // 🎧 1. 獨立監聽「爸爸」的帳本
    const unsubDad = onSnapshot(query(collection(db, "transactions_爸爸")), (snapshot) => {
      allTxs["爸爸"] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      mergeAndSet();
      setIsSyncing(false);
    }, (err) => console.error("讀取爸爸帳本失敗:", err));

    // 🎧 2. 獨立監聽「媽媽」的帳本
    const unsubMom = onSnapshot(query(collection(db, "transactions_媽媽")), (snapshot) => {
      allTxs["媽媽"] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      mergeAndSet();
    }, (err) => console.error("讀取媽媽帳本失敗:", err));

    // 🎧 3. 監聽個人的「垃圾桶」(修正為個人專屬回收桶)
    const unsubTrash = onSnapshot(query(collection(db, `trash_${userName}`)), (snapshot) => {
      setTrashCache(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 🧹 卸載組件時清除所有監聽器
    return () => {
      unsubDad();
      unsubMom();
      unsubTrash();
    };
  }, [userName]);

  return { txCache, trashCache, isSyncing };
};