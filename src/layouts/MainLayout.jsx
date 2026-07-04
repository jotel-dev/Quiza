import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import StakeModal from '../components/StakeModal';
import { motion } from 'framer-motion';

export default function MainLayout() {
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="min-h-screen w-full bg-slate-50 flex font-sans text-slate-800">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto relative">
        <Topbar onConnectClick={() => setIsStakeModalOpen(true)} />
        {/* Animate Presence can be added at the App level for page transitions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="relative z-10"
        >
          <Outlet context={{ setIsStakeModalOpen }} />
        </motion.div>
        
        {/* Background Decorative Blobs for Glassmorphism feel */}
        <div className="fixed top-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-indigo-300/20 blur-3xl -z-10 pointer-events-none" />
        <div className="fixed bottom-[-10%] left-[-5%] w-[30vw] h-[30vw] rounded-full bg-orange-300/20 blur-3xl -z-10 pointer-events-none" />
      </main>
      <StakeModal 
        isOpen={isStakeModalOpen} 
        onClose={() => setIsStakeModalOpen(false)} 
        onStartQuiz={() => {
          setIsStakeModalOpen(false);
          navigate('/quiz');
        }} 
      />
    </div>
  );
}
