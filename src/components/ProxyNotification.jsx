import React from 'react';
import { SvgIcon } from './Icons';
import { getParentCat, getChildCat, displayDateClean } from '../utils/helpers';

export const ProxyNotification = ({ transactions, onAck }) => {
  if (!transactions || transactions.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[900] flex justify-center pointer-events-none">
      <div className="bg-white/95 backdrop-blur-xl w-full max-w-sm rounded-[2rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-gray-100 overflow-hidden flex flex-col max-h-[75vh] animate-slide-down pointer-events-auto">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500"></div>
        
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-base font-black text-gray-800 flex items-center gap-1.5">
            <SvgIcon name="info" size={18} className="text-blue-500" /> 
            收到 {transactions.length} 筆代記帳目
          </h2>
          <p className="text-[10px] text-gray-500 mt-1">以下是其他成員幫您新增的帳目，請過目：</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-1 space-y-2 scrollbar-hide pb-2">
          {transactions.map(tx => (
            <div key={tx.id} className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100 flex items-center gap-3 shadow-sm">
              <div className="shrink-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[12px] leading-none ${tx.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {tx.type === "income" ? "收" : "支"}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13px] leading-tight text-gray-800 truncate">
                  {getParentCat(tx.category)} - {getChildCat(tx.category)}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">{displayDateClean(tx.date)}</div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <div className={`font-black tabular-nums text-sm leading-none ${tx.type === "income" ? "text-green-600" : "text-red-600"}`}>
                  ${Number(tx.amount || 0).toLocaleString()}
                </div>
                <div className="text-[9px] text-gray-500 mt-1 bg-white px-1.5 py-0.5 border border-gray-200 rounded">
                  ✍️ {tx.recorder}代記
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-white border-t border-gray-50">
          <button 
            onClick={onAck} 
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black active:scale-95 shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all text-sm"
          >
            知道啦
          </button>
        </div>
      </div>
    </div>
  );
};