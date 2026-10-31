import { useMemo } from 'react'
import { makeConverter, useRates, type Converter } from './currency'
import { addMonths, currentMonth, dayInMonth, lastDayOf, monthDiff, monthOf, monthRange, today, yearsBetween } from './dates'
import { FREQUENCIES } from './meta'
import { useData, useSettings } from './store'
import type { Account, Asset, DB, Holding, HoldingOp, Liability, Recurring, Transaction } from './types'

export interface CashEvent {
  date: string
  delta: number
  balance: number
  kind: 'tx' | 'op' | 'checkpoint'
  txId?: string
  opId?: string
  seq: number
}

export interface HoldingStat {
  holding: Holding
  account?: Account
  ops: HoldingOp[]
  quantity: number
  costBasis: number
  avgCost: number
  price: number
  priceDate?: string
  priceSource: 'live' | 'manual' | 'none'
  value: number
  valueBase: number
  costBase: number
  unrealized: number
  unrealizedPct: number
  realized: number
  income: number
  invested: number
}

export interface AccountStat {
  account: Account
  cash: number
  holdingsValue: number
  total: number
  totalBase: number
  holdings: HoldingStat[]
  events: CashEvent[]
  lastCheckpoint?: Transaction
}

export interface Totals {
  netWorth: number
  grossAssets: number
  accounts: number
  liquid: number
  savings: number
  invested: number
  crypto: number
  pro: number
  assets: number
  liabilities: number
  holdingsValue: number
  holdingsCost: number
}

export interface Derived {
  base: string
  convert: Converter
  accounts: AccountStat[]
  accountById: Map<string, AccountStat>
  holdings: HoldingStat[]
  holdingById: Map<string, HoldingStat>
  checkpointDelta: Map<string, number>
  totals: Totals
  transactions: Transaction[]
  assetValue: (a: Asset, date?: string) => number
  liabilityRemainingAt: (l: Liability, date: string) => number
  balanceAt: (accountId: string, date: string) => number
  accountValueAt: (accountId: string, date: string) => number
  db: DB
}

const byDateSeq = <T extends { date: string; createdAt?: number }>(a: T, b: T) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt ?? 0) - (b.createdAt ?? 0)

/** Rejoue les opérations d'une position jusqu'à une date (incluse). */
export function replayHolding(holding: Holding, ops: HoldingOp[], until?: string) {
  let qty = 0
  let cost = 0
  let realized = 0
  let income = 0
  let invested = 0
  let price = holding.mode === 'amount' ? 1 : 0
  let priceDate: string | undefined
  for (const op of ops) {
    if (until && op.date > until) break
    if (holding.mode === 'amount') {
      const amount = op.amount ?? op.quantity * op.price
      if (op.kind === 'buy') {
        const units = price > 0 ? Math.max(0, amount - (op.fees || 0)) / price : 0
        qty += units
        cost += amount
        invested += amount
      } else if (op.kind === 'sell') {
        const units = price > 0 ? Math.min(qty, amount / price) : 0
        const avg = qty > 0 ? cost / qty : 0
        realized += amount - (op.fees || 0) - avg * units
        cost -= avg * units
        qty -= units
      } else if (op.kind === 'income') {
        income += amount
      } else if (op.kind === 'price') {
        if (qty > 0) price = amount / qty
        else price = 1
        priceDate = op.date
      }
      if (op.kind !== 'income' && op.kind !== 'price') priceDate = priceDate ?? op.date
    } else {
      if (op.kind === 'buy') {
        qty += op.quantity
        cost += op.quantity * op.price + (op.fees || 0)
        invested += op.quantity * op.price + (op.fees || 0)
        if (op.price > 0) {
          price = op.price
          priceDate = op.date
        }
      } else if (op.kind === 'sell') {
        const q = Math.min(op.quantity, qty)
        const avg = qty > 0 ? cost / qty : 0
        realized += q * op.price - (op.fees || 0) - avg * q
        cost -= avg * q
        qty -= q
        if (op.price > 0) {
          price = op.price
          priceDate = op.date
        }
      } else if (op.kind === 'income') {
        income += op.amount ?? 0
      } else if (op.kind === 'price') {
        price = op.price
        priceDate = op.date
      }
    }
  }
  if (Math.abs(qty) < 1e-12) qty = 0
  if (qty === 0) cost = 0
  return { qty, cost, realized, income, invested, price, priceDate }
}

export function computeDerived(db: DB, convert: Converter, base: string, liveRates: Record<string, number>): Derived {
  const todayStr = today()
  const accountsArr = Object.values(db.accounts)
  const txs = Object.values(db.transactions).sort(byDateSeq)
  const opsByHolding = new Map<string, HoldingOp[]>()
  for (const op of Object.values(db.ops)) {
    const list = opsByHolding.get(op.holdingId) ?? []
    list.push(op)
    opsByHolding.set(op.holdingId, list)
  }
  for (const list of opsByHolding.values()) list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.kind === 'price' ? 1 : 0) - (b.kind === 'price' ? 1 : 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0)))

  /* --- Positions --- */
  const holdingStats: HoldingStat[] = []
  const holdingById = new Map<string, HoldingStat>()
  for (const h of Object.values(db.holdings)) {
    const ops = opsByHolding.get(h.id) ?? []
    const r = replayHolding(h, ops)
    let price = r.price
    let priceSource: HoldingStat['priceSource'] = ops.length ? 'manual' : 'none'
    let priceDate = r.priceDate
    const liveKey = !h.autoPrice ? '' : h.cryptoId ? `cg:${h.cryptoId}` : h.quoteSymbol ? `yf:${h.quoteSymbol}` : ''
    if (liveKey && liveRates[liveKey]) {
      price = convert(liveRates[liveKey], 'EUR', h.currency)
      if (h.mode === 'amount') price = r.price
      else {
        priceSource = 'live'
        priceDate = todayStr
      }
    }
    const value = r.qty * price
    const st: HoldingStat = {
      holding: h,
      account: db.accounts[h.accountId],
      ops,
      quantity: r.qty,
      costBasis: r.cost,
      avgCost: r.qty > 0 ? r.cost / r.qty : 0,
      price,
      priceDate,
      priceSource,
      value,
      valueBase: convert(value, h.currency),
      costBase: convert(r.cost, h.currency),
      unrealized: value - r.cost,
      unrealizedPct: r.cost > 0 ? (value - r.cost) / r.cost : 0,
      realized: r.realized,
      income: r.income,
      invested: r.invested,
    }
    holdingStats.push(st)
    holdingById.set(h.id, st)
  }

  /* --- Flux d'espèces par compte --- */
  const eventsByAccount = new Map<string, Omit<CashEvent, 'balance'>[]>()
  const push = (accountId: string | undefined, ev: Omit<CashEvent, 'balance'>) => {
    if (!accountId) return
    const list = eventsByAccount.get(accountId) ?? []
    list.push(ev)
    eventsByAccount.set(accountId, list)
  }
  txs.forEach((t, i) => {
    const seq = (t.createdAt ?? 0) + i * 1e-6
    if (t.kind === 'income') push(t.accountId, { date: t.date, delta: t.amount, kind: 'tx', txId: t.id, seq })
    else if (t.kind === 'expense') push(t.accountId, { date: t.date, delta: -t.amount, kind: 'tx', txId: t.id, seq })
    else if (t.kind === 'transfer') {
      push(t.accountId, { date: t.date, delta: -t.amount, kind: 'tx', txId: t.id, seq })
      push(t.toAccountId, { date: t.date, delta: t.toAmount ?? t.amount, kind: 'tx', txId: t.id, seq })
    } else if (t.kind === 'checkpoint') push(t.accountId, { date: t.date, delta: 0, kind: 'checkpoint', txId: t.id, seq })
  })
  for (const h of Object.values(db.holdings)) {
    for (const op of opsByHolding.get(h.id) ?? []) {
      if (op.cashAmount) push(h.accountId, { date: op.date, delta: op.cashAmount, kind: 'op', opId: op.id, seq: op.createdAt ?? 0 })
    }
  }

  const checkpointDelta = new Map<string, number>()
  const accountStats: AccountStat[] = []
  const accountById = new Map<string, AccountStat>()
  for (const a of accountsArr) {
    const raw = (eventsByAccount.get(a.id) ?? []).sort((x, y) => {
      if (x.date !== y.date) return x.date < y.date ? -1 : 1
      const cx = x.kind === 'checkpoint' ? 1 : 0
      const cy = y.kind === 'checkpoint' ? 1 : 0
      if (cx !== cy) return cx - cy
      return x.seq - y.seq
    })
    let bal = a.initialBalance || 0
    let lastCheckpoint: Transaction | undefined
    const events: CashEvent[] = raw.map((ev) => {
      if (ev.kind === 'checkpoint') {
        const t = db.transactions[ev.txId!]
        const declared = t.declaredBalance ?? bal
        const delta = declared - bal
        checkpointDelta.set(t.id, delta)
        bal = declared
        lastCheckpoint = t
        return { ...ev, delta, balance: bal }
      }
      bal += ev.delta
      return { ...ev, balance: bal }
    })
    const holdings = holdingStats.filter((h) => h.holding.accountId === a.id && !h.holding.archived)
    const holdingsValue = holdings.reduce((s, h) => s + convert(h.value, h.holding.currency, a.currency), 0)
    const total = bal + holdingsValue
    const st: AccountStat = {
      account: a,
      cash: bal,
      holdingsValue,
      total,
      totalBase: convert(total, a.currency),
      holdings,
      events,
      lastCheckpoint,
    }
    accountStats.push(st)
    accountById.set(a.id, st)
  }
  accountStats.sort((x, y) => (x.account.order ?? 0) - (y.account.order ?? 0) || x.account.name.localeCompare(y.account.name))

  const balanceAt = (accountId: string, date: string) => {
    const st = accountById.get(accountId)
    if (!st) return 0
    let bal = st.account.initialBalance || 0
    for (const ev of st.events) {
      if (ev.date > date) break
      bal = ev.balance
    }
    return bal
  }

  const accountValueAt = (accountId: string, date: string) => {
    const st = accountById.get(accountId)
    if (!st) return 0
    if (date >= todayStr) return st.total
    let v = balanceAt(accountId, date)
    for (const h of st.holdings) {
      const r = replayHolding(h.holding, h.ops, date)
      v += convert(r.qty * r.price, h.holding.currency, st.account.currency)
    }
    return v
  }

  const assetValue = (a: Asset, date: string = todayStr) => {
    if (a.sold || a.purchaseDate > date) return 0
    if (a.depreciationYears && a.depreciationYears > 0) {
      const y = Math.max(0, yearsBetween(a.purchaseDate, date))
      return Math.max(0, a.purchaseValue * (1 - y / a.depreciationYears))
    }
    return date >= todayStr ? a.currentValue : a.currentValue
  }

  const liabilityRemainingAt = (l: Liability, date: string) => {
    if (l.startDate > date) return 0
    if (date >= todayStr || !l.monthlyPayment) return l.remaining
    const months = Math.max(0, monthDiff(monthOf(date), currentMonth()))
    return Math.min(l.initialAmount || Infinity, l.remaining + months * l.monthlyPayment)
  }

  /* --- Totaux --- */
  const totals: Totals = {
    netWorth: 0,
    grossAssets: 0,
    accounts: 0,
    liquid: 0,
    savings: 0,
    invested: 0,
    crypto: 0,
    pro: 0,
    assets: 0,
    liabilities: 0,
    holdingsValue: 0,
    holdingsCost: 0,
  }
  for (const st of accountStats) {
    if (st.account.excludeFromNetWorth) continue
    const cashBase = convert(st.cash, st.account.currency)
    const holdBase = convert(st.holdingsValue, st.account.currency)
    totals.accounts += st.totalBase
    switch (st.account.type) {
      case 'courant':
      case 'banque':
      case 'cash':
      case 'autre':
        totals.liquid += cashBase
        totals.invested += holdBase
        break
      case 'epargne':
        totals.savings += cashBase
        totals.invested += holdBase
        break
      case 'crypto':
        totals.crypto += cashBase + holdBase
        break
      case 'invest':
        totals.invested += cashBase + holdBase
        break
      case 'pro':
        totals.pro += cashBase
        totals.invested += holdBase
        break
    }
  }
  for (const h of holdingStats) {
    if (h.holding.archived || h.account?.excludeFromNetWorth) continue
    totals.holdingsValue += h.valueBase
    totals.holdingsCost += h.costBase
  }
  for (const a of Object.values(db.assets)) totals.assets += convert(assetValue(a), a.currency)
  for (const l of Object.values(db.liabilities)) totals.liabilities += convert(l.remaining, l.currency)
  totals.grossAssets = totals.accounts + totals.assets
  totals.netWorth = totals.grossAssets - totals.liabilities

  return {
    base,
    convert,
    accounts: accountStats,
    accountById,
    holdings: holdingStats,
    holdingById,
    checkpointDelta,
    totals,
    transactions: txs,
    assetValue,
    liabilityRemainingAt,
    balanceAt,
    accountValueAt,
    db,
  }
}

export function useDerived(): Derived {
  const db = useData((s) => s.db)
  const settings = useSettings()
  const rates = useRates((s) => s.rates)
  const fetchedAt = useRates((s) => s.fetchedAt)
  const overrides = settings.rateOverrides
  const base = settings.baseCurrency
  return useMemo(() => {
    const convert = makeConverter(rates, overrides ?? {}, base)
    return computeDerived(db, convert, base, rates)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, rates, fetchedAt, overrides, base])
}

/* ---------------- Historique & flux ---------------- */

export interface NetWorthPoint {
  month: string
  date: string
  netWorth: number
  accounts: number
  assets: number
  liabilities: number
}

/** Premier mois où l'on a des données (création du plus ancien compte). */
export function firstDataMonth(d: Derived) {
  let first = currentMonth()
  for (const st of d.accounts) {
    const m = monthOf(st.account.initialDate)
    if (m < first) first = m
    const ev = st.events[0]
    if (ev && monthOf(ev.date) < first) first = monthOf(ev.date)
  }
  return first
}

export function netWorthHistory(d: Derived, months = 12): NetWorthPoint[] {
  const end = currentMonth()
  const start = [addMonths(end, -(months - 1)), firstDataMonth(d)].sort()[1]
  const out: NetWorthPoint[] = []
  const todayStr = today()
  for (const m of monthRange(start, end)) {
    const date = m === end ? todayStr : lastDayOf(m)
    let accounts = 0
    for (const st of d.accounts) {
      if (st.account.excludeFromNetWorth) continue
      accounts += d.convert(d.accountValueAt(st.account.id, date), st.account.currency)
    }
    let assets = 0
    for (const a of Object.values(d.db.assets)) assets += d.convert(d.assetValue(a, date), a.currency)
    let liabilities = 0
    for (const l of Object.values(d.db.liabilities)) liabilities += d.convert(d.liabilityRemainingAt(l, date), l.currency)
    out.push({ month: m, date, netWorth: accounts + assets - liabilities, accounts, assets, liabilities })
  }
  return out
}

export interface MonthFlow {
  month: string
  income: number
  expense: number
  vieCourante: number
  incomePerso: number
  incomePro: number
  expensePerso: number
  expensePro: number
  net: number
  byCategory: Record<string, number>
  incomeByCategory: Record<string, number>
}

export function emptyFlow(month: string): MonthFlow {
  return {
    month,
    income: 0,
    expense: 0,
    vieCourante: 0,
    incomePerso: 0,
    incomePro: 0,
    expensePerso: 0,
    expensePro: 0,
    net: 0,
    byCategory: {},
    incomeByCategory: {},
  }
}

/** Flux mensuels (entrées / sorties, hors virements internes), convertis dans la devise principale. */
export function monthlyFlows(d: Derived, months: string[], scope?: 'perso' | 'pro'): MonthFlow[] {
  const map = new Map(months.map((m) => [m, emptyFlow(m)]))
  for (const t of d.transactions) {
    const f = map.get(monthOf(t.date))
    if (!f) continue
    const acc = d.db.accounts[t.accountId]
    if (!acc) continue
    if (scope && t.scope !== scope && t.kind !== 'checkpoint') continue
    if (t.kind === 'income') {
      const v = d.convert(t.amount, acc.currency)
      f.income += v
      if (t.scope === 'pro') f.incomePro += v
      else f.incomePerso += v
      const k = t.category ?? 'autre_entree'
      f.incomeByCategory[k] = (f.incomeByCategory[k] ?? 0) + v
    } else if (t.kind === 'expense') {
      const v = d.convert(t.amount, acc.currency)
      f.expense += v
      if (t.scope === 'pro') f.expensePro += v
      else f.expensePerso += v
      const k = t.category ?? 'autre_sortie'
      f.byCategory[k] = (f.byCategory[k] ?? 0) + v
    } else if (t.kind === 'checkpoint' && acc.type === 'courant' && scope !== 'pro') {
      const delta = d.checkpointDelta.get(t.id) ?? 0
      const v = d.convert(-delta, acc.currency)
      f.vieCourante += v
      f.expense += v
      f.expensePerso += v
      f.byCategory.vie_courante = (f.byCategory.vie_courante ?? 0) + v
    }
  }
  for (const f of map.values()) f.net = f.income - f.expense
  return months.map((m) => map.get(m)!)
}

/* ---------------- Compte courant ---------------- */

export interface CourantMonth {
  month: string
  opening: number
  inflows: number
  outflows: number
  expected: number
  closing: number
  checkpoint?: Transaction
  spent?: number
}

export function courantMonths(d: Derived, accountId: string, months: string[]): CourantMonth[] {
  const st = d.accountById.get(accountId)
  if (!st) return []
  return months.map((m) => {
    const opening = d.balanceAt(accountId, lastDayOf(addMonths(m, -1)))
    let inflows = 0
    let outflows = 0
    let checkpoint: Transaction | undefined
    for (const ev of st.events) {
      if (monthOf(ev.date) !== m) continue
      if (ev.kind === 'checkpoint') checkpoint = d.db.transactions[ev.txId!]
      else if (ev.delta > 0) inflows += ev.delta
      else outflows += -ev.delta
    }
    const expected = opening + inflows - outflows
    const closing = d.balanceAt(accountId, lastDayOf(m))
    const spent = checkpoint ? -(d.checkpointDelta.get(checkpoint.id) ?? 0) : undefined
    return { month: m, opening, inflows, outflows, expected, closing, checkpoint, spent }
  })
}

/* ---------------- Récurrents ---------------- */

export interface Occurrence {
  recurring: Recurring
  month: string
  date: string
  tx?: Transaction
  status: 'done' | 'late' | 'upcoming'
}

export function occursIn(r: Recurring, month: string) {
  if (month < r.startMonth) return false
  if (r.endMonth && month > r.endMonth) return false
  const step = FREQUENCIES[r.frequency].months
  return monthDiff(r.startMonth, month) % step === 0
}

export function occurrences(d: Derived, month: string): Occurrence[] {
  const todayStr = today()
  const txByRec = new Map<string, Transaction>()
  for (const t of d.transactions) if (t.recurringId && t.recurringPeriod === month) txByRec.set(t.recurringId, t)
  const out: Occurrence[] = []
  for (const r of Object.values(d.db.recurrings)) {
    const tx = txByRec.get(r.id)
    if (!tx && (!r.active || !occursIn(r, month))) continue
    const date = tx?.date ?? dayInMonth(month, r.day)
    out.push({ recurring: r, month, date, tx, status: tx ? 'done' : date < todayStr ? 'late' : 'upcoming' })
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.recurring.label.localeCompare(b.recurring.label)))
}

export function monthlyEquivalent(d: Derived, r: Recurring) {
  const acc = d.db.accounts[r.accountId]
  return d.convert((r.amount * FREQUENCIES[r.frequency].perYear) / 12, acc?.currency ?? d.base)
}

export function recurringTotals(d: Derived, scope?: 'perso' | 'pro') {
  let income = 0
  let expense = 0
  let transfers = 0
  for (const r of Object.values(d.db.recurrings)) {
    if (!r.active) continue
    if (r.endMonth && r.endMonth < currentMonth()) continue
    if (scope && r.scope !== scope) continue
    const v = monthlyEquivalent(d, r)
    if (r.kind === 'income') income += v
    else if (r.kind === 'expense') expense += v
    else transfers += v
  }
  return { income, expense, transfers, net: income - expense }
}

export function lastMonths(n: number, end = currentMonth()) {
  return monthRange(addMonths(end, -(n - 1)), end)
}

/** Les n derniers mois, sans les mois antérieurs aux premières données. */
export function activeMonths(d: Derived, n: number) {
  const first = firstDataMonth(d)
  const list = lastMonths(n).filter((m) => m >= first)
  return list.length ? list : [currentMonth()]
}
