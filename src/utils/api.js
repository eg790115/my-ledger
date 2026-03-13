import { LS } from './constants.js';
import { safeStringLS, safeNumberLS, sha256Base64 } from './helpers.js';

export const gasUrl = "https://script.google.com/macros/s/AKfycbxJNnUlFXK8NZ9vaIUvRkq8Njy17P3IlETr_AbkCQhycZ2XUbAnaXvd_7QCT5BQR5zCLA/exec";

export async function postGAS(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
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