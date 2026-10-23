-- Tracked artists for the Music page (Search → Track artist).
-- Visitors are identified by the same localStorage fingerprint as `likes`.
-- This is also the seed for the future taste profile, and the list the
-- release / event watchers will read from.

create table if not exists public.tracked_artists (
  id           bigint generated always as identity primary key,
  fingerprint  text        not null,
  artist_id    text        not null,             -- Spotify artist id
  artist_name  text        not null,
  artist_image text        not null default '',
  created_at   timestamptz not null default now(),
  unique (fingerprint, artist_id)
);

create index if not exists tracked_artists_artist_id_idx on public.tracked_artists (artist_id);

alter table public.tracked_artists enable row level security;

-- Same open model as `likes`: the anon key can read/insert/delete; rows are
-- scoped client-side by fingerprint.
create policy "tracked_artists_select" on public.tracked_artists
  for select to anon using (true);

create policy "tracked_artists_insert" on public.tracked_artists
  for insert to anon with check (char_length(fingerprint) between 8 and 64);

create policy "tracked_artists_delete" on public.tracked_artists
  for delete to anon using (true);
