// scripts/build-sitemap.mjs
// Run after build-posts.mjs — reads posts.json and generates public/sitemap.xml

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const postsPath = path.join(__dirname, '../public/posts.json')
const outPath = path.join(__dirname, '../public/sitemap.xml')
const SITE_URL = 'https://www.theadrianblog.com'

const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'))

const today = new Date().toISOString().split('T')[0]

const urls = [
  // Homepage
  `  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`,

  // Category pages
  ...['Tech', 'Music Reviews', 'General'].map(cat => `  <url>
    <loc>${SITE_URL}/category/${encodeURIComponent(cat)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`),

  // Individual posts
  ...posts.map((post) => `  <url>
    <loc>${SITE_URL}/posts/${post.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`),
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

fs.writeFileSync(outPath, xml)
console.log(`Built sitemap with ${posts.length + 4} URLs → public/sitemap.xml`)
