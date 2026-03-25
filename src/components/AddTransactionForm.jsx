import React, { useState, useEffect, useMemo, useRef } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebase';

const CATEGORY_MAP = {
  expense: { 
    "食": ["早餐", "午餐", "晚餐", "生鮮食材", "零食/飲料", "外食聚餐", "其他"], 
    "衣": ["爸爸服飾", "媽媽服飾", "小孩服飾", "鞋包/配件", "保養/美妝", "其他"], 
    "居家": ["房貸", "管理費", "水費", "電費", "瓦斯費", "網路/電信", "家具/家電", "日用品", "房屋稅/地價稅", "其他"], 
    "行": ["大眾運輸", "計程車/共享", "加油", "停車費", "保養維修", "牌照/燃料稅", "eTag/過路費", "其他"], 
    "教育": ["學校學費", "安親/才藝班", "教材/文具", "童書/玩具", "零用錢", "其他"], 
    "娛樂": ["國內旅遊", "國外旅遊", "串流訂閱", "運動健身", "聚會活動", "電影/展覽", "其他"], 
    "醫療": ["保健食品", "診所門診", "牙醫/眼科", "醫美", "住院", "其他"], 
    "理財": ["股票/ETF", "定期定額", "基金", "儲蓄險", "外匯", "加密貨幣", "其他"], 
    "其他": ["保險費", "孝親費", "紅白包", "捐款/贈與", "雜項"] 
  },
  income: { "收入": ["爸爸薪資", "媽媽薪資", "獎金", "投資收益", "利息", "其他收入"] }
};

const BEN_OPTIONS = ["爸爸", "媽媽", "兒子", "其他"];
const ICONS = ["☕️", "🍱", "🍔", "🛒", "🚗", "🚇", "🏍️", "🎮", "🎬", "🏠", "💡", "📱", "💊", "🏥", "👶", "🐶", "🐱", "⛽️", "🧾", "💰"];

const safeEvaluateMath = e => {
  if (!e) return "";
  const s = String(e).trim();
  if (/[\+\-\*\/]/.test(s)) {
    try {
      const san = s.replace(/[^\d.\+\-\*\/\(\)]/g, '');
      if (!san) return s;
      const c = san.replace(/[\+\-\*\/]+$/, '');
      const r = new Function(`'use strict'; return (${c})`)();
      return isFinite(r) ? String(Math.round(r)) : s;
    } catch { return s; }
  }
  return s.replace(/[^\d.]/g, '');
};

const SvgIcon = ({ name, size = 24, className = "" }) => {
  const icons = {
    plus: <path d="M12 5v14m-7-7h14"/>,
    spinner: <path d="M21 12a9 9 0 1 1-6.219-8.56"/>,
    camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
    album: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>
  };
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 aspect-square ${className}`}>{icons[name]||<circle cx="12" cy="12" r="10"/>}</svg>;
};

const CategorySelectPair = ({ type, parentCat, childCat, onChange }) => {
  const pCats = Object.keys(CATEGORY_MAP[type] || CATEGORY_MAP.expense);
  const safeParentCat = pCats.includes(parentCat) ? parentCat : pCats[0];
  const cCats = CATEGORY_MAP[type][safeParentCat] || CATEGORY_MAP[type][pCats[0]];
  
  return (
    <div className="flex gap-2">
      <div className="bg-gray-100 p-2 px-3 rounded-xl flex-1 min-w-0 border border-transparent focus-within:border-blue-200 transition-colors">
        <label className="text-[8px] font-black text-blue-500 uppercase block mb-0.5 tracking-widest">主類別</label>
        <select className="w-full bg-transparent border-none outline-none appearance-none font-black text-sm text-gray-800" value={safeParentCat} onChange={e=>onChange(e.target.value,CATEGORY_MAP[type][e.target.value][0])}>
          {pCats.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="bg-gray-100 p-2 px-3 rounded-xl flex-1 min-w-0 border border-transparent focus-within:border-blue-200 transition-colors">
        <label className="text-[8px] font-black text-blue-500 uppercase block mb-0.5 tracking-widest">子項目</label>
        <select className="w-full bg-transparent border-none outline-none appearance-none font-black text-sm text-gray-800" value={childCat} onChange={e=>onChange(safeParentCat,e.target.value)}>
          {cCats.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  );
};

export const AddTransactionForm = ({ loginUser = "爸爸", onSubmit = () => {}, onClose, isLoading = false, onImageRecordStop, isAIEvaluating }) => {
  const [formTab, setFormTab] = useState('general');
  const [toastMsg, setToastMsg] = useState(""); 

  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const albumInputRef = useRef(null);
  
  const [isFocused, setIsFocused] = useState(false);
  const [isSplit, setIsSplit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ amount: "", parentCat: "食", childCat: "晚餐", member: loginUser, beneficiary: [loginUser], type: "expense", desc: "", parentTitle: "", parentDesc: "", date: "" });
  
  const [subItems, setSubItems] = useState([{ id: Date.now(), parentCat: "食", childCat: "晚餐", amount: "", desc: "", beneficiary: [loginUser], member: loginUser }]);
  const otherMember = loginUser === "爸爸" ? "媽媽" : "爸爸";
  
  const getCatParts = (catStr) => {
    if (!catStr) return ["食", "其他"];
    const parts = catStr.split("/");
    if (parts.length === 2) return parts;
    return ["食", "其他"];
  };

  const loadShortcuts = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('quick_shortcuts'));
      if (saved && saved.left && saved.right) {
        return {
          left: { ...saved.left, memo: saved.left.memo || "" },
          right: { ...saved.right, memo: saved.right.memo || "" }
        };
      }
    } catch {}
    return {
      left: { icon: "☕️", label: "買飲料", amount: "", category: "食/零食/飲料", memo: "" },
      right: { icon: "⛽️", label: "加油", amount: "", category: "行/加油", memo: "" }
    };
  };

  const [shortcuts, setShortcuts] = useState(loadShortcuts());

  useEffect(() => {
    if (!db || !loginUser) return;
    const unsub = onSnapshot(doc(db, 'members', loginUser), (snap) => {
      if (snap.exists() && snap.data().shortcuts) {
        const cloudShortcuts = snap.data().shortcuts;
        const cloudStr = JSON.stringify(cloudShortcuts);
        const localStr = localStorage.getItem('quick_shortcuts');
        
        if (localStr !== cloudStr) {
           localStorage.setItem('quick_shortcuts', cloudStr);
           window.dispatchEvent(new Event('shortcuts_updated'));
           setShortcuts(cloudShortcuts); 
        }
      }
    });
    return () => unsub();
  }, [loginUser]);

  useEffect(() => { 
    setFormData(prev => ({ ...prev, member: loginUser || prev.member, beneficiary: [loginUser || prev.member] })); 
    setSubItems(prev => prev.map(s => ({...s, member: loginUser || s.member, beneficiary: [loginUser || prev.member]}))); 
  }, [loginUser]);

  const handleTypeChange = (newType) => {
    const defaultP = newType === "expense" ? "食" : "收入"; const defaultC = CATEGORY_MAP[newType][defaultP][0];
    setFormData(prev => ({ ...prev, type: newType, parentCat: defaultP, childCat: defaultC }));
    setSubItems(prev => prev.map(s => ({ ...s, parentCat: defaultP, childCat: defaultC })));
  };

  const toggleBeneficiary = b => { 
    if (formData.beneficiary.includes(b)) { 
        if (formData.beneficiary.length > 1) setFormData({...formData, beneficiary: formData.beneficiary.filter(x => x !== b)}); 
    } else {
        setFormData({...formData, beneficiary: [...formData.beneficiary, b]});
    }
  };

  const toggleSubBeneficiary = (id, b) => { 
      setSubItems(subItems.map(s => { 
          if (s.id !== id) return s; 
          const newBen = s.beneficiary.includes(b) ? (s.beneficiary.length > 1 ? s.beneficiary.filter(x => x !== b) : s.beneficiary) : [...s.beneficiary, b]; 
          return { ...s, beneficiary: newBen }; 
      })); 
  };

  const totalSplitAmount = useMemo(() => subItems.reduce((acc, curr) => acc + (Number(safeEvaluateMath(curr.amount)) || 0), 0), [subItems]);
  const renderAmount = () => { 
      if (isSplit) return totalSplitAmount === 0 ? "0" : totalSplitAmount.toString(); 
      const val = formData.amount; 
      if (isFocused) return (val === "" || val === "0") ? <span className="text-gray-300 animate-cursor">_</span> : val; 
      return (val === "" || val === "0") ? "0" : val; 
  };

  const handleAddSubItem = () => { 
      const defaultP = formData.type === "expense" ? "食" : "收入"; 
      const defaultC = CATEGORY_MAP[formData.type][defaultP][0]; 
      setSubItems([...subItems, { id: Date.now(), parentCat: defaultP, childCat: defaultC, amount: "", desc: "", beneficiary: [formData.member], member: formData.member }]); 
  };

  const handleRemoveSubItem = id => { if (subItems.length > 1) setSubItems(subItems.filter(s => s.id !== id)); };
  const updateSubItem = (id, updates) => { setSubItems(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s)); };

  const submitForm = async () => {
    if (isSubmitting) return; 
    setIsSubmitting(true);
    if (isSplit) {
      const evaluatedSubs = subItems.map(s => ({ ...s, amount: safeEvaluateMath(s.amount) }));
      const validSubs = evaluatedSubs.filter(s => Number(s.amount) > 0);
      if (validSubs.length === 0) { setIsSubmitting(false); return; }
      
      const sharedGroupId = `G_${Date.now()}_${formData.member}_${Math.random().toString(36).substring(2, 7)}`;
      const combinedParentDesc = `${formData.parentTitle.trim() || "多筆紀錄"}|||${formData.parentDesc.trim()}`;
      
      const multipleTxs = validSubs.map(s => ({ 
        amount: s.amount, 
        category: `${s.parentCat}/${s.childCat}`, 
        member: s.member || formData.member,
        beneficiary: s.beneficiary.join(","), 
        type: formData.type, 
        desc: s.desc, 
        date: formData.date, 
        parentDesc: combinedParentDesc,
        groupId: sharedGroupId
      }));
      await onSubmit(multipleTxs);
    } else {
      const finalAmount = safeEvaluateMath(formData.amount);
      await onSubmit([{ ...formData, amount: finalAmount, category: `${formData.parentCat}/${formData.childCat}`, beneficiary: formData.beneficiary.join(",") }]);
    }
    setIsSubmitting(false);
  };
  
  const isSubmitDisabled = isSubmitting || isLoading || (isSplit ? totalSplitAmount === 0 : (!formData.amount || formData.amount === "0"));

  const saveShortcuts = async () => {
    const finalShortcuts = {
      left: { ...shortcuts.left, memo: shortcuts.left.memo || "" },
      right: { ...shortcuts.right, memo: shortcuts.right.memo || "" }
    };
    
    localStorage.setItem('quick_shortcuts', JSON.stringify(finalShortcuts));
    window.dispatchEvent(new Event('shortcuts_updated')); 
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) window.navigator.vibrate([20, 50, 20]);
    
    if (db) {
      try { await setDoc(doc(db, 'members', loginUser), { shortcuts: finalShortcuts }, { merge: true }); } 
      catch (err) { console.error("捷徑上傳雲端失敗", err); }
    }

    setToastMsg("✅ 已同步儲存至個人雲端"); 
    setTimeout(() => { setToastMsg(""); if (onClose) onClose(); }, 500); 
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const max = 1200; 
        if (width > max || height > max) {
          if (width > height) { height = Math.round(height * max / width); width = max; }
          else { width = Math.round(width * max / height); height = max; }
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        if (onImageRecordStop) onImageRecordStop(base64, 'image/jpeg');
        e.target.value = ''; 
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const [pLeft, cLeft] = getCatParts(shortcuts.left.category);
  const [pRight, cRight] = getCatParts(shortcuts.right.category);

  return (
    <div className="bg-white p-5 sm:p-6 rounded-[2.5rem] shadow-xl border border-gray-100 animate-in text-center relative font-black pb-8">
      
      {toastMsg && ( 
        <div className="fixed bottom-24 left-0 right-0 flex justify-center z-[1000] pointer-events-none px-4 text-center">
          <div className="px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in pointer-events-auto bg-gray-800 text-white border border-gray-600">
            <span className="text-sm font-bold tracking-tight text-center">{toastMsg}</span>
          </div>
        </div> 
      )}

      <div className="flex gap-2 mb-6">
        <button onClick={() => setFormTab('general')} className={`flex-[1.2] py-3 text-[13px] font-black rounded-2xl transition-all ${formTab === 'general' ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>📝 一般記帳</button>
        {/* 👉 這裡我們把 AI 拍照按鈕設為綠色，但樣式跟旁邊統一 */}
        <button onClick={() => setFormTab('ai')} className={`flex-[1.2] py-3 text-[13px] font-black rounded-2xl transition-all ${formTab === 'ai' ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>📸 AI 拍照</button>
        <button onClick={() => setFormTab('shortcuts')} className={`flex-1 py-3 text-[13px] font-black rounded-2xl transition-all ${formTab === 'shortcuts' ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>⚡ 捷徑</button>
      </div>

      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} style={{ display: 'none' }} onChange={handleImageFileChange} />
      <input type="file" accept="image/*" ref={albumInputRef} style={{ display: 'none' }} onChange={handleImageFileChange} />

      {formTab === 'general' ? (
        // 一般記帳 (保持原本清爽的樣式)
        <>
          <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-6 text-sm text-gray-500">
            <button onClick={() => handleTypeChange("expense")} className={`flex-1 py-3 rounded-xl transition-all ${formData.type === "expense" ? "bg-white text-red-500 shadow-sm font-black" : ""}`}>支出</button>
            <button onClick={() => handleTypeChange("income")} className={`flex-1 py-3 rounded-xl transition-all ${formData.type === "income" ? "bg-white text-green-500 shadow-sm font-black" : ""}`}>收入</button>
          </div>
          {/* 金額、類別、備註等欄位 */}
          {/* ... (為簡潔略過與之前相同的 form 邏輯代碼，請保留你那邊完整的 form 內容) */}
          
          <div className="relative flex flex-col items-center justify-center mb-6 py-2 min-h-[80px] text-gray-800">
            {isSplit && <span className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">自動加總金額</span>}
            <div className="flex items-center justify-center cursor-pointer max-w-full overflow-hidden" onClick={() => !isSplit && inputRef.current?.focus()}>
              <span className="text-2xl font-black text-gray-300 mr-1 mt-2 shrink-0">$</span>
              <div className={`text-5xl font-black text-center min-w-[1.5rem] tracking-tighter truncate transition-colors ${formData.type === "expense" ? "text-red-500" : "text-green-500"}`}>{renderAmount()}</div>
              {!isSplit && <input ref={inputRef} type="text" inputMode="text" className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer font-black" value={formData.amount} onFocus={() => setIsFocused(true)} onBlur={() => { setIsFocused(false); setFormData({ ...formData, amount: safeEvaluateMath(formData.amount) }); }} onChange={(e) => setFormData({ ...formData, amount: e.target.value })}/>}
            </div>
          </div>
          <div className="space-y-4 text-left">
            {/* ...其餘一般記帳欄位 */}
          </div>
          <button disabled={isSubmitDisabled} onClick={submitForm} className="w-full mt-8 py-5 bg-blue-600 text-white rounded-3xl font-black text-lg active:scale-95 transition shadow-xl shadow-blue-500/30 disabled:opacity-40 disabled:shadow-none flex justify-center items-center gap-2">
            {isSubmitting ? <SvgIcon name="spinner" size={20} className="animate-spin" /> : null} {isSubmitting ? "處理中..." : (isSplit ? `確認存檔 (${subItems.length}筆)` : "確認存檔")}
          </button>
        </>
      ) : formTab === 'shortcuts' ? (
        // 捷徑頁面
        {/* ... (保留原本的捷徑頁面邏輯) */}
      ) : (
        // 🚀 修改重點：AI 拍照面板 (視覺統一化，使用歷史清單樣式)
        <div className="animate-in space-y-5 text-center px-1">
          {/* 👉 1. 將原本突兀的藍色背景改為標準灰底卡片 (對齊歷史清單群組卡片) */}
          <div className="bg-gray-100/70 p-6 rounded-3xl border border-gray-100 shadow-inner space-y-5">
            <div>
              {/* 👉 2. 字體顏色統一 */}
              <h3 className="font-black text-gray-900 text-xl tracking-tight mb-2">讓 AI 幫你自動記帳</h3>
              <p className="text-xs text-gray-500 font-bold leading-relaxed">
                支援電子發票、傳統收據、水電帳單。<br/>
                拍下單據，AI 會自動為您拆分明細並計算總額。
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {/* 👉 3. 按鈕樣式也統一為幹練的樣式 */}
              <button 
                onClick={() => cameraInputRef.current?.click()} 
                disabled={isAIEvaluating} 
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg active:scale-95 shadow-md flex justify-center items-center gap-2 disabled:opacity-50 transition-all"
              >
                <SvgIcon name="camera" size={22} /> {isAIEvaluating ? "AI 處理中..." : "開啟相機拍照"}
              </button>
              
              {/* 👉 4. 這裡改為乾淨的灰底按鈕 (對齊歷史清單樣式) */}
              <button 
                onClick={() => albumInputRef.current?.click()} 
                disabled={isAIEvaluating} 
                className="w-full py-4 bg-white text-emerald-700 border-2 border-gray-100 rounded-2xl font-black text-lg active:scale-95 shadow-sm flex justify-center items-center gap-2 disabled:opacity-50 transition-all"
              >
                <SvgIcon name="album" size={22} /> 從相簿選擇圖片
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddTransactionForm;