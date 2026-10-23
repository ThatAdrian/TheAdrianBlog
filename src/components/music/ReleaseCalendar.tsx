import React, { useMemo, useState } from 'react'
import { Release, ReleasesState, todayISO } from '../../lib/releases'
import ReleaseRow from './ReleaseRow'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function ReleaseCalendar({ releases, hasTracked, onFindArtists }: {
  releases: ReleasesState
  hasTracked: boolean
  onFindArtists: () => void
}) {
  const { releases: all, upcoming, loading } = releases
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selected, setSelected] = useState<string | null>(null)
  const today = todayISO()

  const byDay = useMemo(() => {
    const m = new Map<string, Release[]>()
    all.filter(r => r.date_precision === 'day').forEach(r => {
      m.set(r.release_date, [...(m.get(r.release_date) ?? []), r])
    })
    return m
  }, [all])

  // Monday-first grid covering the whole month
  const cells = useMemo(() => {
    const first = new Date(month)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    const total = Math.ceil((offset + days) / 7) * 7
    return Array.from({ length: total }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }, [month])

  const list = selected
    ? byDay.get(selected) ?? []
    : upcoming

  // Group the list by month; month/year-precision dates go under "Date TBC"
  const groups = useMemo(() => {
    const g = new Map<string, Release[]>()
    const sorted = [...list].sort((a, b) => a.release_date.localeCompare(b.release_date))
    sorted.forEach(r => {
      const label = r.date_precision === 'day'
        ? new Date(`${r.release_date}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
        : 'Date TBC'
      g.set(label, [...(g.get(label) ?? []), r])
    })
    return [...g.entries()].sort((a, b) => (a[0] === 'Date TBC' ? 1 : b[0] === 'Date TBC' ? -1 : 0))
  }, [list])

  if (!hasTracked) {
    return (
      <div className="no-posts tracked-empty">
        <p>Track some artists to see their upcoming releases on the calendar.</p>
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
                  {items.slice(0, 2).map(r => (
                    r.image
                      ? <img key={r.release_key} src={r.image} alt="" onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} />
                      : <span key={r.release_key} className="release-cal__dot" />
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
          ? <>Releases on {new Date(`${selected}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} · <button type="button" className="release-cal__clear" onClick={() => setSelected(null)}>show all</button></>
          : 'Upcoming releases'}
      </div>

      {loading ? (
        <p className="artist-profile__empty">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="artist-profile__empty">No upcoming releases announced by your tracked artists yet.</p>
      ) : (
        groups.map(([label, items]) => (
          <div key={label} className="release-cal__group">
            {!selected && <div className="music-search__group-label">{label}</div>}
            <div className="release-list">
              {items.map(r => <ReleaseRow key={r.release_key} release={r} />)}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
