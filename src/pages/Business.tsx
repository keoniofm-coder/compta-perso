import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, BriefcaseBusiness, CheckCircle2, Clock, Percent, Plus, Receipt, Users } from 'lucide-react'
import { Donut, GroupedBars, useSeriesColor } from '../components/charts'
import { AccountIcon } from '../components/common'
import { Badge, Button, Card, CardHeader, EmptyState, Money, PageHeader, Progress, Segmented, Stat } from '../components/ui'
import { activeMonths, lastMonths, monthlyFlows, useDerived } from '../lib/calc'
import { formatPct } from '../lib/currency'
import { currentMonth, monthLabel, monthOf } from '../lib/dates'
import { categoryMeta } from '../lib/meta'
import { openModal } from '../lib/ui'

type Period = 'month' | 'year' | '12m'

export function Business() {
  const d = useDerived()
  const col = useSeriesColor()
  const [period, setPeriod] = useState<Period>('12m')
  const month = currentMonth()
  const months = useMemo(() => {
    if (period === 'month') return [month]
    if (period === 'year') return lastMonths(Number(month.slice(5, 7)))
    return lastMonths(12)
  }, [period, month])
  const monthSet = new Set(months)

  const flows = useMemo(() => monthlyFlows(d, activeMonths(d, 12), 'pro'), [d])
  const proTx = d.transactions.filter((t) => t.scope === 'pro' && monthSet.has(monthOf(t.date)))
  const conv = (t: (typeof proTx)[number]) => d.convert(t.amount, d.db.accounts[t.accountId]?.currency ?? d.base)
  const ca = proTx.filter((t) => t.kind === 'income').reduce((s, t) => s + conv(t), 0)
  const salaries = proTx.filter((t) => t.kind === 'expense' && t.category === 'salaires_employes').reduce((s, t) => s + conv(t), 0)
  const charges = proTx.filter((t) => t.kind === 'expense' && t.category !== 'salaires_employes').reduce((s, t) => s + conv(t), 0)
  const result = ca - salaries - charges
  const margin = ca ? result / ca : 0

  const clients = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of proTx) if (t.kind === 'income') m.set(t.counterparty || 'Sans client', (m.get(t.counterparty || 'Sans client') ?? 0) + conv(t))
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proTx.length, d])
  const topClient = clients[0]?.[1] ?? 0

  const expByCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of proTx) if (t.kind === 'expense') m.set(t.category ?? 'autre_sortie_pro', (m.get(t.category ?? 'autre_sortie_pro') ?? 0) + conv(t))
    return [...m.entries()].map(([k, v]) => ({ key: k, label: categoryMeta(k).label, value: v, color: categoryMeta(k).color }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proTx.length, d])

  const employees = Object.values(d.db.employees).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  const proAccounts = d.accounts.filter((s) => s.account.scope === 'pro' && !s.account.archived)
  const proCash = proAccounts.reduce((s, a) => s + a.totalBase, 0)
  const periodLabel = period === 'month' ? monthLabel(month) : period === 'year' ? `Depuis janvier ${month.slice(0, 4)}` : '12 derniers mois'

  return (
    <div>
      <PageHeader
        eyebrow="Agence"
        title="Compta de l'agence"
        subtitle={`Chiffre d'affaires, charges, salaires et résultat · ${periodLabel}`}
        actions={
          <>
            <Segmented
              size="sm"
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'month', label: 'Ce mois' },
                { value: 'year', label: 'Cette année' },
                { value: '12m', label: '12 mois' },
              ]}
            />
            <Button icon={ArrowDownLeft} onClick={() => openModal({ type: 'tx', kind: 'income', scope: 'pro', accountId: proAccounts[0]?.account.id })}>Facture encaissée</Button>
            <Button variant="primary" icon={ArrowUpRight} onClick={() => openModal({ type: 'tx', kind: 'expense', scope: 'pro', accountId: proAccounts[0]?.account.id })}>Dépense pro</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Stat label="Chiffre d'affaires" value={ca} currency={d.base} icon={ArrowDownLeft} color="#1baf7a" sub={`${proTx.filter((t) => t.kind === 'income').length} encaissement(s)`} />
        <Stat label="Masse salariale" value={salaries} currency={d.base} icon={Users} color="#e87ba4" sub={ca ? `${formatPct(salaries / ca, false)} du CA` : undefined} />
        <Stat label="Autres charges" value={charges} currency={d.base} icon={Receipt} color="#e34948" sub={ca ? `${formatPct(charges / ca, false)} du CA` : undefined} />
        <Stat label="Résultat" value={result} currency={d.base} icon={Percent} color="#6250d6" colored sub={ca ? <Badge tone={margin >= 0 ? 'pos' : 'neg'}>Marge {formatPct(margin, false)}</Badge> : undefined} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 lg:gap-6 mb-6">
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <CardHeader title="Activité mensuelle" subtitle="12 derniers mois" />
          <GroupedBars
            data={flows.map((f) => {
              const sal = f.byCategory.salaires_employes ?? 0
              return { label: monthLabel(f.month, 'short'), ca: f.income, salaires: sal, charges: f.expense - sal, net: f.net }
            })}
            series={[
              { key: 'ca', label: "Chiffre d'affaires", color: 'aqua' },
              { key: 'salaires', label: 'Salaires', color: 'magenta' },
              { key: 'charges', label: 'Autres charges', color: 'red' },
            ]}
            currency={d.base}
            footer={(row) => (
              <span>
                Résultat : <b className={Number(row.net) >= 0 ? 'text-pos' : 'text-neg'}><Money value={Number(row.net)} currency={d.base} sign /></b>
              </span>
            )}
          />
        </Card>
        <Card className="p-5 sm:p-6">
          <CardHeader title="Top clients" subtitle={periodLabel} />
          {clients.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">Aucun encaissement sur la période</p>
          ) : (
            <div className="space-y-3.5">
              {clients.map(([name, v]) => (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-ink-2 truncate">{name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted">{ca ? formatPct(v / ca, false) : ''}</span>
                      <Money value={v} currency={d.base} compact className="font-semibold text-ink" />
                    </span>
                  </div>
                  <Progress value={topClient ? v / topClient : 0} color={col('aqua')} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 lg:gap-6">
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <CardHeader title="Équipe" icon={Users} subtitle="Salaires et statut de paie du mois" action={<Button size="sm" variant="soft" icon={Plus} onClick={() => openModal({ type: 'employee' })}>Ajouter</Button>} />
          {employees.length === 0 ? (
            <EmptyState icon={Users} title="Pas encore d'équipe" text="Ajoute tes employés ou freelances réguliers : leur salaire devient une échéance à valider chaque mois." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {employees.map((e) => {
                const paidThisMonth = d.transactions.filter((t) => t.employeeId === e.id && t.kind === 'expense' && monthOf(t.date) === month)
                const paidYear = d.transactions.filter((t) => t.employeeId === e.id && t.kind === 'expense' && t.date.startsWith(month.slice(0, 4))).reduce((s, t) => s + t.amount, 0)
                return (
                  <button key={e.id} type="button" onClick={() => openModal({ type: 'employee', id: e.id })} className="text-left rounded-2xl border border-line bg-surface-2 p-4 hover:border-line-strong transition">
                    <div className="flex items-center gap-3">
                      <span className="size-10 rounded-full brand-gradient text-white font-bold flex items-center justify-center">{e.name.slice(0, 1)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-ink truncate">{e.name}</div>
                        <div className="text-xs text-muted truncate">{e.role ?? '—'}</div>
                      </div>
                      {!e.active ? <Badge>Parti·e</Badge> : paidThisMonth.length ? <Badge tone="pos"><CheckCircle2 className="size-3" /> Payé</Badge> : <Badge tone="warn"><Clock className="size-3" /> À payer</Badge>}
                    </div>
                    <div className="mt-3 flex justify-between text-[13px]">
                      <span className="text-muted">Mensuel <Money value={e.salary} currency={e.currency} className="font-semibold text-ink" /></span>
                      <span className="text-muted">{month.slice(0, 4)} : <Money value={paidYear} currency={e.currency} className="font-semibold text-ink" /></span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </Card>
        <div className="space-y-5 lg:space-y-6">
          <Card className="p-5 sm:p-6">
            <CardHeader title="Trésorerie" icon={BriefcaseBusiness} subtitle="Comptes pro" />
            <Money value={proCash} currency={d.base} className="text-2xl font-bold text-ink" />
            <div className="mt-3 space-y-2">
              {proAccounts.map((s) => (
                <a key={s.account.id} href={`#/comptes/${s.account.id}`} className="flex items-center gap-3 rounded-xl p-1.5 -mx-1.5 hover:bg-surface-2">
                  <AccountIcon account={s.account} size="sm" />
                  <span className="flex-1 text-sm text-ink-2 truncate">{s.account.name}</span>
                  <Money value={s.total} currency={s.account.currency} className="text-sm font-semibold text-ink" />
                </a>
              ))}
              {!proAccounts.length && <Button size="sm" variant="soft" icon={Plus} onClick={() => openModal({ type: 'account', preset: { type: 'pro' } })}>Ajouter le compte de l'agence</Button>}
            </div>
          </Card>
          <Card className="p-5 sm:p-6">
            <CardHeader title="Dépenses par poste" subtitle={periodLabel} />
            <Donut slices={expByCat} currency={d.base} size={150} centerLabel="Dépenses" />
          </Card>
        </div>
      </div>
    </div>
  )
}
