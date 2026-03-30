import { useEffect } from 'react'

interface SEOProps {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'article'
}

const SITE_NAME = 'TheAdrianBlog'
const SITE_URL = 'https://www.theadrianblog.com'
const SITE_DESCRIPTION = 'Welcome to the Adrian blog every1! Join in for discussions and reviews on music, tech and everything in between!'
const SITE_IMAGE = `${SITE_URL}/og-image.jpg`
const TWITTER_HANDLE = '@theadrianblog'

export default function SEO({
  title,
  description = SITE_DESCRIPTION,
  image = SITE_IMAGE,
  url,
  type = 'website',
}: SEOProps) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME
  const fullUrl = url ? `${SITE_URL}${url}` : SITE_URL
  const fullImage = image.startsWith('http') ? image : `${SITE_URL}/${image}`

  useEffect(() => {
    // ── Title ──────────────────────────────────────────────────────────────
    document.title = fullTitle

    // ── Helper ─────────────────────────────────────────────────────────────
    function setMeta(selector: string, content: string) {
      let el = document.querySelector(selector) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement('meta')
        const attr = selector.includes('property=') ? 'property' : 'name'
        const val = selector.match(/["']([^"']+)["']/)?.[1] ?? ''
        el.setAttribute(attr, val)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    // ── Standard meta ──────────────────────────────────────────────────────
    setMeta('meta[name="description"]', description)
    setMeta('meta[name="author"]', 'Adrian')
    setMeta('meta[name="robots"]', 'index, follow')

    // ── Canonical ──────────────────────────────────────────────────────────
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', fullUrl)

    // ── Open Graph (WhatsApp, Discord, Facebook) ───────────────────────────
    setMeta('meta[property="og:type"]', type)
    setMeta('meta[property="og:site_name"]', SITE_NAME)
    setMeta('meta[property="og:title"]', fullTitle)
    setMeta('meta[property="og:description"]', description)
    setMeta('meta[property="og:image"]', fullImage)
    setMeta('meta[property="og:image:width"]', '1200')
    setMeta('meta[property="og:image:height"]', '630')
    setMeta('meta[property="og:url"]', fullUrl)

    // ── Twitter / X cards ──────────────────────────────────────────────────
    setMeta('meta[name="twitter:card"]', 'summary_large_image')
    setMeta('meta[name="twitter:site"]', TWITTER_HANDLE)
    setMeta('meta[name="twitter:title"]', fullTitle)
    setMeta('meta[name="twitter:description"]', description)
    setMeta('meta[name="twitter:image"]', fullImage)
    setMeta('meta[name="twitter:image:alt"]', fullTitle)

  }, [fullTitle, description, fullImage, fullUrl, type])

  return null
}
