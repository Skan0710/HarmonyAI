import React from 'react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  message,
  loading = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-surface-1 border border-border-default rounded-[var(--radius-lg)] p-6 shadow-2xl space-y-5 relative animate-in zoom-in-95 duration-200 text-center">
        {/* Warning Icon */}
        <div className="w-14 h-14 rounded-full bg-danger-wash border border-danger/30 text-danger flex items-center justify-center mx-auto shadow-inner">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <h3 className="text-lg font-extrabold text-text-primary">{title}</h3>
          <p className="text-xs text-text-tertiary leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-1/2 py-2.5 bg-surface-2 hover:bg-surface-3 text-text-secondary text-xs font-semibold rounded-[var(--radius-pill)] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="w-1/2 py-2.5 bg-danger hover:bg-danger/85 disabled:opacity-50 text-text-on-accent text-xs font-bold rounded-[var(--radius-pill)] transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading && <div className="w-3.5 h-3.5 border-2 border-text-on-accent border-t-transparent rounded-full animate-spin" />}
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
