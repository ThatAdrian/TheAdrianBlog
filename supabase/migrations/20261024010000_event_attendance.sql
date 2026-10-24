-- "I'm going" on concerts (Music → Events / Calendar / artist pages).
-- Same open model as `tracked_artists`: visitors are the localStorage
-- fingerprint, and the anon key can read/insert/delete.

create table if not exists public.event_attendance (
  id          bigint generated always as identity primary key,
  fingerprint text        not null,
  event_key   text        not null,   -- artist_events.event_key
  artist_id   text        not null,
  event_date  date        not null,
  created_at  timestamptz not null default now(),
  unique (fingerprint, event_key)
);

create index if not exists event_attendance_event_key_idx on public.event_attendance (event_key);

alter table public.event_attendance enable row level security;

create policy "event_attendance_select" on public.event_attendance
  for select to anon using (true);

create policy "event_attendance_insert" on public.event_attendance
  for insert to anon with check (char_length(fingerprint) between 8 and 64);

create policy "event_attendance_delete" on public.event_attendance
  for delete to anon using (true);
