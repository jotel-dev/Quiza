import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Loader2, Home, Grid3x3, Timer, Trophy, Gift, Award, Wallet, User, Settings } from "lucide-react";

const nav = [
  { icon: Home, label: "Home" },
  { icon: Grid3x3, label: "Categories" },
  { icon: Timer, label: "Daily Challenge" },
  { icon: Trophy, label: "Leaderboard" },
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

  const isHome = location.pathname === "/home";
  const isWelcome = location.pathname === "/";
  const showSidebar = !isWelcome && location.pathname !== "/quiz" && location.pathname !== "/results";
  const showMobileNav = !isWelcome && location.pathname !== "/quiz" && location.pathname !== "/results";

  return (
    <div className="min-h-screen w-full flex font-sans bg-white text-slate-800">
      {showSidebar && (
        <aside className="hidden lg:flex flex-col w-64 border-r border-slate-100 p-5 shrink-0">
          <div className="flex items-center px-2 mb-8 cursor-pointer" onClick={() => { setScreen("home"); navigate("/home"); }}>
            <img src="/logo.png" alt="Quiza Logo" className="h-12 lg:h-14 w-auto object-contain" />
          </div>
          <nav className="flex-1 space-y-1">
            {nav.map(({ icon: Icon, label }) => {
              const isActive = (label === "Home" && isHome) || (label === "Leaderboard" && location.pathname === "/leaderboard");
              return (
                <button 
                  key={label} 
                  onClick={() => {
                    if (label === "Leaderboard") { setScreen("leaderboard"); navigate("/leaderboard"); }
                    else if (label === "Home") { setScreen("home"); navigate("/home"); }
                    else if (label === "Daily Challenge") { alert("Daily Challenge is coming soon!"); }
                    else if (label === "Categories") { 
                      setScreen("home"); 
                      navigate("/home"); 
                      setTimeout(() => document.getElementById("categories-section")?.scrollIntoView({ behavior: "smooth" }), 100); 
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-[#4F46E5] text-white shadow-md shadow-indigo-200" : "text-slate-500 hover:bg-slate-50"}`}>
                  <Icon size={18} />{label}
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      {/* Mobile Bottom Navigation */}
      {showMobileNav && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around p-2 z-50 pb-safe">
          {nav.slice(0, 4).map(({ icon: Icon, label }) => {
            const isActive = (label === "Home" && isHome) || (label === "Leaderboard" && location.pathname === "/leaderboard");
            return (
              <button
                key={label}
                onClick={() => {
                  if (label === "Leaderboard") { setScreen("leaderboard"); navigate("/leaderboard"); }
                  else if (label === "Home") { setScreen("home"); navigate("/home"); }
                  else if (label === "Daily Challenge") { alert("Daily Challenge is coming soon!"); }
                  else if (label === "Categories") { 
                    setScreen("home"); 
                    navigate("/home"); 
                    setTimeout(() => document.getElementById("categories-section")?.scrollIntoView({ behavior: "smooth" }), 100); 
                  }
                }}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                  isActive ? "text-[#4F46E5] bg-indigo-50" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      )}

      <main className="flex-1 relative pb-20 lg:pb-0">
        <Routes>
          <Route path="/" element={<WelcomeScreen />} />
          <Route path="/home" element={<HomeScreen onStartQuiz={handleStartQuiz} stats={stats} walletAddress={walletAddress} onConnectWallet={handleConnectWallet} />} />
          <Route path="/quiz" element={<QuizScreen roundQuestions={roundQuestions} onRoundComplete={handleRoundComplete} />} />
          <Route path="/results" element={<ResultsScreen result={result} stakeInfo={stakeInfo} signer={signer} onPlayAgain={handlePlayAgain} />} />
          <Route path="/leaderboard" element={<LeaderboardScreen walletAddress={walletAddress} />} />
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

