import { useState, type ReactNode } from 'react'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRightLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  CloudOff,
  Eye,
  EyeOff,
  Gem,
  LayoutDashboard,
  Landmark,
  Loader2,
  Menu,
  Moon,
  Plus,
  Settings as SettingsIcon,
  Split,
  Sun,
  TrendingUp,
  Wallet,
  Check,
  type LucideIcon,
} from 'lucide-react'
import { useData, useSettings } from '../lib/store'
import { navigate, openModal, useUI } from '../lib/ui'
import { cx, IconButton, Modal } from './ui'
import { Dashboard } from '../pages/Dashboard'
import { Accounts } from '../pages/Accounts'
import { AccountDetail } from '../pages/AccountDetail'
import { Courant } from '../pages/Courant'
import { Movements } from '../pages/Movements'
import { Recurrings } from '../pages/Recurrings'
import { Investments } from '../pages/Investments'
import { Patrimoine } from '../pages/Patrimoine'
import { Business } from '../pages/Business'
import { SettingsPage } from '../pages/Settings'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  color: string
}

export const NAV: NavItem[] = [
  { path: '/', label: 'Tableau de bord', icon: LayoutDashboard, color: '#6366f1' },
  { path: '/comptes', label: 'Comptes', icon: Landmark, color: '#2a78d6' },
  { path: '/courant', label: 'Compte courant', icon: Wallet, color: '#0ea5e9' },
  { path: '/mouvements', label: 'Entrées & sorties', icon: ArrowLeftRight, color: '#10b981' },
  { path: '/fixes', label: 'Fixes & échéancier', icon: CalendarClock, color: '#f59e0b' },
  { path: '/placements', label: 'Placements', icon: TrendingUp, color: '#8b5cf6' },
  { path: '/patrimoine', label: 'Patrimoine', icon: Gem, color: '#ec4899' },
  { path: '/agence', label: 'Agence', icon: BriefcaseBusiness, color: '#f43f5e' },
  { path: '/reglages', label: 'Réglages', icon: SettingsIcon, color: '#64748b' },
]

function isActive(route: string, path: string) {
  return path === '/' ? route === '/' : route === path || route.startsWith(`${path}/`)
}

function SyncBadge({ compact }: { compact?: boolean }) {
  const sync = useData((s) => s.sync)
  const pending = useData((s) => s.pending)
  const userId = useData((s) => s.userId)
  if (userId === 'local') return <span className="text-[11px] text-amber-600 font-medium">Mode local</span>
  const map = {
    idle: { icon: Check, text: 'Synchronisé', cls: 'text-emerald-600 dark:text-emerald-400' },
    synced: { icon: Check, text: 'Synchronisé', cls: 'text-emerald-600 dark:text-emerald-400' },
    syncing: { icon: Loader2, text: 'Synchronisation…', cls: 'text-ink-2' },
    offline: { icon: CloudOff, text: `Hors ligne${pending ? ` · ${pending} en attente` : ''}`, cls: 'text-amber-600 dark:text-amber-400' },
    error: { icon: CloudOff, text: `Non synchronisé${pending ? ` · ${pending}` : ''}`, cls: 'text-rose-600 dark:text-rose-400' },
  }[sync]
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-[11.5px] font-medium', map.cls)} title={map.text}>
      <map.icon className={cx('size-3.5', sync === 'syncing' && 'animate-spin')} />
      {!compact && map.text}
    </span>
  )
}

function ThemeToggle() {
  const isDark = useUI((s) => s.isDark)
  const setTheme = useUI((s) => s.setTheme)
  return <IconButton icon={isDark ? Sun : Moon} label={isDark ? 'Thème clair' : 'Thème sombre'} onClick={() => setTheme(isDark ? 'light' : 'dark')} />
}

function PrivacyToggle() {
  const privacy = useUI((s) => s.privacy)
  const setPrivacy = useUI((s) => s.setPrivacy)
  return <IconButton icon={privacy ? EyeOff : Eye} label={privacy ? 'Afficher les montants' : 'Masquer les montants'} onClick={() => setPrivacy(!privacy)} />
}

function QuickActions({ onClose }: { onClose: () => void }) {
  const accounts = useData((s) => s.db.accounts)
  const courant = Object.values(accounts).find((a) => a.type === 'courant' && !a.archived)
  const go = (fn: () => void) => {
    onClose()
    setTimeout(fn, 10)
  }
  const items: { label: string; sub: string; icon: LucideIcon; color: string; fn: () => void }[] = [
    { label: 'Entrée', sub: 'Salaire, client, vente…', icon: ArrowDownLeft, color: '#10b981', fn: () => openModal({ type: 'tx', kind: 'income' }) },
    { label: 'Sortie', sub: 'Loyer, charge, gros achat…', icon: ArrowUpRight, color: '#f43f5e', fn: () => openModal({ type: 'tx', kind: 'expense' }) },
    { label: 'Virement', sub: "D'un compte à l'autre", icon: ArrowRightLeft, color: '#6366f1', fn: () => openModal({ type: 'tx', kind: 'transfer' }) },
    { label: 'Répartir', sub: 'Ventiler une rentrée', icon: Split, color: '#8b5cf6', fn: () => openModal({ type: 'split' }) },
  ]
  if (courant) items.push({ label: 'Clôturer le mois', sub: 'Reste sur le compte courant', icon: Wallet, color: '#0ea5e9', fn: () => openModal({ type: 'checkpoint', accountId: courant.id }) })
  items.push({ label: 'Valider les fixes', sub: 'Échéancier du mois', icon: CalendarClock, color: '#f59e0b', fn: () => navigate('/fixes') })
  return (
    <Modal title="Ajouter" onClose={onClose} size="sm">
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            onClick={() => go(it.fn)}
            className="rounded-2xl border border-line bg-surface-2 p-3.5 text-left hover:border-line-strong hover:-translate-y-0.5 transition-all"
          >
            <span className="inline-flex size-10 rounded-xl items-center justify-center mb-2" style={{ background: `${it.color}1f`, color: it.color }}>
              <it.icon className="size-5" />
            </span>
            <div className="font-semibold text-sm text-ink">{it.label}</div>
            <div className="text-xs text-muted">{it.sub}</div>
          </button>
        ))}
      </div>
    </Modal>
  )
}

function MobileMenu({ route, onClose }: { route: string; onClose: () => void }) {
  return (
    <Modal title="Menu" onClose={onClose} size="sm">
      <div className="grid grid-cols-3 gap-2.5">
        {NAV.map((n) => (
          <button
            key={n.path}
            type="button"
            onClick={() => {
              onClose()
              navigate(n.path)
            }}
            className={cx('rounded-2xl border p-3 flex flex-col items-center gap-2 text-center transition', isActive(route, n.path) ? 'border-indigo-500/60 bg-indigo-500/8' : 'border-line bg-surface-2')}
          >
            <span className="inline-flex size-11 rounded-2xl items-center justify-center" style={{ background: `${n.color}1f`, color: n.color }}>
              <n.icon className="size-5" />
            </span>
            <span className="text-[12px] font-semibold text-ink leading-tight">{n.label}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

function Page({ route }: { route: string }) {
  if (route.startsWith('/comptes/')) return <AccountDetail id={route.split('/')[2]} />
  switch (route) {
    case '/comptes':
      return <Accounts />
    case '/courant':
      return <Courant />
    case '/mouvements':
      return <Movements />
    case '/fixes':
      return <Recurrings />
    case '/placements':
      return <Investments />
    case '/patrimoine':
      return <Patrimoine />
    case '/agence':
      return <Business />
    case '/reglages':
      return <SettingsPage />
    default:
      return <Dashboard />
  }
}

export function Layout({ route, email }: { route: string; email: string }) {
  const settings = useSettings()
  const [quick, setQuick] = useState(false)
  const [menu, setMenu] = useState(false)
  const name = settings.displayName || email.split('@')[0]
  const current = NAV.find((n) => isActive(route, n.path)) ?? NAV[0]

  return (
    <div className="min-h-dvh lg:pl-[264px]">
      {/* Barre latérale (ordinateur) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[264px] flex-col border-r border-line bg-surface/70 backdrop-blur-xl z-30">
        <div className="flex items-center gap-3 px-6 h-20">
          <img src="/favicon.svg" alt="" className="size-10 rounded-xl shadow-lg shadow-indigo-500/30" />
          <div>
            <div className="font-bold text-lg tracking-tight text-ink leading-none">Trezo</div>
            <div className="text-[11.5px] text-muted mt-1">Compta & patrimoine</div>
          </div>
        </div>
        <div className="px-4">
          <button type="button" onClick={() => setQuick(true)} className="w-full h-11 rounded-xl brand-gradient text-white font-semibold text-sm inline-flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 hover:brightness-110 transition">
            <Plus className="size-4" strokeWidth={2.5} /> Nouveau mouvement
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-0.5">
          {NAV.map((n) => {
            const active = isActive(route, n.path)
            return (
              <a
                key={n.path}
                href={`#${n.path}`}
                className={cx('group flex items-center gap-3 rounded-xl px-3 h-11 text-[14px] font-medium transition-colors', active ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:text-ink hover:bg-surface-2')}
              >
                <span
                  className={cx('inline-flex size-8 rounded-lg items-center justify-center transition-colors', !active && 'group-hover:scale-105')}
                  style={{ background: active ? n.color : `${n.color}1a`, color: active ? '#fff' : n.color }}
                >
                  <n.icon className="size-[17px]" strokeWidth={2.1} />
                </span>
                {n.label}
              </a>
            )
          })}
        </nav>
        <div className="m-3 rounded-2xl border border-line bg-surface-2 p-3 flex items-center gap-3">
          <span className="size-9 rounded-full brand-gradient text-white font-bold flex items-center justify-center text-sm uppercase">{name.slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink truncate">{name}</div>
            <SyncBadge />
          </div>
        </div>
      </aside>

      {/* En-tête */}
      <header className="sticky top-0 z-20 bg-page/80 backdrop-blur-xl border-b border-line lg:border-transparent safe-top">
        <div className="flex items-center gap-2 h-14 lg:h-16 px-4 sm:px-6 lg:px-10 max-w-[1400px] mx-auto">
          <img src="/favicon.svg" alt="" className="size-8 rounded-lg lg:hidden" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-ink truncate lg:hidden">{current.label}</div>
            <div className="lg:hidden"><SyncBadge compact /></div>
          </div>
          <div className="hidden lg:block"><SyncBadge /></div>
          <PrivacyToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-10 pt-5 lg:pt-4 pb-32 lg:pb-16 max-w-[1400px] mx-auto">
        <Page key={route} route={route} />
      </main>

      {/* Navigation mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/90 backdrop-blur-xl border-t border-line safe-bottom">
        <div className="grid grid-cols-5 h-16 items-center px-2">
          <MobileTab icon={LayoutDashboard} label="Accueil" active={route === '/'} onClick={() => navigate('/')} />
          <MobileTab icon={Wallet} label="Courant" active={isActive(route, '/courant')} onClick={() => navigate('/courant')} />
          <div className="flex justify-center">
            <button type="button" aria-label="Ajouter" onClick={() => setQuick(true)} className="size-14 -mt-7 rounded-2xl brand-gradient text-white shadow-xl shadow-violet-500/40 flex items-center justify-center active:scale-95 transition">
              <Plus className="size-7" strokeWidth={2.4} />
            </button>
          </div>
          <MobileTab icon={ArrowLeftRight} label="Mouvements" active={isActive(route, '/mouvements')} onClick={() => navigate('/mouvements')} />
          <MobileTab icon={Menu} label="Menu" active={!['/', '/courant', '/mouvements'].includes(route)} onClick={() => setMenu(true)} />
        </div>
      </nav>

      {quick && <QuickActions onClose={() => setQuick(false)} />}
      {menu && <MobileMenu route={route} onClose={() => setMenu(false)} />}
    </div>
  )
}

function MobileTab({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cx('flex flex-col items-center gap-1 text-[10.5px] font-semibold transition-colors', active ? 'text-indigo-600 dark:text-indigo-300' : 'text-muted')}>
      <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.9} />
      {label}
    </button>
  )
}
