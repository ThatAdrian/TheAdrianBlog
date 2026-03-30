import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const postsDir = path.join(__dirname, '../content/posts')
const outDir = path.join(__dirname, '../public')

function parseMarkdown(raw) {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) return null

  const fm = {}
  fmMatch[1].split('\n').forEach(line => {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) return
    const key = line.slice(0, colonIdx).trim()
    const val = line.slice(colonIdx + 1).trim()
    fm[key] = val.replace(/^["']|["']$/g, '')
  })

  const catMatch = fmMatch[1].match(/categories:\s*\n((?:\s+-[^\n]+\n?)+)/)
  if (catMatch) {
    fm.categories = catMatch[1]
      .split('\n')
      .map(l => l.replace(/\s*-\s*/, '').trim())
      .filter(Boolean)
  } else {
    fm.categories = []
  }

  const content = raw.slice(fmMatch[0].length).trim()
  return { ...fm, content }
}

function slugify(title) {
  return title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'))
const posts = []

for (const file of files) {
  const raw = fs.readFileSync(path.join(postsDir, file), 'utf8')
  const parsed = parseMarkdown(raw)
  if (!parsed) continue
  if (parsed.draft === 'true') continue

  posts.push({
    slug: parsed.slug || slugify(parsed.title || file.replace('.md', '')),
    title: parsed.title || '',
    summary: parsed.summary || '',
    date: parsed.date || '',
    categories: parsed.categories || [],
    image: parsed.image || 'placeholder.png',
    rating: parsed.rating || '',
    tracklist: parsed.tracklist || '',
    content: parsed.content || '',
  })
}

posts.sort((a, b) => new Date(b.date) - new Date(a.date))

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'posts.json'), JSON.stringify(posts, null, 2))
console.log(`Built ${posts.length} posts → public/posts.json`)
