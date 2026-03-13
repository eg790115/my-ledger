import React, { useState, useEffect } from 'react';
import { CATEGORY_MAP, BEN_OPTIONS } from '../utils/constants.js';
import { safeEvaluateMath, getParentCat, getChildCat } from '../utils/helpers.js';
import { SvgIcon } from './Icons.jsx';
import { CategorySelectPair } from './CategorySelectPair.jsx';

export const EditTransactionModal = ({ tx, loginUser, onSave, onDelete, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({ 
    ...tx, 
    parentCat: getParentCat(tx.category), 
    childCat: getChildCat(tx.category), 
    beneficiary: tx.beneficiary ? String(tx.beneficiary).split(",").filter(Boolean).map(s => s.trim()) : [tx.member] 
  });
  const [showConfirmDelete, setShowConfirmDelete] = useState(false); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const otherMember = loginUser === "爸爸" ? "媽媽" : "爸爸";

  useEffect(() => { 
    let fd = ""; 
    if (tx.date) { 
        fd = String(tx.date).replace(" (已編輯)", "").replace("(已編輯)", "").replace(/\//g, "-").replace(" ", "T"); 
        if (fd.length > 16) fd = fd.slice(0, 16); 
    } 
    setFormData(prev => ({ ...prev, date: fd })); 
  }, [tx]);

  const toggleBeneficiary = (b) => { 
      if (formData.beneficiary.includes(b)) { 
          if (formData.beneficiary.length > 1) setFormData({...formData, beneficiary: formData.beneficiary.filter(x => x !== b)}); 
      } else {
          setFormData({...formData, beneficiary: [...formData.beneficiary, b]});
      }
  };

  const handleSave = async () => {
    const finalAmount = safeEvaluateMath(formData.amount); 
    const oldCat = tx.category; 
    const newCat = `${formData.parentCat}/${formData.childCat}`; 
    const oldAmt = Number(tx.amount) || 0; 
    const newAmt = Number(finalAmount) || 0; 
    const oldDesc = (tx.desc || "").trim(); 
    const newDesc = (formData.desc || "").trim(); 
    const oldMember = tx.member; 
    const newMember = formData.member; 
    const oldBen = (tx.beneficiary || tx.member).trim(); 
    const newBen = formData.beneficiary.join(",").trim(); 
    const oldType = tx.type; 
    const newType = formData.type;

    if (oldCat === newCat && oldAmt === newAmt && oldDesc === newDesc && oldMember === newMember && oldBen === newBen && oldType === newType) { 
        onCancel(); 
        return; 
    }
    setIsSubmitting(true); 
    await onSave({ ...formData, amount: finalAmount, category: newCat, beneficiary: newBen }); 
    setIsSubmitting(false);
  };

  const handleDelete = async () => { 
      setIsSubmitting(true); 
      await onDelete(tx.id); 
      setIsSubmitting(false); 
  }

  return (
    <div className="fixed inset-0 z-[500] bg-gray-900/90 backdrop-blur-sm overflow-y-auto flex flex-col items-center justify-center p-4 sm:p-6 animate-in font-black" onClick={(e) => { if(e.target === e.currentTarget && !isLoading && !isSubmitting) onCancel(); }}>
      <div className="w-full max-w-sm relative">
        <button onClick={onCancel} disabled={isLoading || isSubmitting} className="absolute -top-12 right-0 text-white p-2 active:scale-90 opacity-80 hover:opacity-100 transition disabled:opacity-30"><SvgIcon name="close" size={32} /></button>
        <div className="bg-white p-5 sm:p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden pb-8">
          <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>
          <h2 className="text-xl font-black text-center mb-6 text-gray-800 pt-2">編輯明細</h2>
          <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-6 text-sm text-gray-500">
            <button onClick={() => { const p = "食"; const c = CATEGORY_MAP["expense"][p][0]; setFormData({ ...formData, type: "expense", parentCat: p, childCat: c }) }} className={`flex-1 py-3 rounded-xl transition-all ${formData.type === "expense" ? "bg-white text-red-500 shadow-sm font-black" : ""}`}>支出</button>
            <button onClick={() => { const p = "收入"; const c = CATEGORY_MAP["income"][p][0]; setFormData({ ...formData, type: "income", parentCat: p, childCat: c }) }} className={`flex-1 py-3 rounded-xl transition-all ${formData.type === "income" ? "bg-white text-green-500 shadow-sm font-black" : ""}`}>收入</button>
          </div>
          <div className="relative flex items-center justify-center mb-6 py-2 border-b border-gray-100 pb-6 text-gray-800 max-w-full overflow-hidden">
            <span className="text-2xl font-black text-gray-300 mr-1 mt-1 shrink-0">$</span>
            <input type="text" inputMode="text" className={`w-[120px] max-w-full text-4xl sm:text-5xl font-black text-center outline-none bg-transparent min-w-0 ${formData.type === "expense" ? "text-red-500" : "text-green-500"}`} value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} onBlur={() => setFormData({ ...formData, amount: safeEvaluateMath(formData.amount) })} />
          </div>
          <div className="space-y-4 text-left">
            <div className="bg-gray-100 py-1.5 px-3 rounded-xl flex items-center justify-between border border-transparent focus-within:border-blue-200 transition-colors">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">時間</label>
              <input type="datetime-local" className="bg-transparent font-black border-none outline-none text-gray-800 text-xs w-[140px] md:w-[160px] text-right min-w-0" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
            </div>
            <div className="bg-gray-50 py-2 px-3 rounded-xl border border-gray-100 flex items-center justify-between">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2 shrink-0">對象</label>
              <div className="flex gap-1.5 flex-1 justify-end flex-wrap">{BEN_OPTIONS.map(b => (<button type="button" key={b} onClick={() => toggleBeneficiary(b)} className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all border ${formData.beneficiary.includes(b) ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "bg-white border-gray-200 text-gray-400 hover:bg-gray-50"}`}>{b}</button>))}</div>
            </div>
            <CategorySelectPair type={formData.type} parentCat={formData.parentCat} childCat={formData.childCat} onChange={(p, c) => setFormData({ ...formData, parentCat: p, childCat: c })} />
            <div className="bg-gray-100 py-2 px-3 rounded-xl border border-transparent focus-within:border-blue-200 transition-colors flex items-center gap-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">帳本</label>
              <select className="w-full bg-transparent border-none outline-none appearance-none font-black text-sm text-right min-w-0" value={formData.member} onChange={(e) => setFormData({ ...formData, member: e.target.value })}><option value={loginUser}>自己</option><option value={otherMember}>{otherMember}</option></select>
            </div>
            <div className="bg-gray-100 py-2 px-3 rounded-xl border border-transparent focus-within:border-blue-200 transition-colors flex items-center gap-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">備註</label>
              <input type="text" className="w-full bg-transparent font-bold border-none outline-none text-gray-800 placeholder:text-gray-300 text-sm text-right min-w-0" placeholder="選填" value={formData.desc} onChange={(e) => setFormData({ ...formData, desc: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 mt-8">
            {!showConfirmDelete ? (
              <><button disabled={isLoading || isSubmitting} onClick={() => setShowConfirmDelete(true)} className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-black active:scale-95 transition-all flex items-center justify-center gap-1 disabled:opacity-30"><SvgIcon name="trash" size={18} /> 刪除</button><button disabled={!formData.amount || formData.amount === "0" || isLoading || isSubmitting} onClick={handleSave} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black active:scale-95 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-30 flex justify-center items-center gap-2">{isSubmitting ? <SvgIcon name="spinner" size={16} className="animate-spin" /> : null} {isSubmitting ? "處理中..." : "儲存變更"}</button></>
            ) : (
              <div className="w-full animate-in bg-red-50 p-4 rounded-2xl text-center border border-red-100">
                <p className="text-red-600 font-black text-xs mb-3">確定放入資源回收桶？</p>
                <div className="flex gap-2 flex-wrap"><button onClick={() => setShowConfirmDelete(false)} className="flex-1 min-w-[100px] py-3 bg-white text-gray-600 rounded-xl font-black active:scale-95 border border-gray-200">保留</button><button disabled={isLoading || isSubmitting} onClick={handleDelete} className="flex-1 min-w-[100px] py-3 bg-red-600 text-white rounded-xl font-black active:scale-95 shadow-md shadow-red-500/20 disabled:opacity-30">確認刪除</button></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};