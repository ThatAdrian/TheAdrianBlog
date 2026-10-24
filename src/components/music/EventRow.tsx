import React from 'react'
import { ArtistEvent, formatEventDate, SOURCE_LABELS } from '../../lib/events'

// "GB" → 🇬🇧
export const flag = (iso: string) =>
  /^[A-Z]{2}$/.test(iso) ? String.fromCodePoint(...[...iso].map(c => 0x1f1a5 + c.charCodeAt(0))) : ''

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
      {e.url && <a className="event-row__tickets" href={e.url} target="_blank" rel="noopener noreferrer">Tickets ↗</a>}
    </div>
  )
}
