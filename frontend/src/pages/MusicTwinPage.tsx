import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Sparkles as SparklesIcon, TrendingUp, Radio, Info, X, Orbit, Waves, Activity } from 'lucide-react';
import {
  fetchPersonalMusicTwinApi,
  fetchModeRecommendationsApi,
  type PersonalMusicTwin,
} from '../services/musicIntelligenceService';
import type { Song } from '../types/music';
import { ThreeErrorBoundary } from '../components/ThreeErrorBoundary';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { hasWebGL } from '../utils/webgl';
import { Meter } from '../components/ui/Meter';
import { AnimatedLink } from '../components/ui/AnimatedLink';
import { PageHero } from '../components/PageHero';
import { MediaCarousel } from '../components/MediaCarousel';
import { usePlayerStore } from '../store/usePlayerStore';

const MusicTwinOrganism = lazy(() =>
  import('../components/MusicTwinOrganism').then((m) => ({ default: m.MusicTwinOrganism }))
);

const formatName = (name: string): string => name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const MusicTwinPage: React.FC = () => {
  const [twin, setTwin] = useState<PersonalMusicTwin | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnatomy, setShowAnatomy] = useState(false);

  const [twinPicks, setTwinPicks] = useState<Song[]>([]);
  const [loadingTwinPicks, setLoadingTwinPicks] = useState(true);
  const [explorePicks, setExplorePicks] = useState<Song[]>([]);
  const [exploreNote, setExploreNote] = useState<string>('');
  const [loadingExplorePicks, setLoadingExplorePicks] = useState(true);

  const reducedMotion = usePrefersReducedMotion();
  const [webglAvailable] = useState(() => hasWebGL());

  const currentSong = usePlayerStore((state) => state.currentSong);
  const playSong = usePlayerStore((state) => state.playSong);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { twin } = await fetchPersonalMusicTwinApi(8);
      setTwin(twin);
      setLoading(false);
    })();

    (async () => {
      setLoadingTwinPicks(true);
      const res = await fetchModeRecommendationsApi('FOR_YOU', 12);
      setTwinPicks(res.songs);
      setLoadingTwinPicks(false);
    })();

    (async () => {
      setLoadingExplorePicks(true);
      const res = await fetchModeRecommendationsApi('DISCOVER', 12);
      setExplorePicks(res.songs);
      setExploreNote(res.description || '');
      setLoadingExplorePicks(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="px-5 sm:px-8 lg:px-12 py-10">
        <div className="h-8 w-64 bg-surface-1 rounded animate-pulse mb-4" />
        <div className="h-96 bg-surface-1 rounded-[var(--radius-lg)] animate-pulse" />
      </div>
    );
  }

  if (!twin || !twin.isDataSufficient) {
    return (
      <div className="px-5 sm:px-8 lg:px-12 py-16 max-w-xl">
        <SparklesIcon size={28} className="text-accent mb-4" strokeWidth={1.5} />
        <h1 className="font-display text-2xl text-text-primary">Your Music Twin hasn't formed yet</h1>
        <p className="text-sm text-text-secondary mt-3 leading-relaxed">
          Your Twin is a living reflection of your listening identity — an abstract entity that grows more defined
          the more you listen, and starts suggesting songs of its own once it knows you well enough. Keep playing
          music and check back soon.
        </p>
      </div>
    );
  }

  const distortIntensity = 0.2 + twin.explorationTendency * 0.55;
  const speed = 0.8 + twin.explorationTendency * 1.6;
  const sparkleCount = Math.round(twin.currentMusicalIdentity.rarityScore * 80) + 25;

  // Derive dynamic acoustic colors based on dominant vibe
  const primaryMood = twin.dominantMoods[0]?.mood?.toLowerCase() || '';
  const isEnergetic = primaryMood.includes('energy') || primaryMood.includes('hype') || primaryMood.includes('intense');
  const isChill = primaryMood.includes('chill') || primaryMood.includes('calm') || primaryMood.includes('ambient');
  const isDark = primaryMood.includes('dark') || primaryMood.includes('night') || primaryMood.includes('nocturnal');

  const organismColors = isChill
    ? { primary: '#3a86ff', secondary: '#00f5d4', core: '#7209b7' }
    : isDark
    ? { primary: '#9d4edd', secondary: '#ff007f', core: '#3a0ca3' }
    : isEnergetic
    ? { primary: '#ff3366', secondary: '#ffbe0b', core: '#fb5607' }
    : { primary: '#ff6a43', secondary: '#ffd166', core: '#ff2a5f' };

  const topGenreName = twin.dominantGenres[0]?.name;
  const topArtistName = twin.importantArtists[0];
  const twinPicksSubtitle =
    topGenreName && topArtistName
      ? `Curated from your ${formatName(topGenreName)} and ${formatName(topArtistName)} affinity`
      : 'Ranked from what your Twin already knows you love';

  return (
    <div className="pb-16">
      <PageHero
        eyebrow="Meet your Music Twin"
        title={twin.currentMusicalIdentity.personaName}
        titleClassName="italic"
        description={twin.currentMusicalIdentity.tagline || undefined}
      />

      <div className="px-5 sm:px-8 lg:px-12 pt-8 grid lg:grid-cols-[1fr_320px] gap-8">
        {/* 3D Living Organism Container with Interactive HUD */}
        <div className="relative aspect-[4/3] sm:aspect-[16/10] rounded-[var(--radius-lg)] bg-surface-1 border border-border-subtle overflow-hidden flex flex-col justify-between shadow-2xl">
          {/* Top HUD: Status, Persona, & Anatomy Toggle */}
          <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-2xs font-semibold uppercase tracking-wider text-text-secondary">
                Acoustic Organism
              </span>
              <span className="text-white/20">|</span>
              <span className="text-2xs font-medium text-text-primary">
                {twin.listenerArchetype}
              </span>
            </div>

            <button
              onClick={() => setShowAnatomy((prev) => !prev)}
              className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 text-xs text-text-primary hover:text-white transition-all shadow-md active:scale-95 cursor-pointer"
              title="Click to understand what each visual part means"
            >
              {showAnatomy ? <X size={14} /> : <Info size={14} className="text-accent" />}
              <span className="font-medium text-2xs uppercase tracking-wide">
                {showAnatomy ? 'Close Guide' : 'What is this?'}
              </span>
            </button>
          </div>

          {/* Interactive Anatomy Guide Modal Overlay */}
          {showAnatomy && (
            <div className="absolute inset-x-3 top-14 bottom-14 z-20 bg-black/85 backdrop-blur-xl rounded-[var(--radius-md)] border border-white/15 p-5 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Orbit size={18} className="text-accent" />
                  <h4 className="font-semibold text-sm text-text-primary">Anatomy of Your Music Twin</h4>
                </div>
                <button
                  onClick={() => setShowAnatomy(false)}
                  className="p-1 text-text-tertiary hover:text-white rounded-md transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 grid sm:grid-cols-2 gap-3.5 text-xs">
                <div className="bg-surface-2/60 border border-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-rose-400 font-semibold mb-1">
                    <Activity size={14} />
                    <span>Pulsing Nucleus (Core)</span>
                  </div>
                  <p className="text-text-secondary leading-relaxed">
                    The inner radiant heart represents your baseline acoustic center of gravity. Its pulse speed matches your natural rhythm preference ({Math.round(speed * 30 + 60)} BPM).
                  </p>
                </div>

                <div className="bg-surface-2/60 border border-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-accent font-semibold mb-1">
                    <Waves size={14} />
                    <span>Fluid Biomembrane (Distortion)</span>
                  </div>
                  <p className="text-text-secondary leading-relaxed">
                    The fluid organic outer layer constantly morphs based on your <strong>Exploration Tendency ({Math.round(twin.explorationTendency * 100)}%)</strong>. High exploration creates elastic, ever-shifting sonic forms.
                  </p>
                </div>

                <div className="bg-surface-2/60 border border-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold mb-1">
                    <Orbit size={14} />
                    <span>Harmonic Resonance Rings</span>
                  </div>
                  <p className="text-text-secondary leading-relaxed">
                    Dual orbital rings reflect your <strong>Taste Diversity ({Math.round((twin.diversityPreference || 0.6) * 100)}%)</strong> and structural taste stability ({twin.tasteStability.stabilityRating}).
                  </p>
                </div>

                <div className="bg-surface-2/60 border border-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                    <SparklesIcon size={14} />
                    <span>Satellites & Rarity Stardust</span>
                  </div>
                  <p className="text-text-secondary leading-relaxed">
                    Orbiting crystalline nodes represent your top genres gravitationally locked in orbit. Particle density scales with your <strong>Rarity Score ({Math.round(twin.currentMusicalIdentity.rarityScore * 100)}%)</strong>.
                  </p>
                </div>
              </div>

              <p className="text-2xs text-text-tertiary mt-4 text-center italic">
                Tip: Click and drag on the organism anytime to rotate and inspect it in 3D.
              </p>
            </div>
          )}

          {/* 3D WebGL Canvas */}
          <div className="w-full h-full">
            {webglAvailable ? (
              <ThreeErrorBoundary fallback={<OrganismFallback />}>
                <Suspense fallback={<div className="w-full h-full animate-pulse bg-surface-2" />}>
                  <MusicTwinOrganism
                    color={organismColors.primary}
                    secondaryColor={organismColors.secondary}
                    coreColor={organismColors.core}
                    distortIntensity={distortIntensity}
                    speed={speed}
                    sparkleCount={sparkleCount}
                    diversityFactor={twin.diversityPreference || 0.6}
                    reducedMotion={reducedMotion}
                  />
                </Suspense>
              </ThreeErrorBoundary>
            ) : (
              <OrganismFallback />
            )}
          </div>

          {/* Bottom Telemetry HUD Bar */}
          <div className="absolute bottom-3 inset-x-3 z-10 pointer-events-none flex items-center justify-between text-2xs text-text-tertiary">
            <div className="flex items-center gap-2 pointer-events-auto bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <span className="flex items-center gap-1 font-mono text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                Fluidity: <strong className="text-text-primary">{Math.round(twin.explorationTendency * 100)}%</strong>
              </span>
              <span className="text-white/20">•</span>
              <span className="flex items-center gap-1 font-mono text-text-secondary">
                Diversity: <strong className="text-text-primary">{Math.round((twin.diversityPreference || 0.6) * 100)}%</strong>
              </span>
              <span className="text-white/20">•</span>
              <span className="flex items-center gap-1 font-mono text-text-secondary">
                Rarity: <strong className="text-text-primary">{Math.round(twin.currentMusicalIdentity.rarityScore * 100)}%</strong>
              </span>
            </div>

            <span className="hidden sm:inline-block bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/5 text-2xs text-text-tertiary">
              Drag to rotate in 3D
            </span>
          </div>
        </div>

        <div className="bg-surface-1 rounded-[var(--radius-lg)] p-5">
          <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary">{twin.listenerArchetype}</p>
          <p className="text-sm text-text-secondary mt-2 leading-relaxed">{twin.archetypeDescription}</p>

          {twin.currentMusicalIdentity.signatureSound && (
            <div className="mt-4 pt-4 border-t border-border-subtle">
              <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-1.5">Signature sound</p>
              <p className="text-sm text-text-primary leading-relaxed">{twin.currentMusicalIdentity.signatureSound}</p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border-subtle space-y-3">
            <Meter label="Confidence" value={twin.confidence} />
            <Meter label="Exploration" value={twin.explorationTendency} color="var(--gold)" />
            <Meter label="Familiarity" value={twin.familiarityPreference} color="var(--success)" />
            <Meter label="Taste stability" value={twin.tasteStability.stabilityScore} color="var(--danger)" />
          </div>

          {twin.personalityTraits.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border-subtle">
              <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-2">Traits</p>
              <div className="flex flex-wrap gap-1.5">
                {twin.personalityTraits.slice(0, 6).map((t) => (
                  <span
                    key={t.id}
                    title={`${Math.round(t.confidence * 100)}% confidence`}
                    className="text-2xs font-medium px-2 py-1 rounded-[var(--radius-pill)] bg-surface-2 text-text-secondary"
                  >
                    {formatName(t.trait)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {twin.currentMusicalIdentity.bio && (
        <div className="px-5 sm:px-8 lg:px-12 pt-8 max-w-2xl">
          <p className="font-display text-lg text-text-primary leading-relaxed">{twin.currentMusicalIdentity.bio}</p>
        </div>
      )}

      {(loadingTwinPicks || twinPicks.length > 0) && (
        <div className="px-5 sm:px-8 lg:px-12 pt-10">
          <MediaCarousel
            title="Your Twin's Picks"
            subtitle={twinPicksSubtitle}
            type="song"
            items={twinPicks}
            loading={loadingTwinPicks}
            onPlaySong={(song) => playSong(song, twinPicks)}
            currentPlayingSongId={currentSong?._id}
            emptyMessage="Your Twin is still listening — picks will appear here soon."
          />
        </div>
      )}

      <div className="px-5 sm:px-8 lg:px-12 pt-10">
        <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-3">Vibe keywords</p>
        <div className="flex flex-wrap gap-2">
          {twin.currentMusicalIdentity.vibeKeywords.map((kw) => (
            <span key={kw} className="text-xs font-medium px-2.5 py-1 rounded-[var(--radius-pill)] bg-accent-wash text-accent">
              {kw}
            </span>
          ))}
        </div>
      </div>

      <div className="px-5 sm:px-8 lg:px-12 pt-10 grid sm:grid-cols-3 gap-8">
        <div>
          <h3 className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-3">Dominant genres</h3>
          <div className="space-y-1.5">
            {twin.dominantGenres.slice(0, 6).map((g) => (
              <div key={g.name} className="flex items-center justify-between">
                <p className="text-sm text-text-primary">{formatName(g.name)}</p>
                <span className="text-2xs font-mono text-text-tertiary tabular-nums">{Math.round(g.affinityScore * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-3">Important artists</h3>
          <div className="space-y-1.5">
            {twin.importantArtists.slice(0, 6).map((a) => (
              <p key={a} className="text-sm text-text-primary">{formatName(a)}</p>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-3">Dominant moods</h3>
          <div className="space-y-1.5">
            {twin.dominantMoods.slice(0, 6).map((m) => (
              <div key={m.mood} className="flex items-center justify-between">
                <p className="text-sm text-text-primary">{formatName(m.mood)}</p>
                <span className="text-2xs font-mono text-text-tertiary tabular-nums">{Math.round(m.affinityScore * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(twin.emergingPreferences.narrative || loadingExplorePicks || explorePicks.length > 0) && (
        <div className="px-5 sm:px-8 lg:px-12 pt-10">
          {twin.emergingPreferences.narrative && (
            <div className="border-l-2 border-gold pl-5 sm:pl-7 py-1 max-w-2xl mb-6">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <TrendingUp size={15} className="text-gold" strokeWidth={1.75} />
                Where your twin is headed
              </h3>
              <p className="text-sm text-text-secondary mt-2 leading-relaxed">{twin.emergingPreferences.narrative}</p>
              <AnimatedLink to="/taste-evolution" className="mt-4 text-sm font-medium text-gold hover:text-gold-strong">
                See your full taste evolution
              </AnimatedLink>
            </div>
          )}

          {(loadingExplorePicks || explorePicks.length > 0) && (
            <MediaCarousel
              title="Songs To Try Next"
              subtitle={exploreNote || 'Just outside your comfort zone, picked to stretch your taste'}
              type="song"
              items={explorePicks}
              loading={loadingExplorePicks}
              onPlaySong={(song) => playSong(song, explorePicks)}
              currentPlayingSongId={currentSong?._id}
              emptyMessage="Nothing to stretch your taste with yet — keep listening."
            />
          )}
        </div>
      )}

      <div className="px-5 sm:px-8 lg:px-12 pt-10">
        <div className="flex items-start gap-3 bg-surface-1 rounded-[var(--radius-lg)] p-4 max-w-2xl">
          <Radio size={16} className="text-text-tertiary mt-0.5 shrink-0" strokeWidth={1.75} />
          <p className="text-xs text-text-tertiary leading-relaxed">
            Your Twin updates as you listen — every play, skip, and like reshapes what it picks for you next.
          </p>
        </div>
      </div>
    </div>
  );
};

const OrganismFallback: React.FC = () => (
  <div className="w-full h-full flex items-center justify-center">
    <div
      className="w-40 h-40 rounded-full animate-pulse"
      style={{ background: 'radial-gradient(circle at 35% 35%, #ff8563, #ff6a43 60%, #c74f2e 100%)' }}
    />
  </div>
);
