import React, { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import BubbleMenu from './components/BubbleMenu'
import Home from './pages/Home'
import Post from './pages/Post'
import Category from './pages/Category'
import Music from './pages/Music'
import YouTube from './pages/YouTube'
import Dashboard from './dashboard/Dashboard'
import DotGrid from './components/DotGrid'
import { VolumeControl } from './components/TrackPlayer'
import SubscribeModal from './components/SubscribeModal'
import ConfirmSubscription from './pages/ConfirmSubscription'
import AuthPrompt from './components/AuthPrompt'
import { useAuth } from './lib/auth'

// Lazy load pages that use Three.js — only downloads when visited
const Adrian   = lazy(() => import('./pages/Adrian'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Account  = lazy(() => import('./pages/Account'))
const AuthPage = lazy(() => import('./pages/Account').then(m => ({ default: m.AuthPage })))

const NAV_ITEMS = [
  { label: 'home',    href: '/',        ariaLabel: 'Home',    rotation: -8, hoverStyles: { bgColor: '#00f5ff', textColor: '#03020f' } },
  { label: 'music',   href: '/music',   ariaLabel: 'Music',   rotation: 8,  hoverStyles: { bgColor: '#b400ff', textColor: '#ffffff' } },
  { label: 'youtube', href: '/youtube', ariaLabel: 'YouTube', rotation: -5, hoverStyles: { bgColor: '#ff0000', textColor: '#ffffff' } },
  { label: 'adrian',  href: '/adrian',  ariaLabel: 'Adrian',  rotation: 8,  hoverStyles: { bgColor: '#00ff88', textColor: '#03020f' } },
]

// Minimal fallback while lazy chunks load
function PageFallback() {
  return <div style={{ minHeight: '60vh' }} />
}

export default function App() {
  const location = useLocation()
  const { user } = useAuth()
  const isAdrianPage  = location.pathname === '/adrian'
  const isDashboard   = location.pathname.startsWith('/dashboard')
  const isNotFound    = !['/', '/music', '/youtube', '/adrian', '/dashboard', '/confirm', '/login', '/register', '/account'].includes(location.pathname) &&
    !location.pathname.startsWith('/posts/') &&
    !location.pathname.startsWith('/category/')
  const isPostPage    = location.pathname.startsWith('/posts/')

  if (isDashboard) {
    return (
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    )
  }

  // /adrian is a standalone personal page — shareable on its own (LinkedIn etc)
  // so it renders outside the blog chrome and brings its own nav + footer.
  if (isAdrianPage) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/adrian" element={<Adrian />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <>
      {!isAdrianPage && !isNotFound && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <DotGrid
            dotSize={6} gap={14} baseColor="#232323" activeColor="#9b287b"
            proximity={100} shockRadius={200} shockStrength={17}
            resistance={1650} returnDuration={1.3}
          />
        </div>
      )}

      <BubbleMenu
        logo={
          <span style={{
            fontFamily: 'Orbitron, monospace', fontWeight: 700,
            fontSize: '0.72rem', color: '#00f5ff',
            letterSpacing: '0.06em', whiteSpace: 'nowrap',
            textShadow: '0 0 12px rgba(0,245,255,0.4)',
          }}>
            TheAdrianBlog
          </span>
        }
        items={[
          ...NAV_ITEMS,
          user
            ? { label: 'account', href: '/account', ariaLabel: 'Your account', rotation: -6, hoverStyles: { bgColor: '#ffd000', textColor: '#03020f' } }
            : { label: 'log in',  href: '/login',   ariaLabel: 'Log in or create an account', rotation: -6, hoverStyles: { bgColor: '#ffd000', textColor: '#03020f' } },
        ]}
        menuAriaLabel="Toggle navigation"
        menuBg="rgba(7,5,25,0.95)"
        menuContentColor="#00f5ff"
        useFixedPosition={true}
        animationEase="back.out(1.5)"
        animationDuration={0.5}
        staggerDelay={0.1}
      />

      <div className="page-content">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/"                   element={<Home />} />
            <Route path="/posts/:slug"        element={<Post />} />
            <Route path="/category/:category" element={<Category />} />
            <Route path="/music"              element={<Music />} />
            <Route path="/music/artist/:artistId" element={<Music />} />
            <Route path="/music/album/:albumId" element={<Music />} />
            <Route path="/youtube"            element={<YouTube />} />
            <Route path="/adrian"             element={<Adrian />} />
            <Route path="/confirm"            element={<ConfirmSubscription />} />
            <Route path="/login"              element={<AuthPage mode="login" />} />
            <Route path="/register"           element={<AuthPage mode="register" />} />
            <Route path="/account"            element={<Account />} />
            <Route path="*"                   element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>

      {isPostPage && <VolumeControl />}
      <SubscribeModal />
      <AuthPrompt />

      <footer className="footer">
        <p>© {new Date().getFullYear()} TheAdrianBlog — built different</p>
      </footer>
    </>
  )
}
