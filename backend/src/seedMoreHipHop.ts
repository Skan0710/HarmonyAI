import dotenv from 'dotenv';
import { supabase } from './config/supabase.js';
import {
  fetchArtistId,
  fetchArtistAlbums,
  fetchAlbumTracks,
  upscaleArtwork,
  AUDIO_SAMPLE_URLS,
  GENRE_AUDIO_DEFAULTS,
  type ITunesTrack,
} from './seed.js';

dotenv.config();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Additive top-up only — never deletes existing songs/albums/artists. Run
// after the main seed to fill in albums/editions (including deluxe/bonus
// tracks) that got left out, without disturbing what's already there.
// A$AP Rocky and Travis Scott first per explicit request (their liked-song
// albums were the ones found missing), then Playboi Carti.
const PRIORITY_ARTISTS: { name: string; genreSlug: string }[] = [
  { name: 'A$AP Rocky', genreSlug: 'hip-hop' },
  { name: 'Travis Scott', genreSlug: 'hip-hop' },
  { name: 'Playboi Carti', genreSlug: 'hip-hop' },
];

// Real albums are never capped (there are only ever a handful) — this many
// EPs/singles get added on top, most-recent-first, bounded so the run stays
// fast (each entry costs one iTunes track-list call).
const MAX_SINGLES_AND_EPS_PER_ARTIST = 40;

const normalizeTitle = (title: string): string => title.toLowerCase().trim();

async function insertInChunks(
  table: string,
  rows: any[],
  chunkSize = 500,
  selectCols: string | null = 'id'
): Promise<{ id: string }[]> {
  const insertedRows: { id: string }[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const query = (supabase.from(table as any) as any).insert(chunk);
    const { data, error } = selectCols ? await query.select(selectCols) : await query;
    if (error) throw new Error(`Failed to bulk insert into ${table}: ${error.message}`);
    if (data) insertedRows.push(...(data as { id: string }[]));
  }
  return insertedRows;
}

const run = async () => {
  try {
    console.log('🌱 Topping up hip-hop catalog (additive only, nothing existing gets removed)...');

    const { data: genreRow, error: genreError } = await supabase
      .from('genres')
      .select('id')
      .eq('slug', 'hip-hop')
      .single();
    if (genreError || !genreRow) throw new Error('Could not find the hip-hop genre — run the main seed first.');
    const hipHopGenreId = genreRow.id as string;

    let audioIdx = 0;
    let totalNewAlbums = 0;
    let totalNewSongs = 0;

    for (const { name, genreSlug } of PRIORITY_ARTISTS) {
      console.log(`\n🎤 ${name}`);

      // 1. Resolve (or create) the artist row.
      const { data: existingArtist } = await supabase.from('artists').select('id').eq('name', name).maybeSingle();
      let artistId = existingArtist?.id as string | undefined;
      if (!artistId) {
        const itunesArtistId = await fetchArtistId(name);
        await sleep(150);
        const image = itunesArtistId ? undefined : '';
        const { data: created, error: createErr } = await supabase
          .from('artists')
          .insert({
            name,
            bio: `${name} — real recording artist, catalogued from public music metadata.`,
            profile_image: image || '',
            avatar: image || '',
            banner_image: image || '',
            monthly_listeners: Math.floor(Math.random() * 3000000) + 200000,
            verified: true,
            tags: [genreSlug],
          })
          .select('id')
          .single();
        if (createErr || !created) throw new Error(`Failed to create artist ${name}: ${createErr?.message}`);
        artistId = created.id;
        await supabase.from('artist_genres').insert({ artist_id: artistId, genre_id: hipHopGenreId });
        console.log(`  (created artist row — wasn't in the DB yet)`);
      }

      // 2. What we already have for this artist, so we only add what's new.
      const { data: existingSongs } = await supabase.from('songs').select('title').eq('artist_id', artistId);
      const existingSongTitles = new Set((existingSongs || []).map((s: any) => normalizeTitle(s.title)));

      const { data: existingAlbums } = await supabase.from('albums').select('id, title').eq('artist_id', artistId);
      const existingAlbumByTitle = new Map<string, string>(
        (existingAlbums || []).map((a: any) => [normalizeTitle(a.title), a.id])
      );

      // 3. Pull every real album/EP/single edition from iTunes — not deduped
      // by title, so a deluxe/anniversary edition's bonus tracks are seen —
      // and rely on the existingSongTitles check above to skip real dupes.
      const itunesArtistId = await fetchArtistId(name);
      await sleep(150);
      if (!itunesArtistId) {
        console.warn(`  ⚠️  No iTunes artist match for "${name}", skipping`);
        continue;
      }
      const albums = await fetchArtistAlbums(itunesArtistId, name, 200, false);
      await sleep(150);
      // Real albums first and uncapped (there are only ever a handful), so
      // they can never get crowded out by a flood of singles — then top up
      // with the most recent EPs/singles up to the cap.
      const realAlbums = albums.filter((a) => a.collectionType === 'Album');
      const epsAndSingles = albums.filter((a) => a.collectionType !== 'Album');
      const selectedAlbums = [...realAlbums, ...epsAndSingles.slice(0, MAX_SINGLES_AND_EPS_PER_ARTIST)];

      const newAlbumRows: any[] = [];
      const newAlbumKeys: string[] = [];
      const pendingByAlbumKey = new Map<string, { track: ITunesTrack; albumTitle: string }[]>();

      for (const album of selectedAlbums) {
        const tracks = await fetchAlbumTracks(album.collectionId);
        await sleep(150);
        if (tracks.length === 0) continue;

        const albumTitle = album.collectionName || 'Unknown Album';
        const normalizedAlbumTitle = normalizeTitle(albumTitle);

        for (const track of tracks) {
          const key = normalizeTitle(track.trackName);
          if (existingSongTitles.has(key)) continue; // already seeded, real dupe
          existingSongTitles.add(key); // guard against the same track appearing on two editions this run

          // Always track pending tracks for this album, whether it's a brand
          // new album or an existing one just gaining a new/bonus track —
          // only the album ROW insert is skipped for an existing album.
          if (!pendingByAlbumKey.has(normalizedAlbumTitle)) {
            pendingByAlbumKey.set(normalizedAlbumTitle, []);
            if (!existingAlbumByTitle.has(normalizedAlbumTitle)) {
              newAlbumKeys.push(normalizedAlbumTitle);
              newAlbumRows.push({
                title: albumTitle,
                artist_id: artistId,
                genre_id: hipHopGenreId,
                cover_image: upscaleArtwork(track.artworkUrl100),
                release_year: track.releaseDate ? new Date(track.releaseDate).getFullYear() : null,
                album_type: (album.collectionType || 'Album').toLowerCase(),
                total_tracks: tracks.length,
                tags: [genreSlug],
              });
            }
          }
          pendingByAlbumKey.get(normalizedAlbumTitle)!.push({ track, albumTitle });
        }
      }

      const pendingTrackCount = Array.from(pendingByAlbumKey.values()).reduce((sum, arr) => sum + arr.length, 0);
      if (pendingTrackCount === 0) {
        console.log('  no new songs found — already fully seeded');
        continue;
      }

      const insertedAlbums = newAlbumRows.length > 0 ? await insertInChunks('albums', newAlbumRows) : [];
      newAlbumKeys.forEach((key, i) => existingAlbumByTitle.set(key, insertedAlbums[i].id));
      totalNewAlbums += insertedAlbums.length;

      const songRows: any[] = [];
      for (const [normalizedAlbumTitle, entries] of pendingByAlbumKey) {
        const albumId = existingAlbumByTitle.get(normalizedAlbumTitle);
        for (const { track } of entries) {
          const defaults = GENRE_AUDIO_DEFAULTS[genreSlug] || GENRE_AUDIO_DEFAULTS.pop;
          const sampleAudioUrl = AUDIO_SAMPLE_URLS[audioIdx % AUDIO_SAMPLE_URLS.length];
          audioIdx += 1;
          songRows.push({
            title: track.trackName,
            artist_id: artistId,
            album_id: albumId || null,
            genre_id: hipHopGenreId,
            duration: track.trackTimeMillis ? Math.round(track.trackTimeMillis / 1000) : 210,
            cover_image: upscaleArtwork(track.artworkUrl100),
            audio_url: sampleAudioUrl,
            release_year: track.releaseDate ? new Date(track.releaseDate).getFullYear() : null,
            audio_features: {
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
        }
      }

      const insertedSongs = await insertInChunks('songs', songRows, 500);
      totalNewSongs += insertedSongs.length;
      console.log(`  ✓ added ${insertedAlbums.length} new albums/editions, ${insertedSongs.length} new songs`);
    }

    console.log('\n==================================================');
    console.log('🎉 Hip-hop catalog top-up complete');
    console.log('==================================================');
    console.log(`💿 New albums/editions added: ${totalNewAlbums}`);
    console.log(`🎶 New songs added:           ${totalNewSongs}`);
    console.log('==================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during catalog top-up:', error);
    process.exit(1);
  }
};

run();
