import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fingerprint, Clock3, Sparkles, TrendingUp } from 'lucide-react';
import type { Song } from '../types/music';
import {
  fetchDiscoveryModesApi,
  fetchModeRecommendationsApi,
  type DiscoveryModeConfig,
} from '../services/musicIntelligenceService';
import { DiscoveryDial } from '../components/DiscoveryDial';
import { MediaCarousel } from '../components/MediaCarousel';
import { MoodActivityDiscoverySection } from '../components/MoodActivityDiscoverySection';
import { usePlayerStore } from '../store/usePlayerStore';

const SIGNAL_BY_STRATEGY: Record<string, { icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; label: string }[]> = {
  STANDARD: [
    { icon: Fingerprint, label: 'Music DNA' },
    { icon: Clock3, label: 'Recent taste' },
  ],
  OUTSIDE_COMFORT_ZONE: [
    { icon: Sparkles, label: 'Discovery preference' },
    { icon: Fingerprint, label: 'Music DNA boundaries' },
  ],
  TASTE_EVOLUTION_DISCOVERY: [
    { icon: TrendingUp, label: 'Taste evolution' },
    { icon: Sparkles, label: 'Emerging interests' },
  ],
};

export const DiscoverPage: React.FC = () => {
  const playSong = usePlayerStore((state) => state.playSong);

  const [modes, setModes] = useState<Record<string, DiscoveryModeConfig>>({});
  const [selectedMode, setSelectedMode] = useState<string>('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [activeMode, setActiveMode] = useState<DiscoveryModeConfig | null>(null);
  const [loadingModes, setLoadingModes] = useState(true);
  const [loadingSongs, setLoadingSongs] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingModes(true);
      const { modes: fetched } = await fetchDiscoveryModesApi();
      setModes(fetched);
      const initial = fetched['FOR_YOU'] ? 'FOR_YOU' : Object.keys(fetched)[0];
      if (initial) setSelectedMode(initial);
      setLoadingModes(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedMode) return;
    (async () => {
      setLoadingSongs(true);
      const res = await fetchModeRecommendationsApi(selectedMode, 12);
      setSongs(res.songs);
      setActiveMode({
        mode: selectedMode as DiscoveryModeConfig['mode'],
        label: res.label || modes[selectedMode]?.label || selectedMode,
        description: res.description || modes[selectedMode]?.description || '',
        strategyType: modes[selectedMode]?.strategyType || 'STANDARD',
        explorationRate: modes[selectedMode]?.explorationRate ?? 0.5,
      });
      setLoadingSongs(false);
    })();
  }, [selectedMode, modes]);

  const signals = activeMode ? SIGNAL_BY_STRATEGY[activeMode.strategyType] || SIGNAL_BY_STRATEGY.STANDARD : [];

  return (
    <div className="pb-16">
      <section className="border-b border-border-subtle px-5 sm:px-8 lg:px-12 pt-10 pb-8">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.14em]">Discover</p>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-text-primary leading-snug mt-3">
            Where should your music take you?
          </h1>
        </div>

        <div className="max-w-xl mt-8">
          {!loadingModes && Object.keys(modes).length > 0 && (
            <DiscoveryDial modes={modes} selected={selectedMode} onSelect={setSelectedMode} />
          )}
        </div>

        <AnimatePresence mode="wait">
          {activeMode && (
            <motion.div
              key={activeMode.mode}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-6 max-w-xl"
            >
              <p className="text-sm text-text-secondary leading-relaxed">{activeMode.description}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {signals.map((s) => (
                  <span
                    key={s.label}
                    className="inline-flex items-center gap-1.5 text-2xs font-medium px-2.5 py-1 rounded-[var(--radius-pill)] bg-accent-wash text-accent"
                  >
                    <s.icon size={11} strokeWidth={1.75} />
                    {s.label}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="px-5 sm:px-8 lg:px-12 pt-9 space-y-11">
        <MediaCarousel
          title={activeMode?.label || 'Recommendations'}
          type="song"
          items={songs}
          loading={loadingSongs}
          onPlaySong={(song) => playSong(song, songs)}
          emptyMessage="No picks yet for this mode — keep listening and check back."
        />

        <MoodActivityDiscoverySection onPlaySong={(song, queue) => playSong(song, queue)} />
      </div>
    </div>
  );
};
