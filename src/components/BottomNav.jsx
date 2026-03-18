import React, { useState, useRef, useEffect } from 'react';
import { SvgIcon } from './Icons';

const BottomNav = ({ activeTab, setActiveTab, triggerVibration, onQuickAdd, loginUser, onVoiceRecordStop }) => {
  const [showRadial, setShowRadial] = useState(false);
  const [activeOption, setActiveOption] = useState(null);

  const [pendingAmountKey, setPendingAmountKey] = useState(null);
  const [tempAmount, setTempAmount] = useState("");

  const [isListening, setIsListening] = useState(false);
  // 🌟 將音量狀態從單一數字，改為 5 個頻率區段的陣列，用來繪製聲波
  const [volumeData, setVolumeData] = useState([10, 10, 10, 10, 10]);

  // 🌟 新增：即時字幕與錯誤提示狀態 (取代醜陋的 alert)
  const [realtimeText, setRealtimeText] = useState("");
  const [voiceError, setVoiceError] = useState("");

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  // 🌟 用於存放 SpeechRecognition 實例
  const recognitionRef = useRef(null); 
  const transcriptRef = useRef(""); // 暫存語音辨識結果
  const silenceTimerRef = useRef(null); // 🌟 用來計時 2 秒自動停止

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

  // 🌟 初始化語音辨識 (加入即時字幕與 2 秒計時器)
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("您的瀏覽器不支援語音辨識功能 (建議使用 Chrome 或 Safari)");
      return null;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-TW';
    recognition.continuous = true; // 持續辨識
    recognition.interimResults = true; // 顯示即時結果

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
      if (finalTranscript) {
         // 將每次的 final 結果接起來
         transcriptRef.current += finalTranscript;
      }

      // 更新畫面即時文字
      setRealtimeText(transcriptRef.current + interimTranscript);
      setVoiceError(""); // 有聽到聲音就清空錯誤

      // 🌟 核心：重置 2 秒計時器，2 秒沒聲音就自動停止並送出！
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        stopVoiceMode(true);
      }, 2000);
    };

    recognition.onerror = (event) => {
      console.error("語音辨識錯誤:", event.error);
      if (event.error !== 'no-speech') {
         setVoiceError("麥克風收音異常，請重試");
      }
    };

    return recognition;
  };

  const startVoiceMode = async () => {
    try {
      // 啟動前清空舊狀態
      transcriptRef.current = ""; 
      setRealtimeText("");
      setVoiceError("");
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      
      // 1. 啟動 Web Speech API 進行文字辨識
      if (!recognitionRef.current) {
         recognitionRef.current = initSpeechRecognition();
      }
      if (recognitionRef.current) {
         try { recognitionRef.current.start(); } catch (e) {}
      } else {
         setIsListening(true);
         return; // 若不支援，直接顯示錯誤面板
      }

      // 2. 啟動 AudioContext 用於繪製聲波動畫
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        
        // 抓取 5 個不同頻段的音量大小
        const v1 = dataArray[2] || 10;
        const v2 = dataArray[6] || 10;
        const v3 = dataArray[10] || 10;
        const v4 = dataArray[14] || 10;
        const v5 = dataArray[18] || 10;
        
        setVolumeData([v1, v2, v3, v4, v5]);
        animationRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
      setIsListening(true);
      triggerVibration([20, 30]); 
    } catch (err) {
      setVoiceError("請開啟麥克風權限以使用 AI 記帳");
      setIsListening(true);
    }
  };

  const stopVoiceMode = (shouldSubmit = false) => {
    // 停止時清除自動送出計時器
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    if (shouldSubmit) {
      // 確保抓取到包含即時（尚未 final）的字串，避免漏字
      const text = (transcriptRef.current + (realtimeText.replace(transcriptRef.current, ''))).trim();

      if (!text) {
          triggerVibration([50, 50]);
          setVoiceError("沒有聽清楚您說的話，請再試一次！");
          return; // 🌟 沒聽清楚時「不關閉視窗」，直接顯示紅字錯誤
      }
      
      triggerVibration([30, 50, 30]);
      // 呼叫上層傳入的處理函式，將語音文字傳出去
      if (onVoiceRecordStop) {
          onVoiceRecordStop(text);
      }
    } else {
      triggerVibration(15); 
    }

    // 關閉相關服務與視窗
    setIsListening(false);
    setVolumeData([10, 10, 10, 10, 10]); 
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(()=>{});
    }
    
    // 停止語音辨識
    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
    }
  };

  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return; 
    if (isListening) return; // 正在聽的時候不觸發捷徑轉盤

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

  return (
    <>
      <div className={`fixed inset-0 z-[800] bg-gray-900/40 backdrop-blur-sm transition-opacity duration-200 pointer-events-none ${showRadial ? 'opacity-100' : 'opacity-0'}`}></div>

      {/* 🌟 語音浮動面板 (樣式與原始檔案完全相同，僅修改文字顯示區塊) */}
      {isListening && (
        <div className="fixed inset-x-0 bottom-[6.5rem] mx-auto w-[92%] max-w-sm bg-white/95 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/40 p-6 flex flex-col items-center justify-center animate-in slide-in-from-bottom-8 z-[1000]">
          
          {/* 聲波動畫區 */}
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
          
          {/* 🌟 取代原本固定的文字，改為即時字幕與錯誤顯示 */}
          <div className="min-h-[3rem] flex items-center justify-center mb-6 w-full px-2">
            {voiceError ? (
              <span className="text-red-500 font-bold text-sm text-center bg-red-50 py-1.5 px-3 rounded-lg animate-pulse">{voiceError}</span>
            ) : realtimeText ? (
              <span className="text-blue-600 font-black text-[15px] text-center break-words leading-snug">{realtimeText}</span>
            ) : (
              <span className="text-gray-400 font-bold text-xs text-center">請說出記帳內容，例如「早餐一百元」</span>
            )}
          </div>
          
          {/* 控制按鈕區 */}
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