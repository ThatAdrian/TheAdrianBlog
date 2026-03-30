import React from 'react'
import SEO from '../components/SEO'
import GlassSurface from '../components/GlassSurface'

const CHANNEL_ID = 'agamez123'
const CHANNEL_URL = 'https://www.youtube.com/@agamez123'

// Latest videos — update slugs/IDs when you post new ones
// Format: { id: 'YouTube video ID', title: 'Title' }
// Get the ID from the URL: youtube.com/watch?v=THIS_PART
const FEATURED_VIDEOS = [
  { id: 'w16UFQ9sI2I', title: 'Latest Video' },
  { id: 'PaQDATayWuQ', title: 'Featured Vlog' },
  { id: 'Bih-j2KDIXw', title: 'Personal Favourite' }// replace with real IDs
]

export default function YouTube() {
  return (
    <div className="page-transition" style={{ paddingTop: '80px', minHeight: '100vh' }}>
      <SEO
        title="YouTube"
        description="Watch my latest YouTube videos"
        url="/youtube"
      />

      <div className="section">

        {/* ── Channel widget ── */}
        <GlassSurface
          width="100%"
          height={120}
          borderRadius={16}
          brightness={30}
          opacity={0.85}
          blur={14}
          className="yt-channel-widget"
          style={{ marginBottom: '2.5rem' }}
        >
          <div className="yt-channel-inner">
            <div className="yt-channel-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="#ff0000">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div className="yt-channel-info">
              <h2 className="yt-channel-name">@agamez123</h2>
              <p className="yt-channel-desc">My cool videos here</p>
            </div>
            <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="yt-subscribe-btn">
              Visit Channel
            </a>
          </div>
        </GlassSurface>

        {/* ── Embedded feed via YouTube iframe ── */}
        <div className="section-title">Latest Videos</div>

        <div className="yt-feed-note">
          <p>
            Head over to{' '}
            <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)' }}>
              my YouTube channel
            </a>{' '}
            to see all videos and subscribe for updates.
          </p>
        </div>

        {/* Embedded videos grid — replace video IDs in FEATURED_VIDEOS above */}
        <div className="yt-grid">
          {FEATURED_VIDEOS.map(video => (
            <div key={video.id} className="yt-embed-wrap">
              <iframe
                src={`https://www.youtube.com/embed/${video.id}`}
                title={video.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="yt-embed"
              />
            </div>
          ))}
        </div>

        {/* Channel subscribe CTA */}
        <div className="yt-cta">
          <GlassSurface width="100%" height={100} borderRadius={12} brightness={25} opacity={0.8} blur={10}>
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <p style={{ color: 'rgba(200,200,255,0.7)', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', marginBottom: '1rem' }}>
                Want to see more? Subscribe on YouTube
              </p>
              <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="yt-subscribe-btn yt-subscribe-btn--large">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}>
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                Subscribe
              </a>
            </div>
          </GlassSurface>
        </div>

      </div>
    </div>
  )
}
