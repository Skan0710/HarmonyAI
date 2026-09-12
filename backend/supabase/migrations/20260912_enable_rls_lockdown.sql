-- Security audit finding (2026-09-12): none of the 23 tables in this project
-- have Row-Level Security enabled. The anon key (shipped in backend/.env and
-- used by backend/src/config/supabase.ts) can currently read and write every
-- row in every table directly via PostgREST, bypassing all Express-level
-- auth/authorization checks entirely (protect/requireAdmin never run for a
-- request that hits Supabase's REST endpoint directly instead of the API).
--
-- This app does not use Supabase Auth/GoTrue -- backend/src/utils/jwt.ts signs
-- its own JWTs, so auth.uid() never resolves for this app's tokens. Writing
-- auth.uid()-based policies would silently match nothing. The correct fix
-- given this architecture is: enable RLS with no policies (default-deny) on
-- every user-data table, so the anon key can no longer reach them at all, and
-- only the trusted Express backend (via a service-role key, not the anon key)
-- can read/write. Public catalog tables get an explicit public-read policy
-- and no write policies, since Express's protect+requireAdmin remains the
-- only write gate for those either way once anon can't write directly.
--
-- After running this: create a SUPABASE_SERVICE_ROLE_KEY entry in your
-- Supabase project settings, add it to backend/.env (never VITE_-prefixed,
-- never shipped to the frontend), and switch backend/src/config/supabase.ts
-- to use it instead of SUPABASE_ANON_KEY.

-- User-data tables: default-deny for anon/authenticated. Only the
-- service-role key (used exclusively server-side) bypasses RLS.
alter table users enable row level security;
alter table listening_history enable row level security;
alter table listening_sessions enable row level security;
alter table music_dna enable row level security;
alter table music_dna_snapshots enable row level security;
alter table personal_music_twin enable row level security;
alter table playlists enable row level security;
alter table playlist_songs enable row level security;
alter table playlist_collaborators enable row level security;
alter table recommendation_contexts enable row level security;
alter table recommendation_evaluations enable row level security;
alter table recommendation_interactions enable row level security;
alter table temporal_preferences enable row level security;
alter table user_favorite_artists enable row level security;
alter table user_favorite_genres enable row level security;
alter table user_liked_songs enable row level security;

-- Public catalog tables: keep reads public (this content is meant to be
-- publicly browsable), block all direct writes so mutation only happens
-- through the Express API under protect+requireAdmin.
alter table albums enable row level security;
alter table artists enable row level security;
alter table genres enable row level security;
alter table songs enable row level security;
alter table album_featured_artists enable row level security;
alter table artist_genres enable row level security;
alter table song_featured_artists enable row level security;

create policy "public catalog read" on albums for select using (true);
create policy "public catalog read" on artists for select using (true);
create policy "public catalog read" on genres for select using (true);
create policy "public catalog read" on songs for select using (true);
create policy "public catalog read" on album_featured_artists for select using (true);
create policy "public catalog read" on artist_genres for select using (true);
create policy "public catalog read" on song_featured_artists for select using (true);

-- Belt-and-suspenders: strip any default table-level write grants from anon,
-- in case they were ever set explicitly (RLS with no policy already denies
-- these, but PostgREST's error message differs depending on which layer
-- blocks the request, so this keeps behavior consistent).
revoke insert, update, delete on all tables in schema public from anon;
