import { useMemo, useState } from 'react'
import { Gem, Landmark, Plus, Receipt, TrendingDown } from 'lucide-react'
import { Donut, TrendArea, useSeriesColor } from '../components/charts'
import { Badge, Button, Card, CardHeader, EmptyState, IconChip, Money, PageHeader, Progress, Segmented, cx } from '../components/ui'
import { netWorthHistory, useDerived } from '../lib/calc'
import { formatMoney, formatPct } from '../lib/currency'
import { dateLabel, monthShortYear, yearsBetween, today } from '../lib/dates'
import { ASSET_CATEGORIES, LIABILITY_CATEGORIES } from '../lib/meta'
import { openModal, useUI } from '../lib/ui'

export function Patrimoine() {
  const d = useDerived()
  const col = useSeriesColor()
  const privacy = useUI((s) => s.privacy)
  const [range, setRange] = useState<'12' | '24'>('12')
  const history = useMemo(() => netWorthHistory(d, Number(range)), [d, range])
  const first = history[0]?.netWorth ?? 0
  const change = d.totals.netWorth - first

  const assets = Object.values(d.db.assets).sort((a, b) => d.convert(d.assetValue(b), b.currency) - d.convert(d.assetValue(a), a.currency))
  const liabilities = Object.values(d.db.liabilities)

  const slices = [
    { key: 'liquid', label: 'Comptes & liquidités', value: d.totals.liquid, color: col('blue') },
    { key: 'savings', label: 'Épargne', value: d.totals.savings, color: col('aqua') },
    { key: 'invested', label: 'Placements', value: d.totals.invested, color: col('violet') },
    { key: 'crypto', label: 'Crypto', value: d.totals.crypto, color: col('orange') },
    { key: 'pro', label: 'Trésorerie agence', value: d.totals.pro, color: col('magenta') },
    { key: 'assets', label: 'Biens', value: d.totals.assets, color: col('yellow') },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Patrimoine"
        title="Ce que tu possèdes"
        subtitle="Comptes + placements + biens − dettes"
        actions={
          <>
            <Button icon={Receipt} onClick={() => openModal({ type: 'liability' })}>Dette</Button>
            <Button variant="primary" icon={Plus} onClick={() => openModal({ type: 'asset' })}>Bien</Button>
          </>
        }
      />

      <div className="relative overflow-hidden rounded-[1.5rem] hero-gradient text-white p-5 sm:p-7 mb-6 shadow-xl shadow-indigo-900/20 anim-fade-up">
        <div className="relative grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-6 items-center">
          <div>
            <div className="text-sm text-white/75 font-medium">Patrimoine net</div>
            <div className={cx('text-4xl sm:text-5xl font-bold tracking-tight mt-1 tnum', privacy && 'blurred')}>{formatMoney(d.totals.netWorth, d.base, { decimals: 0 })}</div>
            <div className="mt-2 text-sm text-white/80">
              <span className={cx('font-semibold', privacy && 'blurred')}>{formatMoney(change, d.base, { sign: true, decimals: 0 })}</span> sur {range} mois
              {first ? <span> ({formatPct(change / Math.abs(first))})</span> : null}
            </div>
            <div className="mt-6 space-y-2.5 text-sm">
              {[
                { l: 'Actifs bruts', v: d.totals.grossAssets },
                { l: 'dont biens', v: d.totals.assets },
                { l: 'Dettes', v: -d.totals.liabilities },
              ].map((x) => (
                <div key={x.l} className="flex justify-between border-b border-white/15 pb-2">
                  <span className="text-white/75">{x.l}</span>
                  <span className={cx('font-semibold tnum', privacy && 'blurred')}>{formatMoney(x.v, d.base, { decimals: 0 })}</span>
                </div>
              ))}
            </div>
            <Segmented
              size="sm"
              className="mt-5 !bg-white/15 [&_button]:!text-white/80 [&_[aria-selected=true]]:!bg-white [&_[aria-selected=true]]:!text-indigo-700"
              value={range}
              onChange={setRange}
              options={[
                { value: '12', label: '12 mois' },
                { value: '24', label: '24 mois' },
              ]}
            />
          </div>
          <div className="-mx-2">
            <TrendArea data={history.map((h) => ({ label: monthShortYear(h.month), value: h.netWorth }))} dataKey="value" currency={d.base} white height={260} label="Patrimoine net" />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-5 lg:gap-6 mb-6">
        <Card className="p-5 sm:p-6 lg:col-span-3">
          <CardHeader title="Composition" subtitle="Actifs bruts par catégorie" />
          <Donut slices={slices} currency={d.base} centerLabel="Actifs bruts" centerValue={d.totals.grossAssets} size={190} />
        </Card>
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <CardHeader title="Dettes & crédits" icon={Landmark} action={<Button size="sm" variant="soft" icon={Plus} onClick={() => openModal({ type: 'liability' })}>Ajouter</Button>} />
          {liabilities.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">Aucune dette enregistrée 🎉</p>
          ) : (
            <div className="space-y-4">
              {liabilities.map((l) => {
                const m = LIABILITY_CATEGORIES[l.category]
                const repaid = l.initialAmount ? 1 - l.remaining / l.initialAmount : 0
                const monthsLeft = l.monthlyPayment ? Math.ceil(l.remaining / l.monthlyPayment) : undefined
                return (
                  <button key={l.id} type="button" onClick={() => openModal({ type: 'liability', id: l.id })} className="w-full text-left rounded-xl hover:bg-surface-2 p-2 -m-2">
                    <div className="flex items-center gap-3">
                      <IconChip icon={m.icon} color="#e34948" size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-ink truncate">{l.name}</div>
                        <div className="text-xs text-muted">
                          {l.monthlyPayment ? `${formatMoney(l.monthlyPayment, l.currency)}/mois` : m.label}
                          {monthsLeft ? ` · encore ~${monthsLeft} mois` : ''}
                          {l.rate ? ` · ${l.rate} %` : ''}
                        </div>
                      </div>
                      <Money value={-l.remaining} currency={l.currency} className="text-sm font-semibold text-neg" />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={repaid} color="#10b981" className="flex-1" />
                      <span className="text-[11px] text-muted w-20 text-right">{formatPct(repaid, false)} remboursé</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-ink flex items-center gap-2"><Gem className="size-4.5 text-pink-500" /> Biens</h2>
        <Money value={d.totals.assets} currency={d.base} className="text-sm font-semibold text-ink-2" />
      </div>
      {assets.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Gem} title="Aucun bien" text="Ajoute ton immobilier, ta voiture, ton matériel informatique ou tes objets de valeur. Astuce : en saisissant un gros achat dans les sorties, coche « Ajouter à mon patrimoine »." action={<Button variant="primary" icon={Plus} onClick={() => openModal({ type: 'asset' })}>Ajouter un bien</Button>} />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {assets.map((a) => {
            const m = ASSET_CATEGORIES[a.category]
            const v = d.assetValue(a)
            const lost = a.purchaseValue ? v / a.purchaseValue - 1 : 0
            const age = yearsBetween(a.purchaseDate, today())
            return (
              <Card key={a.id} className={cx('p-5', a.sold && 'opacity-60')} onClick={() => openModal({ type: 'asset', id: a.id })}>
                <div className="flex items-start gap-3">
                  <IconChip icon={m.icon} color={col('yellow')} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink truncate">{a.name}</div>
                    <div className="text-xs text-muted">{m.label} · acheté {dateLabel(a.purchaseDate, { month: 'short', year: 'numeric' })}</div>
                  </div>
                  {a.scope === 'pro' && <Badge tone="brand">Pro</Badge>}
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <Money value={v} currency={a.currency} className="text-xl font-bold text-ink" />
                    <div className="text-xs text-muted">sur <Money value={a.purchaseValue} currency={a.currency} /> à l'achat</div>
                  </div>
                  {lost !== 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2">
                      <TrendingDown className="size-3.5" /> {formatPct(lost)}
                    </span>
                  )}
                </div>
                {a.depreciationYears ? (
                  <div className="mt-3">
                    <Progress value={Math.min(1, age / a.depreciationYears)} color={col('yellow')} />
                    <div className="text-[11px] text-muted mt-1">Amorti sur {a.depreciationYears} ans · {formatPct(Math.min(1, age / a.depreciationYears), false)} écoulé</div>
                  </div>
                ) : null}
                {a.sold && <Badge className="mt-3">Vendu</Badge>}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
