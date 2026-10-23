-- Releases and announcements for tracked artists.
-- Filled by the `artist-releases` Edge Function (Spotify for released music,
-- MusicBrainz for announced future dates). Notifications and the calendar are
-- derived client-side from this table + tracked_artists.created_at, so there
-- is no per-visitor fan-out table.

create table if not exists public.artist_releases (
  id             bigint generated always as identity primary key,
  release_key    text        not null unique,           -- e.g. spotify:<albumId>, mb:<releaseGroupId>
  artist_id      text        not null,                  -- Spotify artist id
  artist_name    text        not null,
  title          text        not null,
  release_type   text        not null default 'album',  -- album | single | ep | other
  release_date   date        not null,
  date_precision text        not null default 'day',    -- day | month | year
  image          text        not null default '',
  url            text        not null default '',
  source         text        not null,                  -- spotify | musicbrainz
  first_seen_at  timestamptz not null default now()
);

create index if not exists artist_releases_artist_date_idx on public.artist_releases (artist_id, release_date desc);
create index if not exists artist_releases_date_idx on public.artist_releases (release_date);

alter table public.artist_releases enable row level security;

-- Public read; only the Edge Function (service role) writes.
create policy "artist_releases_select" on public.artist_releases
  for select to anon using (true);

-- ── Schedule: refresh every tracked artist every 6 hours ───────────────────
-- Needs the pg_cron and pg_net extensions (Database → Extensions).
-- Replace <CRON_SECRET> with the value you set as the function's CRON_SECRET.
--
-- select cron.schedule(
--   'artist-releases-refresh',
--   '0 */6 * * *',
--   $$
--   select net.http_post(
--     url     := 'https://nwkissnpwmjktuaunzyt.supabase.co/functions/v1/artist-releases',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
--     body    := '{"mode":"all"}'::jsonb
--   );
--   $$
-- );
