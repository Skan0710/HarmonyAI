import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { fetchMusicDnaEvolutionOverviewApi, type MusicDnaEvolutionOverview } from '../services/musicIntelligenceService';
import { Meter } from '../components/ui/Meter';

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

export const TasteEvolutionPage: React.FC = () => {
  const [overview, setOverview] = useState<MusicDnaEvolutionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="px-5 sm:px-8 lg:px-12 py-10">
        <div className="h-8 w-64 bg-surface-1 rounded animate-pulse mb-4" />
        <div className="h-48 bg-surface-1 rounded-[var(--radius-lg)] animate-pulse" />
      </div>
    );
  }

  if (!overview || !overview.isDataSufficient) {
    return (
      <div className="px-5 sm:px-8 lg:px-12 py-16 max-w-xl">
        <History size={28} className="text-gold mb-4" strokeWidth={1.5} />
        <h1 className="font-display text-2xl text-text-primary">Your evolution timeline is still being written</h1>
        <p className="text-sm text-text-secondary mt-3 leading-relaxed">
          HarmonyAI compares snapshots of your taste over time to trace how it shifts. Keep listening across
          multiple sessions and this page will fill in with the story of how your sound has changed.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <section className="border-b border-border-subtle px-5 sm:px-8 lg:px-12 pt-10 pb-8">
        <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.14em]">Taste evolution</p>
        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-text-primary leading-snug mt-3 max-w-2xl">
          {overview.recentChanges.summary}
        </h1>

        <div className="grid sm:grid-cols-3 gap-6 max-w-xl mt-8">
          <Meter label="Stability" value={overview.stabilityMetrics.tasteStabilityScore} color="var(--success)" />
          <Meter label="Volatility" value={overview.stabilityMetrics.tasteVolatilityScore} color="var(--danger)" />
          <Meter label="Discovery tendency" value={overview.stabilityMetrics.discoveryTendencyScore} color="var(--gold)" />
        </div>
        <p className="text-sm text-text-secondary mt-5 max-w-xl">{overview.stabilityMetrics.explanation}</p>
      </section>

      {events.length > 0 && (
        <div className="px-5 sm:px-8 lg:px-12 pt-9">
          <h2 className="text-lg font-semibold text-text-primary font-body mb-5">How you got here</h2>

          <div className="relative">
            <div className="absolute left-0 right-0 top-2 h-px bg-border-default" />
            <div className="flex gap-6 overflow-x-auto pb-3 -mx-1 px-1">
              {events.map((event) => {
                const isSelected = selectedEvent?.id === event.id;
                const color = EVENT_TONE[event.eventType] || '#ff6a43';
                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className="relative flex flex-col items-start gap-2.5 shrink-0 w-40 cursor-pointer group text-left"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full transition-transform"
                      style={{ background: color, transform: isSelected ? 'scale(1.5)' : 'scale(1)' }}
                    />
                    <span className="text-2xs font-mono text-text-tertiary">{formatDate(event.timestamp)}</span>
                    <span className={`text-xs font-medium leading-snug ${isSelected ? 'text-text-primary' : 'text-text-tertiary group-hover:text-text-secondary'}`}>
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
                className="bg-surface-1 rounded-[var(--radius-md)] p-5 mt-4 max-w-xl"
              >
                <p className="text-sm text-text-primary leading-relaxed">{selectedEvent.description}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="px-5 sm:px-8 lg:px-12 pt-11 grid sm:grid-cols-2 gap-10">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-gold" strokeWidth={1.75} />
            Emerging
          </h3>
          {overview.emergingTastes.hasEmergingPreferences ? (
            <div className="flex flex-wrap gap-2">
              {[...overview.emergingTastes.emergingGenres, ...overview.emergingTastes.emergingArtists].slice(0, 10).map((item) => (
                <span key={item.name} className="text-xs font-medium px-2.5 py-1 rounded-[var(--radius-pill)] bg-gold-wash text-gold">
                  {formatName(item.name)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">Nothing new emerging yet.</p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
            <TrendingDown size={15} className="text-danger" strokeWidth={1.75} />
            Fading
          </h3>
          {overview.fadingPreferences.fadingGenres.length > 0 || overview.fadingPreferences.fadingArtists.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {[...overview.fadingPreferences.fadingGenres, ...overview.fadingPreferences.fadingArtists].slice(0, 10).map((name) => (
                <span key={name} className="text-xs font-medium px-2.5 py-1 rounded-[var(--radius-pill)] bg-danger-wash text-danger">
                  {formatName(name)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">Nothing fading — your taste is holding steady.</p>
          )}
        </div>
      </div>

      {overview.evolutionTimeline.milestones && overview.evolutionTimeline.milestones.length > 0 && (
        <div className="px-5 sm:px-8 lg:px-12 pt-11">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
            <Sparkles size={15} className="text-accent" strokeWidth={1.75} />
            Milestones
          </h3>
          <div className="space-y-2 max-w-xl">
            {overview.evolutionTimeline.milestones.map((m: any, i: number) => (
              <p key={i} className="text-sm text-text-secondary">
                {typeof m === 'string' ? m : m.description || m.headline}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
