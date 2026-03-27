import React from 'react'
import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">TheAdrianBlog</Link>
      <ul className="navbar-links">
        <li><Link to="/">Home</Link></li>
        <li><Link to="/category/Tech">Tech</Link></li>
        <li><Link to="/category/Music Reviews">Music</Link></li>
        <li><Link to="/category/General">General</Link></li>
      </ul>
    </nav>
  )
}
