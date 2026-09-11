-- Adds a role column to the users table so admin-only routes can be
-- gated by something other than "is logged in". Without this, any
-- authenticated user can call routes protected only by `protect`
-- (e.g. GET /api/admin/recommendations/evaluate).
--
-- Run this against your Supabase project (SQL Editor, or `supabase db push`
-- if you adopt the CLI) before deploying the requireAdmin middleware change.
-- To promote a specific account to admin afterwards:
--   update users set role = 'admin' where email = 'you@example.com';

alter table users
  add column if not exists role text not null default 'user';

alter table users
  add constraint users_role_check check (role in ('user', 'admin'));
