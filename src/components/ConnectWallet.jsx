import React from 'react';
import { Wallet } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ConnectWallet({ onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, opacity: 0.9 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="hidden sm:flex items-center gap-2 bg-[#4F46E5] text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-md shadow-indigo-200 transition-colors"
    >
      <Wallet size={15} />
      Connect Wallet
    </motion.button>
  );
}
