// src/components/Header.jsx
import React from 'react';
import { SvgIcon } from './Icons'; // 確保能讀取到您的圖示

const Header = ({ 
  currentUser, 
  customSubtitle, 
  handleSyncClick, 
  isSyncing, 
  syncQueue, 
  isOnline 
}) => {
  // 安全防護：如果還沒登入，就不顯示 Header
  if (!currentUser) return null;

  return (
    <header className="px-6 pt-12 pb-4 bg-white/90 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center border-b border-gray-100 shrink-0 text-gray-800 shadow-sm">
      <div className="flex items-center gap-3 text-left">
        <div className={`bg-${currentUser.color ? currentUser.color.replace('bg-', '') : (currentUser.name==="媽媽"?"pink-600":"blue-600")} w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/30`}>{currentUser.name.charAt(0)}</div>
        <div className="flex flex-col justify-center">
          <h1 className="text-xl font-black tracking-tighter italic leading-none mb-1">家庭記帳</h1>
          <p className="text-[10px] text-gray-400 font-bold tracking-widest leading-none">{String(customSubtitle || "{name}，你好！").replace(/{name}/g, currentUser.name)}</p>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1 mt-1">
        <button onClick={handleSyncClick} className="relative p-2 bg-blue-50 text-blue-600 rounded-xl active:scale-90 transition-all flex items-center justify-center border border-blue-100">
          <SvgIcon name="cloudSync" size={20} className={isSyncing ? "animate-spin" : ""} />
          {syncQueue && syncQueue.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-white leading-none shadow-sm min-w-[20px] text-center">{syncQueue.length}</span>}
        </button>
        <span className={`text-[8px] font-black tracking-widest uppercase ${isOnline ? 'text-green-500' : 'text-red-500'}`}>{isOnline ? (isSyncing ? '同步中' : '線上') : '離線'}</span>
      </div>
    </header>
  );
};

export default Header;