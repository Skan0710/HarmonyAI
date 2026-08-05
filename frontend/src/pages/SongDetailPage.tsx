import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { Song } from '../types/music';
import { fetchSongById, fetchSongs } from '../services/songService';
import { MediaCarousel } from '../components/MediaCarousel';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { usePlayerStore } from '../store/usePlayerStore';

export const SongDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const [song, setSong] = useState<Song | null>(null);
  const [relatedSongs, setRelatedSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState<boolean>(false);

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
      } else {
        setSong(res.song);

        const genreId = typeof res.song.genre === 'object' ? res.song.genre._id : undefined;
        const relatedRes = await fetchSongs({
          genreId,
          limit: 8,
        });

        if (relatedRes.songs) {
          setRelatedSongs(relatedRes.songs.filter((s) => s._id !== res.song!._id));
        }
      }

      setLoading(false);
    };

    loadSongData();
  }, [id]);

  const handlePlayToggle = () => {
    if (!song) return;
    if (isCurrentTrackActive) {
      togglePlay();
    } else {
      playSong(song, [song, ...relatedSongs]);
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
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231e293b;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-8 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-4" />
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-64 h-64 bg-slate-800 rounded-2xl shrink-0" />
          <div className="space-y-4 flex-1">
            <div className="h-4 bg-slate-800 rounded w-1/4" />
            <div className="h-8 bg-slate-800 rounded w-3/4" />
            <div className="h-5 bg-slate-800 rounded w-1/2" />
            <div className="h-20 bg-slate-800 rounded-xl w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-slate-800/60 border border-slate-700/60 rounded-2xl text-center">
        <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Song Not Found</h2>
        <p className="text-sm text-slate-400 mb-6">{error || 'The requested track could not be found.'}</p>
        <button
          onClick={() => navigate('/library')}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl transition-colors shadow-lg shadow-indigo-600/30"
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
      <div className="relative overflow-hidden bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 z-10 relative">
          <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-2xl overflow-hidden bg-slate-800 shadow-2xl shrink-0 border border-slate-700/60 group">
            <img
              src={coverUrl}
              alt={song.title}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3">
              <span className="px-2.5 py-1 text-xs font-bold bg-slate-900/90 text-indigo-300 rounded-full border border-indigo-500/40 backdrop-blur-md">
                {getGenreName()}
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-5 text-center md:text-left">
            <div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Song Details</span>
                {song.releaseYear && (
                  <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                    {song.releaseYear}
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {song.title}
              </h1>
              <p className="text-lg font-semibold text-slate-300 mt-1">{getArtistName()}</p>
              <p className="text-sm text-slate-400 mt-0.5">
                Album: <span className="text-slate-200 font-medium">{getAlbumTitle()}</span>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl text-center md:text-left">
              <div>
                <span className="text-[11px] font-medium text-slate-400 uppercase block">Duration</span>
                <span className="text-sm font-semibold text-slate-200 font-mono">{formatDuration(song.duration)}</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-slate-400 uppercase block">Play Count</span>
                <span className="text-sm font-semibold text-indigo-300">{formatPlayCount(song.playCount)}</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-slate-400 uppercase block">Genre</span>
                <span className="text-sm font-semibold text-slate-200">{getGenreName()}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-1">
              <button
                onClick={handlePlayToggle}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/40 flex items-center gap-2"
              >
                {isCurrentTrackPlaying ? (
                  <>
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
                    </svg>
                    Pause Track
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Play Track
                  </>
                )}
              </button>

              <Link
                to="/library"
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-sm rounded-xl border border-slate-700 transition-colors"
              >
                Explore More Songs
              </Link>
            </div>
          </div>
        </div>
      </div>

      {song.audioFeatures && (song.audioFeatures.bpm || song.audioFeatures.energy) && (
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-200 tracking-tight flex items-center gap-2">
            <span>⚡ Audio & Acoustic Features</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            {song.audioFeatures.bpm && (
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-slate-400 block mb-1">Tempo / BPM</span>
                <span className="text-lg font-bold text-indigo-400">{song.audioFeatures.bpm} BPM</span>
              </div>
            )}

            {song.audioFeatures.energy !== undefined && (
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-slate-400 block mb-1">Energy Score</span>
                <span className="text-lg font-bold text-emerald-400">{Math.round(song.audioFeatures.energy * 100)}%</span>
              </div>
            )}

            {song.audioFeatures.valence !== undefined && (
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-slate-400 block mb-1">Mood / Valence</span>
                <span className="text-lg font-bold text-purple-400">{Math.round(song.audioFeatures.valence * 100)}%</span>
              </div>
            )}

            {song.audioFeatures.danceability !== undefined && (
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-slate-400 block mb-1">Danceability</span>
                <span className="text-lg font-bold text-amber-400">{Math.round(song.audioFeatures.danceability * 100)}%</span>
              </div>
            )}
          </div>
        </section>
      )}

      {relatedSongs.length > 0 && (
        <MediaCarousel
          title={`More in ${getGenreName()}`}
          subtitle="Explore tracks with similar acoustic vibes and energy"
          seeAllLink="/library"
          type="song"
          items={relatedSongs}
          onPlaySong={(item) => playSong(item, relatedSongs)}
        />
      )}
    </div>
  );
};
