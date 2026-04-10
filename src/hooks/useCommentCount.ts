import { useState, useEffect } from 'react'

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

export function useCommentCount(postSlug: string): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    fetch(
      `${SUPABASE_URL}/rest/v1/comments?post_slug=eq.${encodeURIComponent(postSlug)}&select=id`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'count=exact' } }
    ).then(res => {
      const c = res.headers.get('content-range')?.split('/')[1]
      setCount(parseInt(c ?? '0', 10))
    })
  }, [postSlug])

  return count
}
