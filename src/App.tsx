import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Loader2 } from 'lucide-react'
import { Layout } from './components/Layout'
import { ModalHost } from './components/ModalHost'
import { ConfirmHost, ToastHost } from './components/ui'
import { dueAutoTransactions } from './lib/calc'
import { makeConverter, registerCryptoIds, registerQuoteSymbols, setCustomCryptos, useRates } from './lib/currency'
import { setCustomCategories } from './lib/meta'
import { LOCAL_USER, useData, useSettings } from './lib/store'
import { supabase } from './lib/supabase'
import { toast } from './lib/ui'
import { AuthPage } from './pages/Auth'
import { Onboarding } from './pages/Onboarding'

function useRoute() {
  const get = () => (location.hash.replace(/^#/, '') || '/').split('?')[0]
  const [route, setRoute] = useState(get)
  useEffect(() => {
    const fn = () => setRoute(get())
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  return route
}

const localMode = () => new URLSearchParams(location.search).has('local')

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const open = useData((s) => s.open)
  const close = useData((s) => s.close)
  const userId = useData((s) => s.userId)
  const loaded = useData((s) => s.loaded)

  useEffect(() => {
    if (localMode()) {
      setSession(null)
      void open(LOCAL_USER)
      return
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [open])

  useEffect(() => {
    if (localMode()) return
    if (session?.user && session.user.id !== useData.getState().userId) void open(session.user.id)
    if (session === null && useData.getState().userId) close()
  }, [session, open, close])

  if (!localMode() && session === undefined) return <Splash />
  if (!localMode() && !session) {
    return (
      <>
        <AuthPage />
        <ToastHost />
      </>
    )
  }
  if (!userId || !loaded) return <Splash />
  return <Ready email={session?.user.email ?? 'local'} name={(session?.user.user_metadata?.name as string) ?? ''} />
}

function Ready({ email, name }: { email: string; name: string }) {
  const settings = useSettings()
  const accounts = useData((s) => s.db.accounts)
  const holdings = useData((s) => s.db.holdings)
  const recurrings = useData((s) => s.db.recurrings)
  const transactions = useData((s) => s.db.transactions)
  const [tick, setTick] = useState(0)
  const refresh = useRates((s) => s.refresh)
  const setOverrides = useRates((s) => s.setOverrides)
  const route = useRoute()

  useEffect(() => {
    setCustomCryptos(settings.customCryptos)
    setCustomCategories(settings.customCategories)
    setOverrides(settings.rateOverrides ?? {})
  }, [settings.customCryptos, settings.customCategories, settings.rateOverrides, setOverrides])

  useEffect(() => {
    registerCryptoIds(Object.values(holdings).map((h) => h.cryptoId ?? ''))
    registerQuoteSymbols(Object.values(holdings).map((h) => (h.autoPrice && !h.archived && h.quoteSymbol) || ''))
    void refresh()
    const t = setInterval(() => void refresh(), 15 * 60 * 1000)
    return () => clearInterval(t)
  }, [holdings, refresh])

  // Prélèvements / virements automatiques : on crée les mouvements arrivés à date.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30 * 60 * 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const { rates, overrides } = useRates.getState()
    const due = dueAutoTransactions(useData.getState().db, makeConverter(rates, overrides, settings.baseCurrency))
    if (!due.length) return
    useData.getState().putMany(due.map((item) => ({ collection: 'transactions' as const, item })))
    toast(due.length === 1 ? `Échéance automatique validée : ${due[0].label}` : `${due.length} échéances automatiques validées`)
  }, [recurrings, transactions, tick, settings.baseCurrency])

  const needsOnboarding = !settings.onboarded && Object.keys(accounts).length === 0
  return (
    <>
      {needsOnboarding ? <Onboarding defaultName={name} /> : <Layout route={route} email={email} />}
      <ModalHost />
      <ConfirmHost />
      <ToastHost />
    </>
  )
}

function Splash() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-14 rounded-2xl shadow-xl shadow-indigo-500/30 anim-pop" />
      <Loader2 className="size-5 animate-spin text-muted" />
    </div>
  )
}
