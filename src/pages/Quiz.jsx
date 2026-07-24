 import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, X, Check, SkipForward, Zap } from "lucide-react";
import { playPop, playTick, triggerHaptic } from "../lib/sound";

const TIME_PER_QUESTION = 15;

export default function Quiz({ roundQuestions, onRoundComplete }) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("active");
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [fadeKey, setFadeKey] = useState(0);
  const [fiftyFiftyAvailable, setFiftyFiftyAvailable] = useState(true);
  const [addTimeAvailable, setAddTimeAvailable] = useState(true);
  const [hiddenOptions, setHiddenOptions] = useState([]);
  const [correctCount, setCorrectCount] = useState(0);
  const submittedAnswers = useRef([]);
  const hasAdvanced = useRef(false);
  const currentRef = useRef(0);

  const hasQuestions = roundQuestions && roundQuestions.length > 0;
  const q = hasQuestions ? roundQuestions[current] : null;

  currentRef.current = current;

  useEffect(() => {
    setFiftyFiftyAvailable(true);
    setAddTimeAvailable(true);
  }, [roundQuestions]);

  useEffect(() => {
    setHiddenOptions([]);
  }, [current]);

  const goNext = useCallback((chosenIdx) => {
    if (hasAdvanced.current) return;
    hasAdvanced.current = true;

    const currentQuestion = roundQuestions[currentRef.current];

    submittedAnswers.current.push(chosenIdx);

    if (currentRef.current + 1 >= roundQuestions.length) {
      onRoundComplete({
        questionIds: roundQuestions.map((rq) => rq.id),
        submittedAnswers: submittedAnswers.current,
      });
      return;
    }
    setCurrent((c) => c + 1);
    setSelected(null);
    setStatus("active");
    setTimeLeft(TIME_PER_QUESTION);
    setFadeKey((k) => k + 1);
    hasAdvanced.current = false;
  }, [roundQuestions, onRoundComplete]);

  useEffect(() => {
    if (status !== "active") return;
    if (timeLeft <= 0) {
      triggerHaptic("incorrect");
      setStatus("selected");
      setSelected(-1);
      setTimeout(() => goNext(-1), 1000);
      return;
    }
    if (timeLeft <= 5) {
      playTick();
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, status, goNext]);

  const handleAnswer = (idx) => {
    if (status !== "active" || hasAdvanced.current || !q) return;
    playPop();
    if (q && q.answer !== undefined && idx !== q.answer) {
      triggerHaptic("incorrect");
    } else {
      triggerHaptic("tap");
    }
    setSelected(idx);
    setStatus("selected");
    setTimeout(() => goNext(idx), 600);
  };

  const handleSkip = () => {
    if (status !== "active" || hasAdvanced.current || !q) return;
    triggerHaptic("incorrect");
    setStatus("selected");
    setSelected(-1);
    setTimeout(() => goNext(-1), 600);
  };

  const handleFiftyFifty = () => {
    if (status !== "active" || !fiftyFiftyAvailable || !q || !q.fiftyFifty) return;
    playPop();
    const toHide = [0, 1, 2, 3].filter(idx => !q.fiftyFifty.includes(idx));
    setHiddenOptions(toHide);
    setFiftyFiftyAvailable(false);
  };

  const handleAddTime = () => {
    if (status !== "active" || !addTimeAvailable) return;
    playPop();
    setTimeLeft(t => t + 10);
    setAddTimeAvailable(false);
  };

  const timerPct = Math.min(100, (timeLeft / TIME_PER_QUESTION) * 100);
  const timerColor = timeLeft <= 5 ? "#EF4444" : "#0A4C86";

  if (!hasQuestions) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-4xl mb-4">🤔</p>
          <h2 className="text-lg font-bold text-slate-800 mb-2">No questions loaded</h2>
          <p className="text-sm text-slate-400 mb-4">Please stake and start a quiz round first.</p>
          <button
            onClick={() => navigate("/")}
            className="btn-primary px-5 py-2.5"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <style>{`
        @keyframes confetti-fly { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0); opacity: 0; } }
        .animate-confetti { animation: confetti-fly 0.7s ease-out forwards; }
        @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in-up 0.35s ease-out; }
        @keyframes check-pop { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        .animate-check { animation: check-pop 0.35s ease-out; }
      `}</style>

      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ color: q.color || "#4F46E5", backgroundColor: `${(q.color || "#4F46E5")}18` }}
          >
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
          <div className="h-full bg-[#0A4C86] rounded-full transition-all duration-500 ease-out" style={{ width: `${(current / roundQuestions.length) * 100}%` }} />
        </div>
        <div className="w-full h-1 bg-slate-50 rounded-full overflow-hidden mb-8">
          <div className="h-full rounded-full transition-all duration-1000 ease-linear" style={{ width: `${timerPct}%`, backgroundColor: timerColor }} />
        </div>

        <div key={fadeKey} className="relative rounded-[22px] border border-white/60 shadow-[0_8px_30px_rgba(79,70,229,0.08)] backdrop-blur-xl bg-white/70 p-6 sm:p-8 animate-fade-in">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 leading-snug mb-6 text-center">{q.question}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {q.options.map((opt, idx) => {
              const isSelected = selected === idx;
              const hasAnswerKey = q && q.answer !== undefined;
              const isCorrectOpt = hasAnswerKey && idx === q.answer;
              const isWrongSelection = status !== "active" && isSelected && hasAnswerKey && !isCorrectOpt;

              let stateClasses = "bg-white border-slate-150 text-slate-700 hover:border-[#0A4C86]/40 hover:bg-blue-50/40";
              let icon = null;

              if (status !== "active") {
                if (hasAnswerKey) {
                  if (isCorrectOpt) {
                    stateClasses = "bg-emerald-50 border-emerald-500 text-emerald-700 font-bold shadow-[0_0_0_3px_rgba(16,185,129,0.15)]";
                    icon = <Check size={16} className="text-emerald-600 animate-check shrink-0" />;
                  } else if (isWrongSelection) {
                    stateClasses = "bg-red-50 border-red-500 text-red-700 font-bold shadow-[0_0_0_3px_rgba(239,68,68,0.15)]";
                    icon = <X size={16} className="text-red-500 animate-check shrink-0" />;
                  } else {
                    stateClasses = "bg-white border-slate-100 text-slate-400 opacity-60";
                  }
                } else {
                  if (isSelected) {
                    stateClasses = "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-[0_0_0_3px_rgba(79,70,229,0.15)]";
                    icon = <Check size={16} className="text-indigo-600 animate-check shrink-0" />;
                  } else {
                    stateClasses = "bg-white border-slate-100 text-slate-400";
                  }
                }
              }

              if (hiddenOptions.includes(idx)) {
                return <div key={idx} className="relative flex items-center justify-between gap-2 border border-dashed border-slate-200 rounded-2xl px-4 py-3.5 opacity-30 pointer-events-none" />;
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={status !== "active"}
                  className={`relative flex items-center justify-between gap-2 border rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 active:scale-95 ${stateClasses}`}
                >
                  <span>{opt}</span>
                  {icon}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              onClick={handleFiftyFifty}
              disabled={status !== "active" || !fiftyFiftyAvailable}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all ${fiftyFiftyAvailable && status === "active" ? "bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100" : "bg-slate-50 border-slate-200 text-slate-400 opacity-60"}`}
            >
              50/50
            </button>
            <button
              onClick={handleAddTime}
              disabled={status !== "active" || !addTimeAvailable}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all ${addTimeAvailable && status === "active" ? "bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100" : "bg-slate-50 border-slate-200 text-slate-400 opacity-60"}`}
            >
              +10s
            </button>
          </div>

          <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Zap size={12} className="text-[#F59E0B]" />
              <span className="font-semibold">Score hidden until end</span>
            </div>
            <button
              onClick={handleSkip}
              disabled={status !== "active"}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition disabled:opacity-40"
            >
              Skip
              <SkipForward size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}