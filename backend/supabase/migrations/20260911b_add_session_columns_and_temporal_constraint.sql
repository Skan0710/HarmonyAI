-- Extends listening_sessions with columns mirroring the Mongoose ListeningSession
-- model's embedded arrays/state, so listeningSessionService.ts (session tracking,
-- smart autoplay, session-based recommendations) can be ported off Mongoose without
-- redesigning its read-modify-write logic from scratch.
--
-- Also adds a uniqueness constraint temporal_preferences needs to support upsert-by
-- -composite-key (the Supabase equivalent of the old Mongoose bulkWrite upsert).
--
-- Run this against your Supabase project (SQL Editor, or `supabase db push` if you
-- adopt the CLI) before the session-storage migration phase is deployed.

alter table listening_sessions
  add column if not exists songs_played jsonb not null default '[]',
  add column if not exists tracks_skipped jsonb not null default '[]',
  add column if not exists tracks_completed jsonb not null default '[]',
  add column if not exists session_events jsonb not null default '[]',
  add column if not exists status text not null default 'active',
  add column if not exists last_activity_time timestamptz not null default now();

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
