import { Check, Hourglass, Plus } from 'lucide-react'
import { pendingTotals, useDerived } from '../lib/calc'
import { dateLabel, today } from '../lib/dates'
import { useData } from '../lib/store'
import type { Transaction } from '../lib/types'
import { openModal, toast } from '../lib/ui'
import { txVisual } from './common'
import { Button, Card, CardHeader, IconChip, Money, cx } from './ui'

const DAY = 86_400_000
function dueLabel(date: string) {
  const days = Math.round((Date.parse(today()) - Date.parse(date)) / DAY)
  if (days === 0) return { text: "prévu aujourd'hui", late: false }
  if (days < 0) return { text: `prévu le ${dateLabel(date, { day: 'numeric', month: 'short' })}`, late: false }
  return { text: days === 1 ? 'depuis hier' : `depuis ${days} jours`, late: true }
}

function PendingRow({ t }: { t: Transaction }) {
  const d = useDerived()
  const acc = d.db.accounts[t.accountId]
  const v = txVisual(t)
  const isIncome = t.kind === 'income'
  const due = dueLabel(t.date)
  // Réglé aujourd'hui : le mouvement entre dans les soldes à la date du jour (modifiable ensuite).
  const settle = () => {
    useData.getState().put('transactions', { ...t, pending: undefined, date: today() })
    toast(isIncome ? `${t.label} : marqué comme reçu` : `${t.label} : marqué comme payé`)
  }
  return (
    <div className="flex items-center gap-1 rounded-xl hover:bg-surface-2 transition-colors pr-2">
      <button type="button" onClick={() => openModal({ type: 'tx', tx: t })} className="min-w-0 flex-1 flex items-center gap-3 px-3 py-2.5 text-left">
        <IconChip icon={v.icon} color={v.color} />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[14px] text-ink truncate">{t.label}</div>
          <div className="text-[12.5px] text-muted truncate">{[t.counterparty, acc?.name, t.scope === 'pro' ? 'pro' : ''].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="text-right shrink-0">
          <Money value={isIncome ? t.amount : -t.amount} currency={acc?.currency ?? d.base} sign colored className="font-semibold text-[14.5px]" />
          <div className={cx('text-[11.5px]', due.late ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted')}>{due.text}</div>
        </div>
      </button>
      <Button size="sm" variant="soft" icon={Check} onClick={settle}>
        {isIncome ? 'Reçu' : 'Payé'}
      </Button>
    </div>
  )
}

/** Sommes qu'on me doit / que je dois, avec bouton pour les régler. */
export function PendingCard() {
  const d = useDerived()
  if (!d.pending.length) return null
  const { owedToMe, iOwe } = pendingTotals(d)
  const items = [...d.pending].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return (
    <Card className="p-4 sm:p-5 mb-6 border-amber-400/40">
      <CardHeader
        title="En attente"
        icon={Hourglass}
        subtitle={
          <span className="flex flex-wrap gap-x-3">
            {owedToMe > 0 && (
              <span>
                On te doit <Money value={owedToMe} currency={d.base} className="font-semibold text-pos" />
              </span>
            )}
            {iOwe > 0 && (
              <span>
                Tu dois <Money value={iOwe} currency={d.base} className="font-semibold text-neg" />
              </span>
            )}
          </span>
        }
        action={
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => openModal({ type: 'tx', kind: 'income', preset: { pending: true } })}>
            Ajouter
          </Button>
        }
      />
      <div className="-mx-2 -mb-1">
        {items.map((t) => (
          <PendingRow key={t.id} t={t} />
        ))}
      </div>
    </Card>
  )
}
