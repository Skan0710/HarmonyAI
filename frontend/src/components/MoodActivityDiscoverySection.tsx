import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Smile, Leaf, Zap, Target, Feather, Heart, AlertCircle, Headphones } from 'lucide-react';
import type { Song } from '../types/music';
import {
  fetchContextAwareRecommendationsApi,
  fetchContextualRecommendationsApi,
} from '../services/recommendationService';
import { MediaCarousel } from './MediaCarousel';
import {
  ListeningContextSelector,
  type ListeningContextId,
} from './ListeningContextSelector';
import {
  ContextCustomizationPanel,
  type ContextCustomizationValues,
  CONTEXT_SENSIBLE_DEFAULTS,
} from './ContextCustomizationPanel';

const MOOD_OPTIONS = [
  { id: 'Happy', label: 'Happy', icon: Smile },
  { id: 'Calm', label: 'Calm', icon: Leaf },
  { id: 'Energetic', label: 'Energetic', icon: Zap },
  { id: 'Focused', label: 'Focused', icon: Target },
  { id: 'Relaxed', label: 'Relaxed', icon: Feather },
  { id: 'Romantic', label: 'Romantic', icon: Heart },
];

interface MoodActivityDiscoverySectionProps {
  onPlaySong: (song: Song, queueList: Song[]) => void;
}

export const MoodActivityDiscoverySection: React.FC<MoodActivityDiscoverySectionProps> = ({
  onPlaySong,
}) => {
  const [selectedContext, setSelectedContext] = useState<ListeningContextId>('workout');
  const [selectedMood, setSelectedMood] = useState<string>('Energetic');
  const [customValues, setCustomValues] = useState<ContextCustomizationValues>({});
  const [isCustomPanelOpen, setIsCustomPanelOpen] = useState<boolean>(false);

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [detectedContext, setDetectedContext] = useState<any>(null);

  // Debounce ref to prevent excessive requests while sliding controls
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedSignatureRef = useRef<string>('');

  const loadContextualRecommendations = useCallback(async (
    ctx: ListeningContextId,
    mood: string,
    custom: ContextCustomizationValues
  ) => {
    // Generate signature of current request parameters
    const signature = JSON.stringify({
      ctx,
      mood,
      energy: custom.energy,
      tempo: custom.tempo,
      genres: custom.genres?.slice().sort(),
      discovery: custom.discoveryLevel,
    });

    if (signature === lastFetchedSignatureRef.current && songs.length > 0) {
      return; // Avoid unnecessary identical request
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Attempt Context-Aware Recommendations API
      const { data: resultItems, contextInfo, error: apiError } =
        await fetchContextAwareRecommendationsApi({
          context: ctx,
          mood: mood,
          energy: custom.energy,
          tempo: custom.tempo,
          genres: custom.genres,
          discoveryLevel: custom.discoveryLevel,
          limit: 12,
        });

      if (!apiError && resultItems && resultItems.length > 0) {
        lastFetchedSignatureRef.current = signature;
        setSongs(resultItems.map((item) => item.song));
        setDetectedContext(contextInfo);
        setLoading(false);
        return;
      }

      // 2. Fallback to existing Contextual Recommendations Endpoint if needed
      const fallbackRes = await fetchContextualRecommendationsApi({
        mood: mood,
        activity: ctx,
        energy: custom.energy,
        limit: 12,
      });

      setLoading(false);

      if (fallbackRes.error && (!resultItems || resultItems.length === 0)) {
        setError(fallbackRes.error || apiError || 'Failed to load context recommendations');
      } else {
        lastFetchedSignatureRef.current = signature;
        setSongs(fallbackRes.songs);
        setDetectedContext(fallbackRes.detectedContext || contextInfo);
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Network error fetching context recommendations');
    }
  }, [songs.length]);

  // Debounced trigger effect
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      loadContextualRecommendations(selectedContext, selectedMood, customValues);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [selectedContext, selectedMood, customValues, loadContextualRecommendations]);

  const handleMoodSelect = (moodId: string) => {
    setSelectedMood(moodId);
  };

  const handleContextSelect = (contextId: ListeningContextId) => {
    setSelectedContext(contextId);
    // Align sensible default mood if custom mood was not explicitly locked
    const defaults = CONTEXT_SENSIBLE_DEFAULTS[contextId];
    if (defaults && defaults.mood && !customValues.mood) {
      setSelectedMood(defaults.mood);
    }
  };

  const handleCustomValuesChange = (updated: ContextCustomizationValues) => {
    setCustomValues(updated);
  };

  const handleResetCustomDefaults = () => {
    setCustomValues({});
    const defaults = CONTEXT_SENSIBLE_DEFAULTS[selectedContext];
    if (defaults) {
      setSelectedMood(defaults.mood);
    }
  };

  return (
    <div className="bg-surface-1 rounded-[var(--radius-lg)] p-6 sm:p-8 space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-accent flex items-center gap-1.5 mb-2">
            <Headphones size={12} strokeWidth={1.75} />
            For your current mood
          </p>
          <h2 className="font-display text-xl sm:text-2xl text-text-primary tracking-tight">
            What's the moment calling for?
          </h2>
          <p className="text-text-tertiary text-xs sm:text-sm mt-1.5 max-w-xl">
            Pick a situation and a mood — the mix adapts your taste profile to what's happening right now.
          </p>
        </div>

        {detectedContext && (
          <div className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-[var(--radius-sm)] bg-surface-2 text-2xs font-mono text-text-secondary">
            <span className="text-accent font-semibold">Active:</span>
            <span className="capitalize">{detectedContext.situation || selectedContext}</span>
            {selectedMood && <span>· {selectedMood}</span>}
          </div>
        )}
      </div>

      {/* Selector Controls */}
      <div className="space-y-5 pt-2">
        <ListeningContextSelector
          selectedContext={selectedContext}
          onSelectContext={handleContextSelect}
          variant="pills"
          title="Listening situation"
        />

        <div className="space-y-2">
          <label className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary">Mood</label>
          <div className="flex flex-wrap gap-1.5">
            {MOOD_OPTIONS.map((m) => {
              const isSelected = selectedMood === m.id;
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => handleMoodSelect(m.id)}
                  type="button"
                  className={`px-3 py-1.5 rounded-[var(--radius-pill)] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isSelected ? 'bg-gold text-text-on-accent font-semibold' : 'bg-surface-2 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Icon size={13} strokeWidth={1.75} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <ContextCustomizationPanel
          selectedContext={selectedContext}
          values={customValues}
          onChange={handleCustomValuesChange}
          onReset={handleResetCustomDefaults}
          isOpen={isCustomPanelOpen}
          onToggleOpen={() => setIsCustomPanelOpen(!isCustomPanelOpen)}
        />
      </div>

      {/* Error State */}
      {error && !loading && (
        <div className="bg-danger-wash text-danger rounded-[var(--radius-md)] p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="shrink-0" strokeWidth={1.75} />
            <p className="text-xs">{error}</p>
          </div>
          <button
            onClick={() => loadContextualRecommendations(selectedContext, selectedMood, customValues)}
            className="text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-pill)] bg-danger text-text-on-accent transition-opacity hover:opacity-90 shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && songs.length === 0 && (
        <div className="bg-surface-2 rounded-[var(--radius-md)] p-8 text-center space-y-2">
          <p className="text-text-secondary font-medium text-sm">
            No tracks found for <span className="text-accent capitalize">{selectedContext}</span> ({selectedMood})
          </p>
          <p className="text-text-tertiary text-xs max-w-sm mx-auto">
            Try adjusting the sliders above or clearing genre filters to widen the search.
          </p>
        </div>
      )}

      {/* Carousel Results Display */}
      {(songs.length > 0 || loading) && (
        <MediaCarousel
          title={`${selectedContext.charAt(0).toUpperCase() + selectedContext.slice(1).replace('_', ' ')} · ${selectedMood}`}
          subtitle={`Tuned for ${selectedContext.replace('_', ' ')} sessions with a ${selectedMood.toLowerCase()} feel`}
          type="song"
          items={songs}
          loading={loading}
          onPlaySong={(song) => onPlaySong(song, songs)}
        />
      )}
    </div>
  );
};

export default MoodActivityDiscoverySection;
