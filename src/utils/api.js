import { LS } from './constants.js';
import { safeStringLS, safeNumberLS, sha256Base64 } from './helpers.js';

export const gasUrl = "https://script.google.com/macros/s/AKfycbxO6JfC9YkWsRAdP3OSN4J0dC0eqyeYp9gQxHfIaKCoq3MxK26Ihy0Yz5EfDbG6x8U8nA/exec";

export async function postGAS(payload) {
  const controller = new AbortController();
  // 🚀 核心修復：將超時限制從 15 秒大幅放寬至 60 秒 (60000ms)，確保初次全量下載不會被中斷
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    return await res.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error("網路連線超時");
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const getDeviceToken = () => safeStringLS(LS.deviceToken, "");
export const getDeviceExp = () => safeNumberLS(LS.deviceExp, 0);
export const deviceValid = () => !!(getDeviceToken() && getDeviceExp() && Date.now() < getDeviceExp());

export const setDeviceToken = (t, e) => {
  localStorage.setItem(LS.deviceToken, t);
  localStorage.setItem(LS.deviceExp, String(e));
};

export const clearDeviceToken = () => {
  localStorage.removeItem(LS.deviceToken);
  localStorage.removeItem(LS.deviceExp);
};

export const getBioKey = n => `${LS.bioCredPrefix}${n}`;
export const isDeviceBioBound = n => !!localStorage.getItem(getBioKey(n));
export const getBioFailKey = n => `${LS.bioFailPrefix}${n}`;
export const getBioLockKey = n => `${LS.bioLockPrefix}${n}`;
export const getBioFailCount = n => safeNumberLS(getBioFailKey(n), 0);
export const setBioFailCount = (n, v) => localStorage.setItem(getBioFailKey(n), String(v));
export const getBioLockedUntil = n => safeNumberLS(getBioLockKey(n), 0);
export const setBioLockedUntil = (n, v) => localStorage.setItem(getBioLockKey(n), String(v));

export const clearBioFail = n => {
  setBioFailCount(n, 0);
  setBioLockedUntil(n, 0);
};

export const verifyPinOnline = async (name, pin) => {
  const res = await postGAS({ action: "VERIFY_PIN", name, pin, deviceToken: getDeviceToken() });
  if (res.result !== "success") throw new Error(res.message || "PIN 錯誤");
  return true;
};

export const saveLocalPinHash = async (name, pin) => {
  const h = await sha256Base64(`${name}::${pin}::local`);
  localStorage.setItem(LS.pinHashPrefix + name, h);
};

export const unlockWithPinLocal = async (name, pin) => {
  const stored = localStorage.getItem(LS.pinHashPrefix + name);
  if (!stored) return false;
  const h = await sha256Base64(`${name}::${pin}::local`);
  return h === stored;
};

// 🌟 專屬送貨員：向雲端請求「冷資料明細」
export const getLazyTxOnline = async (month) => {
  const data = await postGAS({ action: "GET_LAZY_TX", month: month, deviceToken: getDeviceToken() });
  if (data.result !== "success") throw new Error(data.message || "讀取舊帳本失敗");
  return data.lazyTransactions || [];
};