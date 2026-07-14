import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Loader2, Home, Grid3x3, Timer, Trophy, Gift, Award, Wallet, User, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const nav = [
  { icon: Home, label: "Home" },
  { icon: Grid3x3, label: "Categories" },
  { icon: Timer, label: "Daily Challenge" },
  { icon: Trophy, label: "Leaderboard" },
  { icon: User, label: "Profile" },
];

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
import CategoriesScreen from "./pages/Categories.jsx";
import ProfileScreen from "./pages/Profile.jsx";
import SetupScreen from "./pages/Setup.jsx";
import StakeModal from "./components/StakeModal.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

const getWeekIdentifier = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
};


const WIN_MULTIPLIER = 1.5;

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
  const [isDailyChallenge, setIsDailyChallenge] = useState(false);
  const [stats, setStats] = useState(() => {
    const loaded = loadPersistedState()?.stats;
    return loaded ? { 
      played: loaded.played || 0, 
      bestScore: loaded.bestScore || 0, 
      accuracy: loaded.accuracy || 0, 
      streak: loaded.streak || 0, 
      lastPlayedDate: loaded.lastPlayedDate || null, 
      lastDailyChallengeDate: loaded.lastDailyChallengeDate || null,
      weeklyQuizzes: loaded.weeklyQuizzes || 0,
      weekIdentifier: loaded.weekIdentifier || null
    } : { played: 0, bestScore: 0, accuracy: 0, streak: 0, lastPlayedDate: null, lastDailyChallengeDate: null, weeklyQuizzes: 0, weekIdentifier: null };
  });
  const [recentGames, setRecentGames] = useState(() => loadPersistedState()?.recentGames || []);
  const [walletAddress, setWalletAddress] = useState(() => loadPersistedState()?.walletAddress || null);
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);
  const [quizConfig, setQuizConfig] = useState({ category: "Mixed", difficulty: "Mixed" });

  useEffect(() => {
    persistState({ stats, walletAddress, recentGames });
  }, [stats, walletAddress, recentGames]);

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

    if (walletAddress) {
      connectWallet(true).then(({ signer: s, address }) => {
        setSigner(s);
        setWalletAddress(address);
      }).catch((err) => console.warn("Silent auto-connect failed:", err));
    }

    return () => removeWeb3Listeners();
  }, []);

  const handleStartQuiz = () => {
    setIsDailyChallenge(false);
    setScreen("setup");
    navigate("/setup");
  };

  const handleSetupComplete = (category, difficulty) => {
    setQuizConfig({ category, difficulty });
    if (!walletAddress) {
      setIsStakeModalOpen(true);
    } else {
      setScreen("stake");
    }
  };

  const handleStartDailyChallenge = () => {
    const today = new Date().toDateString();
    if (stats.lastDailyChallengeDate === today) {
      alert("You have already played the Daily Challenge today! Come back tomorrow.");
      return;
    }
    setIsDailyChallenge(true);
    if (!walletAddress) {
      setIsStakeModalOpen(true);
    } else {
      setScreen("stake");
    }
  };

  const handleStaked = async (info) => {
    setStakeInfo(info);
    setSigner(info.signer);
    try {
      // Questions are selected server-side and returned WITHOUT answers,
      // so the answer key never reaches the client.
      const res = await fetch("/api/round-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: info.roundId.toString(),
          type: isDailyChallenge ? "daily" : "standard",
          category: quizConfig.category,
          difficulty: quizConfig.difficulty,
          walletAddress
        }),
      });
      if (!res.ok) throw new Error("Failed to load questions");
      const data = await res.json();
      setRoundQuestions(data.questions || []);
      setScreen("play");
      navigate("/quiz");
    } catch (err) {
      console.error("Failed to load round questions:", err);
      setVerifyError("Could not load questions for this round. Please stake again.");
    }
  };

  const [verifyMessage, setVerifyMessage] = useState("Checking answers and confirming on-chain");

  const handleRoundComplete = async ({ questionIds, submittedAnswers }) => {
    setScreen("verifying");
    setVerifyError(null);
    setVerifyMessage("Checking answers and confirming on-chain");

    if (!stakeInfo || !stakeInfo.roundId) {
      setVerifyError("Missing round information. Please stake again to start a new round.");
      return;
    }

    try {
      // Scoring and win determination happen entirely server-side.
      const verified = await submitRoundForVerification({
        roundId: stakeInfo.roundId,
        questionIds,
        submittedAnswers,
        address: walletAddress,
      });

      const stakeAmt = stakeInfo.amount ?? (stakeInfo.token === "cUSD" ? 0.001 : 0.01);
      const payout = verified.won ? (stakeAmt * WIN_MULTIPLIER).toFixed(4) : null;
      const correct = verified.correctCount;
      const total = verified.total;
      setResult({
        correct,
        wrong: total - correct,
        total,
        won: verified.won,
        payout,
        txHash: verified.txHash,
        correctAnswers: verified.correctAnswers,
        submittedAnswers,
      });

      setStats((s) => {
        const today = new Date();
        const todayStr = today.toDateString();

        let newStreak = verified.won ? s.streak + 1 : 0;

        const currentWeek = getWeekIdentifier();
        let newWeeklyQuizzes = s.weeklyQuizzes;
        if (s.weekIdentifier !== currentWeek) {
          newWeeklyQuizzes = 1;
        } else {
          if (newWeeklyQuizzes < 10) newWeeklyQuizzes += 1;
        }

        return {
          played: s.played + 1,
          bestScore: Math.max(s.bestScore, correct * 10),
          accuracy: Math.round((correct / total) * 100),
          streak: newStreak,
          lastPlayedDate: todayStr,
          lastDailyChallengeDate: isDailyChallenge ? todayStr : s.lastDailyChallengeDate,
          weeklyQuizzes: newWeeklyQuizzes,
          weekIdentifier: currentWeek
        };
      });

      setRecentGames((prev) => {
        const game = {
          id: Date.now().toString(),
          type: isDailyChallenge ? "Daily Challenge" : "Standard Quiz",
          score: correct * 10,
          won: verified.won,
          timestamp: Date.now()
        };
        return [game, ...prev].slice(0, 10); // Keep last 10
      });

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
            <img src="/logo.png" alt="Quiza Logo" className="h-12 lg:h-14 w-auto object-contain mix-blend-multiply contrast-[1.2] brightness-[1.1]" style={{ clipPath: "inset(2px)" }} />
          </div>
          <nav className="flex-1 space-y-1">
            {nav.map(({ icon: Icon, label }) => {
              const isActive = (label === "Home" && isHome) || (label === "Leaderboard" && location.pathname === "/leaderboard") || (label === "Categories" && location.pathname === "/categories") || (label === "Profile" && location.pathname === "/profile");
              return (
                <button 
                  key={label} 
                  onClick={() => {
                    if (label === "Leaderboard") { setScreen("leaderboard"); navigate("/leaderboard"); }
                    else if (label === "Home") { setScreen("home"); navigate("/home"); }
                    else if (label === "Daily Challenge") { handleStartDailyChallenge(); }
                    else if (label === "Categories") { setScreen("categories"); navigate("/categories"); }
                    else if (label === "Profile") { setScreen("profile"); navigate("/profile"); }
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
          {nav.slice(0, 5).map(({ icon: Icon, label }) => {
            if (label === "Daily Challenge") return null; // Hide from mobile bar to fit 4 items
            const isActive = (label === "Home" && isHome) || (label === "Leaderboard" && location.pathname === "/leaderboard") || (label === "Categories" && location.pathname === "/categories") || (label === "Profile" && location.pathname === "/profile");
            return (
              <button
                key={label}
                onClick={() => {
                  if (label === "Leaderboard") { setScreen("leaderboard"); navigate("/leaderboard"); }
                  else if (label === "Home") { setScreen("home"); navigate("/home"); }
                  else if (label === "Categories") { setScreen("categories"); navigate("/categories"); }
                  else if (label === "Profile") { setScreen("profile"); navigate("/profile"); }
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

      <main className="flex-1 relative pb-20 lg:pb-0 overflow-x-hidden">
        <ErrorBoundary>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<PageTransition pathname={location.pathname}><WelcomeScreen /></PageTransition>} />
              <Route path="/home" element={<PageTransition pathname={location.pathname}><HomeScreen onStartQuiz={handleStartQuiz} onStartDailyChallenge={handleStartDailyChallenge} stats={stats} recentGames={recentGames} walletAddress={walletAddress} onConnectWallet={handleConnectWallet} onDisconnectWallet={() => { setWalletAddress(null); setSigner(null); }} /></PageTransition>} />
              <Route path="/setup" element={<PageTransition pathname={location.pathname}><SetupScreen onContinue={handleSetupComplete} /></PageTransition>} />
              <Route path="/quiz" element={<PageTransition pathname={location.pathname}><QuizScreen roundQuestions={roundQuestions} onRoundComplete={handleRoundComplete} /></PageTransition>} />
              <Route path="/results" element={<PageTransition pathname={location.pathname}><ResultsScreen result={result} roundQuestions={roundQuestions} stakeInfo={stakeInfo} signer={signer} onPlayAgain={handlePlayAgain} /></PageTransition>} />
              <Route path="/leaderboard" element={<PageTransition pathname={location.pathname}><LeaderboardScreen walletAddress={walletAddress} /></PageTransition>} />
              <Route path="/categories" element={<PageTransition pathname={location.pathname}><CategoriesScreen /></PageTransition>} />
              <Route path="/profile" element={<PageTransition pathname={location.pathname}><ProfileScreen stats={stats} recentGames={recentGames} walletAddress={walletAddress} onConnectWallet={handleConnectWallet} onDisconnectWallet={() => { setWalletAddress(null); setSigner(null); }} /></PageTransition>} />
            </Routes>
          </AnimatePresence>
        </ErrorBoundary>

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
                  <div className="flex justify-center items-center gap-2 mb-4">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                        className="w-3 h-3 rounded-full bg-[#4F46E5]"
                      />
                    ))}
                  </div>
                  <p className="text-base font-bold text-slate-800 mt-4">Verifying your round...</p>
                  <p className="text-sm text-slate-400 mt-1">{verifyMessage}</p>
                </>
              )}
            </div>
          </div>
        )}

        <StakeModal
          isOpen={isStakeModalOpen || screen === "stake"}
          onClose={() => { setIsStakeModalOpen(false); setScreen("home"); navigate("/"); }}
          onStaked={handleStaked}
          onConnect={(addr, s) => { setWalletAddress(addr); setSigner(s); }}
          walletAddress={walletAddress}
          signer={signer}
        />
      </main>
    </div>
  );
}

const customEase = [0.22, 1, 0.36, 1];

function PageTransition({ children, pathname }) {
  const isBackToHome = pathname === "/home" || pathname === "/";
  return (
    <motion.div
      key={pathname}
      initial={isBackToHome ? { opacity: 0 } : { opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={isBackToHome ? { opacity: 0 } : { opacity: 0, x: -20 }}
      transition={{ duration: 0.4, ease: customEase }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}
