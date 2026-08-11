import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Song, Artist, Album } from '../types/music';
import {
  fetchArtists,
  fetchTrendingSongsApi,
  fetchNewReleasesApi,
} from '../services/songService';
import { fetchRecentlyPlayedApi } from '../services/historyService';
import { fetchPersonalizedFeedApi } from '../services/personalizedFeedService';
import { fetchCollaborativeRecommendationsApi } from '../services/recommendationService';
import { MediaCarousel } from '../components/MediaCarousel';
import { usePlayerStore } from '../store/usePlayerStore';

export const HomePage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const playSong = usePlayerStore((state) => state.playSong);

  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [collaborativeSongs, setCollaborativeSongs] = useState<Song[]>([]);
  const [basedOnTaste, setBasedOnTaste] = useState<Song[]>([]);
  const [favoriteGenreTracks, setFavoriteGenreTracks] = useState<Song[]>([]);
  const [suggestedArtists, setSuggestedArtists] = useState<Artist[]>([]);

  const [trendingSongs, setTrendingSongs] = useState<Song[]>([]);
  const [newReleaseSongs, setNewReleaseSongs] = useState<Song[]>([]);
  const [newReleaseAlbums, setNewReleaseAlbums] = useState<Album[]>([]);
  const [featuredArtists, setFeaturedArtists] = useState<Artist[]>([]);

  const [loadingRecentlyPlayed, setLoadingRecentlyPlayed] = useState<boolean>(false);
  const [loadingCollaborative, setLoadingCollaborative] = useState<boolean>(false);
  const [loadingPersonalized, setLoadingPersonalized] = useState<boolean>(false);
  const [loadingTrending, setLoadingTrending] = useState<boolean>(true);
  const [loadingNewReleases, setLoadingNewReleases] = useState<boolean>(true);
  const [loadingArtists, setLoadingArtists] = useState<boolean>(true);

  useEffect(() => {
    const loadRecentlyPlayed = async () => {
      if (!isAuthenticated) return;
      setLoadingRecentlyPlayed(true);
      const res = await fetchRecentlyPlayedApi(10);
      if (res.songs && res.songs.length > 0) {
        setRecentlyPlayed(res.songs);
      }
      setLoadingRecentlyPlayed(false);
    };

    const loadCollaborativeRecommendations = async () => {
      if (!isAuthenticated) return;
      setLoadingCollaborative(true);
      const res = await fetchCollaborativeRecommendationsApi(10);
      if (res.songs && res.songs.length > 0) {
        setCollaborativeSongs(res.songs);
      }
      setLoadingCollaborative(false);
    };

    const loadPersonalizedFeed = async () => {
      if (!isAuthenticated) return;
      setLoadingPersonalized(true);
      const res = await fetchPersonalizedFeedApi();
      if (res.feed) {
        setBasedOnTaste(res.feed.basedOnTaste || []);
        setFavoriteGenreTracks(res.feed.favoriteGenreTracks || []);
        setSuggestedArtists(res.feed.suggestedArtists || []);
      }
      setLoadingPersonalized(false);
    };

    const loadTrending = async () => {
      setLoadingTrending(true);
      const res = await fetchTrendingSongsApi(10);
      if (res.songs) setTrendingSongs(res.songs);
      setLoadingTrending(false);
    };

    const loadNewReleases = async () => {
      setLoadingNewReleases(true);
      const res = await fetchNewReleasesApi(1, 10);
      if (res.songs) setNewReleaseSongs(res.songs);
      if (res.albums) setNewReleaseAlbums(res.albums);
      setLoadingNewReleases(false);
    };

    const loadArtists = async () => {
      setLoadingArtists(true);
      const res = await fetchArtists();
      if (res.artists) setFeaturedArtists(res.artists);
      setLoadingArtists(false);
    };

    loadRecentlyPlayed();
    loadCollaborativeRecommendations();
    loadPersonalizedFeed();
    loadTrending();
    loadNewReleases();
    loadArtists();
  }, [isAuthenticated]);

  const handlePlaySong = (song: Song, queueList: Song[]) => {
    playSong(song, queueList);
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
              to="/preferences"
              className="px-6 py-3 bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-sm rounded-xl border border-slate-700/80 transition-colors flex items-center gap-2 backdrop-blur-md"
            >
              ⚡ Set Music Preferences
            </Link>
          </div>
        </div>
      </section>

      {/* 1. Recently Played Carousel (Rendered if user has playback history) */}
      {(recentlyPlayed.length > 0 || loadingRecentlyPlayed) && (
        <MediaCarousel
          title="Recently Played"
          subtitle="Pick up right where you left off"
          seeAllLink="/history"
          type="song"
          items={recentlyPlayed}
          loading={loadingRecentlyPlayed}
          onPlaySong={(song) => handlePlaySong(song, recentlyPlayed)}
        />
      )}

      {/* 2. Collaborative Recommendations Carousel ("Listeners Like You Enjoy") */}
      {(collaborativeSongs.length > 0 || loadingCollaborative) && (
        <MediaCarousel
          title="Listeners Like You Enjoy"
          subtitle="Collaborative recommendations based on community listening habits and similar taste"
          seeAllLink="/library"
          type="song"
          items={collaborativeSongs}
          loading={loadingCollaborative}
          onPlaySong={(song) => handlePlaySong(song, collaborativeSongs)}
        />
      )}

      {/* 3. "Based on Your Taste" Carousel (Personalized Feed) */}
      {(basedOnTaste.length > 0 || loadingPersonalized) && (
        <MediaCarousel
          title="Based on Your Taste"
          subtitle="Tailored to your favorite performers and listening history"
          seeAllLink="/preferences"
          type="song"
          items={basedOnTaste}
          loading={loadingPersonalized}
          onPlaySong={(song) => handlePlaySong(song, basedOnTaste)}
        />
      )}

      {/* 4. "Your Favorite Genres" Carousel (Personalized Feed) */}
      {(favoriteGenreTracks.length > 0 || loadingPersonalized) && (
        <MediaCarousel
          title="Your Favorite Genres"
          subtitle="Top tracks from your preferred musical genres"
          seeAllLink="/genres"
          type="song"
          items={favoriteGenreTracks}
          loading={loadingPersonalized}
          onPlaySong={(song) => handlePlaySong(song, favoriteGenreTracks)}
        />
      )}

      {/* 5. "Artists You May Like" Carousel (Personalized Feed) */}
      {(suggestedArtists.length > 0 || loadingPersonalized) && (
        <MediaCarousel
          title="Artists You May Like"
          subtitle="Recommended creators matching your acoustic preferences"
          seeAllLink="/preferences"
          type="artist"
          items={suggestedArtists}
          loading={loadingPersonalized}
        />
      )}

      {/* 6. Trending Songs Carousel (Dynamic recency-weighted scoring) */}
      <MediaCarousel
        title="Trending Songs"
        subtitle="Dynamic real-time trending songs calculated from play recency & history"
        seeAllLink="/library?sort=playCount"
        type="song"
        items={trendingSongs}
        loading={loadingTrending}
        onPlaySong={(song) => handlePlaySong(song, trendingSongs)}
      />

      {/* 7. New Releases Tracks Carousel */}
      <MediaCarousel
        title="New Release Tracks"
        subtitle="Freshly uploaded original tracks and singles"
        seeAllLink="/library?sort=releaseYear"
        type="song"
        items={newReleaseSongs}
        loading={loadingNewReleases}
        onPlaySong={(song) => handlePlaySong(song, newReleaseSongs)}
      />

      {/* 8. New Release Albums Carousel */}
      <MediaCarousel
        title="New Release Albums"
        subtitle="Recently published albums, EPs, and compilations"
        seeAllLink="/library"
        type="album"
        items={newReleaseAlbums}
        loading={loadingNewReleases}
      />

      {/* 9. Featured Artists Carousel */}
      <MediaCarousel
        title="Featured Artists"
        subtitle="Top verified performers and independent creators on HarmonyAI"
        seeAllLink="/library"
        type="artist"
        items={featuredArtists}
        loading={loadingArtists}
      />
    </div>
  );
};
