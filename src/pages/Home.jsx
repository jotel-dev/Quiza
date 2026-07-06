import React, { useState } from "react";
import {
  Trophy, User,
  Search, Bell, ChevronDown, Play, Calendar, FlaskConical, Landmark,
  CircleDot, Film, Globe2, Flame, Target, Users, CheckCircle2, XCircle
} from "lucide-react";



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

export default function Home({ onStartQuiz, onStartDailyChallenge, stats, recentGames = [], walletAddress, onConnectWallet, onDisconnectWallet }) {
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const isDailyChallengePlayed = stats?.lastDailyChallengeDate === new Date().toDateString();

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
      <div className="flex items-center justify-between gap-3 sm:gap-4 mb-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Quiza Logo" className="h-9 sm:h-11 w-auto object-contain lg:hidden shrink-0" />
          <h1 className="text-xl font-bold text-slate-800 lg:hidden">Quiza</h1>
        </div>
        <div className="flex items-center gap-3">
          {walletAddress ? (
            <div className="relative">
              <button 
                onClick={() => setShowWalletMenu(!showWalletMenu)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full shadow-sm hover:bg-slate-100 transition"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-sm font-semibold text-slate-700 font-mono tracking-tight">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              </button>
              {showWalletMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-lg py-1 z-50">
                  <button
                    onClick={() => {
                      setShowWalletMenu(false);
                      onDisconnectWallet();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-semibold transition"
                  >
                    Disconnect Wallet
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={onConnectWallet} 
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-[#4F46E5] text-sm font-bold rounded-full hover:bg-indigo-100 transition active:scale-95"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <GlassCard className="p-8 sm:p-12 bg-gradient-to-br from-indigo-50/80 via-white to-orange-50/40 relative overflow-hidden w-full">
          <div className="relative z-10 max-w-2xl">
            <p className="text-sm sm:text-base text-slate-500 font-medium tracking-wide uppercase">Welcome back,</p>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-800 mt-2 leading-tight">
              Ready to <span className="text-[#4F46E5]">test your knowledge?</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-500 mt-4 leading-relaxed max-w-lg">
              Play a round, stake CELO or cUSD, and become the trivia champion.
            </p>
            <div className="flex items-center gap-4 mt-8">
              <button
                onClick={onStartQuiz}
                className="flex items-center gap-2 bg-[#4F46E5] text-white text-base font-semibold px-6 py-3 rounded-xl shadow-lg shadow-indigo-200 hover:opacity-90 transition hover:-translate-y-0.5 active:scale-95"
              >
                <Play size={18} fill="white" />
                Start Quiz
              </button>
              <button 
                onClick={onStartDailyChallenge}
                disabled={isDailyChallengePlayed}
                className={`flex items-center gap-2 border text-base font-semibold px-6 py-3 rounded-xl shadow-sm transition ${isDailyChallengePlayed ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:-translate-y-0.5 active:scale-95"}`}>
                <Calendar size={18} />
                {isDailyChallengePlayed ? "Come back tomorrow" : "Daily Challenge"}
              </button>
            </div>
          </div>
          <div className="absolute right-10 top-1/2 -translate-y-1/2 hidden md:flex w-56 h-56 rounded-full bg-white/60 items-center justify-center shadow-xl shadow-indigo-100/50">
            <span className="text-8xl">🤔</span>
          </div>
        </GlassCard>

        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-4 px-1">Your Statistics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Quizzes Played" value={stats.played} icon={Users} iconColor="#4F46E5" iconBg="#EEF2FF" />
            <StatCard label="Best Score" value={stats.bestScore} icon={Trophy} iconColor="#F59E0B" iconBg="#FEF3E2" />
            <StatCard label="Accuracy" value={`${stats.accuracy}%`} icon={Target} iconColor="#10B981" iconBg="#ECFDF5" />
            <StatCard label="Current Streak" value={`${stats.streak} Days`} icon={Flame} iconColor="#EF4444" iconBg="#FEF2F2" />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-2">
          
          {/* Weekly Progress */}
          <GlassCard className="p-6 sm:p-8 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold text-slate-800">Weekly Progress</h2>
              <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">Active Week</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" className="stroke-slate-100" strokeWidth="12" fill="none" />
                  <circle 
                    cx="50" cy="50" r="40" 
                    className="stroke-[#4F46E5] transition-all duration-1000 ease-out" 
                    strokeWidth="12" fill="none" strokeLinecap="round"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * Math.min(stats.weeklyQuizzes || 0, 10)) / 10}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-2xl font-black text-[#4F46E5]">{Math.round((Math.min(stats.weeklyQuizzes || 0, 10) / 10) * 100)}%</span>
                </div>
              </div>
              <div>
                {(stats.weeklyQuizzes || 0) >= 10 ? (
                  <>
                    <h3 className="text-lg font-extrabold text-slate-800">Weekly Goal Completed! 🎉</h3>
                    <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed">Amazing job! You've earned the weekly bonus. Keep up the streak next week.</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-extrabold text-slate-800">Great job! You're on fire 🔥</h3>
                    <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed">Complete {10 - (stats.weeklyQuizzes || 0)} more quizzes to earn the weekly bonus</p>
                  </>
                )}
              </div>
            </div>
            <div className="mt-8 flex items-center justify-between text-sm font-bold text-slate-400">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden mr-4">
                <div className="h-full bg-[#4F46E5] rounded-full transition-all duration-1000" style={{ width: `${Math.min(stats.weeklyQuizzes || 0, 10) * 10}%` }} />
              </div>
              <span>{Math.min(stats.weeklyQuizzes || 0, 10)} / 10 quizzes</span>
            </div>
          </GlassCard>

          {/* Recent Activity */}
          <GlassCard className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800">Recent Games Played</h2>
            </div>
            <div className="space-y-4">
              {recentGames.slice(0, 3).map((game) => {
                const diffHours = Math.floor((Date.now() - game.timestamp) / 3600000);
                const diffDays = Math.floor(diffHours / 24);
                let timeAgo = "Just now";
                if (diffDays > 0) timeAgo = `${diffDays}d ago`;
                else if (diffHours > 0) timeAgo = `${diffHours}h ago`;
                else if (Date.now() - game.timestamp > 60000) timeAgo = `${Math.floor((Date.now() - game.timestamp) / 60000)}m ago`;

                return (
                  <div key={game.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${game.won ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                        {game.won ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{game.type}</p>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Score: {game.score}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">
                      {timeAgo}
                    </span>
                  </div>
                );
              })}
              {recentGames.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">No recent games. Start playing!</p>
              )}
            </div>
          </GlassCard>

        </div>
      </div>
    </div>
  );
}
