import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Loader2, Home, Grid3x3, Timer, Trophy, Gift, Award, Wallet, User, Settings } from "lucide-react";

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

import questionBank from "./data/questions.json";
import {
  connectWallet,
  ensureNetwork,
  submitRoundForVerification,
  CELO_NETWORKS,
  NETWORK,
  onAccountChange,
  onChainChange,
  removeWeb3Listeners,
} from "./lib/quizaContract.js";

import HomeScreen from "./pages/Home.jsx";
import QuizScreen from "./pages/Quiz.jsx";
import ResultsScreen from "./pages/Results.jsx";
import WelcomeScreen from "./pages/Welcome.jsx";
import LeaderboardScreen from "./pages/Leaderboard.jsx";
import StakeModal from "./components/StakeModal.jsx";


const WIN_MULTIPLIER = 1.5;
const QUESTIONS_PER_ROUND = 10;

function pickRoundQuestions() {
  const arr = [...questionBank.questions];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, QUESTIONS_PER_ROUND);
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem("quiza_state");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persistState(state) {
  try {
    localStorage.setItem("quiza_state", JSON.stringify(state));
  } catch {
    // storage full or unavailable
  }
}

export default function QuizaApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("quiza_darkMode");
    return saved ? JSON.parse(saved) : false;
  });
  const [screen, setScreen] = useState("home");
  const [roundQuestions, setRoundQuestions] = useState([]);
  const [stakeInfo, setStakeInfo] = useState(null);
  const [signer, setSigner] = useState(null);
  const [result, setResult] = useState(null);
  const [verifyError, setVerifyError] = useState(null);
  const [stats, setStats] = useState(() => loadPersistedState()?.stats || { played: 0, bestScore: 0, accuracy: 0, streak: 0 });
  const [walletAddress, setWalletAddress] = useState(() => loadPersistedState()?.walletAddress || null);
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);

  useEffect(() => {
    persistState({ stats, walletAddress });
  }, [stats, walletAddress]);

  useEffect(() => {
    localStorage.setItem("quiza_darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const handleAccountChange = (accounts) => {
      if (accounts.length === 0) {
        setWalletAddress(null);
        setSigner(null);
        setIsStakeModalOpen(false);
      } else {
        setWalletAddress(accounts[0]);
      }
    };
    const handleChainChange = (chainId) => {
      const expected = CELO_NETWORKS[NETWORK]?.chainId;
      if (expected && chainId !== expected) {
        ensureNetwork(NETWORK).catch(() => {});
      }
    };
    onAccountChange(handleAccountChange);
    onChainChange(handleChainChange);
    return () => removeWeb3Listeners();
  }, []);

  const handleStartQuiz = () => {
    if (!walletAddress) {
      setIsStakeModalOpen(true);
    } else {
      setScreen("stake");
    }
  };

  const handleStaked = (info) => {
    setStakeInfo(info);
    setSigner(info.signer);
    setRoundQuestions(pickRoundQuestions());
    setScreen("play");
    navigate("/quiz");
  };

  const handleRoundComplete = async ({ correct, wrong, total, questionIds, submittedAnswers }) => {
    setScreen("verifying");
    setVerifyError(null);
    try {
      const verified = await submitRoundForVerification({
        roundId: stakeInfo.roundId,
        questionIds,
        submittedAnswers,
        address: walletAddress,
      });

      const stakeAmt = stakeInfo.token === "cUSD" ? 0.001 : 0.01;
      const payout = verified.won ? (stakeAmt * WIN_MULTIPLIER).toFixed(4) : null;
      setResult({ correct, wrong, total, won: verified.won, payout, txHash: verified.txHash });

      setStats((s) => ({
        played: s.played + 1,
        bestScore: Math.max(s.bestScore, correct * 10),
        accuracy: Math.round((correct / total) * 100),
        streak: verified.won ? s.streak + 1 : 0,
      }));
      setScreen("results");
      navigate("/results");
    } catch (err) {
      console.error(err);
      setVerifyError(err.message || "Could not verify your round. Your stake is safe — please try again.");
    }
  };

  const handlePlayAgain = () => {
    setScreen("home");
    setResult(null);
    setStakeInfo(null);
    navigate("/");
  };

  const handleConnectWallet = async () => {
    try {
      const { signer: s, address } = await connectWallet();
      await ensureNetwork(NETWORK);
      setWalletAddress(address);
      setSigner(s);
      setIsStakeModalOpen(false);
    } catch (err) {
      console.error("Wallet connection failed:", err);
      alert(err.message || "Failed to connect wallet");
    }
  };

  const isHome = location.pathname === "/" || location.pathname === "/home";

  return (
    <div className={`min-h-screen w-full flex font-sans ${darkMode ? "bg-slate-900 text-slate-100" : "bg-white text-slate-800"}`}>
      {isHome && (
        <aside className="hidden lg:flex flex-col w-64 border-r border-slate-100 p-5 shrink-0">
          <div className="flex items-center gap-2 px-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-[#4F46E5] flex items-center justify-center shadow-lg shadow-indigo-200">
              <span className="text-white text-lg">?</span>
            </div>
            <div className="leading-tight">
              <p className="font-extrabold text-[#4F46E5] text-sm tracking-tight">QUIZA</p>
              <p className="font-extrabold text-slate-800 text-sm tracking-tight -mt-1">QUEST</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1">
            {nav.map(({ icon: Icon, label }) => {
              const isActive = (label === "Home" && isHome) || (label === "Leaderboard" && location.pathname === "/leaderboard");
              return (
                <button 
                  key={label} 
                  onClick={() => {
                    if (label === "Leaderboard") { setScreen("leaderboard"); navigate("/leaderboard"); }
                    else if (label === "Home") { setScreen("home"); navigate("/"); }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-[#4F46E5] text-white shadow-md shadow-indigo-200" : "text-slate-500 hover:bg-slate-50"}`}>
                  <Icon size={18} />{label}
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      <main className="flex-1 relative">
        <Routes>
          <Route path="/" element={<WelcomeScreen darkMode={darkMode} onToggleTheme={() => setDarkMode((d) => !d)} />} />
          <Route path="/home" element={<HomeScreen onStartQuiz={handleStartQuiz} stats={stats} darkMode={darkMode} />} />
          <Route path="/quiz" element={<QuizScreen roundQuestions={roundQuestions} onRoundComplete={handleRoundComplete} darkMode={darkMode} />} />
          <Route path="/results" element={<ResultsScreen result={result} stakeInfo={stakeInfo} signer={signer} onPlayAgain={handlePlayAgain} darkMode={darkMode} />} />
          <Route path="/leaderboard" element={<LeaderboardScreen darkMode={darkMode} walletAddress={walletAddress} />} />
        </Routes>

        {screen === "verifying" && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              {verifyError ? (
                <>
                  <p className="text-3xl mb-3">⚠️</p>
                  <p className="text-base font-bold text-slate-800">{verifyError}</p>
                  <button
                    onClick={() => { setScreen("home"); navigate("/"); }}
                    className="mt-4 bg-[#4F46E5] text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-indigo-200 hover:opacity-90 transition"
                  >
                    Back to Home
                  </button>
                </>
              ) : (
                <>
                  <Loader2 size={32} className="mx-auto text-[#4F46E5] animate-spin" />
                  <p className="text-base font-bold text-slate-800 mt-4">Verifying your round...</p>
                  <p className="text-sm text-slate-400 mt-1">Checking answers and confirming on-chain</p>
                </>
              )}
            </div>
          </div>
        )}

        <StakeModal
          isOpen={isStakeModalOpen || screen === "stake"}
          onClose={() => { setIsStakeModalOpen(false); setScreen("home"); navigate("/"); }}
          onStaked={handleStaked}
          onConnect={handleConnectWallet}
          walletAddress={walletAddress}
        />
      </main>
    </div>
  );
}
