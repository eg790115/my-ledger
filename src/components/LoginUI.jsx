// src/components/LoginUI.jsx
import React from 'react';
import { SvgIcon } from './Icons';
import { APP_VERSION } from '../utils/constants';
import { isDeviceBioBound } from '../utils/api';

const LoginUI = ({
  selectingUser, setSelectingUser, familyConfig, handleUserClick,
  syncQueue, setShowClearQueueModal, triggerVibration, setShowClearCacheModal,
  fallbackToPin, setFallbackToPin, handleBioLoginLocal, showStatus,
  setCurrentUser, pinInput, setPinInput
}) => {
  return (
    <>
      {!selectingUser ? (
        <>
          <div className="mb-12 text-white animate-in">
            <div className="bg-blue-600 w-20 h-20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/30 text-white"><SvgIcon name="wallet" size={36} /></div>
            <h1 className="text-4xl font-black italic tracking-tighter">家庭記帳</h1>
            <p className="text-gray-500 text-[10px] font-mono mt-4 opacity-50 uppercase tracking-[0.3em]">v{APP_VERSION}</p>
          </div>
          <div className="grid grid-cols-1 gap-6 w-full max-w-xs text-white animate-in">
            {(familyConfig || []).map(user => ( <button key={user.name} onClick={() => handleUserClick(user)} className={`bg-${user.color ? user.color.replace('bg-', '') : (user.name==="媽媽"?"pink-600":"blue-600")} py-6 rounded-[2.5rem] font-black text-2xl shadow-lg border-4 border-white/5 active:scale-95 transition-all text-white`}>{user.name}</button> ))}
          </div>
          {syncQueue && syncQueue.length > 0 && ( <button onClick={() => { triggerVibration([50, 50]); setShowClearQueueModal(true); }} className="mt-10 px-4 py-2 bg-red-500/20 text-red-400 rounded-full text-xs font-bold border border-red-500/30 active:scale-95 transition-all">⚠️ 發現同步卡死？點此強制清除暫存</button> )}
          <button onClick={() => { triggerVibration(10); setShowClearCacheModal(true); }} className="mt-6 px-4 py-2 text-gray-500 rounded-full text-xs font-bold active:scale-95 transition-all underline underline-offset-4">🛠️ 系統深度清理</button>
        </>
      ) : (
        <div className="w-full max-w-sm animate-in text-white text-center font-black">
          <div className="bg-gray-800 rounded-[2.5rem] p-8 shadow-2xl border border-white/10 relative">
            <div className={`bg-${selectingUser.color ? selectingUser.color.replace('bg-', '') : (selectingUser.name==="媽媽"?"pink-600":"blue-600")} w-16 h-16 mx-auto rounded-[1.5rem] flex items-center justify-center text-white font-black text-2xl shadow-lg mb-4`}>{selectingUser.name.charAt(0)}</div>
            <p className="font-black text-3xl mb-1 tracking-tight text-white">{selectingUser.name}</p>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest opacity-80 mb-8">{isDeviceBioBound(selectingUser.name) && !fallbackToPin ? "請進行生物辨識解鎖" : "輸入 6 位 PIN 解鎖"}</p>

            {isDeviceBioBound(selectingUser.name) && !fallbackToPin ? (
              <div className="flex flex-col items-center mb-8 animate-in">
                <button onClick={async () => { triggerVibration(15); const ok = await handleBioLoginLocal(selectingUser.name); if (ok) { triggerVibration([20, 50, 20]); showStatus("success", "✅ 登入成功"); setCurrentUser(selectingUser); setSelectingUser(null); setPinInput(""); } else { setFallbackToPin(true); } }} className="w-20 h-20 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center border-2 border-blue-500/50 mb-6 active:scale-95 transition-transform"><SvgIcon name="bio" size={36} /></button>
                <button onClick={() => { triggerVibration(10); setFallbackToPin(true); }} className="text-[11px] text-gray-400 underline underline-offset-4 font-bold active:text-white transition-colors">無法辨識？改用 PIN 碼登入</button>
              </div>
            ) : (
              <>
                <div className="flex justify-center gap-3 mb-10">{[...Array(6)].map((_, i) => <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 border-blue-500 transition-all duration-200 ${pinInput.length > i ? "bg-blue-500 scale-125 shadow-[0_0_12px_#3b82f6]" : "bg-transparent"}`}></div>)}</div>
                <div className="grid grid-cols-3 gap-3 mb-8 text-white">
                  {[1,2,3,4,5,6,7,8,9,"C",0,"←"].map(k => (
                    <button key={k} onClick={() => { triggerVibration(10); if (k === "C") { setPinInput(""); return; } if (k === "←") { setPinInput(prev => prev.slice(0,-1)); return; } setPinInput(prev => prev.length < 6 ? prev + String(k) : prev); }} className="bg-white/5 h-16 rounded-2xl font-black text-2xl active:bg-blue-600 transition-all border border-white/5 text-white shadow-sm hover:bg-white/10">{k}</button>
                  ))}
                </div>
              </>
            )}
            <button onClick={() => { triggerVibration(10); setSelectingUser(null); setPinInput(""); setFallbackToPin(false); }} className="text-red-400 text-xs font-black uppercase tracking-widest underline underline-offset-4 active:text-red-300 transition-colors">返回成員列表</button>
          </div>
        </div>
      )}
    </>
  );
};

export default LoginUI;