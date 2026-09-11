import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { supabase } from './config/supabase.js';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/harmonyai';

/**
 * Deterministically maps a 24-character hexadecimal MongoDB ObjectId string into a valid RFC-4122 v4 UUID.
 * This guarantees identical foreign keys match across all related tables without collisions.
 */
export function toUuid(id: any): string {
  if (!id) return '';
  const hex = id.toString().toLowerCase().replace(/[^0-9a-f]/g, '').padStart(24, '0');
  // Format: 8-4-4-4-12
  const p1 = hex.slice(0, 8);
  const p2 = hex.slice(8, 12);
  const p3 = `4${hex.slice(12, 15)}`;
  const p4 = `a${hex.slice(15, 18)}`;
  const p5 = `${hex.slice(18, 24)}000000`;
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

async function batchInsert(table: string, rows: any[], chunkSize = 400) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await (supabase.from(table as any) as any).insert(chunk);
    if (error) {
      throw new Error(`[Supabase Insert Error in ${table} (chunk ${i / chunkSize})]: ${error.message}`);
    }
  }
}

export async function migrateMongoToSupabase() {
  console.log('===============================================================');
  console.log('🚀 HARMONYAI: LIVE MIGRATION FROM MONGODB TO SUPABASE');
  console.log(`Connecting to MongoDB: ${MONGO_URI}`);
  console.log(`Target Supabase URL:  ${process.env.SUPABASE_URL || 'https://xyjfwwztbtsqzegargpa.supabase.co'}`);
  console.log('===============================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB.');

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB database handle not available.');
  }

  // 1. Fetch source collections from MongoDB
  console.log('📦 Reading source MongoDB collections...');
  const mongoGenres = await db.collection('genres').find({}).toArray();
  const mongoArtists = await db.collection('artists').find({}).toArray();
  const mongoAlbums = await db.collection('albums').find({}).toArray();
  const mongoSongs = await db.collection('songs').find({}).toArray();
  const mongoUsers = await db.collection('users').find({}).toArray();
  const mongoMusicDnas = await db.collection('musicdnas').find({}).toArray();
  const mongoSnapshots = await db.collection('musicdnasnapshots').find({}).toArray();
  const mongoTwins = await db.collection('personalmusictwins').find({}).toArray();
  const mongoSessions = await db.collection('listeningsessions').find({}).toArray();
  const mongoHistories = await db.collection('listeninghistories').find({}).toArray();
  const mongoEvaluations = await db.collection('recommendationevaluations').find({}).toArray();
  const mongoInteractions = await db.collection('recommendationinteractions').find({}).toArray();

  console.log(`Found:
  - Genres:                     ${mongoGenres.length}
  - Artists:                    ${mongoArtists.length}
  - Albums:                     ${mongoAlbums.length}
  - Songs:                      ${mongoSongs.length}
  - Users:                      ${mongoUsers.length}
  - Music DNAs:                 ${mongoMusicDnas.length}
  - Music DNA Snapshots:        ${mongoSnapshots.length}
  - Personal Music Twins:       ${mongoTwins.length}
  - Listening Sessions:         ${mongoSessions.length}
  - Listening Histories:        ${mongoHistories.length}
  - Recommendation Evaluations: ${mongoEvaluations.length}
  - Recommendation Interactions:${mongoInteractions.length}\n`);

  // Build key sets for referential validation
  const validGenreIds = new Set<string>();
  const validArtistIds = new Set<string>();
  const validAlbumIds = new Set<string>();
  const validSongIds = new Set<string>();
  const validUserIds = new Set<string>();

  // 2. Clear existing Supabase data (in reverse foreign key dependency order)
  console.log('🧹 Cleaning target Supabase tables...');
  const tablesToClean = [
    'recommendation_interactions',
    'recommendation_evaluations',
    'recommendation_contexts',
    'listening_history',
    'listening_sessions',
    'personal_music_twin',
    'music_dna_snapshots',
    'music_dna',
    'user_favorite_genres',
    'user_favorite_artists',
    'user_liked_songs',
    'song_featured_artists',
    'songs',
    'album_featured_artists',
    'albums',
    'artist_genres',
    'artists',
    'genres',
    'users',
  ];

  for (const tbl of tablesToClean) {
    const { error } = await (supabase.from(tbl as any) as any)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error && !error.message.includes('column "id" does not exist')) {
      // Table might not have an "id" column (e.g. join tables)
      if (tbl === 'artist_genres') {
        await (supabase.from(tbl as any) as any).delete().neq('artist_id', '00000000-0000-0000-0000-000000000000');
      } else if (tbl === 'album_featured_artists') {
        await (supabase.from(tbl as any) as any).delete().neq('album_id', '00000000-0000-0000-0000-000000000000');
      } else if (tbl === 'song_featured_artists') {
        await (supabase.from(tbl as any) as any).delete().neq('song_id', '00000000-0000-0000-0000-000000000000');
      } else if (tbl.startsWith('user_')) {
        await (supabase.from(tbl as any) as any).delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
      }
    }
  }
  console.log('✅ Tables cleaned.\n');

  // Phase 1: Migrate Genres
  console.log('🔄 Migrating Genres...');
  const genreRows = mongoGenres.map((g) => {
    const gid = toUuid(g._id);
    validGenreIds.add(gid);
    return {
      id: gid,
      name: g.name,
      slug: g.slug || g.name.toLowerCase().replace(/\s+/g, '-'),
      description: g.description || '',
      cover_image: g.coverImage || '',
      parent_genre_id: g.parentGenre ? toUuid(g.parentGenre) : null,
      tags: Array.isArray(g.tags) ? g.tags : [],
      is_featured: Boolean(g.isFeatured),
      created_at: g.createdAt ? new Date(g.createdAt).toISOString() : new Date().toISOString(),
      updated_at: g.updatedAt ? new Date(g.updatedAt).toISOString() : new Date().toISOString(),
    };
  });
  await batchInsert('genres', genreRows);
  console.log(`✅ Migrated ${genreRows.length} genres.`);

  // Phase 2: Migrate Artists & artist_genres
  console.log('🔄 Migrating Artists...');
  const artistRows: any[] = [];
  const artistGenreRows: { artist_id: string; genre_id: string }[] = [];

  for (const a of mongoArtists) {
    const aid = toUuid(a._id);
    validArtistIds.add(aid);

    artistRows.push({
      id: aid,
      name: a.name,
      bio: a.bio || '',
      profile_image: a.profileImage || '',
      avatar: a.avatar || '',
      banner_image: a.bannerImage || '',
      monthly_listeners: a.monthlyListeners || 0,
      verified: Boolean(a.verified),
      tags: Array.isArray(a.tags) ? a.tags : [],
      social_links: a.socialLinks || {},
      similar_artists: Array.isArray(a.similarArtists) ? a.similarArtists.map(toUuid) : [],
      vector_embedding: Array.isArray(a.vectorEmbedding) ? a.vectorEmbedding : null,
      recommendation_metadata: a.recommendationMetadata || {},
      created_at: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
      updated_at: a.updatedAt ? new Date(a.updatedAt).toISOString() : new Date().toISOString(),
    });

    if (Array.isArray(a.genres)) {
      for (const gId of a.genres) {
        const mappedGid = toUuid(gId);
        if (validGenreIds.has(mappedGid)) {
          artistGenreRows.push({ artist_id: aid, genre_id: mappedGid });
        }
      }
    }
  }
  await batchInsert('artists', artistRows);
  if (artistGenreRows.length > 0) {
    await batchInsert('artist_genres', artistGenreRows);
  }
  console.log(`✅ Migrated ${artistRows.length} artists (${artistGenreRows.length} genre associations).`);

  // Phase 3: Migrate Albums & album_featured_artists
  console.log('🔄 Migrating Albums...');
  const albumRows: any[] = [];
  const albumFeaturedArtistRows: { album_id: string; artist_id: string }[] = [];

  for (const al of mongoAlbums) {
    const alid = toUuid(al._id);
    const artistId = toUuid(al.artist);
    if (!validArtistIds.has(artistId)) continue;

    validAlbumIds.add(alid);
    const genreId = al.genre ? toUuid(al.genre) : null;

    albumRows.push({
      id: alid,
      title: al.title,
      artist_id: artistId,
      genre_id: genreId && validGenreIds.has(genreId) ? genreId : null,
      cover_image: al.coverImage || '',
      release_year: al.releaseYear || null,
      release_date: al.releaseDate ? new Date(al.releaseDate).toISOString() : null,
      album_type: al.albumType || 'album',
      total_tracks: al.totalTracks || 1,
      tags: Array.isArray(al.tags) ? al.tags : [],
      created_at: al.createdAt ? new Date(al.createdAt).toISOString() : new Date().toISOString(),
      updated_at: al.updatedAt ? new Date(al.updatedAt).toISOString() : new Date().toISOString(),
    });

    if (Array.isArray(al.featuredArtists)) {
      for (const faId of al.featuredArtists) {
        const faUuid = toUuid(faId);
        if (validArtistIds.has(faUuid)) {
          albumFeaturedArtistRows.push({ album_id: alid, artist_id: faUuid });
        }
      }
    }
  }
  await batchInsert('albums', albumRows);
  if (albumFeaturedArtistRows.length > 0) {
    await batchInsert('album_featured_artists', albumFeaturedArtistRows);
  }
  console.log(`✅ Migrated ${albumRows.length} albums.`);

  // Phase 4: Migrate Songs & song_featured_artists
  console.log('🔄 Migrating Songs...');
  const songRows: any[] = [];
  const songFeaturedArtistRows: { song_id: string; artist_id: string }[] = [];

  for (const s of mongoSongs) {
    const sid = toUuid(s._id);
    const artistId = toUuid(s.artist);
    const genreId = toUuid(s.genre);

    if (!validArtistIds.has(artistId) || !validGenreIds.has(genreId)) continue;
    validSongIds.add(sid);

    const albumId = s.album ? toUuid(s.album) : null;

    songRows.push({
      id: sid,
      title: s.title,
      artist_id: artistId,
      album_id: albumId && validAlbumIds.has(albumId) ? albumId : null,
      genre_id: genreId,
      duration: s.duration || 0,
      cover_image: s.coverImage || '',
      audio_url: s.audioUrl || '',
      release_year: s.releaseYear || null,
      play_count: s.playCount || 0,
      audio_features: s.audioFeatures || {},
      mood: s.mood || 'Chill',
      tags: Array.isArray(s.tags) ? s.tags : [],
      language: s.language || 'English',
      explicit: Boolean(s.explicit),
      lyrics: s.lyrics || '',
      is_published: s.isPublished !== false,
      vector_embedding: Array.isArray(s.vectorEmbedding) ? s.vectorEmbedding : null,
      recommendation_metadata: s.recommendationMetadata || {},
      created_at: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
      updated_at: s.updatedAt ? new Date(s.updatedAt).toISOString() : new Date().toISOString(),
    });

    if (Array.isArray(s.featuredArtists)) {
      for (const faId of s.featuredArtists) {
        const faUuid = toUuid(faId);
        if (validArtistIds.has(faUuid)) {
          songFeaturedArtistRows.push({ song_id: sid, artist_id: faUuid });
        }
      }
    }
  }
  await batchInsert('songs', songRows);
  if (songFeaturedArtistRows.length > 0) {
    await batchInsert('song_featured_artists', songFeaturedArtistRows);
  }
  console.log(`✅ Migrated ${songRows.length} songs.`);

  // Phase 5: Migrate Users & User preferences
  console.log('🔄 Migrating Users...');
  const userRows: any[] = [];
  const userLikedSongs: { user_id: string; song_id: string; created_at: string }[] = [];
  const userFavArtists: { user_id: string; artist_id: string; created_at: string }[] = [];
  const userFavGenres: { user_id: string; genre_id: string; created_at: string }[] = [];

  // Track emails to prevent duplicate email constraint violations if any
  const seenEmails = new Set<string>();

  for (const u of mongoUsers) {
    const uid = toUuid(u._id);
    const email = u.email ? u.email.toLowerCase().trim() : `user_${uid.slice(0, 8)}@harmonyai.local`;
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);

    validUserIds.add(uid);

    const createdAt = u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString();
    const updatedAt = u.updatedAt ? new Date(u.updatedAt).toISOString() : new Date().toISOString();

    userRows.push({
      id: uid,
      clerk_id: u.clerkId || null,
      name: u.name || 'User',
      email: email,
      password_hash: u.password || null,
      profile_picture: u.profilePicture || '',
      created_at: createdAt,
      updated_at: updatedAt,
    });

    if (Array.isArray(u.likedSongs)) {
      for (const sid of u.likedSongs) {
        const mappedSid = toUuid(sid);
        if (validSongIds.has(mappedSid)) {
          userLikedSongs.push({ user_id: uid, song_id: mappedSid, created_at: createdAt });
        }
      }
    }

    if (Array.isArray(u.favoriteArtists)) {
      for (const aid of u.favoriteArtists) {
        const mappedAid = toUuid(aid);
        if (validArtistIds.has(mappedAid)) {
          userFavArtists.push({ user_id: uid, artist_id: mappedAid, created_at: createdAt });
        }
      }
    }

    if (Array.isArray(u.favoriteGenres)) {
      for (const gid of u.favoriteGenres) {
        const mappedGid = toUuid(gid);
        if (validGenreIds.has(mappedGid)) {
          userFavGenres.push({ user_id: uid, genre_id: mappedGid, created_at: createdAt });
        }
      }
    }
  }
  await batchInsert('users', userRows);
  if (userLikedSongs.length > 0) await batchInsert('user_liked_songs', userLikedSongs);
  if (userFavArtists.length > 0) await batchInsert('user_favorite_artists', userFavArtists);
  if (userFavGenres.length > 0) await batchInsert('user_favorite_genres', userFavGenres);
  console.log(`✅ Migrated ${userRows.length} users.`);

  // Phase 6: Migrate Music DNA & Snapshots
  console.log('🔄 Migrating Music DNA & Snapshots...');
  const musicDnaRows: any[] = [];
  const seenDnaUsers = new Set<string>();

  for (const m of mongoMusicDnas) {
    const uid = toUuid(m.user || m.userId);
    if (!validUserIds.has(uid) || seenDnaUsers.has(uid)) continue;
    seenDnaUsers.add(uid);

    musicDnaRows.push({
      id: toUuid(m._id),
      user_id: uid,
      genres: m.genres || [],
      artists: m.artists || [],
      moods: m.moods || [],
      listening_patterns: m.listeningPatterns || {},
      tendencies: m.tendencies || {},
      temporal_taste: m.temporalTaste || {},
      version: m.version || 1,
      last_calculated_at: m.lastCalculatedAt ? new Date(m.lastCalculatedAt).toISOString() : new Date().toISOString(),
      created_at: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
      updated_at: m.updatedAt ? new Date(m.updatedAt).toISOString() : new Date().toISOString(),
    });
  }
  if (musicDnaRows.length > 0) await batchInsert('music_dna', musicDnaRows);

  const snapshotRows: any[] = [];
  for (const s of mongoSnapshots) {
    const uid = toUuid(s.user || s.userId);
    if (!validUserIds.has(uid)) continue;

    snapshotRows.push({
      id: toUuid(s._id),
      user_id: uid,
      snapshot_date: s.snapshotDate ? new Date(s.snapshotDate).toISOString() : new Date().toISOString(),
      genres: s.genres || [],
      artists: s.artists || [],
      moods: s.moods || [],
      tendencies: s.tendencies || {},
      listening_patterns: s.listeningPatterns || {},
      created_at: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
    });
  }
  if (snapshotRows.length > 0) await batchInsert('music_dna_snapshots', snapshotRows);
  console.log(`✅ Migrated ${musicDnaRows.length} music DNAs and ${snapshotRows.length} snapshots.`);

  // Phase 7: Migrate Personal Music Twin
  console.log('🔄 Migrating Personal Music Twin profiles...');
  const twinRows: any[] = [];
  const seenTwinUsers = new Set<string>();

  for (const p of mongoTwins) {
    const uid = toUuid(p.user || p.userId);
    if (!validUserIds.has(uid) || seenTwinUsers.has(uid)) continue;
    seenTwinUsers.add(uid);

    twinRows.push({
      id: toUuid(p._id),
      user_id: uid,
      musical_traits: p.musicalTraits || {},
      genre_identity: p.genreIdentity || {},
      mood_identity: p.moodIdentity || {},
      listening_behavior: p.listeningBehavior || {},
      taste_stability: p.tasteStability || {},
      taste_evolution: p.tasteEvolution || {},
      emerging_interests: p.emergingInterests || [],
      personality_profile: p.personalityProfile || {},
      compatibility_dimensions: p.compatibilityDimensions || {},
      last_sync_at: p.lastSyncAt || p.lastUpdatedTimestamp ? new Date(p.lastSyncAt || p.lastUpdatedTimestamp).toISOString() : new Date().toISOString(),
      created_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
      updated_at: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
    });
  }
  if (twinRows.length > 0) await batchInsert('personal_music_twin', twinRows);
  console.log(`✅ Migrated ${twinRows.length} Personal Music Twins.`);

  // Phase 8: Migrate Listening Sessions
  console.log('🔄 Migrating Listening Sessions...');
  const sessionRows: any[] = [];
  for (const ls of mongoSessions) {
    const uid = toUuid(ls.user || ls.userId);
    if (!validUserIds.has(uid)) continue;

    sessionRows.push({
      id: toUuid(ls._id),
      user_id: uid,
      session_start: ls.sessionStart ? new Date(ls.sessionStart).toISOString() : new Date().toISOString(),
      session_end: ls.sessionEnd ? new Date(ls.sessionEnd).toISOString() : null,
      initial_intent: ls.initialIntent || 'discovery',
      device_context: ls.deviceContext || {},
      session_dynamics: ls.sessionDynamics || {},
      tracks_played: ls.tracksPlayed || [],
      created_at: ls.createdAt ? new Date(ls.createdAt).toISOString() : new Date().toISOString(),
      updated_at: ls.updatedAt ? new Date(ls.updatedAt).toISOString() : new Date().toISOString(),
    });
  }
  if (sessionRows.length > 0) await batchInsert('listening_sessions', sessionRows);
  console.log(`✅ Migrated ${sessionRows.length} listening sessions.`);

  // Phase 9: Migrate Listening History
  console.log('🔄 Migrating Listening History...');
  const historyRows: any[] = [];
  for (const lh of mongoHistories) {
    const uid = toUuid(lh.user || lh.userId);
    const sid = toUuid(lh.song || lh.songId);
    if (!validUserIds.has(uid) || !validSongIds.has(sid)) continue;

    historyRows.push({
      id: toUuid(lh._id),
      user_id: uid,
      song_id: sid,
      played_at: lh.playedAt ? new Date(lh.playedAt).toISOString() : new Date().toISOString(),
      completed: Boolean(lh.completed),
      skipped: Boolean(lh.skipped),
      progress_percent: typeof lh.progressPercent === 'number' ? lh.progressPercent : 100,
      created_at: lh.createdAt ? new Date(lh.createdAt).toISOString() : new Date().toISOString(),
    });
  }
  if (historyRows.length > 0) await batchInsert('listening_history', historyRows);
  console.log(`✅ Migrated ${historyRows.length} listening history entries.`);

  // Phase 10: Migrate Recommendation Evaluations
  console.log('🔄 Migrating Recommendation Evaluations...');
  const evalRows: any[] = [];
  for (const re of mongoEvaluations) {
    const uid = toUuid(re.user || re.userId);
    if (!validUserIds.has(uid)) continue;

    evalRows.push({
      id: toUuid(re._id),
      user_id: uid,
      metrics: {
        source: re.source,
        signals: re.signals,
        recommendationScore: re.recommendationScore,
        played: re.played,
        skipped: re.skipped,
        liked: re.liked,
        saved: re.saved,
        evaluationScore: re.evaluationScore,
        metadata: re.metadata,
      },
      evaluated_at: re.evaluatedAt
        ? new Date(re.evaluatedAt).toISOString()
        : re.timestamp
        ? new Date(re.timestamp).toISOString()
        : new Date().toISOString(),
      created_at: re.createdAt ? new Date(re.createdAt).toISOString() : new Date().toISOString(),
    });
  }
  if (evalRows.length > 0) await batchInsert('recommendation_evaluations', evalRows);
  console.log(`✅ Migrated ${evalRows.length} recommendation evaluations.`);

  // Phase 11: Migrate Recommendation Interactions (batched)
  console.log('🔄 Migrating Recommendation Interactions...');
  const interactionRows: any[] = [];
  for (const ri of mongoInteractions) {
    const uid = toUuid(ri.user || ri.userId);
    const sid = toUuid(ri.song || ri.songId);
    if (!validUserIds.has(uid) || !validSongIds.has(sid)) continue;

    interactionRows.push({
      id: toUuid(ri._id),
      user_id: uid,
      recommendation_id: ri.recommendationId || ri.recommendationSource || null,
      song_id: sid,
      action: ri.action || 'impression',
      position: typeof ri.position === 'number' ? ri.position : 0,
      metadata: ri.metadata || (ri.recommendationSource ? { source: ri.recommendationSource } : {}),
      created_at: ri.createdAt || ri.timestamp ? new Date(ri.createdAt || ri.timestamp).toISOString() : new Date().toISOString(),
    });
  }
  console.log(`Inserting ${interactionRows.length} valid recommendation interactions in batches...`);
  await batchInsert('recommendation_interactions', interactionRows, 500);
  console.log(`✅ Migrated ${interactionRows.length} recommendation interactions.`);

  // Final summary
  console.log('\n===============================================================');
  console.log('🎉 HARMONYAI MIGRATION TO SUPABASE COMPLETED SUCCESSFULLY!');
  console.log('===============================================================');
  console.log(`- Genres:                      ${genreRows.length}`);
  console.log(`- Artists:                     ${artistRows.length}`);
  console.log(`- Artist Genres:               ${artistGenreRows.length}`);
  console.log(`- Albums:                      ${albumRows.length}`);
  console.log(`- Songs:                       ${songRows.length}`);
  console.log(`- Users:                       ${userRows.length}`);
  console.log(`- Music DNA:                   ${musicDnaRows.length}`);
  console.log(`- Music DNA Snapshots:         ${snapshotRows.length}`);
  console.log(`- Personal Music Twins:        ${twinRows.length}`);
  console.log(`- Listening Sessions:          ${sessionRows.length}`);
  console.log(`- Listening History:           ${historyRows.length}`);
  console.log(`- Recommendation Evaluations:  ${evalRows.length}`);
  console.log(`- Recommendation Interactions: ${interactionRows.length}`);
  console.log('===============================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

// Execute migration
migrateMongoToSupabase().catch(async (err) => {
  console.error('\n❌ Migration failed:', err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
