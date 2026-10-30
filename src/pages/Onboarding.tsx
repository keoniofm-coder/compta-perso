import { useState } from 'react'
import { ArrowRight, Check, Sparkles, Wand2 } from 'lucide-react'
import { AmountInput, Button, Field, Input, cx } from '../components/ui'
import { CurrencySelect } from '../forms/AccountForms'
import { FIAT, parseAmount } from '../lib/currency'
import { today } from '../lib/dates'
import { buildDemo } from '../lib/demo'
import { ACCOUNT_TYPES } from '../lib/meta'
import { saveSettings, uid, useData } from '../lib/store'
import type { Account, AccountType } from '../lib/types'
import { toast } from '../lib/ui'

interface Preset {
  key: string
  name: string
  type: AccountType
  currency?: string
  on: boolean
  balance: string
}

const PRESETS: Preset[] = [
  { key: 'courant', name: 'Compte courant', type: 'courant', on: true, balance: '' },
  { key: 'principal', name: 'Compte principal', type: 'banque', on: true, balance: '' },
  { key: 'livret', name: 'Livret A', type: 'epargne', on: true, balance: '' },
  { key: 'pro', name: 'Compte agence', type: 'pro', on: true, balance: '' },
  { key: 'crypto', name: 'Crypto (exchange)', type: 'crypto', on: false, balance: '' },
  { key: 'invest', name: 'PEA / compte-titres', type: 'invest', on: false, balance: '' },
  { key: 'cash', name: 'Espèces', type: 'cash', on: false, balance: '' },
]

export function Onboarding({ defaultName }: { defaultName: string }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(defaultName)
  const [base, setBase] = useState('EUR')
  const [presets, setPresets] = useState(PRESETS)

  const finish = () => {
    const accounts: Account[] = presets
      .filter((p) => p.on)
      .map((p, i) => ({
        id: uid(),
        name: p.name,
        type: p.type,
        currency: p.currency ?? base,
        initialBalance: parseAmount(p.balance),
        initialDate: today(),
        scope: p.type === 'pro' ? 'pro' : 'perso',
        order: i,
      }))
    useData.getState().putMany(accounts.map((a) => ({ collection: 'accounts', item: a })))
    saveSettings({ displayName: name.trim() || undefined, baseCurrency: base, onboarded: true })
    toast('Ton espace est prêt 🎉')
  }

  const demo = () => {
    useData.getState().putMany(buildDemo())
    saveSettings({ displayName: name.trim() || undefined, baseCurrency: 'EUR', onboarded: true })
    toast("Données d'exemple chargées : tu pourras les effacer dans Réglages", 'info')
  }

  return (
    <div className="min-h-dvh flex items-start sm:items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-8 anim-fade-up">
          <img src="/favicon.svg" alt="" className="size-11 rounded-xl shadow-lg shadow-indigo-500/30" />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Bienvenue sur Trezo</div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">{step === 0 ? 'On configure ton espace' : 'Tes comptes de départ'}</h1>
          </div>
        </div>

        {step === 0 ? (
          <div className="card p-6 sm:p-8 space-y-6 anim-fade-up">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Comment on t'appelle ?">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom" />
              </Field>
              <Field label="Devise principale" hint="Tous les totaux seront convertis dans cette devise.">
                <CurrencySelect value={base} onChange={setBase} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="group rounded-2xl border-2 border-indigo-500/60 bg-indigo-500/5 p-5 text-left hover:bg-indigo-500/10 transition"
              >
                <Wand2 className="size-6 text-indigo-500 mb-3" />
                <div className="font-semibold text-ink flex items-center gap-1.5">Partir de zéro <ArrowRight className="size-4 group-hover:translate-x-0.5 transition" /></div>
                <div className="text-sm text-ink-2 mt-1">Je crée mes comptes avec leurs soldes actuels.</div>
              </button>
              <button type="button" onClick={demo} className="group rounded-2xl border-2 border-line-strong p-5 text-left hover:border-pink-400/60 transition">
                <Sparkles className="size-6 text-pink-500 mb-3" />
                <div className="font-semibold text-ink flex items-center gap-1.5">Explorer avec un exemple</div>
                <div className="text-sm text-ink-2 mt-1">9 mois de données fictives pour tout tester, effaçables en 1 clic.</div>
              </button>
            </div>
          </div>
        ) : (
          <div className="card p-6 sm:p-8 space-y-5 anim-fade-up">
            <p className="text-sm text-ink-2">Coche les comptes que tu as et indique leur solde aujourd'hui. Tu pourras en ajouter, renommer ou changer de devise ensuite.</p>
            <div className="space-y-2">
              {presets.map((p, i) => {
                const m = ACCOUNT_TYPES[p.type]
                return (
                  <div key={p.key} className={cx('flex items-center gap-3 rounded-2xl border p-3 transition', p.on ? 'border-line-strong bg-surface-2' : 'border-line opacity-60')}>
                    <button
                      type="button"
                      aria-label={p.on ? 'Retirer' : 'Ajouter'}
                      onClick={() => setPresets(presets.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
                      className={cx('size-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition', p.on ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-line-strong')}
                    >
                      {p.on && <Check className="size-4" strokeWidth={3} />}
                    </button>
                    <m.icon className="size-5 shrink-0 text-ink-2" />
                    <Input className="h-9 flex-1 min-w-0" value={p.name} onChange={(e) => setPresets(presets.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <AmountInput className="w-32 sm:w-40" value={p.balance} onChange={(v) => setPresets(presets.map((x, j) => (j === i ? { ...x, balance: v, on: true } : x)))} currency={FIAT.find((f) => f.code === base)?.symbol ?? base} />
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep(0)}>Retour</Button>
              <Button variant="primary" size="lg" onClick={finish}>
                C'est parti <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
