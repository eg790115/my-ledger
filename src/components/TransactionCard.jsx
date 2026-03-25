import React from 'react';
import { SvgIcon } from './Icons';
import { getBenArray, getBenBadgeStyle, displayDateClean, getParentCat, getChildCat } from '../utils/helpers';

export const TransactionCard = ({ 
  tx, allowEdit = true, pendingMap = {}, auditLogs = [], currentUser, 
  setViewingHistoryItem, setEditingTx, triggerVibration 
}) => {
  const benArray = getBenArray(tx.beneficiary, tx.member);
  const pAction = pendingMap[tx.id];
  
  const hasEditRecord = Array.isArray(tx.editHistory) && tx.editHistory.length > 0;

  return (
    <div className={`flex items-stretch gap-2 mb-3 transition-opacity ${pAction === 'DELETE_TX' || pAction === 'HARD_DELETE_TX' ? 'opacity-40 grayscale' : 'opacity-100'}`}>
      {pAction && (
        <div className={`shrink-0 w-6 flex items-center justify-center rounded-2xl shadow-sm border ${pAction==='ADD' || pAction === 'RESTORE_TX' ?'bg-green-50 border-green-200 text-green-700':pAction==='UPDATE_TX'?'bg-blue-50 border-blue-200 text-blue-700':'bg-red-50 border-red-200 text-red-700'}`}>
          <span className="text-[10px] font-black tracking-widest" style={{writingMode: 'vertical-rl'}}>{(pAction==='ADD' || pAction === 'RESTORE_TX')?'待處理':pAction==='UPDATE_TX'?'待處理':'待處理'}</span>
        </div>
      )}
      <div className="flex-1 min-w-0 w-full bg-white p-4 rounded-3xl border border-gray-100 flex items-start sm:items-center gap-3 shadow-sm relative overflow-hidden transition-colors">
        <div className="relative shrink-0 mt-1 sm:mt-0">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-[17px] leading-none ${tx.type==="income" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{tx.type==="income" ? "收入" : "支出"}</div>
          {tx.member !== currentUser?.name && ( <div className={`absolute -top-2 -left-2 text-[10px] font-black px-1.5 py-0.5 rounded-lg border-2 border-white shadow-sm ${tx.member === "爸爸" ? "bg-blue-600" : tx.member === "媽媽" ? "bg-pink-600" : "bg-gray-500"} text-white z-10`}>{tx.member}</div> )}
        </div>
        <div className="flex-1 min-w-0 pl-1 pt-1">
          <div className="font-bold text-[14px] leading-tight text-gray-800 flex items-center gap-1.5 flex-wrap">
            <span className="truncate flex-shrink">{getParentCat(tx.category)} - {getChildCat(tx.category)}</span>
            <div className="flex gap-1 flex-wrap shrink-0">{benArray.map(b => ( <span key={b} className={`text-[9px] px-1.5 py-0.5 rounded-md border font-black ${getBenBadgeStyle(b)}`}>{b}</span> ))}</div>
          </div>
          <div className="flex flex-col gap-1.5 mt-1.5 w-full items-start">
            <div className="flex items-center gap-2 flex-wrap w-full">
              <span className="text-[10px] text-gray-400 font-medium leading-none shrink-0">{displayDateClean(tx.date)}</span>
              {hasEditRecord && (
                <button onClick={(e) => { triggerVibration(10); e.stopPropagation(); setViewingHistoryItem(tx); }} className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md text-[9px] font-black border border-amber-200 active:scale-95 transition-transform whitespace-nowrap shrink-0">✏️ 已編輯</button>
              )}
            </div>
            {tx.desc && <div className="text-[11px] text-gray-600 font-bold bg-gray-50 px-2.5 py-1.5 rounded-lg break-words w-full border border-gray-100 shadow-sm leading-relaxed">{tx.desc}</div>}
          </div>
        </div>
        
        <div className="flex flex-col items-end justify-center shrink-0 pl-1 z-10 mt-1 sm:mt-0 pb-5">
          <div className={`font-black tabular-nums text-[17px] leading-none ${tx.type==="income" ? "text-green-600" : "text-red-600"}`}>${Number(tx.amount||0).toLocaleString()}</div>
          {tx.recorder && tx.recorder !== tx.member && ( <div className={`mt-2 text-[9px] font-black px-1.5 py-0.5 rounded-md border shadow-sm ${tx.recorder === "爸爸" ? "bg-blue-50 text-blue-600 border-blue-200" : tx.recorder === "媽媽" ? "bg-pink-50 text-pink-600 border-pink-200" : "bg-gray-50 text-gray-500 border-gray-200"} whitespace-nowrap shrink-0`}>✍️ {tx.recorder}代記</div> )}
        </div>
        
        {allowEdit && pAction !== 'DELETE_TX' && pAction !== 'HARD_DELETE_TX' && (
          <button onClick={(e) => { triggerVibration(10); e.stopPropagation(); setEditingTx(tx); }} className="absolute bottom-2 right-2 p-1.5 text-gray-300 hover:text-blue-500 active:text-blue-600 active:scale-90 transition-all"><SvgIcon name="edit" size={13} /></button>
        )}
      </div>
    </div>
  );
};