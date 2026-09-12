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

// Real, well-known commercial songs. Title/artist metadata (real album,
// real cover art, real duration, real release year) is resolved at seed
// time from the iTunes Search API — a free, keyless, public catalog lookup.
// No audio is fetched from iTunes; only metadata.
const REAL_SONGS: { query: string; genre: string }[] = [
  // Pop
  { query: 'Blinding Lights The Weeknd', genre: 'pop' },
  { query: 'Shape of You Ed Sheeran', genre: 'pop' },
  { query: 'Levitating Dua Lipa', genre: 'pop' },
  { query: 'Watermelon Sugar Harry Styles', genre: 'pop' },
  { query: 'As It Was Harry Styles', genre: 'pop' },
  { query: 'Anti-Hero Taylor Swift', genre: 'pop' },
  // Rock
  { query: "Sweet Child O Mine Guns N Roses", genre: 'rock' },
  { query: 'Smells Like Teen Spirit Nirvana', genre: 'rock' },
  { query: 'Bohemian Rhapsody Queen', genre: 'rock' },
  { query: 'Africa Toto', genre: 'rock' },
  { query: 'Mr Brightside The Killers', genre: 'rock' },
  { query: 'Somebody Told Me The Killers', genre: 'rock' },
  // Hip-Hop
  { query: 'HUMBLE Kendrick Lamar', genre: 'hip-hop' },
  { query: 'SICKO MODE Travis Scott', genre: 'hip-hop' },
  { query: "Gods Plan Drake", genre: 'hip-hop' },
  { query: 'Sunflower Post Malone', genre: 'hip-hop' },
  { query: 'Lose Yourself Eminem', genre: 'hip-hop' },
  { query: 'In Da Club 50 Cent', genre: 'hip-hop' },
  // Electronic
  { query: 'Titanium David Guetta Sia', genre: 'electronic' },
  { query: 'Wake Me Up Avicii', genre: 'electronic' },
  { query: 'One More Time Daft Punk', genre: 'electronic' },
  { query: 'Levels Avicii', genre: 'electronic' },
  { query: 'Clarity Zedd', genre: 'electronic' },
  { query: 'Animals Martin Garrix', genre: 'electronic' },
  // R&B / Soul
  { query: 'Location Khalid', genre: 'r-and-b' },
  { query: 'Best Part Daniel Caesar', genre: 'r-and-b' },
  { query: 'Redbone Childish Gambino', genre: 'r-and-b' },
  { query: 'Adorn Miguel', genre: 'r-and-b' },
  { query: 'Pyramids Frank Ocean', genre: 'r-and-b' },
  // Jazz & Blues
  { query: 'Fly Me to the Moon Frank Sinatra', genre: 'jazz' },
  { query: 'What a Wonderful World Louis Armstrong', genre: 'jazz' },
  { query: 'Feeling Good Nina Simone', genre: 'jazz' },
  { query: 'Take Five Dave Brubeck', genre: 'jazz' },
  { query: 'My Way Frank Sinatra', genre: 'jazz' },
  // Classical
  { query: 'Clair de Lune Debussy', genre: 'classical' },
  { query: 'Canon in D Pachelbel', genre: 'classical' },
  { query: 'River Flows in You Yiruma', genre: 'classical' },
  { query: 'Nuvole Bianche Ludovico Einaudi', genre: 'classical' },
  { query: 'Gymnopedie No 1 Erik Satie', genre: 'classical' },
  // Indie & Folk
  { query: 'Ho Hey The Lumineers', genre: 'indie' },
  { query: 'Skinny Love Bon Iver', genre: 'indie' },
  { query: 'Riptide Vance Joy', genre: 'indie' },
  { query: 'Budapest George Ezra', genre: 'indie' },
  { query: 'Little Talks Of Monsters and Men', genre: 'indie' },
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
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchItunesTrack(query: string): Promise<ITunesTrack | null> {
  const url = `https://itunes.apple.com/search?media=music&entity=song&limit=1&term=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = (await response.json()) as { results?: ITunesTrack[] };
    return body.results?.[0] || null;
  } catch {
    return null;
  }
}

const upscaleArtwork = (url?: string): string => {
  if (!url) return '';
  return url.replace(/\d+x\d+bb\.(jpg|png)$/, '600x600bb.$1');
};

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

    // 2. Resolve real song metadata from the iTunes catalog
    console.log('🔎 Resolving real song metadata from the iTunes catalog...');
    const resolved: { track: ITunesTrack; genreSlug: string }[] = [];
    for (const entry of REAL_SONGS) {
      const track = await fetchItunesTrack(entry.query);
      if (!track) {
        console.warn(`  ⚠️  No iTunes match for "${entry.query}", skipping`);
        continue;
      }
      resolved.push({ track, genreSlug: entry.genre });
      await sleep(150); // stay well under iTunes' unpublished per-minute rate limit
    }
    console.log(`✅ Resolved ${resolved.length}/${REAL_SONGS.length} real songs`);

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
        explicit: false,
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
