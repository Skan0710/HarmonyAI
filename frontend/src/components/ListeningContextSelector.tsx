import React from 'react';

export type ListeningContextId =
  | 'study'
  | 'work'
  | 'workout'
  | 'relaxation'
  | 'commute'
  | 'party'
  | 'sleep'
  | 'focus'
  | 'general_listening';

export interface ListeningContextOption {
  id: ListeningContextId;
  label: string;
  emoji: string;
  subtitle: string;
  colorGradient: string;
  activeBorder: string;
  badgeText: string;
}

export const LISTENING_CONTEXTS: ListeningContextOption[] = [
  {
    id: 'general_listening',
    label: 'General Listening',
    emoji: '🎵',
    subtitle: 'Daily personal taste profile',
    colorGradient: 'from-accent/20 to-gold/20',
    activeBorder: 'border-accent bg-accent-wash text-accent shadow-accent/20',
    badgeText: 'Personalized',
  },
  {
    id: 'study',
    label: 'Study',
    emoji: '📚',
    subtitle: 'Lo-Fi & ambient textures',
    colorGradient: 'from-gold/20 to-accent/20',
    activeBorder: 'border-gold bg-gold-wash text-gold shadow-gold/20',
    badgeText: 'Low Distraction',
  },
  {
    id: 'work',
    label: 'Work',
    emoji: '💻',
    subtitle: 'Deep house & rhythmic beats',
    colorGradient: 'from-accent/20 to-gold/20',
    activeBorder: 'border-accent bg-accent-wash text-accent shadow-accent/20',
    badgeText: 'Productivity',
  },
  {
    id: 'workout',
    label: 'Workout',
    emoji: '⚡',
    subtitle: 'High energy & driving tempo',
    colorGradient: 'from-danger/20 to-accent/20',
    activeBorder: 'border-danger bg-danger-wash text-danger shadow-danger/20',
    badgeText: '130-160 BPM',
  },
  {
    id: 'relaxation',
    label: 'Relaxation',
    emoji: '🍃',
    subtitle: 'Acoustic, folk & soothing tones',
    colorGradient: 'from-success/20 to-gold/20',
    activeBorder: 'border-success bg-success/10 text-success shadow-success/20',
    badgeText: 'Chill & Unwind',
  },
  {
    id: 'commute',
    label: 'Commute',
    emoji: '🚗',
    subtitle: 'Upbeat pop & sing-along hits',
    colorGradient: 'from-gold/20 to-accent/20',
    activeBorder: 'border-gold bg-gold-wash text-gold shadow-gold/20',
    badgeText: 'On the Move',
  },
  {
    id: 'party',
    label: 'Party',
    emoji: '🎉',
    subtitle: 'Dance floor bangers & anthems',
    colorGradient: 'from-accent/20 to-danger/20',
    activeBorder: 'border-accent bg-accent-wash text-accent shadow-accent/20',
    badgeText: 'Max Energy',
  },
  {
    id: 'sleep',
    label: 'Sleep',
    emoji: '🌙',
    subtitle: 'Calm soundscapes & soft piano',
    colorGradient: 'from-surface-3/40 to-accent/10',
    activeBorder: 'border-border-strong bg-surface-3 text-text-primary shadow-black/20',
    badgeText: 'Restful',
  },
  {
    id: 'focus',
    label: 'Focus',
    emoji: '🎯',
    subtitle: 'Minimal techno & flow states',
    colorGradient: 'from-success/20 to-gold/20',
    activeBorder: 'border-success bg-success/10 text-success shadow-success/20',
    badgeText: 'Deep Flow',
  },
];

export interface ListeningContextSelectorProps {
  selectedContext: ListeningContextId | string;
  onSelectContext: (contextId: ListeningContextId) => void;
  variant?: 'pills' | 'cards' | 'grid' | 'compact';
  showSubtitles?: boolean;
  className?: string;
  title?: string;
  description?: string;
}

export const ListeningContextSelector: React.FC<ListeningContextSelectorProps> = ({
  selectedContext,
  onSelectContext,
  variant = 'pills',
  showSubtitles = true,
  className = '',
  title,
  description,
}) => {
  // Normalize string comparisons (handles 'general listening' -> 'general_listening')
  const normalizeId = (id: string): string => {
    return id.toLowerCase().replace(/[\s-]+/g, '_');
  };

  const currentSelected = normalizeId(selectedContext || 'general_listening');

  if (variant === 'grid' || variant === 'cards') {
    return (
      <div className={`space-y-4 ${className}`}>
        {title && (
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-text-primary tracking-tight flex items-center gap-2">
              <span className="text-xl">🎧</span>
              {title}
            </h3>
            {description && <p className="text-xs text-text-tertiary">{description}</p>}
          </div>
        )}

        <div
          role="radiogroup"
          aria-label="Listening context selector"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-3"
        >
          {LISTENING_CONTEXTS.map((item) => {
            const isSelected = currentSelected === item.id;
            return (
              <button
                key={item.id}
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectContext(item.id)}
                type="button"
                className={`relative flex flex-col items-start p-3.5 rounded-[var(--radius-lg)] text-left border transition-all duration-200 cursor-pointer select-none group ${
                  isSelected
                    ? `border-2 ${item.activeBorder} shadow-lg ring-1 ring-border-strong scale-[1.02]`
                    : 'bg-surface-1 border-border-subtle hover:border-border-default hover:bg-surface-2 text-text-secondary'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="text-2xl transition-transform duration-200 group-hover:scale-110">
                    {item.emoji}
                  </span>
                  {isSelected ? (
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-text-tertiary group-hover:text-text-secondary transition-colors">
                      {item.badgeText}
                    </span>
                  )}
                </div>

                <div className="font-semibold text-sm text-text-primary tracking-wide">{item.label}</div>
                {showSubtitles && (
                  <div className="text-[11px] text-text-tertiary mt-1 line-clamp-1 leading-tight">
                    {item.subtitle}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex flex-wrap gap-1.5 ${className}`} role="radiogroup" aria-label="Listening context selector">
        {LISTENING_CONTEXTS.map((item) => {
          const isSelected = currentSelected === item.id;
          return (
            <button
              key={item.id}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectContext(item.id)}
              type="button"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-pill)] text-xs font-medium border transition-all duration-150 cursor-pointer ${
                isSelected
                  ? 'border-accent bg-accent-wash text-accent font-semibold shadow-sm'
                  : 'border-border-subtle bg-surface-1 text-text-tertiary hover:text-text-secondary hover:border-border-default'
              }`}
            >
              <span>{item.emoji}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Default: 'pills' - Horizontal scrollable pill row with badges
  return (
    <div className={`space-y-3 ${className}`}>
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary">{title}</h3>
          {description && <span className="text-xs text-text-tertiary hidden sm:inline">{description}</span>}
        </div>
      )}

      <div
        role="radiogroup"
        aria-label="Listening context selector"
        className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
      >
        {LISTENING_CONTEXTS.map((item) => {
          const isSelected = currentSelected === item.id;
          return (
            <button
              key={item.id}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectContext(item.id)}
              type="button"
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-pill)] text-xs font-medium transition-colors duration-[var(--duration-fast)] cursor-pointer select-none ${
                isSelected
                  ? 'bg-accent text-text-on-accent font-semibold'
                  : 'bg-surface-2 text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ListeningContextSelector;
