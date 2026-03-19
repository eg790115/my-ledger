import React from 'react';
import { SvgIcon } from './Icons';
import { getBenArray, getBenBadgeStyle, displayDateClean, getParentCat, getChildCat } from '../utils/helpers';

export const TransactionGroupCard = ({
  group, allowEdit = true, pendingMap, auditLogs, currentUser,
  setViewingHistoryItem, setEditingGroup, setEditingTx, triggerVibration,
  expandedGroups, toggleGroup
}) => {
  const isExp = !!expandedGroups[group.groupId];
  const allBens = new Set();
  (group.children || []).forEach(c => { if(c.beneficiary) String(c.beneficiary).split(",").filter(Boolean).forEach(b => allBens.add(b.trim())); });
  const parentBenArray = getBenArray(Array.from(allBens).join(","), group.member);
  const gAction = pendingMap[group.groupId];
  const hasChildAction = (group.children || []).some(c => pendingMap[c.id]);
  const isPendingDeleteGroup = (group.children || []).every(c => pendingMap[c.id] === 'DELETE_TX' || pendingMap[c.id] === 'HARD_DELETE_TX');
  const hasEditRecord = auditLogs.some(log => String(log.txId) === String(group.groupId));

  return (
    <div className={`flex items-stretch gap-2 mb-3 transition-opacity ${isPendingDeleteGroup ? 'opacity-40 grayscale' : 'opacity-100'}`}>
      {(gAction || hasChildAction) && (
        <div className={`shrink-0 w-6 flex items-center justify-center rounded-3xl shadow-sm border ${gAction==='UPDATE_GROUP_PARENT'?'bg-purple-50 border-purple-200 text-purple-700': isPendingDeleteGroup ? 'bg-red-50 border-red-200 text-red-700' : hasChildAction?'bg-gray-100 border-gray-200 text-gray-600':'bg-blue-50 border-blue-200 text-blue-700'}`}>
          <span className="text-[10px] font-black tracking-widest" style={{writingMode: 'vertical-rl'}}>{isPendingDeleteGroup?'待處理':gAction==='UPDATE_GROUP_PARENT'?'待處理': '待處理'}</span>
        </div>
      )}
      <div className="flex-1 min-w-0 w-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300">
        <div onClick={() => toggleGroup(group.groupId)} className="p-4 flex items-start sm:items-center gap-3 cursor-pointer active:bg-gray-50 transition-colors relative">
          <div className="relative shrink-0 mt-1 sm:mt-0">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-[17px] leading-none ${group.type==="income" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{group.type==="income" ? "收入" : "支出"}</div>
            <div className="absolute -bottom-1 -right-1 bg-gray-800 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md border-2 border-white shadow-sm z-10">多筆</div>
            {group.member !== currentUser?.name && ( <div className={`absolute -top-2 -left-2 text-[10px] font-black px-1.5 py-0.5 rounded-lg border-2 border-white shadow-sm ${group.member === "爸爸" ? "bg-blue-600" : group.member === "媽媽" ? "bg-pink-600" : "bg-gray-500"} text-white z-10`}>{group.member}</div> )}
          </div>
          <div className="flex-1 min-w-0 pl-1 pt-1">
            <div className="font-bold text-[14px] leading-tight text-gray-800 flex items-center gap-1.5 flex-wrap">
              <span className="truncate flex-shrink">{group.parentTitle}</span>
              <div className="flex gap-1 flex-wrap shrink-0">{parentBenArray.map(b => ( <span key={b} className={`text-[9px] px-1.5 py-0.5 rounded-md border font-black ${getBenBadgeStyle(b)}`}>{b}</span> ))}</div>
              <span className={`text-[10px] text-gray-400 transform transition-transform duration-300 shrink-0 ${isExp ? 'rotate-180' : ''}`}>▼</span>
            </div>
            <div className="flex flex-col gap-1.5 mt-1.5 w-full items-start">
              <div className="flex items-center gap-2 flex-wrap w-full">
                <span className="text-[10px] text-gray-400 font-medium leading-none shrink-0">{displayDateClean(group.date)}</span>
                {hasEditRecord && (
                  <button onClick={(e) => { triggerVibration(10); e.stopPropagation(); setViewingHistoryItem(group); }} className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md text-[9px] font-black border border-amber-200 active:scale-95 transition-transform whitespace-nowrap shrink-0">✏️ 已編輯</button>
                )}
              </div>
              {group.parentDesc && <div className="text-[11px] text-gray-600 font-bold bg-gray-50 px-2.5 py-1.5 rounded-lg break-words w-full border border-gray-100 shadow-sm leading-relaxed">{group.parentDesc}</div>}
            </div>
          </div>
          
          {/* 🌟 增加 pb-5 防止重疊 */}
          <div className="flex flex-col items-end justify-center shrink-0 pl-1 z-10 mt-1 sm:mt-0 pb-5">
            <div className={`font-black tabular-nums text-lg leading-none ${group.type==="income" ? "text-green-600" : "text-red-600"}`}>${Number(group.amount||0).toLocaleString()}</div>
            {group.recorder && group.recorder !== group.member && ( <div className={`mt-2 text-[9px] font-black px-1.5 py-0.5 rounded-md border shadow-sm ${group.recorder === "爸爸" ? "bg-blue-50 text-blue-600 border-blue-200" : group.recorder === "媽媽" ? "bg-pink-50 text-pink-600 border-pink-200" : "bg-gray-50 text-gray-500 border-gray-200"} whitespace-nowrap shrink-0`}>✍️ {group.recorder}代記</div> )}
          </div>
          
          {allowEdit && !isPendingDeleteGroup && (
            <button onClick={(e) => { triggerVibration(10); e.stopPropagation(); setEditingGroup(group); }} className="absolute bottom-2 right-2 p-1.5 text-gray-300 hover:text-blue-500 active:text-blue-600 active:scale-90 transition-all"><SvgIcon name="edit" size={13} /></button>
          )}
        </div>

        {isExp && (
          <div className="bg-gray-50/80 p-3 flex flex-col gap-2 border-t-2 border-gray-100 shadow-inner">
            {(group.children || []).map((child, idx) => {
              const childBenArray = getBenArray(child.beneficiary, group.member);
              const cAction = pendingMap[child.id];
              return (
                <div key={child.id} className={`w-full flex items-center gap-2 sm:gap-3 bg-white p-2.5 sm:p-3 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden transition-opacity ${cAction === 'DELETE_TX' || cAction === 'HARD_DELETE_TX' ? 'opacity-40 grayscale' : 'opacity-100'}`}>
                  {cAction && <div className={`absolute left-0 top-0 h-full w-1 ${cAction==='ADD'?'bg-green-400':cAction==='UPDATE_TX'?'bg-blue-400':'bg-red-400'}`}></div>}
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-100 text-gray-400 text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</div>
                  <div className="flex-1 min-w-0 pr-2 border-r border-gray-100">
                    <div className="font-bold text-xs sm:text-sm text-gray-800 flex items-center gap-1.5 flex-wrap leading-tight">
                      <span className="truncate flex-shrink">{getParentCat(child.category)} - {getChildCat(child.category)}</span>
                      {cAction === 'ADD' && <span className="shrink-0 bg-green-100 text-green-600 text-[8px] px-1.5 py-0.5 rounded-md border border-green-200 font-black">待處理</span>}
                      {cAction === 'UPDATE_TX' && <span className="shrink-0 bg-blue-100 text-blue-600 text-[8px] px-1.5 py-0.5 rounded-md border border-blue-200 font-black">待處理</span>}
                      {(cAction === 'DELETE_TX' || cAction === 'HARD_DELETE_TX') && <span className="shrink-0 bg-red-100 text-red-600 text-[8px] px-1.5 py-0.5 rounded-md border border-red-200 font-black">待處理</span>}
                      <div className="flex gap-1 flex-wrap shrink-0">{childBenArray.map(b => ( <span key={b} className={`text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-md border font-black ${getBenBadgeStyle(b)}`}>{b}</span> ))}</div>
                    </div>
                    {child.desc && <div className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5 whitespace-normal break-words">{child.desc}</div>}
                  </div>
                  
                  {/* 🌟 增加 pb-4 防止重疊 */}
                  <div className="flex flex-col items-end shrink-0 min-w-[3.5rem] text-right z-10 pb-4">
                    <div className={`font-black tabular-nums text-xs sm:text-sm ${child.type==="income" ? "text-green-600" : "text-gray-600"}`}>${Number(child.amount||0).toLocaleString()}</div>
                  </div>
                  
                  {allowEdit && cAction !== 'DELETE_TX' && cAction !== 'HARD_DELETE_TX' && (
                    <button onClick={(e) => { triggerVibration(10); e.stopPropagation(); setEditingTx(child); }} className="absolute bottom-1 right-1.5 p-1.5 text-gray-300 hover:text-blue-500 active:text-blue-600 active:scale-90 transition-all"><SvgIcon name="edit" size={11} /></button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  );
};