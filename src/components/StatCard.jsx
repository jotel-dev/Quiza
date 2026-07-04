import React from 'react';
import GlassCard from './GlassCard';

export default function StatCard({ label, value, icon: Icon, iconColor, iconBg }) {
  return (
    <GlassCard className="p-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
      </div>
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ backgroundColor: iconBg }}
      >
        <Icon size={18} style={{ color: iconColor }} />
      </div>
    </GlassCard>
  );
}
