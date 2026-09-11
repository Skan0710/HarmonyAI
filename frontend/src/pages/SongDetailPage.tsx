import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { Song } from '../types/music';
import { fetchSongById, fetchSimilarSongsApi } from '../services/songService';
import { Play, Pause, Plus, Zap } from 'lucide-react';
import { MediaCarousel } from '../components/MediaCarousel';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { LineHoverText } from '../components/ui/line-hover-link';
import { usePlayerStore } from '../store/usePlayerStore';

export const SongDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const [song, setSong] = useState<Song | null>(null);
  const [similarSongs, setSimilarSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingSimilar, setLoadingSimilar] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState<boolean>(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState<boolean>(false);

  const isCurrentTrackActive = currentSong?._id === song?._id;
  const isCurrentTrackPlaying = isCurrentTrackActive && isPlaying;

  useEffect(() => {
    if (!id) return;

    const loadSongData = async () => {
      setLoading(true);
      setError(null);
      setImgError(false);

      const res = await fetchSongById(id);

      if (res.error || !res.song) {
        setError(res.error || 'Song not found');
        setSong(null);
        setLoading(false);
      } else {
        setSong(res.song);
        setLoading(false);

        // Fetch Similar Songs Recommendations from API
        setLoadingSimilar(true);
        const similarRes = await fetchSimilarSongsApi(id, 10);
        if (similarRes.songs) {
          setSimilarSongs(similarRes.songs);
        }
        setLoadingSimilar(false);
      }
    };

    loadSongData();
  }, [id]);

  const handlePlayToggle = () => {
    if (!song) return;
    if (isCurrentTrackActive) {
      togglePlay();
    } else {
      playSong(song, [song, ...similarSongs]);
    }
  };

  const getArtistName = (): string => {
    if (!song?.artist) return 'Unknown Artist';
    if (typeof song.artist === 'object' && 'name' in song.artist) {
      return song.artist.name;
    }
    return String(song.artist);
  };

  const getAlbumTitle = (): string => {
    if (!song?.album) return 'Single Track';
    if (typeof song.album === 'object' && 'title' in song.album) {
      return song.album.title;
    }
    return String(song.album);
  };

  const getGenreName = (): string => {
    if (!song?.genre) return 'General';
    if (typeof song.genre === 'object' && 'name' in song.genre) {
      return song.genre.name;
    }
    return String(song.genre);
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatPlayCount = (count?: number): string => {
    if (!count) return '0';
    return count.toLocaleString();
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-8 animate-pulse">
        <div className="h-4 bg-surface-2 rounded w-1/3 mb-4" />
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-64 h-64 bg-surface-2 rounded-[var(--radius-lg)] shrink-0" />
          <div className="space-y-4 flex-1">
            <div className="h-4 bg-surface-2 rounded w-1/4" />
            <div className="h-8 bg-surface-2 rounded w-3/4" />
            <div className="h-5 bg-surface-2 rounded w-1/2" />
            <div className="h-20 bg-surface-2 rounded-[var(--radius-md)] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] text-center">
        <div className="w-14 h-14 rounded-full bg-danger-wash text-danger flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">Song Not Found</h2>
        <p className="text-sm text-text-tertiary mb-6">{error || 'The requested track could not be found.'}</p>
        <button
          onClick={() => navigate('/library')}
          className="px-5 py-2.5 bg-accent hover:bg-accent-strong text-text-on-accent font-medium text-sm rounded-[var(--radius-pill)] transition-colors cursor-pointer"
        >
          Back to Music Library
        </button>
      </div>
    );
  }

  const coverUrl = imgError || !song.coverImage ? fallbackCover : song.coverImage;

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs
        items={[
          { label: 'Music Library', path: '/library' },
          { label: getGenreName(), path: `/library?genre=${typeof song.genre === 'object' ? song.genre._id : ''}` },
          { label: song.title },
        ]}
      />

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-6 sm:p-8">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 z-10 relative">
          <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-[var(--radius-artwork)] overflow-hidden bg-surface-2 shadow-2xl shrink-0 border border-border-subtle group">
            <img
              src={coverUrl}
              alt={song.title}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3">
              <span className="px-2.5 py-1 text-xs font-bold bg-surface-0/90 text-accent rounded-[var(--radius-pill)] border border-accent/30 backdrop-blur-md">
                {getGenreName()}
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-5 text-center md:text-left">
            <div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">Song Details</span>
                {song.releaseYear && (
                  <span className="text-xs text-text-tertiary bg-surface-2 px-2 py-0.5 rounded-[var(--radius-sm)] border border-border-subtle">
                    {song.releaseYear}
                  </span>
                )}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl text-text-primary tracking-tight leading-tight">
                <LineHoverText variant="scribble" className="!inline">
                  {song.title}
                </LineHoverText>
              </h1>
              <p className="text-lg font-semibold text-text-secondary mt-1">{getArtistName()}</p>
              <p className="text-sm text-text-tertiary mt-0.5">
                Album: <span className="text-text-secondary font-medium">{getAlbumTitle()}</span>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3.5 bg-surface-0/60 border border-border-subtle rounded-[var(--radius-md)] text-center md:text-left">
              <div>
                <span className="text-[11px] font-medium text-text-tertiary uppercase block">Duration</span>
                <span className="text-sm font-semibold text-text-primary font-mono">{formatDuration(song.duration)}</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-text-tertiary uppercase block">Play Count</span>
                <span className="text-sm font-semibold text-accent">{formatPlayCount(song.playCount)}</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-text-tertiary uppercase block">Genre</span>
                <span className="text-sm font-semibold text-text-primary">{getGenreName()}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
              <button
                onClick={handlePlayToggle}
                className="px-6 py-3 bg-accent hover:bg-accent-strong text-text-on-accent font-semibold text-sm rounded-[var(--radius-pill)] transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isCurrentTrackPlaying ? (
                  <>
                    <Pause size={17} fill="currentColor" strokeWidth={0} />
                    Pause Track
                  </>
                ) : (
                  <>
                    <Play size={17} fill="currentColor" strokeWidth={0} />
                    Play Track
                  </>
                )}
              </button>

              <button
                onClick={() => setIsPlaylistModalOpen(true)}
                className="px-5 py-3 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary font-medium text-sm rounded-[var(--radius-pill)] transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Plus size={15} strokeWidth={2} className="text-accent" />
                <span>Add to Playlist</span>
              </button>

              <Link to="/library">
                <LineHoverText variant="slide" className="px-1 py-3 text-text-secondary hover:text-text-primary font-medium text-sm transition-colors">
                  Explore More Songs
                </LineHoverText>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {song.audioFeatures && (song.audioFeatures.bpm || song.audioFeatures.energy) && (
        <section className="bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-6 space-y-4">
          <h3 className="text-base font-bold text-text-primary tracking-tight flex items-center gap-2">
            <Zap size={16} className="text-gold" strokeWidth={1.75} />
            Audio & Acoustic Features
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            {song.audioFeatures.bpm && (
              <div className="p-3 bg-surface-0/60 border border-border-subtle rounded-[var(--radius-md)]">
                <span className="text-text-tertiary block mb-1">Tempo / BPM</span>
                <span className="text-lg font-bold text-accent">{song.audioFeatures.bpm} BPM</span>
              </div>
            )}

            {song.audioFeatures.energy !== undefined && (
              <div className="p-3 bg-surface-0/60 border border-border-subtle rounded-[var(--radius-md)]">
                <span className="text-text-tertiary block mb-1">Energy Score</span>
                <span className="text-lg font-bold text-success">{Math.round(song.audioFeatures.energy * 100)}%</span>
              </div>
            )}

            {song.audioFeatures.valence !== undefined && (
              <div className="p-3 bg-surface-0/60 border border-border-subtle rounded-[var(--radius-md)]">
                <span className="text-text-tertiary block mb-1">Mood / Valence</span>
                <span className="text-lg font-bold text-gold">{Math.round(song.audioFeatures.valence * 100)}%</span>
              </div>
            )}

            {song.audioFeatures.danceability !== undefined && (
              <div className="p-3 bg-surface-0/60 border border-border-subtle rounded-[var(--radius-md)]">
                <span className="text-text-tertiary block mb-1">Danceability</span>
                <span className="text-lg font-bold text-accent">{Math.round(song.audioFeatures.danceability * 100)}%</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* "You May Also Like" Content-Based Recommendation Section */}
      <MediaCarousel
        title="You May Also Like"
        subtitle="AI content-based recommendations ranked by acoustic feature vector similarity"
        seeAllLink="/library"
        type="song"
        items={similarSongs}
        loading={loadingSimilar}
        onPlaySong={(item) => playSong(item, similarSongs)}
      />

      {/* Add To Playlist Modal Dialog */}
      <AddToPlaylistModal
        song={song}
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
      />
    </div>
  );
};
