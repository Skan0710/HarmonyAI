import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Artist, Song, Album } from '../types/music';
import { fetchArtistById, fetchSongs, fetchAlbums, fetchSimilarArtists } from '../services/songService';
import { MediaCarousel } from '../components/MediaCarousel';
import { MusicGrid } from '../components/MusicGrid';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { usePlayerStore } from '../store/usePlayerStore';

export const ArtistDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const playSong = usePlayerStore((state) => state.playSong);

  const [artist, setArtist] = useState<Artist | null>(null);
  const [artistSongs, setArtistSongs] = useState<Song[]>([]);
  const [artistAlbums, setArtistAlbums] = useState<Album[]>([]);
  const [similarArtists, setSimilarArtists] = useState<Artist[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;

    const loadArtistData = async () => {
      setLoading(true);
      setError(null);
      setImgError(false);

      const res = await fetchArtistById(id);

      if (res.error || !res.artist) {
        setError(res.error || 'Artist profile not found');
        setArtist(null);
      } else {
        setArtist(res.artist);

        const [songsRes, albumsRes, similarRes] = await Promise.all([
          fetchSongs({ artistId: id, limit: 20 }),
          fetchAlbums({ artistId: id }),
          fetchSimilarArtists(id),
        ]);

        if (songsRes.songs) setArtistSongs(songsRes.songs);
        if (albumsRes.albums) setArtistAlbums(albumsRes.albums);
        if (similarRes.artists) setSimilarArtists(similarRes.artists);
      }

      setLoading(false);
    };

    loadArtistData();
  }, [id]);

  const handlePlaySong = (song: Song) => {
    playSong(song, artistSongs);
  };

  const formatListeners = (listeners?: number): string => {
    if (!listeners) return '0';
    return listeners.toLocaleString();
  };

  const fallbackAvatar =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  const imageUrl = imgError || (!artist?.profileImage && !artist?.avatar) ? fallbackAvatar : (artist?.profileImage || artist?.avatar);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 py-8 animate-pulse">
        <div className="h-4 bg-surface-2 rounded w-1/3 mb-4" />
        <div className="h-64 bg-surface-2 rounded-[var(--radius-lg)]" />
        <div className="space-y-4">
          <div className="h-6 bg-surface-2 rounded w-1/3" />
          <div className="h-4 bg-surface-2 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] text-center">
        <div className="w-14 h-14 rounded-full bg-danger-wash text-danger flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">Artist Profile Not Found</h2>
        <p className="text-sm text-text-tertiary mb-6">{error || 'The requested artist profile could not be found.'}</p>
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
          { label: 'Artists' },
          { label: artist.name },
        ]}
      />

      {/* Artist Profile Header Hero */}
      <div className="relative overflow-hidden bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-6 sm:p-10">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 z-10 relative">
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden bg-surface-2 border-4 border-border-subtle shadow-2xl shrink-0">
            <img
              src={imageUrl}
              alt={artist.name}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-accent">Artist Profile</span>
                {artist.verified && (
                  <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-accent-wash text-accent rounded-[var(--radius-pill)] border border-accent/30 flex items-center gap-1">
                    ✓ Verified Artist
                  </span>
                )}
              </div>

              <h1 className="font-display text-3xl sm:text-5xl text-text-primary tracking-tight">
                {artist.name}
              </h1>

              <div className="mt-2 flex items-center justify-center sm:justify-start gap-2 text-sm text-text-secondary">
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="font-semibold text-text-primary">{formatListeners(artist.monthlyListeners)}</span>
                <span className="text-text-tertiary">monthly listeners</span>
              </div>
            </div>

            {artist.bio && (
              <p className="text-text-secondary text-sm leading-relaxed max-w-3xl">
                {artist.bio}
              </p>
            )}
          </div>
        </div>
      </div>

      {artistAlbums.length > 0 && (
        <MediaCarousel
          title="Albums & Discography"
          subtitle={`Explore albums released by ${artist.name}`}
          type="album"
          items={artistAlbums}
        />
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
              Top Songs
            </h2>
            <p className="text-xs sm:text-sm text-text-tertiary mt-0.5">
              Tracks and releases by {artist.name}
            </p>
          </div>
        </div>

        <MusicGrid
          songs={artistSongs}
          loading={false}
          onPlaySong={handlePlaySong}
          emptyMessage={`No songs uploaded for ${artist.name} yet.`}
        />
      </section>

      {similarArtists.length > 0 && (
        <MediaCarousel
          title="Fans Also Like"
          subtitle={`Similar artists in the same genre ecosystem`}
          type="artist"
          items={similarArtists}
        />
      )}
    </div>
  );
};
