import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Inbox, Search, Split } from 'lucide-react'
import { Donut } from '../components/charts'
import { AccountSelect, TxRow } from '../components/common'
import { Button, Card, CardHeader, EmptyState, Input, Money, MonthPicker, PageHeader, Segmented, Stat, cx } from '../components/ui'
import { monthlyFlows, useDerived } from '../lib/calc'
import { currentMonth, monthOf, relativeDay } from '../lib/dates'
import { categoryMeta } from '../lib/meta'
import type { Transaction } from '../lib/types'
import { openModal } from '../lib/ui'
import { useAllAccounts } from '../forms/shared'

type KindFilter = 'all' | 'income' | 'expense' | 'transfer'
type ScopeFilter = 'all' | 'perso' | 'pro'

export function Movements() {
  const d = useDerived()
  const accounts = useAllAccounts()
  const [month, setMonth] = useState(currentMonth())
  const [allTime, setAllTime] = useState(false)
  const [kind, setKind] = useState<KindFilter>('all')
  const [scope, setScope] = useState<ScopeFilter>('all')
  const [accountId, setAccountId] = useState('')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return d.transactions
      .filter((t) => allTime || monthOf(t.date) === month)
      .filter((t) => {
        if (kind === 'all') return true
        if (kind === 'expense') return t.kind === 'expense' || (t.kind === 'checkpoint' && d.db.accounts[t.accountId]?.type === 'courant')
        return t.kind === kind
      })
      .filter((t) => scope === 'all' || t.scope === scope)
      .filter((t) => !accountId || t.accountId === accountId || t.toAccountId === accountId)
      .filter((t) => !ql || `${t.label} ${t.counterparty ?? ''} ${t.note ?? ''} ${categoryMeta(t.category).label}`.toLowerCase().includes(ql))
      .reverse()
  }, [d, month, allTime, kind, scope, accountId, q])

  const flow = useMemo(() => {
    const f = monthlyFlows(d, [month], scope === 'all' ? undefined : scope)[0]
    return f
  }, [d, month, scope])

  const byDay = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of list.slice(0, 400)) map.set(t.date, [...(map.get(t.date) ?? []), t])
    return [...map.entries()]
  }, [list])

  const expenseSlices = Object.entries(flow.byCategory).map(([k, v]) => {
    const m = categoryMeta(k)
    return { key: k, label: m.label, value: v, color: m.color }
  })
  const incomeSlices = Object.entries(flow.incomeByCategory).map(([k, v]) => {
    const m = categoryMeta(k)
    return { key: k, label: m.label, value: v, color: m.color }
  })

  return (
    <div>
      <PageHeader
        eyebrow="Entrées & sorties"
        title="Mouvements"
        subtitle="Salaires, loyers, charges, gros achats, factures clients… (pas les petites dépenses du quotidien)"
        actions={
          <>
            <Button icon={Split} onClick={() => openModal({ type: 'split' })}>Répartir</Button>
            <Button icon={ArrowRightLeft} onClick={() => openModal({ type: 'tx', kind: 'transfer' })} className="hidden sm:inline-flex">Virement</Button>
            <Button icon={ArrowDownLeft} onClick={() => openModal({ type: 'tx', kind: 'income' })}>Entrée</Button>
            <Button variant="primary" icon={ArrowUpRight} onClick={() => openModal({ type: 'tx', kind: 'expense' })}>Sortie</Button>
          </>
        }
      />

      <div className="flex flex-col xl:flex-row gap-3 mb-5">
        <div className="flex items-center gap-2">
          {!allTime && <MonthPicker value={month} onChange={setMonth} />}
          <Button variant={allTime ? 'soft' : 'ghost'} size="sm" onClick={() => setAllTime(!allTime)}>{allTime ? 'Par mois' : 'Tout afficher'}</Button>
        </div>
        <div className="flex flex-wrap gap-2 xl:ml-auto">
          <Segmented
            size="sm"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'all', label: 'Tout' },
              { value: 'income', label: 'Entrées' },
              { value: 'expense', label: 'Sorties' },
              { value: 'transfer', label: 'Virements' },
            ]}
          />
          <Segmented
            size="sm"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'all', label: 'Perso + pro' },
              { value: 'perso', label: 'Perso' },
              { value: 'pro', label: 'Pro' },
            ]}
          />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-2 mb-5">
        <div className="relative">
          <Search className="size-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input className="pl-10" placeholder="Rechercher un libellé, un client, une catégorie…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <AccountSelect value={accountId} onChange={setAccountId} accounts={accounts} placeholder="Tous les comptes" />
          </div>
          {accountId && <Button variant="ghost" onClick={() => setAccountId('')}>Tous</Button>}
        </div>
      </div>

      {!allTime && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          <Stat label="Entrées" value={flow.income} currency={d.base} icon={ArrowDownLeft} color="#10b981" />
          <Stat label="Sorties" value={flow.expense} currency={d.base} icon={ArrowUpRight} color="#f43f5e" sub={flow.vieCourante ? <>dont <Money value={flow.vieCourante} currency={d.base} /> courantes</> : undefined} />
          <Stat label="Solde" value={flow.net} currency={d.base} icon={ArrowRightLeft} color="#6366f1" colored />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5 lg:gap-6">
        <Card className={cx('p-3 sm:p-4', allTime ? 'lg:col-span-3' : 'lg:col-span-2')}>
          {byDay.length === 0 ? (
            <EmptyState icon={Inbox} title="Aucun mouvement" text={allTime ? 'Ajoute ta première entrée ou sortie.' : 'Rien sur cette période avec ces filtres.'} />
          ) : (
            <div className="space-y-4">
              {byDay.map(([date, txs]) => (
                <div key={date}>
                  <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">{relativeDay(date)}</div>
                  {txs.map((t) => (
                    <TxRow key={t.id} t={t} contextAccountId={accountId || undefined} />
                  ))}
                </div>
              ))}
              {list.length > 400 && <p className="text-center text-xs text-muted py-2">Affichage limité aux 400 derniers mouvements, affine avec les filtres.</p>}
            </div>
          )}
        </Card>
        {!allTime && (
          <div className="space-y-5 lg:space-y-6">
            <Card className="p-5">
              <CardHeader title="Sorties par catégorie" />
              <Donut slices={expenseSlices} currency={d.base} centerLabel="Sorties" size={150} />
            </Card>
            <Card className="p-5">
              <CardHeader title="Entrées par catégorie" />
              <Donut slices={incomeSlices} currency={d.base} centerLabel="Entrées" size={150} />
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
