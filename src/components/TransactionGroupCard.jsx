import React from 'react';
import { SvgIcon } from './Icons';
import { getBenArray, getBenBadgeStyle, displayDateClean } from '../utils/helpers';
// 🚀 關鍵引入：直接使用現成的單筆卡片元件
import { TransactionCard } from './TransactionCard';

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
          <span className="text-[10px] font-black tracking-widest" style={{writingMode: 'vertical-rl'}}>待處理</span>
        </div>
      )}
      <div className="flex-1 min-w-0 w-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300">
        {/* 母項目顯示區 */}
        <div onClick={() => toggleGroup(group.groupId)} className="p-4 flex items-start sm:items-center gap-3 cursor-pointer active:bg-gray-50 transition-colors relative">
          <div className="relative shrink-0 mt-1 sm:mt-0">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-[17px] leading-none ${group.type==="income" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{group.type==="income" ? "收入" : "支出"}</div>
            <div className="absolute -bottom-1 -right-1 bg-gray-800 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md border-2 border-white shadow-sm z-10">多筆</div>
            {group.member !== currentUser?.name && (
              <div className={`absolute -top-2 -left-2 text-[10px] font-black px-1.5 py-0.5 rounded-lg border-2 border-white shadow-sm ${group.member === "爸爸" ? "bg-blue-600" : group.member === "媽媽" ? "bg-pink-600" : "bg-gray-500"} text-white z-10`}>{group.member}</div>
            )}
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
          <div className="flex flex-col items-end justify-center shrink-0 pl-1 z-10 mt-1 sm:mt-0 pb-5">
            <div className={`font-black tabular-nums text-lg leading-none ${group.type==="income" ? "text-green-600" : "text-red-600"}`}>${Number(group.amount||0).toLocaleString()}</div>
          </div>
          {allowEdit && !isPendingDeleteGroup && (
            <button onClick={(e) => { triggerVibration(10); e.stopPropagation(); setEditingGroup(group); }} className="absolute bottom-2 right-2 p-1.5 text-gray-300 hover:text-blue-500 active:text-blue-600 active:scale-90 transition-all"><SvgIcon name="edit" size={13} /></button>
          )}
        </div>

        {/* 🚀 子明細展開區：直接調用 TransactionCard */}
        {isExp && (
          <div className="bg-gray-50/50 p-2 sm:p-4 border-t border-gray-100 flex flex-col gap-2 shadow-inner">
            <div className="text-[10px] text-gray-400 font-black tracking-widest mb-1 pl-2">包含以下明細</div>
            {(group.children || []).map((child, idx) => (
              <div key={child.id} className="relative group/item">
                {/* 序號小圓鈕 */}
                <div className="absolute -left-1 sm:-left-3 top-4 w-5 h-5 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-[10px] font-black z-20 border border-white shadow-sm">
                  {idx + 1}
                </div>
                <div className="pl-3 sm:pl-4">
                  <TransactionCard
                    tx={child}
                    allowEdit={allowEdit}
                    pendingMap={pendingMap}
                    auditLogs={auditLogs}
                    currentUser={currentUser}
                    setViewingHistoryItem={setViewingHistoryItem}
                    setEditingTx={setEditingTx}
                    triggerVibration={triggerVibration}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};