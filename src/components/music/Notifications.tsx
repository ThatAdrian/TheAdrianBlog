import React, { useEffect, useRef } from 'react'
import { ReleasesState, useNotificationDismissals } from '../../lib/releases'
import { EventsState } from '../../lib/events'
import ReleaseRow from './ReleaseRow'
import EventRow from './EventRow'

export default function Notifications({ releases, events, hasTracked, onFindArtists }: {
  releases: ReleasesState
  events: EventsState
  hasTracked: boolean
  onFindArtists: () => void
}) {
  const { seenAt, markAllSeen } = releases
  const { isHidden, dismiss, clearAll } = useNotificationDismissals()
  const loading = releases.loading || events.loading
  // Releases and shows in your areas, newest first, minus the ones you cleared
  const notifications = [
    ...releases.notifications.map(n => ({ ...n, type: 'release' as const })),
    ...events.notifications.map(n => ({ ...n, type: 'event' as const })),
  ].filter(n => !isHidden(n)).sort((a, b) => b.at.localeCompare(a.at))
  // Keep the unread highlight for this visit, then clear the dock badge
  const seenOnOpen = useRef(seenAt)
  useEffect(() => {
    if (!loading) markAllSeen()
  }, [loading, notifications.length, markAllSeen])

  if (!hasTracked) {
    return (
      <div className="no-posts tracked-empty">
        <p>Track some artists to get notified about new releases and announcements.</p>
        <button type="button" className="music-filter-btn active" onClick={onFindArtists}>Find artists</button>
      </div>
    )
  }

  if (loading) return <div className="no-posts"><p>Checking for new releases…</p></div>

  if (!notifications.length) {
    return <div className="no-posts"><p>You're all caught up. New releases, announcements and shows in your areas from your tracked artists will land here.</p></div>
  }

  return (
    <>
      <div className="notif-toolbar">
        <span>{notifications.length} notification{notifications.length === 1 ? '' : 's'}</span>
        <button type="button" className="notif-clear-all" onClick={clearAll}>Clear all</button>
      </div>
      <div className="release-list">
        {notifications.map(n => (
          <div key={n.key} className="notif-item">
            {n.type === 'event' ? (
              <div className={`notif-event ${n.at > seenOnOpen.current ? 'release-row--unread' : ''}`}>
                <span className="release-tag release-tag--show">New show</span>
                <EventRow e={n.event} />
              </div>
            ) : (
              <ReleaseRow
                release={n.release}
                unread={n.at > seenOnOpen.current}
                tag={n.kind === 'announced' ? { label: 'Announced', tone: 'announced' } : { label: 'Out now', tone: 'released' }}
              />
            )}
            <button type="button" className="notif-dismiss" onClick={() => dismiss(n.key)} aria-label="Clear notification" title="Clear">×</button>
          </div>
        ))}
      </div>
    </>
  )
}
