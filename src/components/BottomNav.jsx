import React, { useState, useRef, useEffect } from 'react';
import { SvgIcon } from './Icons';

const BottomNav = ({ activeTab, setActiveTab, triggerVibration, onQuickAdd, loginUser, onVoiceRecordStop }) => {
  const [showRadial, setShowRadial] = useState(false);
  const [activeOption, setActiveOption] = useState(null);

  const [pendingAmountKey, setPendingAmountKey] = useState(null);
  const [tempAmount, setTempAmount] = useState("");

  const [isListening, setIsListening] = useState(false);
  const [volumeData, setVolumeData] = useState([10, 10, 10, 10, 10]);

  // 即時字幕與錯誤提示
  const [realtimeText, setRealtimeText] = useState("");
  const [voiceError, setVoiceError] = useState("");

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  
  const recognitionRef = useRef(null); 
  const transcriptRef = useRef(""); 
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

  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("此瀏覽器不支援語音辨識 (建議使用 Chrome/Safari)");
      return null;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-TW';
    recognition.continuous = true; 
    recognition.interimResults = true; 

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) transcriptRef.current += finalTranscript;

      const currentText = transcriptRef.current + interimTranscript;
      setRealtimeText(currentText);
      setVoiceError(""); 

      // 🌟 重新計時，若 2 秒沒說話且有辨識到文字，自動停止
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (currentText.trim()) stopVoiceMode(true);
      }, 2000);
    };

    recognition.onerror = (event) => {
      console.error("語音辨識錯誤:", event.error);
      if (event.error !== 'no-speech') setVoiceError(`收音錯誤: ${event.error}`);
    };

    return recognition;
  };

  const startVoiceMode = () => {
    // 重置所有狀態
    transcriptRef.current = "";
    setRealtimeText("");
    setVoiceError("");
    setIsListening(true);
    triggerVibration([20, 30]); 
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    // 🌟 核心修復：為了突破手機瀏覽器限制，必須在此「瞬間同步」啟動語音辨識
    if (!recognitionRef.current) recognitionRef.current = initSpeechRecognition();
    if (recognitionRef.current) {
       try { recognitionRef.current.start(); } catch (e) {}
    } else {
       setVoiceError("您的設備不支援語音辨識");
    }

    // 🌟 啟動聲波動畫 (以非同步方式啟動，不阻擋語音辨識)
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        analyserRef.current.fftSize = 64;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateVolume = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          setVolumeData([
             dataArray[2] || 10,
             dataArray[6] || 10,
             dataArray[10] || 10,
             dataArray[14] || 10,
             dataArray[18] || 10
          ]);
          animationRef.current = requestAnimationFrame(updateVolume);
        };
        updateVolume();
      })
      .catch(err => console.log("視覺化麥克風被擋，但語音可能仍可運作", err));
  };

  const stopVoiceMode = (shouldSubmit = false) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    // 確保抓到畫面上最新顯示的文字
    const finalText = realtimeText.trim();

    // 🌟 核心修復：無論如何，先無條件關閉 UI 面板，絕對不卡死！
    setIsListening(false);
    setVolumeData([10, 10, 10, 10, 10]); 
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(()=>{});
    }
    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
    }

    // 關閉面版後，再處理送出邏輯
    if (shouldSubmit) {
      if (!finalText) {
          triggerVibration([50, 50]);
          // 延遲一點點跳出警告，讓畫面先關閉
          setTimeout(() => alert("沒有聽清楚您說的話，請再試一次！"), 100);
          return; 
      }
      
      triggerVibration([30, 50, 30]);
      if (onVoiceRecordStop) onVoiceRecordStop(finalText);
    } else {
      triggerVibration(15); 
    }
  };

  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return; 
    if (isListening) return; 

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

  return (
    <>
      <div className={`fixed inset-0 z-[800] bg-gray-900/40 backdrop-blur-sm transition-opacity duration-200 pointer-events-none ${showRadial ? 'opacity-100' : 'opacity-0'}`}></div>

      {isListening && (
        <div className="fixed inset-x-0 bottom-[6.5rem] mx-auto w-[92%] max-w-sm bg-white/95 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/40 p-6 flex flex-col items-center justify-center animate-in slide-in-from-bottom-8 z-[1000]">
          
          <div className="flex items-center justify-center gap-1.5 h-16 mb-4">
            {volumeData.map((v, i) => (
              <div 
                key={i} 
                className="w-2.5 bg-gradient-to-t from-blue-600 to-indigo-400 rounded-full shadow-sm" 
                style={{ 
                  height: `${Math.max(12, (v / 255) * 64)}px`, 
                  transition: 'height 0.05s ease-out' 
                }} 
              />
            ))}
          </div>
          
          <div className="text-gray-800 font-black text-lg mb-1">正在聆聽...</div>
          
          <div className="min-h-[3rem] flex items-center justify-center mb-6 w-full px-2">
            {voiceError ? (
              <span className="text-red-500 font-bold text-sm text-center bg-red-50 py-1.5 px-3 rounded-lg animate-pulse">{voiceError}</span>
            ) : realtimeText ? (
              <span className="text-blue-600 font-black text-[15px] text-center break-words leading-snug">{realtimeText}</span>
            ) : (
              <span className="text-gray-400 font-bold text-xs text-center">請說出記帳內容，例如「早餐一百元」</span>
            )}
          </div>
          
          <div className="flex gap-3 w-full">
             <button 
                onClick={() => stopVoiceMode(false)} 
                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black active:scale-95 transition-transform"
             >
               取消
             </button>
             <button 
                onClick={() => stopVoiceMode(true)} 
                className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black active:scale-95 transition-transform shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2"
             >
               <div className="w-3.5 h-3.5 bg-white rounded-[4px]" /> 停止並解析
             </button>
          </div>
        </div>
      )}

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

      <nav className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-white/90 backdrop-blur-md rounded-[2.5rem] p-2 flex justify-between items-center z-[900] shadow-2xl border border-white/20 pb-safe transition-all duration-300 ${isListening ? 'opacity-30 pointer-events-none translate-y-4' : 'opacity-100'}`}>
        {tabs.map(tab => {
          if (tab.isFab) {
            return (
              <div key={tab.id} className="px-1 shrink-0 relative flex justify-center">
                
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