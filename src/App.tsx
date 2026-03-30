import React from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import BubbleMenu from './components/BubbleMenu'
import Home from './pages/Home'
import Post from './pages/Post'
import Category from './pages/Category'
import Music from './pages/Music'
import YouTube from './pages/YouTube'
import Adrian from './pages/Adrian'
import DotGrid from './components/DotGrid'

const NAV_ITEMS = [
  { label: 'home',     href: '/',       ariaLabel: 'Home',     rotation: -8, hoverStyles: { bgColor: '#00f5ff', textColor: '#03020f' } },
  { label: 'music',    href: '/music',  ariaLabel: 'Music',    rotation: 8,  hoverStyles: { bgColor: '#b400ff', textColor: '#ffffff' } },
  { label: 'youtube',  href: '/youtube',ariaLabel: 'YouTube',  rotation: -5, hoverStyles: { bgColor: '#ff0000', textColor: '#ffffff' } },
  { label: 'adrian',   href: '/adrian', ariaLabel: 'Adrian',   rotation: 8,  hoverStyles: { bgColor: '#00ff88', textColor: '#03020f' } },
]

export default function App() {
  const navigate = useNavigate()

  const navItems = NAV_ITEMS.map(item => ({
    ...item,
    href: item.href,
  }))

  return (
    <>
      {/* Fixed dot grid background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <DotGrid
          dotSize={6} gap={14} baseColor="#232323" activeColor="#9b287b"
          proximity={100} shockRadius={200} shockStrength={17}
          resistance={1650} returnDuration={1.3}
        />
      </div>

      {/* BubbleMenu navigation */}
      <BubbleMenu
        logo={
          <span style={{
            fontFamily: 'Orbitron, monospace', fontWeight: 700,
            fontSize: '0.65rem', color: '#00f5ff', letterSpacing: '0.05em'
          }}>
            TAB
          </span>
        }
        items={navItems}
        menuAriaLabel="Toggle navigation"
        menuBg="rgba(7,5,25,0.95)"
        menuContentColor="#00f5ff"
        useFixedPosition={true}
        animationEase="back.out(1.5)"
        animationDuration={0.5}
        staggerDelay={0.1}
      />

      <div className="page-content">
        <Routes>
          <Route path="/"              element={<Home />} />
          <Route path="/posts/:slug"   element={<Post />} />
          <Route path="/category/:category" element={<Category />} />
          <Route path="/music"         element={<Music />} />
          <Route path="/youtube"       element={<YouTube />} />
          <Route path="/adrian"        element={<Adrian />} />
        </Routes>
      </div>

      <footer className="footer">
        <p>© {new Date().getFullYear()} TheAdrianBlog — built different</p>
      </footer>
    </>
  )
}
