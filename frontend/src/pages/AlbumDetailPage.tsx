import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Play, Shuffle } from 'lucide-react';
import type { Album, Song } from '../types/music';
import { fetchAlbumById, fetchSongs } from '../services/songService';
import { MusicGrid } from '../components/MusicGrid';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { usePlayerStore } from '../store/usePlayerStore';

export const AlbumDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const playSong = usePlayerStore((state) => state.playSong);

  const [album, setAlbum] = useState<Album | null>(null);
  const [albumSongs, setAlbumSongs] = useState<Song[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;

    const loadAlbumData = async () => {
      setLoading(true);
      setError(null);
      setImgError(false);

      const res = await fetchAlbumById(id);

      if (res.error || !res.album) {
        setError(res.error || 'Album details not found');
        setAlbum(null);
      } else {
        setAlbum(res.album);

        const songsRes = await fetchSongs({ albumId: id, limit: 50 });
        if (songsRes.songs) {
          setAlbumSongs(songsRes.songs);
        }
      }

      setLoading(false);
    };

    loadAlbumData();
  }, [id]);

  const handlePlaySong = (song: Song) => {
    playSong(song, albumSongs);
  };

  const handlePlayAlbum = (shuffle = false) => {
    if (albumSongs.length === 0) return;
    if (shuffle) {
      const shuffled = [...albumSongs].sort(() => Math.random() - 0.5);
      playSong(shuffled[0], shuffled);
    } else {
      playSong(albumSongs[0], albumSongs);
    }
  };

  const getArtistId = (): string | null => {
    if (!album?.artist) return null;
    if (typeof album.artist === 'object' && '_id' in album.artist) {
      return (album.artist as { _id: string })._id;
    }
    return String(album.artist);
  };

  const getArtistName = (): string => {
    if (!album?.artist) return 'Various Artists';
    if (typeof album.artist === 'object' && 'name' in album.artist) {
      return (album.artist as { name: string }).name;
    }
    return String(album.artist);
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>';

  const coverUrl = imgError || !album?.coverImage ? fallbackCover : album?.coverImage;
  const artistId = getArtistId();

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 py-8 animate-pulse">
        <div className="h-4 bg-surface-2 rounded w-1/3 mb-4" />
        <div className="flex flex-col sm:flex-row gap-8">
          <div className="w-56 h-56 bg-surface-2 rounded-[var(--radius-lg)]" />
          <div className="space-y-4 flex-1">
            <div className="h-6 bg-surface-2 rounded w-1/4" />
            <div className="h-8 bg-surface-2 rounded w-3/4" />
            <div className="h-4 bg-surface-2 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] text-center">
        <div className="w-14 h-14 rounded-full bg-danger-wash text-danger flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">Album Not Found</h2>
        <p className="text-sm text-text-tertiary mb-6">{error || 'The requested album could not be found.'}</p>
        <button
          onClick={() => navigate('/library')}
          className="px-5 py-2.5 bg-accent hover:bg-accent-strong text-text-on-accent font-medium text-sm rounded-[var(--radius-pill)] transition-colors cursor-pointer"
        >
          Explore Music Library
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs
        items={[
          { label: 'Music Library', path: '/library' },
          { label: 'Albums', path: '/albums' },
          { label: album.title },
        ]}
      />

      {/* Album Header Hero Section */}
      <div className="relative overflow-hidden bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-6 sm:p-10">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 z-10 relative">
          <div className="relative w-52 h-52 sm:w-60 sm:h-60 rounded-[var(--radius-artwork)] overflow-hidden bg-surface-2 border border-border-subtle shadow-2xl shrink-0">
            <img
              src={coverUrl}
              alt={album.title}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-accent">
                  {album.albumType || 'Album'}
                </span>
                {album.releaseYear && (
                  <span className="text-xs text-text-tertiary bg-surface-2 px-2.5 py-0.5 rounded-[var(--radius-sm)] border border-border-subtle">
                    {album.releaseYear}
                  </span>
                )}
              </div>

              <h1 className="font-display text-3xl sm:text-4xl text-text-primary tracking-tight">
                {album.title}
              </h1>

              <div className="mt-2 flex items-center justify-center sm:justify-start gap-2 text-base text-text-secondary">
                <span className="text-text-tertiary">By</span>
                {artistId ? (
                  <Link
                    to={`/artists/${artistId}`}
                    className="font-bold text-accent hover:text-accent-strong transition-colors flex items-center gap-1.5"
                  >
                    {getArtistName()}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                ) : (
                  <span className="font-bold text-text-primary">{getArtistName()}</span>
                )}
              </div>
            </div>

            <div className="inline-flex items-center gap-4 p-3 bg-surface-0/60 border border-border-subtle rounded-[var(--radius-md)] text-xs text-text-secondary">
              <div>
                <span className="text-text-tertiary block text-[10px] uppercase font-semibold">Total Songs</span>
                <span className="font-bold text-text-primary text-sm">{albumSongs.length || album.totalTracks || 1} tracks</span>
              </div>
              <div className="w-px h-6 bg-border-subtle" />
              <div>
                <span className="text-text-tertiary block text-[10px] uppercase font-semibold">Release Year</span>
                <span className="font-bold text-accent text-sm">{album.releaseYear || 'N/A'}</span>
              </div>
            </div>

            {/* Play Whole Album & Shuffle Action Buttons */}
            {albumSongs.length > 0 && (
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1">
                <button
                  onClick={() => handlePlayAlbum(false)}
                  className="px-5 py-2.5 bg-accent hover:bg-accent-strong text-text-on-accent font-semibold text-xs sm:text-sm rounded-[var(--radius-pill)] transition-all flex items-center gap-2 shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <Play size={15} fill="currentColor" />
                  Play Album
                </button>
                <button
                  onClick={() => handlePlayAlbum(true)}
                  className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 text-text-primary font-medium text-xs sm:text-sm rounded-[var(--radius-pill)] border border-border-subtle transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <Shuffle size={14} />
                  Shuffle
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
              Tracklist ({albumSongs.length} Songs)
            </h2>
            <p className="text-xs sm:text-sm text-text-tertiary mt-0.5">
              Click any song card to view full details or hit play to listen directly.
            </p>
          </div>
        </div>

        <MusicGrid
          songs={albumSongs}
          loading={false}
          onPlaySong={handlePlaySong}
          emptyMessage={`No songs uploaded under "${album.title}" yet.`}
        />
      </section>
    </div>
  );
};
