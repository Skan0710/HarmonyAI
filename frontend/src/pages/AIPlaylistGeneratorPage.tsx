import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  generateAIPlaylistApi,
  createPlaylistApi,
  addSongToPlaylistApi,
} from '../services/playlistService';
import type {
  DedicatedAIPlaylistResponseData,
  GeneratedPlaylistTrackDTO,
  GenerateAIPlaylistRequestParams,
} from '../services/playlistService';
import { usePlayer } from '../hooks/usePlayer';
import { useLikedSongsStore } from '../store/useLikedSongsStore';

const PRESET_PROMPTS = [
  { text: '⚡ High-energy 80s synthwave workout mix for running', mood: 'Energetic', genre: 'Synthwave', duration: 45 },
  { text: '🌙 Late night chill acoustic & lo-fi study session', mood: 'Chill', genre: 'Lofi', duration: 30 },
  { text: '🌧️ Rainy day melancholic indie rock & ambient soundscapes', mood: 'Melancholic', genre: 'Indie', duration: 40 },
  { text: '🎉 Upbeat dance pop party hits for weekend vibes', mood: 'Upbeat', genre: 'Pop', duration: 60 },
  { text: '🧘 Deep focus ambient & classical piano concentration', mood: 'Focus', genre: 'Ambient', duration: 45 },
];

const DURATION_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
  { label: '90 min', value: 90 },
];

const MOOD_OPTIONS = ['Any', 'Chill', 'Energetic', 'Focus', 'Melancholic', 'Upbeat', 'Workout', 'Party'];

const GENRE_OPTIONS = ['All', 'Synthwave', 'Pop', 'Rock', 'Hip-Hop', 'Indie', 'Electronic', 'Ambient', 'Jazz', 'Classical'];

const DISCOVERY_LEVELS = [
  { label: 'Familiar (20%)', value: 20, desc: 'Known hits & favorites' },
  { label: 'Balanced (50%)', value: 50, desc: 'Mix of hits & new tracks' },
  { label: 'High Discovery (80%)', value: 80, desc: 'Fresh & adventurous' },
  { label: 'Maximum (100%)', value: 100, desc: 'Uncharted underground songs' },
];

const SEQUENCING_OPTIONS: { label: string; value: 'balanced' | 'energetic' | 'gradual' | 'discovery'; desc: string }[] = [
  { label: 'Balanced Flow', value: 'balanced', desc: 'Seamless acoustic transitions with hook opener' },
  { label: 'High Momentum', value: 'energetic', desc: 'Front-loaded peak energy' },
  { label: 'Gradual Warm-Up', value: 'gradual', desc: 'Smooth ascending energy ramp' },
  { label: 'Discovery Mix', value: 'discovery', desc: 'Interleaved familiar & novel tracks' },
];

const formatDuration = (seconds?: number): string => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const AIPlaylistGeneratorPage: React.FC = () => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [selectedMood, setSelectedMood] = useState<string>('Any');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [discoveryLevel, setDiscoveryLevel] = useState<number>(50);
  const [sequencingStrategy, setSequencingStrategy] = useState<'balanced' | 'energetic' | 'gradual' | 'discovery'>('balanced');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DedicatedAIPlaylistResponseData | null>(null);
  const [activeTracks, setActiveTracks] = useState<GeneratedPlaylistTrackDTO[]>([]);

  // Save playlist state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
  const { isLiked, toggleLikeSong } = useLikedSongsStore();

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setLoading(true);
    setError(null);
    setSaveSuccessId(null);
    setSaveError(null);

    const params: GenerateAIPlaylistRequestParams = {
      prompt: prompt.trim() || undefined,
      targetDurationMinutes: selectedDuration,
      mood: selectedMood !== 'Any' ? selectedMood : undefined,
      genre: selectedGenre !== 'All' ? selectedGenre : undefined,
      discoveryPercentage: discoveryLevel,
      sequencingStrategy,
    };

    const { result: apiResult, error: apiError } = await generateAIPlaylistApi(params);

    setLoading(false);

    if (apiError) {
      setError(apiError);
    } else if (apiResult) {
      setResult(apiResult);
      setActiveTracks(apiResult.tracks || []);
    }
  };

  const handlePresetClick = (preset: typeof PRESET_PROMPTS[0]) => {
    const clean = preset.text.replace(/^[\p{Emoji}\s]+/gu, '').trim();
    setPrompt(clean);
    setSelectedMood(preset.mood);
    setSelectedGenre(preset.genre);
    setSelectedDuration(preset.duration);
  };

  const handleRemoveTrack = (indexToRemove: number) => {
    const updated = activeTracks.filter((_, idx) => idx !== indexToRemove);
    setActiveTracks(updated);
  };

  const handlePlayAll = () => {
    if (activeTracks.length > 0) {
      const songList = activeTracks.map((t) => t.song);
      playSong(songList[0], songList);
    }
  };

  const handlePlayTrack = (track: GeneratedPlaylistTrackDTO) => {
    const songList = activeTracks.map((t) => t.song);
    if (currentSong?._id === track.song._id) {
      togglePlay();
    } else {
      playSong(track.song, songList);
    }
  };

  const handleSavePlaylist = async () => {
    if (!result || activeTracks.length === 0) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const { playlist, error: createError } = await createPlaylistApi({
        name: result.title || 'AI Generated Playlist',
        description: result.description || 'Curated with HarmonyAI',
        visibility: 'public',
      });

      if (createError || !playlist) {
        setSaveError(createError || 'Failed to save playlist');
        setIsSaving(false);
        return;
      }

      // Add tracks to the newly created playlist
      for (const track of activeTracks) {
        const songId = track.song._id ? String(track.song._id) : (track.song as any).id;
        if (songId) {
          await addSongToPlaylistApi(playlist._id, songId);
        }
      }

      setIsSaving(false);
      setSaveSuccessId(playlist._id);
    } catch (err: any) {
      setIsSaving(false);
      setSaveError(err.message || 'An unexpected error occurred while saving.');
    }
  };

  // Compute live duration from activeTracks
  const currentTotalSeconds = activeTracks.reduce(
    (acc, t) => acc + (t.durationSeconds || t.song.duration || 210),
    0
  );
  const currentMins = Math.floor(currentTotalSeconds / 60);
  const currentSecs = currentTotalSeconds % 60;
  const liveDurationFormatted = `${currentMins}m ${currentSecs < 10 ? '0' : ''}${currentSecs}s`;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/60 via-purple-900/40 to-slate-900 p-8 border border-indigo-500/20 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider border border-indigo-500/30">
            <svg className="w-4 h-4 text-indigo-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI Playlist Studio
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            AI Playlist Generator
          </h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
            Describe the mood, vibe, or occasion in your own words, set your desired duration and discovery level, and let HarmonyAI's recommendation engine craft an acoustically sequenced playlist.
          </p>
        </div>
      </div>

      {/* Creation & Controls Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-6">
        <form onSubmit={handleGenerate} className="space-y-6">
          {/* Natural Language Prompt Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">
              Describe Your Desired Playlist
            </label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Chill lofi synthwave for coding late at night with smooth transitions..."
                rows={3}
                className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none shadow-inner"
              />
            </div>
          </div>

          {/* Preset Quick Prompts */}
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Popular Prompts
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESET_PROMPTS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-indigo-900/40 border border-slate-700/60 hover:border-indigo-500/50 text-slate-300 hover:text-indigo-200 text-xs font-medium transition-colors text-left"
                >
                  {preset.text}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Optional Controls: Duration, Mood, Genre */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/60">
            {/* Target Duration */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Target Duration
              </label>
              <div className="grid grid-cols-5 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedDuration(opt.value)}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-all text-center ${
                      selectedDuration === opt.value
                        ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mood Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Mood / Vibe
              </label>
              <select
                value={selectedMood}
                onChange={(e) => setSelectedMood(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-500"
              >
                {MOOD_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Genre Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Preferred Genre
              </label>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-500"
              >
                {GENRE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Toggle Advanced Controls (Discovery Level & Sequencing Strategy) */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors"
            >
              <span>{showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options (Discovery & Flow)'}</span>
              <svg
                className={`w-3.5 h-3.5 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              {/* Discovery Level */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Discovery Level ({discoveryLevel}%)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {DISCOVERY_LEVELS.find((d) => d.value === discoveryLevel)?.desc || 'Custom novelty'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DISCOVERY_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setDiscoveryLevel(level.value)}
                      className={`px-2.5 py-2 rounded-lg text-left text-xs transition-all border ${
                        discoveryLevel === level.value
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-medium text-slate-200">{level.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">{level.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sequencing Strategy */}
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  Acoustic Sequencing Strategy
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SEQUENCING_OPTIONS.map((seq) => (
                    <button
                      key={seq.value}
                      type="button"
                      onClick={() => setSequencingStrategy(seq.value)}
                      className={`px-2.5 py-2 rounded-lg text-left text-xs transition-all border ${
                        sequencingStrategy === seq.value
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-medium text-slate-200">{seq.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">{seq.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/60">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating Playlist...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Generate AI Playlist</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Loading Animation Card */}
      {loading && (
        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-12 text-center shadow-2xl backdrop-blur-xl animate-pulse space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white">Curating Your AI Playlist</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Extracting acoustic preferences, scoring candidate tracks with hybrid recommendations, and sequencing for smooth transitions...
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && !loading && (
        <div className="p-4 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-200 text-sm flex items-center gap-3">
          <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Generated Playlist Display */}
      {result && !loading && (
        <div className="space-y-6 animate-fadeIn">
          {/* Playlist Summary Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider border border-indigo-500/30">
                    AI Curated
                  </span>
                  {result.sequencingDiagnostics && (
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium border border-purple-500/30 capitalize">
                      {result.sequencingDiagnostics.strategy} Flow
                    </span>
                  )}
                  {result.diversityDiagnostics && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30">
                      {result.diversityDiagnostics.discoveryPercentage}% Discovery
                    </span>
                  )}
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {result.title}
                </h2>
                <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                  {result.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                  <span>{activeTracks.length} tracks</span>
                  <span>•</span>
                  <span>{liveDurationFormatted}</span>
                  <span>•</span>
                  <span>Evaluated {result.candidateCountEvaluated} candidates</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handlePlayAll}
                  disabled={activeTracks.length === 0}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Play All</span>
                </button>

                <button
                  type="button"
                  onClick={handleSavePlaylist}
                  disabled={isSaving || activeTracks.length === 0 || Boolean(saveSuccessId)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl border border-slate-700 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : saveSuccessId ? (
                    <>
                      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-emerald-300">Saved to Library!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Save Playlist</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerate()}
                  disabled={loading}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                  title="Regenerate with current settings"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Save Success Alert */}
            {saveSuccessId && (
              <div className="p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
                <span>Playlist successfully saved to your music library!</span>
                <button
                  onClick={() => navigate(`/playlists/${saveSuccessId}`)}
                  className="font-bold underline hover:text-white transition-colors"
                >
                  View Playlist →
                </button>
              </div>
            )}

            {/* Save Error Alert */}
            {saveError && (
              <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs">
                {saveError}
              </div>
            )}
          </div>

          {/* Generated Track List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Sequenced Tracks ({activeTracks.length})
              </h3>
              <span className="text-xs text-slate-400">
                Acoustically matched for smooth flow
              </span>
            </div>

            <div className="divide-y divide-slate-800/60">
              {activeTracks.map((item, index) => {
                const song = item.song;
                const isCurrent = currentSong?._id === song._id;
                const isPlayingThis = isCurrent && isPlaying;
                const liked = isLiked(song._id);

                return (
                  <div
                    key={song._id || index}
                    className={`p-3.5 sm:p-4 flex items-center justify-between gap-4 transition-colors ${
                      isCurrent ? 'bg-indigo-950/40' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Left: Index & Play Button */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handlePlayTrack(item)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                          isPlayingThis
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/50'
                            : 'bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white'
                        }`}
                      >
                        {isPlayingThis ? (
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>

                      {/* Song Cover / Thumbnail */}
                      {song.album && typeof song.album === 'object' && song.album.coverImage ? (
                        <img
                          src={song.album.coverImage}
                          alt={song.title}
                          className="w-11 h-11 rounded-lg object-cover bg-slate-800 shrink-0 border border-slate-700/50"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-indigo-800 to-purple-900 flex items-center justify-center text-white font-bold text-sm shrink-0 border border-slate-700/50">
                          {song.title?.charAt(0) || '♪'}
                        </div>
                      )}

                      {/* Title & Artist & Badges */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold text-sm truncate ${
                              isCurrent ? 'text-indigo-400' : 'text-white'
                            }`}
                          >
                            {song.title}
                          </span>
                          {item.noveltyScore && item.noveltyScore >= 0.7 && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hidden sm:inline">
                              Discovery
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 truncate mt-0.5">
                          <span>{item.artist || 'Unknown Artist'}</span>
                          <span>•</span>
                          <span className="text-slate-500">{item.genre || 'Music'}</span>
                          {song.audioFeatures && typeof song.audioFeatures.bpm === 'number' && (
                            <>
                              <span>•</span>
                              <span className="text-slate-500">{Math.round(song.audioFeatures.bpm)} BPM</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Duration, Like & Remove Track Action */}
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Duration */}
                      <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                        {item.durationFormatted || formatDuration(song.duration)}
                      </span>

                      {/* Like button */}
                      <button
                        type="button"
                        onClick={() => toggleLikeSong(song)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          liked ? 'text-rose-500 hover:text-rose-400' : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title={liked ? 'Unlike' : 'Like'}
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </button>

                      {/* Remove Track Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveTrack(index)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Remove track from playlist"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
