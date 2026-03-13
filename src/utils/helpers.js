import { DB_NAME, DB_VERSION, STORE_NAME } from './constants.js';

export function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject("IndexedDB Error");
    req.onsuccess = (e) => resolve(e.target.result);
    req.onupgradeneeded = (e) => {
      if (!e.target.result.objectStoreNames.contains(STORE_NAME)) {
        e.target.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

export async function saveToIndexedDB(data) {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      (data || []).filter(i => i && i.id).forEach(i => store.put(i));
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch (e) {}
}

export async function loadFromIndexedDB() {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = reject;
    });
  } catch (e) {
    return [];
  }
}

export const getParentCat = c => {
  if (!c) return "其他";
  if (String(c).includes('/')) return String(c).split('/')[0];
  return { "餐飲": "食", "交通": "行", "購物": "衣", "住": "居家", "水電": "居家", "育": "教育", "樂": "娛樂", "薪資": "收入", "投資": "理財", "雜項": "其他" }[c] || "其他";
};

export const getChildCat = c => String(c).includes('/') ? String(c).substring(String(c).indexOf('/') + 1) : c;

export const getBenArray = (b, m) => {
  if (!b) return [];
  const a = Array.from(new Set(String(b).split(",").filter(Boolean).map(s => s.trim())));
  let f = a;
  if (a.includes("爸爸") && a.includes("媽媽") && a.includes("兒子")) f = ["全家", ...a.filter(x => x !== "爸爸" && x !== "媽媽" && x !== "兒子")];
  if (f.length === 1 && f[0] === m) return [];
  return f;
};

export const getBenBadgeStyle = n => {
  if (n === "全家") return "bg-orange-100 text-orange-700 border-orange-200";
  if (n === "爸爸") return "bg-blue-50 text-blue-600 border-blue-200";
  if (n === "媽媽") return "bg-pink-50 text-pink-600 border-pink-200";
  if (n === "兒子") return "bg-amber-50 text-amber-600 border-amber-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
};

export const safeParse = (r, f) => {
  if (r === null || r === "null" || r === "undefined") return f;
  try { const p = JSON.parse(r); return p !== null ? p : f; } catch { return f; }
};

export const safeArrayLS = k => {
  const v = safeParse(localStorage.getItem(k), []);
  return Array.isArray(v) ? v : [];
};

export const safeStringLS = (k, f = "") => {
  const v = localStorage.getItem(k);
  return (v === null || v === "null" || v === "undefined") ? f : v;
};

export const safeNumberLS = (k, f = 0) => {
  const v = Number(localStorage.getItem(k));
  return Number.isFinite(v) ? v : f;
};

export const nowStr = () => {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const displayDateClean = (val) => {
  if (!val) return "";
  let str = String(val).replace(/上午|下午|AM|PM/gi, "").trim().replace(/-/g, "/").replace("T", " ");
  const parts = str.split(" ");
  return parts.length > 1 ? `${parts[0]} ${parts[1].split(":").slice(0, 2).join(":")}` : str;
};

export const formatDateOnly = ts => {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

export const parseDateForSort = i => {
  if (!i || !i.date) return 0;
  return new Date(String(i.date).replace(/上午|下午|AM|PM/gi, "").trim().replace(/-/g, "/").replace("T", " ")).getTime() || 0;
};

export const getCycleRange = (td, sd, om = 0) => {
  let d = new Date(td), cm = d.getMonth(), cy = d.getFullYear(), bm = cm;
  if (d.getDate() < sd) bm -= 1;
  bm += om;
  return {
    start: new Date(cy, bm, sd, 0, 0, 0, 0).getTime(),
    end: new Date(cy, bm + 1, sd - 1, 23, 59, 59, 999).getTime()
  };
};

export const safeEvaluateMath = (expr) => {
  if (!expr) return "";
  const str = String(expr).trim();
  if (/[\+\-\*\/]/.test(str)) {
    try {
      const sanitized = str.replace(/[^\d.\+\-\*\/\(\)]/g, '').replace(/[\+\-\*\/]+$/, '');
      const result = new Function(`'use strict'; return (${sanitized})`)();
      return isFinite(result) ? String(Math.round(result)) : str;
    } catch { return str; }
  }
  return str.replace(/[^\d.]/g, '');
};

export async function sha256Base64(str) {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}