import React from "react";
import {
  Trophy, User,
  Search, Bell, ChevronDown, Play, Calendar, FlaskConical, Landmark,
  CircleDot, Film, Globe2, Flame, Target, Users,
} from "lucide-react";

const categories = [
  { icon: FlaskConical, label: "Math", count: 10, color: "#4F46E5" },
  { icon: Landmark, label: "History", count: 10, color: "#F59E0B" },
  { icon: CircleDot, label: "Web3", count: 5, color: "#10B981" },
  { icon: Film, label: "General Knowledge", count: 10, color: "#EF4444" },
  { icon: Globe2, label: "Geography", count: 10, color: "#10B981" },
];

function GlassCard({ children, className = "" }) {
  return (
    <div className={`rounded-[22px] border border-white/60 shadow-[0_8px_30px_rgba(79,70,229,0.08)] backdrop-blur-xl bg-white/70 ${className}`}>
      {children}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, iconColor, iconBg }) {
  return (
    <GlassCard className="p-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
      </div>
      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: iconBg }}>
        <Icon size={18} style={{ color: iconColor }} />
      </div>
    </GlassCard>
  );
}

export default function Home({ onStartQuiz, stats }) {
  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex-1 max-w-sm relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            placeholder="Search categories, quizzes..."
            className="w-full bg-slate-50 border border-slate-100 rounded-full pl-10 pr-4 py-2.5 text-sm text-slate-600 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="relative w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center">
            <Bell size={16} className="text-slate-500" />
            <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
              <User size={16} className="text-[#4F46E5]" />
            </div>
            <ChevronDown size={14} className="text-slate-300" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5 min-w-0">
          <GlassCard className="p-6 sm:p-8 bg-gradient-to-br from-indigo-50/80 via-white to-orange-50/40 relative overflow-hidden">
            <div className="relative z-10 max-w-md">
              <p className="text-sm text-slate-400 font-medium">Welcome back,</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1 leading-snug">
                Ready to <span className="text-[#4F46E5]">test your knowledge?</span>
              </h1>
              <p className="text-sm text-slate-400 mt-3 leading-relaxed">
                Play a round, stake CELO or cUSD, and become the trivia champion.
              </p>
              <div className="flex items-center gap-3 mt-5">
                <button
                  onClick={onStartQuiz}
                  className="flex items-center gap-2 bg-[#4F46E5] text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-indigo-200 hover:opacity-90 transition active:scale-95"
                >
                  <Play size={14} fill="white" />
                  Start Quiz
                </button>
                <button 
                  onClick={() => alert("Daily Challenge is coming soon!")}
                  className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-50 transition active:scale-95">
                  <Calendar size={14} />
                  Daily Challenge
                </button>
              </div>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex w-40 h-40 rounded-full bg-white/60 items-center justify-center">
              <span className="text-6xl">🤔</span>
            </div>
          </GlassCard>

          <div>
            <h2 className="font-bold text-slate-800 mb-3">Categories</h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {categories.map(({ icon: Icon, label, count, color }) => (
                <GlassCard key={label} className="p-4 flex flex-col items-center text-center hover:-translate-y-0.5 transition-transform cursor-pointer">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-2" style={{ backgroundColor: `${color}1A` }}>
                    <Icon size={20} style={{ color }} />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">{label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{count} Questions</p>
                </GlassCard>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Quizzes Played" value={stats.played} icon={Users} iconColor="#4F46E5" iconBg="#EEF2FF" />
            <StatCard label="Best Score" value={stats.bestScore} icon={Trophy} iconColor="#F59E0B" iconBg="#FEF3E2" />
            <StatCard label="Accuracy" value={`${stats.accuracy}%`} icon={Target} iconColor="#10B981" iconBg="#ECFDF5" />
            <StatCard label="Current Streak" value={`${stats.streak} Days`} icon={Flame} iconColor="#EF4444" iconBg="#FEF2F2" />
          </div>
        </div>
      </div>
    </div>
  );
}
