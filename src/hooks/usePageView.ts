import { useEffect } from 'react'

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

export function usePageView(postSlug: string) {
  useEffect(() => {
    if (!postSlug) return
    fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_view`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug: postSlug }),
    })
  }, [postSlug])
}
