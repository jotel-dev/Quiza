import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Calendar, FlaskConical, Landmark, CircleDot, Film, Laptop, Globe2, 
  Trophy, Target, Flame, Users, TrendingUp, User, Award
} from 'lucide-react';
import { motion } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import StatCard from '../components/StatCard';
import { useOutletContext } from 'react-router-dom';

const categories = [
  { icon: FlaskConical, label: "Science", count: 120, color: "#0A4C86" },
  { icon: Landmark, label: "History", count: 95, color: "#F26722" },
  { icon: CircleDot, label: "Sports", count: 110, color: "#10B981" },
  { icon: Film, label: "Movies", count: 130, color: "#EF4444" },
  { icon: Laptop, label: "Technology", count: 90, color: "#0A4C86" },
  { icon: Globe2, label: "Geography", count: 85, color: "#10B981" },
];



const popularQuizzes = [
  { tag: "Science", tagColor: "#0A4C86", title: "Space Exploration Quiz", q: 10 },
  { tag: "History", tagColor: "#F26722", title: "World History Essentials", q: 15 },
  { tag: "Sports", tagColor: "#10B981", title: "Football Legends Quiz", q: 10 },
  { tag: "Movies", tagColor: "#EF4444", title: "Movie Buff Challenge", q: 15 },
];

export default function Home() {
  const { setIsStakeModalOpen } = useOutletContext();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
      {/* Left column */}
      <div className="space-y-5 min-w-0">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <GlassCard className="p-6 sm:p-8 bg-gradient-to-br from-blue-50/80 via-white to-orange-50/40 relative overflow-hidden">
            <div className="relative z-10 max-w-md">
              <p className="text-sm text-slate-400 font-medium">Welcome back,</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-1 leading-snug">
                Ready to <span className="text-[#0A4C86]">test your knowledge?</span>
              </h1>
              <p className="text-sm text-slate-400 mt-3 leading-relaxed">
                Play quizzes, stake CELO or cUSD, and become the trivia champion.
              </p>
              <div className="flex items-center gap-3 mt-5">
                <motion.button 
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setIsStakeModalOpen(true)}
                  className="flex items-center gap-2 bg-[#0A4C86] text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-200 transition"
                >
                  <Play size={14} fill="white" />
                  Start Quiz
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-50 transition"
                >
                  <Calendar size={14} />
                  Daily Challenge
                </motion.button>
              </div>
            </div>
            {/* Decorative thinking character placeholder */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex w-40 h-40 rounded-full bg-white/60 items-center justify-center">
              <span className="text-6xl">🤔</span>
            </div>
            <div className="absolute right-2 bottom-4 hidden sm:block text-3xl">💡</div>
            <div className="absolute right-32 top-6 hidden sm:block text-2xl">❓</div>
          </GlassCard>
        </motion.div>

        {/* Categories */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800">Categories</h2>
            <button className="text-xs font-semibold text-[#0A4C86]">View All</button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {categories.map(({ icon: Icon, label, count, color }) => (
              <GlassCard
                key={label}
                className="p-4 flex flex-col items-center text-center hover:-translate-y-1 transition-transform cursor-pointer"
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center mb-2"
                  style={{ backgroundColor: `${color}1A` }}
                >
                  <Icon size={20} style={{ color }} />
                </div>
                <p className="text-xs font-semibold text-slate-700">{label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{count} Quizzes</p>
              </GlassCard>
            ))}
          </div>
        </motion.div>

        {/* Daily Challenge + Rewards */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassCard className="p-5">
            <p className="text-xs font-bold text-[#F26722] mb-1">Daily Challenge</p>
            <p className="text-sm text-slate-500">Answer 10 questions and win</p>
            <p className="text-sm font-semibold text-slate-700 mt-1">0.02 cUSD + 10 XP</p>
            <div className="w-full h-1.5 bg-slate-100 rounded-full mt-4 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }} animate={{ width: "40%" }} transition={{ duration: 1, delay: 0.5 }}
                className="h-full bg-[#F26722] rounded-full" 
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">4 / 10</p>
          </GlassCard>
          <GlassCard className="p-5">
            <p className="text-xs font-bold text-[#0A4C86] mb-1">Earn Rewards</p>
            <p className="text-sm text-slate-500">Play quizzes, complete challenges, and earn CELO or cUSD.</p>
            <button className="mt-3 text-xs font-semibold text-white bg-[#0A4C86] px-4 py-2 rounded-lg hover:opacity-90 transition active:scale-95">
              Explore Rewards
            </button>
          </GlassCard>
        </motion.div>

        {/* Popular Quizzes */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800">Popular Quizzes</h2>
            <button className="text-xs font-semibold text-[#0A4C86]">View All</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {popularQuizzes.map(({ tag, tagColor, title, q }) => (
              <GlassCard key={title} className="overflow-hidden cursor-pointer hover:-translate-y-1 transition-transform group">
                <div
                  className="h-20 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform duration-500"
                  style={{ background: `linear-gradient(135deg, ${tagColor}22, ${tagColor}08)` }}
                >
                  🎯
                </div>
                <div className="p-3">
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: tagColor, backgroundColor: `${tagColor}18` }}
                  >
                    {tag}
                  </span>
                  <p className="text-xs font-semibold text-slate-700 mt-2 leading-snug">{title}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-slate-400">{q} Questions</p>
                    <button className="w-6 h-6 rounded-full bg-[#0A4C86]/10 flex items-center justify-center group-hover:bg-[#0A4C86] transition-colors">
                      <Play size={10} className="text-[#0A4C86] group-hover:text-white" fill="currentColor" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right column */}
      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Quizzes Played" value="48" icon={Users} iconColor="#0A4C86" iconBg="#F0F6FA" />
          <StatCard label="Best Score" value="2450" icon={Trophy} iconColor="#F26722" iconBg="#FEF3E2" />
          <StatCard label="Accuracy" value="76%" icon={Target} iconColor="#10B981" iconBg="#ECFDF5" />
          <StatCard label="Current Streak" value="12" icon={Flame} iconColor="#EF4444" iconBg="#FEF2F2" />
        </div>



        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-slate-800">Achievements</h3>
            <button className="text-[11px] font-semibold text-[#0A4C86]">View All</button>
          </div>
          <div className="space-y-4">
            {[
              { label: "Quiz Master", sub: "Complete 50 quizzes", value: 32, max: 50, color: "#0A4C86" },
              { label: "Streak King", sub: "Maintain a 7-day streak", value: 12, max: 7, color: "#F26722" },
              { label: "Perfect Score", sub: "Score 100% in any quiz", value: 5, max: 10, color: "#10B981" },
            ].map((a, idx) => (
              <div key={a.label} className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${a.color}18` }}
                >
                  <Award size={16} style={{ color: a.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700">{a.label}</p>
                  <p className="text-[10px] text-slate-400">{a.sub}</p>
                  <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (a.value / a.max) * 100)}%` }}
                      transition={{ duration: 1, delay: 0.5 + (idx * 0.2) }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: a.color }}
                    />
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                  {a.value}/{a.max}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>

    </div>
  );
}
