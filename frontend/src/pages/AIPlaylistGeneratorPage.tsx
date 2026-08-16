import React, { useState } from 'react';
import { generateAIPlaylistApi } from '../services/playlistService';
import type { AIPlaylistGenerationData } from '../services/playlistService';
import { usePlayer } from '../hooks/usePlayer';
import { useLikedSongsStore } from '../store/useLikedSongsStore';
import type { Song } from '../types/music';

const PRESET_PROMPTS = [
  '⚡ High-energy 80s synthwave workout mix for running',
  '🌙 Late night chill acoustic & lo-fi study session',
  '🌧️ Rainy day melancholic indie rock & ambient soundscapes',
  '🎉 Upbeat dance pop party hits for weekend vibes',
  '🧘 Deep focus ambient & classical piano concentration',
];

const SONG_COUNT_OPTIONS = [5, 10, 12, 15, 20, 25];

const formatDuration = (seconds?: number): string => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const AIPlaylistGeneratorPage: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [songCount, setSongCount] = useState<number>(12);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIPlaylistGenerationData | null>(null);

  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
  const { isLiked, toggleLikeSong } = useLikedSongsStore();

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    const { result: apiResult, error: apiError } = await generateAIPlaylistApi(
      prompt.trim(),
      songCount
    );

    setLoading(false);

    if (apiError) {
      setError(apiError);
    } else if (apiResult) {
      setResult(apiResult);
    }
  };

  const handlePresetClick = (presetText: string) => {
    // Remove emoji prefix for clean query
    const clean = presetText.replace(/^[\p{Emoji}\s]+/gu, '').trim();
    setPrompt(clean);
  };

  const handlePlayAll = () => {
    if (result && result.songs.length > 0) {
      playSong(result.songs[0], result.songs);
    }
  };

  const handlePlayTrack = (song: Song) => {
    if (!result) return;
    if (currentSong?._id === song._id) {
      togglePlay();
    } else {
      playSong(song, result.songs);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/60 via-purple-900/40 to-slate-900 p-8 border border-indigo-500/20 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider border border-indigo-500/30">
            <svg className="w-4 h-4 text-indigo-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI Music Curator
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            AI Playlist Generator
          </h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
            Describe the mood, vibe, genres, or activity you want. Our AI will analyze your request, candidate catalog tracks, and taste profile to craft a customized playlist preview.
          </p>
        </div>
      </div>

      {/* Input & Configuration Card */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-6">
        <form onSubmit={handleGenerate} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-200">
              Describe your ideal playlist
            </label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Upbeat 80s synthwave workout mix with high energy and fast tempo for night running..."
                rows={3}
                maxLength={500}
                className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none text-sm sm:text-base"
              />
              <span className="absolute bottom-3 right-3 text-xs text-slate-500 font-mono">
                {prompt.length}/500
              </span>
            </div>
          </div>

          {/* Preset Chips */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Prompt Ideas & Inspiration
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESET_PROMPTS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className="text-xs bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-600/50 transition-all text-left"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Configuration Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-700/60">
            <div className="flex items-center gap-3">
              <label htmlFor="song-count" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Desired Songs:
              </label>
              <select
                id="song-count"
                value={songCount}
                onChange={(e) => setSongCount(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-sm font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {SONG_COUNT_OPTIONS.map((count) => (
                  <option key={count} value={count}>
                    {count} Songs
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white font-semibold shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Curating AI Playlist...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.595 15.12a2 2 0 00-1.804.547L3 16.5V21l.8-.4a2 2 0 011.6 0l2.4.8a2 2 0 001.6 0l2.4-.8a2 2 0 011.6 0l2.4.8a2 2 0 001.6 0l2.4-.8a2 2 0 011.6 0l.8.4v-4.5l-.772-1.072z" />
                  </svg>
                  <span>Generate Playlist</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-8 space-y-6 animate-pulse">
          <div className="h-8 bg-slate-700/60 rounded-lg w-1/3" />
          <div className="h-4 bg-slate-700/40 rounded w-2/3" />
          <div className="space-y-3 pt-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex items-center gap-4 p-3 bg-slate-900/40 rounded-xl">
                <div className="w-10 h-10 bg-slate-700/60 rounded-lg shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-700/60 rounded w-1/4" />
                  <div className="h-3 bg-slate-700/40 rounded w-1/6" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && !loading && (
        <div className="bg-rose-950/60 border border-rose-500/40 text-rose-200 rounded-2xl p-6 flex items-start gap-4 shadow-xl">
          <svg className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="space-y-2 flex-1">
            <h3 className="font-semibold text-rose-100">Playlist Generation Failed</h3>
            <p className="text-sm text-rose-300/90">{error}</p>
            <button
              onClick={() => handleGenerate()}
              className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Insufficient Results Warning */}
      {result && !loading && result.songs.length < songCount && result.songs.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/30 text-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs sm:text-sm text-amber-300">
            Note: Requested <span className="font-bold">{songCount}</span> songs, but catalog candidate filtering yielded <span className="font-bold">{result.songs.length}</span> matching tracks.
          </p>
        </div>
      )}

      {/* No Songs Returned / Empty State */}
      {result && !loading && result.songs.length === 0 && (
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-700/50 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-200">No Matching Songs Found</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Try adjusting your prompt keywords, broadening genre requests, or selecting a different song count.
          </p>
        </div>
      )}

      {/* Generated Playlist Display Interface */}
      {result && !loading && result.songs.length > 0 && (
        <div className="space-y-6">
          {/* Playlist Preview Banner Header */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider border border-emerald-500/30">
                    Draft AI Playlist Preview
                  </span>
                  <span className="text-xs text-slate-400">
                    ({result.selectedCount} tracks • {result.candidatesEvaluated} candidates evaluated)
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {result.preferences.title}
                </h2>
                <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                  {result.preferences.description}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={handlePlayAll}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Play All</span>
                </button>
              </div>
            </div>

            {/* Extracted Metadata Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-700/60">
              {result.preferences.requestedMood && (
                <span className="px-3 py-1 rounded-lg bg-indigo-900/60 text-indigo-200 border border-indigo-700/50 text-xs font-semibold">
                  Mood: {result.preferences.requestedMood}
                </span>
              )}

              {result.preferences.genres.map((g, i) => (
                <span key={i} className="px-3 py-1 rounded-lg bg-purple-900/60 text-purple-200 border border-purple-700/50 text-xs font-semibold">
                  {g}
                </span>
              ))}

              <span className="px-3 py-1 rounded-lg bg-slate-700/60 text-slate-300 text-xs font-semibold">
                Energy: {Math.round(result.preferences.energyLevel * 100)}%
              </span>

              <span className="px-3 py-1 rounded-lg bg-slate-700/60 text-slate-300 text-xs font-semibold">
                Tempo: {result.preferences.tempoPreference}
              </span>
            </div>
          </div>

          {/* Playlist Tracklist Table */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700">
                  <tr>
                    <th scope="col" className="py-3.5 px-4 w-12 text-center">#</th>
                    <th scope="col" className="py-3.5 px-4">Title & Artist</th>
                    <th scope="col" className="py-3.5 px-4 hidden md:table-cell">Album</th>
                    <th scope="col" className="py-3.5 px-4 hidden sm:table-cell">Genre</th>
                    <th scope="col" className="py-3.5 px-4 w-20 text-right">Duration</th>
                    <th scope="col" className="py-3.5 px-4 w-16 text-center font-normal">Like</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {result.songs.map((song, idx) => {
                    const isCurrent = currentSong?._id === song._id;
                    const isCurrentPlaying = isCurrent && isPlaying;
                    const artistName =
                      typeof song.artist === 'object' && song.artist && 'name' in song.artist
                        ? song.artist.name
                        : String(song.artist || 'Unknown');
                    const albumTitle =
                      typeof song.album === 'object' && song.album && 'title' in song.album
                        ? song.album.title
                        : 'Single';
                    const genreName =
                      typeof song.genre === 'object' && song.genre && 'name' in song.genre
                        ? song.genre.name
                        : 'Music';

                    return (
                      <tr
                        key={song._id || idx}
                        className={`group hover:bg-slate-700/40 transition-colors ${
                          isCurrent ? 'bg-indigo-950/40 text-indigo-200' : ''
                        }`}
                      >
                        {/* Index / Play Button */}
                        <td className="py-3 px-4 text-center text-xs font-mono text-slate-500">
                          <button
                            onClick={() => handlePlayTrack(song)}
                            className="w-8 h-8 rounded-lg hover:bg-indigo-600 text-slate-400 hover:text-white flex items-center justify-center transition-all mx-auto"
                          >
                            {isCurrentPlaying ? (
                              <svg className="w-4 h-4 text-indigo-400 group-hover:text-white fill-current" viewBox="0 0 24 24">
                                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                              </svg>
                            ) : (
                              <span className="group-hover:hidden">{idx + 1}</span>
                            )}
                            {!isCurrentPlaying && (
                              <svg className="w-4 h-4 hidden group-hover:block fill-current" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            )}
                          </button>
                        </td>

                        {/* Song Details */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={song.coverImage || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120&auto=format&fit=crop&q=80'}
                              alt={song.title}
                              className="w-10 h-10 rounded-lg object-cover bg-slate-900 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className={`font-semibold text-sm truncate ${isCurrent ? 'text-indigo-400' : 'text-slate-100'}`}>
                                {song.title}
                              </p>
                              <p className="text-xs text-slate-400 truncate">{artistName}</p>
                            </div>
                          </div>
                        </td>

                        {/* Album */}
                        <td className="py-3 px-4 hidden md:table-cell text-xs text-slate-400 truncate">
                          {albumTitle}
                        </td>

                        {/* Genre */}
                        <td className="py-3 px-4 hidden sm:table-cell">
                          <span className="px-2 py-0.5 rounded bg-slate-700/60 text-slate-300 text-xs">
                            {genreName}
                          </span>
                        </td>

                        {/* Duration */}
                        <td className="py-3 px-4 text-right text-xs font-mono text-slate-400">
                          {formatDuration(song.duration)}
                        </td>

                        {/* Like Button */}
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => toggleLikeSong(song)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                          >
                            <svg
                              className={`w-4 h-4 ${isLiked(song._id) ? 'fill-rose-500 text-rose-500' : 'fill-none stroke-current'}`}
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
