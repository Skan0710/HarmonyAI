import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { History, TrendingUp, TrendingDown, Sparkles, Orbit, Fingerprint, ListMusic } from 'lucide-react';
import { fetchMusicDnaEvolutionOverviewApi, type MusicDnaEvolutionOverview } from '../services/musicIntelligenceService';
import { Meter } from '../components/ui/Meter';
import { PageHero } from '../components/PageHero';
import { ThreeErrorBoundary } from '../components/ThreeErrorBoundary';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { hasWebGL } from '../utils/webgl';

const GenreGalaxy = lazy(() => import('../components/GenreGalaxy').then((m) => ({ default: m.GenreGalaxy })));

const formatName = (name: string): string => name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatDate = (value: string | Date): string => {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(value));
  } catch {
    return '';
  }
};

const EVENT_TONE: Record<string, string> = {
  GENRE_STRENGTHENED: '#ff6a43',
  NEW_ARTIST_EMERGED: '#ff6a43',
  EXPLORATION_INCREASED: '#d9a15b',
  FAMILIARITY_INCREASED: '#7ba98a',
  GENRE_WEAKENED: '#e2685a',
  OLD_PREFERENCE_FADED: '#e2685a',
  EXPLORATION_DECREASED: '#e2685a',
  FAMILIARITY_DECREASED: '#e2685a',
};

interface TimelineEventLike {
  id: string;
  timestamp: string;
  headline: string;
  description: string;
  eventType: string;
  significance: number;
}

const GalaxyFallback: React.FC<{ genres: { name: string; score: number }[] }> = ({ genres }) => {
  const max = Math.max(...genres.map((g) => g.score), 0.0001);
  return (
    <div className="w-full h-full flex flex-wrap items-center justify-center gap-4 p-6">
      <div className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center font-bold text-sm shadow-lg tracking-wider border-2 border-white/40">
        YOU
      </div>
      {genres.slice(0, 7).map((g, i) => (
        <span
          key={g.name}
          className="rounded-full font-bold flex items-center justify-center text-center px-3 shadow-md"
          style={{
            width: `${72 + (g.score / max) * 56}px`,
            height: `${72 + (g.score / max) * 56}px`,
            background: i === 0 ? 'var(--accent)' : 'var(--surface-2)',
            color: i === 0 ? 'var(--text-on-accent)' : 'var(--text-primary)',
            fontSize: i === 0 ? 15 : 13,
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          {formatName(g.name)}
        </span>
      ))}
    </div>
  );
};

export const TasteEvolutionPage: React.FC = () => {
  const [overview, setOverview] = useState<MusicDnaEvolutionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const reducedMotion = usePrefersReducedMotion();
  const [webglAvailable] = useState(() => hasWebGL());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { overview } = await fetchMusicDnaEvolutionOverviewApi(20);
      setOverview(overview);
      setLoading(false);
    })();
  }, []);

  const events = useMemo(
    () => (overview?.evolutionTimeline.events || []) as unknown as TimelineEventLike[],
    [overview]
  );
  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[events.length - 1] || null;

  const topGenres = overview?.currentMusicDna.topGenres || [];
  const topGenre = topGenres[0];
  const secondGenre = topGenres[1];

  const playlistPrompt = topGenre
    ? secondGenre
      ? `A mix inspired by my ${formatName(topGenre.name)} and ${formatName(secondGenre.name)} taste evolution`
      : `A mix inspired by my ${formatName(topGenre.name)} taste evolution`
    : 'A mix inspired by how my music taste has evolved';

  if (loading) {
    return (
      <div className="px-5 sm:px-8 lg:px-12 py-10">
        <div className="h-9 w-72 bg-surface-1 rounded animate-pulse mb-4" />
        <div className="h-64 bg-surface-1 rounded-[var(--radius-lg)] animate-pulse" />
      </div>
    );
  }

  if (!overview || !overview.isDataSufficient) {
    return (
      <div className="px-5 sm:px-8 lg:px-12 py-16 max-w-2xl">
        <History size={32} className="text-gold mb-5" strokeWidth={1.5} />
        <h1 className="font-display text-3xl text-text-primary leading-snug">Your evolution timeline is still being written</h1>
        <p className="text-base text-text-secondary mt-4 leading-relaxed">
          HarmonyAI compares snapshots of your taste over time to trace how it shifts — the genres you're leaning
          into, the ones fading out, and the moments your sound changed direction. Keep listening across multiple
          sessions and this page fills in with the full story.
        </p>
        <Link
          to="/music-twin"
          className="inline-flex items-center gap-2 mt-6 px-5 py-3 bg-accent hover:bg-accent-strong text-text-on-accent font-semibold text-sm rounded-[var(--radius-pill)] transition-colors"
        >
          <Fingerprint size={16} />
          Meet your Music Twin instead
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <PageHero eyebrow="Taste evolution" title={overview.recentChanges.summary} maxWidth="max-w-3xl">
        <div className="grid sm:grid-cols-3 gap-8 mt-9">
          <Meter label="Stability" value={overview.stabilityMetrics.tasteStabilityScore} color="var(--success)" size="lg" />
          <Meter label="Volatility" value={overview.stabilityMetrics.tasteVolatilityScore} color="var(--danger)" size="lg" />
          <Meter label="Discovery tendency" value={overview.stabilityMetrics.discoveryTendencyScore} color="var(--gold)" size="lg" />
        </div>
        <p className="text-base text-text-secondary mt-6 leading-relaxed max-w-2xl">{overview.stabilityMetrics.explanation}</p>
      </PageHero>

      {/* 3D Genre Galaxy — the visual center of gravity for the page */}
      <div className="px-5 sm:px-8 lg:px-12 pt-10">
        <div className="flex items-baseline justify-between gap-4 mb-5">
          <h2 className="text-xl font-semibold text-text-primary font-body">Your genre galaxy</h2>
          {topGenre && (
            <p className="text-sm text-text-tertiary">
              <span className="text-accent font-semibold">{formatName(topGenre.name)}</span> is what you've been
              orbiting the most
            </p>
          )}
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-6">
          <div className="relative aspect-[16/10] rounded-[var(--radius-lg)] bg-surface-1 border border-border-subtle overflow-hidden shadow-2xl">
            {webglAvailable ? (
              <ThreeErrorBoundary fallback={<GalaxyFallback genres={topGenres} />}>
                <Suspense fallback={<div className="w-full h-full animate-pulse bg-surface-2" />}>
                  <GenreGalaxy genres={topGenres} reducedMotion={reducedMotion} />
                </Suspense>
              </ThreeErrorBoundary>
            ) : (
              <GalaxyFallback genres={topGenres} />
            )}
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 pointer-events-none">
              <Orbit size={13} className="text-accent" />
              <span className="text-2xs font-semibold uppercase tracking-wider text-text-secondary">
                Orbit size = how much you listen
              </span>
            </div>
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-5 space-y-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">Genre breakdown</p>
            {topGenres.slice(0, 7).map((g, i) => (
              <div key={g.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-base font-medium ${i === 0 ? 'text-accent font-bold' : 'text-text-primary'}`}>
                    {formatName(g.name)}
                  </span>
                  <span className="text-sm font-mono text-text-secondary font-bold">{Math.round(g.score * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round(g.score * 100)}%`, background: i === 0 ? 'var(--accent)' : 'var(--gold)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {events.length > 0 && (
        <div className="px-5 sm:px-8 lg:px-12 pt-14">
          <h2 className="text-2xl font-bold text-text-primary font-display mb-6">How you got here</h2>

          <div className="relative">
            <div className="absolute left-0 right-0 top-2.5 h-px bg-border-default" />
            <div className="flex gap-8 overflow-x-auto pb-4 -mx-1 px-1">
              {events.map((event) => {
                const isSelected = selectedEvent?.id === event.id;
                const color = EVENT_TONE[event.eventType] || '#ff6a43';
                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className="relative flex flex-col items-start gap-3 shrink-0 w-48 cursor-pointer group text-left"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full transition-transform"
                      style={{ background: color, transform: isSelected ? 'scale(1.5)' : 'scale(1)' }}
                    />
                    <span className="text-sm font-mono font-medium text-text-tertiary">{formatDate(event.timestamp)}</span>
                    <span className={`text-base font-semibold leading-snug ${isSelected ? 'text-text-primary' : 'text-text-tertiary group-hover:text-text-secondary'}`}>
                      {event.headline}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {selectedEvent && (
              <motion.div
                key={selectedEvent.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-surface-1 rounded-[var(--radius-md)] p-6 mt-6 max-w-2xl border border-border-subtle"
              >
                <p className="text-lg text-text-primary leading-relaxed">{selectedEvent.description}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="px-5 sm:px-8 lg:px-12 pt-14 grid sm:grid-cols-2 gap-10">
        <div>
          <h3 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-gold" strokeWidth={2} />
            Emerging
          </h3>
          {overview.emergingTastes.hasEmergingPreferences ? (
            <div className="flex flex-wrap gap-2.5">
              {[...overview.emergingTastes.emergingGenres, ...overview.emergingTastes.emergingArtists].slice(0, 10).map((item) => (
                <span key={item.name} className="text-base font-semibold px-4 py-2 rounded-[var(--radius-pill)] bg-gold-wash text-gold">
                  {formatName(item.name)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-base text-text-tertiary">Nothing new emerging yet.</p>
          )}
        </div>

        <div>
          <h3 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-4">
            <TrendingDown size={20} className="text-danger" strokeWidth={2} />
            Fading
          </h3>
          {overview.fadingPreferences.fadingGenres.length > 0 || overview.fadingPreferences.fadingArtists.length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {[...overview.fadingPreferences.fadingGenres, ...overview.fadingPreferences.fadingArtists].slice(0, 10).map((name) => (
                <span key={name} className="text-base font-semibold px-4 py-2 rounded-[var(--radius-pill)] bg-danger-wash text-danger">
                  {formatName(name)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-base text-text-tertiary">Nothing fading — your taste is holding steady.</p>
          )}
        </div>
      </div>

      {overview.evolutionTimeline.milestones && overview.evolutionTimeline.milestones.length > 0 && (
        <div className="px-5 sm:px-8 lg:px-12 pt-14">
          <h3 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-4">
            <Sparkles size={20} className="text-accent" strokeWidth={2} />
            Milestones
          </h3>
          <div className="space-y-3 max-w-2xl">
            {overview.evolutionTimeline.milestones.map((m: any, i: number) => (
              <p key={i} className="text-lg text-text-secondary leading-relaxed">
                {typeof m === 'string' ? m : m.description || m.headline}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* CTAs — turn the story into an action instead of leaving the page a dead end */}
      <div className="px-5 sm:px-8 lg:px-12 pt-16">
        <div className="grid sm:grid-cols-2 gap-6">
          <Link
            to="/music-twin"
            className="group relative overflow-hidden bg-surface-1 border border-border-subtle hover:border-accent/40 rounded-[var(--radius-lg)] p-7 transition-colors"
          >
            <Fingerprint size={26} className="text-accent mb-4" strokeWidth={1.75} />
            <h4 className="text-xl font-bold text-text-primary mb-2">See the fuller picture on Music Twin</h4>
            <p className="text-base text-text-secondary leading-relaxed">
              Your Twin turns this evolution into a living persona and picks songs based on where your taste is
              heading next.
            </p>
            <span className="inline-block mt-5 text-base font-bold text-accent group-hover:translate-x-0.5 transition-transform">
              Meet your Twin →
            </span>
          </Link>

          <Link
            to={`/ai-playlist?prompt=${encodeURIComponent(playlistPrompt)}${topGenre ? `&genre=${encodeURIComponent(formatName(topGenre.name))}` : ''}&auto=1`}
            className="group relative overflow-hidden bg-surface-1 border border-border-subtle hover:border-gold/40 rounded-[var(--radius-lg)] p-7 transition-colors"
          >
            <ListMusic size={26} className="text-gold mb-4" strokeWidth={1.75} />
            <h4 className="text-xl font-bold text-text-primary mb-2">Turn this into a playlist</h4>
            <p className="text-base text-text-secondary leading-relaxed">
              Generate a mix built around where your taste is right now{topGenre ? ` — leaning into ${formatName(topGenre.name)}` : ''}.
            </p>
            <span className="inline-block mt-5 text-base font-bold text-gold group-hover:translate-x-0.5 transition-transform">
              Generate playlist →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
};
