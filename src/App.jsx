import React, { useState, useCallback } from "react";
import {
  Home, Grid3x3, Timer, Trophy, Gift, Award, Wallet, User, Settings,
  Search, Bell, ChevronDown, Play, Calendar, FlaskConical, Landmark,
  CircleDot, Film, Laptop, Globe2, Flame, Target, Users, TrendingUp,
  X, Coins, ChevronRight, Loader2, CheckCircle2, Clock, Check, SkipForward,
  Zap, RotateCcw, Share2,
} from "lucide-react";

import questionBank from "./data/questions.json";
import {
  connectWallet,
  ensureNetwork,
  stakeCelo,
  stakeCUSD,
  getRoundIdFromReceipt,
  submitRoundForVerification,
  withdrawWinnings,
  CUSD_ADDRESS,
} from "./lib/quizaContract.js";

const NETWORK = "mainnet"; // switch to "alfajores" while testing

/* -------------------------------------------------------------------- */
/*  Shared config                                                        */
/* -------------------------------------------------------------------- */
const STAKE_AMOUNT = 0.01;
const WIN_MULTIPLIER = 1.5;
const WIN_THRESHOLD = 0.7; // 7/10
const QUESTIONS_PER_ROUND = 10;
const TIME_PER_QUESTION = 15;

const TOKENS = [
  { symbol: "CELO", name: "Celo", color: "#F59E0B", balance: 4.2318 },
  { symbol: "cUSD", name: "Celo Dollar", color: "#4F46E5", balance: 12.5 },
];

function pickRoundQuestions() {
  const shuffled = [...questionBank.questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, QUESTIONS_PER_ROUND);
}

function GlassCard({ children, className = "" }) {
  return (
    <div className={`rounded-[22px] border border-white/60 shadow-[0_8px_30px_rgba(79,70,229,0.08)] backdrop-blur-xl bg-white/70 ${className}`}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  HOME SCREEN                                                          */
/* -------------------------------------------------------------------- */
const nav = [
  { icon: Home, label: "Home" },
  { icon: Grid3x3, label: "Categories" },
  { icon: Timer, label: "Daily Challenge" },
  { icon: Trophy, label: "Leaderboard" },
  { icon: Gift, label: "Rewards" },
  { icon: Award, label: "Achievements" },
  { icon: Wallet, label: "Wallet" },
  { icon: User, label: "Profile" },
  { icon: Settings, label: "Settings" },
];

const categories = [
  { icon: FlaskConical, label: "Math", count: 10, color: "#4F46E5" },
  { icon: Landmark, label: "History", count: 10, color: "#F59E0B" },
  { icon: CircleDot, label: "Web3", count: 5, color: "#10B981" },
  { icon: Film, label: "General Knowledge", count: 10, color: "#EF4444" },
  { icon: Globe2, label: "Geography", count: 10, color: "#10B981" },
];

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

function HomeScreen({ onStartQuiz, stats }) {
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
                <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-50 transition active:scale-95">
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

/* -------------------------------------------------------------------- */
/*  STAKE MODAL                                                          */
/* -------------------------------------------------------------------- */
function StakeModal({ onClose, onStaked }) {
  const [walletState, setWalletState] = useState("disconnected");
  const [address, setAddress] = useState(null);
  const [signer, setSigner] = useState(null);
  const [selectedToken, setSelectedToken] = useState(TOKENS[1]);
  const [txState, setTxState] = useState("idle");
  const [errorMsg, setErrorMsg] = useState(null);

  const handleConnect = async () => {
    setErrorMsg(null);
    setWalletState("connecting");
    try {
      // MiniPay is Celo-native and already on the right network — don't let
      // a chain-switch request (which MiniPay may not support) block connection.
      try {
        await ensureNetwork(NETWORK);
      } catch (switchErr) {
        console.warn("Network switch skipped/failed (likely MiniPay):", switchErr);
      }

      const { signer: s, address: addr } = await connectWallet();
      setSigner(s);
      setAddress(addr);
      setWalletState("connected");
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Failed to connect wallet");
      setWalletState("disconnected");
    }
  };

  const handleStake = async () => {
    setErrorMsg(null);
    setTxState("staking");
    try {
      const receipt =
        selectedToken.symbol === "CELO"
          ? await stakeCelo(signer, String(STAKE_AMOUNT), NETWORK)
          : await stakeCUSD(signer, String(STAKE_AMOUNT), NETWORK);

      const roundId = getRoundIdFromReceipt(receipt, NETWORK);
      setTxState("staked");
      // Give the "staked" confirmation a beat on screen before handing off
      setTimeout(() => onStaked({ token: selectedToken.symbol, roundId, address }), 900);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Staking transaction failed");
      setTxState("idle");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-[24px] border border-white/60 shadow-[0_20px_60px_rgba(79,70,229,0.15)] backdrop-blur-xl bg-white/90 p-6">
        <button onClick={onClose} className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition">
          <X size={14} className="text-slate-400" />
        </button>

        {walletState !== "connected" && (
          <div className="text-center py-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#4F46E5]/10 flex items-center justify-center mb-4">
              <Wallet size={26} className="text-[#4F46E5]" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Connect your wallet</h2>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
              Connect MiniPay to stake and play. Winnings pay out directly to your wallet.
            </p>
            <button
              onClick={handleConnect}
              disabled={walletState === "connecting"}
              className="w-full mt-5 flex items-center justify-center gap-2 bg-[#4F46E5] text-white text-sm font-semibold py-3 rounded-xl shadow-md shadow-indigo-200 hover:opacity-90 transition active:scale-95 disabled:opacity-70"
            >
              {walletState === "connecting" ? (<><Loader2 size={16} className="animate-spin" />Connecting...</>) : "Connect MiniPay"}
            </button>
            {errorMsg && (
              <p className="text-xs text-[#EF4444] mt-3 text-center leading-relaxed">{errorMsg}</p>
            )}
          </div>
        )}

        {walletState === "connected" && txState === "idle" && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-[#10B981]" />
              <span className="text-xs font-medium text-slate-400">{address}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mt-2">Choose your stake</h2>
            <p className="text-sm text-slate-400 mt-1">
              Score <span className="font-semibold text-slate-600">7/10 or higher</span> to win{" "}
              <span className="font-semibold text-[#4F46E5]">{WIN_MULTIPLIER}x</span> your stake back.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {TOKENS.map((t) => {
                const isSelected = selectedToken.symbol === t.symbol;
                return (
                  <button
                    key={t.symbol}
                    onClick={() => setSelectedToken(t)}
                    className={`rounded-2xl border p-3.5 text-left transition-all ${isSelected ? "border-[#4F46E5] bg-indigo-50/60 shadow-[0_0_0_3px_rgba(79,70,229,0.1)]" : "border-slate-150 bg-white hover:border-slate-300"}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${t.color}1A` }}>
                        <Coins size={13} style={{ color: t.color }} />
                      </div>
                      <span className="text-sm font-bold text-slate-700">{t.symbol}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">Balance: {t.balance}</p>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 mt-4">
              <span className="text-xs font-medium text-slate-400">Stake amount</span>
              <span className="text-sm font-bold text-slate-800">{STAKE_AMOUNT} {selectedToken.symbol}</span>
            </div>
            <button
              onClick={handleStake}
              className="w-full mt-5 flex items-center justify-center gap-2 bg-[#4F46E5] text-white text-sm font-semibold py-3 rounded-xl shadow-md shadow-indigo-200 hover:opacity-90 transition active:scale-95"
            >
              Stake & Start Quiz
              <ChevronRight size={15} />
            </button>
          </div>
        )}

        {txState === "staking" && (
          <div className="text-center py-6">
            <Loader2 size={32} className="mx-auto text-[#4F46E5] animate-spin" />
            <h2 className="text-base font-bold text-slate-800 mt-4">Confirming stake...</h2>
            <p className="text-sm text-slate-400 mt-1">Staking {STAKE_AMOUNT} {selectedToken.symbol} on Celo</p>
          </div>
        )}

        {txState === "staked" && (
          <div className="text-center py-4">
            <CheckCircle2 size={44} className="mx-auto text-[#10B981]" />
            <h2 className="text-lg font-bold text-slate-800 mt-3">Stake confirmed!</h2>
            <p className="text-sm text-slate-400 mt-1">{STAKE_AMOUNT} {selectedToken.symbol} locked in. Good luck!</p>
            <button
              onClick={() => onStaked({ token: selectedToken.symbol })}
              className="w-full mt-5 bg-[#4F46E5] text-white text-sm font-semibold py-3 rounded-xl shadow-md shadow-indigo-200 hover:opacity-90 transition active:scale-95"
            >
              Start Quiz →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  GAMEPLAY SCREEN                                                      */
/* -------------------------------------------------------------------- */
function ConfettiBurst() {
  const pieces = Array.from({ length: 16 });
  const colors = ["#4F46E5", "#F59E0B", "#10B981", "#EF4444"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => {
        const angle = (i / pieces.length) * 360;
        const distance = 60 + Math.random() * 40;
        const dx = Math.cos((angle * Math.PI) / 180) * distance;
        const dy = Math.sin((angle * Math.PI) / 180) * distance;
        return (
          <span key={i} className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-sm animate-confetti"
            style={{ backgroundColor: colors[i % colors.length], "--dx": `${dx}px`, "--dy": `${dy}px`, animationDelay: `${Math.random() * 0.1}s` }} />
        );
      })}
    </div>
  );
}

function GameplayScreen({ roundQuestions, onRoundComplete }) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("active");
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [correctCount, setCorrectCount] = useState(0);
  const [fadeKey, setFadeKey] = useState(0);

  const q = roundQuestions[current];
  const progressPct = (current / roundQuestions.length) * 100;

  const goNext = useCallback((wasCorrect) => {
    const newCorrect = wasCorrect ? correctCount + 1 : correctCount;
    if (current + 1 >= roundQuestions.length) {
      onRoundComplete({ correct: newCorrect, wrong: roundQuestions.length - newCorrect, total: roundQuestions.length });
      return;
    }
    setCorrectCount(newCorrect);
    setCurrent((c) => c + 1);
    setSelected(null);
    setStatus("active");
    setTimeLeft(TIME_PER_QUESTION);
    setFadeKey((k) => k + 1);
  }, [current, correctCount, roundQuestions, onRoundComplete]);

  React.useEffect(() => {
    if (status !== "active") return;
    if (timeLeft <= 0) {
      setStatus("wrong");
      setSelected(-1);
      const t = setTimeout(() => goNext(false), 1000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, status, goNext]);

  const handleAnswer = (idx) => {
    if (status !== "active") return;
    setSelected(idx);
    const correct = idx === q.answer;
    setStatus(correct ? "correct" : "wrong");
    setTimeout(() => goNext(correct), 1200);
  };

  const handleSkip = () => {
    if (status !== "active") return;
    setStatus("wrong");
    setSelected(-1);
    setTimeout(() => goNext(false), 700);
  };

  const timerPct = (timeLeft / TIME_PER_QUESTION) * 100;
  const timerColor = timeLeft <= 5 ? "#EF4444" : "#4F46E5";

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <style>{`
        @keyframes confetti-fly { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0); opacity: 0; } }
        .animate-confetti { animation: confetti-fly 0.7s ease-out forwards; }
        @keyframes shake-x { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
        .animate-shake { animation: shake-x 0.4s ease-in-out; }
        @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in-up 0.35s ease-out; }
        @keyframes check-pop { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        .animate-check { animation: check-pop 0.35s ease-out; }
      `}</style>

      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ color: "#4F46E5", backgroundColor: "#4F46E518" }}>
            {q.category}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-500">{current + 1}/{roundQuestions.length}</span>
            <div className="flex items-center gap-1.5">
              <Clock size={14} style={{ color: timerColor }} />
              <span className="text-sm font-bold tabular-nums" style={{ color: timerColor }}>{timeLeft}s</span>
            </div>
          </div>
        </div>

        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-[#4F46E5] rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="w-full h-1 bg-slate-50 rounded-full overflow-hidden mb-8">
          <div className="h-full rounded-full transition-all duration-1000 ease-linear" style={{ width: `${timerPct}%`, backgroundColor: timerColor }} />
        </div>

        <div key={fadeKey} className={`relative rounded-[22px] border border-white/60 shadow-[0_8px_30px_rgba(79,70,229,0.08)] backdrop-blur-xl bg-white/70 p-6 sm:p-8 animate-fade-in ${status === "wrong" ? "animate-shake" : ""}`}>
          {status === "correct" && <ConfettiBurst />}
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 leading-snug mb-6 text-center">{q.question}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {q.options.map((opt, idx) => {
              const isSelected = selected === idx;
              const isCorrectAnswer = idx === q.answer;
              let stateClasses = "bg-white border-slate-150 text-slate-700 hover:border-[#4F46E5]/40 hover:bg-indigo-50/40";
              if (status !== "active") {
                if (isCorrectAnswer) stateClasses = "bg-emerald-50 border-[#10B981] text-emerald-700 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]";
                else if (isSelected && !isCorrectAnswer) stateClasses = "bg-red-50 border-[#EF4444] text-red-600";
                else stateClasses = "bg-white border-slate-100 text-slate-400";
              }
              return (
                <button key={idx} onClick={() => handleAnswer(idx)} disabled={status !== "active"}
                  className={`relative flex items-center justify-between gap-2 border rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 active:scale-95 ${stateClasses}`}>
                  <span>{opt}</span>
                  {status !== "active" && isCorrectAnswer && <Check size={16} className="text-[#10B981] animate-check shrink-0" />}
                  {status !== "active" && isSelected && !isCorrectAnswer && <X size={16} className="text-[#EF4444] shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Zap size={12} className="text-[#F59E0B]" />
              Score: <span className="font-bold text-slate-600">{correctCount}</span>
            </div>
            <button onClick={handleSkip} disabled={status !== "active"} className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition disabled:opacity-40">
              Skip <SkipForward size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  RESULTS SCREEN                                                       */
/* -------------------------------------------------------------------- */
function useCountUp(target, durationMs = 900, start = true) {
  const [value, setValue] = useState(0);
  React.useEffect(() => {
    if (!start) return;
    let startTime = null;
    let raf;
    const step = (t) => {
      if (startTime === null) startTime = t;
      const progress = Math.min((t - startTime) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
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
  const colors = ["#4F46E5", "#F59E0B", "#10B981", "#EF4444"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => (
        <span key={i} className="absolute top-0 w-2 h-2 rounded-sm animate-confetti-fall"
          style={{ left: `${Math.random() * 100}%`, backgroundColor: colors[i % colors.length], animationDelay: `${Math.random() * 0.6}s`, animationDuration: `${1.8 + Math.random() * 1.2}s` }} />
      ))}
    </div>
  );
}

function ResultsScreen({ result, stakeInfo, onPlayAgain }) {
  const [showTrophy, setShowTrophy] = useState(false);
  const accuracy = Math.round((result.correct / result.total) * 100);
  const won = result.correct / result.total >= WIN_THRESHOLD;
  const payout = won ? (STAKE_AMOUNT * WIN_MULTIPLIER).toFixed(4) : null;
  const scoreCount = useCountUp(result.correct * 10, 1000, showTrophy);
  const accuracyCount = useCountUp(accuracy, 1000, showTrophy);

  React.useEffect(() => {
    const t = setTimeout(() => setShowTrophy(true), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
      <style>{`
        @keyframes trophy-pop { 0% { transform: scale(0) rotate(-15deg); opacity: 0; } 60% { transform: scale(1.15) rotate(5deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
        .animate-trophy { animation: trophy-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        @keyframes confetti-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(60vh) rotate(360deg); opacity: 0; } }
        .animate-confetti-fall { animation: confetti-fall linear forwards; }
        @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in-up 0.5s ease-out forwards; opacity: 0; }
      `}</style>

      {won && showTrophy && <ConfettiField />}

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-4">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg ${showTrophy ? "animate-trophy" : "opacity-0"}`}
            style={{ background: won ? "linear-gradient(135deg, #F59E0B, #FBBF24)" : "linear-gradient(135deg, #94A3B8, #CBD5E1)" }}>
            <Trophy size={44} className="text-white" fill="white" />
          </div>
        </div>

        <div className="text-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <h1 className="text-2xl font-extrabold text-slate-800">{won ? "Round complete! 🎉" : "So close — try again!"}</h1>
          <p className="text-sm text-slate-400 mt-1">{won ? "You beat the threshold and earned a payout." : "You didn't hit the win threshold this time."}</p>
        </div>

        <div className="rounded-[22px] border border-white/60 shadow-[0_8px_30px_rgba(79,70,229,0.08)] backdrop-blur-xl bg-white/70 p-6 mt-6 animate-fade-in" style={{ animationDelay: "0.45s" }}>
          <div className="flex items-center justify-center gap-10 mb-6">
            <div className="text-center">
              <p className="text-3xl font-extrabold text-slate-800 tabular-nums">{scoreCount}</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Points</p>
            </div>
            <div className="w-px h-10 bg-slate-100" />
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
              <div className="w-8 h-8 rounded-full bg-[#10B981] flex items-center justify-center shrink-0"><Check size={15} className="text-white" /></div>
              <div><p className="text-sm font-bold text-emerald-700">{result.correct}</p><p className="text-[10px] text-emerald-600/70 font-medium">Correct</p></div>
            </div>
            <div className="flex items-center gap-2.5 bg-red-50 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-[#EF4444] flex items-center justify-center shrink-0"><X size={15} className="text-white" /></div>
              <div><p className="text-sm font-bold text-red-600">{result.wrong}</p><p className="text-[10px] text-red-500/70 font-medium">Wrong</p></div>
            </div>
          </div>

          <div className="mt-4 rounded-xl px-4 py-3.5 flex items-center justify-between" style={{ background: won ? "linear-gradient(90deg, #EEF2FF, #FEF3E2)" : "#F8FAFC" }}>
            <div className="flex items-center gap-2.5">
              <Coins size={18} className={won ? "text-[#F59E0B]" : "text-slate-400"} />
              <div>
                <p className="text-xs text-slate-400 font-medium">{won ? "You won" : "Stake"}</p>
                <p className={`text-sm font-bold ${won ? "text-slate-800" : "text-slate-500"}`}>
                  {won ? `+${payout} ${stakeInfo.token}` : `${STAKE_AMOUNT} ${stakeInfo.token} staked`}
                </p>
              </div>
            </div>
            {won && <span className="text-[10px] font-bold text-[#4F46E5] bg-[#4F46E5]/10 px-2.5 py-1 rounded-full">1.5x</span>}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5 animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <button onClick={onPlayAgain} className="flex-1 flex items-center justify-center gap-2 bg-[#4F46E5] text-white text-sm font-semibold py-3 rounded-xl shadow-md shadow-indigo-200 hover:opacity-90 transition active:scale-95">
            <RotateCcw size={15} />Play Again
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold py-3 rounded-xl hover:bg-slate-50 transition active:scale-95">
            <Share2 size={15} />Share Score
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  APP SHELL — wires everything together                                */
/* -------------------------------------------------------------------- */
export default function QuizaApp() {
  const [screen, setScreen] = useState("home"); // home | stake | play | results
  const [roundQuestions, setRoundQuestions] = useState([]);
  const [stakeInfo, setStakeInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState({ played: 0, bestScore: 0, accuracy: 0, streak: 0 });

  const handleStartQuiz = () => setScreen("stake");

  const handleStaked = (info) => {
    setStakeInfo(info);
    setRoundQuestions(pickRoundQuestions());
    setScreen("play");
  };

  const handleRoundComplete = (res) => {
    setResult(res);
    setStats((s) => ({
      played: s.played + 1,
      bestScore: Math.max(s.bestScore, res.correct * 10),
      accuracy: Math.round((res.correct / res.total) * 100),
      streak: res.correct / res.total >= WIN_THRESHOLD ? s.streak + 1 : 0,
    }));
    setScreen("results");
  };

  const handlePlayAgain = () => setScreen("home");

  return (
    <div className="min-h-screen w-full bg-white flex font-sans text-slate-800">
      {screen !== "play" && screen !== "results" && (
        <aside className="hidden lg:flex flex-col w-64 border-r border-slate-100 p-5 shrink-0">
          <div className="flex items-center gap-2 px-2 mb-8">
            <img src="/logo.png" alt="Quiza Logo" className="w-10 h-10 object-contain" />
            <div className="leading-tight">
              <p className="font-extrabold text-[#4F46E5] text-sm tracking-tight">QUIZA</p>
              <p className="font-extrabold text-slate-800 text-sm tracking-tight -mt-1">QUEST</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1">
            {nav.map(({ icon: Icon, label }) => (
              <button key={label} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${label === "Home" ? "bg-[#4F46E5] text-white shadow-md shadow-indigo-200" : "text-slate-500 hover:bg-slate-50"}`}>
                <Icon size={18} />{label}
              </button>
            ))}
          </nav>
        </aside>
      )}

      {screen === "home" && <HomeScreen onStartQuiz={handleStartQuiz} stats={stats} />}
      {screen === "play" && <GameplayScreen roundQuestions={roundQuestions} onRoundComplete={handleRoundComplete} />}
      {screen === "results" && <ResultsScreen result={result} stakeInfo={stakeInfo} onPlayAgain={handlePlayAgain} />}

      {screen === "stake" && (
        <>
          <HomeScreen onStartQuiz={handleStartQuiz} stats={stats} />
          <StakeModal onClose={() => setScreen("home")} onStaked={handleStaked} />
        </>
      )}
    </div>
  );
}
