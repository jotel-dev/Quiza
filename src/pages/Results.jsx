import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Trophy, RotateCcw, Share2, Check, X, Target, Coins, Home } from "lucide-react";

function useCountUp(target, durationMs = 900, start = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    let raf;
    const step = (t) => {
      if (startTime === null) startTime = t;
      const progress = Math.min((t - startTime) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, start]);
  return value;
}

function ConfettiField() {
  const pieces = Array.from({ length: 30 });
  const colors = ["#0A4C86", "#F26722", "#10B981", "#EF4444"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="absolute top-0 w-2 h-2 rounded-sm animate-confetti-fall"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: colors[i % colors.length],
            animationDelay: `${Math.random() * 0.6}s`,
            animationDuration: `${1.8 + Math.random() * 1.2}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const score = location.state?.score || 0;
  const total = location.state?.total || 4;
  const correct = location.state?.correct || 0;
  const wrong = location.state?.wrong || 0;
  
  const won = (correct / total) >= 0.7; // 70% threshold

  const RESULT = {
    correct,
    wrong,
    total,
    score,
    won,
    stake: 0.01,
    payout: 0.015,
    token: "cUSD",
  };

  const [showTrophy, setShowTrophy] = useState(false);
  const accuracy = Math.round((RESULT.correct / RESULT.total) * 100) || 0;
  const scoreCount = useCountUp(RESULT.score, 1000, showTrophy);
  const accuracyCount = useCountUp(accuracy, 1000, showTrophy);

  useEffect(() => {
    const t = setTimeout(() => setShowTrophy(true), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center font-sans p-4 relative overflow-hidden">
      <style>{`
        @keyframes trophy-pop {
          0% { transform: scale(0) rotate(-15deg); opacity: 0; }
          60% { transform: scale(1.15) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .animate-trophy { animation: trophy-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }
        .animate-confetti-fall { animation: confetti-fall linear forwards; }

        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in-up 0.5s ease-out forwards; opacity: 0; }
      `}</style>

      {RESULT.won && showTrophy && <ConfettiField />}

      <div className="w-full max-w-md relative z-10">
        {/* Trophy */}
        <div className="flex justify-center mb-4">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg ${showTrophy ? "animate-trophy" : "opacity-0"}`}
            style={{
              background: RESULT.won
                ? "linear-gradient(135deg, #F26722, #FBBF24)"
                : "linear-gradient(135deg, #94A3B8, #CBD5E1)",
              boxShadow: RESULT.won ? "0 10px 30px rgba(245,158,11,0.35)" : "0 10px 30px rgba(148,163,184,0.3)",
            }}
          >
            <Trophy size={44} className="text-white" fill="white" />
          </div>
        </div>

        <div className="text-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <h1 className="text-2xl font-extrabold text-slate-800">
            {RESULT.won ? "Round complete! 🎉" : "So close — try again!"}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {RESULT.won
              ? "You beat the threshold and earned a payout."
              : "You didn't hit the win threshold this time."}
          </p>
        </div>

        {/* Score card */}
        <div
          className="rounded-[22px] border border-white/60 shadow-[0_8px_30px_rgba(79,70,229,0.08)] backdrop-blur-xl bg-slate-50/70 p-6 mt-6 animate-fade-in"
          style={{ animationDelay: "0.45s" }}
        >
          <div className="flex items-center justify-center gap-10 mb-6">
            <div className="text-center">
              <p className="text-3xl font-extrabold text-slate-800 tabular-nums">{scoreCount}</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Points</p>
            </div>
            <div className="w-px h-10 bg-slate-200" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Target size={16} className="text-[#10B981]" />
                <p className="text-3xl font-extrabold text-slate-800 tabular-nums">{accuracyCount}%</p>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Accuracy</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 bg-emerald-50 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-[#10B981] flex items-center justify-center shrink-0">
                <Check size={15} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-700">{RESULT.correct}</p>
                <p className="text-[10px] text-emerald-600/70 font-medium">Correct</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 bg-red-50 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-[#EF4444] flex items-center justify-center shrink-0">
                <X size={15} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-600">{RESULT.wrong}</p>
                <p className="text-[10px] text-red-500/70 font-medium">Wrong</p>
              </div>
            </div>
          </div>

          {/* Payout */}
          <div
            className="mt-4 rounded-xl px-4 py-3.5 flex items-center justify-between"
            style={{
              background: RESULT.won ? "linear-gradient(90deg, #F0F6FA, #FEF3E2)" : "#F8FAFC",
            }}
          >
            <div className="flex items-center gap-2.5">
              <Coins size={18} className={RESULT.won ? "text-[#F26722]" : "text-slate-400"} />
              <div>
                <p className="text-xs text-slate-400 font-medium">
                  {RESULT.won ? "You won" : "Stake"}
                </p>
                <p className={`text-sm font-bold ${RESULT.won ? "text-slate-800" : "text-slate-500"}`}>
                  {RESULT.won ? `+${RESULT.payout} ${RESULT.token}` : `${RESULT.stake} ${RESULT.token} staked`}
                </p>
              </div>
            </div>
            {RESULT.won && (
              <span className="text-[10px] font-bold text-[#0A4C86] bg-[#0A4C86]/10 px-2.5 py-1 rounded-full">
                1.5x
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-5 animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <button 
            onClick={() => navigate('/quiz')}
            className="flex-1 flex items-center justify-center gap-2 bg-[#0A4C86] text-white text-sm font-semibold py-3 rounded-xl shadow-md shadow-blue-200 hover:opacity-90 transition active:scale-95"
          >
            <RotateCcw size={15} />
            Play Again
          </button>
          <div className="flex gap-3">
            <button 
              onClick={() => navigate('/home')}
              className="flex items-center justify-center bg-white border border-slate-200 text-slate-600 w-12 h-[46px] rounded-xl hover:bg-slate-50 transition active:scale-95"
            >
              <Home size={18} />
            </button>
            <button className="flex items-center justify-center bg-white border border-slate-200 text-slate-600 w-12 h-[46px] rounded-xl hover:bg-slate-50 transition active:scale-95">
              <Share2 size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
