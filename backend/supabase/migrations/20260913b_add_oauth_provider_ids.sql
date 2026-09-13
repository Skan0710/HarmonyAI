-- Adds Google/Discord OAuth linkage columns to users, so "Sign in with
-- Google/Discord" can find-or-create an account without a password.
-- password_hash is already nullable, so an OAuth-only account (no local
-- password ever set) is already representable — this just adds the
-- provider-side identifiers used to look that account back up on future
-- logins, and to link an OAuth login to an existing local-password account
-- that shares the same verified email.
--
-- Run this against your Supabase project (SQL Editor, or `supabase db push`
-- if you adopt the CLI) before deploying the Google/Discord sign-in routes.

alter table users
  add column if not exists google_id text,
  add column if not exists discord_id text;

create unique index if not exists users_google_id_key on users (google_id) where google_id is not null;
create unique index if not exists users_discord_id_key on users (discord_id) where discord_id is not null;
