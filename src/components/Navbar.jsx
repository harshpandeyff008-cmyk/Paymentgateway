import React from 'react';
import { Menu, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onMenuClick, title }) {
  const { isDark, toggleTheme } = useTheme();
  const { userDoc } = useAuth();

  return (
    <header className="glass-header sticky top-0 z-30 flex items-center justify-between h-20 px-6 lg:px-8">
      <div className="flex items-center gap-4">
        {/* Mobile menu trigger with accessible 44x44 target */}
        <button
          onClick={onMenuClick}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl lg:hidden hover:bg-gray-100/80 dark:hover:bg-gray-800/80 text-gray-600 dark:text-gray-300 btn-tactile focus-ring"
          aria-label="Open navigation menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        {/* Title */}
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white capitalize tracking-tight truncate">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Theme Toggle Button with Tactile Feedback */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl border border-gray-200/80 dark:border-gray-800/80 bg-white/50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 btn-tactile focus-ring shadow-sm"
          aria-label="Toggle dark/light theme"
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
          ) : (
            <Moon className="w-5 h-5 text-indigo-600 transition-transform duration-300 -rotate-12 hover:rotate-0" />
          )}
        </button>

        {/* User Info with Active Indicator */}
        <div className="hidden sm:flex flex-col text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Account Active" />
            <span className="text-sm font-bold text-gray-900 dark:text-white leading-none">
              {userDoc?.name || 'User'}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize font-medium tracking-wide">
            {userDoc?.role || 'Member'} Account
          </span>
        </div>
      </div>
    </header>
  );
}
