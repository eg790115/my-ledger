import React from 'react';
import { CATEGORY_MAP } from '../utils/constants.js';

export const CategorySelectPair = ({ type, parentCat, childCat, onChange }) => {
  const pCats = Object.keys(CATEGORY_MAP[type] || CATEGORY_MAP.expense);
  const safeParentCat = pCats.includes(parentCat) ? parentCat : pCats[0];
  const cCats = CATEGORY_MAP[type][safeParentCat] || CATEGORY_MAP[type][pCats[0]];
  
  return (
    <div className="flex gap-2">
      <div className="bg-gray-100 p-2 px-3 rounded-xl flex-1 min-w-0 border border-transparent focus-within:border-blue-200 transition-colors">
        <label className="text-[8px] font-black text-blue-500 uppercase block mb-0.5 tracking-widest">主類別</label>
        <select 
          className="w-full bg-transparent border-none outline-none appearance-none font-black text-sm text-gray-800" 
          value={safeParentCat} 
          onChange={e => onChange(e.target.value, CATEGORY_MAP[type][e.target.value][0])}
        >
          {pCats.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="bg-gray-100 p-2 px-3 rounded-xl flex-1 min-w-0 border border-transparent focus-within:border-blue-200 transition-colors">
        <label className="text-[8px] font-black text-blue-500 uppercase block mb-0.5 tracking-widest">子項目</label>
        <select 
          className="w-full bg-transparent border-none outline-none appearance-none font-black text-sm text-gray-800" 
          value={childCat} 
          onChange={e => onChange(safeParentCat, e.target.value)}
        >
          {cCats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  );
};