import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function Welcome({ darkMode, onToggleTheme }) {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/home");
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className={`min-h-screen w-full flex items-center justify-center overflow-hidden relative ${darkMode ? "bg-slate-900" : "bg-[#0A4C86]"}`}>
      <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-orange-400/20 rounded-full blur-3xl" />
      
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          type: "spring",
          stiffness: 260,
          damping: 20,
          duration: 1 
        }}
        className="flex flex-col items-center gap-4"
      >
        <img src="/logo.png" alt="Quiza Logo" className="w-28 h-28 object-contain drop-shadow-[0_0_40px_rgba(255,255,255,0.3)]" />
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <h1 className="text-white text-3xl font-extrabold tracking-tight">QUIZA</h1>
          <p className="text-indigo-200 font-medium tracking-widest text-sm mt-1">PLAY • LEARN • WIN</p>
        </motion.div>
        
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          onClick={onToggleTheme}
          className="mt-8 text-white/70 hover:text-white text-xs font-medium transition-colors"
        >
          {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </motion.button>
      </motion.div>
    </div>
  );
}
