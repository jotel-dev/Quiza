import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, User, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import GlassCard from '../components/GlassCard';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden p-6">
      <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-300/30 blur-3xl -z-10" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-orange-300/20 blur-3xl -z-10" />
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full"
      >
        <GlassCard className="p-8 flex flex-col items-center text-center bg-white/60">
          <div className="w-16 h-16 rounded-2xl bg-[#0A4C86] flex items-center justify-center shadow-lg shadow-blue-200 mb-6">
            <span className="text-white text-3xl font-black">?</span>
          </div>
          
          <h1 className="text-3xl font-extrabold text-slate-800 mb-2">Welcome to Quiza</h1>
          <p className="text-sm text-slate-500 mb-8">
            Connect your wallet to earn rewards and jump right in!
          </p>

          <div className="w-full space-y-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/home')}
              className="w-full flex items-center justify-center gap-3 bg-[#0A4C86] text-white font-semibold py-3.5 rounded-xl shadow-md shadow-blue-200"
            >
              <Wallet size={18} />
              Connect Wallet
            </motion.button>
            

          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
