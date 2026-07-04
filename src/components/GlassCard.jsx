import React from 'react';

export default function GlassCard({ children, className = "" }) {
  return (
    <div
      className={`rounded-[22px] border border-white/60 shadow-[0_8px_30px_rgba(79,70,229,0.08)] backdrop-blur-xl bg-white/70 ${className}`}
    >
      {children}
    </div>
  );
}
