import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, X, Check, SkipForward, Zap } from "lucide-react";
import questionData from "../data/questions.json";

const CATEGORY_COLORS = {
  "Math": "#0A4C86",
  "Geography": "#10B981",
  "History": "#F26722",
  "General Knowledge": "#EF4444",
  "Web3": "#8B5CF6"
};

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const TIME_PER_QUESTION = 15;

function ConfettiBurst() {
  const pieces = Array.from({ length: 16 });
  const colors = ["#0A4C86", "#F26722", "#10B981", "#EF4444"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => {
        const angle = (i / pieces.length) * 360;
        const distance = 60 + Math.random() * 40;
        const dx = Math.cos((angle * Math.PI) / 180) * distance;
        const dy = Math.sin((angle * Math.PI) / 180) * distance;
        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-sm animate-confetti"
            style={{
              backgroundColor: colors[i % colors.length],
              "--dx": `${dx}px`,
              "--dy": `${dy}px`,
              animationDelay: `${Math.random() * 0.1}s`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function Quiz() {
  const navigate = useNavigate();
  const gameQuestions = useMemo(() => {
    return shuffleArray(questionData.questions)
      .slice(0, 10)
      .map(q => ({ ...q, color: CATEGORY_COLORS[q.category] || "#0A4C86" }));
  }, []);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("active"); // active | correct | wrong
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [fadeKey, setFadeKey] = useState(0);

  const q = gameQuestions[current];
  const progressPct = ((current) / gameQuestions.length) * 100;

  const goNext = useCallback(() => {
    if (current + 1 >= gameQuestions.length) {
      setStatus("done");
      return;
    }
    setCurrent((c) => c + 1);
    setSelected(null);
    setStatus("active");
    setTimeLeft(TIME_PER_QUESTION);
    setFadeKey((k) => k + 1);
  }, [current]);

  useEffect(() => {
    if (status !== "active") return;
    if (timeLeft <= 0) {
      setStatus("wrong");
      setSelected(-1);
      setWrongCount(w => w + 1);
      const t = setTimeout(goNext, 1200);
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
    if (correct) {
      setScore((s) => s + 100 + (timeLeft * 10)); // Adjusted scoring based on prior logic
      setCorrectCount(c => c + 1);
    } else {
      setWrongCount(w => w + 1);
    }
    setTimeout(goNext, 1300);
  };

  const handleSkip = () => {
    if (status !== "active") return;
    setStatus("wrong");
    setSelected(-1);
    setWrongCount(w => w + 1);
    setTimeout(goNext, 800);
  };

  useEffect(() => {
    if (status === "done") {
      navigate('/results', { state: { score, total: gameQuestions.length, correct: correctCount, wrong: wrongCount } });
    }
  }, [status, navigate, score, gameQuestions.length, correctCount, wrongCount]);

  if (status === "done") {
    return null;
  }

  const timerPct = (timeLeft / TIME_PER_QUESTION) * 100;
  const timerColor = timeLeft <= 5 ? "#EF4444" : "#0A4C86";

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center font-sans p-4 relative">
      {/* Top right close button */}
      <button 
        onClick={() => navigate('/home')}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition"
      >
        <X size={20} />
      </button>

      <style>{`
        @keyframes confetti-fly {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0); opacity: 0; }
        }
        .animate-confetti { animation: confetti-fly 0.7s ease-out forwards; }

        @keyframes shake-x {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake-x 0.4s ease-in-out; }

        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in-up 0.35s ease-out; }

        @keyframes check-pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-check { animation: check-pop 0.35s ease-out; }
      `}</style>

      <div className="w-full max-w-lg">
        {/* Top bar: question count + timer */}
        <div className="flex items-center justify-between mb-4">
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ color: q.color, backgroundColor: `${q.color}18` }}
          >
            {q.category}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-500">
              {current + 1}/{gameQuestions.length}
            </span>
            <div className="flex items-center gap-1.5">
              <Clock size={14} style={{ color: timerColor }} />
              <span
                className="text-sm font-bold tabular-nums transition-colors"
                style={{ color: timerColor }}
              >
                {timeLeft}s
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-[#0A4C86] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {/* Per-question timer bar */}
        <div className="w-full h-1 bg-slate-50 rounded-full overflow-hidden mb-8">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${timerPct}%`, backgroundColor: timerColor }}
          />
        </div>

        {/* Question card */}
        <div
          key={fadeKey}
          className={`relative rounded-[22px] border border-white/60 shadow-[0_8px_30px_rgba(79,70,229,0.08)] backdrop-blur-xl bg-white/70 p-6 sm:p-8 animate-fade-in
            ${status === "wrong" ? "animate-shake" : ""}`}
        >
          {status === "correct" && <ConfettiBurst />}

          <h2 className="text-lg sm:text-xl font-bold text-slate-800 leading-snug mb-6 text-center">
            {q.question}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {q.options.map((opt, idx) => {
              const isSelected = selected === idx;
              const isCorrectAnswer = idx === q.answer;
              let stateClasses = "bg-white border-slate-150 text-slate-700 hover:border-[#0A4C86]/40 hover:bg-blue-50/40";

              if (status !== "active") {
                if (isCorrectAnswer) {
                  stateClasses = "bg-emerald-50 border-[#10B981] text-emerald-700 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]";
                } else if (isSelected && !isCorrectAnswer) {
                  stateClasses = "bg-red-50 border-[#EF4444] text-red-600";
                } else {
                  stateClasses = "bg-white border-slate-100 text-slate-400";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={status !== "active"}
                  className={`relative flex items-center justify-between gap-2 border rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 active:scale-95 ${stateClasses}`}
                >
                  <span>{opt}</span>
                  {status !== "active" && isCorrectAnswer && (
                    <Check size={16} className="text-[#10B981] animate-check shrink-0" />
                  )}
                  {status !== "active" && isSelected && !isCorrectAnswer && (
                    <X size={16} className="text-[#EF4444] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Zap size={12} className="text-[#F26722]" />
              Score: <span className="font-bold text-slate-600">{score}</span>
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
