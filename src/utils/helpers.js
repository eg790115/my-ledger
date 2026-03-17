import { STORE_NAME, LS } from './constants';

export const safeParse = (str, fallback) => { try { return JSON.parse(str) || fallback; } catch { return fallback; } };
export const safeArrayLS = (key) => safeParse(localStorage.getItem(key), []);
export const safeStringLS = (key, fallback) => localStorage.getItem(key) || fallback;
export const safeNumberLS = (key, fallback) => { const v = localStorage.getItem(key); return v ? Number(v) : fallback; };

export const nowStr = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16).replace('T', ' ');
};

export const displayDateClean = (d) => {
  if (!d) return "";
  return String(d).replace(/上午|下午|AM|PM/gi, "").trim().replace(/-/g, "/").replace("T", " ").slice(0, 16);
};

export const formatDateOnly = (d) => {
  if (!d) return "";
  return String(d).replace(/上午|下午|AM|PM/gi, "").trim().replace(/-/g, "/").split(/ |T/)[0];
};

export const parseDateForSort = (tx) => {
  if (tx && tx.timestamp) return tx.timestamp;
  if (tx && tx.date) {
    const cleanStr = String(tx.date).replace(/上午|下午|AM|PM/gi, "").trim().replace(/-/g, "/").replace("T", " ");
    const ts = new Date(cleanStr).getTime();
    if (!isNaN(ts)) return ts;
  }
  return 0;
};

export const getSafeCycleRange = (now, startDay, monthOffset = 0) => {
  const bDay = Number(startDay) || 1;
  let start = new Date(now.getFullYear(), now.getMonth(), bDay, 0, 0, 0);
  if (now.getDate() < bDay) start.setMonth(start.getMonth() - 1);
  start.setMonth(start.getMonth() + monthOffset);
  let end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime() };
};

export const getCycleRange = getSafeCycleRange;

export const safeEvaluateMath = e => {
  if (!e) return "";
  const s = String(e).trim();
  if (/[+\-\*\/]/.test(s)) {
    try {
      const san = s.replace(/[^\d.\+\-\*\/\(\)]/g, '');
      if (!san) return s;
      const c = san.replace(/[+\-\*\/]+$/, '');
      const r = new Function(`'use strict'; return (${c})`)();
      return isFinite(r) ? String(Math.round(r)) : s;
    } catch { return s; }
  }
  return s.replace(/[^\d.]/g, '');
};

export const sha256Base64 = async (message) => {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashString = String.fromCharCode.apply(null, hashArray);
  return btoa(hashString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const initIndexedDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("FamilyLedgerDB", 2);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!db.objectStoreNames.contains("trash_store")) db.createObjectStore("trash_store", { keyPath: "id" });
      if (!db.objectStoreNames.contains("sync_queue")) db.createObjectStore("sync_queue", { keyPath: "opId" });
      if (!db.objectStoreNames.contains("audit_logs")) db.createObjectStore("audit_logs", { keyPath: "txId" });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveToIndexedDB = async (storeName, dataArray) => {
  try {
    const db = await initIndexedDB();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    dataArray.forEach(item => store.put(item));
    return new Promise((resolve) => { tx.oncomplete = () => resolve(true); });
  } catch (e) { return false; }
};

export const loadFromIndexedDB = async (storeName) => {
  try {
    const db = await initIndexedDB();
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  } catch (e) { return []; }
};

export const getParentCat = (cat) => cat ? String(cat).split('/')[0] : '其他';
export const getChildCat = (cat) => {
  if (!cat) return '其他';
  const parts = String(cat).split('/');
  return parts.length > 1 ? parts.slice(1).join('/') : parts[0];
};

// 🌟 修復核心 1：精準還原對象標籤的顯示邏輯
export const getBenArray = (ben, member) => {
  if (!ben) ben = member || "未知";
  let arr = String(ben).split(",").map(s => s.trim()).filter(Boolean);
  
  // 規則 A：若只有自己一人，隱藏標籤 (回傳空陣列)
  if (arr.length === 1 && arr[0] === member) {
    return [];
  }
  
  // 規則 B：若同時包含一家三口，自動轉換為單一「全家」標籤
  if (arr.includes("爸爸") && (arr.includes("媽媽") || arr.includes("妈妈")) && arr.includes("兒子")) {
    return ["全家"];
  }
  
  return arr;
};

// 🌟 修復核心 2：為兒子與全家補上專屬的色彩辨識
export const getBenBadgeStyle = (b) => {
  if (b === "爸爸") return "bg-blue-50 text-blue-600 border-blue-200";
  if (b === "媽媽" || b === "妈妈") return "bg-pink-50 text-pink-600 border-pink-200";
  if (b === "兒子") return "bg-yellow-50 text-yellow-600 border-yellow-200";
  if (b === "全家" || b === "家庭") return "bg-green-50 text-green-600 border-green-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
};