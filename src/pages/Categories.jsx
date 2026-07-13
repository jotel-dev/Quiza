import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FlaskConical, Landmark, CircleDot, Film, Globe2 } from "lucide-react";

const categories = [
  { icon: FlaskConical, label: "Math", count: 10, color: "#4F46E5" },
  { icon: Landmark, label: "History", count: 10, color: "#F59E0B" },
  { icon: CircleDot, label: "Web3", count: 5, color: "#10B981" },
  { icon: Film, label: "General Knowledge", count: 10, color: "#EF4444" },
  { icon: Globe2, label: "Geography", count: 10, color: "#10B981" },
];

function GlassCard({ children, className = "", onClick }) {
  return (
    <div 
      className={`rounded-[22px] border border-white/60 shadow-[0_8px_30px_rgba(79,70,229,0.08)] backdrop-blur-xl bg-white/70 ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export default function Categories() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = categories.filter((cat) =>
    cat.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto min-h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 sm:gap-4 mb-8">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Quiza Logo" className="h-9 sm:h-11 w-auto object-contain lg:hidden shrink-0 mix-blend-multiply contrast-[1.2] brightness-[1.1]" style={{ clipPath: "inset(2px)" }} />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 hidden sm:block">Categories</h1>
        </div>
        <div className="flex-1 max-w-md relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories..."
            className="w-full bg-slate-50 border border-slate-100 rounded-full pl-10 pr-4 py-2.5 text-sm text-slate-600 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      </div>

      <div className="flex-1">
        {filteredCategories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {filteredCategories.map(({ icon: Icon, label, count, color }) => (
              <GlassCard 
                key={label} 
                className="p-6 flex flex-col items-center text-center hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(79,70,229,0.12)] transition-all cursor-pointer h-full justify-center" 
                onClick={() => navigate("/setup", { state: { category: label } })}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${color}1A` }}>
                  <Icon size={32} style={{ color }} />
                </div>
                <p className="text-base font-bold text-slate-700">{label}</p>
                <p className="text-xs text-slate-400 mt-1">{count} Questions</p>
              </GlassCard>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-slate-50 rounded-[22px] border border-slate-100">
            <p className="text-slate-500 text-base">No categories found matching "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
