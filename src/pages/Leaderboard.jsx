import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Target, Flame, ChevronRight, Loader2, Search } from "lucide-react";

const getMedalIcon = (index) => {
  if (index === 0) return <span className="text-2xl drop-shadow-md">🥇</span>;
  if (index === 1) return <span className="text-2xl drop-shadow-md">🥈</span>;
  if (index === 2) return <span className="text-2xl drop-shadow-md">🥉</span>;
  return null;
};

export default function Leaderboard({ walletAddress }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    import("../lib/firebase.js").then(({ db }) => {
      import("firebase/firestore").then(({ collection, query, orderBy, limit, onSnapshot, getDoc, doc, getCountFromServer, where }) => {
        const q = query(
          collection(db, "players"),
          orderBy("totalPoints", "desc"),
          limit(50)
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
          let docs = [];
          snapshot.forEach((d) => {
            const data = d.data();
            data.accuracy = data.totalQuestions > 0 ? (data.correctAnswers * 100) / data.totalQuestions : 0;
            docs.push(data);
          });

          // Sort in memory: Points DESC, Accuracy DESC, LastUpdated ASC
          docs.sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) return (b.totalPoints || 0) - (a.totalPoints || 0);
            if (b.accuracy !== a.accuracy) return (b.accuracy || 0) - (a.accuracy || 0);
            const aTime = a.lastUpdated?.toMillis?.() || 0;
            const bTime = b.lastUpdated?.toMillis?.() || 0;
            return aTime - bTime;
          });

          const top20 = docs.slice(0, 20);
          setPlayers(top20);
          setLoading(false);
          setErrorMsg(null);

          if (walletAddress) {
            const userIndex = docs.findIndex((p) => p.address === walletAddress);
            if (userIndex !== -1) {
              setCurrentUserRank({ ...docs[userIndex], rank: userIndex + 1 });
            } else {
              try {
                const userRef = doc(db, "players", walletAddress);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                  const userData = userSnap.data();
                  const higherScoreQ = query(collection(db, "players"), where("totalPoints", ">", userData.totalPoints || 0));
                  const countSnap = await getCountFromServer(higherScoreQ);
                  const rank = countSnap.data().count + 1;
                  setCurrentUserRank({ ...userData, rank });
                } else {
                  setCurrentUserRank(null);
                }
              } catch (err) {
                console.error("Failed to fetch user rank:", err);
                setCurrentUserRank(null);
              }
            }
          } else {
            setCurrentUserRank(null);
          }
        }, (err) => {
          console.error("Firebase snapshot error:", err);
          setErrorMsg(err.message || "Unknown error");
          setLoading(false);
        });

        return () => unsubscribe();
      }).catch(err => {
        console.error(err);
        setErrorMsg("Failed to load firestore");
        setLoading(false);
      });
    }).catch(err => {
      console.error(err);
      setErrorMsg("Failed to load firebase config");
      setLoading(false);
    });
  }, [walletAddress]);

  const bgStyle = "bg-white text-slate-800";
  const cardStyle = "bg-white border-slate-100 shadow-[0_8px_30px_rgba(79,70,229,0.08)]";

  if (loading) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-6 ${bgStyle}`}>
        <Loader2 size={32} className="text-[#4F46E5] animate-spin mb-4" />
        <p className="font-semibold">Loading Leaderboard...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-6 ${bgStyle}`}>
        <div className="text-red-500 mb-4 text-4xl">⚠️</div>
        <p className="font-semibold text-red-600 mb-2">Error Loading Leaderboard</p>
        <p className="text-sm text-slate-500 text-center max-w-md">{errorMsg}</p>
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
            <p className="text-slate-400 text-sm mb-4">Be the first player to complete a quiz and claim the #1 spot!</p>
            <div className="bg-slate-100 text-xs text-slate-500 p-3 rounded-lg mx-auto max-w-xs text-left">
              <p><strong>Debug Info:</strong></p>
              <p>Project ID: {import.meta.env.VITE_FIREBASE_PROJECT_ID || 'undefined'}</p>
              <p>Error: {errorMsg || 'none'}</p>
            </div>
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
                    className={`flex items-center p-4 sm:p-5 rounded-2xl border transition-all ${isCurrentUser
                        ? "bg-indigo-50 border-[#4F46E5] shadow-[0_0_0_2px_rgba(79,70,229,0.1)]"
                        : cardStyle
                      }`}
                  >
                    <div className="w-10 text-center font-bold text-slate-400 mr-2 sm:mr-4 shrink-0">
                      {getMedalIcon(index) || `#${index + 1}`}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold truncate text-base sm:text-lg">
                          {player.username || player.address.slice(0, 6) + "..."}
                        </h3>
                        {isCurrentUser && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#4F46E5] text-white">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-medium text-slate-400 mt-1">
                        <span className="flex items-center gap-1"><Target size={12} /> {Math.round(player.accuracy || 0)}%</span>
                        <span className="flex items-center gap-1"><Flame size={12} className={player.streak > 2 ? "text-orange-500" : ""} /> {player.streak} streak</span>
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
        <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl bg-white rounded-2xl shadow-[0_10px_50px_rgba(0,0,0,0.15)] border border-slate-200/50 p-4 z-10 flex items-center">
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
