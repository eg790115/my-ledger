import React from 'react';
import { SvgIcon } from './Icons';

const BottomNav = ({ activeTab, setActiveTab, triggerVibration }) => {
  const navItems = [
    { id: "dashboard", label: "首頁", icon: "home" },
    { id: "history", label: "歷史", icon: "list" },
    { id: "add", label: "新增", icon: "plus", isMain: true },
    { id: "analysis", label: "圖表", icon: "chart" },
    { id: "settings", label: "設定", icon: "settings" }
  ];

  const handleTabChange = (id) => {
    triggerVibration(15);
    setActiveTab(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    /* 🌟 這裡把 bottom-8 改成了 bottom-4，讓它更貼近螢幕底部 */
    <nav className="fixed bottom-4 left-4 right-4 z-[500] animate-in slide-in-from-bottom duration-500">
      <div className="bg-white/90 backdrop-blur-xl border border-gray-200/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-[2.5rem] p-2 flex items-center justify-between">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabChange(item.id)}
            className={`relative flex flex-col items-center justify-center transition-all duration-300 ${
              item.isMain 
                ? "w-16 h-16 -mt-8 mb-2 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-500/40 active:scale-90" 
                : `flex-1 py-2 ${activeTab === item.id ? "text-blue-600" : "text-gray-400"} active:scale-95`
            }`}
          >
            {item.isMain ? (
              <SvgIcon name={item.icon} size={28} />
            ) : (
              <>
                <SvgIcon name={item.icon} size={22} />
                <span className="text-[10px] font-black mt-1 tracking-tighter">{item.label}</span>
                {activeTab === item.id && (
                  <div className="absolute -bottom-1 w-1 h-1 bg-blue-600 rounded-full animate-pulse"></div>
                )}
              </>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;