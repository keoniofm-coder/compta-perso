import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Repeat, Scale, ShoppingBag } from 'lucide-react'
import { useDerived } from '../lib/calc'
import { currencyDef } from '../lib/currency'
import { dateLabel } from '../lib/dates'
import { ACCOUNT_TYPE_ORDER, ACCOUNT_TYPES, SERIES, categoryMeta } from '../lib/meta'
import type { Account, Transaction } from '../lib/types'
import { openModal, useUI } from '../lib/ui'
import { Badge, IconChip, Money, Select, cx } from './ui'

export function accountColor(a: Pick<Account, 'type' | 'color'> | undefined, dark = false) {
  if (!a) return '#64748b'
  if (a.color) return a.color
  const s = SERIES[ACCOUNT_TYPES[a.type].series]
  return dark ? s.dark : s.light
}

export function useAccountColor() {
  const dark = useUI((s) => s.isDark)
  return (a: Pick<Account, 'type' | 'color'> | undefined) => accountColor(a, dark)
}

export function AccountIcon({ account, size = 'md' }: { account?: Account; size?: 'sm' | 'md' | 'lg' }) {
  const color = useAccountColor()
  const meta = ACCOUNT_TYPES[account?.type ?? 'autre']
  return <IconChip icon={meta.icon} color={color(account)} size={size} />
}

export function AccountSelect({
  value,
  onChange,
  accounts,
  placeholder = 'Choisir un compte',
  exclude,
}: {
  value: string
  onChange: (id: string) => void
  accounts: Account[]
  placeholder?: string
  exclude?: string
}) {
  const list = accounts.filter((a) => (!a.archived || a.id === value) && a.id !== exclude)
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        {placeholder}
      </option>
      {ACCOUNT_TYPE_ORDER.map((t) => {
        const group = list.filter((a) => a.type === t)
        if (!group.length) return null
        return (
          <optgroup key={t} label={ACCOUNT_TYPES[t].plural}>
            {group.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {currencyDef(a.currency).code}
              </option>
            ))}
          </optgroup>
        )
      })}
    </Select>
  )
}

export function txVisual(t: Transaction) {
  if (t.kind === 'transfer') return { icon: ArrowRightLeft, color: '#6366f1' }
  if (t.kind === 'checkpoint') return { icon: t.category === 'vie_courante' ? ShoppingBag : Scale, color: '#0ea5e9' }
  const m = categoryMeta(t.category)
  return { icon: m.icon, color: m.color }
}

export function TxRow({ t, contextAccountId, showDate = false }: { t: Transaction; contextAccountId?: string; showDate?: boolean }) {
  const d = useDerived()
  const acc = d.db.accounts[t.accountId]
  const to = t.toAccountId ? d.db.accounts[t.toAccountId] : undefined
  const v = txVisual(t)
  let amount = 0
  let currency = acc?.currency ?? d.base
  let label = t.label
  let sub: string[] = []
  if (t.kind === 'income') {
    amount = t.amount
    sub = [categoryMeta(t.category).label, acc?.name ?? '?']
  } else if (t.kind === 'expense') {
    amount = -t.amount
    sub = [categoryMeta(t.category).label, acc?.name ?? '?']
  } else if (t.kind === 'transfer') {
    if (contextAccountId && contextAccountId === t.toAccountId) {
      amount = t.toAmount ?? t.amount
      currency = to?.currency ?? currency
    } else if (contextAccountId) {
      amount = -t.amount
    } else {
      amount = t.amount
    }
    sub = [`${acc?.name ?? '?'} → ${to?.name ?? '?'}`]
  } else {
    const delta = d.checkpointDelta.get(t.id) ?? 0
    amount = delta
    label = t.label || 'Mise à jour du solde'
    sub = [`Solde constaté`, acc?.name ?? '?']
  }
  if (showDate) sub.unshift(dateLabel(t.date, { day: 'numeric', month: 'short' }))
  const neutral = t.kind === 'transfer' && !contextAccountId
  return (
    <button
      type="button"
      onClick={() => (t.kind === 'checkpoint' ? openModal({ type: 'checkpoint', accountId: t.accountId, txId: t.id }) : openModal({ type: 'tx', tx: t }))}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-2 transition-colors text-left"
    >
      <IconChip icon={v.icon} color={v.color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-[14px] text-ink truncate">{label}</span>
          {t.recurringId && <Repeat className="size-3.5 text-muted shrink-0" aria-label="Récurrent" />}
          {t.scope === 'pro' && <Badge tone="brand" className="!text-[10px] !px-1.5">PRO</Badge>}
        </div>
        <div className="text-[12.5px] text-muted truncate">{sub.join(' · ')}</div>
      </div>
      <div className="text-right shrink-0">
        <Money
          value={amount}
          currency={currency}
          sign={!neutral}
          colored={!neutral}
          className={cx('font-semibold text-[14.5px]', neutral && 'text-ink')}
        />
        {t.kind === 'transfer' && t.toAmount != null && to && to.currency !== acc?.currency && !contextAccountId && (
          <div className="text-[11.5px] text-muted">
            <Money value={t.toAmount} currency={to.currency} />
          </div>
        )}
      </div>
    </button>
  )
}

export function KindIcon({ kind }: { kind: 'income' | 'expense' | 'transfer' }) {
  const Icon = kind === 'income' ? ArrowDownLeft : kind === 'expense' ? ArrowUpRight : ArrowRightLeft
  const color = kind === 'income' ? '#10b981' : kind === 'expense' ? '#f43f5e' : '#6366f1'
  return <IconChip icon={Icon} color={color} size="sm" />
}

export function AccountLine({ id }: { id: string }) {
  const d = useDerived()
  const st = d.accountById.get(id)
  if (!st) return null
  return (
    <div className="flex items-center gap-3">
      <AccountIcon account={st.account} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink truncate">{st.account.name}</div>
        <div className="text-xs text-muted">{ACCOUNT_TYPES[st.account.type].label}</div>
      </div>
      <Money value={st.total} currency={st.account.currency} className="text-sm font-semibold" />
    </div>
  )
}
