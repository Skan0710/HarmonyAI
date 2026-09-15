import dotenv from 'dotenv';
import { supabase } from '../config/supabase.js';
import { CatalogIngestionService } from '../ingestion/services/catalogIngestionService.js';
import { CURATED_ENGLISH_ARTISTS } from '../ingestion/providers/curatedEnglishArtists.js';
import { MusicBrainzProvider } from '../ingestion/providers/musicbrainzProvider.js';

dotenv.config();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getCatalogCounts() {
  const [songs, artists, albums, genres, cachedYt] = await Promise.all([
    supabase.from('songs').select('*', { count: 'exact', head: true }),
    supabase.from('artists').select('*', { count: 'exact', head: true }),
    supabase.from('albums').select('*', { count: 'exact', head: true }),
    supabase.from('genres').select('*', { count: 'exact', head: true }),
    supabase.from('songs').select('youtube_video_id', { count: 'exact', head: true }).not('youtube_video_id', 'is', null),
  ]);

  return {
    songs: songs.count || 0,
    artists: artists.count || 0,
    albums: albums.count || 0,
    genres: genres.count || 0,
    cachedYt: cachedYt.count || 0,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const isTest = args.includes('--test');
  const isDryRun = args.includes('--dry-run');

  const targetArg = args.find((a) => a.startsWith('--target='));
  const targetTracks = targetArg
    ? parseInt(targetArg.split('=')[1], 10)
    : parseInt(process.env.CATALOG_TARGET_TRACKS || '50000', 10);

  const genreArg = args.find((a) => a.startsWith('--genre='));
  const targetGenre = genreArg ? genreArg.split('=')[1].toLowerCase() : null;

  console.log('\n======================================================');
  console.log('🎵 HarmonyAI English-Language Catalog Expansion');
  console.log('======================================================');
  console.log(`Mode:           ${isTest ? 'TEST (3 artists only)' : 'FULL EXPANSION'}`);
  console.log(`Target Tracks:  ${targetTracks}`);
  console.log(`Genre Filter:   ${targetGenre || 'All 15 prioritized genres'}`);
  console.log(`Dry Run:        ${isDryRun ? 'YES (no DB writes)' : 'NO (live append/upsert)'}`);
  console.log('Safety Rule:    Strict non-destructive append / upsert. Existing data preserved.');
  console.log('------------------------------------------------------\n');

  // Baseline inspection
  const initialCounts = await getCatalogCounts();
  console.log('📊 Baseline Catalog State:');
  console.log(`   Songs:       ${initialCounts.songs}`);
  console.log(`   Artists:     ${initialCounts.artists}`);
  console.log(`   Albums:      ${initialCounts.albums}`);
  console.log(`   Genres:      ${initialCounts.genres}`);
  console.log(`   Cached YT:   ${initialCounts.cachedYt}`);
  console.log('------------------------------------------------------\n');

  const ingestionService = new CatalogIngestionService();
  await ingestionService.initializeGenres();

  let totalSongsAdded = 0;
  let totalAlbumsAdded = 0;
  let totalDuplicatesSkipped = 0;
  let totalFilteredCount = 0;

  if (isTest) {
    // Test mode: pick 3 prominent English artists with rich catalogs
    const testArtists = [
      { name: 'Radiohead', genre: 'rock' },
      { name: 'The Strokes', genre: 'indie' },
      { name: 'Oasis', genre: 'rock' },
    ];

    console.log('🧪 Starting Small Test with 3 artists:');
    for (const artist of testArtists) {
      console.log(`\n🎤 Ingesting: ${artist.name} (${artist.genre})...`);
      const res = await ingestionService.ingestArtistCatalog(artist.name, artist.genre, {
        dryRun: isDryRun,
      });
      totalSongsAdded += res.songsAdded;
      totalAlbumsAdded += res.albumsAdded;
      totalDuplicatesSkipped += res.duplicatesSkipped;
      totalFilteredCount += res.filteredCount;
      console.log(
        `   ✓ Added: ${res.songsAdded} tracks, ${res.albumsAdded} albums | Deduplicated: ${res.duplicatesSkipped} tracks | Filtered: ${res.filteredCount}`
      );
    }
  } else {
    // Full scale expansion
    let artistsToProcess = CURATED_ENGLISH_ARTISTS;
    if (targetGenre) {
      artistsToProcess = artistsToProcess.filter((a) => a.genre.toLowerCase() === targetGenre);
    }

    console.log(`🚀 Processing curated roster of ${artistsToProcess.length} English artists...`);

    let currentTotal = initialCounts.songs;

    for (let i = 0; i < artistsToProcess.length; i++) {
      if (currentTotal >= targetTracks) {
        console.log(`\n🎯 Reached target catalog size of ${targetTracks} songs!`);
        break;
      }

      const artist = artistsToProcess[i];
      process.stdout.write(`[${i + 1}/${artistsToProcess.length}] ${artist.name} (${artist.genre})... `);

      try {
        const res = await ingestionService.ingestArtistCatalog(artist.name, artist.genre, {
          dryRun: isDryRun,
        });

        totalSongsAdded += res.songsAdded;
        totalAlbumsAdded += res.albumsAdded;
        totalDuplicatesSkipped += res.duplicatesSkipped;
        totalFilteredCount += res.filteredCount;
        currentTotal += res.songsAdded;

        console.log(
          `+${res.songsAdded} songs (+${res.albumsAdded} albums) | Total in DB: ~${currentTotal}`
        );
      } catch (err: any) {
        console.log(`⚠️ Error: ${err.message}`);
      }

      await sleep(100);
    }

    // If still below target, use MusicBrainz discovery
    if (currentTotal < targetTracks && !targetGenre) {
      console.log('\n🌐 Expanding discovery via MusicBrainz for additional English artists...');
      const mb = new MusicBrainzProvider();
      const genresToDiscover = ['rock', 'pop', 'indie', 'metal', 'hip-hop', 'electronic', 'country', 'jazz'];

      for (const g of genresToDiscover) {
        if (currentTotal >= targetTracks) break;
        console.log(`   Searching MusicBrainz for top English ${g} artists...`);
        const mbArtists = await mb.discoverArtistsByGenre(g, 25);

        for (const mba of mbArtists) {
          if (currentTotal >= targetTracks) break;
          process.stdout.write(`   MB: ${mba.name} (${g})... `);
          try {
            const res = await ingestionService.ingestArtistCatalog(mba.name, g, { dryRun: isDryRun });
            totalSongsAdded += res.songsAdded;
            totalAlbumsAdded += res.albumsAdded;
            totalDuplicatesSkipped += res.duplicatesSkipped;
            totalFilteredCount += res.filteredCount;
            currentTotal += res.songsAdded;
            console.log(`+${res.songsAdded} songs | Total in DB: ~${currentTotal}`);
          } catch (err: any) {
            console.log(`⚠️ ${err.message}`);
          }
        }
      }
    }
  }

  // Final verification counts
  const finalCounts = await getCatalogCounts();

  console.log('\n======================================================');
  console.log('🎉 INGESTION RUN COMPLETE');
  console.log('======================================================');
  console.log(`Preserved Baseline Songs:  ${initialCounts.songs}`);
  console.log(`New Songs Imported:        ${totalSongsAdded}`);
  console.log(`New Albums Imported:       ${totalAlbumsAdded}`);
  console.log(`Duplicates Avoided:        ${totalDuplicatesSkipped}`);
  console.log(`Non-English/Spam Filtered: ${totalFilteredCount}`);
  console.log('------------------------------------------------------');
  console.log('📊 Current Live Database State:');
  console.log(`   Total Songs:   ${finalCounts.songs} (net change: +${finalCounts.songs - initialCounts.songs})`);
  console.log(`   Total Artists: ${finalCounts.artists} (net change: +${finalCounts.artists - initialCounts.artists})`);
  console.log(`   Total Albums:  ${finalCounts.albums} (net change: +${finalCounts.albums - initialCounts.albums})`);
  console.log(`   Total Genres:  ${finalCounts.genres}`);
  console.log(`   Cached YT IDs: ${finalCounts.cachedYt} (preserved: ${finalCounts.cachedYt >= initialCounts.cachedYt})`);
  console.log('======================================================\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during catalog ingestion:', err);
  process.exit(1);
});
