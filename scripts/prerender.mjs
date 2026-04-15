import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir   = path.join(__dirname, '../dist')
const postsJson = path.join(distDir, 'posts.json')
const indexHtml = path.join(distDir, 'index.html')

if (!fs.existsSync(postsJson)) {
  console.log('No posts.json found, skipping prerender')
  process.exit(0)
}

const posts = JSON.parse(fs.readFileSync(postsJson, 'utf8'))
const template = fs.readFileSync(indexHtml, 'utf8')

function toIso(date) {
  const [day, month, year] = date.split('/')
  if (!day || !month || !year) return new Date().toISOString()
  return new Date(`${year}-${month}-${day}`).toISOString()
}

function buildJsonLd(post) {
  const isMusicReview = (post.categories || []).includes('Music Reviews')
  const url       = `https://www.theadrianblog.com/posts/${post.slug}`
  const imageUrl  = post.image && post.image !== 'placeholder.png'
    ? `https://www.theadrianblog.com/${post.image}`
    : 'https://www.theadrianblog.com/og-image.png'
  const iso = toIso(post.date || '')
  const rating = parseFloat(post.rating || '0')

  const schema = {
    '@context': 'https://schema.org',
    '@type': isMusicReview ? 'Review' : 'BlogPosting',
    headline: post.title,
    description: post.summary,
    url,
    datePublished: iso,
    dateModified: iso,
    image: imageUrl,
    author: {
      '@type': 'Person',
      name: 'Adrian',
      url: 'https://www.theadrianblog.com/adrian',
    },
    publisher: {
      '@type': 'Organization',
      name: 'TheAdrianBlog',
      url: 'https://www.theadrianblog.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.theadrianblog.com/og-image.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    ...(isMusicReview && rating > 0 ? {
      reviewRating: {
        '@type': 'Rating',
        ratingValue: rating,
        bestRating: 5,
        worstRating: 1,
      },
      itemReviewed: {
        '@type': 'MusicAlbum',
        name: post.title.replace(/ - .+ Review$/, ''),
      },
    } : {}),
  }

  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`
}

function buildMeta(post) {
  const imageUrl = post.image && post.image !== 'placeholder.png'
    ? `https://www.theadrianblog.com/${post.image}`
    : 'https://www.theadrianblog.com/og-image.png'
  const url = `https://www.theadrianblog.com/posts/${post.slug}`

  return `
    <title>${post.title} | TheAdrianBlog</title>
    <meta name="description" content="${post.summary.replace(/"/g, '&quot;')}">
    <meta property="og:title" content="${post.title}">
    <meta property="og:description" content="${post.summary.replace(/"/g, '&quot;')}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:url" content="${url}">
    <meta property="og:type" content="article">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${post.title}">
    <meta name="twitter:description" content="${post.summary.replace(/"/g, '&quot;')}">
    <meta name="twitter:image" content="${imageUrl}">
    <link rel="canonical" href="${url}">
    ${buildJsonLd(post)}`
}

let count = 0

for (const post of posts) {
  if (post.draft) continue

  const outDir = path.join(distDir, 'posts', post.slug)
  fs.mkdirSync(outDir, { recursive: true })

  // Inject meta + JSON-LD into the <head>, replacing default title/description
  const html = template
    .replace(/<title>.*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace('</head>', `${buildMeta(post)}\n  </head>`)

  fs.writeFileSync(path.join(outDir, 'index.html'), html)
  count++
}

console.log(`Prerendered ${count} posts → dist/posts/*/index.html`)
