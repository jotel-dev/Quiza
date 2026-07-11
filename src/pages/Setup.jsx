import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Info } from "lucide-react";

export default function Setup({ onContinue }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [category, setCategory] = useState("Mixed");
  const [difficulty, setDifficulty] = useState("Mixed");

  useEffect(() => {
    fetch("/api/question-stats")
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Loader2 className="animate-spin text-[#4F46E5]" size={32} />
      </div>
    );
  }

  const categories = Object.keys(stats.categories);
  const difficulties = ["Mixed", "easy", "medium", "hard"];

  // Determine how many questions match the current selection
  const currentCategoryStats = stats.categories[category] || { easy: 0, medium: 0, hard: 0, mixed: 0 };
  const count = difficulty === "Mixed" ? currentCategoryStats.mixed : (currentCategoryStats[difficulty] || 0);
  const needsBackfill = count < 10;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        <h1 className="text-3xl font-extrabold text-slate-800 mb-2 text-center">Customize Your Round</h1>
        <p className="text-slate-500 text-center mb-8">Choose your preferred category and difficulty to get started.</p>

        <div className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgba(79,70,229,0.08)] rounded-[22px] p-6 sm:p-8 space-y-8">
          
          {/* Category Selection */}
          <div>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Category</h2>
            <div className="flex flex-wrap gap-3">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 border ${
                    category === cat 
                      ? "bg-indigo-50 border-[#4F46E5] text-[#4F46E5] shadow-[0_0_0_2px_rgba(79,70,229,0.15)]" 
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Selection */}
          <div>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Difficulty</h2>
            <div className="flex flex-wrap gap-3">
              {difficulties.map(diff => (
                <button
                  key={diff}
                  onClick={() => setDifficulty(diff)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold capitalize transition-all duration-200 border ${
                    difficulty === diff 
                      ? "bg-indigo-50 border-[#4F46E5] text-[#4F46E5] shadow-[0_0_0_2px_rgba(79,70,229,0.15)]" 
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          {/* Info & Submit */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-700">
                {count} questions available
              </span>
              {needsBackfill && (
                <span className="text-xs text-orange-500 font-medium flex items-center gap-1 mt-1">
                  <Info size={12} />
                  Short round! Will top up from mixed pool.
                </span>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onContinue(category, difficulty)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#4F46E5] text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 transition"
            >
              Continue
              <ArrowRight size={18} />
            </motion.button>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
