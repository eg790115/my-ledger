import React, { useState, useRef, useEffect } from 'react';
import { SvgIcon } from './Icons';

const BottomNav = ({ activeTab, setActiveTab, triggerVibration, onQuickAdd, loginUser }) => {
  const [showRadial, setShowRadial] = useState(false);
  const [activeOption, setActiveOption] = useState(null);

  const [pendingAmountKey, setPendingAmountKey] = useState(null);
  const [tempAmount, setTempAmount] = useState("");

  // 讀取捷徑設定的共用邏輯
  const loadShortcuts = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('quick_shortcuts'));
      if (saved && saved.left && saved.right) return saved;
    } catch {}
    return {
      left: { icon: "☕️", label: "買飲料", amount: 60, category: "食/零食/飲料", memo: "買飲料" },
      right: { icon: "⛽️", label: "加油", amount: "", category: "行/加油", memo: "機車加油" }
    };
  };

  const [quickShortcuts, setQuickShortcuts] = useState(loadShortcuts);

  // 監聽來自 AddTransactionForm 的更新通知
  useEffect(() => {
    const handleUpdate = () => setQuickShortcuts(loadShortcuts());
    window.addEventListener('shortcuts_updated', handleUpdate);
    return () => window.removeEventListener('shortcuts_updated', handleUpdate);
  }, []);

  const startPos = useRef({ x: 0, y: 0 });
  const timerRef = useRef(null);
  const isHolding = useRef(false);
  
  const stateRef = useRef({ showRadial, activeOption, pendingAmountKey });
  useEffect(() => {
    stateRef.current = { showRadial, activeOption, pendingAmountKey };
  }, [showRadial, activeOption, pendingAmountKey]);

  const executeQuickAdd = (shortcutKey, finalAmount) => {
    if (!onQuickAdd || !loginUser) return;
    const data = quickShortcuts[shortcutKey];
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const dateStr = now.toISOString().slice(0, 16);

    const newTx = {
      date: dateStr,
      type: "expense",
      category: data.category || "食/其他",
      amount: Number(finalAmount),
      desc: data.memo || data.label, // 🌟 拔除「(極速捷徑)」後綴，還你乾淨備註
      member: loginUser,
      beneficiary: loginUser
    };

    onQuickAdd([newTx]);
    setPendingAmountKey(null);
  };

  const handleQuickSubmit = (shortcutKey) => {
    if (!loginUser) { alert("⚠️ 此功能需在登入後才能使用喔！"); return; }
    const data = quickShortcuts[shortcutKey];
    if (!data.amount || String(data.amount).trim() === "" || Number(data.amount) === 0) {
      setTempAmount("");
      setPendingAmountKey(shortcutKey);
    } else {
      executeQuickAdd(shortcutKey, data.amount);
    }
  };

  useEffect(() => {
    const onMove = (e) => {
      const { showRadial, pendingAmountKey } = stateRef.current;
      if (!isHolding.current || pendingAmountKey) return; 
      if (showRadial && e.cancelable) e.preventDefault(); 
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      const dx = clientX - startPos.current.x;
      const dy = clientY - startPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 30 && distance < 140) {
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        let newActive = null;
        
        // 🌟 移除往下滑動的判定，避免誤觸
        if (angle > -135 && angle <= -45) newActive = 'top';
        else if (angle > -45 && angle <= 30) newActive = 'right';
        else if (angle < -135 || angle >= 150) newActive = 'left';

        setActiveOption(prev => {
          if (prev !== newActive && newActive !== null) triggerVibration(10);
          return newActive;
        });
      } else {
        setActiveOption(null);
      }
    };

    const onEnd = () => {
      if (!isHolding.current) return;
      isHolding.current = false;
      clearTimeout(timerRef.current); 

      const { showRadial, activeOption } = stateRef.current;

      if (showRadial) {
        setShowRadial(false);
        if (activeOption === 'left' || activeOption === 'right') {
          triggerVibration([30, 50, 30]);
          handleQuickSubmit(activeOption); 
        } else if (activeOption === 'top') {
          triggerVibration([20, 40, 20]);
          alert(`啟動 AI 語音記帳... (準備開發中 🚀)`);
        }
        setActiveOption(null);
      } else {
        triggerVibration(15);
        setActiveTab(prev => prev === "add" ? "dashboard" : "add");
      }
    };

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [setActiveTab, triggerVibration, onQuickAdd, loginUser, quickShortcuts]);

  const handleStart = (e) => {
    if (e.button === 2) return; 
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startPos.current = { x: clientX, y: clientY };
    isHolding.current = true;
    
    timerRef.current = setTimeout(() => {
      if (isHolding.current) {
        triggerVibration(50);
        setShowRadial(true);
      }
    }, 350);
  };

  const handleContextMenu = (e) => e.preventDefault();

  const tabs = [
    { id: 'dashboard', icon: 'home' },
    { id: 'history', icon: 'history' },
    { id: 'add', icon: 'plus', isFab: true },
    { id: 'analysis', icon: 'pieChart' },
    { id: 'settings', icon: 'settings' }
  ];

  return (
    <>
      <div className={`fixed inset-0 z-[800] bg-gray-900/40 backdrop-blur-sm transition-opacity duration-200 pointer-events-none ${showRadial ? 'opacity-100' : 'opacity-0'}`}></div>

      {/* 🌟 補登金額視窗 */}
      {pendingAmountKey && (
        <div className="fixed inset-0 z-[1100] bg-gray-900/80 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in">
          <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl relative text-center">
             <div className="text-5xl mb-3">{quickShortcuts[pendingAmountKey].icon}</div>
             <h3 className="font-black text-2xl text-gray-800 mb-1">{quickShortcuts[pendingAmountKey].label}</h3>
             <p className="text-xs text-gray-500 font-bold mb-6 bg-gray-100 px-3 py-1 rounded-full inline-block">{quickShortcuts[pendingAmountKey].category}</p>

             <input type="number" autoFocus value={tempAmount} onChange={e => setTempAmount(e.target.value)} placeholder="請輸入金額" className="w-full bg-gray-50 px-4 py-4 rounded-2xl text-center font-black text-3xl mb-8 text-gray-800 tabular-nums border-2 border-blue-100 focus:border-blue-500 outline-none transition-colors" />
             <div className="flex gap-3">
               <button onClick={() => setPendingAmountKey(null)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black active:scale-95">取消</button>
               <button onClick={() => { if(!tempAmount) return; executeQuickAdd(pendingAmountKey, tempAmount); }} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black active:scale-95 shadow-xl shadow-blue-500/30">確認記帳</button>
             </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-white/90 backdrop-blur-md rounded-[2.5rem] p-2 flex justify-between items-center z-[900] shadow-2xl border border-white/20 pb-safe">
        {tabs.map(tab => {
          if (tab.isFab) {
            return (
              <div key={tab.id} className="px-1 shrink-0 relative flex justify-center">
                <div className="absolute top-1/2 left-1/2 pointer-events-none z-0">
                  <div className={`absolute -ml-7 -mt-7 w-14 h-14 rounded-full bg-white flex flex-col items-center justify-center border-2 transition-all duration-300 ease-out shadow-lg ${showRadial ? 'opacity-100 translate-x-[-80px] translate-y-[-50px]' : 'opacity-0 translate-x-0 translate-y-0 scale-50'} ${activeOption === 'left' ? 'border-blue-500 scale-125 shadow-blue-500/40 z-10' : 'border-gray-100 scale-100 z-0'}`}>
                    <span className="text-xl leading-none mb-0.5">{quickShortcuts.left.icon}</span>
                    <span className={`text-[9px] font-black ${activeOption === 'left' ? 'text-blue-600' : 'text-gray-500'}`}>{quickShortcuts.left.label}</span>
                  </div>
                  <div className={`absolute -ml-8 -mt-8 w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex flex-col items-center justify-center border-2 transition-all duration-300 ease-out delay-[20ms] shadow-lg ${showRadial ? 'opacity-100 translate-x-0 translate-y-[-110px]' : 'opacity-0 translate-x-0 translate-y-0 scale-50'} ${activeOption === 'top' ? 'border-white scale-125 shadow-purple-500/50 z-10' : 'border-transparent scale-100 z-0'}`}>
                    <span className={`text-2xl leading-none mb-0.5 ${activeOption === 'top' ? 'animate-bounce' : ''}`}>🎙️</span>
                    <span className="text-[10px] font-black text-white">AI 語音</span>
                  </div>
                  <div className={`absolute -ml-7 -mt-7 w-14 h-14 rounded-full bg-white flex flex-col items-center justify-center border-2 transition-all duration-300 ease-out delay-[40ms] shadow-lg ${showRadial ? 'opacity-100 translate-x-[80px] translate-y-[-50px]' : 'opacity-0 translate-x-0 translate-y-0 scale-50'} ${activeOption === 'right' ? 'border-blue-500 scale-125 shadow-blue-500/40 z-10' : 'border-gray-100 scale-100 z-0'}`}>
                    <span className="text-xl leading-none mb-0.5">{quickShortcuts.right.icon}</span>
                    <span className={`text-[9px] font-black ${activeOption === 'right' ? 'text-blue-600' : 'text-gray-500'}`}>{quickShortcuts.right.label}</span>
                  </div>
                </div>

                <button 
                  onMouseDown={handleStart} onTouchStart={handleStart} onContextMenu={handleContextMenu}
                  className={`w-14 h-14 flex items-center justify-center rounded-[1.5rem] shadow-xl transition-all relative z-10 select-none touch-none ${showRadial ? 'bg-gray-800 text-white scale-90 rotate-[135deg] shadow-gray-900/40' : (activeTab === "add" ? "bg-blue-700 text-white rotate-45 shadow-blue-200" : "bg-gray-900 text-white active:scale-95")}`}
                >
                  <SvgIcon name={tab.icon} size={28} className="shrink-0" />
                </button>
              </div>
            );
          }
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => { triggerVibration(10); setActiveTab(tab.id); }} className={`flex-1 flex justify-center items-center py-4 rounded-3xl transition-all ${isActive ? "text-blue-600 bg-blue-50 shadow-inner" : "text-gray-400 hover:bg-gray-50"}`}>
              <SvgIcon name={tab.icon} size={24} className="shrink-0" />
            </button>
          );
        })}
      </nav>
    </>
  );
};

export default BottomNav;