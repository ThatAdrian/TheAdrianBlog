import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Post from './pages/Post'
import Category from './pages/Category'

export default function App() {
  return (
    <>
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
