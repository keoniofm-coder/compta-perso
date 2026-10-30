import { useState } from 'react'
import { ArrowRight, BarChart3, Coins, Loader2, Lock, ShieldCheck, Split, Wallet } from 'lucide-react'
import { Button, Field, Input, Segmented } from '../components/ui'
import { signUpWithInvite, supabase } from '../lib/supabase'
import { toast } from '../lib/ui'

const FEATURES = [
  { icon: Wallet, title: 'Tous tes comptes', text: 'Banques, épargne, crypto, compte pro, en plusieurs devises.' },
  { icon: Split, title: 'Répartition en 1 geste', text: 'Ventile tes rentrées du mois vers chaque compte.' },
  { icon: BarChart3, title: 'Placements suivis', text: 'PRU, plus-values, cours crypto en direct.' },
  { icon: Coins, title: 'Patrimoine net', text: 'Comptes + biens − dettes, et son évolution.' },
]

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        await signUpWithInvite({ email, password, name, code })
        toast('Compte créé, bienvenue !')
      }
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (err) throw new Error(err.message.includes('Invalid login') ? 'Email ou mot de passe incorrect' : err.message)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden lg:flex flex-col justify-between p-12 hero-gradient text-white overflow-hidden">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-20 bottom-10 size-80 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-11 rounded-xl ring-2 ring-white/30" />
          <span className="text-xl font-bold tracking-tight">Trezo</span>
        </div>
        <div className="relative max-w-lg">
          <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.1]">Ta compta perso & pro, enfin claire.</h1>
          <p className="mt-4 text-white/80 text-lg">Comptes, rentrées, charges fixes, placements et patrimoine : tout au même endroit, en un coup d'œil.</p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4">
                <f.icon className="size-5 mb-2" />
                <div className="font-semibold">{f.title}</div>
                <div className="text-sm text-white/75 mt-0.5">{f.text}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-2 text-sm text-white/70">
          <ShieldCheck className="size-4" /> Données privées : chacun ne voit que les siennes.
        </div>
      </div>

      <div className="flex flex-col">
        <div className="lg:hidden hero-gradient text-white px-6 pt-12 pb-16 rounded-b-[2rem]">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-10 rounded-xl ring-2 ring-white/30" />
            <span className="text-xl font-bold tracking-tight">Trezo</span>
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight leading-tight">Ta compta perso & pro, enfin claire.</h1>
        </div>
        <div className="flex-1 flex items-start lg:items-center justify-center px-5 sm:px-8 -mt-8 lg:mt-0 pb-10">
          <form onSubmit={submit} className="card w-full max-w-md p-6 sm:p-8 space-y-5 anim-fade-up">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink">{mode === 'login' ? 'Bon retour 👋' : 'Créer ton espace'}</h2>
              <p className="text-sm text-ink-2 mt-1">{mode === 'login' ? 'Connecte-toi pour retrouver tes comptes.' : "Il te faut le code d'invitation."}</p>
            </div>
            <Segmented
              className="w-full"
              value={mode}
              onChange={(m) => {
                setMode(m)
                setError('')
              }}
              options={[
                { value: 'login', label: 'Connexion' },
                { value: 'signup', label: 'Inscription' },
              ]}
            />
            {mode === 'signup' && (
              <Field label="Ton prénom">
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </Field>
            <Field label="Mot de passe" hint={mode === 'signup' ? '8 caractères minimum' : undefined}>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 8 : undefined} required />
            </Field>
            {mode === 'signup' && (
              <Field label="Code d'invitation">
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="TREZO-XXXX-XXXX" required className="tracking-wider font-semibold" />
              </Field>
            )}
            {error && <div className="rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 text-sm px-3.5 py-2.5">{error}</div>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <>{mode === 'login' ? 'Se connecter' : 'Créer mon compte'} <ArrowRight className="size-4" /></>}
            </Button>
            <p className="text-xs text-muted flex items-center gap-1.5 justify-center">
              <Lock className="size-3.5" /> Connexion chiffrée · données hébergées en France (Paris)
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
