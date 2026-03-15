import React from 'react';
import { SvgIcon } from './Icons';

const BottomNav = ({ activeTab, setActiveTab, triggerVibration }) => {
  const navItems = [
    { id: "dashboard", label: "首頁", icon: "home" },
    { id: "history", label: "歷史", icon: "history" },
    { id: "add", label: "新增", icon: "plus", isMain: true },
    { id: "analysis", label: "圖表", icon: "pieChart" },
    { id: "settings", label: "設定", icon: "settings" }
  ];

  const handleTabChange = (id) => {
    triggerVibration(15);
    // 🌟 開關邏輯：如果在新增頁面，再按一次就會退回首頁 (關閉)
    if (id === "add" && activeTab === "add") {
      setActiveTab("dashboard");
    } else {
      setActiveTab(id);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-[500] animate-in slide-in-from-bottom duration-500">
      {/* 🌟 確保容器垂直置中對齊 (items-center) */}
      <div className="bg-white/95 backdrop-blur-xl border border-gray-200/50 shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-[2.5rem] px-2 py-1.5 flex items-center justify-between">
        {navItems.map((item) => {
          const isAddActive = (activeTab === 'add');
          
          return (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`relative flex flex-col items-center justify-center transition-all duration-300 ${
                item.isMain 
                  // 🌟 核心修正：拔除所有往上推的邊距，讓它跟其他圖示完美「水平對齊」。
                  // 🌟 變色邏輯：+ 是藍色，x 是搶眼的紅色。
                  ? `w-12 h-12 rounded-full shadow-md text-white flex-shrink-0 mx-1 flex items-center justify-center active:scale-90 ${isAddActive ? 'bg-red-500 shadow-red-500/40' : 'bg-blue-600 shadow-blue-500/40'}` 
                  : `flex-1 py-1.5 ${activeTab === item.id ? "text-blue-600" : "text-gray-400"} active:scale-95`
              }`}
            >
              {item.isMain ? (
                // 🌟 動畫小魔法：當它是 X 時，圖示會優雅地旋轉過來
                <div className={`transition-transform duration-300 ${isAddActive ? 'rotate-90' : 'rotate-0'}`}>
                  <SvgIcon name={isAddActive ? 'close' : item.icon} size={26} />
                </div>
              ) : (
                <>
                  <SvgIcon name={item.icon} size={22} />
                  <span className="text-[10px] font-black mt-1 tracking-tighter">{item.label}</span>
                  {activeTab === item.id && (
                    <div className="absolute bottom-0 w-1 h-1 bg-blue-600 rounded-full"></div>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;