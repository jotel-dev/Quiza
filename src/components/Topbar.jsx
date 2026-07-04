import React from 'react';
import { Search, Bell, ChevronDown, User } from 'lucide-react';
import ConnectWallet from './ConnectWallet';

export default function Topbar({ onConnectClick }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-6 sticky top-0 bg-white/80 backdrop-blur-md z-30 py-2 -mx-2 px-2 rounded-2xl">
      <div className="flex-1 max-w-sm relative group">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0A4C86] transition-colors" />
        <input
          placeholder="Search categories, quizzes..."
          className="w-full bg-slate-50 border border-slate-100 rounded-full pl-10 pr-4 py-2.5 text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:bg-white transition-all shadow-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <button className="relative w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors">
          <Bell size={16} className="text-slate-500" />
          <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
        </button>
        <ConnectWallet onClick={onConnectClick} />
        <button className="flex items-center gap-1.5 hover:bg-slate-50 rounded-full p-1 pr-2 transition-colors">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shadow-sm">
            <User size={14} className="text-[#0A4C86]" />
          </div>
          <ChevronDown size={14} className="text-slate-400" />
        </button>
      </div>
    </div>
  );
}
