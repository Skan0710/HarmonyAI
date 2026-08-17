import React, { useEffect, useState, useCallback } from 'react';
import type { Song } from '../types/music';
import { fetchContextualRecommendationsApi } from '../services/recommendationService';
import { MediaCarousel } from './MediaCarousel';

const MOOD_OPTIONS = [
  { id: 'Happy', label: 'Happy', emoji: '😊' },
  { id: 'Calm', label: 'Calm', emoji: '🍃' },
  { id: 'Energetic', label: 'Energetic', emoji: '⚡' },
  { id: 'Focused', label: 'Focused', emoji: '🎯' },
  { id: 'Relaxed', label: 'Relaxed', emoji: '🧘' },
  { id: 'Romantic', label: 'Romantic', emoji: '💖' },
];

const ACTIVITY_OPTIONS = [
  { id: 'Study', label: 'Study', emoji: '📚' },
  { id: 'Workout', label: 'Workout', emoji: '🏋️' },
  { id: 'Travel', label: 'Travel', emoji: '🚗' },
  { id: 'Sleep', label: 'Sleep', emoji: '🌙' },
  { id: 'Coding', label: 'Coding', emoji: '💻' },
];

interface MoodActivityDiscoverySectionProps {
  onPlaySong: (song: Song, queueList: Song[]) => void;
}

export const MoodActivityDiscoverySection: React.FC<MoodActivityDiscoverySectionProps> = ({
  onPlaySong,
}) => {
  const [selectedMood, setSelectedMood] = useState<string>('Energetic');
  const [selectedActivity, setSelectedActivity] = useState<string | undefined>('Workout');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [detectedContext, setDetectedContext] = useState<any>(null);

  const loadContextualRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { songs: resultSongs, detectedContext: context, error: apiError } =
      await fetchContextualRecommendationsApi({
        mood: selectedMood,
        activity: selectedActivity,
        limit: 12,
      });

    setLoading(false);

    if (apiError) {
      setError(apiError);
    } else {
      setSongs(resultSongs);
      setDetectedContext(context);
    }
  }, [selectedMood, selectedActivity]);

  useEffect(() => {
    loadContextualRecommendations();
  }, [loadContextualRecommendations]);

  const handleMoodSelect = (moodId: string) => {
    setSelectedMood(moodId);
  };

  const handleActivitySelect = (actId: string) => {
    if (selectedActivity === actId) {
      setSelectedActivity(undefined); // Toggle off optional activity
    } else {
      setSelectedActivity(actId);
    }
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
            Mood & Activity Finder
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Pick your current vibe and activity. Our real-time context engine matches server time, acoustics, and mood score.
          </p>
        </div>

        {/* Backend Detected Context Badge */}
        {detectedContext && (
          <div className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-xs font-mono text-slate-300">
            <span className="text-indigo-400 font-semibold">Context Detected:</span>
            <span className="text-purple-300">{detectedContext.timeOfDay || 'Day'}</span>
            {selectedMood && <span>• {selectedMood}</span>}
            {selectedActivity && <span>• {selectedActivity}</span>}
          </div>
        )}
      </div>

      {/* Selector Controls */}
      <div className="space-y-4 pt-2">
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
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/40 ring-2 ring-indigo-400/50'
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

        {/* Activity Chips (Optional) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Select Activity (Optional):
            </label>
            {selectedActivity && (
              <button
                onClick={() => setSelectedActivity(undefined)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Clear Activity
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_OPTIONS.map((a) => {
              const isSelected = selectedActivity === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => handleActivitySelect(a.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 border border-purple-400'
                      : 'bg-slate-900/60 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                  }`}
                >
                  <span>{a.emoji}</span>
                  <span>{a.label}</span>
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
            No tracks found for <span className="text-indigo-400">{selectedMood}</span> {selectedActivity ? `+ ${selectedActivity}` : ''}
          </p>
          <p className="text-slate-500 text-xs max-w-sm mx-auto">
            Try choosing a different mood or clearing the activity filter to explore more tracks.
          </p>
        </div>
      )}

      {/* Carousel Results Display */}
      {(songs.length > 0 || loading) && (
        <div className="-mx-2 sm:-mx-4">
          <MediaCarousel
            title={`${selectedMood} ${selectedActivity ? `• ${selectedActivity}` : ''} Mix`}
            subtitle={`AI contextual tracks tuned for ${selectedMood.toLowerCase()} ${selectedActivity ? selectedActivity.toLowerCase() : 'vibes'}`}
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
