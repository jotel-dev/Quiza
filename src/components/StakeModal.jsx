import React, { useState } from "react";
import { Wallet, X, Coins, ChevronRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { connectWallet, ensureNetwork, stakeCelo, stakeCUSD, getWalletBalances } from "../lib/quizaContract";

const INITIAL_TOKENS = [
  { symbol: "CELO", name: "Celo", color: "#F59E0B", balance: "0.0000" },
  { symbol: "cUSD", name: "Celo Dollar", color: "#4F46E5", balance: "0.0000" },
];

const STAKE_AMOUNT = 0.01;
const WIN_MULTIPLIER = 1.5;

// Simulated wallet/tx states: idle -> connecting -> connected -> staking -> staked
export default function StakeModal({ isOpen, onClose, onStartQuiz }) {
  const [walletState, setWalletState] = useState("disconnected"); // disconnected | connecting | connected
  const [address, setAddress] = useState(null);
  const [signer, setSigner] = useState(null);
  const [tokens, setTokens] = useState(INITIAL_TOKENS);
  const [selectedToken, setSelectedToken] = useState(INITIAL_TOKENS[1]); // default cUSD
  const [txState, setTxState] = useState("idle"); // idle | staking | staked | error
  const [errorMessage, setErrorMessage] = useState("");

  const handleConnect = async () => {
    setWalletState("connecting");
    try {
      const { provider, signer, address } = await connectWallet();
      await ensureNetwork("mainnet"); 
      
      const balances = await getWalletBalances(provider, address, "mainnet");
      const updatedTokens = [
        { ...INITIAL_TOKENS[0], balance: balances.CELO },
        { ...INITIAL_TOKENS[1], balance: balances.cUSD },
      ];
      setTokens(updatedTokens);
      setSelectedToken(updatedTokens[1]);

      setSigner(signer);
      setAddress(address.slice(0, 6) + "..." + address.slice(-4));
      setWalletState("connected");
    } catch (error) {
      console.error("Wallet connection failed:", error);
      setWalletState("disconnected");
    }
  };

  const handleStake = async () => {
    setTxState("staking");
    setErrorMessage("");
    try {
      if (selectedToken.symbol === "CELO") {
        await stakeCelo(signer, STAKE_AMOUNT.toString(), "mainnet");
      } else {
        await stakeCUSD(signer, STAKE_AMOUNT.toString(), "mainnet");
      }
      setTxState("staked");
    } catch (error) {
      console.error("Staking failed:", error);
      setErrorMessage(error?.message || "Transaction failed or was rejected.");
      setTxState("error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-sans p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm rounded-[24px] border border-white/60 shadow-[0_20px_60px_rgba(79,70,229,0.15)] backdrop-blur-xl bg-white p-6 animate-fade-in z-10">
        <style>{`
          @keyframes fade-in-scale {
            0% { opacity: 0; transform: scale(0.96) translateY(8px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          .animate-fade-in { animation: fade-in-scale 0.3s ease-out forwards; }
          @keyframes spin { to { transform: rotate(360deg); } }
          .animate-spin-slow { animation: spin 1s linear infinite; }
        `}</style>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition"
        >
          <X size={14} className="text-slate-400" />
        </button>

        {/* STEP 1: Wallet not connected */}
        {walletState !== "connected" && (
          <div className="text-center py-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#4F46E5]/10 flex items-center justify-center mb-4">
              <Wallet size={26} className="text-[#4F46E5]" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Connect your wallet</h2>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
              Connect your wallet to stake and play. Your winnings are paid out directly to your wallet.
            </p>
            <button
              onClick={handleConnect}
              disabled={walletState === "connecting"}
              className="w-full mt-5 flex items-center justify-center gap-2 bg-[#4F46E5] text-white text-sm font-semibold py-3 rounded-xl shadow-md shadow-indigo-200 hover:opacity-90 transition active:scale-95 disabled:opacity-70"
            >
              {walletState === "connecting" ? (
                <>
                  <Loader2 size={16} className="animate-spin-slow" />
                  Connecting...
                </>
              ) : (
                <>Connect Wallet</>
              )}
            </button>
          </div>
        )}

        {/* STEP 2: Wallet connected, choose token + stake */}
        {walletState === "connected" && txState === "idle" && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-[#10B981]" />
              <span className="text-xs font-medium text-slate-400">{address}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mt-2">Choose your stake</h2>
            <p className="text-sm text-slate-400 mt-1">
              Score {" "}
              <span className="font-semibold text-slate-600">7/10 or higher</span> to win{" "}
              <span className="font-semibold text-[#4F46E5]">{WIN_MULTIPLIER}x</span> your stake back.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              {tokens.map((t) => {
                const isSelected = selectedToken.symbol === t.symbol;
                return (
                  <button
                    key={t.symbol}
                    onClick={() => setSelectedToken(t)}
                    className={`rounded-2xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-[#4F46E5] bg-indigo-50/60 shadow-[0_0_0_3px_rgba(79,70,229,0.1)]"
                        : "border-slate-150 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${t.color}1A` }}
                      >
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
              <span className="text-sm font-bold text-slate-800">
                {STAKE_AMOUNT} {selectedToken.symbol}
              </span>
            </div>

            <button
              onClick={handleStake}
              disabled={parseFloat(selectedToken.balance) < STAKE_AMOUNT}
              className="w-full mt-5 flex items-center justify-center gap-2 bg-[#4F46E5] text-white text-sm font-semibold py-3 rounded-xl shadow-md shadow-indigo-200 hover:opacity-90 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {parseFloat(selectedToken.balance) < STAKE_AMOUNT ? "Insufficient Balance" : "Stake & Start Quiz"}
              {parseFloat(selectedToken.balance) >= STAKE_AMOUNT && <ChevronRight size={15} />}
            </button>
          </div>
        )}

        {/* ERROR STATE */}
        {txState === "error" && (
          <div className="text-center py-4">
            <AlertCircle size={44} className="mx-auto text-red-500 mb-3" />
            <h2 className="text-lg font-bold text-slate-800">Transaction Failed</h2>
            <p className="text-xs text-slate-500 mt-2 break-words">{errorMessage}</p>
            <button
              onClick={() => setTxState("idle")}
              className="w-full mt-5 bg-slate-100 text-slate-700 text-sm font-semibold py-3 rounded-xl hover:bg-slate-200 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* STEP 3: Staking in progress */}
        {txState === "staking" && (
          <div className="text-center py-6">
            <Loader2 size={32} className="mx-auto text-[#4F46E5] animate-spin-slow" />
            <h2 className="text-base font-bold text-slate-800 mt-4">Confirming stake...</h2>
            <p className="text-sm text-slate-400 mt-1">
              Staking {STAKE_AMOUNT} {selectedToken.symbol} on Celo
            </p>
          </div>
        )}

        {/* STEP 4: Staked successfully */}
        {txState === "staked" && (
          <div className="text-center py-4">
            <CheckCircle2 size={44} className="mx-auto text-[#10B981]" />
            <h2 className="text-lg font-bold text-slate-800 mt-3">Stake confirmed!</h2>
            <p className="text-sm text-slate-400 mt-1">
              {STAKE_AMOUNT} {selectedToken.symbol} locked in. Good luck!
            </p>
            <button 
              onClick={onStartQuiz}
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
