import { useMemo } from 'react'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  CandlestickChart,
  CheckCircle2,
  PiggyBank,
  Plus,
  Split,
  Wallet,
  AlertCircle,
} from 'lucide-react'
import { Donut, GroupedBars, TrendArea, useSeriesColor } from '../components/charts'
import { AccountIcon, TxRow } from '../components/common'
import { Badge, Button, Card, CardHeader, Delta, EmptyState, Money, Progress, Stat, cx } from '../components/ui'
import { activeMonths, courantMonths, monthlyFlows, netWorthHistory, occurrences, useDerived } from '../lib/calc'
import { formatMoney, formatPct } from '../lib/currency'
import { addMonths, currentMonth, monthLabel, monthShortYear, today } from '../lib/dates'
import { ACCOUNT_TYPES } from '../lib/meta'
import { useSettings } from '../lib/store'
import { navigate, openModal, useUI } from '../lib/ui'

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Bonne nuit' : h < 18 ? 'Salut' : 'Bonsoir'
}

export function Dashboard() {
  const d = useDerived()
  const settings = useSettings()
  const privacy = useUI((s) => s.privacy)
  const col = useSeriesColor()
  const base = d.base
  const month = currentMonth()

  const history = useMemo(() => netWorthHistory(d, 12), [d])
  const flows = useMemo(() => monthlyFlows(d, activeMonths(d, 12)), [d])
  const thisFlow = flows[flows.length - 1]
  const occ = useMemo(() => occurrences(d, month), [d, month])
  const pendingOcc = occ.filter((o) => o.status !== 'done')
  const lateOcc = occ.filter((o) => o.status === 'late')

  const prev = history.length > 1 ? history[history.length - 2].netWorth : 0
  const nw = d.totals.netWorth
  const nwDelta = prev ? (nw - prev) / Math.abs(prev) : 0

  const courants = d.accounts.filter((s) => s.account.type === 'courant' && !s.account.archived)
  const prevMonth = addMonths(month, -1)
  const unclosed = courants.filter((s) => {
    const [cm] = courantMonths(d, s.account.id, [prevMonth])
    return !cm?.checkpoint && s.account.initialDate <= `${prevMonth}-28`
  })

  const pnl = d.totals.holdingsValue - d.totals.holdingsCost
  const pnlPct = d.totals.holdingsCost ? pnl / d.totals.holdingsCost : 0

  const slices = [
    { key: 'liquid', label: 'Comptes & liquidités', value: d.totals.liquid, color: col('blue') },
    { key: 'savings', label: 'Épargne', value: d.totals.savings, color: col('aqua') },
    { key: 'invested', label: 'Placements', value: d.totals.invested, color: col('violet') },
    { key: 'crypto', label: 'Crypto', value: d.totals.crypto, color: col('orange') },
    { key: 'pro', label: 'Trésorerie agence', value: d.totals.pro, color: col('magenta') },
    { key: 'assets', label: 'Biens', value: d.totals.assets, color: col('yellow') },
  ]

  const recent = d.transactions.slice(-6).reverse()
  const topAccounts = d.accounts.filter((s) => !s.account.archived).sort((a, b) => b.totalBase - a.totalBase).slice(0, 6)
  const name = settings.displayName ?? ''
  const savingRate = thisFlow.income > 0 ? thisFlow.net / thisFlow.income : 0

  if (!d.accounts.length) {
    return (
      <Card className="p-6">
        <EmptyState icon={Wallet} title="Aucun compte pour l'instant" text="Commence par ajouter tes comptes : courant, épargne, crypto, compte pro…" action={<Button variant="primary" icon={Plus} onClick={() => openModal({ type: 'account' })}>Ajouter un compte</Button>} />
      </Card>
    )
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 anim-fade-up">
        <div>
          <div className="text-sm text-muted capitalize">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-ink">
            {greeting()}
            {name ? ` ${name}` : ''} 👋
          </h1>
        </div>
        <div className="flex gap-2">
          <Button icon={Split} onClick={() => openModal({ type: 'split' })}>Répartir une rentrée</Button>
          <Button variant="primary" icon={Plus} className="hidden sm:inline-flex" onClick={() => openModal({ type: 'tx', kind: 'expense' })}>Mouvement</Button>
        </div>
      </div>

      {unclosed.length > 0 && (
        <div className="anim-fade-up rounded-2xl border border-sky-500/30 bg-sky-500/8 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <span className="size-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
              <Wallet className="size-5" />
            </span>
            <div className="text-sm">
              <div className="font-semibold text-ink">Clôture {monthLabel(prevMonth).toLowerCase()} sur ton compte courant</div>
              <div className="text-ink-2">Indique ce qu'il te reste : on calcule tes dépenses du quotidien et on reporte le solde.</div>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => openModal({ type: 'checkpoint', accountId: unclosed[0].account.id, month: prevMonth })}>
            Clôturer le mois
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5 lg:gap-6">
        {/* Patrimoine net */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-[1.5rem] hero-gradient text-white p-5 sm:p-7 shadow-xl shadow-indigo-900/20 anim-fade-up">
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-white/75">Patrimoine net</div>
              <div className={cx('text-4xl sm:text-5xl font-bold tracking-tight mt-1 tnum', privacy && 'blurred')}>{formatMoney(nw, base, { decimals: 0 })}</div>
              <div className="flex items-center gap-2 mt-2 text-sm">
                <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold', nwDelta >= 0 ? 'bg-emerald-400/25 text-emerald-50' : 'bg-rose-400/25 text-rose-50')}>
                  {nwDelta >= 0 ? '▲' : '▼'} {formatPct(Math.abs(nwDelta), false)}
                </span>
                <span className="text-white/70">vs fin {monthLabel(addMonths(month, -1)).toLowerCase()}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-right w-full sm:w-auto">
              {[
                { l: 'Comptes', v: d.totals.accounts },
                { l: 'Biens', v: d.totals.assets },
                { l: 'Dettes', v: -d.totals.liabilities },
              ].map((x) => (
                <div key={x.l} className="rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-left sm:text-right">
                  <div className="text-[11px] text-white/70">{x.l}</div>
                  <div className={cx('text-sm font-semibold tnum', privacy && 'blurred')}>{formatMoney(x.v, base, { compact: true, decimals: 0 })}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative mt-4 -mx-2">
            <TrendArea data={history.map((h) => ({ label: monthShortYear(h.month), value: h.netWorth }))} dataKey="value" currency={base} white height={190} label="Patrimoine net" />
          </div>
        </div>

        {/* Ce mois-ci */}
        <Card className="p-5 sm:p-6 anim-fade-up">
          <CardHeader title={`${monthLabel(month)}`} subtitle="Hors virements entre tes comptes" />
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="size-9 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"><ArrowDownLeft className="size-4.5" /></span>
              <span className="flex-1 text-sm text-ink-2">Entrées</span>
              <Money value={thisFlow.income} currency={base} className="font-semibold text-ink" />
            </div>
            <div className="flex items-center gap-3">
              <span className="size-9 rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400 flex items-center justify-center"><ArrowUpRight className="size-4.5" /></span>
              <span className="flex-1 text-sm text-ink-2">Sorties</span>
              <Money value={thisFlow.expense} currency={base} className="font-semibold text-ink" />
            </div>
            <div className="h-px bg-line" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Solde du mois</span>
              <Money value={thisFlow.net} currency={base} sign colored className="text-lg font-bold" />
            </div>
            {thisFlow.income > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted mb-1.5">
                  <span>Taux d'épargne</span>
                  <span className="font-semibold text-ink-2">{formatPct(savingRate, false)}</span>
                </div>
                <Progress value={savingRate} color={savingRate >= 0.2 ? '#10b981' : savingRate >= 0 ? '#f59e0b' : '#f43f5e'} />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/fixes')}
            className="mt-5 w-full rounded-2xl border border-line bg-surface-2 p-3.5 flex items-center gap-3 text-left hover:border-line-strong transition"
          >
            <span className={cx('size-10 rounded-xl flex items-center justify-center shrink-0', pendingOcc.length ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/12 text-emerald-600')}>
              {pendingOcc.length ? <CalendarClock className="size-5" /> : <CheckCircle2 className="size-5" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-ink">{pendingOcc.length ? `${pendingOcc.length} échéance${pendingOcc.length > 1 ? 's' : ''} à valider` : 'Fixes du mois à jour'}</div>
              <div className="text-xs text-muted">{lateOcc.length ? `${lateOcc.length} en retard` : `${occ.length - pendingOcc.length}/${occ.length} validées`}</div>
            </div>
            <ArrowRight className="size-4 text-muted" />
          </button>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 anim-fade-up">
        <Stat label="Disponible" value={d.totals.liquid} currency={base} icon={Wallet} color="#2a78d6" sub="Comptes courants & bancaires" />
        <Stat label="Épargne" value={d.totals.savings} currency={base} icon={PiggyBank} color="#1baf7a" sub="Livrets & comptes d'épargne" />
        <Stat
          label="Placements & crypto"
          value={d.totals.invested + d.totals.crypto}
          currency={base}
          icon={CandlestickChart}
          color="#6250d6"
          sub={
            d.totals.holdingsCost > 0 ? (
              <>
                <Delta value={pnlPct} /> <Money value={pnl} currency={base} sign colored compact />
              </>
            ) : (
              'Positions & espèces investies'
            )
          }
        />
        <Stat label="Trésorerie agence" value={d.totals.pro} currency={base} icon={BriefcaseBusiness} color="#e87ba4" sub="Comptes pro" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 lg:gap-6">
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <CardHeader title="Entrées & sorties" subtitle="12 derniers mois, perso + pro, dépenses courantes incluses" action={<Button size="sm" variant="ghost" onClick={() => navigate('/mouvements')}>Détail <ArrowRight className="size-3.5" /></Button>} />
          <GroupedBars
            data={flows.map((f) => ({ label: monthLabel(f.month, 'short'), income: f.income, expense: f.expense, net: f.net }))}
            series={[
              { key: 'income', label: 'Entrées', color: 'aqua' },
              { key: 'expense', label: 'Sorties', color: 'red' },
            ]}
            currency={base}
            footer={(row) => (
              <span>
                Solde : <b className={Number(row.net) >= 0 ? 'text-pos' : 'text-neg'}>{formatMoney(Number(row.net), base, { sign: true })}</b>
              </span>
            )}
          />
        </Card>
        <Card className="p-5 sm:p-6">
          <CardHeader title="Répartition" subtitle="Où est ton argent" action={<Button size="sm" variant="ghost" onClick={() => navigate('/patrimoine')}>Voir <ArrowRight className="size-3.5" /></Button>} />
          <Donut slices={slices} currency={base} centerLabel="Actifs bruts" centerValue={d.totals.grossAssets} size={170} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 lg:gap-6">
        <Card className="p-5 sm:p-6">
          <CardHeader title="Mes comptes" action={<Button size="sm" variant="ghost" onClick={() => navigate('/comptes')}>Tous <ArrowRight className="size-3.5" /></Button>} />
          <div className="space-y-1 -mx-2">
            {topAccounts.map((s) => (
              <a key={s.account.id} href={`#/comptes/${s.account.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2 transition-colors">
                <AccountIcon account={s.account} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink truncate">{s.account.name}</div>
                  <div className="text-xs text-muted">{ACCOUNT_TYPES[s.account.type].label}{s.account.institution ? ` · ${s.account.institution}` : ''}</div>
                </div>
                <div className="text-right">
                  <Money value={s.total} currency={s.account.currency} className="text-sm font-semibold text-ink" />
                  {s.account.currency !== base && (
                    <div className="text-xs text-muted">
                      <Money value={s.totalBase} currency={base} />
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <CardHeader title="Derniers mouvements" action={<Button size="sm" variant="ghost" onClick={() => navigate('/mouvements')}>Tout voir <ArrowRight className="size-3.5" /></Button>} />
          {recent.length ? (
            <div className="-mx-3">
              {recent.map((t) => (
                <TxRow key={t.id} t={t} showDate />
              ))}
            </div>
          ) : (
            <EmptyState icon={AlertCircle} title="Aucun mouvement" text="Ajoute ta première entrée ou sortie." />
          )}
        </Card>
      </div>
      {lateOcc.length > 0 && (
        <div className="text-center">
          <Badge tone="warn">Pense à valider tes échéances en retard du {today().slice(8)} {monthLabel(month).toLowerCase()}</Badge>
        </div>
      )}
    </div>
  )
}
