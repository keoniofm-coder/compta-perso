// Ping quotidien : un projet Supabase gratuit est mis en pause après 7 jours sans requête.
const URL = process.env.VITE_SUPABASE_URL || 'https://tjyiksoqntpmmdkjcrgs.supabase.co'
const KEY = process.env.VITE_SUPABASE_KEY || 'sb_publishable_tXFClPCmucfcnGIYGS6QXQ_SCXDMGQh'

export default async () => {
  const res = await fetch(`${URL}/rest/v1/records?select=id&limit=1`, { headers: { apikey: KEY } })
  console.log('supabase keepalive', res.status)
  return new Response(`ok ${res.status}`)
}

export const config = { schedule: '@daily' }
