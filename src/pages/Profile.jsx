import React from "react";
import { User, Wallet, Trophy, Target, Flame, Users, CheckCircle2, XCircle } from "lucide-react";

function GlassCard({ children, className = "" }) {
  return (
    <div className={`rounded-[22px] border border-white/60 shadow-[0_8px_30px_rgba(79,70,229,0.08)] backdrop-blur-xl bg-white/70 ${className}`}>
      {children}
    </div>
  );
}

export default function Profile({ stats, recentGames, walletAddress, onConnectWallet, onDisconnectWallet }) {
  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto min-h-full flex flex-col">
      <div className="flex items-center gap-3 sm:gap-4 mb-8">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Quiza Logo" className="h-9 sm:h-11 w-auto object-contain lg:hidden shrink-0" />
          <h1 className="text-xl font-bold text-slate-800 lg:hidden">Quiza</h1>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 hidden lg:block">Profile</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6 flex-1">
        
        {/* Left Column - User Identity & Lifetime Stats */}
        <div className="space-y-6">
          <GlassCard className="p-8 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center mb-4 text-[#4F46E5] shadow-inner shadow-indigo-200/50">
              <User size={48} />
            </div>
            {walletAddress ? (
              <>
                <p className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-1">Connected Wallet</p>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full mb-4">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  <span className="text-base font-semibold text-slate-700 font-mono tracking-tight">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </span>
                </div>
                <button 
                  onClick={onDisconnectWallet}
                  className="text-sm font-bold text-red-500 hover:text-red-600 transition"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <p className="text-slate-500 text-sm mb-4">No wallet connected</p>
                <button 
                  onClick={onConnectWallet} 
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#4F46E5] text-white text-sm font-bold rounded-xl shadow-md shadow-indigo-200 hover:opacity-90 transition active:scale-95"
                >
                  <Wallet size={16} />
                  Connect Wallet
                </button>
              </>
            )}
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Lifetime Statistics</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs text-slate-500 font-medium">Played</p>
                <p className="text-xl font-bold text-slate-800 mt-1">{stats.played}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs text-slate-500 font-medium">Best Score</p>
                <p className="text-xl font-bold text-slate-800 mt-1">{stats.bestScore}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs text-slate-500 font-medium">Accuracy</p>
                <p className="text-xl font-bold text-slate-800 mt-1">{stats.accuracy}%</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs text-slate-500 font-medium">Max Streak</p>
                <p className="text-xl font-bold text-slate-800 mt-1">{stats.streak} Days</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right Column - Recent History */}
        <div className="space-y-6">
          <GlassCard className="p-6 sm:p-8 h-full">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Match History</h2>
            
            {recentGames.length > 0 ? (
              <div className="space-y-3">
                {recentGames.map((game) => (
                  <div key={game.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${game.won ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                        {game.won ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{game.type}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{new Date(game.timestamp).toLocaleDateString()} at {new Date(game.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800">{game.score} pts</p>
                      <p className={`text-xs font-semibold mt-0.5 ${game.won ? 'text-green-500' : 'text-red-400'}`}>
                        {game.won ? "Won" : "Lost"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
                  <Trophy size={24} className="text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">No games played yet</p>
                <p className="text-sm text-slate-400 mt-1">Play a quiz to see your history here.</p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
