import React from 'react';
import type { ListeningContextId } from './ListeningContextSelector';

export interface ContextCustomizationValues {
  mood?: string;
  energy?: number; // 0.0 to 1.0
  tempo?: number; // 30 to 250 BPM
  genres?: string[];
  discoveryLevel?: number; // 0.0 to 1.0
}

export const CONTEXT_SENSIBLE_DEFAULTS: Record<
  ListeningContextId,
  {
    mood: string;
    energy: number;
    tempo: number;
    genres: string[];
    discoveryLevel: number;
  }
> = {
  study: {
    mood: 'Focus',
    energy: 0.30,
    tempo: 82,
    genres: ['Lo-Fi', 'Ambient', 'Classical'],
    discoveryLevel: 0.25,
  },
  work: {
    mood: 'Focus',
    energy: 0.55,
    tempo: 112,
    genres: ['Deep House', 'Synthwave', 'Lo-Fi Beats'],
    discoveryLevel: 0.35,
  },
  workout: {
    mood: 'Energetic',
    energy: 0.90,
    tempo: 140,
    genres: ['EDM', 'Hard Rock', 'Trap'],
    discoveryLevel: 0.45,
  },
  relaxation: {
    mood: 'Relaxed',
    energy: 0.25,
    tempo: 76,
    genres: ['Acoustic', 'Ambient', 'Indie Folk'],
    discoveryLevel: 0.30,
  },
  commute: {
    mood: 'Upbeat',
    energy: 0.70,
    tempo: 122,
    genres: ['Pop', 'Indie Rock', 'Synthpop'],
    discoveryLevel: 0.50,
  },
  party: {
    mood: 'Party',
    energy: 0.95,
    tempo: 128,
    genres: ['Dance Pop', 'House', 'Hip Hop'],
    discoveryLevel: 0.30,
  },
  sleep: {
    mood: 'Calm',
    energy: 0.10,
    tempo: 58,
    genres: ['Sleep Ambient', 'Soft Piano', 'Drone'],
    discoveryLevel: 0.15,
  },
  focus: {
    mood: 'Focus',
    energy: 0.50,
    tempo: 108,
    genres: ['Minimal Techno', 'Post-Rock', 'Lo-Fi'],
    discoveryLevel: 0.30,
  },
  general_listening: {
    mood: 'Upbeat',
    energy: 0.55,
    tempo: 110,
    genres: [],
    discoveryLevel: 0.50,
  },
};

export const COMMON_GENRE_OPTIONS = [
  'Lo-Fi',
  'Ambient',
  'EDM',
  'Pop',
  'Rock',
  'Hip Hop',
  'House',
  'Acoustic',
  'Classical',
  'Synthwave',
  'Indie Rock',
  'R&B',
];

interface ContextCustomizationPanelProps {
  selectedContext: ListeningContextId;
  values: ContextCustomizationValues;
  onChange: (updated: ContextCustomizationValues) => void;
  onReset: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const ContextCustomizationPanel: React.FC<ContextCustomizationPanelProps> = ({
  selectedContext,
  values,
  onChange,
  onReset,
  isOpen,
  onToggleOpen,
}) => {
  const contextDefaults = CONTEXT_SENSIBLE_DEFAULTS[selectedContext] || CONTEXT_SENSIBLE_DEFAULTS.general_listening;

  const currentEnergy = values.energy !== undefined ? values.energy : contextDefaults.energy;
  const currentTempo = values.tempo !== undefined ? values.tempo : contextDefaults.tempo;
  const currentDiscovery = values.discoveryLevel !== undefined ? values.discoveryLevel : contextDefaults.discoveryLevel;
  const currentGenres = values.genres || [];

  const handleEnergyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onChange({ ...values, energy: val });
  };

  const handleTempoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onChange({ ...values, tempo: val });
  };

  const handleDiscoveryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onChange({ ...values, discoveryLevel: val });
  };

  const handleGenreToggle = (genre: string) => {
    let nextGenres: string[];
    if (currentGenres.includes(genre)) {
      nextGenres = currentGenres.filter((g) => g !== genre);
    } else {
      nextGenres = [...currentGenres, genre];
    }
    onChange({ ...values, genres: nextGenres });
  };

  const hasOverrides =
    (values.energy !== undefined && values.energy !== contextDefaults.energy) ||
    (values.tempo !== undefined && values.tempo !== contextDefaults.tempo) ||
    (values.discoveryLevel !== undefined && values.discoveryLevel !== contextDefaults.discoveryLevel) ||
    (values.genres && values.genres.length > 0);

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 overflow-hidden transition-all duration-200">
      {/* Header Toggle Bar */}
      <div className="flex items-center justify-between p-3.5 sm:p-4 bg-slate-900/80">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer select-none"
        >
          <span className="text-base">{isOpen ? '▼' : '▶'}</span>
          <span className="uppercase tracking-wider">Fine-Tune Acoustic Parameters</span>
          {hasOverrides && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              Customized
            </span>
          )}
        </button>

        {hasOverrides && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] font-medium text-slate-400 hover:text-rose-300 underline cursor-pointer transition-colors"
          >
            Reset to Context Defaults
          </button>
        )}
      </div>

      {/* Expandable Controls Body */}
      {isOpen && (
        <div className="p-4 sm:p-5 space-y-5 border-t border-slate-800 bg-slate-950/40 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Energy Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  ⚡ Desired Energy:
                </label>
                <span className="text-xs font-mono font-bold text-rose-400">
                  {Math.round(currentEnergy * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={currentEnergy}
                onChange={handleEnergyChange}
                className="w-full accent-rose-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Calm (0%)</span>
                <span>Moderate (50%)</span>
                <span>Intense (100%)</span>
              </div>
            </div>

            {/* 2. Tempo Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  🥁 Target Pace (BPM):
                </label>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {currentTempo} BPM
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="180"
                step="2"
                value={currentTempo}
                onChange={handleTempoChange}
                className="w-full accent-cyan-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Slow (60)</span>
                <span>Medium (115)</span>
                <span>Fast (170)</span>
              </div>
            </div>

            {/* 3. Discovery / Novelty Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  🧭 Discovery Level:
                </label>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {Math.round(currentDiscovery * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={currentDiscovery}
                onChange={handleDiscoveryChange}
                className="w-full accent-amber-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Familiar Favorites</span>
                <span>Balanced</span>
                <span>Fresh Discovery</span>
              </div>
            </div>
          </div>

          {/* 4. Preferred Genre Filter Chips */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                🎸 Genre Preferences (Optional Filter):
              </label>
              {currentGenres.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange({ ...values, genres: [] })}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300"
                >
                  Clear genres
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_GENRE_OPTIONS.map((genre) => {
                const isSelected = currentGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => handleGenreToggle(genre)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-600/30 text-indigo-200 font-semibold shadow-sm ring-1 ring-indigo-400/30'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContextCustomizationPanel;
