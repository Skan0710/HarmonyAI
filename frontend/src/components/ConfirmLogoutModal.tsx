import React from 'react';
import { LogOut } from 'lucide-react';

interface ConfirmLogoutModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmLogoutModal: React.FC<ConfirmLogoutModalProps> = ({
  isOpen,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-surface-1 border border-border-default rounded-[var(--radius-lg)] p-6 shadow-2xl space-y-5 relative animate-in zoom-in-95 duration-200 text-center">
        {/* Logout Icon */}
        <div className="w-14 h-14 rounded-full bg-danger/10 border border-danger/30 text-danger flex items-center justify-center mx-auto shadow-inner">
          <LogOut size={26} strokeWidth={2.2} className="translate-x-0.5" />
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-text-primary">Log Out of HarmonyAI?</h3>
          <p className="text-xs text-text-tertiary leading-relaxed">
            Are you sure you want to log out? You will need to sign back in to access your personal playlists and AI recommendations.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-1/2 py-2.5 bg-surface-2 hover:bg-surface-3 text-text-secondary text-xs font-semibold rounded-[var(--radius-pill)] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="w-1/2 py-2.5 bg-danger hover:bg-danger/90 text-white text-xs font-bold rounded-[var(--radius-pill)] transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut size={13} strokeWidth={2.5} />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
