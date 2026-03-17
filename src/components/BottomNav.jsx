import React, { useState, useRef, useEffect } from 'react';
import { SvgIcon } from './Icons';

const BottomNav = ({ activeTab, setActiveTab, triggerVibration, onQuickAdd, loginUser }) => {
  const [showRadial, setShowRadial] = useState(false);
  const [activeOption, setActiveOption] = useState(null);

  const [pendingAmountKey, setPendingAmountKey] = useState(null);
  const [tempAmount, setTempAmount] = useState("");

  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const silenceTimerRef = useRef(null);

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

  useEffect(() => {
    const handleUpdate = () => setQuickShortcuts(loadShortcuts());
    window.addEventListener('shortcuts_updated', handleUpdate);
    return () => window.removeEventListener('shortcuts_updated', handleUpdate);
  }, []);

  const startPos = useRef({ x: 0, y: 0 });
  const timerRef = useRef(null);
  const isHolding = useRef(false);
  const wasSwipeOrLongPress = useRef(false);

  // 🌟 修復 1：強制讀取最新設定，並嚴謹判斷 memo
  const executeQuickAdd = (shortcutKey, finalAmount) => {
    if (!onQuickAdd || !loginUser) return;
    
    let currentShortcuts = quickShortcuts;
    try {
      const saved = JSON.parse(localStorage.getItem('quick_shortcuts'));
      if (saved && saved.left && saved.right) currentShortcuts = saved;
    } catch {}

    const data = currentShortcuts[shortcutKey];
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const dateStr = now.toISOString().slice(0, 16);

    const newTx = {
      date: dateStr,
      type: "expense",
      category: data.category || "食/其他",
      amount: Number(finalAmount),
      // 確保就算備註是空的，也不會被預設標籤覆蓋
      desc: typeof data.memo === 'string' ? data.memo : data.label,
      member: loginUser,
      beneficiary: loginUser
    };

    onQuickAdd([newTx]);
    setPendingAmountKey(null);
  };

  const handleQuickSubmit = (shortcutKey) => {
    if (!loginUser) { alert("⚠️ 此功能需在登入後才能使用喔！"); return; }
    
    let currentShortcuts = quickShortcuts;
    try {
      const saved = JSON.parse(localStorage.getItem('quick_shortcuts'));
      if (saved && saved.left && saved.right) currentShortcuts = saved;
    } catch {}

    const data = currentShortcuts[shortcutKey];
    if (!data.amount || String(data.amount).trim() === "" || Number(data.amount) === 0) {
      setTempAmount("");
      setPendingAmountKey(shortcutKey);
    } else {
      executeQuickAdd(shortcutKey, data.amount);
    }
  };

  const startVoiceMode = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 64;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const avg = sum / bufferLength;
        setVolume(avg);

        if (avg < 10) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => stopVoiceMode(true), 2000);
          }
        } else {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        }
        animationRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
      setIsListening(true);
      triggerVibration(20);
    } catch (err) {
      alert("請開啟麥克風權限以使用 AI 記帳");
    }
  };

  const stopVoiceMode = (shouldSubmit = false) => {
    setIsListening(false);
    setVolume(0);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    
    if (shouldSubmit) {
      triggerVibration([30, 50, 30]);
      alert("收音完畢，準備交由 AI 解析... (開發中 🚀)");
    }
  };

  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return; 
    if (isListening) { stopVoiceMode(false); return; }

    e.currentTarget.setPointerCapture(e.pointerId);
    startPos.current = { x: e.clientX, y: e.clientY };
    isHolding.current = true;
    wasSwipeOrLongPress.current = false;
    
    timerRef.current = setTimeout(() => {
      if (isHolding.current) {
        triggerVibration(50);
        setShowRadial(true);
        wasSwipeOrLongPress.current = true;
      }
    }, 350);
  };

  const handlePointerMove = (e) => {
    if (!isHolding.current || isListening) return;
    
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (showRadial) {
      if (e.cancelable) e.preventDefault(); 
      if (distance > 30 && distance < 140) {
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        let newActive = null;
        if (angle > -135 && angle <= -45) newActive = 'top';
        else if (angle > -45 && angle <= 45) newActive = 'right';
        else if (angle <= -135 || angle > 135) newActive = 'left';

        setActiveOption(prev => {
          if (prev !== newActive && newActive !== null) triggerVibration(10);
          return newActive;
        });
      } else {
        setActiveOption(null);
      }
    } else {
      if (dy < -40 && Math.abs(dx) < 40) {
        clearTimeout(timerRef.current);
        isHolding.current = false;
        wasSwipeOrLongPress.current = true;
        startVoiceMode();
      } else if (distance > 15) {
        clearTimeout(timerRef.current); 
        wasSwipeOrLongPress.current = true; 
      }
    }
  };

  const handlePointerUp = (e) => {
    if (isListening) return;
    isHolding.current = false;
    clearTimeout(timerRef.current);
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (showRadial) {
      setShowRadial(false);
      const selected = activeOption;
      setActiveOption(null);

      if (selected === 'left' || selected === 'right') {
        triggerVibration([30, 50, 30]);
        handleQuickSubmit(selected);
      } else if (selected === 'top') {
        triggerVibration([20, 40, 20]);
        startVoiceMode();
      }
    }
  };

  const handleClick = (e) => {
    if (wasSwipeOrLongPress.current || isListening) {
      wasSwipeOrLongPress.current = false; 
      return;
    }
    triggerVibration(15);
    setActiveTab(prev => prev === "add" ? "dashboard" : "add");
  };

  const handleContextMenu = (e) => e.preventDefault();

  const tabs = [
    { id: 'dashboard', icon: 'home' },
    { id: 'history', icon: 'history' },
    { id: 'add', icon: 'plus', isFab: true },
    { id: 'analysis', icon: 'pieChart' },
    { id: 'settings', icon: 'settings' }
  ];

  const rippleScale = 1 + (volume / 80) * 1.5;

  return (
    <>
      <div className={`fixed inset-0 z-[800] bg-gray-900/40 backdrop-blur-sm transition-opacity duration-200 pointer-events-none ${showRadial ? 'opacity-100' : 'opacity-0'}`}></div>

      {pendingAmountKey && (
        <div className="fixed inset-0 z-[1100] bg-gray-900/80 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in pointer-events-auto">
          <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl relative text-center">
             <div className="text-5xl mb-3">{quickShortcuts[pendingAmountKey]?.icon}</div>
             <h3 className="font-black text-2xl text-gray-800 mb-1">{quickShortcuts[pendingAmountKey]?.label}</h3>
             <p className="text-xs text-gray-500 font-bold mb-6 bg-gray-100 px-3 py-1 rounded-full inline-block">{quickShortcuts[pendingAmountKey]?.category}</p>

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
                
                {isListening && (
                  <div className="absolute inset-0 bg-blue-500/30 rounded-[1.5rem] pointer-events-none" style={{ transform: `scale(${rippleScale})`, transition: 'transform 0.1s ease-out' }} />
                )}

                {!isListening && (
                  <div className="absolute top-1/2 left-1/2 pointer-events-none z-0">
                    <div className={`absolute -ml-7 -mt-7 w-14 h-14 rounded-full bg-white flex flex-col items-center justify-center border-2 transition-all duration-300 ease-out shadow-lg ${showRadial ? 'opacity-100 translate-x-[-80px] translate-y-[-50px]' : 'opacity-0 translate-x-0 translate-y-0 scale-50'} ${activeOption === 'left' ? 'border-blue-500 scale-125 shadow-blue-500/40 z-10' : 'border-gray-100 scale-100 z-0'}`}>
                      <span className="text-xl leading-none mb-0.5">{quickShortcuts?.left?.icon}</span>
                      <span className={`text-[9px] font-black ${activeOption === 'left' ? 'text-blue-600' : 'text-gray-500'}`}>{quickShortcuts?.left?.label}</span>
                    </div>
                    <div className={`absolute -ml-8 -mt-8 w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex flex-col items-center justify-center border-2 transition-all duration-300 ease-out delay-[20ms] shadow-lg ${showRadial ? 'opacity-100 translate-x-0 translate-y-[-110px]' : 'opacity-0 translate-x-0 translate-y-0 scale-50'} ${activeOption === 'top' ? 'border-white scale-125 shadow-purple-500/50 z-10' : 'border-transparent scale-100 z-0'}`}>
                      <span className={`text-2xl leading-none mb-0.5 ${activeOption === 'top' ? 'animate-bounce' : ''}`}>🎙️</span>
                      <span className="text-[10px] font-black text-white">AI 語音</span>
                    </div>
                    <div className={`absolute -ml-7 -mt-7 w-14 h-14 rounded-full bg-white flex flex-col items-center justify-center border-2 transition-all duration-300 ease-out delay-[40ms] shadow-lg ${showRadial ? 'opacity-100 translate-x-[80px] translate-y-[-50px]' : 'opacity-0 translate-x-0 translate-y-0 scale-50'} ${activeOption === 'right' ? 'border-blue-500 scale-125 shadow-blue-500/40 z-10' : 'border-gray-100 scale-100 z-0'}`}>
                      <span className="text-xl leading-none mb-0.5">{quickShortcuts?.right?.icon}</span>
                      <span className={`text-[9px] font-black ${activeOption === 'right' ? 'text-blue-600' : 'text-gray-500'}`}>{quickShortcuts?.right?.label}</span>
                    </div>
                  </div>
                )}

                <button 
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={handleClick}
                  onContextMenu={handleContextMenu}
                  className={`w-14 h-14 flex items-center justify-center rounded-[1.5rem] shadow-xl transition-all relative z-10 select-none touch-none ${isListening ? 'bg-blue-600 text-white shadow-blue-400' : showRadial ? 'bg-gray-800 text-white scale-90 rotate-[135deg] shadow-gray-900/40' : (activeTab === "add" ? "bg-blue-700 text-white rotate-45 shadow-blue-200" : "bg-gray-900 text-white active:scale-95")}`}
                >
                  <SvgIcon name={isListening ? "mic" : tab.icon} size={28} className="shrink-0" />
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