-- Performance indexes for scaling HarmonyAI catalog to 50,000+ tracks
-- Completely idempotent and non-destructive.

CREATE INDEX IF NOT EXISTS idx_songs_artist_id ON songs(artist_id);
CREATE INDEX IF NOT EXISTS idx_songs_album_id ON songs(album_id);
CREATE INDEX IF NOT EXISTS idx_songs_genre_id ON songs(genre_id);
CREATE INDEX IF NOT EXISTS idx_songs_title_lower ON songs(lower(title));
CREATE INDEX IF NOT EXISTS idx_songs_is_published ON songs(is_published);
CREATE INDEX IF NOT EXISTS idx_albums_artist_id ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_title_lower ON albums(lower(title));
CREATE INDEX IF NOT EXISTS idx_artists_name_lower ON artists(lower(name));
