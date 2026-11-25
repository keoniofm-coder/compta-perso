import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, CalendarClock, CheckCheck, CheckCircle2, Clock, Pencil, Plus, Repeat, Undo2 } from 'lucide-react'
import { SegmentBar } from '../components/charts'
import { txVisual } from '../components/common'
import { Badge, Button, Card, CardHeader, EmptyState, IconButton, IconChip, Money, MonthPicker, PageHeader, Progress, Stat, cx } from '../components/ui'
import { expectedAmount, monthlyEquivalent, occurrences, recurringTotals, recurringTx, useDerived, validatedAmounts, type Occurrence } from '../lib/calc'
import { currentMonth, dateLabel, monthLabel } from '../lib/dates'
import { FREQUENCIES, categoryMeta } from '../lib/meta'
import { uid, useData } from '../lib/store'
import type { Recurring } from '../lib/types'
import { confirm, openModal, toast } from '../lib/ui'

function recVisual(r: Recurring) {
  if (r.kind === 'transfer') return { icon: ArrowRightLeft, color: '#6366f1' }
  const m = categoryMeta(r.category)
  return { icon: m.icon, color: m.color }
}

function OccRow({ o }: { o: Occurrence }) {
  const d = useDerived()
  const r = o.recurring
  const acc = d.db.accounts[r.accountId]
  const to = r.toAccountId ? d.db.accounts[r.toAccountId] : undefined
  const v = o.tx ? txVisual(o.tx) : recVisual(r)
  const amount = o.tx?.amount ?? expectedAmount(r, o.month)
  const approx = !o.tx && r.variable
  const sign = r.kind === 'income' ? 1 : r.kind === 'expense' ? -1 : 0
  return (
    <div className="flex items-center gap-3 pr-3 rounded-xl transition-colors hover:bg-surface-2">
      <button
        type="button"
        title="Modifier ou supprimer ce flux fixe"
        onClick={() => openModal({ type: 'recurring', id: r.id })}
        className={cx('min-w-0 flex-1 flex items-center gap-3 pl-3 py-2.5 text-left', o.status === 'done' && 'opacity-70')}
      >
        <div className="w-11 text-center shrink-0">
          <div className="text-lg font-bold text-ink leading-none tnum">{o.date.slice(8)}</div>
          <div className="text-[10.5px] uppercase text-muted">{dateLabel(o.date, { month: 'short' }).replace('.', '')}</div>
        </div>
        <IconChip icon={v.icon} color={v.color} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink truncate">{r.label}</div>
          <div className="text-xs text-muted truncate">{to ? `${acc?.name} → ${to.name}` : acc?.name}{r.scope === 'pro' ? ' · pro' : ''}{r.auto ? ' · automatique' : ''}</div>
        </div>
        <span className={cx('text-sm font-semibold hidden sm:inline whitespace-nowrap', approx && 'opacity-70')} title={approx ? 'Montant estimé : ajuste-le avec le crayon, puis valide le montant exact' : undefined}>
          {approx && <span className="text-muted mr-0.5">≈</span>}
          <Money value={sign * amount || amount} currency={acc?.currency ?? d.base} sign={sign !== 0} colored={sign !== 0} />
        </span>
      </button>
      {o.status === 'done' ? (
        <button
          type="button"
          title="Annuler la validation"
          onClick={async () => {
            const ok = await confirm({
              title: 'Annuler la validation ?',
              message: r.auto ? 'Le mouvement créé sera supprimé et ce mois ne sera plus validé automatiquement.' : 'Le mouvement créé sera supprimé.',
              confirmLabel: 'Annuler la validation',
            })
            if (!ok) return
            // On note le mois d'abord, sinon la validation automatique le recréerait aussitôt.
            if (r.auto) useData.getState().put('recurrings', { ...r, skipped: Array.from(new Set([...(r.skipped ?? []), o.month])) })
            useData.getState().remove('transactions', o.tx!.id)
          }}
          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 px-2.5 h-8 text-xs font-semibold group"
        >
          <CheckCircle2 className="size-3.5 group-hover:hidden" />
          <Undo2 className="size-3.5 hidden group-hover:block" />
          Validé
        </button>
      ) : r.auto && o.status === 'upcoming' ? (
        <span title="Validé automatiquement à sa date" className="inline-flex items-center gap-1 rounded-full bg-indigo-500/12 text-indigo-600 dark:text-indigo-300 px-2.5 h-8 text-xs font-semibold">
          <Repeat className="size-3.5" />
          Auto
        </span>
      ) : (
        <div className="flex items-center gap-1.5">
          {r.variable && (
            <IconButton
              icon={Pencil}
              label={`Modifier l'estimation de ${dateLabel(o.date, { month: 'long' })}`}
              onClick={() => openModal({ type: 'validate', recurringId: r.id, month: o.month, intent: 'estimate' })}
            />
          )}
          <Button size="sm" variant={o.status === 'late' ? 'primary' : 'secondary'} onClick={() => openModal({ type: 'validate', recurringId: r.id, month: o.month })}>
            Valider
          </Button>
        </div>
      )}
    </div>
  )
}

function RecRow({ r, month, actual }: { r: Recurring; month: string; actual?: number }) {
  const d = useDerived()
  const acc = d.db.accounts[r.accountId]
  const to = r.toAccountId ? d.db.accounts[r.toAccountId] : undefined
  const v = recVisual(r)
  const sign = r.kind === 'income' ? 1 : r.kind === 'expense' ? -1 : 0
  return (
    <button type="button" onClick={() => openModal({ type: 'recurring', id: r.id })} className={cx('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-2 transition-colors text-left', !r.active && 'opacity-50')}>
      <IconChip icon={v.icon} color={v.color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink truncate">{r.label}</span>
          {!r.active && <Badge>En pause</Badge>}
          {r.active && r.auto && !r.variable && <Badge tone="brand">Auto</Badge>}
          {r.active && r.variable && <Badge tone="info">Variable</Badge>}
        </div>
        <div className="text-xs text-muted truncate">
          {FREQUENCIES[r.frequency].label} · le {r.day} · {to ? `${acc?.name} → ${to.name}` : acc?.name}
        </div>
      </div>
      <div className="text-right">
        <span className="text-sm font-semibold whitespace-nowrap">
          {r.variable && actual == null && <span className="text-muted mr-0.5">≈</span>}
          <Money value={(sign || 1) * (actual ?? expectedAmount(r, month))} currency={acc?.currency ?? d.base} sign={!!sign} colored={!!sign} />
        </span>
        {r.frequency !== 'monthly' && (
          <div className="text-[11.5px] text-muted">
            ≈ <Money value={monthlyEquivalent(d, r, month, actual)} currency={d.base} /> / mois
          </div>
        )}
      </div>
    </button>
  )
}

export function Recurrings() {
  const d = useDerived()
  const [month, setMonth] = useState(currentMonth())
  const occ = useMemo(() => occurrences(d, month), [d, month])
  // Les totaux suivent le mois affiché : estimations de ce mois-là, ou montants déjà validés.
  const totals = useMemo(() => recurringTotals(d, undefined, month), [d, month])
  const actual = useMemo(() => validatedAmounts(d, month), [d, month])
  const hasVariable = Object.values(d.db.recurrings).some((r) => r.active && r.variable)
  const recs = Object.values(d.db.recurrings).sort((a, b) => a.day - b.day)
  const done = occ.filter((o) => o.status === 'done').length
  const pending = occ.filter((o) => o.status !== 'done')

  const validateAll = async () => {
    // Les montants variables se saisissent un par un : on ne valide pas une estimation.
    const fixed = pending.filter((o) => !o.recurring.variable)
    const skippedVariable = pending.length - fixed.length
    const targets = fixed.filter((o) => o.status === 'late' || month < currentMonth())
    const list = targets.length ? targets : fixed
    if (!list.length) return toast('Les échéances restantes ont un montant variable : valide-les une par une avec le montant exact.')
    const ok = await confirm({
      title: `Valider ${list.length} échéance${list.length > 1 ? 's' : ''} ?`,
      message: `Les mouvements seront créés avec les montants prévus. Tu pourras les modifier ensuite.${skippedVariable ? ` Les montants variables (${skippedVariable}) restent à saisir un par un.` : ''}`,
      confirmLabel: 'Tout valider',
    })
    if (!ok) return
    const now = Date.now()
    const items = list.map((o, i) => ({ collection: 'transactions' as const, item: recurringTx(d.db, d.convert, o.recurring, o.month, now + i, uid()) }))
    useData.getState().putMany(items)
    toast(`${items.length} échéance${items.length > 1 ? 's' : ''} validée${items.length > 1 ? 's' : ''}`)
  }

  const groups: { title: string; icon: typeof ArrowDownLeft; color: string; items: Recurring[] }[] = [
    { title: 'Revenus fixes', icon: ArrowDownLeft, color: '#10b981', items: recs.filter((r) => r.kind === 'income') },
    { title: 'Charges perso', icon: ArrowUpRight, color: '#f43f5e', items: recs.filter((r) => r.kind === 'expense' && r.scope === 'perso') },
    { title: 'Charges agence', icon: ArrowUpRight, color: '#ec4899', items: recs.filter((r) => r.kind === 'expense' && r.scope === 'pro') },
    { title: 'Virements automatiques', icon: ArrowRightLeft, color: '#6366f1', items: recs.filter((r) => r.kind === 'transfer') },
  ].filter((g) => g.items.length)

  return (
    <div>
      <PageHeader
        eyebrow="Fixes & échéancier"
        title="Revenus et charges fixes"
        subtitle="Salaire, loyer, abonnements, salaires d'employés… valide-les chaque mois en un clic."
        actions={<Button variant="primary" icon={Plus} onClick={() => openModal({ type: 'recurring' })}>Flux fixe</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Stat label="Revenus fixes / mois" value={totals.income} currency={d.base} icon={ArrowDownLeft} color="#10b981" sub={hasVariable ? `Estimations de ${monthLabel(month).toLowerCase()} comprises` : undefined} />
        <Stat label="Charges fixes / mois" value={totals.expense} currency={d.base} icon={ArrowUpRight} color="#f43f5e" />
        <Stat label="Reste après charges" value={totals.net} currency={d.base} icon={CalendarClock} color="#6366f1" colored sub={totals.income ? `${Math.round((totals.expense / totals.income) * 100)} % des revenus en charges` : undefined} />
        <Stat label="Virements auto / mois" value={totals.transfers} currency={d.base} icon={Repeat} color="#8b5cf6" sub="Épargne, invest, compte courant…" />
      </div>

      <div className="grid lg:grid-cols-5 gap-5 lg:gap-6">
        <Card className="p-4 sm:p-5 lg:col-span-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 px-1">
            <MonthPicker value={month} onChange={setMonth} />
            {pending.length > 0 && <Button size="sm" variant="soft" icon={CheckCheck} onClick={validateAll}>Tout valider</Button>}
          </div>
          {occ.length > 0 && (
            <div className="px-1 mb-4">
              <div className="flex justify-between text-xs text-muted mb-1.5">
                <span>{done}/{occ.length} validées</span>
                {occ.some((o) => o.status === 'late') && <span className="text-amber-600 dark:text-amber-400 font-semibold inline-flex items-center gap-1"><Clock className="size-3" /> {occ.filter((o) => o.status === 'late').length} en retard</span>}
              </div>
              <Progress value={occ.length ? done / occ.length : 0} color="#10b981" />
            </div>
          )}
          {occ.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Rien de prévu ce mois-ci" text="Ajoute tes revenus et charges fixes pour avoir ton échéancier." action={<Button variant="primary" icon={Plus} onClick={() => openModal({ type: 'recurring' })}>Ajouter un flux fixe</Button>} />
          ) : (
            <div className="-mx-1 space-y-0.5">
              {occ.map((o) => (
                <OccRow key={`${o.recurring.id}-${o.month}`} o={o} />
              ))}
            </div>
          )}
        </Card>

        <div className="lg:col-span-2 space-y-5">
          {totals.income > 0 && (
            <Card className="p-5">
              <CardHeader title="Où partent tes revenus fixes" />
              <SegmentBar
                parts={[
                  { key: 'exp', value: totals.expense, color: '#f43f5e', label: 'Charges' },
                  { key: 'tr', value: Math.min(totals.transfers, Math.max(0, totals.net)), color: '#8b5cf6', label: 'Virements auto' },
                  { key: 'rest', value: Math.max(0, totals.net - totals.transfers), color: '#10b981', label: 'Libre' },
                ]}
              />
              <div className="mt-3 space-y-1.5 text-[13px]">
                <div className="flex justify-between"><span className="text-ink-2 flex items-center gap-2"><span className="size-2.5 rounded-full bg-rose-500" />Charges fixes</span><Money value={totals.expense} currency={d.base} className="font-semibold" /></div>
                <div className="flex justify-between"><span className="text-ink-2 flex items-center gap-2"><span className="size-2.5 rounded-full bg-violet-500" />Virements automatiques</span><Money value={totals.transfers} currency={d.base} className="font-semibold" /></div>
                <div className="flex justify-between"><span className="text-ink-2 flex items-center gap-2"><span className="size-2.5 rounded-full bg-emerald-500" />Reste libre</span><Money value={totals.net - totals.transfers} currency={d.base} className="font-semibold" /></div>
              </div>
            </Card>
          )}
          {groups.map((g) => (
            <Card key={g.title} className="p-4 sm:p-5">
              <div className="flex items-center justify-between px-1 mb-2">
                <h3 className="font-semibold text-[15px] text-ink flex items-center gap-2">
                  <g.icon className="size-4" style={{ color: g.color }} /> {g.title}
                </h3>
                <Money value={g.items.filter((r) => r.active).reduce((s, r) => s + monthlyEquivalent(d, r, month, actual.get(r.id)), 0)} currency={d.base} className="text-sm font-semibold text-ink-2" />
              </div>
              <div className="-mx-1">
                {g.items.map((r) => (
                  <RecRow key={r.id} r={r} month={month} actual={actual.get(r.id)} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
