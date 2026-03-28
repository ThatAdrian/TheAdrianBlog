// Example: How to use StarRating in a music review page
// Place this inside any of your review posts' corresponding page component,
// or use it as a standalone React component embedded in your post layout.
//
// Import at the top of your Post.tsx or any review-specific component:

import { AlbumRating, TrackRating } from '../components/StarRating';

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE: Charli XCX — BRAT review
// ─────────────────────────────────────────────────────────────────────────────

export default function BratReview() {
  return (
    <div className="post-detail page-transition">

      {/* ── Big album rating at the top ── */}
      {/*
        albumId:      unique string — used to store community ratings.
                      Use the album slug, never change it after publishing.
        albumName:    displayed label (not currently shown but good for a11y)
        artistRating: YOUR rating, 0.5–5 in 0.5 steps
        showCommunity: set false to hide the community section entirely
      */}
      <AlbumRating
        albumId="charli-xcx-brat-2024"
        albumName="BRAT — Charli XCX"
        artistRating={4.5}
        showCommunity={true}
      />

      {/* ── Your review prose ── */}
      <div className="prose-custom">
        <p>Your review text goes here...</p>

        <h2>Track by track</h2>
      </div>

      {/* ── Track list with individual ratings ── */}
      {/*
        Wrap all your TrackRatings in a .track-list div for spacing.
        trackId:      unique string per track — use "albumslug-tracknumber"
        trackName:    the song name
        artistRating: YOUR rating for that track, 0.5–5 in 0.5 steps
        size:         "sm" (default) or "md" for slightly larger
      */}
      <div className="track-list">
        <TrackRating trackId="brat-01" trackName="360"              artistRating={4.5} />
        <TrackRating trackId="brat-02" trackName="Club classics"    artistRating={4.0} />
        <TrackRating trackId="brat-03" trackName="Sympathy is a knife" artistRating={5.0} />
        <TrackRating trackId="brat-04" trackName="I might say something stupid" artistRating={3.5} />
        <TrackRating trackId="brat-05" trackName="Talk talk"        artistRating={4.5} />
        <TrackRating trackId="brat-06" trackName="Von dutch"        artistRating={5.0} />
        <TrackRating trackId="brat-07" trackName="Everything is romantic" artistRating={3.0} />
        <TrackRating trackId="brat-08" trackName="Rewind"           artistRating={4.0} />
        <TrackRating trackId="brat-09" trackName="So I"             artistRating={4.5} />
        <TrackRating trackId="brat-10" trackName="Girl, so confusing" artistRating={4.5} />
        <TrackRating trackId="brat-11" trackName="Apple"            artistRating={5.0} />
        <TrackRating trackId="brat-12" trackName="B2b"              artistRating={3.5} />
        <TrackRating trackId="brat-13" trackName="Mean girls"       artistRating={4.0} />
        <TrackRating trackId="brat-14" trackName="365"              artistRating={5.0} />
        <TrackRating trackId="brat-15" trackName="Guess"            artistRating={4.5} />
      </div>

      {/* ── Continue prose ── */}
      <div className="prose-custom">
        <p>More of your review...</p>
      </div>

    </div>
  );
}
