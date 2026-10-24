-- Faster refresh: releases hourly at :01, events every 2 hours.
-- Each run now works through tracked artists oldest-checked first and stops
-- before the Edge Function time limit, so this table remembers where it got to.

create table if not exists public.artist_refresh (
  artist_id           text primary key,          -- Spotify artist id
  releases_checked_at timestamptz,
  events_checked_at   timestamptz
);

-- Only the Edge Functions (service role) touch this; no anon access.
alter table public.artist_refresh enable row level security;

-- ── Schedule ────────────────────────────────────────────────────────────────
-- Replace both <CRON_SECRET> placeholders with your CRON_SECRET (keep the quotes).
-- Times are UTC: :01 past every hour catches UK-midnight drops in winter
-- (00:01) and summer (23:01 UTC = 00:01 BST).

select cron.unschedule(jobname)
from cron.job
where jobname in ('artist-releases-refresh', 'artist-events-refresh');

select cron.schedule(
  'artist-releases-refresh',
  '1 * * * *',
  $$
  select net.http_post(
    url     := 'https://nwkissnpwmjktuaunzyt.supabase.co/functions/v1/artist-releases',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body    := '{"mode":"all"}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

select cron.schedule(
  'artist-events-refresh',
  '31 */2 * * *',
  $$
  select net.http_post(
    url     := 'https://nwkissnpwmjktuaunzyt.supabase.co/functions/v1/artist-events',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body    := '{"mode":"all"}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
