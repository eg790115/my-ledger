// src/hooks/useAuth.js
import { useState, useEffect, useCallback } from 'react';
import { 
  clearDeviceToken, deviceValid, verifyPinOnline, saveLocalPinHash, 
  unlockWithPinLocal, getBioKey, isDeviceBioBound, getBioFailCount, 
  setBioFailCount, getBioLockedUntil, setBioLockedUntil, clearBioFail 
} from '../utils/api';

export const useAuth = ({ isOnline, showStatus, setLoadingCard, triggerVibration }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectingUser, setSelectingUser] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [fallbackToPin, setFallbackToPin] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showBootstrapModal, setShowBootstrapModal] = useState(false);
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [showUnbindModal, setShowUnbindModal] = useState(false);
  const [unbindPin, setUnbindPin] = useState("");
  const [showChangePinModal, setShowChangePinModal] = useState(false);

  // 🚀 強制登出並要求重新綁定
  const forceReloginForToken = useCallback(() => {
    clearDeviceToken(); 
    setCurrentUser(null); 
    setSelectingUser(null); 
    setPinInput(""); 
    setBootstrapSecret(""); 
    setShowBootstrapModal(true);
  }, []);

  // 檢查裝置是否支援生物辨識
  useEffect(() => { 
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(v => setBiometricAvailable(v)); 
    }
  }, []);

  // 檢查連線狀態與憑證
  useEffect(() => { 
    if (isOnline && !deviceValid() && !currentUser) { 
      setShowBootstrapModal(true); 
      setBootstrapSecret(""); 
    } 
  }, [isOnline, currentUser]);

  // 🚀 密碼驗證引擎 (優先本地 Hash 秒解鎖)
  useEffect(() => {
    if (pinInput.length === 6 && selectingUser) {
      const verifyEnteredPin = async () => {
        const n = pinInput;
        try {
          const localUnlock = await unlockWithPinLocal(selectingUser.name, n);
          if (localUnlock) {
            setCurrentUser(selectingUser); setSelectingUser(null); setPinInput(""); setFallbackToPin(false); triggerVibration([20, 50, 20]); showStatus("success", "✅ 登入成功");
            return; 
          }

          if (isOnline) {
            if (!deviceValid()) { showStatus("error", "雲端尚未綁定，請先輸入雲端密碼"); setShowBootstrapModal(true); setPinInput(""); return; }
            setLoadingCard({ show:true, text:"正在連線雲端驗證..." });
            await verifyPinOnline(selectingUser.name, n);
            await saveLocalPinHash(selectingUser.name, n); 
            setLoadingCard({ show:false, text:"" });
            setCurrentUser(selectingUser); setSelectingUser(null); setPinInput(""); setFallbackToPin(false); triggerVibration([20, 50, 20]); showStatus("success", "✅ 登入成功");
          } else {
            showStatus("error", "PIN 錯誤，或您尚未在有網路時登入過"); setPinInput(""); return;
          }
        } catch (e) {
          setLoadingCard({ show:false, text:"" });
          const msg = e.message || String(e);
          if (msg.includes("憑證") || msg.includes("過期")) { showStatus("error", "❌ 雲端憑證無效，請重新綁定"); forceReloginForToken(); } else { showStatus("error", msg); setPinInput(""); }
        }
      };
      verifyEnteredPin();
    }
  }, [pinInput, selectingUser, isOnline, forceReloginForToken, showStatus, setLoadingCard, triggerVibration]);

  // 🚀 本地生物辨識驗證引擎
  const handleBioLoginLocal = async (name) => {
    const lockedUntil = getBioLockedUntil(name);
    if (lockedUntil && Date.now() < lockedUntil) { showStatus("error", `請稍候 ${Math.ceil((lockedUntil - Date.now())/1000)}s 再試`); return false; }
    try {
      const base64Id = localStorage.getItem(getBioKey(name)); if (!base64Id) { showStatus("error","設備未綁定"); return false; }
      const idStr = atob(base64Id); const idArray = new Uint8Array(idStr.length);
      for (let i=0; i<idStr.length; i++) idArray[i] = idStr.charCodeAt(i);
      const challenge = new Uint8Array(32); window.crypto.getRandomValues(challenge);
      await navigator.credentials.get({ publicKey: { challenge, allowCredentials: [{ type:"public-key", id:idArray }], userVerification: "required" } });
      clearBioFail(name); return true;
    } catch (e) {
      const fail = getBioFailCount(name) + 1; setBioFailCount(name, fail); const left = Math.max(0, 5 - fail);
      if (left <= 0) { setBioLockedUntil(name, Date.now() + 30000); showStatus("error", `驗證失敗，已暫停 30 秒`); }
      else { setBioLockedUntil(name, Date.now() + 30000); showStatus("error", `驗證失敗，剩餘 ${left} 次`); }
      return false;
    }
  };

  // 點擊使用者頭像邏輯
  const handleUserClick = async (user) => {
    triggerVibration(15); setSelectingUser(user); setPinInput(""); setFallbackToPin(false);
    if (biometricAvailable && isDeviceBioBound(user.name)) {
      const ok = await handleBioLoginLocal(user.name);
      if (ok) { triggerVibration([20, 50, 20]); showStatus("success", "✅ 登入成功"); setCurrentUser(user); setSelectingUser(null); setPinInput(""); }
      else { setFallbackToPin(true); }
    }
  };

  // 綁定生物辨識
  const bindDeviceBio = async () => {
    if (!window.PublicKeyCredential) { showStatus("error","不支援生物辨識"); return; }
    try {
      setLoadingCard({ show:true, text:"正在綁定設備..." });
      const challenge = new Uint8Array(32); crypto.getRandomValues(challenge);
      const userID = new Uint8Array(16); crypto.getRandomValues(userID);
      const cred = await navigator.credentials.create({ publicKey: { challenge, rp: { name:"家庭記帳" }, user: { id:userID, name: currentUser.name, displayName: currentUser.name }, pubKeyCredParams: [{ type:"public-key", alg:-7 }, { type:"public-key", alg:-257 }], authenticatorSelection: { authenticatorAttachment:"platform", userVerification:"required" }, timeout: 60000 } });
      localStorage.setItem(getBioKey(currentUser.name), btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(cred.rawId)))));
      clearBioFail(currentUser.name); showStatus("success","✅ 設備已綁定");
    } catch { showStatus("error","綁定失敗或已取消"); }
    finally { setLoadingCard({ show:false, text:"" }); }
  };

  // 解除綁定生物辨識
  const unbindDeviceBio = async () => {
    if (unbindPin.length !== 6) { showStatus("error","請輸入 6 位 PIN"); return; }
    if (!isOnline) { showStatus("error","需連線驗證 PIN 才能解除"); return; }
    if (!deviceValid()) { showStatus("error","雲端憑證已過期，請先綁定雲端"); return; }
    try {
      setLoadingCard({ show:true, text:"正在驗證..." });
      await verifyPinOnline(currentUser.name, unbindPin);
      localStorage.removeItem(getBioKey(currentUser.name)); clearBioFail(currentUser.name);
      setShowUnbindModal(false); setUnbindPin(""); showStatus("success","✅ 已解除綁定");
    } catch (e) {
      setLoadingCard({ show:false, text:"" }); const msg = e.message || "PIN 錯誤";
      if (msg.includes("憑證") || msg.includes("過期")) { showStatus("error", "❌ 雲端憑證無效，請重新綁定"); forceReloginForToken(); } else { showStatus("error", msg); }
    } finally { setLoadingCard({ show:false, text:"" }); }
  };

  return {
    currentUser, setCurrentUser,
    selectingUser, setSelectingUser,
    pinInput, setPinInput,
    fallbackToPin, setFallbackToPin,
    biometricAvailable,
    showBootstrapModal, setShowBootstrapModal,
    bootstrapSecret, setBootstrapSecret,
    showUnbindModal, setShowUnbindModal,
    unbindPin, setUnbindPin,
    showChangePinModal, setShowChangePinModal,
    forceReloginForToken,
    handleBioLoginLocal,
    handleUserClick,
    bindDeviceBio,
    unbindDeviceBio,
    bioBound: currentUser ? isDeviceBioBound(currentUser.name) : false
  };
};