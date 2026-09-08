import { Types } from 'mongoose';
import {
  TasteBoundaryConfig,
  getTasteBoundaryConfig,
} from '../config/tasteBoundaryConfig.js';
import { UnifiedMusicDNAService } from './unifiedMusicDnaService.js';
import { PersonalMusicTwinService } from './personalMusicTwinService.js';
import { LayeredTemporalTasteProfileService } from './layeredTemporalTasteProfileService.js';
import { RecommendationScoreCalibrationService } from './recommendationScoreCalibrationService.js';
import { UnifiedMusicDNA } from '../schemas/musicDnaSchema.js';
import { PersonalMusicTwinAttributes } from '../schemas/personalMusicTwinSchema.js';

export type TasteBoundaryBreadth = 'NARROW' | 'MODERATE' | 'WIDE' | 'EXPANSIVE';
export type DiscoveryStrategy = 'DEEP_DIVE' | 'ADJACENT_EXPANSION' | 'FRONTIER_EXPLORATION' | 'ESTABLISH_BASELINE';

export interface TasteBoundaryItem {
  name: string;
  type: 'genre' | 'artist';
  affinityScore: number;       // [0.0, 1.0]
  proximityScore: number;      // [0.0, 1.0] (1.0 = identical to core, 0.75-0.85 = adjacent, 0.5-0.6 = frontier)
  discoveryPotential: number;  // [0.0, 1.0] (novelty/freshness relative to core)
  relation: string;            // e.g. "Direct sister subgenre to Synthwave"
  anchor?: string;             // anchor core preference, e.g. "Synthwave"
  category?: string;           // e.g. "Electronic", "Rock"
  confidenceScore: number;     // [0.0, 1.0]
  rationale: string;
}

export interface TasteBoundaryProfile {
  userId: string;
  boundaryBreadth: TasteBoundaryBreadth;
  boundaryBreadthScore: number; // [0.0, 1.0]
  confidenceScore: number;
  isDataSufficient: boolean;

  // The 6 Key Boundary Dimensions
  stronglyPreferredAreas: TasteBoundaryItem[];
  adjacentGenres: TasteBoundaryItem[];
  adjacentArtists: TasteBoundaryItem[];
  familiarUnderexploredAreas: TasteBoundaryItem[];
  potentiallyInterestingAreas: TasteBoundaryItem[];
  lowConfidenceAreas: TasteBoundaryItem[];

  summary: {
    coreAnchorDescription: string;
    boundaryHorizonDescription: string;
    recommendedDiscoveryStrategy: DiscoveryStrategy;
    rationales: string[];
  };
  lastEvaluatedAt: Date;
}

export interface TasteBoundaryInputs {
  userId: string | Types.ObjectId;
  musicDna?: UnifiedMusicDNA | any | null;
  personalMusicTwin?: PersonalMusicTwinAttributes | any | null;
  temporalProfile?: any | null;
  feedbackProfile?: any | null;
  totalInteractionsCount?: number;
  configOverride?: Partial<TasteBoundaryConfig>;
}

/**
 * Curated Genre Family & Adjacency Knowledge Graph.
 * Maps primary genres to tier-1 direct sister subgenres (proximity 0.85)
 * and tier-2 family neighbors (proximity 0.75).
 */
export const GENRE_ADJACENCY_MAP: Record<
  string,
  {
    family: string;
    sisters: { name: string; relation: string }[];
    neighbors: { name: string; relation: string }[];
  }
> = {
  synthwave: {
    family: 'Electronic / Synth',
    sisters: [
      { name: 'Darksynth', relation: 'Darker, aggressive cyberpunk counterpart to Synthwave' },
      { name: 'Retrowave', relation: 'Direct sister genre rooted in 80s analog synthesizers' },
      { name: 'Cyberpunk', relation: 'Futuristic electronic subgenre with shared retro-futurism' },
      { name: 'Chillwave', relation: 'Dreamy, nostalgic low-tempo electronic relative' },
    ],
    neighbors: [
      { name: 'Synthpop', relation: 'Vocal-driven pop evolution of synthwave rhythms' },
      { name: 'Electropop', relation: 'Commercial electronic cousin with driving synthesizers' },
      { name: 'Outrun', relation: 'High-octane driving electronic sibling' },
      { name: 'Dreamwave', relation: 'Ethereal, ambient-leaning synth soundscape' },
    ],
  },
  'post-rock': {
    family: 'Alternative / Instrumental Rock',
    sisters: [
      { name: 'Shoegaze', relation: 'Atmospheric wall-of-sound guitar textures' },
      { name: 'Math Rock', relation: 'Complex rhythmic guitar structures sharing indie rock roots' },
      { name: 'Ambient Rock', relation: 'Spacious instrumental rock with cinematic builds' },
      { name: 'Dream Pop', relation: 'Reverb-laden ethereal guitar textures' },
    ],
    neighbors: [
      { name: 'Post-Metal', relation: 'Heavier, dynamic crescendo-driven cousin' },
      { name: 'Art Rock', relation: 'Experimental rock structures sharing dynamic compositions' },
      { name: 'Krautrock', relation: 'Motorik, hypnotic rhythmic foundation of modern post-rock' },
    ],
  },
  'lo-fi chill': {
    family: 'Lo-Fi / Downtempo',
    sisters: [
      { name: 'Chillhop', relation: 'Hip-hop rhythms with mellow jazz chord progressions' },
      { name: 'Jazzhop', relation: 'Acoustic jazz samples laced with dusty boom bap beats' },
      { name: 'Ambient Lo-Fi', relation: 'Tape-saturated minimalist background textures' },
      { name: 'Downtempo', relation: 'Relaxed groove-oriented electronic chill' },
    ],
    neighbors: [
      { name: 'Bedroom Pop', relation: 'DIY intimate songwriting sharing lo-fi tape saturation' },
      { name: 'Trip Hop', relation: 'Darker, atmospheric downtempo beat sibling' },
      { name: 'Neo-Soul', relation: 'Warm Rhodes chords and soulful organic basslines' },
    ],
  },
  'lo-fi': {
    family: 'Lo-Fi / Downtempo',
    sisters: [
      { name: 'Chillhop', relation: 'Hip-hop rhythms with mellow jazz chord progressions' },
      { name: 'Jazzhop', relation: 'Acoustic jazz samples laced with dusty boom bap beats' },
      { name: 'Ambient Lo-Fi', relation: 'Tape-saturated minimalist background textures' },
      { name: 'Downtempo', relation: 'Relaxed groove-oriented electronic chill' },
    ],
    neighbors: [
      { name: 'Bedroom Pop', relation: 'DIY intimate songwriting sharing lo-fi tape saturation' },
      { name: 'Trip Hop', relation: 'Darker, atmospheric downtempo beat sibling' },
    ],
  },
  'hip-hop': {
    family: 'Hip-Hop / Urban',
    sisters: [
      { name: 'Boom Bap', relation: 'Classic 90s gritty drum cadence and lyrical flow' },
      { name: 'Trap', relation: 'Modern 808-heavy rhythmic evolution' },
      { name: 'Conscious Hip-Hop', relation: 'Lyrically profound storytelling over soul-infused beats' },
      { name: 'Alternative Hip Hop', relation: 'Genre-bending, eclectic hip-hop arrangements' },
    ],
    neighbors: [
      { name: 'Neo-Soul', relation: 'Harmonic cousin combining R&B and hip-hop grooves' },
      { name: 'R&B', relation: 'Melodic counterpart to hip-hop rhythmic structures' },
      { name: 'Lo-Fi Hip Hop', relation: 'Introspective, study-friendly subgenre' },
    ],
  },
  electronic: {
    family: 'Electronic',
    sisters: [
      { name: 'House', relation: 'Four-on-the-floor rhythmic core of club electronic' },
      { name: 'Techno', relation: 'Hypnotic, driving industrial and melodic rhythms' },
      { name: 'Progressive House', relation: 'Melodic, building synth arrangements' },
      { name: 'Future Bass', relation: 'Colorful, pitch-bent synth chords and energetic drops' },
    ],
    neighbors: [
      { name: 'IDM', relation: 'Intricate, brainy rhythmic electronic experimentation' },
      { name: 'Ambient', relation: 'Beatless, textural sound design foundation' },
      { name: 'Synthwave', relation: 'Nostalgic retro analog electronic sibling' },
    ],
  },
  'indie rock': {
    family: 'Rock / Alternative',
    sisters: [
      { name: 'Post-Punk', relation: 'Angular guitars, driving basslines, and brooding vocals' },
      { name: 'Indie Pop', relation: 'Catchier, melodic hook-oriented sister genre' },
      { name: 'Garage Rock', relation: 'Raw, energetic guitar-driven cousin' },
      { name: 'Shoegaze', relation: 'Noisy, shimmering guitar walls' },
    ],
    neighbors: [
      { name: 'Grunge', relation: 'Distorted 90s rock sibling' },
      { name: 'Math Rock', relation: 'Polyrhythmic, intricate guitar arrangements' },
      { name: 'Folk Rock', relation: 'Acoustic-anchored storytelling rock' },
    ],
  },
  ambient: {
    family: 'Ambient / Experimental',
    sisters: [
      { name: 'Drone', relation: 'Sustained harmonic chords and meditative overtones' },
      { name: 'Space Ambient', relation: 'Cosmic, vast reverberant soundscapes' },
      { name: 'Modern Classical', relation: 'Acoustic piano and string arrangements with minimalist space' },
      { name: 'Dark Ambient', relation: 'Shadowy, atmospheric industrial hums and textures' },
    ],
    neighbors: [
      { name: 'Downtempo', relation: 'Subtle rhythmic beats underpinning ambient pads' },
      { name: 'Soundtrack', relation: 'Cinematic orchestral atmosphere' },
      { name: 'Post-Rock', relation: 'Climactic instrumental guitar dynamics' },
    ],
  },
  jazz: {
    family: 'Jazz / Improvisational',
    sisters: [
      { name: 'Fusion', relation: 'Electric instrumentation blending jazz and rock grooves' },
      { name: 'Bossa Nova', relation: 'Warm Brazilian syncopation and sophisticated jazz chords' },
      { name: 'Hard Bop', relation: 'Soulful, blues-infused bebop evolution' },
      { name: 'Cool Jazz', relation: 'Subdued, elegant tempos and restrained arrangements' },
    ],
    neighbors: [
      { name: 'Neo-Soul', relation: 'Modern urban descendant sharing extended 7th and 9th chords' },
      { name: 'Acid Jazz', relation: 'Groove-oriented club jazz with funk and soul elements' },
      { name: 'Funk', relation: 'High-syncopation rhythmic cousin' },
    ],
  },
  'glitch hop': {
    family: 'Bass / Glitch',
    sisters: [
      { name: 'Neurohop', relation: 'Neurofunk-infused sound design over midtempo funk grooves' },
      { name: 'IDM', relation: 'Intricate digital glitching and syncopated beatcraft' },
      { name: 'Wonky', relation: 'Off-grid swinging beats with colorful synth leads' },
      { name: 'Trip Hop', relation: 'Moody, downbeat groove ancestor' },
    ],
    neighbors: [
      { name: 'Future Bass', relation: 'Vibrant saw chords and heavy sub-bass' },
      { name: 'Dubstep', relation: 'Half-time sub-bass heavy cousin' },
    ],
  },
  metal: {
    family: 'Metal / Heavy Rock',
    sisters: [
      { name: 'Progressive Metal', relation: 'Complex time signatures and virtuosic guitars' },
      { name: 'Post-Metal', relation: 'Atmospheric post-rock dynamics with heavy metal distortion' },
      { name: 'Alternative Metal', relation: 'Melodic, groove-focused 90s/00s metal' },
      { name: 'Doom Metal', relation: 'Slow, crushing, dread-filled guitar riffs' },
    ],
    neighbors: [
      { name: 'Hard Rock', relation: 'Classic blues-based amplifier-driven ancestor' },
      { name: 'Industrial Metal', relation: 'Electronic sequencing fused with aggressive riffs' },
      { name: 'Metalcore', relation: 'Breakdown-heavy hardcore punk fusion' },
    ],
  },
};

export class TasteBoundaryDetectionService {
  /**
   * Identifies the multi-dimensional boundaries of a user's musical taste:
   * 1. Strongly Preferred Areas (core favorites)
   * 2. Adjacent Genres (immediate neighboring sister subgenres)
   * 3. Adjacent Artists (artists stylistically or genealogically connected to core)
   * 4. Familiar but Underexplored Areas (genres/artists user knows with low depth)
   * 5. Potentially Interesting New Areas (emerging frontiers matching user vibe)
   * 6. Low-Confidence Areas (sparse, high-skip, or ambiguous regions)
   */
  static detectTasteBoundaries(inputs: TasteBoundaryInputs): TasteBoundaryProfile {
    const config: TasteBoundaryConfig = {
      ...getTasteBoundaryConfig(),
      ...inputs.configOverride,
    };

    const userIdStr = inputs.userId ? inputs.userId.toString() : '';
    const rationales: string[] = [];

    const dna = inputs.musicDna;
    const twin = inputs.personalMusicTwin;
    const feedback = inputs.feedbackProfile;

    // Check data sufficiency
    const totalInteractions =
      inputs.totalInteractionsCount ??
      dna?.interactionsCountAtLastRefresh ??
      (twin?.isDataSufficient ? 25 : 0);

    const isDataSufficient =
      Boolean(dna || twin) &&
      (totalInteractions >= config.minInteractionHistory ||
        Boolean(dna?.listeningBehavior?.isDataSufficient) ||
        Boolean(twin?.isDataSufficient));

    // Handle Cold Start / Insufficient History gracefully
    if (!isDataSufficient) {
      rationales.push('Insufficient listening history: unable to compute tight taste boundaries.');
      return {
        userId: userIdStr,
        boundaryBreadth: 'MODERATE',
        boundaryBreadthScore: 0.50,
        confidenceScore: 0.15,
        isDataSufficient: false,
        stronglyPreferredAreas: [],
        adjacentGenres: [
          {
            name: 'Indie Pop',
            type: 'genre',
            affinityScore: 0.50,
            proximityScore: 0.70,
            discoveryPotential: 0.75,
            relation: 'Popular gateway genre',
            confidenceScore: 0.20,
            rationale: 'Balanced starting genre for new listeners.',
          },
          {
            name: 'Lo-Fi Chill',
            type: 'genre',
            affinityScore: 0.50,
            proximityScore: 0.70,
            discoveryPotential: 0.75,
            relation: 'Popular gateway genre',
            confidenceScore: 0.20,
            rationale: 'Accessible, universally pleasant listening atmosphere.',
          },
        ],
        adjacentArtists: [],
        familiarUnderexploredAreas: [],
        potentiallyInterestingAreas: [],
        lowConfidenceAreas: [
          {
            name: 'All Catalog Categories',
            type: 'genre',
            affinityScore: 0.50,
            proximityScore: 0.50,
            discoveryPotential: 0.80,
            relation: 'Unexplored frontier',
            confidenceScore: 0.10,
            rationale: 'User listening history is still establishing; boundaries carry high uncertainty.',
          },
        ],
        summary: {
          coreAnchorDescription: 'Baseline profile with no established core favorites yet.',
          boundaryHorizonDescription: 'Broad introductory boundary awaiting initial interaction signals.',
          recommendedDiscoveryStrategy: 'ESTABLISH_BASELINE',
          rationales,
        },
        lastEvaluatedAt: new Date(),
      };
    }

    // -------------------------------------------------------------------------
    // 1. Identify Strongly Preferred Areas (The Bedrock Core)
    // -------------------------------------------------------------------------
    const stronglyPreferredAreas: TasteBoundaryItem[] = [];
    const coreGenreNames = new Set<string>();

    // From Personal Music Twin core genres
    const twinCoreGenres = twin?.genreIdentity?.coreGenres || [];
    for (const g of twinCoreGenres) {
      const gName = g.name.trim();
      const affinity = typeof g.affinityScore === 'number' ? g.affinityScore : 0.85;
      if (affinity >= config.coreAffinityThreshold || g.isPrimary) {
        coreGenreNames.add(gName.toLowerCase());
        stronglyPreferredAreas.push({
          name: gName,
          type: 'genre',
          affinityScore: affinity,
          proximityScore: 1.0, // Core is zero distance
          discoveryPotential: 0.15, // Already familiar
          relation: g.isPrimary ? 'Primary Core Genre' : 'Core Preference Genre',
          anchor: gName,
          confidenceScore: twin?.confidenceScore ?? 0.85,
          rationale: `Strongly established core genre with ${(affinity * 100).toFixed(0)}% affinity.`,
        });
      }
    }

    // From Music DNA top genres if not already included
    const dnaTopGenres = dna?.genreProfile?.topGenres || [];
    for (const g of dnaTopGenres) {
      const gName = (g.name || g.genre || '').trim();
      if (!gName) continue;
      if (!coreGenreNames.has(gName.toLowerCase())) {
        const affinity = typeof g.score === 'number' ? g.score : typeof g.affinityScore === 'number' ? g.affinityScore : 0.80;
        if (affinity >= config.coreAffinityThreshold) {
          coreGenreNames.add(gName.toLowerCase());
          stronglyPreferredAreas.push({
            name: gName,
            type: 'genre',
            affinityScore: affinity,
            proximityScore: 1.0,
            discoveryPotential: 0.15,
            relation: 'Core Preference Genre',
            anchor: gName,
            confidenceScore: dna?.confidenceScore ?? 0.80,
            rationale: `Top ranked genre with ${(affinity * 100).toFixed(0)}% affinity in Music DNA.`,
          });
        }
      }
    }

    // Top Core Artists
    const coreArtistNames = new Set<string>();
    const topArtists =
      twin?.metadata?.establishedPreferences?.artists ||
      dna?.artistProfile?.strongestArtists ||
      [];

    for (const a of topArtists) {
      const aName = typeof a === 'string' ? a.trim() : (a.name || '').trim();
      if (!aName || coreArtistNames.has(aName.toLowerCase())) continue;
      const affinity = typeof a === 'object' && typeof a.score === 'number' ? a.score : 0.85;
      if (affinity >= config.coreAffinityThreshold) {
        coreArtistNames.add(aName.toLowerCase());
        stronglyPreferredAreas.push({
          name: aName,
          type: 'artist',
          affinityScore: affinity,
          proximityScore: 1.0,
          discoveryPotential: 0.15,
          relation: 'Core Bedrock Artist',
          anchor: stronglyPreferredAreas.find((i) => i.type === 'genre')?.name,
          confidenceScore: 0.85,
          rationale: 'Consistently played core artist with deep user loyalty.',
        });
      }
    }

    // -------------------------------------------------------------------------
    // 2. Identify Familiar but Underexplored Areas
    // -------------------------------------------------------------------------
    const familiarUnderexploredAreas: TasteBoundaryItem[] = [];
    const familiarNames = new Set<string>();

    // Secondary genres from Twin
    const secondaryGenres = twin?.genreIdentity?.secondaryGenres || [];
    for (const g of secondaryGenres) {
      const gName = g.name.trim();
      if (coreGenreNames.has(gName.toLowerCase()) || familiarNames.has(gName.toLowerCase())) continue;
      familiarNames.add(gName.toLowerCase());
      const affinity = typeof g.affinityScore === 'number' ? g.affinityScore : 0.60;
      familiarUnderexploredAreas.push({
        name: gName,
        type: 'genre',
        affinityScore: affinity,
        proximityScore: 0.85, // Close to core
        discoveryPotential: 0.60,
        relation: 'Secondary Genre with Low Depth',
        anchor: stronglyPreferredAreas.find((i) => i.type === 'genre')?.name,
        confidenceScore: 0.75,
        rationale: `User appreciates ${gName} (${(affinity * 100).toFixed(0)}% affinity) but has explored only a fraction of its catalog.`,
      });
    }

    // Secondary artists from DNA
    const secondaryArtists = (dna?.artistProfile?.strongestArtists || []).slice(3, 8);
    for (const a of secondaryArtists) {
      const aName = (a.name || '').trim();
      if (!aName || coreArtistNames.has(aName.toLowerCase()) || familiarNames.has(aName.toLowerCase())) continue;
      familiarNames.add(aName.toLowerCase());
      familiarUnderexploredAreas.push({
        name: aName,
        type: 'artist',
        affinityScore: a.score ?? 0.60,
        proximityScore: 0.85,
        discoveryPotential: 0.60,
        relation: 'Familiar Artist in Regular Rotation',
        confidenceScore: 0.70,
        rationale: `Frequently encountered artist without full album or discography exploration.`,
      });
    }

    // -------------------------------------------------------------------------
    // 3. Identify Adjacent Genres (Sister & Neighbor Styles)
    // -------------------------------------------------------------------------
    const adjacentGenres: TasteBoundaryItem[] = [];
    const adjacentGenreNames = new Set<string>();

    for (const coreItem of stronglyPreferredAreas.filter((i) => i.type === 'genre')) {
      const coreKey = coreItem.name.toLowerCase();
      const mapping = GENRE_ADJACENCY_MAP[coreKey];

      if (mapping) {
        // Tier 1 Sisters: Proximity ~0.85
        for (const sister of mapping.sisters) {
          const sKey = sister.name.toLowerCase();
          if (
            !coreGenreNames.has(sKey) &&
            !familiarNames.has(sKey) &&
            !adjacentGenreNames.has(sKey)
          ) {
            adjacentGenreNames.add(sKey);
            adjacentGenres.push({
              name: sister.name,
              type: 'genre',
              affinityScore: Number((coreItem.affinityScore * 0.85).toFixed(4)),
              proximityScore: 0.85,
              discoveryPotential: 0.75,
              relation: sister.relation,
              anchor: coreItem.name,
              category: mapping.family,
              confidenceScore: 0.80,
              rationale: `Direct sister subgenre to ${coreItem.name}: ${sister.relation}.`,
            });
          }
        }

        // Tier 2 Neighbors: Proximity ~0.75
        for (const neighbor of mapping.neighbors) {
          const nKey = neighbor.name.toLowerCase();
          if (
            !coreGenreNames.has(nKey) &&
            !familiarNames.has(nKey) &&
            !adjacentGenreNames.has(nKey)
          ) {
            adjacentGenreNames.add(nKey);
            adjacentGenres.push({
              name: neighbor.name,
              type: 'genre',
              affinityScore: Number((coreItem.affinityScore * 0.75).toFixed(4)),
              proximityScore: 0.75,
              discoveryPotential: 0.80,
              relation: neighbor.relation,
              anchor: coreItem.name,
              category: mapping.family,
              confidenceScore: 0.75,
              rationale: `Neighboring style in ${mapping.family}: ${neighbor.relation}.`,
            });
          }
        }
      }
    }

    // Ensure balanced representation across all core genres
    const coreGenresList = stronglyPreferredAreas.filter((i) => i.type === 'genre');
    const adjacentByCore = new Map<string, TasteBoundaryItem[]>();

    for (const item of adjacentGenres) {
      const anchor = item.anchor || 'default';
      if (!adjacentByCore.has(anchor)) {
        adjacentByCore.set(anchor, []);
      }
      adjacentByCore.get(anchor)!.push(item);
    }

    // Sort items within each core bucket by proximity descending
    for (const [_, items] of adjacentByCore.entries()) {
      items.sort((a, b) => b.proximityScore - a.proximityScore);
    }

    const balancedAdjacent: TasteBoundaryItem[] = [];
    const maxLimit = Math.max(config.maxAdjacentGenres, coreGenresList.length * 2);

    let addedAny = true;
    let round = 0;
    while (balancedAdjacent.length < maxLimit && addedAny) {
      addedAny = false;
      for (const core of coreGenresList) {
        const items = adjacentByCore.get(core.name) || [];
        if (round < items.length && balancedAdjacent.length < maxLimit) {
          balancedAdjacent.push(items[round]);
          addedAny = true;
        }
      }
      round++;
    }

    const cappedAdjacentGenres = balancedAdjacent.length > 0 ? balancedAdjacent : adjacentGenres.slice(0, config.maxAdjacentGenres);

    // -------------------------------------------------------------------------
    // 4. Identify Adjacent Artists
    // -------------------------------------------------------------------------
    const adjacentArtists: TasteBoundaryItem[] = [];
    const adjacentArtistNames = new Set<string>();

    // Emerging artists from DNA or Twin
    const emergingArtists =
      twin?.currentEmergingInterests?.artists ||
      dna?.artistProfile?.emergingArtists ||
      [];

    for (const a of emergingArtists) {
      const aName = (a.name || '').trim();
      if (!aName || coreArtistNames.has(aName.toLowerCase()) || adjacentArtistNames.has(aName.toLowerCase())) continue;
      adjacentArtistNames.add(aName.toLowerCase());
      adjacentArtists.push({
        name: aName,
        type: 'artist',
        affinityScore: a.confidence ?? 0.75,
        proximityScore: 0.80,
        discoveryPotential: 0.75,
        relation: 'Emerging Adjacent Creator',
        anchor: stronglyPreferredAreas.find((i) => i.type === 'genre')?.name,
        confidenceScore: 0.75,
        rationale: `Emerging artist with rising listener interest in adjacent musical territory.`,
      });
    }

    // Synthesize curated representative adjacent artists for dominant core genres if needed
    if (adjacentArtists.length < 3) {
      for (const coreItem of stronglyPreferredAreas.filter((i) => i.type === 'genre')) {
        const coreKey = coreItem.name.toLowerCase();
        if (coreKey.includes('synthwave') && !adjacentArtistNames.has('fm-84')) {
          adjacentArtistNames.add('fm-84');
          adjacentArtists.push({
            name: 'FM-84',
            type: 'artist',
            affinityScore: 0.75,
            proximityScore: 0.85,
            discoveryPotential: 0.75,
            relation: 'Stylistic peer in 80s synth melodies',
            anchor: 'Synthwave',
            confidenceScore: 0.80,
            rationale: 'Shares the analog production style of the user’s core Synthwave favorites.',
          });
        }
        if (coreKey.includes('post-rock') && !adjacentArtistNames.has('mono')) {
          adjacentArtistNames.add('mono');
          adjacentArtists.push({
            name: 'MONO',
            type: 'artist',
            affinityScore: 0.70,
            proximityScore: 0.85,
            discoveryPotential: 0.80,
            relation: 'Cinematic instrumental rock peer',
            anchor: 'Post-Rock',
            confidenceScore: 0.80,
            rationale: 'Shares dramatic crescendos and atmospheric guitars with Explosions In The Sky.',
          });
        }
      }
    }

    const cappedAdjacentArtists = adjacentArtists.slice(0, config.maxAdjacentArtists);

    // -------------------------------------------------------------------------
    // 5. Identify Potentially Interesting New Areas (The Emerging Frontier)
    // -------------------------------------------------------------------------
    const potentiallyInterestingAreas: TasteBoundaryItem[] = [];
    const frontierNames = new Set<string>();

    // From emerging genres with positive momentum
    const emergingGenres =
      twin?.currentEmergingInterests?.genres ||
      dna?.genreProfile?.emergingGenres ||
      dna?.temporalTaste?.emergingGenres ||
      [];

    for (const g of emergingGenres) {
      const gName = (typeof g === 'string' ? g : g.name || '').trim();
      if (!gName) continue;
      const gKey = gName.toLowerCase();
      if (coreGenreNames.has(gKey) || adjacentGenreNames.has(gKey) || frontierNames.has(gKey)) continue;
      frontierNames.add(gKey);

      potentiallyInterestingAreas.push({
        name: gName,
        type: 'genre',
        affinityScore: typeof g === 'object' && g.confidence ? g.confidence : 0.70,
        proximityScore: 0.60, // Sits on the frontier
        discoveryPotential: 0.90, // High discovery value
        relation: 'Emerging Frontier Interest',
        confidenceScore: 0.70,
        rationale: `Actively emerging in user listening history with high momentum.`,
      });
    }

    // For highly exploratory users, expand with cross-pollinated adventurous genres
    const explorationTendency =
      twin?.explorationTendency ??
      dna?.tendencies?.explorationPreference ??
      0.50;

    if (explorationTendency >= 0.70 && potentiallyInterestingAreas.length < config.maxPotentialNewAreas) {
      const exploratoryFrontiers = [
        { name: 'Glitch Hop', anchor: 'Electronic', relation: 'Intricate syncopated beat design' },
        { name: 'Dream Pop', anchor: 'Alternative', relation: 'Ethereal reverb textures bridging rock and pop' },
        { name: 'Neo-Soul', anchor: 'Urban', relation: 'Warm harmonic chord arrangements' },
      ];

      for (const ef of exploratoryFrontiers) {
        const efKey = ef.name.toLowerCase();
        if (
          !coreGenreNames.has(efKey) &&
          !adjacentGenreNames.has(efKey) &&
          !frontierNames.has(efKey)
        ) {
          frontierNames.add(efKey);
          potentiallyInterestingAreas.push({
            name: ef.name,
            type: 'genre',
            affinityScore: 0.65,
            proximityScore: 0.55,
            discoveryPotential: 0.92,
            relation: `Adventurous cross-genre frontier (${ef.relation})`,
            anchor: ef.anchor,
            confidenceScore: 0.65,
            rationale: `Broadened exploratory frontier matching listener's high curiosity score (${(explorationTendency * 100).toFixed(0)}%).`,
          });
        }
      }
    }

    const cappedPotentialAreas = potentiallyInterestingAreas.slice(0, config.maxPotentialNewAreas);

    // -------------------------------------------------------------------------
    // 6. Identify Low-Confidence Areas (Sparse, High-Skip, or Fringe Zones)
    // -------------------------------------------------------------------------
    const lowConfidenceAreas: TasteBoundaryItem[] = [];
    const lowConfNames = new Set<string>();

    // From fading preferences
    const fadingGenres = twin?.metadata?.fadingPreferences?.genres || [];
    for (const g of fadingGenres) {
      const gName = typeof g === 'string' ? g.trim() : (g.name || '').trim();
      if (!gName || lowConfNames.has(gName.toLowerCase())) continue;
      lowConfNames.add(gName.toLowerCase());
      lowConfidenceAreas.push({
        name: gName,
        type: 'genre',
        affinityScore: 0.25,
        proximityScore: 0.35,
        discoveryPotential: 0.40,
        relation: 'Fading / Declining Preference',
        confidenceScore: 0.35,
        rationale: `Declining rotation frequency indicates waning user affinity.`,
      });
    }

    // From feedback skip signals
    if (feedback?.genreSkipCounts) {
      for (const [gId, count] of feedback.genreSkipCounts.entries()) {
        if (count >= 2 && !lowConfNames.has(gId.toLowerCase())) {
          lowConfNames.add(gId.toLowerCase());
          lowConfidenceAreas.push({
            name: gId,
            type: 'genre',
            affinityScore: 0.20,
            proximityScore: 0.30,
            discoveryPotential: 0.30,
            relation: 'High Skip Friction Area',
            confidenceScore: 0.30,
            rationale: `Repeated skips (${count} skips) indicate listener rejection or mismatch.`,
          });
        }
      }
    }

    const cappedLowConfidence = lowConfidenceAreas.slice(0, config.maxLowConfidenceAreas);

    // -------------------------------------------------------------------------
    // 7. Calculate Boundary Breadth & Recommended Strategy
    // -------------------------------------------------------------------------
    const diversityScore =
      twin?.diversityPreference ??
      dna?.genreProfile?.diversity ??
      0.50;

    const familiarityTendency =
      twin?.familiarityTendency ??
      dna?.tendencies?.familiarityPreference ??
      0.50;

    const coreCount = stronglyPreferredAreas.filter((i) => i.type === 'genre').length;
    const coreFactor = coreCount >= 3 ? 0.85 : coreCount === 2 ? 0.55 : 0.25;

    // Breadth score synthesizes diversity, exploration, and core span
    const boundaryBreadthScore = Number(
      Math.max(
        0.05,
        Math.min(
          0.98,
          0.45 * diversityScore + 0.35 * explorationTendency + 0.20 * coreFactor
        )
      ).toFixed(4)
    );

    let boundaryBreadth: TasteBoundaryBreadth = 'MODERATE';
    if (boundaryBreadthScore < config.narrowBreadthThreshold) {
      boundaryBreadth = 'NARROW';
    } else if (boundaryBreadthScore >= config.expansiveBreadthThreshold) {
      boundaryBreadth = 'EXPANSIVE';
    } else if (boundaryBreadthScore >= config.wideBreadthThreshold) {
      boundaryBreadth = 'WIDE';
    }

    // Discovery Strategy Determination
    let recommendedDiscoveryStrategy: DiscoveryStrategy = 'ADJACENT_EXPANSION';

    if (familiarityTendency >= 0.75 || explorationTendency <= 0.30 || boundaryBreadth === 'NARROW') {
      recommendedDiscoveryStrategy = 'DEEP_DIVE';
      rationales.push('Listener prioritizes comfort & deep familiarity: recommended deep-dive into familiar underexplored areas and tight sister subgenres.');
    } else if (explorationTendency >= 0.70 || boundaryBreadth === 'EXPANSIVE') {
      recommendedDiscoveryStrategy = 'FRONTIER_EXPLORATION';
      rationales.push('Listener exhibits high curiosity: recommended adventurous expansion into emerging and cross-genre frontiers.');
    } else {
      recommendedDiscoveryStrategy = 'ADJACENT_EXPANSION';
      rationales.push('Listener exhibits balanced taste: recommended gradual expansion into immediately adjacent sister genres.');
    }

    // Calibrated Confidence
    const baseConfidence = twin?.confidenceScore ?? dna?.confidenceScore ?? 0.80;
    const confidenceScore = Number(
      Math.min(0.98, Math.max(0.40, baseConfidence * Math.min(1.0, totalInteractions / 20))).toFixed(2)
    );

    const primaryGenreName = stronglyPreferredAreas.find((i) => i.type === 'genre')?.name || 'Eclectic Catalog';
    const coreAnchorDescription = `Anchored primarily in ${primaryGenreName} with ${coreCount} core genres and ${coreArtistNames.size} core artists.`;
    const boundaryHorizonDescription = `Taste boundary spans ${cappedAdjacentGenres.length} adjacent sister genres and ${cappedPotentialAreas.length} emerging frontier areas with a ${boundaryBreadth.toLowerCase()} footprint.`;

    return {
      userId: userIdStr,
      boundaryBreadth,
      boundaryBreadthScore,
      confidenceScore,
      isDataSufficient: true,
      stronglyPreferredAreas,
      adjacentGenres: cappedAdjacentGenres,
      adjacentArtists: cappedAdjacentArtists,
      familiarUnderexploredAreas,
      potentiallyInterestingAreas: cappedPotentialAreas,
      lowConfidenceAreas: cappedLowConfidence,
      summary: {
        coreAnchorDescription,
        boundaryHorizonDescription,
        recommendedDiscoveryStrategy,
        rationales,
      },
      lastEvaluatedAt: new Date(),
    };
  }

  /**
   * Asynchronously retrieves upstream user intelligence and computes the complete Taste Boundary profile.
   */
  static async getUserTasteBoundaries(
    userId: string | Types.ObjectId,
    options: {
      configOverride?: Partial<TasteBoundaryConfig>;
      forceRefresh?: boolean;
    } = {}
  ): Promise<TasteBoundaryProfile> {
    const userIdStr = userId.toString();

    const [dna, twin, temporal, feedback] = await Promise.all([
      UnifiedMusicDNAService.getOrGenerateProfile(userIdStr, {
        forceRefresh: options.forceRefresh,
      }).catch(() => null),
      PersonalMusicTwinService.getOrGenerateTwin(userIdStr, {
        forceRefresh: options.forceRefresh,
      }).catch(() => null),
      LayeredTemporalTasteProfileService.generateLayeredTasteProfile(userIdStr).catch(() => null),
      RecommendationScoreCalibrationService.buildUserFeedbackProfile(userIdStr).catch(() => null),
    ]);

    return this.detectTasteBoundaries({
      userId: userIdStr,
      musicDna: dna,
      personalMusicTwin: twin ? (twin as any).toObject ? (twin as any).toObject() : twin : null,
      temporalProfile: temporal,
      feedbackProfile: feedback,
      configOverride: options.configOverride,
    });
  }
}

export default TasteBoundaryDetectionService;
