import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, Copy, Check, ExternalLink, Trophy, Sparkles, MessageCircle, Send } from "lucide-react";

export default function ShareModal({ isOpen, onClose, shareData }) {
  if (!isOpen || !shareData) return null;

  const [copied, setCopied] = useState(false);

  const {
    score = "9",
    total = "10",
    multiplier = "1.5x",
    payout = null,
    token = "CELO",
    username = "Player",
    rank = null,
    won = true,
    type = "game", // "game" or "leaderboard"
  } = shareData;

  const appUrl = window.location.origin;
  
  // Construct parameters for dynamic OG image
  const ogParams = new URLSearchParams({
    score: score.toString(),
    total: total.toString(),
    multiplier: multiplier || "1.0x",
    payout: payout ? payout.toString() : "",
    token: token || "CELO",
    username: username || "Player",
    rank: rank ? rank.toString() : "",
    won: won ? "true" : "false",
  }).toString();

  const ogImageUrl = `${appUrl}/api/og?${ogParams}`;
  const shareCardUrl = `${appUrl}/api/share-card?${ogParams}`;

  // Custom high-converting social share message
  const shareText = type === "leaderboard"
    ? `🏆 I am currently ranked #${rank} on the global Quiza leaderboard! Think you can beat me in Web3 trivia on Celo?`
    : won
    ? `🔥 I just won ${multiplier} my stake scoring ${score}/${total} in Web3 Trivia on Quiza! Can you beat me?`
    : `🧠 I scored ${score}/${total} in Web3 Trivia on Quiza! Test your knowledge & earn on Celo.`;

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareCardUrl)}`;
  const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(shareCardUrl)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareCardUrl)}&text=${encodeURIComponent(shareText)}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareCardUrl}`)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareCardUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Quiza Web3 Trivia",
          text: shareText,
          url: shareCardUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 p-6 relative"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-[#4F46E5] flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Share Your Achievement</h2>
              <p className="text-xs text-slate-400">Viral OpenGraph Card</p>
            </div>
          </div>

          {/* Dynamic OG Image Card Preview */}
          <div className="my-4 rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-slate-900 relative aspect-[1.91/1] flex items-center justify-center group">
            <img
              src={ogImageUrl}
              alt="Social Share Card Preview"
              className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
              onError={(e) => {
                // Fallback UI if image loading in dev
                e.target.style.display = "none";
              }}
            />
            <div className="absolute bottom-2 right-2 bg-black/60 text-white/90 text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-md">
              Live Preview
            </div>
          </div>

          {/* Share Text Quote Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 mb-5">
            <p className="text-xs font-medium text-slate-700 leading-relaxed italic">
              "{shareText}"
            </p>
          </div>

          {/* Social Share Actions */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {/* Twitter / X */}
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-black text-white hover:opacity-90 transition active:scale-95"
            >
              <span className="text-base font-black leading-none">𝕏</span>
              <span className="text-[10px] font-semibold">Post</span>
            </a>

            {/* Warpcast (Farcaster) */}
            <a
              href={warpcastUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#855DCD] text-white hover:opacity-90 transition active:scale-95"
            >
              <span className="text-sm font-extrabold leading-none">🔮</span>
              <span className="text-[10px] font-semibold">Farcaster</span>
            </a>

            {/* Telegram */}
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#0088cc] text-white hover:opacity-90 transition active:scale-95"
            >
              <Send size={16} />
              <span className="text-[10px] font-semibold">Telegram</span>
            </a>

            {/* WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#25D366] text-white hover:opacity-90 transition active:scale-95"
            >
              <MessageCircle size={16} />
              <span className="text-[10px] font-semibold">WhatsApp</span>
            </a>
          </div>

          {/* Bottom Actions: Copy Link & Native Share */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 text-xs font-semibold py-3 rounded-xl hover:bg-slate-200 transition active:scale-95"
            >
              {copied ? (
                <><Check size={15} className="text-emerald-600" /><span className="text-emerald-600">Copied!</span></>
              ) : (
                <><Copy size={15} />Copy Link</>
              )}
            </button>

            {navigator.share && (
              <button
                onClick={handleNativeShare}
                className="flex-1 flex items-center justify-center gap-2 bg-[#4F46E5] text-white text-xs font-semibold py-3 rounded-xl shadow-md shadow-indigo-200 hover:opacity-90 transition active:scale-95"
              >
                <Share2 size={15} />More Options
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
