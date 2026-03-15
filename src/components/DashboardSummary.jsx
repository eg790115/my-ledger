// src/components/DashboardSummary.jsx
import React from 'react';

const DashboardSummary = ({ stats }) => {
  return (
    <div className="bg-gray-900 p-8 rounded-[3rem] shadow-2xl text-white relative overflow-hidden text-center">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] rounded-full"></div>
      <span className="text-[10px] font-black uppercase mb-3 block tracking-widest text-blue-200">本期估算結餘</span>
      <div className="text-5xl font-black mb-8 tracking-tighter tabular-nums">
        ${stats.balance.toLocaleString()}
      </div>
      <div className="flex w-full gap-4 pt-6 border-t border-white/10 text-sm text-gray-300">
        <div className="flex-1 text-center">
          <p className="text-[9px] uppercase mb-1 font-black">本期收入</p>
          <p className="text-xl text-green-400 font-black">+${stats.income.toLocaleString()}</p>
        </div>
        <div className="flex-1 border-l border-white/10 text-center">
          <p className="text-[9px] uppercase mb-1 font-black">本期支出</p>
          <p className="text-xl text-red-400 font-black">-${stats.expense.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardSummary;