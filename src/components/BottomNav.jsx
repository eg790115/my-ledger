// src/components/BottomNav.jsx
import React from 'react';
import { SvgIcon } from './Icons'; // 確保能讀取到您的圖示

const BottomNav = ({ activeTab, setActiveTab, triggerVibration }) => {
  return (
    <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-white/90 backdrop-blur-md rounded-[2.5rem] p-2 flex justify-between items-center z-40 shadow-2xl border border-white/20 safe-bottom">
      <button onClick={() => { triggerVibration(10); setActiveTab("dashboard"); }} className={`flex-1 flex justify-center items-center py-4 rounded-3xl transition-all ${activeTab === "dashboard" ? "text-blue-600 bg-blue-50 shadow-inner" : "text-gray-400"}`}><SvgIcon name="home" className="shrink-0" /></button>
      <button onClick={() => { triggerVibration(10); setActiveTab("history"); }} className={`flex-1 flex justify-center items-center py-4 rounded-3xl transition-all ${activeTab === "history" ? "text-blue-600 bg-blue-50 shadow-inner" : "text-gray-400"}`}><SvgIcon name="history" className="shrink-0" /></button>
      <div className="px-1 shrink-0">
        <button onClick={() => { triggerVibration([15, 30, 15]); setActiveTab(prev => prev === "add" ? "dashboard" : "add"); }} className={`w-14 h-14 flex items-center justify-center rounded-[1.5rem] shadow-xl active:scale-90 transition-all ${activeTab === "add" ? "bg-blue-700 text-white rotate-45 shadow-blue-200" : "bg-gray-900 text-white"}`}><SvgIcon name="plus" size={28} className="shrink-0" /></button>
      </div>
      <button onClick={() => { triggerVibration(10); setActiveTab("analysis"); }} className={`flex-1 flex justify-center items-center py-4 rounded-3xl transition-all ${activeTab === "analysis" ? "text-blue-600 bg-blue-50 shadow-inner" : "text-gray-400"}`}><SvgIcon name="pieChart" className="shrink-0" /></button>
      <button onClick={() => { triggerVibration(10); setActiveTab("settings"); }} className={`flex-1 flex justify-center items-center py-4 rounded-3xl transition-all ${activeTab === "settings" ? "text-blue-600 bg-blue-50 shadow-inner" : "text-gray-400"}`}><SvgIcon name="settings" className="shrink-0" /></button>
    </nav>
  );
};

export default BottomNav;