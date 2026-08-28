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
    colorGradient: 'from-blue-500/20 to-indigo-500/20',
    activeBorder: 'border-indigo-500 bg-indigo-500/20 text-indigo-200 shadow-indigo-500/20',
    badgeText: 'Personalized',
  },
  {
    id: 'study',
    label: 'Study',
    emoji: '📚',
    subtitle: 'Lo-Fi & ambient textures',
    colorGradient: 'from-amber-500/20 to-orange-500/20',
    activeBorder: 'border-amber-500 bg-amber-500/20 text-amber-200 shadow-amber-500/20',
    badgeText: 'Low Distraction',
  },
  {
    id: 'work',
    label: 'Work',
    emoji: '💻',
    subtitle: 'Deep house & rhythmic beats',
    colorGradient: 'from-cyan-500/20 to-blue-500/20',
    activeBorder: 'border-cyan-500 bg-cyan-500/20 text-cyan-200 shadow-cyan-500/20',
    badgeText: 'Productivity',
  },
  {
    id: 'workout',
    label: 'Workout',
    emoji: '⚡',
    subtitle: 'High energy & driving tempo',
    colorGradient: 'from-rose-500/20 to-red-500/20',
    activeBorder: 'border-rose-500 bg-rose-500/20 text-rose-200 shadow-rose-500/20',
    badgeText: '130-160 BPM',
  },
  {
    id: 'relaxation',
    label: 'Relaxation',
    emoji: '🍃',
    subtitle: 'Acoustic, folk & soothing tones',
    colorGradient: 'from-emerald-500/20 to-teal-500/20',
    activeBorder: 'border-emerald-500 bg-emerald-500/20 text-emerald-200 shadow-emerald-500/20',
    badgeText: 'Chill & Unwind',
  },
  {
    id: 'commute',
    label: 'Commute',
    emoji: '🚗',
    subtitle: 'Upbeat pop & sing-along hits',
    colorGradient: 'from-violet-500/20 to-purple-500/20',
    activeBorder: 'border-violet-500 bg-violet-500/20 text-violet-200 shadow-violet-500/20',
    badgeText: 'On the Move',
  },
  {
    id: 'party',
    label: 'Party',
    emoji: '🎉',
    subtitle: 'Dance floor bangers & anthems',
    colorGradient: 'from-fuchsia-500/20 to-pink-500/20',
    activeBorder: 'border-fuchsia-500 bg-fuchsia-500/20 text-fuchsia-200 shadow-fuchsia-500/20',
    badgeText: 'Max Energy',
  },
  {
    id: 'sleep',
    label: 'Sleep',
    emoji: '🌙',
    subtitle: 'Calm soundscapes & soft piano',
    colorGradient: 'from-slate-500/20 to-indigo-950/40',
    activeBorder: 'border-indigo-400 bg-indigo-950/40 text-indigo-200 shadow-indigo-500/20',
    badgeText: 'Restful',
  },
  {
    id: 'focus',
    label: 'Focus',
    emoji: '🎯',
    subtitle: 'Minimal techno & flow states',
    colorGradient: 'from-teal-500/20 to-emerald-500/20',
    activeBorder: 'border-teal-500 bg-teal-500/20 text-teal-200 shadow-teal-500/20',
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
            <h3 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="text-xl">🎧</span>
              {title}
            </h3>
            {description && <p className="text-xs text-slate-400">{description}</p>}
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
                className={`relative flex flex-col items-start p-3.5 rounded-2xl text-left border transition-all duration-200 cursor-pointer select-none group ${
                  isSelected
                    ? `border-2 ${item.activeBorder} shadow-lg ring-1 ring-white/10 scale-[1.02]`
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="text-2xl transition-transform duration-200 group-hover:scale-110">
                    {item.emoji}
                  </span>
                  {isSelected ? (
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 group-hover:text-slate-400 transition-colors">
                      {item.badgeText}
                    </span>
                  )}
                </div>

                <div className="font-semibold text-sm text-white tracking-wide">{item.label}</div>
                {showSubtitles && (
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-1 leading-tight">
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-600/30 text-indigo-200 font-semibold shadow-sm'
                  : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
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
          <div className="flex items-center gap-2">
            <span className="text-lg">🎧</span>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">{title}</h3>
          </div>
          {description && <span className="text-xs text-slate-400 hidden sm:inline">{description}</span>}
        </div>
      )}

      <div
        role="radiogroup"
        aria-label="Listening context selector"
        className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700/50 -mx-1 px-1"
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
              className={`flex-shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all duration-200 cursor-pointer select-none group ${
                isSelected
                  ? `${item.activeBorder} border shadow-md font-semibold ring-1 ring-white/10 scale-[1.02]`
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-800/60'
              }`}
            >
              <span className="text-base group-hover:scale-110 transition-transform">{item.emoji}</span>
              <span className="whitespace-nowrap">{item.label}</span>
              {isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 animate-pulse ml-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ListeningContextSelector;
