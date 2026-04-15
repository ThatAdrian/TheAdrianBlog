import React from 'react'

interface ArticleJsonLdProps {
  title: string
  summary: string
  slug: string
  date: string
  image?: string
  categories: string[]
  rating?: number
}

// Convert DD/MM/YYYY to ISO 8601
function toIso(date: string): string {
  const [day, month, year] = date.split('/')
  if (!day || !month || !year) return new Date().toISOString()
  return new Date(`${year}-${month}-${day}`).toISOString()
}

export default function JsonLd({ title, summary, slug, date, image, categories, rating }: ArticleJsonLdProps) {
  const isMusicReview = categories.includes('Music Reviews')
  const url = `https://www.theadrianblog.com/posts/${slug}`
  const imageUrl = image ? `https://www.theadrianblog.com/${image}` : 'https://www.theadrianblog.com/og-image.png'
  const iso = toIso(date)

  const article = {
    '@context': 'https://schema.org',
    '@type': isMusicReview ? 'Review' : 'BlogPosting',
    headline: title,
    description: summary,
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
    ...(isMusicReview && rating && rating > 0 ? {
      reviewRating: {
        '@type': 'Rating',
        ratingValue: rating,
        bestRating: 5,
        worstRating: 1,
      },
      itemReviewed: {
        '@type': 'MusicAlbum',
        name: title.replace(/ - .+ Review$/, ''),
      },
    } : {}),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }}
    />
  )
}
