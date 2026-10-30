import { useMemo } from 'react'
import { useDerived } from '../lib/calc'
import { currencyDef, formatMoney } from '../lib/currency'
import { categoriesFor } from '../lib/meta'
import type { Account, Scope } from '../lib/types'
import { cx } from '../components/ui'

export function useActiveAccounts(): Account[] {
  const d = useDerived()
  return useMemo(() => d.accounts.map((s) => s.account).filter((a) => !a.archived), [d])
}

export function useAllAccounts(): Account[] {
  const d = useDerived()
  return useMemo(() => d.accounts.map((s) => s.account), [d])
}

const LAST_ACC = 'trezo:lastAccount'
export function rememberAccount(kind: string, id: string) {
  try {
    localStorage.setItem(`${LAST_ACC}:${kind}`, id)
  } catch {
    /* ignore */
  }
}
export function lastAccount(kind: string) {
  try {
    return localStorage.getItem(`${LAST_ACC}:${kind}`) ?? ''
  } catch {
    return ''
  }
}

export function CategoryGrid({ kind, scope, value, onChange }: { kind: 'income' | 'expense'; scope: Scope; value: string; onChange: (id: string) => void }) {
  const cats = categoriesFor(kind, scope)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
      {cats.map((c) => {
        const active = value === c.id
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(active ? '' : c.id)}
            className={cx(
              'flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[12.5px] font-medium transition-all',
              active ? 'border-transparent text-white shadow-md' : 'border-line-strong text-ink-2 hover:border-indigo-400/60 hover:text-ink bg-surface-2',
            )}
            style={active ? { background: c.color } : undefined}
          >
            <c.icon className="size-4 shrink-0" style={active ? undefined : { color: c.color }} />
            <span className="leading-tight line-clamp-2">{c.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ConvertHint({ amount, from }: { amount: number; from: string }) {
  const d = useDerived()
  if (!amount || from === d.base) return null
  const v = d.convert(amount, from)
  return (
    <span className="text-xs text-muted">
      ≈ {formatMoney(v, d.base)} {v === 0 && <em>(taux indisponible)</em>}
    </span>
  )
}

export const ccy = (code: string) => currencyDef(code).symbol

export function FormSection({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('space-y-3', className)}>
      {title && <div className="text-xs font-semibold uppercase tracking-wider text-muted pt-1">{title}</div>}
      {children}
    </div>
  )
}
