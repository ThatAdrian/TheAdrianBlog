const REPO = 'ThatAdrian/TheAdrianBlog'
const BRANCH = 'main'

function getToken() {
  return sessionStorage.getItem('db_token') ?? ''
}

function getHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github.v3+json',
  }
}

export async function getFileSha(path: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`,
    { headers: getHeaders() }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.sha ?? null
}

export async function commitFile(path: string, content: string, message: string): Promise<boolean> {
  const sha = await getFileSha(path)
  const body: any = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: BRANCH,
  }
  if (sha) body.sha = sha
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body),
  })
  return res.ok
}

export async function uploadImage(path: string, base64Data: string): Promise<string | null> {
  const sha = await getFileSha(path)
  const body: any = {
    message: `Upload image: ${path}`,
    content: base64Data,
    branch: BRANCH,
  }
  if (sha) body.sha = sha
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.content?.download_url ?? null
}

export interface GitHubFile {
  name: string
  path: string
  sha: string
}

export async function listPostFiles(): Promise<GitHubFile[]> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/content/posts?ref=${BRANCH}`,
    { headers: getHeaders() }
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data as any[])
    .filter(f => f.name.endsWith('.md'))
    .map(f => ({ name: f.name, path: f.path, sha: f.sha }))
}

export async function getFileContent(path: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`,
    { headers: getHeaders() }
  )
  if (!res.ok) return null
  const data = await res.json()
  try {
    return decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))))
  } catch {
    return null
  }
}

export function slugify(title: string): string {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
