"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ToastType = "error" | "success" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  error: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const TOAST_GRADIENTS: Record<ToastType, string> = {
  error: "from-red-500/20 via-red-600/10 to-transparent",
  success: "from-emerald-500/20 via-emerald-600/10 to-transparent",
  warning: "from-amber-500/20 via-amber-600/10 to-transparent",
  info: "from-cyan-500/20 via-cyan-600/10 to-transparent",
};

const TOAST_BORDER_COLORS: Record<ToastType, string> = {
  error: "border-l-red-500",
  success: "border-l-emerald-500",
  warning: "border-l-amber-500",
  info: "border-l-cyan-500",
};

const TOAST_GLOW: Record<ToastType, string> = {
  error: "shadow-red-500/20",
  success: "shadow-emerald-500/20",
  warning: "shadow-amber-500/20",
  info: "shadow-cyan-500/20",
};

const TOAST_ICON_COLORS: Record<ToastType, string> = {
  error: "text-red-400",
  success: "text-emerald-400",
  warning: "text-amber-400",
  info: "text-cyan-400",
};

function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  const handleDismiss = () => {
    onDismiss(toast.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.8 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className={`
        relative overflow-hidden
        bg-slate-900/90 backdrop-blur-xl
        border border-white/10 border-l-4 ${TOAST_BORDER_COLORS[toast.type]}
        rounded-xl shadow-2xl ${TOAST_GLOW[toast.type]}
        p-4 max-w-md
      `}
      role="alert"
    >
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-r ${TOAST_GRADIENTS[toast.type]} pointer-events-none`} />

      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "200%" }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
      />

      <div className="relative flex items-start gap-3">
        <motion.div
          className={`flex-shrink-0 ${TOAST_ICON_COLORS[toast.type]}`}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 10, delay: 0.1 }}
        >
          {TOAST_ICONS[toast.type]}
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-white">{toast.title}</p>
          <p className="text-sm mt-1 text-gray-300 break-words">{toast.message}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>
      </div>

      {/* Progress bar for duration */}
      {toast.duration && toast.duration > 0 && (
        <motion.div
          className={`absolute bottom-0 left-0 h-0.5 ${TOAST_ICON_COLORS[toast.type].replace('text', 'bg')}`}
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: toast.duration / 1000, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: ToastType, title: string, message: string, duration = 5000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);
    return id;
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showError = (title: string, message: string, duration = 8000) => {
    return addToast("error", title, message, duration);
  };

  const showSuccess = (title: string, message: string, duration = 4000) => {
    return addToast("success", title, message, duration);
  };

  const showWarning = (title: string, message: string, duration = 6000) => {
    return addToast("warning", title, message, duration);
  };

  const showInfo = (title: string, message: string, duration = 5000) => {
    return addToast("info", title, message, duration);
  };

  return {
    toasts,
    addToast,
    dismissToast,
    showError,
    showSuccess,
    showWarning,
    showInfo,
  };
}

export default Toast;
