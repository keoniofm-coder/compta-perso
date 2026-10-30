// Inscription sur invitation : vérifie le code, puis crée le compte déjà confirmé (aucun email envoyé).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  let body: { email?: string; password?: string; name?: string; code?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Requête invalide' }, 400)
  }
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const name = (body.name ?? '').trim().slice(0, 60)
  const code = (body.code ?? '').trim()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Adresse email invalide' }, 400)
  if (password.length < 8) return json({ error: 'Le mot de passe doit faire au moins 8 caractères' }, 400)
  if (!code) return json({ error: "Code d'invitation manquant" }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: allowed, error: rpcError } = await admin.rpc('allow_signup', { p_email: email, p_code: code })
  if (rpcError) return json({ error: 'Erreur serveur, réessaie plus tard' }, 500)
  if (!allowed) return json({ error: "Code d'invitation invalide (ou nombre maximum de comptes atteint)" }, 403)

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })
  if (error) {
    const exists = /already|registered|exists/i.test(error.message)
    return json({ error: exists ? 'Un compte existe déjà avec cet email' : error.message }, exists ? 409 : 400)
  }
  return json({ ok: true })
})
