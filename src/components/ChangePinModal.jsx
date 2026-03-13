import React, { useState } from 'react';
import { SvgIcon } from './Icons';
import { getDeviceToken, deviceValid, verifyPinOnline, postGAS } from '../utils/api';
import { LS } from '../utils/constants';

export const ChangePinModal = ({ currentUser, onCancel, onSuccess, forceReloginForToken }) => {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async () => {
    if (!navigator.onLine) { setErrorMsg("需連線才能更換密碼"); return; }
    if (!deviceValid()) { setErrorMsg("雲端憑證已過期，請先綁定雲端"); return; }
    if (oldPin.length !== 6 || newPin.length !== 6 || newPin2.length !== 6) { setErrorMsg("請輸入完整的 6 位 PIN 碼"); return; }
    if (newPin !== newPin2) { setErrorMsg("兩次輸入的新密碼不一致"); return; }
    
    setIsSubmitting(true); 
    setErrorMsg("");
    
    try {
      const res = await postGAS({ action: "UPDATE_PIN", name: currentUser.name, oldPin, newPin, deviceToken: getDeviceToken() });
      if (res.result !== "success") throw new Error(res.message || "更新失敗");
      localStorage.removeItem(LS.pinHashPrefix + currentUser.name); 
      onSuccess();
    } catch (e) {
      const msg = e.message || "更新失敗";
      if (msg.includes("憑證") || msg.includes("無效") || msg.includes("過期") || msg.includes("重新綁定")) { 
        forceReloginForToken(); 
      } else { 
        setErrorMsg(msg); 
      }
    } finally { 
      setIsSubmitting(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-[700] bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-8 animate-in text-white">
      <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 text-gray-900 relative">
        <button onClick={onCancel} disabled={isSubmitting} className="absolute top-6 right-6 text-gray-400 active:scale-90 disabled:opacity-30">
          <SvgIcon name="close" size={24} />
        </button>
        <h3 className="font-black text-lg mb-2">更換密碼</h3>
        <p className="text-[11px] text-gray-500 mb-4">需輸入舊 PIN 驗證，成功後會登出請重新登入。</p>
        
        {errorMsg && <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl mb-4 font-bold border border-red-100">{errorMsg}</div>}
        
        <div className="space-y-3 mb-6">
          <input value={oldPin} onChange={e=>setOldPin(e.target.value.replace(/\D/g,"").slice(0,6))} disabled={isSubmitting} type="password" inputMode="numeric" placeholder="舊 PIN（6 位）" className="w-full bg-gray-100 rounded-2xl px-4 py-3 font-black outline-none disabled:opacity-50 text-center tracking-widest" />
          <input value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\D/g,"").slice(0,6))} disabled={isSubmitting} type="password" inputMode="numeric" placeholder="新 PIN（6 位）" className="w-full bg-gray-100 rounded-2xl px-4 py-3 font-black outline-none disabled:opacity-50 text-center tracking-widest" />
          <input value={newPin2} onChange={e=>setNewPin2(e.target.value.replace(/\D/g,"").slice(0,6))} disabled={isSubmitting} type="password" inputMode="numeric" placeholder="再次輸入新 PIN" className="w-full bg-gray-100 rounded-2xl px-4 py-3 font-black outline-none disabled:opacity-50 text-center tracking-widest" />
        </div>
        
        <button onClick={handleSubmit} disabled={isSubmitting} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2 transition-all shadow-md shadow-blue-600/30">
          {isSubmitting ? <SvgIcon name="spinner" size={18} className="animate-spin" /> : null} 
          {isSubmitting ? "更新處理中..." : "確認更換"}
        </button>
      </div>
    </div>
  );
};