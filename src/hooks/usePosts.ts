import { useState, useEffect } from 'react'

export interface Post {
  slug: string
  title: string
  summary: string
  date: string
  categories: string[]
  image: string
  content: string
}

export function usePosts() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/posts.json')
      .then(r => r.json())
      .then(data => { setPosts(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return { posts, loading }
}
