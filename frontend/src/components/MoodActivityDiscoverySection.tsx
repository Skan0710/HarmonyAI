import React, { useEffect, useState, useCallback } from 'react';
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

const MOOD_OPTIONS = [
  { id: 'Happy', label: 'Happy', emoji: '😊' },
  { id: 'Calm', label: 'Calm', emoji: '🍃' },
  { id: 'Energetic', label: 'Energetic', emoji: '⚡' },
  { id: 'Focused', label: 'Focused', emoji: '🎯' },
  { id: 'Relaxed', label: 'Relaxed', emoji: '🧘' },
  { id: 'Romantic', label: 'Romantic', emoji: '💖' },
];

interface MoodActivityDiscoverySectionProps {
  onPlaySong: (song: Song, queueList: Song[]) => void;
}

export const MoodActivityDiscoverySection: React.FC<MoodActivityDiscoverySectionProps> = ({
  onPlaySong,
}) => {
  const [selectedContext, setSelectedContext] = useState<ListeningContextId>('workout');
  const [selectedMood, setSelectedMood] = useState<string>('Energetic');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [detectedContext, setDetectedContext] = useState<any>(null);

  const loadContextualRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);

    // 1. Attempt Context-Aware Recommendations API
    const { data: resultItems, contextInfo, error: apiError } =
      await fetchContextAwareRecommendationsApi({
        context: selectedContext,
        mood: selectedMood,
        limit: 12,
      });

    if (!apiError && resultItems && resultItems.length > 0) {
      setSongs(resultItems.map((item) => item.song));
      setDetectedContext(contextInfo);
      setLoading(false);
      return;
    }

    // 2. Fallback to existing Contextual Recommendations Endpoint if needed
    const fallbackRes = await fetchContextualRecommendationsApi({
      mood: selectedMood,
      activity: selectedContext,
      limit: 12,
    });

    setLoading(false);

    if (fallbackRes.error && (!resultItems || resultItems.length === 0)) {
      setError(fallbackRes.error || apiError || 'Failed to load context recommendations');
    } else {
      setSongs(fallbackRes.songs);
      setDetectedContext(fallbackRes.detectedContext || contextInfo);
    }
  }, [selectedContext, selectedMood]);

  useEffect(() => {
    loadContextualRecommendations();
  }, [loadContextualRecommendations]);

  const handleMoodSelect = (moodId: string) => {
    setSelectedMood(moodId);
  };

  const handleContextSelect = (contextId: ListeningContextId) => {
    setSelectedContext(contextId);
  };

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-md">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider border border-indigo-500/30 mb-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            Context Discovery Engine
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Mood & Listening Context Finder
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Select your primary listening situation and mood. Our real-time context engine blends your taste profile with acoustic targets.
          </p>
        </div>

        {/* Backend Detected Context Badge */}
        {detectedContext && (
          <div className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-xs font-mono text-slate-300">
            <span className="text-indigo-400 font-semibold">Active Context:</span>
            <span className="text-purple-300 capitalize">{detectedContext.situation || selectedContext}</span>
            {selectedMood && <span>• {selectedMood}</span>}
          </div>
        )}
      </div>

      {/* Selector Controls */}
      <div className="space-y-5 pt-2">
        {/* Reusable Listening Context Selector */}
        <ListeningContextSelector
          selectedContext={selectedContext}
          onSelectContext={handleContextSelect}
          variant="pills"
          title="Listening Situation:"
          description="Choose 1 primary context"
        />

        {/* Mood Chips */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Choose Mood:
          </label>
          <div className="flex flex-wrap gap-2">
            {MOOD_OPTIONS.map((m) => {
              const isSelected = selectedMood === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => handleMoodSelect(m.id)}
                  type="button"
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/40 ring-2 ring-indigo-400/50 scale-[1.02]'
                      : 'bg-slate-900/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
                  }`}
                >
                  <span>{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && !loading && (
        <div className="bg-rose-950/60 border border-rose-500/40 text-rose-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-rose-300">{error}</p>
          </div>
          <button
            onClick={() => loadContextualRecommendations()}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-all shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && songs.length === 0 && (
        <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-8 text-center space-y-3">
          <p className="text-slate-300 font-semibold text-sm">
            No tracks found for <span className="text-indigo-400 capitalize">{selectedContext}</span> ({selectedMood})
          </p>
          <p className="text-slate-500 text-xs max-w-sm mx-auto">
            Try choosing a different context or mood to explore more personalized tracks.
          </p>
        </div>
      )}

      {/* Carousel Results Display */}
      {(songs.length > 0 || loading) && (
        <div className="-mx-2 sm:-mx-4">
          <MediaCarousel
            title={`${selectedContext.charAt(0).toUpperCase() + selectedContext.slice(1).replace('_', ' ')} • ${selectedMood} Mix`}
            subtitle={`AI contextual tracks tuned for ${selectedContext.replace('_', ' ')} sessions with ${selectedMood.toLowerCase()} vibes`}
            type="song"
            items={songs}
            loading={loading}
            onPlaySong={(song) => onPlaySong(song, songs)}
          />
        </div>
      )}
    </div>
  );
};
