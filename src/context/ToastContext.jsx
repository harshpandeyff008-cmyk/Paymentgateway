import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const getToastStyles = (type) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-900',
          text: 'text-emerald-800 dark:text-emerald-200',
          icon: <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
        };
      case 'error':
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-900',
          text: 'text-rose-800 dark:text-rose-200',
          icon: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-900',
          text: 'text-amber-800 dark:text-amber-200',
          icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-900',
          text: 'text-blue-800 dark:text-blue-200',
          icon: <Info className="w-5 h-5 text-blue-500 shrink-0" />
        };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast portal container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-full sm:w-96 pointer-events-none">
        {toasts.map(toast => {
          const styles = getToastStyles(toast.type);
          return (
            <div
              key={toast.id}
              className={`flex items-start justify-between p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-slide-in pointer-events-auto ${styles.bg}`}
            >
              <div className="flex gap-3">
                {styles.icon}
                <p className={`text-sm font-medium ${styles.text}`}>{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors duration-150 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
