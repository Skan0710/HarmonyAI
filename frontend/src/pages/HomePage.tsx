import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Fingerprint, TrendingUp, Compass, Sparkles } from 'lucide-react';
import { AnimatedLink } from '../components/ui/AnimatedLink';
import StatsCounter from '../components/ui/stats-counter';
import { useAuth } from '../hooks/useAuth';
import type { Song } from '../types/music';
import { fetchTrendingSongsApi } from '../services/songService';
import { fetchRecentlyPlayedApi } from '../services/historyService';
import { fetchPersonalizedFeedApi } from '../services/personalizedFeedService';
import { fetchHybridRecommendationsApi } from '../services/recommendationService';
import {
  fetchMusicDnaEvolutionOverviewApi,
  fetchPersonalMusicTwinApi,
  fetchModeRecommendationsApi,
  type MusicDnaEvolutionOverview,
  type PersonalMusicTwin,
} from '../services/musicIntelligenceService';
import { MediaCarousel } from '../components/MediaCarousel';
import { SongRow } from '../components/SongRow';
import { usePlayerStore } from '../store/usePlayerStore';

const getTimeGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good evening';
};

const formatTasteName = (name: string): string =>
  name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const WaveformMark: React.FC = () => (
  <svg viewBox="0 0 240 48" className="w-full h-auto" aria-hidden="true">
    {Array.from({ length: 48 }).map((_, i) => {
      const heights = [10, 22, 14, 34, 18, 44, 26, 16, 30, 12, 38, 20];
      const h = heights[i % heights.length];
      return (
        <rect
          key={i}
          x={i * 5}
          y={(48 - h) / 2}
          width={2.4}
          height={h}
          rx={1.2}
          fill="currentColor"
          opacity={0.15 + (i % 5) * 0.06}
        />
      );
    })}
  </svg>
);

export const HomePage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const playSong = usePlayerStore((state) => state.playSong);

  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [madeForYou, setMadeForYou] = useState<Song[]>([]);
  const [trendingFallback, setTrendingFallback] = useState<Song[]>([]);
  const [continuationTracks, setContinuationTracks] = useState<Song[]>([]);
  const [comfortZoneSongs, setComfortZoneSongs] = useState<Song[]>([]);
  const [comfortZoneNote, setComfortZoneNote] = useState<string>('');
  const [evolution, setEvolution] = useState<MusicDnaEvolutionOverview | null>(null);
  const [twin, setTwin] = useState<PersonalMusicTwin | null>(null);

  const [loadingMadeForYou, setLoadingMadeForYou] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingComfortZone, setLoadingComfortZone] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;

    (async () => {
      setLoadingRecent(true);
      const res = await fetchRecentlyPlayedApi(6);
      setRecentlyPlayed(res.songs || []);
      setLoadingRecent(false);
    })();

    (async () => {
      setLoadingMadeForYou(true);
      const hybrid = await fetchHybridRecommendationsApi(10);
      if (hybrid.songs.length > 0) {
        setMadeForYou(hybrid.songs);
      } else {
        const trending = await fetchTrendingSongsApi(10);
        setTrendingFallback(trending.songs || []);
      }
      setLoadingMadeForYou(false);
    })();

    (async () => {
      const feed = await fetchPersonalizedFeedApi();
      setContinuationTracks(feed.feed?.favoriteGenreTracks?.slice(0, 5) || []);
    })();

    (async () => {
      const { overview } = await fetchMusicDnaEvolutionOverviewApi(6);
      setEvolution(overview);
    })();

    (async () => {
      const { twin } = await fetchPersonalMusicTwinApi(8);
      setTwin(twin);
    })();

    (async () => {
      setLoadingComfortZone(true);
      const res = await fetchModeRecommendationsApi('OUTSIDE_YOUR_TASTE', 8);
      setComfortZoneSongs(res.songs);
      setComfortZoneNote(res.description || '');
      setLoadingComfortZone(false);
    })();
  }, [isAuthenticated]);

  const currentDna = evolution?.currentMusicDna;
  const topGenreName = currentDna?.topGenres?.[0]?.name;
  const archetype = currentDna?.listenerArchetype;

  const heroLine = archetype && topGenreName
    ? `Your sound right now leans ${formatTasteName(archetype)}, anchored in ${formatTasteName(topGenreName)}.`
    : "Play a few tracks and I'll start learning what your sound actually is.";

  const madeForYouSongs = madeForYou.length > 0 ? madeForYou : trendingFallback;
  const madeForYouSubtitle =
    madeForYou.length > 0
      ? 'Ranked from your acoustic taste, community signal, and recency'
      : 'Trending across HarmonyAI while we learn your taste';

  return (
    <div className="pb-16">
      {/* Hero — personalized statement, not a marketing banner */}
      <section className="relative overflow-hidden border-b border-border-subtle px-5 sm:px-8 lg:px-12 pt-10 pb-6">
        <div className="relative max-w-2xl">
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.14em]">
            {getTimeGreeting()}, {user?.name?.split(' ')[0] || 'there'}
          </p>
          <motion.h1
            key={heroLine}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-2xl sm:text-3xl lg:text-4xl text-text-primary leading-snug mt-3"
          >
            {heroLine}
          </motion.h1>
          {archetype && (
            <AnimatedLink to="/music-dna" className="mt-5 text-sm font-medium text-accent hover:text-accent-strong">
              <Fingerprint size={15} strokeWidth={1.75} />
              See your full Music DNA
            </AnimatedLink>
          )}
        </div>
        <div className="relative h-10 mt-8 -mx-5 sm:-mx-8 lg:-mx-12 text-accent pointer-events-none">
          <WaveformMark />
        </div>
      </section>

      <div className="px-5 sm:px-8 lg:px-12 pt-9 space-y-11">
        {/* Made For You */}
        <MediaCarousel
          title="Made for you"
          subtitle={madeForYouSubtitle}
          seeAllLink="/library"
          type="song"
          items={madeForYouSongs}
          loading={loadingMadeForYou}
          onPlaySong={(song) => playSong(song, madeForYouSongs)}
        />

        {/* Because you've been listening to... */}
        {(recentlyPlayed.length > 0 || continuationTracks.length > 0 || loadingRecent) && (
          <section className="grid md:grid-cols-2 gap-x-10 gap-y-6">
            <div>
              <h2 className="text-lg font-semibold text-text-primary font-body flex items-center gap-2">
                <TrendingUp size={16} className="text-accent" strokeWidth={1.75} />
                Because you've been listening
              </h2>
              <p className="text-xs text-text-tertiary mt-0.5 mb-3">Pick up right where you left off</p>
              <div className="divide-y divide-border-subtle">
                {loadingRecent
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3.5 py-2.5 animate-pulse">
                        <div className="w-10 h-10 rounded-[var(--radius-artwork)] bg-surface-2 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 bg-surface-2 rounded w-1/2" />
                          <div className="h-2.5 bg-surface-2 rounded w-1/3" />
                        </div>
                      </div>
                    ))
                  : recentlyPlayed
                      .slice(0, 5)
                      .map((song, i) => (
                        <SongRow key={song._id} song={song} index={i} onPlay={() => playSong(song, recentlyPlayed)} />
                      ))}
                {!loadingRecent && recentlyPlayed.length === 0 && (
                  <p className="text-xs text-text-tertiary py-4">Nothing played yet this week.</p>
                )}
              </div>
            </div>

            {continuationTracks.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-text-primary font-body">More in that vein</h2>
                <p className="text-xs text-text-tertiary mt-0.5 mb-3">From the genres you keep returning to</p>
                <div className="divide-y divide-border-subtle">
                  {continuationTracks.map((song, i) => (
                    <SongRow key={song._id} song={song} index={i} onPlay={() => playSong(song, continuationTracks)} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Your taste is changing — narrative panel, deliberately not a card grid */}
        {evolution?.isDataSufficient && (
          <section className="border-l-2 border-gold pl-5 sm:pl-7 py-1">
            <h2 className="text-lg font-semibold text-text-primary font-body flex items-center gap-2">
              <Sparkles size={16} className="text-gold" strokeWidth={1.75} />
              Your taste is changing
            </h2>
            <p className="font-display text-lg sm:text-xl text-text-primary leading-relaxed mt-3 max-w-2xl">
              {evolution.recentChanges.summary}
            </p>
            {evolution.emergingTastes.hasEmergingPreferences && (
              <p className="text-sm text-text-secondary mt-3 max-w-2xl">{evolution.emergingTastes.summary}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {evolution.emergingTastes.emergingGenres.slice(0, 5).map((g) => (
                <span key={g.name} className="text-xs font-medium px-2.5 py-1 rounded-[var(--radius-pill)] bg-gold-wash text-gold">
                  {formatTasteName(g.name)}
                </span>
              ))}
            </div>
            <AnimatedLink to="/taste-evolution" className="mt-5 text-sm font-medium text-gold hover:text-gold-strong">
              Explore your full evolution timeline
            </AnimatedLink>
          </section>
        )}

        {/* Outside your comfort zone */}
        {(comfortZoneSongs.length > 0 || loadingComfortZone) && (
          <MediaCarousel
            title="Outside your comfort zone"
            subtitle={comfortZoneNote || 'A deliberate step past what you usually play'}
            seeAllLink="/discover"
            type="song"
            items={comfortZoneSongs}
            loading={loadingComfortZone}
            onPlaySong={(song) => playSong(song, comfortZoneSongs)}
          />
        )}

        {/* Your Music Twin today — identity panel, not a song grid */}
        {twin?.isDataSufficient && (
          <section className="bg-surface-1 rounded-[var(--radius-lg)] p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-accent uppercase tracking-[0.12em] flex items-center gap-1.5">
                  <Compass size={13} strokeWidth={1.75} />
                  Your Music Twin today
                </p>
                <h2 className="font-display italic text-2xl sm:text-3xl text-text-primary mt-2">
                  {twin.currentMusicalIdentity.personaName}
                </h2>
                {twin.currentMusicalIdentity.tagline && (
                  <p className="text-sm text-text-secondary mt-1.5 max-w-xl">{twin.currentMusicalIdentity.tagline}</p>
                )}
              </div>
              <AnimatedLink to="/music-twin" className="text-sm font-medium text-accent hover:text-accent-strong shrink-0">
                Meet your twin
              </AnimatedLink>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-5">
              {twin.currentMusicalIdentity.vibeKeywords.slice(0, 6).map((kw) => (
                <span key={kw} className="text-xs font-medium px-2.5 py-1 rounded-[var(--radius-pill)] bg-surface-2 text-text-secondary">
                  {kw}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6 max-w-md">
              <div>
                <p className="text-2xl font-display text-text-primary">
                  <StatsCounter value={Math.round(twin.confidence * 100)} suffix="%" />
                </p>
                <p className="text-2xs text-text-tertiary mt-0.5">Confidence</p>
              </div>
              <div>
                <p className="text-2xl font-display text-text-primary">
                  <StatsCounter value={Math.round(twin.explorationTendency * 100)} suffix="%" />
                </p>
                <p className="text-2xs text-text-tertiary mt-0.5">Exploration</p>
              </div>
              <div>
                <p className="text-2xl font-display text-text-primary">
                  <StatsCounter value={Math.round(twin.tasteStability.stabilityScore * 100)} suffix="%" />
                </p>
                <p className="text-2xs text-text-tertiary mt-0.5">Stability</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
