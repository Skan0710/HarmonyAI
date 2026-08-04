import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Song, Artist, Album } from '../types/music';
import { fetchSongs, fetchArtists, fetchAlbums } from '../services/songService';
import { MediaCarousel } from '../components/MediaCarousel';
import { AudioPlayer } from '../components/AudioPlayer';

export const HomePage: React.FC = () => {
  const { user } = useAuth();

  const [trendingSongs, setTrendingSongs] = useState<Song[]>([]);
  const [newReleases, setNewReleases] = useState<Song[]>([]);
  const [featuredArtists, setFeaturedArtists] = useState<Artist[]>([]);
  const [popularAlbums, setPopularAlbums] = useState<Album[]>([]);

  const [loadingTrending, setLoadingTrending] = useState<boolean>(true);
  const [loadingNewReleases, setLoadingNewReleases] = useState<boolean>(true);
  const [loadingArtists, setLoadingArtists] = useState<boolean>(true);
  const [loadingAlbums, setLoadingAlbums] = useState<boolean>(true);

  const [currentPlayingSong, setCurrentPlayingSong] = useState<Song | null>(null);

  useEffect(() => {
    const loadTrending = async () => {
      setLoadingTrending(true);
      const res = await fetchSongs({ sortBy: 'playCount', sortOrder: 'desc', limit: 10 });
      if (res.songs) setTrendingSongs(res.songs);
      setLoadingTrending(false);
    };

    const loadNewReleases = async () => {
      setLoadingNewReleases(true);
      const res = await fetchSongs({ sortBy: 'releaseYear', sortOrder: 'desc', limit: 10 });
      if (res.songs) setNewReleases(res.songs);
      setLoadingNewReleases(false);
    };

    const loadArtists = async () => {
      setLoadingArtists(true);
      const res = await fetchArtists();
      if (res.artists) setFeaturedArtists(res.artists);
      setLoadingArtists(false);
    };

    const loadAlbums = async () => {
      setLoadingAlbums(true);
      const res = await fetchAlbums();
      if (res.albums) setPopularAlbums(res.albums);
      setLoadingAlbums(false);
    };

    loadTrending();
    loadNewReleases();
    loadArtists();
    loadAlbums();
  }, []);

  const handlePlaySong = (song: Song) => {
    if (currentPlayingSong?._id === song._id) {
      setCurrentPlayingSong(null);
    } else {
      setCurrentPlayingSong(song);
    }
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Hero Banner Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/90 via-purple-900/80 to-slate-900 border border-indigo-500/30 p-6 sm:p-10 lg:p-12 shadow-2xl shadow-indigo-950/50">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Welcome back, {user?.name || 'Music Explorer'}!
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Discover Music Tailored to Your{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              AI Sonic Signature
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
            HarmonyAI analyzes acoustics, mood vectors, and listening habits to generate seamless music recommendations and personalized catalog discovery.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              to="/library"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/40 hover:shadow-indigo-600/60 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              Explore Music Library
            </Link>

            <Link
              to="/library?sort=playCount"
              className="px-6 py-3 bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-sm rounded-xl border border-slate-700/80 transition-colors flex items-center gap-2 backdrop-blur-md"
            >
              🔥 Top Trending Tracks
            </Link>
          </div>
        </div>
      </section>

      {/* 1. Trending Songs Carousel */}
      <MediaCarousel
        title="Trending Songs"
        subtitle="Most played tracks across the HarmonyAI network right now"
        seeAllLink="/library?sort=playCount"
        type="song"
        items={trendingSongs}
        loading={loadingTrending}
        onPlaySong={handlePlaySong}
        currentPlayingSongId={currentPlayingSong?._id}
      />

      {/* 2. New Releases Carousel */}
      <MediaCarousel
        title="New Releases"
        subtitle="Freshly uploaded albums, singles, and original productions"
        seeAllLink="/library?sort=releaseYear"
        type="song"
        items={newReleases}
        loading={loadingNewReleases}
        onPlaySong={handlePlaySong}
        currentPlayingSongId={currentPlayingSong?._id}
      />

      {/* 3. Featured Artists Carousel */}
      <MediaCarousel
        title="Featured Artists"
        subtitle="Top verified performers and independent creators on HarmonyAI"
        seeAllLink="/library"
        type="artist"
        items={featuredArtists}
        loading={loadingArtists}
      />

      {/* 4. Popular Albums Carousel */}
      <MediaCarousel
        title="Popular Albums"
        subtitle="Curated albums, EPs, and compilations in your music catalog"
        seeAllLink="/library"
        type="album"
        items={popularAlbums}
        loading={loadingAlbums}
      />

      {/* Reusable Audio Player Bar */}
      <AudioPlayer song={currentPlayingSong} onClose={() => setCurrentPlayingSong(null)} />
    </div>
  );
};
