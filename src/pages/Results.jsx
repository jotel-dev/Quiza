import React, { useState, useEffect } from "react";
import { Trophy, RotateCcw, Share2, Check, X, Target, Coins, Loader2 } from "lucide-react";
import { JsonRpcProvider } from "ethers";
import { withdrawWinnings, getBalance, CUSD_ADDRESS, NETWORK, CELO_NETWORKS } from "../lib/quizaContract";
import ShareModal from "../components/ShareModal";
import { playChaChing } from "../lib/sound";

function useCountUp(target, durationMs = 900, start = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
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

export default function Results({ result, roundQuestions, stakeInfo, signer, onPlayAgain }) {
  const accuracy = Math.round((result.correct / result.total) * 100);
  const won = result.won;
  const payout = result.payout;
  
  // Calculate tiered multiplier based on score
  const getMultiplier = (score) => {
    if (score >= 10) return "2.0x";
    if (score >= 8) return "1.5x";
    if (score >= 7) return "1.2x";
    return "1.0x";
  };
  const multiplier = getMultiplier(result.correct);

  const [showTrophy, setShowTrophy] = useState(false);
  const [withdrawState, setWithdrawState] = useState("idle");
  const [withdrawError, setWithdrawError] = useState(null);
  const [payoutReady, setPayoutReady] = useState(!won);
  const [showReview, setShowReview] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const scoreCount = useCountUp(result.correct * 10, 1000, showTrophy);
  const accuracyCount = useCountUp(accuracy, 1000, showTrophy);

  useEffect(() => {
    const t = setTimeout(() => setShowTrophy(true), 150);
    return () => clearTimeout(t);
  }, []);

  // For winning rounds, confirm the on-chain payout has settled before enabling withdrawal.
  useEffect(() => {
    if (!won || !stakeInfo || !signer) return;

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 20;

    const tokenAddress =
      stakeInfo.token === "CELO" ? "0x0000000000000000000000000000000000000000" : CUSD_ADDRESS[NETWORK];
    const provider = new JsonRpcProvider(CELO_NETWORKS[NETWORK].rpcUrls[0]);

    const check = async () => {
      try {
        const playerAddr = await signer.getAddress();
        const balance = await getBalance(provider, playerAddr, tokenAddress, NETWORK);

        let roundResolved = false;
        if (stakeInfo.roundId) {
          try {
            const contract = new Contract(QUIZA_CONTRACT_ADDRESS[NETWORK], QUIZA_ABI, provider);
            const r = await contract.rounds(stakeInfo.roundId);
            if (r && r.resolved) roundResolved = true;
          } catch (e) {}
        }

        if (!cancelled && (balance > 0n || roundResolved)) {
          setPayoutReady(true);
          playChaChing();
          return;
        }
      } catch {
        // ignore transient RPC errors
      }
      attempts += 1;
      if (!cancelled && attempts < MAX_ATTEMPTS) {
        setTimeout(check, 2000);
      } else if (!cancelled) {
        setPayoutReady(true);
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [won, stakeInfo, signer]);

  const handleWithdraw = async () => {
    setWithdrawError(null);
    setWithdrawState("withdrawing");
    try {
      const tokenAddress = stakeInfo.token === "CELO" ? "0x0000000000000000000000000000000000000000" : CUSD_ADDRESS[NETWORK];
      const provider = new JsonRpcProvider(CELO_NETWORKS[NETWORK].rpcUrls[0]);
      const playerAddr = await signer.getAddress();
      const balance = await getBalance(provider, playerAddr, tokenAddress, NETWORK);

      if (balance === 0n) {
        let roundResolved = false;
        if (stakeInfo?.roundId) {
          try {
            const contract = new Contract(QUIZA_CONTRACT_ADDRESS[NETWORK], QUIZA_ABI, provider);
            const r = await contract.rounds(stakeInfo.roundId);
            if (r && r.resolved) roundResolved = true;
          } catch (e) {}
        }

        if (!roundResolved) {
          throw new Error("Your payout is still settling on-chain. Please wait a few seconds and try again.");
        }
      }

      await withdrawWinnings(signer, tokenAddress, NETWORK);
      setWithdrawState("done");
      playChaChing();
    } catch (err) {
      console.error("Withdraw error:", err);
      let errMsg = err?.message || "Withdrawal failed";
      
      if (errMsg.toLowerCase().includes("user rejected") || errMsg.includes("4001")) {
        errMsg = "Transaction was rejected in your wallet. Please try again.";
      } else if (errMsg.includes("No balance to withdraw") || errMsg.includes("still settling")) {
        errMsg = "Your payout is still settling on-chain. Please wait a few seconds and try again.";
      } else if (errMsg.includes("could not coalesce error")) {
        const match = errMsg.match(/"message":\s*"([^"]+)"/);
        errMsg = match ? match[1] : "Network error. Please try again.";
        if (errMsg.includes("Unable to resolve host") || errMsg.includes("Failed to fetch")) {
          errMsg = "Network connection failed. Please check your internet connection and try again.";
        }
      } else if (errMsg.length > 150) {
        errMsg = "Transaction failed. Please check your network connection and try again.";
      }
      
      setWithdrawError(errMsg);
      setWithdrawState("error");
    }
  };

  const handleShare = () => {
    setIsShareOpen(true);
  };

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

          {stakeInfo?.type !== "practice" && (
            <div className="mt-4 rounded-xl px-4 py-3.5 flex items-center justify-between" style={{ background: won ? "linear-gradient(90deg, #EEF2FF, #FEF3E2)" : "#F8FAFC" }}>
              <div className="flex items-center gap-2.5">
                <Coins size={18} className={won ? "text-[#F59E0B]" : "text-slate-400"} />
                <div>
                  <p className="text-xs text-slate-400 font-medium">{won ? "You won" : "Stake"}</p>
                  <p className={`text-sm font-bold ${won ? "text-slate-800" : "text-slate-500"}`}>
                    {won ? `+${payout} ${stakeInfo.token}` : `${stakeInfo.amount ?? (stakeInfo.token === "cUSD" ? 0.001 : 0.01)} ${stakeInfo.token} staked`}
                  </p>
                </div>
              </div>
              {won && <span className="text-[10px] font-bold text-[#4F46E5] bg-[#4F46E5]/10 px-2.5 py-1 rounded-full">{multiplier}</span>}
            </div>
          )}

          {won && stakeInfo?.type !== "practice" && (
            <div className="mt-3">
              {withdrawState !== "done" ? (
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawState === "withdrawing" || !payoutReady}
                  className="w-full flex items-center justify-center gap-2 bg-[#10B981] text-white text-sm font-semibold py-3 rounded-xl shadow-md shadow-emerald-200 hover:opacity-90 transition active:scale-95 disabled:opacity-70"
                >
                  {withdrawState === "withdrawing" ? (
                    <><Loader2 size={15} className="animate-spin" />Withdrawing...</>
                  ) : !payoutReady ? (
                    <><Loader2 size={15} className="animate-spin" />Confirming payout...</>
                  ) : (
                    <><Coins size={15} />Withdraw {payout} {stakeInfo.token}</>
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#10B981] py-2">
                  <Check size={16} />Sent to your wallet!
                </div>
              )}
              {withdrawError && (
                <p className="text-xs text-[#EF4444] mt-2 text-center leading-relaxed">{withdrawError}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 mt-5 animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <div className="flex items-center gap-3">
            <button onClick={onPlayAgain} className="flex-1 flex items-center justify-center gap-2 bg-[#4F46E5] text-white text-sm font-semibold py-3 rounded-xl shadow-md shadow-indigo-200 hover:opacity-90 transition active:scale-95">
              <RotateCcw size={15} />Play Again
            </button>
            <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold py-3 rounded-xl hover:bg-slate-50 transition active:scale-95">
              <Share2 size={15} />Share Score
            </button>
          </div>
          <button onClick={() => setShowReview(true)} className="w-full flex items-center justify-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm font-semibold py-3 rounded-xl hover:bg-indigo-100 transition active:scale-95">
            Review Answers
          </button>
        </div>
      </div>

      {showReview && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Review Answers</h2>
              <button onClick={() => setShowReview(false)} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              {roundQuestions.map((q, idx) => {
                const submitted = result.submittedAnswers[idx];
                const correct = result.correctAnswers[idx];

                return (
                  <div key={q.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <p className="text-sm font-bold text-slate-800 mb-3">{idx + 1}. {q.prompt}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, optIdx) => {
                        const isCorrectOpt = optIdx === correct;
                        const isUserSelected = optIdx === submitted;
                        let btnClass = "border-slate-200 bg-white text-slate-600";
                        let icon = null;

                        if (isCorrectOpt) {
                          btnClass = "border-emerald-300 bg-emerald-50 text-emerald-700 font-bold";
                          icon = <Check size={16} className="text-emerald-600" />;
                        } else if (isUserSelected && !isCorrectOpt) {
                          btnClass = "border-red-300 bg-red-50 text-red-600 font-bold";
                          icon = <X size={16} className="text-red-500" />;
                        }

                        return (
                          <div key={optIdx} className={`flex items-center justify-between px-3.5 py-3 rounded-xl border text-sm font-semibold transition-all ${btnClass}`}>
                            <span>{opt}</span>
                            {icon}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        shareData={{
          score: result.correct,
          total: result.total,
          multiplier,
          payout,
          token: stakeInfo?.token || "CELO",
          won,
          type: "game",
        }}
      />
    </div>
  );
}
