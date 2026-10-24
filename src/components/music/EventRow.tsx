import React from 'react'
import { ArtistEvent, formatEventDate, SOURCE_LABELS } from '../../lib/events'
import { useGoing, useGoingCount } from '../../lib/attendance'

// "GB" → 🇬🇧
export const flag = (iso: string) =>
  /^[A-Z]{2}$/.test(iso) ? String.fromCodePoint(...[...iso].map(c => 0x1f1a5 + c.charCodeAt(0))) : ''

export function GoingButton({ e }: { e: ArtistEvent }) {
  const { isGoing, toggle } = useGoing()
  const going = isGoing(e.event_key)
  const count = useGoingCount(e.event_key)
  return (
    <button
      type="button"
      className={`going-btn ${going ? 'going-btn--on' : ''}`}
      aria-pressed={going}
      title={going ? "You're going. Click to undo" : "Mark that you're going"}
      onClick={ev => { ev.stopPropagation(); toggle(e) }}
    >
      {going ? '✓ Going' : "I'm going"}
      {count !== null && count > 0 && <span className="going-btn__count">{count}</span>}
    </button>
  )
}

export default function EventRow({ e, showArtist = true }: { e: ArtistEvent; showArtist?: boolean }) {
  const d = new Date(`${e.event_date}T00:00:00`)
  return (
    <div className="event-row">
      <div className="event-row__date">
        <span className="event-row__day">{d.getDate()}</span>
        <span className="event-row__month">{d.toLocaleDateString('en-GB', { month: 'short' })}</span>
      </div>
      <div className="event-row__info">
        <span className="event-row__title">{showArtist ? e.artist_name : e.title || e.artist_name}</span>
        <span className="event-row__sub">
          {[e.venue, e.city].filter(Boolean).join(', ')} {flag(e.country_code)}
        </span>
        <span className="event-row__meta">{formatEventDate(e)} · {SOURCE_LABELS[e.source] ?? e.source}</span>
      </div>
      <div className="event-row__actions">
        <GoingButton e={e} />
        {e.url && <a className="event-row__tickets" href={e.url} target="_blank" rel="noopener noreferrer">Tickets ↗</a>}
      </div>
    </div>
  )
}
