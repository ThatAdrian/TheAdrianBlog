import React, { useMemo, useState } from 'react'
import { Release, ReleasesState, todayISO } from '../../lib/releases'
import { ArtistEvent, EventsState } from '../../lib/events'
import { useGoing } from '../../lib/attendance'
import ReleaseRow from './ReleaseRow'
import EventRow from './EventRow'

// Releases and concerts share the grid. Concerts are the ones in your Events
// areas (all of them if you haven't picked any), plus any you're going to.
type Item =
  | { kind: 'release'; key: string; date: string; dated: boolean; r: Release }
  | { kind: 'event'; key: string; date: string; dated: true; e: ArtistEvent }

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function ReleaseCalendar({ releases, events, hasTracked, onFindArtists }: {
  releases: ReleasesState
  events: EventsState
  hasTracked: boolean
  onFindArtists: () => void
}) {
  const { releases: all, upcoming, loading } = releases
  const { isGoing } = useGoing()
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selected, setSelected] = useState<string | null>(null)
  const today = todayISO()

  const shows = useMemo(() => {
    const base = events.hasRegions ? events.nearby : events.events
    const extra = events.events.filter(e => isGoing(e.event_key) && !base.includes(e))
    return [...base, ...extra]
  }, [events.events, events.nearby, events.hasRegions, isGoing])

  const releaseItems: Item[] = useMemo(() => all.map(r => ({
    kind: 'release' as const, key: r.release_key, date: r.release_date, dated: r.date_precision === 'day', r,
  })), [all])
  const showItems: Item[] = useMemo(() => shows.map(e => ({
    kind: 'event' as const, key: e.event_key, date: e.event_date, dated: true as const, e,
  })), [shows])

  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>()
    ;[...releaseItems, ...showItems].filter(i => i.dated).forEach(i => {
      m.set(i.date, [...(m.get(i.date) ?? []), i])
    })
    return m
  }, [releaseItems, showItems])

  const upcomingKeys = useMemo(() => new Set(upcoming.map(r => r.release_key)), [upcoming])
  const list: Item[] = selected
    ? byDay.get(selected) ?? []
    : [...releaseItems.filter(i => upcomingKeys.has(i.key)), ...showItems.filter(i => i.date >= today)]

  // Group the list by month; month/year-precision dates go under "Date TBC"
  const groups = useMemo(() => {
    const g = new Map<string, Item[]>()
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    sorted.forEach(i => {
      const label = i.dated
        ? new Date(`${i.date}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
        : 'Date TBC'
      g.set(label, [...(g.get(label) ?? []), i])
    })
    return [...g.entries()].sort((a, b) => (a[0] === 'Date TBC' ? 1 : b[0] === 'Date TBC' ? -1 : 0))
  }, [list])

  // Monday-first grid covering the whole month
  const cells = useMemo(() => {
    const first = new Date(month)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    const total = Math.ceil((offset + days) / 7) * 7
    return Array.from({ length: total }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }, [month])

  if (!hasTracked) {
    return (
      <div className="no-posts tracked-empty">
        <p>Track some artists to see their upcoming releases and shows on the calendar.</p>
        <button type="button" className="music-filter-btn active" onClick={onFindArtists}>Find artists</button>
      </div>
    )
  }

  const shift = (n: number) => { setSelected(null); setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1)) }

  return (
    <div className="release-cal">
      <div className="release-cal__head">
        <button type="button" className="release-cal__nav" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
        <span className="release-cal__month">{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
        <button type="button" className="release-cal__nav" onClick={() => shift(1)} aria-label="Next month">›</button>
      </div>

      <div className="release-cal__grid">
        {WEEKDAYS.map(d => <div key={d} className="release-cal__weekday">{d}</div>)}
        {cells.map(d => {
          const key = iso(d)
          const items = byDay.get(key) ?? []
          const outside = d.getMonth() !== month.getMonth()
          return (
            <button
              type="button"
              key={key}
              disabled={!items.length}
              onClick={() => setSelected(s => (s === key ? null : key))}
              className={[
                'release-cal__day',
                outside && 'release-cal__day--outside',
                key === today && 'release-cal__day--today',
                items.length > 0 && 'release-cal__day--has',
                selected === key && 'release-cal__day--selected',
              ].filter(Boolean).join(' ')}
            >
              <span className="release-cal__num">{d.getDate()}</span>
              {items.length > 0 && (
                <span className="release-cal__covers">
                  {items.slice(0, 2).map(i => (
                    i.kind === 'event'
                      ? <span key={i.key} className={`release-cal__show ${isGoing(i.key) ? 'release-cal__show--going' : ''}`} title={`${i.e.artist_name} · ${i.e.city}`}>♪</span>
                      : i.r.image
                        ? <img key={i.key} src={i.r.image} alt="" onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} />
                        : <span key={i.key} className="release-cal__dot" />
                  ))}
                  {items.length > 2 && <span className="release-cal__more">+{items.length - 2}</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="artist-profile__section-title">
        {selected
          ? <>On {new Date(`${selected}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} · <button type="button" className="release-cal__clear" onClick={() => setSelected(null)}>show all</button></>
          : 'Upcoming releases & shows'}
      </div>

      {loading ? (
        <p className="artist-profile__empty">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="artist-profile__empty">No upcoming releases or shows from your tracked artists yet.</p>
      ) : (
        groups.map(([label, items]) => (
          <div key={label} className="release-cal__group">
            {!selected && <div className="music-search__group-label">{label}</div>}
            <div className="release-list">
              {items.map(i => (i.kind === 'event'
                ? <EventRow key={i.key} e={i.e} />
                : <ReleaseRow key={i.key} release={i.r} />))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
