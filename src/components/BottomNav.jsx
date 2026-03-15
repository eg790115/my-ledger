import React from 'react';
import { SvgIcon } from './Icons';

const BottomNav = ({ activeTab, setActiveTab, triggerVibration }) => {
  const tabs = [
    { id: 'dashboard', icon: 'home' },
    { id: 'history', icon: 'history' },
    { id: 'add', icon: 'plus', isFab: true },
    { id: 'analysis', icon: 'pieChart' },
    { id: 'settings', icon: 'settings' }
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-white/90 backdrop-blur-md rounded-[2.5rem] p-2 flex justify-between items-center z-40 shadow-2xl border border-white/20 pb-safe">
      {tabs.map(tab => {
        if (tab.isFab) {
          return (
            <div key={tab.id} className="px-1 shrink-0">
              <button 
                onClick={() => { triggerVibration(15); setActiveTab(prev => prev === "add" ? "dashboard" : "add"); }} 
                className={`w-14 h-14 flex items-center justify-center rounded-[1.5rem] shadow-xl active:scale-90 transition-all ${activeTab === "add" ? "bg-blue-700 text-white rotate-45 shadow-blue-200" : "bg-gray-900 text-white"}`}
              >
                <SvgIcon name={tab.icon} size={28} className="shrink-0" />
              </button>
            </div>
          );
        }
        
        const isActive = activeTab === tab.id;
        return (
          <button 
            key={tab.id}
            onClick={() => { triggerVibration(10); setActiveTab(tab.id); }} 
            className={`flex-1 flex justify-center items-center py-4 rounded-3xl transition-all ${isActive ? "text-blue-600 bg-blue-50 shadow-inner" : "text-gray-400 hover:bg-gray-50"}`}
          >
            <SvgIcon name={tab.icon} size={24} className="shrink-0" />
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;