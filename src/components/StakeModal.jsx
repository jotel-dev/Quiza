import React, { useState, useEffect } from "react";
import { Wallet, X, Coins, ChevronRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { connectWallet, ensureNetwork, stakeCelo, stakeCUSD, getWalletBalances, getRoundIdFromReceipt, NETWORK } from "../lib/quizaContract";

const INITIAL_TOKENS = [
  { symbol: "CELO", name: "Celo", color: "#F26722", balance: "0.0000" },
  { symbol: "cUSD", name: "Celo Dollar", color: "#0A4C86", balance: "0.0000" },
];


const WIN_MULTIPLIER = 1.5;

export default function StakeModal({ isOpen, onClose, onStaked, onConnect, walletAddress }) {
  const [walletState, setWalletState] = useState(walletAddress ? "connected" : "disconnected");
  const [address, setAddress] = useState(walletAddress ? walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4) : null);
  const [fullAddress, setFullAddress] = useState(walletAddress || null);
  const [signer, setSigner] = useState(null);
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [tokens, setTokens] = useState(INITIAL_TOKENS);
  const [selectedToken, setSelectedToken] = useState(INITIAL_TOKENS[1]);
  const [txState, setTxState] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [roundId, setRoundId] = useState(null);
  const [username, setUsername] = useState(() => localStorage.getItem("quiza_username") || "");
  
  const stakeAmt = selectedToken.symbol === "cUSD" ? 0.001 : 0.01;

  useEffect(() => {
    if (walletAddress && !address) {
      setAddress(walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4));
      setFullAddress(walletAddress);
      setWalletState("connected");
    }
  }, [walletAddress, address]);

  useEffect(() => {
    if (isOpen) {
      setTxState("idle");
      setRoundId(null);
      setErrorMessage("");
    }
  }, [isOpen]);

  const handleConnect = async () => {
    setWalletState("connecting");
    try {
      const { provider, signer, address: addr, isMiniPay } = await connectWallet();
      await ensureNetwork(NETWORK);
      
      const balances = await getWalletBalances(provider, addr, NETWORK);
      const updatedTokens = [
        { ...INITIAL_TOKENS[0], balance: balances.CELO },
        { ...INITIAL_TOKENS[1], balance: balances.cUSD },
      ];
      setTokens(updatedTokens);
      setSelectedToken(updatedTokens[1]);

      setSigner(signer);
      setAddress(addr.slice(0, 6) + "..." + addr.slice(-4));
      setFullAddress(addr);
      setIsMiniPay(isMiniPay);
      setWalletState("connected");
      onConnect?.();
    } catch (error) {
      console.error("Wallet connection failed:", error);
      setErrorMessage(error?.message || "Connection failed. Please try again.");
      setTxState("error");
      setWalletState("disconnected");
    }
  };

  const handleStake = async () => {
    setTxState("staking");
    setErrorMessage("");
    
    const finalUsername = username.trim() || fullAddress.slice(0, 6) + "...";
    localStorage.setItem("quiza_username", finalUsername);
    try {
      await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: fullAddress, username: finalUsername }),
      });
    } catch (e) { console.error("Failed to set username:", e); }

    try {
      let receipt;
      if (selectedToken.symbol === "CELO") {
        receipt = await stakeCelo(signer, stakeAmt.toString(), NETWORK);
      } else {
        receipt = await stakeCUSD(signer, stakeAmt.toString(), NETWORK);
      }
      const newRoundId = getRoundIdFromReceipt(receipt, NETWORK);
      setRoundId(newRoundId);
      setTxState("staked");
    } catch (error) {
      console.error("Staking failed:", error);
      let errMsg = error?.message || "Transaction failed or was rejected.";
      if (errMsg.toLowerCase().includes("user rejected") || errMsg.includes("4001")) {
        errMsg = "Transaction was rejected in your wallet. Please try again.";
      } else if (errMsg.includes("could not coalesce error")) {
        // Ethers v6 often wraps RPC errors in a huge JSON blob if it can't map the code
        const match = errMsg.match(/"message":\s*"([^"]+)"/);
        errMsg = match ? match[1] : "Transaction failed (Unknown error).";
      } else if (errMsg.length > 100) {
        // Fallback for other massive unparsed errors
        errMsg = "Transaction failed. Please check your balance or try again.";
      }
      setErrorMessage(errMsg);
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
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0A4C86]/10 flex items-center justify-center mb-4">
              <Wallet size={26} className="text-[#0A4C86]" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Connect your wallet</h2>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
              Connect your wallet to stake and play. Your winnings are paid out directly to your wallet.
            </p>
            <button
              onClick={handleConnect}
              disabled={walletState === "connecting"}
              className="w-full mt-5 flex items-center justify-center gap-2 bg-[#0A4C86] text-white text-sm font-semibold py-3 rounded-xl shadow-md shadow-blue-200 hover:opacity-90 transition active:scale-95 disabled:opacity-70"
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
              {isMiniPay && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-[#0A4C86] ml-1">
                  MiniPay
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-800 mt-2">Choose your stake</h2>
            <p className="text-sm text-slate-400 mt-1">
              Score {" "}
              <span className="font-semibold text-slate-600">7/10 or higher</span> to win{" "}
              <span className="font-semibold text-[#0A4C86]">{WIN_MULTIPLIER}x</span> your stake back.
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
                        ? "border-[#0A4C86] bg-blue-50/60 shadow-[0_0_0_3px_rgba(79,70,229,0.1)]"
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

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-500 mb-1">Leaderboard Username (Optional)</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={address}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0A4C86] transition-colors"
                maxLength={20}
              />
            </div>

            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 mt-4">
              <span className="text-xs font-medium text-slate-400">Stake amount</span>
              <span className="text-sm font-bold text-slate-800">
                {stakeAmt} {selectedToken.symbol}
              </span>
            </div>

            <button
              onClick={handleStake}
              disabled={parseFloat(selectedToken.balance) < stakeAmt}
              className="w-full mt-5 flex items-center justify-center gap-2 bg-[#0A4C86] text-white text-sm font-semibold py-3 rounded-xl shadow-md shadow-blue-200 hover:opacity-90 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {parseFloat(selectedToken.balance) < stakeAmt ? "Insufficient Balance" : "Stake & Start Quiz"}
              {parseFloat(selectedToken.balance) >= stakeAmt && <ChevronRight size={15} />}
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
            <Loader2 size={32} className="mx-auto text-[#0A4C86] animate-spin-slow" />
            <h2 className="text-base font-bold text-slate-800 mt-4">Confirming stake...</h2>
            <p className="text-sm text-slate-400 mt-1">
              Staking {stakeAmt} {selectedToken.symbol} on Celo
            </p>
          </div>
        )}

        {/* STEP 4: Staked successfully */}
        {txState === "staked" && (
          <div className="text-center py-4">
            <CheckCircle2 size={44} className="mx-auto text-[#10B981]" />
            <h2 className="text-lg font-bold text-slate-800 mt-3">Stake confirmed!</h2>
            <p className="text-sm text-slate-400 mt-1">
              {stakeAmt} {selectedToken.symbol} locked in. Good luck!
            </p>
            <button 
              onClick={() => onStaked({ token: selectedToken.symbol, roundId, address, signer })}
              className="w-full mt-5 bg-[#0A4C86] text-white text-sm font-semibold py-3 rounded-xl shadow-md shadow-blue-200 hover:opacity-90 transition active:scale-95"
            >
              Start Quiz →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
