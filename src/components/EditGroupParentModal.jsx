import React, { useState, useEffect } from 'react';
import { SvgIcon } from './Icons.jsx';

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

export const EditGroupParentModal = ({ group, onSave, onCancel, onDeleteGroup, isLoading, currentUser }) => {
  const [formData, setFormData] = useState({ parentTitle: group.parentTitle || "拆分紀錄", parentDesc: group.parentDesc || "", date: group.date });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newSubItems, setNewSubItems] = useState([]);
  const loginUser = currentUser?.name || group.recorder || "爸爸";
  const otherMember = loginUser === "爸爸" ? "媽媽" : "爸爸";
  
  useEffect(() => { 
      let fd = String(group.date || "").replace(" (已編輯)", "").replace("(已編輯)", "").replace(/\//g, "-").replace(" ", "T"); 
      if (fd.length > 16) fd = fd.slice(0, 16); 
      setFormData(prev => ({ ...prev, date: fd })); 
  }, [group]);

  const handleAddSubItem = () => {
    const defaultP = group.type === "expense" ? "食" : "收入"; 
    const defaultC = CATEGORY_MAP[group.type][defaultP][0]; 
    setNewSubItems([...newSubItems, { id: Date.now(), parentCat: defaultP, childCat: defaultC, amount: "", desc: "", beneficiary: [loginUser], member: loginUser }]);
  };

  const handleRemoveSubItem = id => setNewSubItems(newSubItems.filter(s => s.id !== id));
  const updateSubItem = (id, updates) => setNewSubItems(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  
  const toggleSubBeneficiary = (id, b) => { 
      setNewSubItems(newSubItems.map(s => { 
          if (s.id !== id) return s; 
          const newBen = s.beneficiary.includes(b) ? (s.beneficiary.length > 1 ? s.beneficiary.filter(x => x !== b) : s.beneficiary) : [...s.beneficiary, b]; 
          return { ...s, beneficiary: newBen }; 
      })); 
  };

  const handleSave = async () => {
    setIsSubmitting(true); 
    const newTitle = (formData.parentTitle || "拆分紀錄").trim(); 
    const newDesc = (formData.parentDesc || "").trim();
    const combinedParentDesc = `${newTitle}|||${newDesc}`; 

    const formattedNewSubs = newSubItems
      .map(s => ({ ...s, amount: safeEvaluateMath(s.amount) }))
      .filter(s => Number(s.amount) > 0)
      .map(s => ({
        amount: s.amount, 
        category: `${s.parentCat}/${s.childCat}`, 
        member: s.member, 
        recorder: loginUser,
        beneficiary: s.beneficiary.join(","), 
        type: group.type, 
        desc: s.desc, 
        date: formData.date, 
        parentDesc: combinedParentDesc,
        parentTitle: newTitle,
        groupId: group.groupId
      }));

    await onSave({ groupId: group.groupId, parentTitle: newTitle, parentDesc: combinedParentDesc, date: formData.date }, formattedNewSubs); 
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[500] bg-gray-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-6 animate-in font-black" onClick={(e) => { if(e.target === e.currentTarget && !isLoading && !isSubmitting) onCancel(); }}>
      <div className="w-full max-w-sm relative flex flex-col max-h-[90vh]">
        <button onClick={onCancel} disabled={isLoading || isSubmitting} className="absolute -top-12 right-0 text-white p-2 active:scale-90 opacity-80 hover:opacity-100 transition disabled:opacity-30">
          <SvgIcon name="close" size={32} />
        </button>
        <div className="bg-white rounded-[2.5rem] shadow-2xl relative flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gray-800"></div>
          
          <div className="p-5 sm:p-6 pb-2 shrink-0">
            <h2 className="text-xl font-black text-center mb-1 text-gray-800 pt-2 flex items-center justify-center gap-2"><SvgIcon name="edit" size={20} className="text-blue-500" /> 編輯母項目</h2>
            <p className="text-[10px] text-gray-400 text-center bg-gray-50 rounded-lg py-1 px-2 mb-2 border border-gray-100">修改將同步更新旗下所有明細，且可向下滾動補登遺漏</p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6 pb-6 space-y-4 custom-scrollbar">
            <div className="bg-gray-100 py-2.5 px-4 rounded-xl flex items-center justify-between border border-transparent focus-within:border-gray-300 transition-colors shadow-inner">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">時間</label>
                <input type="datetime-local" className="bg-transparent font-black border-none outline-none text-gray-800 text-sm flex-1 text-right min-w-0" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
            </div>
            <div className="bg-gray-100 py-3 px-4 rounded-xl flex flex-col gap-1 border border-transparent focus-within:border-gray-300 transition-colors shadow-inner">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">發票/多筆標題</label>
                <input type="text" className="w-full bg-transparent font-black border-none outline-none text-gray-800 placeholder:text-gray-300 text-sm min-w-0" placeholder="如：全聯發票" value={formData.parentTitle} onChange={(e) => setFormData({ ...formData, parentTitle: e.target.value })} />
            </div>
            <div className="bg-gray-100 py-3 px-4 rounded-xl flex flex-col gap-1 border border-transparent focus-within:border-gray-300 transition-colors shadow-inner">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">整筆備註 (選填)</label>
                <input type="text" className="w-full bg-transparent font-bold border-none outline-none text-gray-800 placeholder:text-gray-300 text-sm min-w-0" placeholder="這筆大採購的說明" value={formData.parentDesc} onChange={(e) => setFormData({ ...formData, parentDesc: e.target.value })} />
            </div>

            {/* 🚀 完全套用 AddTransactionForm 的 UI 樣式 */}
            <div className="mt-6 pt-5 border-t-2 border-dashed border-gray-200">
              <div className="flex items-center justify-between mb-3 px-1">
                <label className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-1"><SvgIcon name="plus" size={14} /> 補登遺漏明細</label>
                <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-bold">已補 {newSubItems.length} 筆</span>
              </div>
              
              <div className="space-y-3">
                {newSubItems.map((sub, index) => {
                  const pCats = Object.keys(CATEGORY_MAP[group.type] || CATEGORY_MAP.expense); 
                  const safeParentCat = pCats.includes(sub.parentCat) ? sub.parentCat : pCats[0]; 
                  const cCats = CATEGORY_MAP[group.type][safeParentCat] || CATEGORY_MAP[group.type][pCats[0]];
                  return (
                    <div key={sub.id} className="bg-white border-2 border-gray-100 p-3 rounded-2xl relative shadow-sm animate-in">
                      <button onClick={() => handleRemoveSubItem(sub.id)} className="absolute -top-2 -right-2 bg-red-100 text-red-600 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-sm font-bold active:scale-90 transition-transform">✕</button>
                      <div className="flex gap-2 mb-2">
                        <select className="flex-1 min-w-0 bg-gray-50 border-none outline-none appearance-none font-black text-xs px-2 py-2 rounded-xl text-gray-700" value={safeParentCat} onChange={(e) => updateSubItem(sub.id, {parentCat: e.target.value, childCat: CATEGORY_MAP[group.type][e.target.value][0]})}>{pCats.map(c => <option key={c} value={c}>{c}</option>)}</select>
                        <select className="flex-1 min-w-0 bg-gray-50 border-none outline-none appearance-none font-black text-xs px-2 py-2 rounded-xl text-gray-700" value={sub.childCat} onChange={(e) => updateSubItem(sub.id, {childCat: e.target.value})}>{cCats.map(c => <option key={c} value={c}>{c}</option>)}</select>
                      </div>
                      <div className="flex gap-2 mb-2 items-center">
                        <input type="text" className="flex-[3] min-w-0 bg-gray-50 font-bold border-none outline-none text-gray-800 placeholder:text-gray-400 text-xs px-2.5 py-2 rounded-xl" placeholder="子項備註(選填)" value={sub.desc} onChange={(e) => updateSubItem(sub.id, {desc: e.target.value})} />
                        <div className="flex-[2] min-w-0 relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">$</span><input type="text" inputMode="text" className="w-full bg-blue-50/50 font-black border-none outline-none text-blue-800 placeholder:text-blue-300 text-sm pl-5 pr-2 py-2 rounded-xl text-right min-w-0" placeholder="0" value={sub.amount} onChange={(e) => updateSubItem(sub.id, {amount: e.target.value})} onBlur={() => updateSubItem(sub.id, {amount: safeEvaluateMath(sub.amount)})} /></div>
                      </div>
                      <div className="flex flex-col gap-2 pt-2 border-t border-gray-50 mt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-gray-400 uppercase pr-2 shrink-0">記錄帳本</span>
                          <div className="flex gap-1 flex-1 justify-end flex-wrap">
                             <button type="button" onClick={() => updateSubItem(sub.id, {member: loginUser})} className={`px-2.5 py-1 rounded-md text-[9px] font-black transition-all border ${sub.member === loginUser ? "bg-gray-800 border-gray-800 text-white shadow-sm" : "bg-white border-gray-200 text-gray-400 hover:bg-gray-50"}`}>自己</button>
                             <button type="button" onClick={() => updateSubItem(sub.id, {member: otherMember})} className={`px-2.5 py-1 rounded-md text-[9px] font-black transition-all border ${sub.member === otherMember ? "bg-gray-800 border-gray-800 text-white shadow-sm" : "bg-white border-gray-200 text-gray-400 hover:bg-gray-50"}`}>幫{otherMember}記</button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-gray-400 uppercase pr-2 shrink-0">花費對象</span>
                          <div className="flex gap-1 flex-1 justify-end flex-wrap">{BEN_OPTIONS.map(b => (<button type="button" key={b} onClick={() => toggleSubBeneficiary(sub.id, b)} className={`px-2 py-1 rounded-md text-[9px] font-black transition-all border ${sub.beneficiary.includes(b) ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "bg-white border-gray-200 text-gray-400 hover:bg-gray-50"}`}>{b}</button>))}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <button onClick={handleAddSubItem} className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-xs active:scale-95 transition flex justify-center items-center gap-1 border border-blue-100 hover:bg-blue-100/70"><SvgIcon name="plus" size={16} /> 點此新增一筆遺漏</button>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 pt-4 shrink-0 border-t border-gray-100 bg-white flex flex-col gap-3">
            <button disabled={isLoading || isSubmitting} onClick={handleSave} className="w-full py-4 bg-gray-800 text-white rounded-2xl font-black active:scale-95 transition-all shadow-lg shadow-gray-800/20 disabled:opacity-30 flex justify-center items-center gap-2">
                {isSubmitting ? <SvgIcon name="spinner" size={16} className="animate-spin" /> : null} 
                {isSubmitting ? "處理中..." : (newSubItems.length > 0 ? `批次更新並寫入 ${newSubItems.length} 筆新帳` : "批次更新所有明細")}
            </button>
            
            <button 
              disabled={isLoading || isSubmitting} 
              onClick={() => {
                if(window.confirm(`確定要把「${formData.parentTitle}」裡的 ${group.children.length} 筆明細全部移至資源回收桶嗎？`)) {
                   onDeleteGroup(group.children);
                }
              }} 
              className="w-full py-3.5 bg-red-50 text-red-600 rounded-2xl font-black text-sm active:scale-95 transition-all disabled:opacity-30 hover:bg-red-100">
                🗑️ 刪除整筆發票
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};