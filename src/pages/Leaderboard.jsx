import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Target, Flame, ChevronRight, Loader2, Search } from "lucide-react";

const getMedalIcon = (index) => {
  if (index === 0) return <span className="text-2xl drop-shadow-md">🥇</span>;
  if (index === 1) return <span className="text-2xl drop-shadow-md">🥈</span>;
  if (index === 2) return <span className="text-2xl drop-shadow-md">🥉</span>;
  return null;
};

export default function Leaderboard({ darkMode, walletAddress }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRank, setCurrentUserRank] = useState(null);

  useEffect(() => {
    // Connect to SSE stream
    const eventSource = new EventSource("/api/leaderboard/stream");
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setPlayers(data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to parse leaderboard SSE:", err);
      }
    };

    eventSource.onerror = () => {
      console.error("SSE connection error");
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (!walletAddress) return;
    
    // Check if user is in top 20
    const inTop20 = players.findIndex((p) => p.address === walletAddress);
    if (inTop20 !== -1) {
      setCurrentUserRank({ ...players[inTop20], rank: inTop20 + 1 });
    } else {
      // Fetch rank separately
      fetch(`/api/leaderboard/${walletAddress}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) setCurrentUserRank(data);
        })
        .catch(console.error);
    }
  }, [players, walletAddress]);

  const bgStyle = darkMode ? "bg-slate-900 text-slate-100" : "bg-white text-slate-800";
  const cardStyle = darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100 shadow-[0_8px_30px_rgba(79,70,229,0.08)]";

  if (loading) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-6 ${bgStyle}`}>
        <Loader2 size={32} className="text-[#4F46E5] animate-spin mb-4" />
        <p className="font-semibold">Loading Leaderboard...</p>
      </div>
    );
  }

  return (
    <div className={`flex-1 p-4 sm:p-6 overflow-y-auto ${bgStyle} pb-32 relative`}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10 mt-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-100 mb-4 shadow-lg shadow-indigo-200">
            <Trophy size={32} className="text-[#4F46E5]" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Global Leaderboard</h1>
          <p className="text-slate-400 mt-2 text-sm max-w-md mx-auto">
            The best of the best. Play quizzes, earn points, and claim your spot at the top.
          </p>
        </div>

        {players.length === 0 ? (
          <div className={`text-center py-16 rounded-3xl border ${cardStyle}`}>
            <span className="text-5xl mb-4 block">🏆</span>
            <h3 className="text-xl font-bold mb-2">No leaderboard data yet.</h3>
            <p className="text-slate-400 text-sm">Be the first player to complete a quiz and claim the #1 spot!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {players.map((player, index) => {
                const isCurrentUser = player.address === walletAddress;
                return (
                  <motion.div
                    key={player.address}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className={`flex items-center p-4 sm:p-5 rounded-2xl border transition-all ${
                      isCurrentUser 
                        ? (darkMode ? "bg-indigo-900/40 border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.2)]" : "bg-indigo-50 border-[#4F46E5] shadow-[0_0_0_2px_rgba(79,70,229,0.1)]")
                        : cardStyle
                    }`}
                  >
                    <div className="w-10 text-center font-bold text-slate-400 mr-2 sm:mr-4 shrink-0">
                      {getMedalIcon(index) || `#${index + 1}`}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold truncate text-base sm:text-lg">
                          {player.username || player.address.slice(0,6) + "..."}
                        </h3>
                        {isCurrentUser && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#4F46E5] text-white">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-medium text-slate-400 mt-1">
                        <span className="flex items-center gap-1"><Target size={12}/> {Math.round(player.accuracy || 0)}%</span>
                        <span className="flex items-center gap-1"><Flame size={12} className={player.streak > 2 ? "text-orange-500" : ""}/> {player.streak} streak</span>
                      </div>
                    </div>

                    <div className="text-right ml-4 shrink-0">
                      <div className="font-black text-lg sm:text-xl text-[#4F46E5]">
                        {player.totalPoints.toLocaleString()}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Points
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Pinned Current User Card (if outside top 20 or viewing the list) */}
      {currentUserRank && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl ${darkMode ? "bg-slate-800" : "bg-white"} rounded-2xl shadow-[0_10px_50px_rgba(0,0,0,0.15)] border border-slate-200/50 p-4 z-10 flex items-center`}>
          <div className="w-10 text-center font-bold text-[#4F46E5] mr-3">
            #{currentUserRank.rank}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm">Your Ranking</h3>
            <p className="text-xs text-slate-400">Keep playing to climb higher!</p>
          </div>
          <div className="text-right">
             <div className="font-bold text-[#4F46E5]">{currentUserRank.totalPoints} pts</div>
          </div>
        </div>
      )}
    </div>
  );
}
