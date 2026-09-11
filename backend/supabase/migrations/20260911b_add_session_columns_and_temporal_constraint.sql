-- Extends listening_sessions with columns mirroring the Mongoose ListeningSession
-- model's embedded arrays/state, so listeningSessionService.ts (session tracking,
-- smart autoplay, session-based recommendations) can be ported off Mongoose without
-- redesigning its read-modify-write logic from scratch.
--
-- tracks_played (existing) is reused for both songsPlayed/tracksPlayed (the Mongoose
-- model always kept these two arrays in sync, so one column suffices). session_start/
-- session_end (existing) are reused for startTime/endTime.
--
-- Also adds a uniqueness constraint temporal_preferences needs to support upsert-by
-- -composite-key (the Supabase equivalent of the old Mongoose bulkWrite upsert).
--
-- Also adds a `metadata` jsonb column to music_dna so unifiedMusicDnaService.ts can
-- cache the full UnifiedMusicDNA snapshot (archetype, listeningBehavior, etc.) the
-- same way the old Mongoose MusicDNA document did in its free-form `metadata` field --
-- the other music_dna columns (genres/artists/moods/tendencies/etc.) only capture a
-- subset of that shape.
--
-- Run this against your Supabase project (SQL Editor, or `supabase db push` if you
-- adopt the CLI) before the session-storage migration phase is deployed.

alter table listening_sessions
  add column if not exists last_activity_time timestamptz not null default now(),
  add column if not exists current_song uuid,
  add column if not exists tracks_skipped jsonb not null default '[]',
  add column if not exists tracks_completed jsonb not null default '[]',
  add column if not exists session_events jsonb not null default '[]',
  add column if not exists status text not null default 'active',
  add column if not exists session_context jsonb not null default '{}',
  add column if not exists metadata jsonb not null default '{}';

alter table music_dna
  add column if not exists metadata jsonb not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'temporal_preferences_user_slot_unique'
  ) then
    alter table temporal_preferences
      add constraint temporal_preferences_user_slot_unique
      unique (user_id, day_type, time_slot);
  end if;
end $$;
