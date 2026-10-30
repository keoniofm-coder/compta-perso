import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowLeft, ArrowRightLeft, ArrowUpRight, LineChart, Pencil, Plus, Scale, Search } from 'lucide-react'
import { TrendArea } from '../components/charts'
import { AccountIcon, TxRow, useAccountColor } from '../components/common'
import { Badge, Button, Card, CardHeader, Delta, EmptyState, IconChip, Input, Money } from '../components/ui'
import { useDerived } from '../lib/calc'
import { formatNumber } from '../lib/currency'
import { addMonths, currentMonth, lastDayOf, monthLabel, monthOf, monthRange, monthShortYear, today } from '../lib/dates'
import { ACCOUNT_TYPES, ASSET_CLASSES } from '../lib/meta'
import { navigate, openModal } from '../lib/ui'

export function AccountDetail({ id }: { id: string }) {
  const d = useDerived()
  const st = d.accountById.get(id)
  const color = useAccountColor()(st?.account)
  const [q, setQ] = useState('')

  const history = useMemo(() => {
    if (!st) return []
    const end = currentMonth()
    const start = [monthOf(st.account.initialDate), addMonths(end, -11)].sort()[1]
    return monthRange(start, end).map((m) => ({ label: monthShortYear(m), value: d.accountValueAt(id, m === end ? today() : lastDayOf(m)) }))
  }, [d, id, st])

  if (!st) {
    return (
      <Card className="p-6">
        <EmptyState icon={Search} title="Compte introuvable" action={<Button onClick={() => navigate('/comptes')}>Retour aux comptes</Button>} />
      </Card>
    )
  }
  const a = st.account
  const meta = ACCOUNT_TYPES[a.type]

  // Mouvements du compte (transactions + opérations de placement)
  const txIds = new Set(st.events.filter((e) => e.txId).map((e) => e.txId!))
  const txs = d.transactions
    .filter((t) => txIds.has(t.id))
    .filter((t) => !q || `${t.label} ${t.counterparty ?? ''} ${t.note ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .reverse()
  const byMonth = new Map<string, typeof txs>()
  for (const t of txs) {
    const m = monthOf(t.date)
    byMonth.set(m, [...(byMonth.get(m) ?? []), t])
  }
  const opEvents = st.events.filter((e) => e.kind === 'op').reverse()
  const first = history[0]?.value ?? 0
  const change = first ? (st.total - first) / Math.abs(first) : 0

  return (
    <div>
      <button type="button" onClick={() => navigate('/comptes')} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink mb-4">
        <ArrowLeft className="size-4" /> Comptes
      </button>
      <div className="relative overflow-hidden card p-5 sm:p-7 mb-6 anim-fade-up">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ background: `radial-gradient(80% 120% at 100% 0%, ${color}, transparent 60%)` }} />
        <div className="relative flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <AccountIcon account={a} size="lg" />
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink truncate">{a.name}</h1>
                <div className="text-sm text-muted flex flex-wrap items-center gap-2">
                  {meta.label}
                  {a.institution && <>· {a.institution}</>}
                  {a.scope === 'pro' && <Badge tone="brand">Pro</Badge>}
                </div>
              </div>
            </div>
            <div className="mt-6">
              <Money value={st.total} currency={a.currency} className="text-4xl font-bold tracking-tight text-ink" />
              <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted">
                {a.currency !== d.base && (
                  <span>
                    ≈ <Money value={st.totalBase} currency={d.base} />
                  </span>
                )}
                {history.length > 1 && <Delta value={change} />}
                {history.length > 1 && <span>sur {history.length} mois</span>}
              </div>
              {st.holdings.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <span className="text-ink-2">Espèces : <Money value={st.cash} currency={a.currency} className="font-semibold text-ink" /></span>
                  <span className="text-ink-2">Positions : <Money value={st.holdingsValue} currency={a.currency} className="font-semibold text-ink" /></span>
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button size="sm" icon={ArrowDownLeft} onClick={() => openModal({ type: 'tx', kind: 'income', accountId: a.id })}>Entrée</Button>
              <Button size="sm" icon={ArrowUpRight} onClick={() => openModal({ type: 'tx', kind: 'expense', accountId: a.id })}>Sortie</Button>
              <Button size="sm" icon={ArrowRightLeft} onClick={() => openModal({ type: 'tx', kind: 'transfer', accountId: a.id })}>Virement</Button>
              <Button size="sm" icon={Scale} onClick={() => openModal({ type: 'checkpoint', accountId: a.id })}>{a.type === 'courant' ? 'Clôturer le mois' : 'Mettre à jour le solde'}</Button>
              {(a.type === 'invest' || a.type === 'crypto' || st.holdings.length > 0) && (
                <Button size="sm" icon={LineChart} onClick={() => openModal({ type: 'holding', accountId: a.id })}>Placement</Button>
              )}
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openModal({ type: 'account', id: a.id })}>Modifier</Button>
            </div>
          </div>
          <div className="lg:w-[46%] -mx-2">
            {history.length > 1 ? (
              <TrendArea data={history} dataKey="value" currency={a.currency} color={meta.series} height={220} label="Solde" />
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted">L'historique s'affichera au fil des mois</div>
            )}
          </div>
        </div>
        {a.note && <p className="relative mt-4 text-sm text-ink-2 bg-surface-2 rounded-xl px-3 py-2">{a.note}</p>}
      </div>

      {st.holdings.length > 0 && (
        <Card className="p-5 sm:p-6 mb-6">
          <CardHeader title="Positions" subtitle="Placements détenus sur ce compte" action={<Button size="sm" variant="soft" icon={Plus} onClick={() => openModal({ type: 'holding', accountId: a.id })}>Ajouter</Button>} />
          <div className="-mx-2 divide-y divide-line">
            {st.holdings.map((h) => {
              const cm = ASSET_CLASSES[h.holding.assetClass]
              return (
                <a key={h.holding.id} href="#/placements" className="flex items-center gap-3 px-2 py-3 hover:bg-surface-2 rounded-xl">
                  <IconChip icon={cm.icon} color={color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink truncate">{h.holding.name}</div>
                    <div className="text-xs text-muted">{h.holding.mode === 'units' ? `${formatNumber(h.quantity, 6)} ${h.holding.symbol ?? 'parts'}` : cm.label}</div>
                  </div>
                  <div className="text-right">
                    <Money value={h.value} currency={h.holding.currency} className="text-sm font-semibold text-ink" />
                    <div className="text-xs"><Money value={h.unrealized} currency={h.holding.currency} sign colored /></div>
                  </div>
                </a>
              )
            })}
          </div>
        </Card>
      )}

      <Card className="p-5 sm:p-6">
        <CardHeader
          title="Historique"
          subtitle={`${txs.length} mouvement${txs.length > 1 ? 's' : ''}${opEvents.length ? ` · ${opEvents.length} opération${opEvents.length > 1 ? 's' : ''} de placement` : ''}`}
          action={
            <div className="relative w-44 sm:w-56">
              <Search className="size-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <Input className="h-9 pl-9 text-sm" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          }
        />
        {txs.length === 0 ? (
          <EmptyState icon={ArrowRightLeft} title="Aucun mouvement" text="Les entrées, sorties et virements de ce compte apparaîtront ici." />
        ) : (
          <div className="space-y-5">
            {[...byMonth.entries()].map(([m, list]) => (
              <div key={m}>
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">{monthLabel(m)}</span>
                  <span className="text-xs text-muted">
                    Solde fin de mois : <Money value={d.balanceAt(a.id, lastDayOf(m))} currency={a.currency} className="font-semibold text-ink-2" />
                  </span>
                </div>
                <div className="-mx-3">
                  {list.map((t) => (
                    <TxRow key={t.id} t={t} contextAccountId={a.id} showDate />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
