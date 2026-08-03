import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { Genre } from './models/Genre.js';
import { Artist } from './models/Artist.js';
import { Album } from './models/Album.js';
import { Song } from './models/Song.js';

dotenv.config();

// Royalty-free audio URLs for realistic music playback demo
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

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting HarmonyAI Database Seed...');
    await connectDB();

    // Clear existing catalog data to prevent duplicate accumulation
    console.log('🧹 Clearing existing Songs, Albums, Artists, and Genres...');
    await Promise.all([
      Song.deleteMany({}),
      Album.deleteMany({}),
      Artist.deleteMany({}),
      Genre.deleteMany({}),
    ]);

    // 1. Seed Genres
    console.log('🎵 Seeding Genres...');
    const genreData = [
      {
        name: 'Pop',
        slug: 'pop',
        description: 'Catchy melodies, upbeat rhythms, and modern electronic hit tracks.',
        coverImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop',
        tags: ['pop', 'hits', 'upbeat', 'dance'],
        isFeatured: true,
      },
      {
        name: 'Rock',
        slug: 'rock',
        description: 'Electric guitars, driving drumbeats, and raw vocal energy.',
        coverImage: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&auto=format&fit=crop',
        tags: ['rock', 'alternative', 'guitars', 'energetic'],
        isFeatured: true,
      },
      {
        name: 'Hip-Hop',
        slug: 'hip-hop',
        description: 'Rhythmic beats, expressive poetry, and urban soundscapes.',
        coverImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop',
        tags: ['hiphop', 'rap', 'trap', 'urban'],
        isFeatured: true,
      },
      {
        name: 'Electronic',
        slug: 'electronic',
        description: 'Synthesizers, deep basslines, and immersive electronic grooves.',
        coverImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop',
        tags: ['edm', 'synthwave', 'club', 'house'],
        isFeatured: true,
      },
      {
        name: 'R&B / Soul',
        slug: 'r-and-b',
        description: 'Smooth vocals, soulful melodies, and atmospheric grooves.',
        coverImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop',
        tags: ['rnb', 'soul', 'chill', 'smooth'],
        isFeatured: true,
      },
      {
        name: 'Jazz & Blues',
        slug: 'jazz',
        description: 'Improvisational solos, brass tones, and timeless acoustic swing.',
        coverImage: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&auto=format&fit=crop',
        tags: ['jazz', 'blues', 'acoustic', 'relaxing'],
        isFeatured: false,
      },
      {
        name: 'Classical',
        slug: 'classical',
        description: 'Orchestral arrangements, piano solos, and cinematic themes.',
        coverImage: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=600&auto=format&fit=crop',
        tags: ['classical', 'piano', 'cinematic', 'instrumental'],
        isFeatured: false,
      },
      {
        name: 'Indie & Folk',
        slug: 'indie',
        description: 'Acoustic guitars, dreamy synths, and independent songwriting.',
        coverImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop',
        tags: ['indie', 'folk', 'acoustic', 'chill'],
        isFeatured: true,
      },
    ];

    const genres = await Genre.insertMany(genreData);
    const genreMap = new Map(genres.map((g) => [g.slug, g._id]));

    // 2. Seed Artists
    console.log('🎤 Seeding Artists...');
    const artistData = [
      {
        name: 'The Midnight Wave',
        bio: 'Synthwave duo blending 80s nostalgia with futuristic electronic beats.',
        profileImage: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop',
        bannerImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop',
        genres: [genreMap.get('electronic'), genreMap.get('pop')],
        monthlyListeners: 1250000,
        verified: true,
        tags: ['synthwave', 'electronic', 'retrowave'],
      },
      {
        name: 'Luna Resonance',
        bio: 'Atmospheric indie pop singer-songwriter with hauntingly beautiful vocals.',
        profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop',
        bannerImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop',
        genres: [genreMap.get('indie'), genreMap.get('pop')],
        monthlyListeners: 890000,
        verified: true,
        tags: ['indie', 'dreamy', 'pop'],
      },
      {
        name: 'Apex Pulse',
        bio: 'High-octane EDM producer crafting mainstage festival anthems.',
        profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop',
        bannerImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop',
        genres: [genreMap.get('electronic')],
        monthlyListeners: 2400000,
        verified: true,
        tags: ['edm', 'dance', 'festival'],
      },
      {
        name: 'Velvet Groove',
        bio: 'Contemporary R&B collective with soul-infused basslines and lush harmonies.',
        profileImage: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop',
        bannerImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop',
        genres: [genreMap.get('r-and-b')],
        monthlyListeners: 760000,
        verified: true,
        tags: ['rnb', 'soul', 'chill'],
      },
      {
        name: 'Echoes of Orion',
        bio: 'Alternative rock band pushing boundaries with explosive riffs and introspective lyrics.',
        profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop',
        bannerImage: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=1200&auto=format&fit=crop',
        genres: [genreMap.get('rock')],
        monthlyListeners: 1540000,
        verified: true,
        tags: ['rock', 'alternative', 'guitar'],
      },
      {
        name: 'Rhythm & Rhyme',
        bio: 'Chart-topping hip-hop artist known for intricate storytelling and heavy 808s.',
        profileImage: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop',
        bannerImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop',
        genres: [genreMap.get('hip-hop')],
        monthlyListeners: 3100000,
        verified: true,
        tags: ['hiphop', 'rap', 'urban'],
      },
      {
        name: 'Starlight Quartet',
        bio: 'Modern classical ensemble merging chamber orchestra traditions with film scores.',
        profileImage: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=400&auto=format&fit=crop',
        bannerImage: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=1200&auto=format&fit=crop',
        genres: [genreMap.get('classical')],
        monthlyListeners: 420000,
        verified: false,
        tags: ['classical', 'piano', 'strings'],
      },
      {
        name: 'Blue Horizon',
        bio: 'Jazz quintet captivating audiences with smooth saxophone riffs and swing feel.',
        profileImage: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop',
        bannerImage: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=1200&auto=format&fit=crop',
        genres: [genreMap.get('jazz')],
        monthlyListeners: 380000,
        verified: false,
        tags: ['jazz', 'sax', 'relaxing'],
      },
      {
        name: 'Solaris Nova',
        bio: 'Futuristic synthpop project with neon aesthetics and catchy hooks.',
        profileImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop',
        bannerImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop',
        genres: [genreMap.get('pop'), genreMap.get('electronic')],
        monthlyListeners: 980000,
        verified: true,
        tags: ['synthpop', 'dance', 'electronic'],
      },
      {
        name: 'Acoustic Drift',
        bio: 'Folk & indie duo exploring acoustic strings and organic soundscapes.',
        profileImage: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&auto=format&fit=crop',
        bannerImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop',
        genres: [genreMap.get('indie')],
        monthlyListeners: 540000,
        verified: false,
        tags: ['folk', 'acoustic', 'chill'],
      },
    ];

    const artists = await Artist.insertMany(artistData);
    const artistMap = new Map(artists.map((a) => [a.name, a._id]));

    // 3. Seed Albums
    console.log('💿 Seeding Albums...');
    const albumData = [
      {
        title: 'Neon Skyline',
        artist: artistMap.get('The Midnight Wave'),
        genre: genreMap.get('electronic'),
        coverImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop',
        releaseYear: 2023,
        albumType: 'album',
        totalTracks: 4,
        tags: ['synthwave', 'electronic'],
      },
      {
        title: 'Celestial Whispers',
        artist: artistMap.get('Luna Resonance'),
        genre: genreMap.get('indie'),
        coverImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop',
        releaseYear: 2024,
        albumType: 'album',
        totalTracks: 5,
        tags: ['indie', 'dreamy'],
      },
      {
        title: 'Overdrive',
        artist: artistMap.get('Apex Pulse'),
        genre: genreMap.get('electronic'),
        coverImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop',
        releaseYear: 2024,
        albumType: 'album',
        totalTracks: 5,
        tags: ['edm', 'dance'],
      },
      {
        title: 'Midnight Lounge',
        artist: artistMap.get('Velvet Groove'),
        genre: genreMap.get('r-and-b'),
        coverImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop',
        releaseYear: 2023,
        albumType: 'album',
        totalTracks: 5,
        tags: ['rnb', 'soul'],
      },
      {
        title: 'Thunder & Dust',
        artist: artistMap.get('Echoes of Orion'),
        genre: genreMap.get('rock'),
        coverImage: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&auto=format&fit=crop',
        releaseYear: 2022,
        albumType: 'album',
        totalTracks: 5,
        tags: ['rock', 'alternative'],
      },
      {
        title: 'Urban Chronicles',
        artist: artistMap.get('Rhythm & Rhyme'),
        genre: genreMap.get('hip-hop'),
        coverImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop',
        releaseYear: 2025,
        albumType: 'album',
        totalTracks: 5,
        tags: ['hiphop', 'rap'],
      },
      {
        title: 'Symphony of Lights',
        artist: artistMap.get('Starlight Quartet'),
        genre: genreMap.get('classical'),
        coverImage: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=500&auto=format&fit=crop',
        releaseYear: 2021,
        albumType: 'album',
        totalTracks: 5,
        tags: ['classical', 'piano'],
      },
      {
        title: 'Midnight in Harlem',
        artist: artistMap.get('Blue Horizon'),
        genre: genreMap.get('jazz'),
        coverImage: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=500&auto=format&fit=crop',
        releaseYear: 2023,
        albumType: 'album',
        totalTracks: 5,
        tags: ['jazz', 'relaxing'],
      },
      {
        title: 'Electric Dreams',
        artist: artistMap.get('Solaris Nova'),
        genre: genreMap.get('pop'),
        coverImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop',
        releaseYear: 2024,
        albumType: 'album',
        totalTracks: 5,
        tags: ['synthpop', 'pop'],
      },
      {
        title: 'Woodland Echoes',
        artist: artistMap.get('Acoustic Drift'),
        genre: genreMap.get('indie'),
        coverImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop',
        releaseYear: 2023,
        albumType: 'album',
        totalTracks: 5,
        tags: ['folk', 'acoustic'],
      },
    ];

    const albums = await Album.insertMany(albumData);
    const albumMap = new Map(albums.map((al) => [al.title, al._id]));

    // 4. Seed ~50 Songs
    console.log('🎶 Seeding 50 Songs with Audio Features & Recommendation Metadata...');

    const songTemplates = [
      // Pop Songs (1-7)
      { title: 'Starlight Avenue', artist: 'Solaris Nova', album: 'Electric Dreams', genre: 'pop', duration: 215, bpm: 120, energy: 0.8, valence: 0.85 },
      { title: 'Neon Hearts', artist: 'Solaris Nova', album: 'Electric Dreams', genre: 'pop', duration: 198, bpm: 118, energy: 0.75, valence: 0.90 },
      { title: 'Midnight Crush', artist: 'Solaris Nova', album: 'Electric Dreams', genre: 'pop', duration: 210, bpm: 124, energy: 0.82, valence: 0.78 },
      { title: 'Golden Hour Vibe', artist: 'Solaris Nova', album: 'Electric Dreams', genre: 'pop', duration: 185, bpm: 115, energy: 0.70, valence: 0.88 },
      { title: 'Dancing in Berlin', artist: 'Solaris Nova', album: 'Electric Dreams', genre: 'pop', duration: 230, bpm: 126, energy: 0.88, valence: 0.82 },
      { title: 'Summer High', artist: 'The Midnight Wave', album: 'Neon Skyline', genre: 'pop', duration: 204, bpm: 116, energy: 0.78, valence: 0.92 },
      { title: 'Electric Glow', artist: 'The Midnight Wave', album: 'Neon Skyline', genre: 'pop', duration: 222, bpm: 122, energy: 0.85, valence: 0.80 },

      // Rock Songs (8-13)
      { title: 'Rebel Horizon', artist: 'Echoes of Orion', album: 'Thunder & Dust', genre: 'rock', duration: 245, bpm: 138, energy: 0.92, valence: 0.65 },
      { title: 'Shattered Glass', artist: 'Echoes of Orion', album: 'Thunder & Dust', genre: 'rock', duration: 210, bpm: 142, energy: 0.95, valence: 0.50 },
      { title: 'Midnight Lightning', artist: 'Echoes of Orion', album: 'Thunder & Dust', genre: 'rock', duration: 255, bpm: 130, energy: 0.88, valence: 0.60 },
      { title: 'Chasing Ghosts', artist: 'Echoes of Orion', album: 'Thunder & Dust', genre: 'rock', duration: 238, bpm: 135, energy: 0.90, valence: 0.55 },
      { title: 'Rumble & Burn', artist: 'Echoes of Orion', album: 'Thunder & Dust', genre: 'rock', duration: 195, bpm: 145, energy: 0.96, valence: 0.70 },
      { title: 'Wild Heart Flame', artist: 'Echoes of Orion', album: 'Thunder & Dust', genre: 'rock', duration: 228, bpm: 132, energy: 0.89, valence: 0.62 },

      // Hip-Hop Songs (14-19)
      { title: 'City Lights & 808s', artist: 'Rhythm & Rhyme', album: 'Urban Chronicles', genre: 'hip-hop', duration: 205, bpm: 95, energy: 0.80, valence: 0.68 },
      { title: 'Hustle State of Mind', artist: 'Rhythm & Rhyme', album: 'Urban Chronicles', genre: 'hip-hop', duration: 190, bpm: 92, energy: 0.85, valence: 0.72 },
      { title: 'Top Floor Views', artist: 'Rhythm & Rhyme', album: 'Urban Chronicles', genre: 'hip-hop', duration: 218, bpm: 98, energy: 0.78, valence: 0.60 },
      { title: 'Concrete Kingdom', artist: 'Rhythm & Rhyme', album: 'Urban Chronicles', genre: 'hip-hop', duration: 212, bpm: 90, energy: 0.82, valence: 0.65 },
      { title: 'Midnight Cypher', artist: 'Rhythm & Rhyme', album: 'Urban Chronicles', genre: 'hip-hop', duration: 240, bpm: 102, energy: 0.88, valence: 0.75 },
      { title: 'Platinum Dreams', artist: 'Rhythm & Rhyme', album: 'Urban Chronicles', genre: 'hip-hop', duration: 200, bpm: 96, energy: 0.81, valence: 0.70 },

      // Electronic / EDM Songs (20-27)
      { title: 'Cybernetic Drive', artist: 'Apex Pulse', album: 'Overdrive', genre: 'electronic', duration: 260, bpm: 128, energy: 0.94, valence: 0.75 },
      { title: 'Neon Pulse', artist: 'Apex Pulse', album: 'Overdrive', genre: 'electronic', duration: 245, bpm: 130, energy: 0.96, valence: 0.80 },
      { title: 'Hyperion Frequency', artist: 'Apex Pulse', album: 'Overdrive', genre: 'electronic', duration: 275, bpm: 132, energy: 0.98, valence: 0.68 },
      { title: 'Laser Grid', artist: 'Apex Pulse', album: 'Overdrive', genre: 'electronic', duration: 230, bpm: 126, energy: 0.92, valence: 0.72 },
      { title: 'Synthwave City', artist: 'The Midnight Wave', album: 'Neon Skyline', genre: 'electronic', duration: 250, bpm: 120, energy: 0.84, valence: 0.82 },
      { title: 'Retro Sunset', artist: 'The Midnight Wave', album: 'Neon Skyline', genre: 'electronic', duration: 235, bpm: 118, energy: 0.80, valence: 0.88 },
      { title: 'Digital Odyssey', artist: 'The Midnight Wave', album: 'Neon Skyline', genre: 'electronic', duration: 280, bpm: 124, energy: 0.86, valence: 0.74 },
      { title: 'Bassline Pressure', artist: 'Apex Pulse', album: 'Overdrive', genre: 'electronic', duration: 210, bpm: 129, energy: 0.95, valence: 0.78 },

      // R&B / Soul Songs (28-33)
      { title: 'Velvet Rain', artist: 'Velvet Groove', album: 'Midnight Lounge', genre: 'r-and-b', duration: 230, bpm: 82, energy: 0.55, valence: 0.65 },
      { title: 'Midnight Silk', artist: 'Velvet Groove', album: 'Midnight Lounge', genre: 'r-and-b', duration: 245, bpm: 85, energy: 0.50, valence: 0.60 },
      { title: 'Soul Connection', artist: 'Velvet Groove', album: 'Midnight Lounge', genre: 'r-and-b', duration: 220, bpm: 88, energy: 0.60, valence: 0.72 },
      { title: 'Moonlight Serenade', artist: 'Velvet Groove', album: 'Midnight Lounge', genre: 'r-and-b', duration: 210, bpm: 80, energy: 0.48, valence: 0.58 },
      { title: 'Deepest Desire', artist: 'Velvet Groove', album: 'Midnight Lounge', genre: 'r-and-b', duration: 250, bpm: 84, energy: 0.52, valence: 0.64 },
      { title: 'Slow Burn', artist: 'Velvet Groove', album: 'Midnight Lounge', genre: 'r-and-b', duration: 238, bpm: 86, energy: 0.58, valence: 0.66 },

      // Jazz & Blues Songs (34-39)
      { title: 'Blue Velvet Solitude', artist: 'Blue Horizon', album: 'Midnight in Harlem', genre: 'jazz', duration: 280, bpm: 75, energy: 0.42, valence: 0.50 },
      { title: 'Harlem Saxophone', artist: 'Blue Horizon', album: 'Midnight in Harlem', genre: 'jazz', duration: 310, bpm: 88, energy: 0.48, valence: 0.62 },
      { title: 'Autumn Leaf Waltz', artist: 'Blue Horizon', album: 'Midnight in Harlem', genre: 'jazz', duration: 265, bpm: 92, energy: 0.45, valence: 0.55 },
      { title: 'Smokey Corner', artist: 'Blue Horizon', album: 'Midnight in Harlem', genre: 'jazz', duration: 295, bpm: 78, energy: 0.40, valence: 0.48 },
      { title: 'Midnight Jam Session', artist: 'Blue Horizon', album: 'Midnight in Harlem', genre: 'jazz', duration: 320, bpm: 105, energy: 0.65, valence: 0.75 },
      { title: 'Whispering Winds', artist: 'Blue Horizon', album: 'Midnight in Harlem', genre: 'jazz', duration: 270, bpm: 82, energy: 0.44, valence: 0.52 },

      // Classical Songs (40-44)
      { title: 'Nocturne in C Minor', artist: 'Starlight Quartet', album: 'Symphony of Lights', genre: 'classical', duration: 340, bpm: 68, energy: 0.35, valence: 0.40 },
      { title: 'Violin Concerto No. 4', artist: 'Starlight Quartet', album: 'Symphony of Lights', genre: 'classical', duration: 390, bpm: 110, energy: 0.62, valence: 0.58 },
      { title: 'Moonlit Sonata', artist: 'Starlight Quartet', album: 'Symphony of Lights', genre: 'classical', duration: 310, bpm: 72, energy: 0.38, valence: 0.42 },
      { title: 'Overture of Stars', artist: 'Starlight Quartet', album: 'Symphony of Lights', genre: 'classical', duration: 360, bpm: 115, energy: 0.70, valence: 0.65 },
      { title: 'Elegiac Adagio', artist: 'Starlight Quartet', album: 'Symphony of Lights', genre: 'classical', duration: 330, bpm: 60, energy: 0.30, valence: 0.35 },

      // Indie & Folk Songs (45-50)
      { title: 'Whispering Pines', artist: 'Acoustic Drift', album: 'Woodland Echoes', genre: 'indie', duration: 225, bpm: 98, energy: 0.50, valence: 0.62 },
      { title: 'Mountain Mist', artist: 'Acoustic Drift', album: 'Woodland Echoes', genre: 'indie', duration: 240, bpm: 95, energy: 0.45, valence: 0.58 },
      { title: 'Campfire Stories', artist: 'Acoustic Drift', album: 'Woodland Echoes', genre: 'indie', duration: 210, bpm: 102, energy: 0.55, valence: 0.70 },
      { title: 'Echoes in the Fog', artist: 'Luna Resonance', album: 'Celestial Whispers', genre: 'indie', duration: 250, bpm: 90, energy: 0.48, valence: 0.52 },
      { title: 'Celestial Horizon', artist: 'Luna Resonance', album: 'Celestial Whispers', genre: 'indie', duration: 235, bpm: 104, energy: 0.60, valence: 0.75 },
      { title: 'Folk Tales of October', artist: 'Acoustic Drift', album: 'Woodland Echoes', genre: 'indie', duration: 260, bpm: 92, energy: 0.42, valence: 0.50 },
    ];

    const songsToInsert = songTemplates.map((tmpl, idx) => {
      const artistId = artistMap.get(tmpl.artist);
      const albumId = albumMap.get(tmpl.album);
      const genreId = genreMap.get(tmpl.genre);
      const sampleAudioUrl = AUDIO_SAMPLE_URLS[idx % AUDIO_SAMPLE_URLS.length];
      const playCount = Math.floor(Math.random() * 450000) + 5000;
      const releaseYear = 2020 + (idx % 6);

      return {
        title: tmpl.title,
        artist: artistId,
        album: albumId,
        genre: genreId,
        duration: tmpl.duration,
        coverImage: `https://images.unsplash.com/photo-${1518709268805 + idx}?w=500&auto=format&fit=crop`,
        audioUrl: sampleAudioUrl,
        releaseYear,
        playCount,
        audioFeatures: {
          bpm: tmpl.bpm,
          energy: tmpl.energy,
          danceability: Math.round((0.5 + Math.random() * 0.4) * 100) / 100,
          valence: tmpl.valence,
          acousticness: tmpl.genre === 'classical' || tmpl.genre === 'indie' || tmpl.genre === 'jazz' ? 0.8 : 0.2,
          instrumentalness: tmpl.genre === 'classical' ? 0.9 : 0.1,
        },
        tags: [tmpl.genre, 'harmonyai-seed', tmpl.bpm > 120 ? 'upbeat' : 'chill'],
        language: 'English',
        explicit: false,
        isPublished: true,
      };
    });

    const songs = await Song.insertMany(songsToInsert);

    console.log('\n==================================================');
    console.log('🎉 HarmonyAI Database Seeding Complete Successfully!');
    console.log('==================================================');
    console.log(`📊 Total Genres Created: ${genres.length}`);
    console.log(`🎤 Total Artists Created: ${artists.length}`);
    console.log(`💿 Total Albums Created:  ${albums.length}`);
    console.log(`🎶 Total Songs Created:   ${songs.length}`);
    console.log('==================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during database seeding:', error);
    process.exit(1);
  }
};

seedDatabase();
