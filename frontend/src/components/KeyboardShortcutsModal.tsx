import React, { useEffect } from 'react';
import { Keyboard, X, Sparkles } from 'lucide-react';
import { useKeyboardShortcutsModalStore } from '../store/useKeyboardShortcutsModalStore';

interface ShortcutRowProps {
  label: string;
  keys: string[];
}

const ShortcutRow: React.FC<ShortcutRowProps> = ({ label, keys }) => {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border-subtle/50 last:border-0">
      <span className="text-xs text-text-secondary font-medium">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {keys.map((k, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <span className="text-[10px] text-text-tertiary">or</span>}
            <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-[11px] font-mono font-semibold bg-surface-2 border border-border-subtle rounded text-text-primary shadow-xs">
              {k}
            </kbd>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export const KeyboardShortcutsModal: React.FC = () => {
  const { isOpen, close } = useKeyboardShortcutsModalStore();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-xl bg-surface-1 border border-border-default rounded-[var(--radius-lg)] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-1/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-wash text-accent flex items-center justify-center border border-accent-wash-strong">
              <Keyboard size={18} strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-text-primary">Keyboard Shortcuts</h3>
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gold bg-gold-wash border border-gold-wash px-2 py-0.5 rounded-full">
                  <Sparkles size={10} /> YouTube Music Style
                </span>
              </div>
              <p className="text-[11px] text-text-tertiary">Quick control over playback, seeking, and navigation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="p-1.5 rounded-full text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label="Close shortcuts dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {/* Playback Section */}
          <div>
            <h4 className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Playback</h4>
            <div className="bg-surface-0/60 border border-border-subtle rounded-lg px-3.5 py-1">
              <ShortcutRow label="Next Track (Skip)" keys={['J', 'Shift + N']} />
              <ShortcutRow label="Previous Track" keys={['K', 'Shift + P']} />
              <ShortcutRow label="Play / Pause" keys={['Space', ';']} />
              <ShortcutRow label="Seek Forward 10s" keys={['L', '→']} />
              <ShortcutRow label="Seek Backward 10s" keys={['H', '←']} />
            </div>
          </div>

          {/* Controls & Audio */}
          <div>
            <h4 className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Controls & Audio</h4>
            <div className="bg-surface-0/60 border border-border-subtle rounded-lg px-3.5 py-1">
              <ShortcutRow label="Toggle Shuffle" keys={['S']} />
              <ShortcutRow label="Toggle Repeat Mode" keys={['R']} />
              <ShortcutRow label="Volume Up (+5%)" keys={['=', '↑']} />
              <ShortcutRow label="Volume Down (-5%)" keys={['-', '↓']} />
              <ShortcutRow label="Mute / Unmute" keys={['M']} />
              <ShortcutRow label="Like Current Song" keys={['Shift + =', '+']} />
            </div>
          </div>

          {/* Interface & Navigation */}
          <div>
            <h4 className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Interface & Navigation</h4>
            <div className="bg-surface-0/60 border border-border-subtle rounded-lg px-3.5 py-1">
              <ShortcutRow label="Toggle Playback Queue" keys={['Q']} />
              <ShortcutRow label="Toggle Fullscreen Player" keys={['F']} />
              <ShortcutRow label="Command Palette / Search" keys={['Ctrl + K', '⌘K']} />
              <ShortcutRow label="Show Shortcuts Dialog" keys={['Shift + /', '?']} />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border-subtle bg-surface-0/40 text-[11px] text-text-tertiary">
          <span>Press <kbd className="px-1 py-0.5 bg-surface-2 rounded font-mono text-text-secondary border border-border-subtle">?</kbd> at any time to open this help</span>
          <button
            type="button"
            onClick={close}
            className="px-4 py-1.5 bg-surface-2 hover:bg-surface-3 text-text-primary text-xs font-medium rounded-full transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
