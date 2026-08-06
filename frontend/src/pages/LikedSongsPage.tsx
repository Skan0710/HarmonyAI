import React, { useEffect } from 'react';
import { useLikedSongsStore } from '../store/useLikedSongsStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { MusicGrid } from '../components/MusicGrid';
import { Breadcrumbs } from '../components/Breadcrumbs';

export const LikedSongsPage: React.FC = () => {
  const { likedSongs, loading, fetchLikedSongs } = useLikedSongsStore();
  const playSong = usePlayerStore((state) => state.playSong);

  useEffect(() => {
    fetchLikedSongs();
  }, [fetchLikedSongs]);

  const handlePlayAll = () => {
    if (likedSongs.length > 0) {
      playSong(likedSongs[0], likedSongs);
    }
  };

  const handlePlaySong = (song: any) => {
    playSong(song, likedSongs);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs items={[{ label: 'Liked Songs' }]} />

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-950/80 via-slate-900 to-indigo-950/80 border border-rose-500/20 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-6">
          {/* Heart Graphic Thumbnail */}
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-gradient-to-br from-rose-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-rose-600/40 shrink-0 border border-rose-400/30">
            <svg className="w-16 h-16 sm:w-20 sm:h-20 text-white fill-current animate-pulse" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>

          {/* Banner Meta Info */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <span className="px-3 py-1 bg-rose-500/20 text-rose-300 text-xs font-bold uppercase tracking-wider rounded-full border border-rose-500/30">
              Playlist
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">Liked Songs</h1>
            <p className="text-slate-300 text-sm sm:text-base">
              Your personal collection of favorite tracks on HarmonyAI.
            </p>
            <p className="text-xs text-rose-300 font-mono pt-1">
              {likedSongs.length} {likedSongs.length === 1 ? 'song' : 'songs'} saved
            </p>
          </div>

          {/* Play All Button */}
          {likedSongs.length > 0 && (
            <button
              onClick={handlePlayAll}
              className="px-6 py-3.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-sm sm:text-base rounded-2xl shadow-xl shadow-rose-600/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 shrink-0"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Play All</span>
            </button>
          )}
        </div>
      </div>

      {/* Liked Songs Grid Component */}
      <MusicGrid
        songs={likedSongs}
        loading={loading}
        onPlaySong={handlePlaySong}
        emptyMessage="You haven't liked any songs yet. Browse the Music Library or Home page and click the heart icon on any track to save it here!"
      />
    </div>
  );
};
