import dotenv from 'dotenv';
import { supabase } from './config/supabase.js';
import { GenreService } from './services/genreService.js';
import { ArtistService } from './services/artistService.js';
import { AlbumService } from './services/albumService.js';
import { SongService } from './services/songService.js';

dotenv.config();

// Fallback audio, used only if YouTube resolution ever fails for a song.
// Real playback comes from the YouTube IFrame Player API, resolved lazily
// per song (title + artist search) on first play and cached on the row.
const AUDIO_SAMPLE_URLS = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
];

// Real, well-known recording artists. For each, we pull their actual iTunes
// catalog (real titles, real albums, real cover art, real durations/release
// years) instead of hand-picking one or two singles — this is what lets the
// library scale to hundreds of real songs instead of a curated handful.
const ARTISTS: { name: string; genre: string }[] = [
  // Pop
  { name: 'Taylor Swift', genre: 'pop' },
  { name: 'Ed Sheeran', genre: 'pop' },
  { name: 'Dua Lipa', genre: 'pop' },
  { name: 'Ariana Grande', genre: 'pop' },
  { name: 'The Weeknd', genre: 'pop' },
  { name: 'Bruno Mars', genre: 'pop' },
  { name: 'Billie Eilish', genre: 'pop' },
  { name: 'Justin Bieber', genre: 'pop' },
  { name: 'Harry Styles', genre: 'pop' },
  { name: 'Miley Cyrus', genre: 'pop' },
  { name: 'Adele', genre: 'pop' },
  { name: 'Katy Perry', genre: 'pop' },
  { name: 'Lady Gaga', genre: 'pop' },
  { name: 'Shawn Mendes', genre: 'pop' },
  { name: 'Olivia Rodrigo', genre: 'pop' },
  // Rock
  { name: 'Queen', genre: 'rock' },
  { name: 'Nirvana', genre: 'rock' },
  { name: "Guns N' Roses", genre: 'rock' },
  { name: 'Led Zeppelin', genre: 'rock' },
  { name: 'AC/DC', genre: 'rock' },
  { name: 'The Killers', genre: 'rock' },
  { name: 'Foo Fighters', genre: 'rock' },
  { name: 'Metallica', genre: 'rock' },
  { name: 'Red Hot Chili Peppers', genre: 'rock' },
  { name: 'Green Day', genre: 'rock' },
  { name: 'Linkin Park', genre: 'rock' },
  { name: 'Coldplay', genre: 'rock' },
  { name: 'Muse', genre: 'rock' },
  { name: 'Imagine Dragons', genre: 'rock' },
  { name: 'Arctic Monkeys', genre: 'rock' },
  // Hip-Hop
  { name: 'Kendrick Lamar', genre: 'hip-hop' },
  { name: 'Drake', genre: 'hip-hop' },
  { name: 'Travis Scott', genre: 'hip-hop' },
  { name: 'Eminem', genre: 'hip-hop' },
  { name: 'Post Malone', genre: 'hip-hop' },
  { name: 'J. Cole', genre: 'hip-hop' },
  { name: 'A$AP Rocky', genre: 'hip-hop' },
  { name: 'Playboi Carti', genre: 'hip-hop' },
  { name: 'Lil Uzi Vert', genre: 'hip-hop' },
  { name: 'Future', genre: 'hip-hop' },
  { name: 'Young Thug', genre: 'hip-hop' },
  { name: '50 Cent', genre: 'hip-hop' },
  { name: 'Kanye West', genre: 'hip-hop' },
  { name: 'Lil Wayne', genre: 'hip-hop' },
  { name: 'Nas', genre: 'hip-hop' },
  // Electronic
  { name: 'Daft Punk', genre: 'electronic' },
  { name: 'Avicii', genre: 'electronic' },
  { name: 'Calvin Harris', genre: 'electronic' },
  { name: 'Skrillex', genre: 'electronic' },
  { name: 'Martin Garrix', genre: 'electronic' },
  { name: 'Marshmello', genre: 'electronic' },
  { name: 'Zedd', genre: 'electronic' },
  { name: 'David Guetta', genre: 'electronic' },
  { name: 'Deadmau5', genre: 'electronic' },
  { name: 'The Chainsmokers', genre: 'electronic' },
  { name: 'Swedish House Mafia', genre: 'electronic' },
  { name: 'Alan Walker', genre: 'electronic' },
  { name: 'DJ Snake', genre: 'electronic' },
  { name: 'Tiësto', genre: 'electronic' },
  { name: 'Kygo', genre: 'electronic' },
  // R&B / Soul
  { name: 'Frank Ocean', genre: 'r-and-b' },
  { name: 'Miguel', genre: 'r-and-b' },
  { name: 'Khalid', genre: 'r-and-b' },
  { name: 'Daniel Caesar', genre: 'r-and-b' },
  { name: 'SZA', genre: 'r-and-b' },
  { name: 'Chris Brown', genre: 'r-and-b' },
  { name: 'Usher', genre: 'r-and-b' },
  { name: 'Alicia Keys', genre: 'r-and-b' },
  { name: 'John Legend', genre: 'r-and-b' },
  { name: 'Beyoncé', genre: 'r-and-b' },
  { name: 'H.E.R.', genre: 'r-and-b' },
  { name: 'Jhené Aiko', genre: 'r-and-b' },
  { name: 'Solange', genre: 'r-and-b' },
  { name: 'Ne-Yo', genre: 'r-and-b' },
  { name: 'Bryson Tiller', genre: 'r-and-b' },
  // Jazz & Blues
  { name: 'Miles Davis', genre: 'jazz' },
  { name: 'Frank Sinatra', genre: 'jazz' },
  { name: 'Louis Armstrong', genre: 'jazz' },
  { name: 'Nina Simone', genre: 'jazz' },
  { name: 'Ella Fitzgerald', genre: 'jazz' },
  { name: 'Dave Brubeck', genre: 'jazz' },
  { name: 'Nat King Cole', genre: 'jazz' },
  { name: 'Thelonious Monk', genre: 'jazz' },
  { name: 'Dizzy Gillespie', genre: 'jazz' },
  { name: 'Billie Holiday', genre: 'jazz' },
  { name: 'John Coltrane', genre: 'jazz' },
  { name: 'Ray Charles', genre: 'jazz' },
  { name: 'B.B. King', genre: 'jazz' },
  { name: 'Duke Ellington', genre: 'jazz' },
  { name: 'Chet Baker', genre: 'jazz' },
  // Indie & Folk
  { name: 'The Lumineers', genre: 'indie' },
  { name: 'Bon Iver', genre: 'indie' },
  { name: 'Vance Joy', genre: 'indie' },
  { name: 'George Ezra', genre: 'indie' },
  { name: 'Of Monsters and Men', genre: 'indie' },
  { name: 'Mumford & Sons', genre: 'indie' },
  { name: 'Hozier', genre: 'indie' },
  { name: 'Florence and the Machine', genre: 'indie' },
  { name: 'Foster the People', genre: 'indie' },
  { name: 'MGMT', genre: 'indie' },
  { name: 'Fleet Foxes', genre: 'indie' },
  { name: 'Vampire Weekend', genre: 'indie' },
  { name: 'Arcade Fire', genre: 'indie' },
  { name: 'The National', genre: 'indie' },
  { name: 'Two Door Cinema Club', genre: 'indie' },
];

// Classical is modeled per-piece rather than per-artist: iTunes catalogs
// classical recordings under the performing orchestra/soloist, not the
// composer, so an artist-catalog pull doesn't work the way it does for
// modern acts. A direct title search for well-known pieces works better.
const CLASSICAL_PIECES: string[] = [
  'Clair de Lune Debussy',
  'Canon in D Pachelbel',
  'River Flows in You Yiruma',
  'Nuvole Bianche Ludovico Einaudi',
  'Gymnopedie No 1 Erik Satie',
  'Moonlight Sonata Beethoven',
  'Symphony No 5 Beethoven',
  'The Four Seasons Spring Vivaldi',
  'Ave Maria Schubert',
  'Requiem Mozart',
  'Eine Kleine Nachtmusik Mozart',
  'Swan Lake Tchaikovsky',
  'Air on the G String Bach',
  'Prelude in C Bach',
  'Nocturne Chopin',
  'Piano Sonata No 14 Beethoven',
  'The Nutcracker Tchaikovsky',
  'Rhapsody in Blue Gershwin',
  'Adagio for Strings Barber',
  'Fur Elise Beethoven',
  'Toccata and Fugue in D Minor Bach',
  'Hungarian Dance No 5 Brahms',
  'Piano Concerto No 21 Mozart',
  'Water Music Handel',
];

const GENRE_AUDIO_DEFAULTS: Record<
  string,
  { bpm: number; energy: number; valence: number; acousticness: number; instrumentalness: number }
> = {
  pop: { bpm: 118, energy: 0.78, valence: 0.8, acousticness: 0.2, instrumentalness: 0.05 },
  rock: { bpm: 135, energy: 0.9, valence: 0.6, acousticness: 0.15, instrumentalness: 0.1 },
  'hip-hop': { bpm: 95, energy: 0.8, valence: 0.68, acousticness: 0.1, instrumentalness: 0.05 },
  electronic: { bpm: 128, energy: 0.92, valence: 0.75, acousticness: 0.05, instrumentalness: 0.3 },
  'r-and-b': { bpm: 85, energy: 0.55, valence: 0.65, acousticness: 0.25, instrumentalness: 0.1 },
  jazz: { bpm: 82, energy: 0.42, valence: 0.5, acousticness: 0.85, instrumentalness: 0.5 },
  classical: { bpm: 70, energy: 0.35, valence: 0.4, acousticness: 0.95, instrumentalness: 0.95 },
  indie: { bpm: 96, energy: 0.5, valence: 0.6, acousticness: 0.6, instrumentalness: 0.1 },
};

interface ITunesTrack {
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
  trackExplicitness?: string;
  wrapperType?: string;
  kind?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// country=US + lang=en_us biases matches toward the English-language/US
// catalog release of a track or artist, avoiding foreign-language covers
// or region-specific versions that sometimes rank first for an ambiguous
// title/name-only search.
const ITUNES_LOCALE = 'country=US&lang=en_us';

async function fetchItunesTrack(query: string): Promise<ITunesTrack | null> {
  const url = `https://itunes.apple.com/search?media=music&entity=song&${ITUNES_LOCALE}&limit=1&term=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = (await response.json()) as { results?: ITunesTrack[] };
    return body.results?.[0] || null;
  } catch {
    return null;
  }
}

async function fetchArtistId(name: string): Promise<number | null> {
  const url = `https://itunes.apple.com/search?entity=musicArtist&${ITUNES_LOCALE}&limit=1&term=${encodeURIComponent(name)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = (await response.json()) as { results?: { artistId?: number }[] };
    return body.results?.[0]?.artistId ?? null;
  } catch {
    return null;
  }
}

async function fetchArtistTracks(artistId: number, limit = 25): Promise<ITunesTrack[]> {
  const url = `https://itunes.apple.com/lookup?id=${artistId}&entity=song&${ITUNES_LOCALE}&limit=${limit}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const body = (await response.json()) as { results?: ITunesTrack[] };
    const tracks = (body.results || []).filter((r) => r.wrapperType === 'track' && r.kind === 'song');

    // The same track title often reappears across deluxe editions/reissues
    // with identical metadata but a different album artwork URL — keep the
    // first (usually original) occurrence only.
    const seenTitles = new Set<string>();
    const deduped: ITunesTrack[] = [];
    for (const t of tracks) {
      const key = t.trackName.toLowerCase().trim();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      deduped.push(t);
    }
    return deduped;
  } catch {
    return [];
  }
}

const upscaleArtwork = (url?: string): string => {
  if (!url) return '';
  return url.replace(/\d+x\d+bb\.(jpg|png)$/, '600x600bb.$1');
};

const MAX_TRACKS_PER_ARTIST = 14;

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting HarmonyAI Database Seed...');

    // Clear existing catalog data to prevent duplicate accumulation.
    // Order matters: songs/albums reference artists/genres via foreign keys.
    console.log('🧹 Clearing existing Songs, Albums, Artists, and Genres...');
    await supabase.from('songs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('albums').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('artist_genres').delete().neq('artist_id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('artists').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('genres').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 1. Seed Genres
    console.log('🎵 Seeding Genres...');
    const genreData = [
      {
        key: 'pop',
        name: 'Pop',
        description: 'Catchy melodies, upbeat rhythms, and modern electronic hit tracks.',
        coverImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop',
        tags: ['pop', 'hits', 'upbeat', 'dance'],
        isFeatured: true,
      },
      {
        key: 'rock',
        name: 'Rock',
        description: 'Electric guitars, driving drumbeats, and raw vocal energy.',
        coverImage: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&auto=format&fit=crop',
        tags: ['rock', 'alternative', 'guitars', 'energetic'],
        isFeatured: true,
      },
      {
        key: 'hip-hop',
        name: 'Hip-Hop',
        description: 'Rhythmic beats, expressive poetry, and urban soundscapes.',
        coverImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop',
        tags: ['hiphop', 'rap', 'trap', 'urban'],
        isFeatured: true,
      },
      {
        key: 'electronic',
        name: 'Electronic',
        description: 'Synthesizers, deep basslines, and immersive electronic grooves.',
        coverImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop',
        tags: ['edm', 'synthwave', 'club', 'house'],
        isFeatured: true,
      },
      {
        key: 'r-and-b',
        name: 'R&B / Soul',
        description: 'Smooth vocals, soulful melodies, and atmospheric grooves.',
        coverImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop',
        tags: ['rnb', 'soul', 'chill', 'smooth'],
        isFeatured: true,
      },
      {
        key: 'jazz',
        name: 'Jazz & Blues',
        description: 'Improvisational solos, brass tones, and timeless acoustic swing.',
        coverImage: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&auto=format&fit=crop',
        tags: ['jazz', 'blues', 'acoustic', 'relaxing'],
        isFeatured: false,
      },
      {
        key: 'classical',
        name: 'Classical',
        description: 'Orchestral arrangements, piano solos, and cinematic themes.',
        coverImage: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=600&auto=format&fit=crop',
        tags: ['classical', 'piano', 'cinematic', 'instrumental'],
        isFeatured: false,
      },
      {
        key: 'indie',
        name: 'Indie & Folk',
        description: 'Acoustic guitars, dreamy synths, and independent songwriting.',
        coverImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop',
        tags: ['indie', 'folk', 'acoustic', 'chill'],
        isFeatured: true,
      },
    ];

    // Keyed by our own stable `key`, not the DB-generated slug — GenreService
    // slugifies only whitespace, so multi-word names like "R&B / Soul" end up
    // with a punctuation-mangled slug that would silently break this lookup.
    const genres = await Promise.all(
      genreData.map((g) => GenreService.createGenre({ ...g, key: undefined } as any))
    );
    const genreMap = new Map(genreData.map((g, i) => [g.key, genres[i]._id as string]));

    // 2. Resolve real song metadata from the iTunes catalog: pull each
    // artist's real catalog in bulk (not just one hand-picked single), plus
    // a curated list of classical pieces (composers don't map to "artists").
    console.log('🔎 Resolving real song metadata from the iTunes catalog (this pulls each artist\'s real catalog, expect a few minutes)...');
    const resolved: { track: ITunesTrack; genreSlug: string }[] = [];
    const seenTracks = new Set<string>(); // guards against two sources resolving to the same real track

    for (const artistDef of ARTISTS) {
      const artistId = await fetchArtistId(artistDef.name);
      await sleep(200);
      if (!artistId) {
        console.warn(`  ⚠️  No iTunes artist match for "${artistDef.name}", skipping`);
        continue;
      }

      const tracks = await fetchArtistTracks(artistId, 25);
      await sleep(200);
      if (tracks.length === 0) {
        console.warn(`  ⚠️  No tracks found for "${artistDef.name}", skipping`);
        continue;
      }

      let added = 0;
      for (const track of tracks) {
        if (added >= MAX_TRACKS_PER_ARTIST) break;
        const dedupeKey = `${track.artistName}::${track.trackName}`.toLowerCase();
        if (seenTracks.has(dedupeKey)) continue;
        seenTracks.add(dedupeKey);
        resolved.push({ track, genreSlug: artistDef.genre });
        added += 1;
      }
      console.log(`  ✓ ${artistDef.name}: added ${added} real tracks`);
    }

    for (const query of CLASSICAL_PIECES) {
      const track = await fetchItunesTrack(query);
      await sleep(200);
      if (!track) {
        console.warn(`  ⚠️  No iTunes match for "${query}", skipping`);
        continue;
      }
      const dedupeKey = `${track.artistName}::${track.trackName}`.toLowerCase();
      if (seenTracks.has(dedupeKey)) continue;
      seenTracks.add(dedupeKey);
      resolved.push({ track, genreSlug: 'classical' });
    }

    console.log(`✅ Resolved ${resolved.length} real songs total`);

    // 3. Seed real Artists (deduped by the artist name iTunes returns)
    console.log('🎤 Seeding real Artists...');
    const artistNames = Array.from(new Set(resolved.map((r) => r.track.artistName)));
    const artistMap = new Map<string, string>();
    for (const name of artistNames) {
      const first = resolved.find((r) => r.track.artistName === name)!;
      const image = upscaleArtwork(first.track.artworkUrl100);
      const artist = await ArtistService.createArtist({
        name,
        bio: `${name} — real recording artist, catalogued from public music metadata.`,
        profileImage: image,
        bannerImage: image,
        genres: [genreMap.get(first.genreSlug)].filter(Boolean) as string[],
        monthlyListeners: Math.floor(Math.random() * 3000000) + 200000,
        verified: true,
        tags: [first.genreSlug],
      });
      artistMap.set(name, artist._id as string);
    }

    // 4. Seed real Albums (deduped by artist + album title)
    console.log('💿 Seeding real Albums...');
    const albumMap = new Map<string, string>();
    for (const { track, genreSlug } of resolved) {
      const albumTitle = track.collectionName || track.trackName;
      const key = `${track.artistName}::${albumTitle}`;
      if (albumMap.has(key)) continue;

      const artistId = artistMap.get(track.artistName);
      if (!artistId) continue;

      const releaseYear = track.releaseDate ? new Date(track.releaseDate).getFullYear() : undefined;
      const album = await AlbumService.createAlbum({
        title: albumTitle,
        artist: artistId,
        genre: genreMap.get(genreSlug),
        coverImage: upscaleArtwork(track.artworkUrl100),
        releaseYear,
        albumType: 'album',
        totalTracks: 1,
        tags: [genreSlug],
      });
      albumMap.set(key, album._id as string);
    }

    // 5. Seed real Songs, using each song's own real cover art
    console.log('🎶 Seeding real Songs...');
    const songs = [];
    let audioIdx = 0;
    for (const { track, genreSlug } of resolved) {
      const artistId = artistMap.get(track.artistName);
      const genreId = genreMap.get(genreSlug);
      if (!artistId || !genreId) continue;

      const albumTitle = track.collectionName || track.trackName;
      const albumId = albumMap.get(`${track.artistName}::${albumTitle}`);
      const defaults = GENRE_AUDIO_DEFAULTS[genreSlug] || GENRE_AUDIO_DEFAULTS.pop;
      const releaseYear = track.releaseDate ? new Date(track.releaseDate).getFullYear() : undefined;
      const duration = track.trackTimeMillis ? Math.round(track.trackTimeMillis / 1000) : 210;
      const sampleAudioUrl = AUDIO_SAMPLE_URLS[audioIdx % AUDIO_SAMPLE_URLS.length];
      audioIdx += 1;

      const song = await SongService.createSong({
        title: track.trackName,
        artist: artistId,
        album: albumId,
        genre: genreId,
        duration,
        coverImage: upscaleArtwork(track.artworkUrl100),
        audioUrl: sampleAudioUrl,
        releaseYear,
        audioFeatures: {
          bpm: defaults.bpm,
          energy: defaults.energy,
          danceability: Math.round((0.5 + Math.random() * 0.4) * 100) / 100,
          valence: defaults.valence,
          acousticness: defaults.acousticness,
          instrumentalness: defaults.instrumentalness,
        },
        tags: [genreSlug, 'harmonyai-seed'],
        language: 'English',
        explicit: track.trackExplicitness === 'explicit',
      });
      songs.push(song);
    }

    console.log('\n==================================================');
    console.log('🎉 HarmonyAI Database Seeding Complete Successfully!');
    console.log('==================================================');
    console.log(`📊 Total Genres Created:  ${genres.length}`);
    console.log(`🎤 Total Artists Created: ${artistMap.size}`);
    console.log(`💿 Total Albums Created:  ${albumMap.size}`);
    console.log(`🎶 Total Songs Created:   ${songs.length}`);
    console.log('==================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during database seeding:', error);
    process.exit(1);
  }
};

seedDatabase();
