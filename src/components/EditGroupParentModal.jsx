import React, { useState, useEffect } from 'react';
import { SvgIcon } from './Icons.jsx';

export const EditGroupParentModal = ({ group, onSave, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({ parentTitle: group.parentTitle, parentDesc: group.parentDesc, date: group.date });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => { 
      let fd = String(group.date || "").replace(" (已編輯)", "").replace("(已編輯)", "").replace(/\//g, "-").replace(" ", "T"); 
      if (fd.length > 16) fd = fd.slice(0, 16); 
      setFormData(prev => ({ ...prev, date: fd })); 
  }, [group]);

  const handleSave = async () => {
    const oldTitle = (group.parentTitle || "").trim(); 
    const newTitle = (formData.parentTitle || "拆分紀錄").trim(); 
    const oldDesc = (group.parentDesc || "").trim(); 
    const newDesc = (formData.parentDesc || "").trim();
    
    if (oldTitle === newTitle && oldDesc === newDesc && group.date === formData.date) { 
        onCancel(); 
        return; 
    }
    
    setIsSubmitting(true); 
    const combinedParentDesc = `${newTitle}|||${newDesc}`; 
    await onSave({ groupId: group.groupId, parentDesc: combinedParentDesc, date: formData.date }); 
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[500] bg-gray-900/90 backdrop-blur-sm overflow-y-auto flex flex-col items-center justify-center p-4 sm:p-6 animate-in font-black" onClick={(e) => { if(e.target === e.currentTarget && !isLoading && !isSubmitting) onCancel(); }}>
      <div className="w-full max-w-sm relative">
        <button onClick={onCancel} disabled={isLoading || isSubmitting} className="absolute -top-12 right-0 text-white p-2 active:scale-90 opacity-80 hover:opacity-100 transition disabled:opacity-30">
          <SvgIcon name="close" size={32} />
        </button>
        <div className="bg-white p-5 sm:p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden pb-8">
          <div className="absolute top-0 left-0 w-full h-2 bg-gray-800"></div>
          <h2 className="text-xl font-black text-center mb-2 text-gray-800 pt-2">編輯母項目</h2>
          <p className="text-[10px] text-gray-400 text-center mb-6">修改後將同步更新旗下所有明細的時間與標題</p>
          <div className="space-y-4 text-left">
            <div className="bg-gray-100 py-2.5 px-4 rounded-xl flex items-center justify-between border border-transparent focus-within:border-gray-300 transition-colors">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">時間</label>
                <input type="datetime-local" className="bg-transparent font-black border-none outline-none text-gray-800 text-sm flex-1 text-right min-w-0" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
            </div>
            <div className="bg-gray-100 py-3 px-4 rounded-xl flex flex-col gap-1 border border-transparent focus-within:border-gray-300 transition-colors">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">母項目標題</label>
                <input type="text" className="w-full bg-transparent font-black border-none outline-none text-gray-800 placeholder:text-gray-300 text-sm min-w-0" placeholder="如：全聯發票" value={formData.parentTitle} onChange={(e) => setFormData({ ...formData, parentTitle: e.target.value })} />
            </div>
            <div className="bg-gray-100 py-3 px-4 rounded-xl flex flex-col gap-1 border border-transparent focus-within:border-gray-300 transition-colors">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">母項目備註</label>
                <input type="text" className="w-full bg-transparent font-bold border-none outline-none text-gray-800 placeholder:text-gray-300 text-sm min-w-0" placeholder="選填" value={formData.parentDesc} onChange={(e) => setFormData({ ...formData, parentDesc: e.target.value })} />
            </div>
          </div>
          <div className="mt-8">
            <button disabled={isLoading || isSubmitting} onClick={handleSave} className="w-full py-4 bg-gray-800 text-white rounded-2xl font-black active:scale-95 transition-all shadow-lg disabled:opacity-30 flex justify-center items-center gap-2">
                {isSubmitting ? <SvgIcon name="spinner" size={16} className="animate-spin" /> : null} 
                {isSubmitting ? "處理中..." : "批次更新所有子項目"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};