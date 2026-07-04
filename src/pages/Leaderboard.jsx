import React from 'react';
import { User, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import GlassCard from '../components/GlassCard';

const performers = [
  { name: "Emma Johnson", score: 2450 },
  { name: "Liam Smith", score: 2300 },
  { name: "Noah Williams", score: 2100 },
  { name: "Olivia Brown", score: 1950 },
  { name: "Ava Davis", score: 1800 },
  { name: "William Miller", score: 1750 },
  { name: "Sophia Wilson", score: 1680 },
  { name: "James Taylor", score: 1600 },
  { name: "Isabella Anderson", score: 1550 },
  { name: "Benjamin Thomas", score: 1500 },
];

export default function Leaderboard() {
  return (
    <div className="max-w-3xl mx-auto py-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-extrabold text-slate-800">Leaderboard</h1>
            <div className="bg-indigo-50 text-[#4F46E5] text-xs font-bold px-3 py-1.5 rounded-full">
              Global
            </div>
          </div>
          
          <div className="space-y-4">
            {performers.map((p, i) => (
              <motion.div 
                key={p.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm
                    ${i === 0 ? "bg-[#F59E0B]" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-300" : "bg-slate-200 text-slate-500"}`}
                >
                  {i + 1}
                </div>
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <User size={18} className="text-[#4F46E5]" />
                </div>
                <p className="text-sm font-semibold text-slate-700 flex-1 truncate">{p.name}</p>
                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full">
                  <TrendingUp size={14} className="text-[#F59E0B]" />
                  <span className="text-sm font-extrabold text-slate-700">{p.score}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
