import dotenv from 'dotenv';
import { supabase } from './config/supabase.js';
import { ARTISTS, fetchArtistId, fetchArtistAlbums } from './seed.js';

dotenv.config();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (title: string): string => title.toLowerCase().trim();

// Updates album_type only (album/ep/single) using real iTunes classification
// — every earlier seed run hardcoded 'album' regardless of what a release
// actually was, which is why an artist page can't tell a real album apart
// from a single. No rows are added, removed, or have any other field
// touched; artists with no albums in the DB yet are skipped.
async function updateInBatches(ids: string[], albumType: string, batchSize = 200): Promise<void> {
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { error } = await supabase.from('albums').update({ album_type: albumType }).in('id', batch);
    if (error) throw new Error(`Failed to set album_type=${albumType}: ${error.message}`);
  }
}

const run = async () => {
  try {
    console.log('🔎 Reclassifying album_type (album / ep / single) from real iTunes metadata...');
    let totalEp = 0;
    let totalSingle = 0;
    let artistsTouched = 0;

    for (const { name } of ARTISTS) {
      const { data: artist } = await supabase.from('artists').select('id').eq('name', name).maybeSingle();
      if (!artist) continue;

      const { data: dbAlbums } = await supabase.from('albums').select('id, title').eq('artist_id', artist.id);
      if (!dbAlbums || dbAlbums.length === 0) continue;

      const itunesArtistId = await fetchArtistId(name);
      await sleep(120);
      if (!itunesArtistId) continue;

      // Every edition (dedupeByTitle=false), same as the top-up script, so a
      // deluxe/reissue title lines up with its real classification too.
      const itunesAlbums = await fetchArtistAlbums(itunesArtistId, name, 200, false);
      await sleep(120);

      const typeByExactTitle = new Map<string, string>();
      const typeByNormalizedTitle = new Map<string, string>();
      for (const a of itunesAlbums) {
        if (!a.collectionName) continue;
        const t = (a.collectionType || 'Album').toLowerCase();
        if (!typeByExactTitle.has(a.collectionName)) typeByExactTitle.set(a.collectionName, t);
        const norm = normalize(a.collectionName);
        if (!typeByNormalizedTitle.has(norm)) typeByNormalizedTitle.set(norm, t);
      }

      const epIds: string[] = [];
      const singleIds: string[] = [];
      for (const row of dbAlbums) {
        const matched = typeByExactTitle.get(row.title) || typeByNormalizedTitle.get(normalize(row.title));
        if (matched === 'ep') epIds.push(row.id);
        else if (matched === 'single') singleIds.push(row.id);
      }

      if (epIds.length > 0) await updateInBatches(epIds, 'ep');
      if (singleIds.length > 0) await updateInBatches(singleIds, 'single');
      if (epIds.length > 0 || singleIds.length > 0) {
        artistsTouched += 1;
        totalEp += epIds.length;
        totalSingle += singleIds.length;
        console.log(`  ✓ ${name}: ${epIds.length} reclassified as EP, ${singleIds.length} as single`);
      }
    }

    console.log('\n==================================================');
    console.log('🎉 Album type backfill complete');
    console.log('==================================================');
    console.log(`🎤 Artists with reclassified albums: ${artistsTouched}`);
    console.log(`📀 Total reclassified as EP:          ${totalEp}`);
    console.log(`🎵 Total reclassified as Single:       ${totalSingle}`);
    console.log('==================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during album type backfill:', error);
    process.exit(1);
  }
};

run();
