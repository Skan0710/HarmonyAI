import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Fingerprint, RotateCcw } from 'lucide-react';
import { fetchMusicDnaProfileApi, type MusicDnaProfile, type TasteItem } from '../services/musicIntelligenceService';
import { ThreeErrorBoundary } from '../components/ThreeErrorBoundary';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { hasWebGL } from '../utils/webgl';
import type { DnaNode, DnaNodeCategory } from '../components/MusicDnaConstellation';

const MusicDnaConstellation = lazy(() =>
  import('../components/MusicDnaConstellation').then((m) => ({ default: m.MusicDnaConstellation }))
);

const formatName = (name: string): string => name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const Meter: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color = 'var(--accent)' }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <span className="text-xs font-mono text-text-tertiary tabular-nums">{Math.round(value * 100)}%</span>
    </div>
    <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  </div>
);

const TasteList: React.FC<{ title: string; items: TasteItem[]; color: string; onHover: (id: string | null) => void; onSelect: (id: string) => void; selectedId: string | null; category: DnaNodeCategory }> = ({
  title,
  items,
  color,
  onHover,
  onSelect,
  selectedId,
  category,
}) => (
  <div>
    <h3 className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-3">{title}</h3>
    <div className="space-y-2">
      {items.slice(0, 6).map((item) => {
        const id = `${category}-${item.name}`;
        const isSelected = selectedId === id;
        return (
          <button
            key={id}
            onMouseEnter={() => onHover(id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(id)}
            className={`w-full flex items-center gap-2.5 text-left py-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
              isSelected ? 'bg-surface-2' : 'hover:bg-surface-2'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-sm text-text-primary flex-1 truncate">{formatName(item.name)}</span>
            <span className="text-2xs font-mono text-text-tertiary tabular-nums">{Math.round(item.score * 100)}%</span>
          </button>
        );
      })}
    </div>
  </div>
);

export const MusicDnaPage: React.FC = () => {
  const [profile, setProfile] = useState<MusicDnaProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [webglAvailable] = useState(() => hasWebGL());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { profile } = await fetchMusicDnaProfileApi(10);
      setProfile(profile);
      setLoading(false);
    })();
  }, []);

  const nodes: DnaNode[] = useMemo(() => {
    if (!profile) return [];
    const genreNodes: DnaNode[] = (profile.topGenres || []).map((item) => ({ id: `genre-${item.name}`, category: 'genre', item }));
    const artistNodes: DnaNode[] = (profile.topArtists || []).map((item) => ({ id: `artist-${item.name}`, category: 'artist', item }));
    const moodNodes: DnaNode[] = (profile.preferredMoods || []).map((item) => ({ id: `mood-${item.name}`, category: 'mood', item }));
    return [...genreNodes, ...artistNodes, ...moodNodes];
  }, [profile]);

  const activeId = hoveredId || selectedId;
  const activeNode = nodes.find((n) => n.id === activeId) || null;

  if (loading) {
    return (
      <div className="px-5 sm:px-8 lg:px-12 py-10">
        <div className="h-8 w-64 bg-surface-1 rounded animate-pulse mb-4" />
        <div className="h-96 bg-surface-1 rounded-[var(--radius-lg)] animate-pulse" />
      </div>
    );
  }

  if (!profile || nodes.length === 0) {
    return (
      <div className="px-5 sm:px-8 lg:px-12 py-16 max-w-xl">
        <Fingerprint size={28} className="text-accent mb-4" strokeWidth={1.5} />
        <h1 className="font-display text-2xl text-text-primary">Your Music DNA is still forming</h1>
        <p className="text-sm text-text-secondary mt-3 leading-relaxed">
          Play, like, and skip a few tracks and HarmonyAI will start mapping the genres, artists, and moods that make
          up your sound — visualized here as a living constellation unique to you.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <section className="border-b border-border-subtle px-5 sm:px-8 lg:px-12 pt-10 pb-6">
        <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.14em]">Music DNA</p>
        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-text-primary leading-snug mt-3">
          {formatName(profile.listeningBehavior.listenerArchetype)}
        </h1>
        <p className="text-sm text-text-secondary mt-2 max-w-xl">
          {Math.round(profile.confidenceScore * 100)}% confidence, built from your listening history. Every point in
          the constellation below is a genre, artist, or mood — pulled closer to the core the more it defines your
          sound.
        </p>
      </section>

      <div className="px-5 sm:px-8 lg:px-12 pt-8 grid lg:grid-cols-[1fr_320px] gap-8">
        <div className="relative aspect-[4/3] sm:aspect-[16/10] rounded-[var(--radius-lg)] bg-surface-1 overflow-hidden">
          {webglAvailable ? (
            <ThreeErrorBoundary fallback={<FallbackList nodes={nodes} />}>
              <Suspense fallback={<div className="w-full h-full animate-pulse bg-surface-2" />}>
                <MusicDnaConstellation
                  nodes={nodes}
                  reducedMotion={reducedMotion}
                  hoveredId={hoveredId}
                  selectedId={selectedId}
                  onHover={setHoveredId}
                  onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
                />
              </Suspense>
            </ThreeErrorBoundary>
          ) : (
            <FallbackList nodes={nodes} />
          )}

          {selectedId && (
            <button
              onClick={() => setSelectedId(null)}
              className="absolute top-3 right-3 flex items-center gap-1.5 text-2xs font-medium px-2.5 py-1.5 rounded-[var(--radius-pill)] bg-surface-0/70 text-text-secondary hover:text-text-primary backdrop-blur-md transition-colors cursor-pointer"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          )}
        </div>

        {/* Detail panel */}
        <div className="bg-surface-1 rounded-[var(--radius-lg)] p-5">
          {activeNode ? (
            <div>
              <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary">{activeNode.category}</p>
              <h3 className="font-display text-xl text-text-primary mt-1.5">{formatName(activeNode.item.name)}</h3>
              <p className="text-sm text-text-secondary mt-3 leading-relaxed">{activeNode.item.explanation}</p>
              <div className="mt-4 pt-4 border-t border-border-subtle space-y-3">
                <Meter label="Affinity" value={activeNode.item.score} />
                <Meter label="Recent momentum" value={activeNode.item.shortTermScore} color="var(--gold)" />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary">Musical personality</p>
              <h3 className="font-display text-xl text-text-primary mt-1.5">
                {formatName(profile.listeningBehavior.listenerArchetype)}
              </h3>
              <p className="text-sm text-text-secondary mt-3 leading-relaxed">
                Hover or tap any point in the constellation to see why it belongs to your sound.
              </p>
              <div className="mt-4 pt-4 border-t border-border-subtle space-y-3">
                <Meter label="Exploration" value={profile.explorationTendency} />
                <Meter label="Familiarity" value={profile.familiarityPreference} color="var(--gold)" />
                <Meter label="Diversity" value={profile.diversityPreference} color="var(--success)" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 sm:px-8 lg:px-12 pt-10 grid sm:grid-cols-3 gap-8">
        <TasteList title="Top genres" items={profile.topGenres} color="#ff6a43" onHover={setHoveredId} onSelect={(id) => setSelectedId(id === selectedId ? null : id)} selectedId={activeId} category="genre" />
        <TasteList title="Top artists" items={profile.topArtists} color="#d9a15b" onHover={setHoveredId} onSelect={(id) => setSelectedId(id === selectedId ? null : id)} selectedId={activeId} category="artist" />
        <TasteList title="Preferred moods" items={profile.preferredMoods} color="#7ba98a" onHover={setHoveredId} onSelect={(id) => setSelectedId(id === selectedId ? null : id)} selectedId={activeId} category="mood" />
      </div>

      <div className="px-5 sm:px-8 lg:px-12 pt-10">
        <h3 className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-4">Listening behavior</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-5 max-w-3xl">
          <Meter label="Repeat listening" value={profile.listeningBehavior.repeatListeningTendency} />
          <Meter label="Skip tendency" value={profile.listeningBehavior.skipTendency} color="var(--danger)" />
          <Meter label="Session intensity" value={profile.listeningBehavior.sessionListeningIntensity} color="var(--gold)" />
          <Meter label="Preference stability" value={profile.listeningBehavior.preferenceStability} color="var(--success)" />
        </div>
      </div>
    </div>
  );
};

const FallbackList: React.FC<{ nodes: DnaNode[] }> = ({ nodes }) => (
  <div className="p-6 h-full overflow-y-auto">
    <p className="text-xs text-text-tertiary mb-4">3D view unavailable on this device — showing a ranked list instead.</p>
    <div className="space-y-1.5">
      {nodes
        .slice()
        .sort((a, b) => b.item.score - a.item.score)
        .map((n) => (
          <div key={n.id} className="flex items-center justify-between text-sm text-text-secondary">
            <span>{formatName(n.item.name)}</span>
            <span className="font-mono text-2xs text-text-tertiary">{Math.round(n.item.score * 100)}%</span>
          </div>
        ))}
    </div>
  </div>
);
