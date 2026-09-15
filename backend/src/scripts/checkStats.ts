import dotenv from 'dotenv';
import { supabase } from '../config/supabase.js';

dotenv.config();

async function check() {
  const [songs, artists, albums, genres, yt] = await Promise.all([
    supabase.from('songs').select('*', { count: 'exact', head: true }),
    supabase.from('artists').select('*', { count: 'exact', head: true }),
    supabase.from('albums').select('*', { count: 'exact', head: true }),
    supabase.from('genres').select('*', { count: 'exact', head: true }),
    supabase.from('songs').select('youtube_video_id', { count: 'exact', head: true }).not('youtube_video_id', 'is', null),
  ]);

  console.log(JSON.stringify({
    songs: songs.count,
    artists: artists.count,
    albums: albums.count,
    genres: genres.count,
    cachedYT: yt.count,
  }));
}

check().catch(console.error);
