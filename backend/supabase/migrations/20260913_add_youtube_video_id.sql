-- Adds a cache column for the resolved YouTube video ID used for real
-- (full-length) playback via the YouTube IFrame Player API. Nullable:
-- populated lazily on first play request, not backfilled in bulk, to
-- avoid burning the free YouTube Data API v3 quota (100 units per search,
-- 10,000/day) on songs nobody has played yet.
alter table songs
  add column if not exists youtube_video_id text;
