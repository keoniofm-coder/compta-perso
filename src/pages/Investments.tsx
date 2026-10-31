import { useMemo, useState } from 'react'
import { ChevronDown, Coins, LineChart, Pencil, PiggyBank, Plus, RefreshCw, TrendingUp, Zap } from 'lucide-react'
import { Donut, useSeriesColor } from '../components/charts'
import { Badge, Button, Card, CardHeader, Delta, EmptyState, IconChip, Money, PageHeader, Progress, Stat, cx } from '../components/ui'
import { useDerived, type HoldingStat } from '../lib/calc'
import { formatMoney, formatNumber, formatPct, useRates } from '../lib/currency'
import { dateLabel } from '../lib/dates'
import { ASSET_CLASS_ORDER, ASSET_CLASSES } from '../lib/meta'
import { openModal } from '../lib/ui'

const OP_LABEL = { buy: 'Achat', sell: 'Vente', income: 'Revenu', price: 'Cours' } as const
const OP_LABEL_AMOUNT = { buy: 'Versement', sell: 'Retrait', income: 'Revenu', price: 'Valorisation' } as const

function HoldingRow({ h }: { h: HoldingStat }) {
  const col = useSeriesColor()
  const [open, setOpen] = useState(false)
  const cm = ASSET_CLASSES[h.holding.assetClass]
  const cur = h.holding.currency
  const isAmount = h.holding.mode === 'amount'
  const rates = useRates((s) => s.rates)
  const qs = h.holding.quoteSymbol
  const dayChange = h.priceSource === 'live' && qs && rates[`yfp:${qs}`] ? rates[`yf:${qs}`] / rates[`yfp:${qs}`] - 1 : undefined
  return (
    <div className="border-t border-line first:border-t-0">
      <button type="button" onClick={() => setOpen(!open)} className="w-full grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,2.2fr)_1fr_1fr_1.1fr_1.2fr_28px] items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2/70 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <IconChip icon={cm.icon} color={col(cm.series)} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-ink truncate">{h.holding.name}</span>
              {h.holding.symbol && <span className="text-[11px] font-semibold text-muted">{h.holding.symbol}</span>}
            </div>
            <div className="text-xs text-muted truncate">{h.account?.name ?? '—'} · {cm.label}</div>
          </div>
        </div>
        <div className="hidden md:block text-right text-sm">
          {isAmount ? <span className="text-muted">—</span> : <span className="tnum text-ink-2">{formatNumber(h.quantity, 6)}</span>}
          {!isAmount && <div className="text-[11.5px] text-muted">PRU <Money value={h.avgCost} currency={cur} /></div>}
        </div>
        <div className="hidden md:block text-right text-sm">
          {isAmount ? (
            <span className="text-xs text-muted">{h.priceDate ? `au ${dateLabel(h.priceDate, { day: 'numeric', month: 'short' })}` : ''}</span>
          ) : (
            <>
              <Money value={h.price} currency={cur} className="text-ink-2" />
              <div className="text-[11.5px]">{h.priceSource === 'live' ? <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium"><Zap className="size-3" />direct{dayChange !== undefined && <span className={dayChange >= 0 ? 'text-pos' : 'text-neg'}>{` · ${formatPct(dayChange)}`}</span>}</span> : <span className="text-muted">{h.priceDate ? dateLabel(h.priceDate, { day: 'numeric', month: 'short' }) : ''}</span>}</div>
            </>
          )}
        </div>
        <div className="hidden md:block text-right">
          <Money value={h.costBasis} currency={cur} className="text-sm text-ink-2" />
        </div>
        <div className="text-right">
          <Money value={h.value} currency={cur} className="text-sm font-bold text-ink" />
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            <Money value={h.unrealized} currency={cur} sign colored className="text-xs font-medium" />
            <Delta value={h.unrealizedPct} />
          </div>
        </div>
        <ChevronDown className={cx('hidden md:block size-4 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-4 anim-fade-in">
          <div className="rounded-2xl bg-surface-2 border border-line p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
              <div><div className="text-xs text-muted">Investi (coût)</div><Money value={h.costBasis} currency={cur} className="font-semibold text-ink" /></div>
              <div><div className="text-xs text-muted">Plus-value latente</div><Money value={h.unrealized} currency={cur} sign colored className="font-semibold" /></div>
              <div><div className="text-xs text-muted">Plus-value réalisée</div><Money value={h.realized} currency={cur} sign colored className="font-semibold" /></div>
              <div><div className="text-xs text-muted">Revenus perçus</div><Money value={h.income} currency={cur} className="font-semibold text-ink" /></div>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <Button size="sm" variant="primary" icon={Plus} onClick={() => openModal({ type: 'op', holdingId: h.holding.id, kind: 'buy' })}>{isAmount ? 'Versement' : 'Achat'}</Button>
              <Button size="sm" onClick={() => openModal({ type: 'op', holdingId: h.holding.id, kind: 'sell' })}>{isAmount ? 'Retrait' : 'Vente'}</Button>
              <Button size="sm" onClick={() => openModal({ type: 'op', holdingId: h.holding.id, kind: 'income' })}>Revenu</Button>
              <Button size="sm" onClick={() => openModal({ type: 'op', holdingId: h.holding.id, kind: 'price' })}>{isAmount ? 'Mettre à jour la valeur' : 'Mettre à jour le cours'}</Button>
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openModal({ type: 'holding', id: h.holding.id })}>Modifier</Button>
            </div>
            {h.ops.length > 0 && (
              <div className="divide-y divide-line">
                {[...h.ops].reverse().map((o) => (
                  <button key={o.id} type="button" onClick={() => openModal({ type: 'op', holdingId: h.holding.id, id: o.id })} className="w-full flex items-center gap-3 py-2 text-left text-sm hover:opacity-80">
                    <span className="w-20 text-xs text-muted">{dateLabel(o.date, { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                    <Badge tone={o.kind === 'buy' ? 'brand' : o.kind === 'sell' ? 'warn' : o.kind === 'income' ? 'pos' : 'neutral'}>{(isAmount ? OP_LABEL_AMOUNT : OP_LABEL)[o.kind]}</Badge>
                    <span className="flex-1 text-ink-2 truncate">
                      {isAmount || o.kind === 'income' ? formatMoney(o.amount ?? 0, cur) : o.kind === 'price' ? formatMoney(o.price, cur) : `${formatNumber(o.quantity, 8)} × ${formatMoney(o.price, cur)}`}
                      {o.fees ? <span className="text-muted"> · frais {formatMoney(o.fees, cur)}</span> : null}
                    </span>
                    {o.cashAmount != null && <Money value={o.cashAmount} currency={h.account?.currency ?? cur} sign colored className="text-xs" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function Investments() {
  const d = useDerived()
  const col = useSeriesColor()
  const refresh = useRates((s) => s.refresh)
  const loading = useRates((s) => s.loading)
  const fetchedAt = useRates((s) => s.fetchedAt)
  const [showArchived, setShowArchived] = useState(false)
  const holdings = d.holdings.filter((h) => showArchived || !h.holding.archived)
  const active = d.holdings.filter((h) => !h.holding.archived)

  const value = active.reduce((s, h) => s + h.valueBase, 0)
  const cost = active.reduce((s, h) => s + h.costBase, 0)
  const pnl = value - cost
  const income = d.holdings.reduce((s, h) => s + d.convert(h.income + h.realized, h.holding.currency), 0)

  const byClass = useMemo(
    () =>
      ASSET_CLASS_ORDER.map((c) => ({
        key: c,
        label: ASSET_CLASSES[c].label,
        value: active.filter((h) => h.holding.assetClass === c).reduce((s, h) => s + h.valueBase, 0),
        color: col(ASSET_CLASSES[c].series),
      })),
    [active, col],
  )
  const byAccount = useMemo(() => {
    const m = new Map<string, number>()
    for (const h of active) m.set(h.holding.accountId, (m.get(h.holding.accountId) ?? 0) + h.valueBase)
    return [...m.entries()].map(([id, v]) => ({ id, name: d.db.accounts[id]?.name ?? '?', v })).sort((a, b) => b.v - a.v)
  }, [active, d])

  // Espèces disponibles sur les comptes d'investissement
  const investCash = d.accounts.filter((s) => (s.account.type === 'invest' || s.account.type === 'crypto') && !s.account.archived).reduce((sum, s) => sum + d.convert(s.cash, s.account.currency), 0)

  return (
    <div>
      <PageHeader
        eyebrow="Placements"
        title={<Money value={value} currency={d.base} />}
        subtitle={fetchedAt ? `Cours mis à jour ${new Date(fetchedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Valeur de tes positions'}
        actions={
          <>
            <Button icon={RefreshCw} onClick={() => void refresh(true)} disabled={loading} className={loading ? '[&_svg]:animate-spin' : ''}>Actualiser les cours</Button>
            <Button variant="primary" icon={Plus} onClick={() => openModal({ type: 'holding' })}>Placement</Button>
          </>
        }
      />
      {d.holdings.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={LineChart}
            title="Aucun placement suivi"
            text="Ajoute tes actions, ETF, cryptos, assurances-vie, SCPI… On calcule ton prix de revient, tes plus-values, et les cryptos sont mises à jour en direct."
            action={<Button variant="primary" icon={Plus} onClick={() => openModal({ type: 'holding' })}>Ajouter un placement</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <Stat label="Valeur actuelle" value={value} currency={d.base} icon={TrendingUp} color="#6250d6" sub={investCash > 0.5 ? <>+ <Money value={investCash} currency={d.base} /> d'espèces</> : undefined} />
            <Stat label="Montant investi" value={cost} currency={d.base} icon={PiggyBank} color="#2a78d6" sub="Prix de revient des positions" />
            <Stat label="Plus-value latente" value={pnl} currency={d.base} icon={LineChart} color={pnl >= 0 ? '#10b981' : '#f43f5e'} colored sub={<Delta value={cost ? pnl / cost : 0} />} />
            <Stat label="Gains encaissés" value={income} currency={d.base} icon={Coins} color="#eda100" sub="Dividendes, intérêts, ventes" />
          </div>

          <div className="grid lg:grid-cols-3 gap-5 lg:gap-6 mb-6">
            <Card className="p-5 sm:p-6 lg:col-span-2">
              <CardHeader title="Allocation par type" />
              <Donut slices={byClass} currency={d.base} centerLabel="Total" size={180} />
            </Card>
            <Card className="p-5 sm:p-6">
              <CardHeader title="Par plateforme" />
              <div className="space-y-3.5">
                {byAccount.map((a) => (
                  <div key={a.id}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <a href={`#/comptes/${a.id}`} className="text-ink-2 hover:text-ink truncate">{a.name}</a>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted">{value ? formatPct(a.v / value, false) : ''}</span>
                        <Money value={a.v} currency={d.base} compact className="font-semibold text-ink" />
                      </span>
                    </div>
                    <Progress value={value ? a.v / value : 0} color={col('violet')} />
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-5 sm:px-6 pb-3">
              <h3 className="font-semibold text-[15px] text-ink">Positions</h3>
              {d.holdings.some((h) => h.holding.archived) && (
                <Button size="sm" variant="ghost" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Masquer soldées' : 'Voir soldées'}</Button>
              )}
            </div>
            <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_1fr_1fr_1.1fr_1.2fr_28px] gap-3 px-4 pb-2 text-[11.5px] uppercase tracking-wider font-semibold text-muted">
              <span>Placement</span>
              <span className="text-right">Quantité</span>
              <span className="text-right">Cours</span>
              <span className="text-right">Investi</span>
              <span className="text-right">Valeur / +-value</span>
              <span />
            </div>
            <div>
              {holdings
                .slice()
                .sort((a, b) => b.valueBase - a.valueBase)
                .map((h) => (
                  <HoldingRow key={h.holding.id} h={h} />
                ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
