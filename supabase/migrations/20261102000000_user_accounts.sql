-- User accounts (Supabase Auth) for commenting, rating, artist tracking and
-- "I'm going". Likes, page views and subscriptions stay accountless.
--
-- What this does:
--   1. `profiles`: one row per account with a public display name, created
--      automatically when someone registers.
--   2. `comments` and `ratings` get a `user_id`; new ones need an account.
--      The comment's name always comes from the commenter's profile.
--      Old anonymous comments and ratings stay and still count.
--   3. `tracked_artists` and `event_attendance` move from the localStorage
--      fingerprint to the account, so they follow you between devices.
--      Old fingerprint rows are moved into the account the first time that
--      browser signs in (`claim_fingerprint`).
--   4. "Going" counts come from `event_going_counts`, so the public key no
--      longer reads who is going where.
--
-- Safe to run more than once.

-- ── 1. Profiles ─────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id           uuid        primary key references auth.users (id) on delete cascade,
  display_name text        not null check (char_length(btrim(display_name)) between 2 and 30),
  created_at   timestamptz not null default now()
);

-- Names are unique ignoring case, so nobody can post as someone else
create unique index if not exists profiles_display_name_lower_idx on public.profiles (lower(display_name));

alter table public.profiles enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to anon, authenticated using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Create the profile when someone registers. The name comes from the
-- registration form; if it's taken by the time they confirm, a short suffix
-- is added (they can change it on the Account page).
create or replace function public.tab_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  tries int := 0;
begin
  base := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if char_length(base) < 2 then
    base := split_part(coalesce(new.email, 'listener'), '@', 1);
  end if;
  base := left(regexp_replace(base, '\s+', ' ', 'g'), 25);
  if char_length(base) < 2 then
    base := 'listener';
  end if;

  candidate := base;
  while exists (select 1 from public.profiles p where lower(p.display_name) = lower(candidate)) and tries < 20 loop
    tries := tries + 1;
    candidate := base || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.profiles (id, display_name) values (new.id, candidate)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists tab_on_auth_user_created on auth.users;
create trigger tab_on_auth_user_created
  after insert on auth.users
  for each row execute function public.tab_handle_new_user();

-- Anyone who registered before this ran (e.g. while testing) gets a profile too
insert into public.profiles (id, display_name)
select u.id,
       left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1)), 25)
         || '-' || substr(md5(u.id::text), 1, 4)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

-- ── 2a. Comments ────────────────────────────────────────────────────────────

alter table public.comments add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table public.comments alter column user_id set default auth.uid();
create index if not exists comments_user_id_idx on public.comments (user_id);

-- The name on a new comment is always the commenter's profile name
create or replace function public.tab_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    select p.display_name into new.display_name from public.profiles p where p.id = auth.uid();
    if new.display_name is null then
      raise exception 'No profile for this account';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tab_comment_author on public.comments;
create trigger tab_comment_author
  before insert on public.comments
  for each row execute function public.tab_comment_author();

-- Renaming yourself renames your comments too
create or replace function public.tab_profile_renamed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.display_name is distinct from old.display_name then
    update public.comments set display_name = new.display_name where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists tab_profile_renamed on public.profiles;
create trigger tab_profile_renamed
  after update of display_name on public.profiles
  for each row execute function public.tab_profile_renamed();

-- Replace whatever policies comments had with a known set:
--   read: everyone · write: signed-in users, as themselves
--   delete: still open to the public key, because the dashboard's
--   Comments tab deletes with it (unchanged from before).
alter table public.comments enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'comments' loop
    execute format('drop policy %I on public.comments', pol.policyname);
  end loop;
end $$;

create policy "comments_select" on public.comments
  for select to anon, authenticated using (true);

create policy "comments_insert_own" on public.comments
  for insert to authenticated with check (user_id = auth.uid());

create policy "comments_delete_dashboard" on public.comments
  for delete to anon using (true);

-- ── 2b. Ratings ─────────────────────────────────────────────────────────────

alter table public.ratings add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.ratings alter column user_id set default auth.uid();

-- One rating per account per album (old anonymous rows have no user_id and
-- don't clash). Lets the site update your rating instead of adding another.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ratings_user_album_key') then
    alter table public.ratings add constraint ratings_user_album_key unique (user_id, album_id);
  end if;
end $$;

alter table public.ratings enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'ratings' loop
    execute format('drop policy %I on public.ratings', pol.policyname);
  end loop;
end $$;

create policy "ratings_select" on public.ratings
  for select to anon, authenticated using (true);

create policy "ratings_insert_own" on public.ratings
  for insert to authenticated with check (user_id = auth.uid());

create policy "ratings_update_own" on public.ratings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 3a. Tracked artists ─────────────────────────────────────────────────────

alter table public.tracked_artists alter column fingerprint drop not null;
alter table public.tracked_artists add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.tracked_artists alter column user_id set default auth.uid();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tracked_artists_user_artist_key') then
    alter table public.tracked_artists add constraint tracked_artists_user_artist_key unique (user_id, artist_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tracked_artists_owner_check') then
    alter table public.tracked_artists add constraint tracked_artists_owner_check check (user_id is not null or fingerprint is not null);
  end if;
end $$;

drop policy if exists "tracked_artists_select" on public.tracked_artists;
drop policy if exists "tracked_artists_insert" on public.tracked_artists;
drop policy if exists "tracked_artists_delete" on public.tracked_artists;
drop policy if exists "tracked_artists_select_legacy" on public.tracked_artists;
drop policy if exists "tracked_artists_select_own" on public.tracked_artists;
drop policy if exists "tracked_artists_insert_own" on public.tracked_artists;
drop policy if exists "tracked_artists_delete_own" on public.tracked_artists;

-- Signed out: only old fingerprint rows (so they can still be shown and moved
-- into an account). Signed in: only your own. The Edge Functions use the
-- service role and still see everything.
create policy "tracked_artists_select_legacy" on public.tracked_artists
  for select to anon using (user_id is null);

create policy "tracked_artists_select_own" on public.tracked_artists
  for select to authenticated using (user_id = auth.uid());

create policy "tracked_artists_insert_own" on public.tracked_artists
  for insert to authenticated with check (user_id = auth.uid());

create policy "tracked_artists_delete_own" on public.tracked_artists
  for delete to authenticated using (user_id = auth.uid());

-- ── 3b. "I'm going" ─────────────────────────────────────────────────────────

alter table public.event_attendance alter column fingerprint drop not null;
alter table public.event_attendance add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.event_attendance alter column user_id set default auth.uid();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'event_attendance_user_event_key') then
    alter table public.event_attendance add constraint event_attendance_user_event_key unique (user_id, event_key);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'event_attendance_owner_check') then
    alter table public.event_attendance add constraint event_attendance_owner_check check (user_id is not null or fingerprint is not null);
  end if;
end $$;

drop policy if exists "event_attendance_select" on public.event_attendance;
drop policy if exists "event_attendance_insert" on public.event_attendance;
drop policy if exists "event_attendance_delete" on public.event_attendance;
drop policy if exists "event_attendance_select_legacy" on public.event_attendance;
drop policy if exists "event_attendance_select_own" on public.event_attendance;
drop policy if exists "event_attendance_insert_own" on public.event_attendance;
drop policy if exists "event_attendance_delete_own" on public.event_attendance;

create policy "event_attendance_select_legacy" on public.event_attendance
  for select to anon using (user_id is null);

create policy "event_attendance_select_own" on public.event_attendance
  for select to authenticated using (user_id = auth.uid());

create policy "event_attendance_insert_own" on public.event_attendance
  for insert to authenticated with check (user_id = auth.uid());

create policy "event_attendance_delete_own" on public.event_attendance
  for delete to authenticated using (user_id = auth.uid());

-- Public "N going" counts without exposing who is going
create or replace function public.event_going_counts(keys text[])
returns table (event_key text, going bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select a.event_key, count(*)::bigint
  from public.event_attendance a
  where a.event_key = any (keys)
  group by a.event_key;
$$;

grant execute on function public.event_going_counts(text[]) to anon, authenticated;

-- ── 4. Move a browser's old fingerprint data into the signed-in account ────

create or replace function public.claim_fingerprint(fp text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  moved_tracked int := 0;
  moved_going int := 0;
begin
  if uid is null then
    raise exception 'Sign in first';
  end if;
  if fp is null or char_length(fp) not between 8 and 64 then
    return json_build_object('tracked', 0, 'going', 0);
  end if;

  insert into public.tracked_artists (user_id, fingerprint, artist_id, artist_name, artist_image, created_at)
  select uid, null, t.artist_id, t.artist_name, t.artist_image, t.created_at
  from public.tracked_artists t
  where t.fingerprint = fp and t.user_id is null
  on conflict (user_id, artist_id) do nothing;
  get diagnostics moved_tracked = row_count;
  delete from public.tracked_artists where fingerprint = fp and user_id is null;

  insert into public.event_attendance (user_id, fingerprint, event_key, artist_id, event_date, created_at)
  select uid, null, a.event_key, a.artist_id, a.event_date, a.created_at
  from public.event_attendance a
  where a.fingerprint = fp and a.user_id is null
  on conflict (user_id, event_key) do nothing;
  get diagnostics moved_going = row_count;
  delete from public.event_attendance where fingerprint = fp and user_id is null;

  return json_build_object('tracked', moved_tracked, 'going', moved_going);
end;
$$;

revoke execute on function public.claim_fingerprint(text) from public, anon;
grant execute on function public.claim_fingerprint(text) to authenticated;
