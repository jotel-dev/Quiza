import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    // Navigate to welcome screen after 2.5 seconds
    const timer = setTimeout(() => {
      navigate('/welcome');
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#4F46E5] overflow-hidden relative">
      {/* Background decorations */}
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
        <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.3)]">
          <span className="text-[#4F46E5] text-4xl font-black">?</span>
        </div>
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <h1 className="text-white text-3xl font-extrabold tracking-tight">QUIZA</h1>
          <p className="text-indigo-200 font-medium tracking-widest text-sm mt-1">PLAY • LEARN • WIN</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
