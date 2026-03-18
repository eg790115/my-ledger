import React, { useState, useEffect, useMemo, useRef } from 'react';

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

// 🌟 加入 onClose 參數
export const AddTransactionForm = ({ loginUser = "爸爸", onSubmit = () => {}, onClose, isLoading = false }) => {
  const [formTab, setFormTab] = useState('general');
  const [toastMsg, setToastMsg] = useState(""); 

  const inputRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isSplit, setIsSplit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ amount: "", parentCat: "食", childCat: "晚餐", member: loginUser, beneficiary: [loginUser], type: "expense", desc: "", parentTitle: "", parentDesc: "", date: "" });
  const [subItems, setSubItems] = useState([{ id: Date.now(), parentCat: "食", childCat: "晚餐", amount: "", desc: "", beneficiary: [loginUser] }]);
  const otherMember = loginUser === "爸爸" ? "媽媽" : "爸爸";
  
  const getCatParts = (catStr) => {
    if (!catStr) return ["食", "其他"];
    const parts = catStr.split("/");
    if (parts.length === 2) return parts;
    return ["食", catStr];
  };

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

  const [shortcuts, setShortcuts] = useState(loadShortcuts());

  useEffect(() => { 
    setFormData(prev => ({ ...prev, member: loginUser || prev.member, beneficiary: [loginUser || prev.member] })); 
    setSubItems(prev => prev.map(s => ({...s, beneficiary: [loginUser || prev.member]}))); 
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
      setSubItems([...subItems, { id: Date.now(), parentCat: defaultP, childCat: defaultC, amount: "", desc: "", beneficiary: [formData.member] }]); 
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
      const combinedParentDesc = `${formData.parentTitle.trim() || "多筆紀錄"}|||${formData.parentDesc.trim()}`;
      const multipleTxs = validSubs.map(s => ({ amount: s.amount, category: `${s.parentCat}/${s.childCat}`, member: formData.member, beneficiary: s.beneficiary.join(","), type: formData.type, desc: s.desc, date: formData.date, parentDesc: combinedParentDesc }));
      await onSubmit(multipleTxs);
    } else {
      const finalAmount = safeEvaluateMath(formData.amount);
      await onSubmit([{ ...formData, amount: finalAmount, category: `${formData.parentCat}/${formData.childCat}`, beneficiary: formData.beneficiary.join(",") }]);
    }
    setIsSubmitting(false);
  };
  
  const isSubmitDisabled = isSubmitting || isLoading || (isSplit ? totalSplitAmount === 0 : (!formData.amount || formData.amount === "0"));

  // 🌟 修改：儲存後觸發 Toast 並直接關閉頁面
  const saveShortcuts = () => {
    localStorage.setItem('quick_shortcuts', JSON.stringify(shortcuts));
    window.dispatchEvent(new Event('shortcuts_updated')); 
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) window.navigator.vibrate([20, 50, 20]);
    
    setToastMsg("✅ 已儲存設定"); 
    setTimeout(() => {
      setToastMsg("");
      if (onClose) onClose(); // 觸發關閉跳回首頁
    }, 500); 
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
        <button onClick={() => setFormTab('general')} className={`flex-1 py-3 text-[13px] font-black rounded-2xl transition-all ${formTab === 'general' ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>📝 一般記帳</button>
        <button onClick={() => setFormTab('shortcuts')} className={`flex-1 py-3 text-[13px] font-black rounded-2xl transition-all ${formTab === 'shortcuts' ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>⚡ 捷徑設定</button>
      </div>

      {formTab === 'general' ? (
        <>
          <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-6 text-sm text-gray-500">
            <button onClick={() => handleTypeChange("expense")} className={`flex-1 py-3 rounded-xl transition-all ${formData.type === "expense" ? "bg-white text-red-500 shadow-sm font-black" : ""}`}>支出</button>
            <button onClick={() => handleTypeChange("income")} className={`flex-1 py-3 rounded-xl transition-all ${formData.type === "income" ? "bg-white text-green-500 shadow-sm font-black" : ""}`}>收入</button>
          </div>
          <div className="relative flex flex-col items-center justify-center mb-6 py-2 min-h-[80px] text-gray-800">
            {isSplit && <span className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">自動加總金額</span>}
            <div className="flex items-center justify-center cursor-pointer max-w-full overflow-hidden" onClick={() => !isSplit && inputRef.current?.focus()}>
              <span className="text-2xl font-black text-gray-300 mr-1 mt-2 shrink-0">$</span>
              <div className={`text-5xl font-black text-center min-w-[1.5rem] tracking-tighter truncate transition-colors ${formData.type === "expense" ? "text-red-500" : "text-green-500"}`}>{renderAmount()}</div>
              {!isSplit && <input ref={inputRef} type="text" inputMode="text" className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer font-black" value={formData.amount} onFocus={() => setIsFocused(true)} onBlur={() => { setIsFocused(false); setFormData({ ...formData, amount: safeEvaluateMath(formData.amount) }); }} onChange={(e) => setFormData({ ...formData, amount: e.target.value })}/>}
            </div>
          </div>
          <div className="space-y-4 text-left">
            <div className="bg-gray-100 p-3 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-black text-gray-600 pl-2">拆分多筆明細 (如單張發票)</span>
              <button onClick={() => setIsSplit(!isSplit)} className={`w-12 h-6 shrink-0 rounded-full p-1 transition-colors duration-200 ease-in-out ${isSplit ? 'bg-blue-500' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${isSplit ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>
            <div className="bg-gray-100 py-1.5 px-3 rounded-xl flex items-center justify-between border border-transparent focus-within:border-blue-200 transition-colors">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">時間</label>
              <input type="datetime-local" className="bg-transparent font-black border-none outline-none text-gray-800 text-xs flex-1 text-right min-w-0" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
            </div>
            {!isSplit && (
              <>
                <div className="bg-gray-50 py-2 px-3 rounded-xl border border-gray-100 flex items-center justify-between">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2 shrink-0">對象</label>
                  <div className="flex gap-1.5 flex-1 justify-end flex-wrap">{BEN_OPTIONS.map(b => (<button type="button" key={b} onClick={() => toggleBeneficiary(b)} className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all border ${formData.beneficiary.includes(b) ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "bg-white border-gray-200 text-gray-400 hover:bg-gray-50"}`}>{b}</button>))}</div>
                </div>
                <CategorySelectPair type={formData.type} parentCat={formData.parentCat} childCat={formData.childCat} onChange={(p, c) => setFormData({ ...formData, parentCat: p, childCat: c })} />
                <div className="bg-gray-100 py-2.5 px-4 rounded-xl border border-transparent focus-within:border-blue-200 transition-colors flex items-center gap-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">備註</label>
                  <input type="text" className="w-full bg-transparent font-bold border-none outline-none text-gray-800 placeholder:text-gray-300 text-sm min-w-0" placeholder="輸入說明..." value={formData.desc} onChange={(e) => setFormData({ ...formData, desc: e.target.value })} />
                </div>
              </>
            )}
            {isSplit && (
              <>
                <div className="flex gap-2">
                  <div className="bg-gray-100 py-2 px-3 rounded-xl flex-1 min-w-0 focus-within:border-blue-200 border border-transparent transition-colors">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-0.5 tracking-widest">母項目標題</label>
                    <input type="text" className="w-full bg-transparent font-black border-none outline-none text-gray-800 placeholder:text-gray-300 text-xs min-w-0" placeholder="如：全聯發票" value={formData.parentTitle} onChange={(e) => setFormData({ ...formData, parentTitle: e.target.value })} />
                  </div>
                  <div className="bg-gray-100 py-2 px-3 rounded-xl flex-1 min-w-0 focus-within:border-blue-200 border border-transparent transition-colors">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-0.5 tracking-widest">母項目備註</label>
                    <input type="text" className="w-full bg-transparent font-bold border-none outline-none text-gray-800 placeholder:text-gray-300 text-xs min-w-0" placeholder="選填..." value={formData.parentDesc} onChange={(e) => setFormData({ ...formData, parentDesc: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <label className="text-[10px] font-black text-blue-500 uppercase block tracking-widest px-2">子項目明細與花費對象</label>
                  {subItems.map((sub, index) => {
                    const pCats = Object.keys(CATEGORY_MAP[formData.type] || CATEGORY_MAP.expense); const safeParentCat = pCats.includes(sub.parentCat) ? sub.parentCat : pCats[0]; const cCats = CATEGORY_MAP[formData.type][safeParentCat] || CATEGORY_MAP[formData.type][pCats[0]];
                    return (
                      <div key={sub.id} className="bg-white border-2 border-gray-100 p-3 rounded-2xl relative shadow-sm">
                        {subItems.length > 1 && (<button onClick={() => handleRemoveSubItem(sub.id)} className="absolute -top-2 -right-2 bg-red-100 text-red-600 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-sm font-bold">✕</button>)}
                        <div className="flex gap-2 mb-2">
                          <select className="flex-1 min-w-0 bg-gray-50 border-none outline-none appearance-none font-black text-xs px-2 py-2 rounded-xl text-gray-700" value={safeParentCat} onChange={(e) => { const newP = e.target.value; updateSubItem(sub.id, {parentCat: newP, childCat: CATEGORY_MAP[formData.type][newP][0]}); }}>{pCats.map(c => <option key={c} value={c}>{c}</option>)}</select>
                          <select className="flex-1 min-w-0 bg-gray-50 border-none outline-none appearance-none font-black text-xs px-2 py-2 rounded-xl text-gray-700" value={sub.childCat} onChange={(e) => updateSubItem(sub.id, {childCat: e.target.value})}>{cCats.map(c => <option key={c} value={c}>{c}</option>)}</select>
                        </div>
                        <div className="flex gap-2 mb-2 items-center">
                          <input type="text" className="flex-[3] min-w-0 bg-gray-50 font-bold border-none outline-none text-gray-800 placeholder:text-gray-400 text-xs px-2.5 py-2 rounded-xl" placeholder="子項備註(選填)" value={sub.desc} onChange={(e) => updateSubItem(sub.id, {desc: e.target.value})} />
                          <div className="flex-[2] min-w-0 relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">$</span><input type="text" inputMode="text" className="w-full bg-blue-50/50 font-black border-none outline-none text-blue-800 placeholder:text-blue-300 text-sm pl-5 pr-2 py-2 rounded-xl text-right min-w-0" placeholder="0" value={sub.amount} onChange={(e) => updateSubItem(sub.id, {amount: e.target.value})} onBlur={() => updateSubItem(sub.id, {amount: safeEvaluateMath(sub.amount)})} /></div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[9px] font-bold text-gray-400 uppercase pr-2 shrink-0">對象</span>
                          <div className="flex gap-1 flex-1 justify-end flex-wrap">{BEN_OPTIONS.map(b => (<button type="button" key={b} onClick={() => toggleSubBeneficiary(sub.id, b)} className={`px-2 py-1 rounded-md text-[9px] font-black transition-all border ${sub.beneficiary.includes(b) ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "bg-white border-gray-200 text-gray-400"}`}>{b}</button>))}</div>
                        </div>
                      </div>
                    )
                  })}
                  <button onClick={handleAddSubItem} className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-xs active:scale-95 transition flex justify-center items-center gap-1 border border-blue-100"><SvgIcon name="plus" size={16} /> 新增子項目</button>
                </div>
              </>
            )}
            <div className="bg-gray-50 py-2.5 px-4 rounded-2xl border border-gray-100 flex items-center justify-between">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0 mr-2">記錄帳本</label>
              <div className="flex gap-1.5 flex-wrap justify-end">
                <button type="button" onClick={() => setFormData({ ...formData, member: loginUser })} className={`px-4 py-1.5 rounded-lg text-[10px] transition-all border-2 font-black ${formData.member === loginUser ? "bg-gray-800 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-400"}`}>自己</button>
                <button type="button" onClick={() => setFormData({ ...formData, member: otherMember })} className={`px-4 py-1.5 rounded-lg text-[10px] transition-all border-2 font-black ${formData.member === otherMember ? "bg-gray-800 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-400"}`}>幫{otherMember}記</button>
              </div>
            </div>
          </div>
          <button disabled={isSubmitDisabled} onClick={submitForm} className="w-full mt-8 py-5 bg-blue-600 text-white rounded-3xl font-black text-lg active:scale-95 transition shadow-xl shadow-blue-500/30 disabled:opacity-40 disabled:shadow-none flex justify-center items-center gap-2">
            {isSubmitting ? <SvgIcon name="spinner" size={20} className="animate-spin" /> : null} {isSubmitting ? "處理中..." : (isSplit ? `確認存檔 (${subItems.length}筆)` : "確認存檔")}
          </button>
        </>
      ) : (
        /* ⚡ 捷徑設定內容 */
        <div className="text-left animate-in space-y-4">
          
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 shadow-sm space-y-3">
            <h4 className="font-black text-blue-600 text-sm flex items-center gap-1 mb-2">👈 左側長按捷徑</h4>
            
            <div className="flex gap-2">
              <div className="w-[4.5rem] shrink-0">
                <label className="text-[10px] text-gray-500 font-bold block mb-1">圖示</label>
                <select className="w-full bg-white px-1 py-2.5 rounded-xl text-center border border-gray-200 font-black appearance-none text-xl focus:border-blue-300 outline-none" value={shortcuts.left.icon} onChange={e => setShortcuts({...shortcuts, left: {...shortcuts.left, icon: e.target.value}})}>
                  {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[10px] text-gray-500 font-bold block mb-1">捷徑顯示名稱</label>
                <input className="w-full bg-white px-3 py-2.5 rounded-xl border border-gray-200 font-black focus:border-blue-300 outline-none" value={shortcuts.left.label} onChange={e => setShortcuts({...shortcuts, left: {...shortcuts.left, label: e.target.value}})} placeholder="例如：買飲料"/>
              </div>
            </div>

            <CategorySelectPair type="expense" parentCat={pLeft} childCat={cLeft} onChange={(p,c) => setShortcuts({...shortcuts, left: {...shortcuts.left, category: `${p}/${c}`}})} />
            
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <label className="text-[10px] text-gray-500 font-bold block mb-1">預設金額 <span className="text-blue-500 font-normal">(選填)</span></label>
                <input type="number" className="w-full bg-white px-3 py-2.5 rounded-xl border border-gray-200 font-black tabular-nums focus:border-blue-300 outline-none placeholder:text-gray-300" value={shortcuts.left.amount} onChange={e => setShortcuts({...shortcuts, left: {...shortcuts.left, amount: e.target.value}})} placeholder="滑動後填寫"/>
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[10px] text-gray-500 font-bold block mb-1">預設備註 <span className="text-blue-500 font-normal">(選填)</span></label>
                <input type="text" className="w-full bg-white px-3 py-2.5 rounded-xl border border-gray-200 font-black focus:border-blue-300 outline-none placeholder:text-gray-300" value={shortcuts.left.memo} onChange={e => setShortcuts({...shortcuts, left: {...shortcuts.left, memo: e.target.value}})} placeholder="例如：50嵐"/>
              </div>
            </div>
          </div>

          <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100 shadow-sm space-y-3">
            <h4 className="font-black text-green-600 text-sm flex items-center gap-1 mb-2">👉 右側長按捷徑</h4>
            
            <div className="flex gap-2">
              <div className="w-[4.5rem] shrink-0">
                <label className="text-[10px] text-gray-500 font-bold block mb-1">圖示</label>
                <select className="w-full bg-white px-1 py-2.5 rounded-xl text-center border border-gray-200 font-black appearance-none text-xl focus:border-green-300 outline-none" value={shortcuts.right.icon} onChange={e => setShortcuts({...shortcuts, right: {...shortcuts.right, icon: e.target.value}})}>
                  {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[10px] text-gray-500 font-bold block mb-1">捷徑顯示名稱</label>
                <input className="w-full bg-white px-3 py-2.5 rounded-xl border border-gray-200 font-black focus:border-green-300 outline-none" value={shortcuts.right.label} onChange={e => setShortcuts({...shortcuts, right: {...shortcuts.right, label: e.target.value}})} placeholder="例如：加油"/>
              </div>
            </div>

            <CategorySelectPair type="expense" parentCat={pRight} childCat={cRight} onChange={(p,c) => setShortcuts({...shortcuts, right: {...shortcuts.right, category: `${p}/${c}`}})} />
            
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <label className="text-[10px] text-gray-500 font-bold block mb-1">預設金額 <span className="text-green-500 font-normal">(選填)</span></label>
                <input type="number" className="w-full bg-white px-3 py-2.5 rounded-xl border border-gray-200 font-black tabular-nums focus:border-green-300 outline-none placeholder:text-gray-300" value={shortcuts.right.amount} onChange={e => setShortcuts({...shortcuts, right: {...shortcuts.right, amount: e.target.value}})} placeholder="滑動後填寫"/>
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[10px] text-gray-500 font-bold block mb-1">預設備註 <span className="text-green-500 font-normal">(選填)</span></label>
                <input type="text" className="w-full bg-white px-3 py-2.5 rounded-xl border border-gray-200 font-black focus:border-green-300 outline-none placeholder:text-gray-300" value={shortcuts.right.memo} onChange={e => setShortcuts({...shortcuts, right: {...shortcuts.right, memo: e.target.value}})} placeholder="例如：中油95"/>
              </div>
            </div>
          </div>

          <button onClick={saveShortcuts} className="w-full mt-4 py-4 bg-gray-800 text-white rounded-2xl font-black text-lg active:scale-95 shadow-xl shadow-gray-900/30 transition flex justify-center items-center gap-2">
            💾 儲存設定
          </button>
        </div>
      )}
    </div>
  );
};

export default AddTransactionForm;