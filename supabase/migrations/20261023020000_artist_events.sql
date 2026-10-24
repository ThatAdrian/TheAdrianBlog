-- Concerts / tour dates for tracked artists (Music → Events tab).
-- Filled by the `artist-events` Edge Function from every source that has a key
-- set (Ticketmaster, Bandsintown, SeatGeek, Skiddle), plus events Adrian adds
-- by hand from the dashboard (source = 'manual') for DICE / RA-only shows.

create table if not exists public.artist_events (
  id            bigint generated always as identity primary key,
  event_key     text        not null unique,     -- e.g. ticketmaster:<id>, manual:<uuid>
  artist_id     text        not null,            -- Spotify artist id
  artist_name   text        not null,
  title         text        not null default '',
  venue         text        not null default '',
  city          text        not null default '',
  country_code  text        not null default '', -- ISO 3166-1 alpha-2, e.g. GB
  country_name  text        not null default '',
  lat           double precision,
  lng           double precision,
  event_date    date        not null,            -- local date at the venue
  event_time    text        not null default '', -- local time, e.g. 19:30
  url           text        not null default '',
  source        text        not null,            -- ticketmaster | bandsintown | seatgeek | skiddle | manual
  first_seen_at timestamptz not null default now()
);

create index if not exists artist_events_artist_date_idx on public.artist_events (artist_id, event_date);
create index if not exists artist_events_date_idx on public.artist_events (event_date);

alter table public.artist_events enable row level security;

-- Public read; only the Edge Function (service role) writes.
create policy "artist_events_select" on public.artist_events
  for select to anon using (true);
