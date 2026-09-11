import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Sparkles as SparklesIcon, TrendingUp } from 'lucide-react';
import { fetchPersonalMusicTwinApi, type PersonalMusicTwin } from '../services/musicIntelligenceService';
import { ThreeErrorBoundary } from '../components/ThreeErrorBoundary';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { hasWebGL } from '../utils/webgl';
import { Meter } from '../components/ui/Meter';
import { AnimatedLink } from '../components/ui/AnimatedLink';
import { PageHero } from '../components/PageHero';

const MusicTwinOrganism = lazy(() =>
  import('../components/MusicTwinOrganism').then((m) => ({ default: m.MusicTwinOrganism }))
);

const formatName = (name: string): string => name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const MusicTwinPage: React.FC = () => {
  const [twin, setTwin] = useState<PersonalMusicTwin | null>(null);
  const [loading, setLoading] = useState(true);
  const reducedMotion = usePrefersReducedMotion();
  const [webglAvailable] = useState(() => hasWebGL());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { twin } = await fetchPersonalMusicTwinApi(8);
      setTwin(twin);
      setLoading(false);
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
          the more you listen. Keep playing music and check back soon.
        </p>
      </div>
    );
  }

  const distortIntensity = 0.2 + twin.explorationTendency * 0.5;
  const speed = 1 + twin.explorationTendency * 2;
  const sparkleCount = Math.round(twin.currentMusicalIdentity.rarityScore * 80) + 20;

  return (
    <div className="pb-16">
      <PageHero
        eyebrow="Meet your Music Twin"
        title={twin.currentMusicalIdentity.personaName}
        titleClassName="italic"
        description={twin.currentMusicalIdentity.tagline || undefined}
      />

      <div className="px-5 sm:px-8 lg:px-12 pt-8 grid lg:grid-cols-[1fr_320px] gap-8">
        <div className="relative aspect-[4/3] sm:aspect-[16/10] rounded-[var(--radius-lg)] bg-surface-1 overflow-hidden">
          {webglAvailable ? (
            <ThreeErrorBoundary fallback={<OrganismFallback />}>
              <Suspense fallback={<div className="w-full h-full animate-pulse bg-surface-2" />}>
                <MusicTwinOrganism
                  color="#ff6a43"
                  distortIntensity={distortIntensity}
                  speed={speed}
                  sparkleCount={sparkleCount}
                  reducedMotion={reducedMotion}
                />
              </Suspense>
            </ThreeErrorBoundary>
          ) : (
            <OrganismFallback />
          )}
        </div>

        <div className="bg-surface-1 rounded-[var(--radius-lg)] p-5">
          <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary">{twin.listenerArchetype}</p>
          <p className="text-sm text-text-secondary mt-2 leading-relaxed">{twin.archetypeDescription}</p>
          <div className="mt-4 pt-4 border-t border-border-subtle space-y-3">
            <Meter label="Confidence" value={twin.confidence} />
            <Meter label="Exploration" value={twin.explorationTendency} color="var(--gold)" />
            <Meter label="Familiarity" value={twin.familiarityPreference} color="var(--success)" />
            <Meter label="Taste stability" value={twin.tasteStability.stabilityScore} color="var(--danger)" />
          </div>
        </div>
      </div>

      {twin.currentMusicalIdentity.bio && (
        <div className="px-5 sm:px-8 lg:px-12 pt-8 max-w-2xl">
          <p className="font-display text-lg text-text-primary leading-relaxed">{twin.currentMusicalIdentity.bio}</p>
        </div>
      )}

      <div className="px-5 sm:px-8 lg:px-12 pt-8">
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

      {twin.emergingPreferences.narrative && (
        <div className="px-5 sm:px-8 lg:px-12 pt-10">
          <div className="border-l-2 border-gold pl-5 sm:pl-7 py-1 max-w-2xl">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <TrendingUp size={15} className="text-gold" strokeWidth={1.75} />
              Where your twin is headed
            </h3>
            <p className="text-sm text-text-secondary mt-2 leading-relaxed">{twin.emergingPreferences.narrative}</p>
            <AnimatedLink to="/taste-evolution" className="mt-4 text-sm font-medium text-gold hover:text-gold-strong">
              See your full taste evolution
            </AnimatedLink>
          </div>
        </div>
      )}
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
