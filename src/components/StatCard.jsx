import React from 'react';

/**
 * Metric Card to display KPIs on the dashboard.
 * Features hover shadow transition, custom colors, glassmorphism, and icons.
 */
export default function StatCard({ title, value, icon: Icon, description, color = 'indigo' }) {
  const colorMap = {
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-150 dark:border-indigo-900/60 shadow-indigo-500/10',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-150 dark:border-emerald-900/60 shadow-emerald-500/10',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-150 dark:border-amber-900/60 shadow-amber-500/10',
    rose: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-150 dark:border-rose-900/60 shadow-rose-500/10',
  };

  const selectedColor = colorMap[color] || colorMap.indigo;

  return (
    <div className="glass-card flex items-center justify-between p-6 rounded-2xl group hover:-translate-y-1 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-all duration-300">
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase">{title}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{value}</span>
        </div>
        {description && (
          <p className="text-xs text-gray-400 dark:text-gray-500 font-medium leading-relaxed">{description}</p>
        )}
      </div>

      <div className={`p-4 rounded-2xl border shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-md ${selectedColor}`}>
        <Icon className="w-6 h-6" aria-hidden="true" />
      </div>
    </div>
  );
}
