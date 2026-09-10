import React, { useEffect } from 'react';
import { Heart, Play } from 'lucide-react';
import { useLikedSongsStore } from '../store/useLikedSongsStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { SongRow } from '../components/SongRow';
import { Button } from '../components/ui/Button';

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

  return (
    <div className="pb-16">
      <section className="border-b border-border-subtle px-5 sm:px-8 lg:px-12 pt-10 pb-8 flex items-end justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[var(--radius-md)] bg-accent-wash text-accent flex items-center justify-center shrink-0">
            <Heart size={24} fill="currentColor" />
          </div>
          <div>
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.14em]">Playlist</p>
            <h1 className="font-display text-2xl sm:text-3xl text-text-primary leading-snug">Liked Songs</h1>
            <p className="text-xs text-text-tertiary font-mono mt-1">
              {likedSongs.length} {likedSongs.length === 1 ? 'song' : 'songs'} saved
            </p>
          </div>
        </div>

        {likedSongs.length > 0 && (
          <Button onClick={handlePlayAll}>
            <Play size={14} fill="currentColor" />
            Play all
          </Button>
        )}
      </section>

      <div className="px-5 sm:px-8 lg:px-12 pt-8">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3.5 py-2.5 animate-pulse">
                <div className="w-10 h-10 rounded-[var(--radius-artwork)] bg-surface-2 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-surface-2 rounded w-1/3" />
                  <div className="h-2.5 bg-surface-2 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : likedSongs.length === 0 ? (
          <div className="py-16 text-center max-w-md mx-auto space-y-2">
            <Heart size={28} className="text-text-tertiary mx-auto" strokeWidth={1.5} />
            <h3 className="font-display text-lg text-text-primary">Nothing liked yet</h3>
            <p className="text-sm text-text-tertiary">
              Tap the heart on any track and it'll show up here.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl divide-y divide-border-subtle">
            {likedSongs.map((song, i) => (
              <SongRow key={song._id} song={song} index={i} onPlay={() => playSong(song, likedSongs)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
