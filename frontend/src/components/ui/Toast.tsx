import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore } from '../../store/useToastStore';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      className="fixed bottom-24 sm:bottom-28 right-4 sm:right-8 flex flex-col items-end gap-2.5 pointer-events-none z-[var(--z-toast,80)]"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.92 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-surface-2/95 backdrop-blur-md border border-border-strong text-text-primary shadow-2xl text-xs sm:text-sm font-medium max-w-xs sm:max-w-md"
          >
            {item.icon ? (
              <span className="shrink-0 flex items-center justify-center">{item.icon}</span>
            ) : item.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : item.type === 'error' ? (
              <AlertCircle size={16} className="text-red-400 shrink-0" />
            ) : (
              <Info size={16} className="text-accent shrink-0" />
            )}

            <span className="flex-1 leading-snug">{item.message}</span>

            <button
              onClick={() => removeToast(item.id)}
              className="p-1 -mr-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
