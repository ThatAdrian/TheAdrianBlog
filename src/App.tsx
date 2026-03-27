import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Post from './pages/Post'
import Category from './pages/Category'
import DotGrid from './components/DotGrid'

export default function App() {
  return (
    <>
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}>
        <DotGrid
          dotSize={6}
          gap={14}
          baseColor="#232323"
          activeColor="#9b287b"
          proximity={100}
          shockRadius={200}
          shockStrength={17}
          resistance={1650}
          returnDuration={1.3}
        />
      </div>
      <Navbar />
      <div className="page-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/posts/:slug" element={<Post />} />
          <Route path="/category/:category" element={<Category />} />
        </Routes>
      </div>
      <footer className="footer">
        <p>© {new Date().getFullYear()} TheAdrianBlog — built different</p>
      </footer>
    </>
  )
}
