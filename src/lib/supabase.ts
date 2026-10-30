import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://tjyiksoqntpmmdkjcrgs.supabase.co'
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_tXFClPCmucfcnGIYGS6QXQ_SCXDMGQh'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'trezo-auth' },
})

export async function signUpWithInvite(params: { email: string; password: string; name: string; code: string }) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify(params),
  })
  let body: { ok?: boolean; error?: string } = {}
  try {
    body = await res.json()
  } catch {
    /* ignore */
  }
  if (!res.ok || !body.ok) throw new Error(body.error ?? "Impossible de créer le compte pour l'instant")
}
