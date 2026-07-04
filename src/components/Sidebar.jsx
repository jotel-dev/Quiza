import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Grid3x3, Timer, Trophy, Gift, Wallet, User } from 'lucide-react';
import GlassCard from './GlassCard';

const nav = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Grid3x3, label: "Categories", path: "/categories" },
  { icon: Timer, label: "Daily Challenge", path: "/challenge" },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
  { icon: Gift, label: "Rewards", path: "/rewards" },
  { icon: Wallet, label: "Wallet", path: "/wallet" },
  { icon: User, label: "Profile", path: "/profile" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-slate-100 p-5 shrink-0 bg-white/50 backdrop-blur-md">
      <div className="flex items-center gap-2 px-2 mb-8 cursor-pointer" onClick={() => navigate('/')}>
        <div className="w-9 h-9 rounded-xl bg-[#4F46E5] flex items-center justify-center shadow-lg shadow-indigo-200">
          <span className="text-white text-lg font-bold">?</span>
        </div>
        <div className="leading-tight">
          <p className="font-extrabold text-[#4F46E5] text-sm tracking-tight">QUIZA</p>
          <p className="font-extrabold text-slate-800 text-sm tracking-tight -mt-1">QUEST</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {nav.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
          return (
            <button
              key={label}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${isActive
                  ? "bg-[#4F46E5] text-white shadow-md shadow-indigo-200"
                  : "text-slate-500 hover:bg-slate-50"
                }`}
            >
              <Icon size={18} />
              {label}
            </button>
          );
        })}
      </nav>

      <GlassCard className="p-4 mt-4 text-center bg-gradient-to-b from-indigo-50 to-white">
        <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-[#F59E0B]/15 flex items-center justify-center">
          <Trophy size={26} className="text-[#F59E0B]" />
        </div>
        <p className="font-bold text-sm text-slate-800">Play, Learn & Win!</p>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Test your knowledge, earn rewards, and climb the leaderboard.
        </p>
        <button 
          onClick={() => navigate('/quiz')}
          className="mt-3 w-full bg-[#4F46E5] text-white text-xs font-semibold py-2.5 rounded-xl hover:opacity-90 transition active:scale-95"
        >
          Start Quiz Now →
        </button>
      </GlassCard>
    </aside>
  );
}
