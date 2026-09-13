import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import type { DiscoveryModeConfig } from '../services/musicIntelligenceService';

interface DiscoveryDialProps {
  modes: Record<string, DiscoveryModeConfig>;
  selected: string;
  onSelect: (mode: string) => void;
}

export const DiscoveryDial: React.FC<DiscoveryDialProps> = ({ modes, selected, onSelect }) => {
  const ordered = useMemo(
    () => Object.values(modes).sort((a, b) => a.explorationRate - b.explorationRate),
    [modes]
  );

  if (ordered.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex justify-between text-2xs text-text-tertiary uppercase tracking-[0.1em] mb-3 px-1">
        <span>Familiar</span>
        <span>Experimental</span>
      </div>

      <div className="relative">
        <div className="absolute left-6 right-6 top-3 -translate-y-1/2 h-px bg-border-default pointer-events-none" />

        <div className="relative flex items-start">
          {ordered.map((mode) => {
            const isSelected = mode.mode === selected;
            return (
              <button
                key={mode.mode}
                onClick={() => onSelect(mode.mode)}
                aria-pressed={isSelected}
                className="relative flex-1 min-w-0 flex flex-col items-center gap-2 cursor-pointer group px-0.5"
              >
                <div className="relative flex items-center justify-center w-6 h-6 shrink-0">
                  {isSelected && (
                    <motion.span
                      layoutId="dial-indicator"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      className="absolute w-4 h-4 rounded-full bg-accent shadow-sm"
                    />
                  )}
                  <span
                    className={`relative w-2 h-2 rounded-full transition-colors z-10 ${
                      isSelected ? 'bg-transparent' : 'bg-border-strong group-hover:bg-text-secondary'
                    }`}
                  />
                </div>
                <span
                  className={`w-full text-center truncate text-2xs sm:text-xs font-medium transition-colors ${
                    isSelected ? 'text-text-primary font-semibold' : 'text-text-tertiary group-hover:text-text-secondary'
                  }`}
                >
                  {mode.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
