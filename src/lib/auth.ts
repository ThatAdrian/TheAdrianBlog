import { useEffect, useState } from 'react'
import { createClient, Session, User } from '@supabase/supabase-js'

// Accounts (Supabase Auth). Commenting, rating, artist tracking and "I'm going"
// need one; likes, views and subscriptions stay accountless. Tables and RLS:
// supabase/migrations/20261102000000_user_accounts.sql.
//
// Only account-owned reads/writes go through this client (it sends the user's
// token). Everything else keeps using plain fetch with the public key, since
// those tables only have `anon` read policies.

export const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Implicit so the confirmation link works even when it's opened on a
    // different device from the one that registered
    flowType: 'implicit',
    storageKey: 'tab_auth',
  },
})

export interface Profile { id: string; display_name: string }

export interface AuthState {
  ready: boolean            // false until the stored session has been checked
  user: User | null
  profile: Profile | null
  recovering: boolean       // opened a password-reset link; show "set a new password"
}

const AUTH_EVENT = 'tab:auth'
const PROMPT_EVENT = 'tab:auth-required'
const FP_KEY = 'tab_fp'

let state: AuthState = { ready: false, user: null, profile: null, recovering: false }

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch }
  window.dispatchEvent(new Event(AUTH_EVENT))
}

export function getAuth(): AuthState { return state }
export function currentUserId(): string | null { return state.user?.id ?? null }

export function useAuth(): AuthState {
  const [s, setS] = useState(state)
  useEffect(() => {
    const sync = () => setS(state)
    window.addEventListener(AUTH_EVENT, sync)
    sync()
    return () => window.removeEventListener(AUTH_EVENT, sync)
  }, [])
  return s
}

// ── Account listeners (tracked artists, going) ──────────────────────────────
// Called once the session is known: with the user after sign-in (firstLink is
// true the first time this browser's old fingerprint data was moved into this
// account), or with null when signed out.
type AccountListener = (user: User | null, firstLink: boolean) => void | Promise<void>
const listeners = new Set<AccountListener>()
let lastNotified: { id: string | null; firstLink: boolean } | null = null
let linkSeq = 0

export function onAccountChange(fn: AccountListener): () => void {
  listeners.add(fn)
  if (lastNotified && state.ready) fn(state.user, false)
  return () => listeners.delete(fn)
}

function legacyFingerprint(): string | null {
  try { return localStorage.getItem(FP_KEY) } catch { return null }
}

async function loadProfile(user: User) {
  const { data } = await supabase.from('profiles').select('id,display_name').eq('id', user.id).maybeSingle()
  if (state.user?.id === user.id) setState({ profile: (data as Profile | null) ?? null })
}

async function linkAccount(user: User | null) {
  const id = user?.id ?? null
  if (lastNotified && lastNotified.id === id) return
  const seq = ++linkSeq
  let firstLink = false

  if (user) {
    // Move this browser's pre-account tracked artists / going marks into the
    // account, once per account per browser
    const fp = legacyFingerprint()
    const flag = `tab_claimed_${user.id}`
    if (fp && !localStorage.getItem(flag)) {
      const { error } = await supabase.rpc('claim_fingerprint', { fp })
      if (!error) {
        try { localStorage.setItem(flag, '1') } catch { /* ignore */ }
        firstLink = true
      }
    }
  }

  if (seq !== linkSeq) return   // signed in/out again while this was running
  lastNotified = { id, firstLink }
  await Promise.all([...listeners].map(fn => Promise.resolve(fn(user, firstLink)).catch(() => {})))
}

function applySession(session: Session | null) {
  const user = session?.user ?? null
  const changed = user?.id !== state.user?.id
  setState({ ready: true, user, profile: changed ? null : state.profile })
  if (user && (changed || !state.profile)) loadProfile(user)
  // supabase-js warns against awaiting its own calls inside the auth callback
  setTimeout(() => { linkAccount(user) }, 0)
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') setState({ recovering: true })
  if (event === 'SIGNED_OUT') setState({ recovering: false })
  if (event === 'TOKEN_REFRESHED' && session?.user?.id === state.user?.id) return
  applySession(session)
})

// ── Asking for an account ────────────────────────────────────────────────────
// Returns true when signed in. Otherwise opens the "you need an account"
// prompt (AuthPrompt in App.tsx) and returns false.
export function requireAccount(reason: string): boolean {
  if (state.user) return true
  window.dispatchEvent(new CustomEvent(PROMPT_EVENT, { detail: { reason } }))
  return false
}

export function onAuthRequired(fn: (reason: string) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent).detail?.reason ?? '')
  window.addEventListener(PROMPT_EVENT, h)
  return () => window.removeEventListener(PROMPT_EVENT, h)
}

// Where to come back to after logging in
export function loginHref(next = window.location.pathname + window.location.search, mode: 'login' | 'register' = 'login') {
  const page = mode === 'register' ? '/register' : '/login'
  return next && next !== '/' && !next.startsWith('/login') && !next.startsWith('/register')
    ? `${page}?next=${encodeURIComponent(next)}`
    : page
}

// ── Actions ──────────────────────────────────────────────────────────────────
const accountUrl = () => `${window.location.origin}/account`

export function cleanDisplayName(name: string) {
  return name.replace(/\s+/g, ' ').trim()
}

export function displayNameProblem(name: string): string | null {
  const n = cleanDisplayName(name)
  if (n.length < 2) return 'Display name needs at least 2 characters.'
  if (n.length > 30) return 'Display name can be up to 30 characters.'
  return null
}

export async function isDisplayNameTaken(name: string, exceptId?: string): Promise<boolean> {
  const escaped = cleanDisplayName(name).replace(/[\\%_]/g, c => `\\${c}`)
  const { data, error } = await supabase.from('profiles').select('id').ilike('display_name', escaped).limit(2)
  if (error || !data) return false
  return data.some(r => r.id !== exceptId)
}

function friendly(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'Wrong email or password.'
  if (m.includes('email not confirmed')) return 'Confirm your email first. Check your inbox for the link.'
  if (m.includes('already registered')) return 'There is already an account with that email. Try logging in.'
  if (m.includes('password should be')) return 'Password needs at least 8 characters.'
  if (m.includes('rate limit')) return 'Too many attempts. Wait a minute and try again.'
  if (m.includes('duplicate key') || m.includes('profiles_display_name')) return 'That display name is taken.'
  return message
}

export async function register(email: string, password: string, displayName: string): Promise<{ error?: string; needsConfirm?: boolean }> {
  const problem = displayNameProblem(displayName)
  if (problem) return { error: problem }
  if (password.length < 8) return { error: 'Password needs at least 8 characters.' }
  if (await isDisplayNameTaken(displayName)) return { error: 'That display name is taken.' }
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: cleanDisplayName(displayName) }, emailRedirectTo: accountUrl() },
  })
  if (error) return { error: friendly(error.message) }
  // With "Confirm email" on, Supabase returns a user with no identities when
  // the email is already registered, and no session until it's confirmed
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: 'There is already an account with that email. Try logging in.' }
  }
  return { needsConfirm: !data.session }
}

export async function logIn(email: string, password: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  return error ? { error: friendly(error.message) } : {}
}

export async function logOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function sendPasswordReset(email: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: accountUrl() })
  return error ? { error: friendly(error.message) } : {}
}

export async function setNewPassword(password: string): Promise<{ error?: string }> {
  if (password.length < 8) return { error: 'Password needs at least 8 characters.' }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: friendly(error.message) }
  setState({ recovering: false })
  return {}
}

export async function updateDisplayName(name: string): Promise<{ error?: string }> {
  const user = state.user
  if (!user) return { error: 'Log in first.' }
  const problem = displayNameProblem(name)
  if (problem) return { error: problem }
  const clean = cleanDisplayName(name)
  if (await isDisplayNameTaken(clean, user.id)) return { error: 'That display name is taken.' }
  const { error } = await supabase.from('profiles').update({ display_name: clean }).eq('id', user.id)
  if (error) return { error: friendly(error.message) }
  setState({ profile: { id: user.id, display_name: clean } })
  return {}
}
