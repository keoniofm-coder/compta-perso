import { addMonths, currentMonth, dayInMonth, lastDayOf, monthRange, today } from './dates'
import { uid } from './store'
import type { Account, Asset, CollectionName, Employee, Holding, HoldingOp, Liability, Recurring, SplitTemplate, Transaction } from './types'

type Item = { collection: CollectionName; item: { id: string } }

/** Petit générateur pseudo-aléatoire déterministe. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function buildDemo(): Item[] {
  const rand = rng(42)
  const items: Item[] = []
  const add = (collection: CollectionName, item: { id: string }) => items.push({ collection, item: { ...item, demo: true } as { id: string } })
  const todayStr = today()
  const end = currentMonth()
  const start = addMonths(end, -8)
  const months = monthRange(start, end)
  const startDate = `${start}-01`
  let seq = Date.now() - 1e7
  const next = () => (seq += 1000)

  const acc = (a: Omit<Account, 'id' | 'initialDate' | 'scope'> & { scope?: 'perso' | 'pro' }): Account => {
    const full: Account = { id: uid(), initialDate: startDate, scope: 'perso', ...a }
    add('accounts', full)
    return full
  }
  const courant = acc({ name: 'Compte courant', type: 'courant', currency: 'EUR', initialBalance: 420, institution: 'BNP Paribas', order: 0 })
  const principal = acc({ name: 'Compte principal', type: 'banque', currency: 'EUR', initialBalance: 9500, institution: 'Boursorama', order: 1 })
  const livret = acc({ name: 'Livret A', type: 'epargne', currency: 'EUR', initialBalance: 8000, institution: 'Boursorama', order: 2 })
  const pea = acc({ name: 'PEA', type: 'invest', currency: 'EUR', initialBalance: 300, institution: 'Boursorama', order: 3 })
  const av = acc({ name: 'Assurance-vie', type: 'invest', currency: 'EUR', initialBalance: 0, institution: 'Linxea', order: 4 })
  const binance = acc({ name: 'Binance', type: 'crypto', currency: 'EUR', initialBalance: 0, institution: 'Binance', order: 5 })
  acc({ name: 'Ledger — BTC', type: 'crypto', currency: 'BTC', initialBalance: 0.012, institution: 'Ledger', order: 6 })
  const pro = acc({ name: 'Compte agence', type: 'pro', currency: 'EUR', initialBalance: 9000, institution: 'Qonto', scope: 'pro', order: 7 })
  const wise = acc({ name: 'Wise USD', type: 'banque', currency: 'USD', initialBalance: 1200, institution: 'Wise', order: 8 })

  const lea: Employee = { id: uid(), name: 'Léa Martin', role: 'Community manager', salary: 1900, currency: 'EUR', accountId: pro.id, active: true, startDate: startDate }
  const hugo: Employee = { id: uid(), name: 'Hugo Bernard', role: 'Motion designer', salary: 1600, currency: 'EUR', accountId: pro.id, active: true, startDate: startDate }
  add('employees', lea)
  add('employees', hugo)

  const rec = (x: Omit<Recurring, 'id' | 'frequency' | 'startMonth' | 'active'> & Partial<Recurring>): Recurring => {
    const full: Recurring = { id: uid(), frequency: 'monthly', startMonth: start, active: true, ...x }
    add('recurrings', full)
    return full
  }
  const recs: { r: Recurring; jitter: number }[] = [
    { r: rec({ kind: 'income', label: 'Rémunération agence', amount: 3600, accountId: principal.id, category: 'remu_agence', day: 1, scope: 'perso' }), jitter: 0 },
    { r: rec({ kind: 'expense', label: 'Loyer', amount: 950, accountId: principal.id, category: 'loyer', day: 5, scope: 'perso', counterparty: 'Agence Foncia' }), jitter: 0 },
    { r: rec({ kind: 'expense', label: 'Électricité & gaz', amount: 85, accountId: principal.id, category: 'charges', day: 10, scope: 'perso', counterparty: 'EDF' }), jitter: 0.15 },
    { r: rec({ kind: 'expense', label: 'Internet & mobile', amount: 45, accountId: principal.id, category: 'telecom', day: 12, scope: 'perso' }), jitter: 0 },
    { r: rec({ kind: 'expense', label: 'Assurance habitation & auto', amount: 62, accountId: principal.id, category: 'assurances', day: 15, scope: 'perso' }), jitter: 0 },
    { r: rec({ kind: 'expense', label: 'Abonnements (Netflix, Spotify…)', amount: 38, accountId: principal.id, category: 'abonnements', day: 18, scope: 'perso' }), jitter: 0 },
    { r: rec({ kind: 'expense', label: 'Mensualité crédit auto', amount: 320, accountId: principal.id, category: 'credit', day: 7, scope: 'perso' }), jitter: 0 },
    { r: rec({ kind: 'income', label: 'Facturation Studio Nova', amount: 5800, accountId: pro.id, category: 'facturation', day: 3, scope: 'pro', counterparty: 'Studio Nova' }), jitter: 0 },
    { r: rec({ kind: 'income', label: 'Facturation Maison Lumen', amount: 3600, accountId: pro.id, category: 'facturation', day: 8, scope: 'pro', counterparty: 'Maison Lumen' }), jitter: 0 },
    { r: rec({ kind: 'expense', label: 'Salaire Léa', amount: 1900, accountId: pro.id, category: 'salaires_employes', day: 28, scope: 'pro', counterparty: lea.name, employeeId: lea.id }), jitter: 0 },
    { r: rec({ kind: 'expense', label: 'Salaire Hugo', amount: 1600, accountId: pro.id, category: 'salaires_employes', day: 28, scope: 'pro', counterparty: hugo.name, employeeId: hugo.id }), jitter: 0 },
    { r: rec({ kind: 'expense', label: 'Logiciels (Adobe, Notion, Canva)', amount: 180, accountId: pro.id, category: 'logiciels', day: 6, scope: 'pro' }), jitter: 0.05 },
    { r: rec({ kind: 'expense', label: 'Meta Ads', amount: 650, accountId: pro.id, category: 'publicite', day: 20, scope: 'pro', counterparty: 'Meta' }), jitter: 0.25 },
    { r: rec({ kind: 'expense', label: 'URSSAF', amount: 1150, accountId: pro.id, category: 'cotisations', day: 15, scope: 'pro', counterparty: 'URSSAF' }), jitter: 0 },
    { r: rec({ kind: 'expense', label: 'Rémunération dirigeant', amount: 3600, accountId: pro.id, category: 'remu_dirigeant', day: 1, scope: 'pro' }), jitter: 0 },
    { r: rec({ kind: 'expense', label: 'Expert-comptable', amount: 450, accountId: pro.id, category: 'comptable', day: 10, scope: 'pro', frequency: 'quarterly' }), jitter: 0 },
  ]

  const tx = (t: Omit<Transaction, 'id' | 'createdAt'>) => {
    if (t.date > todayStr) return
    add('transactions', { id: uid(), createdAt: next(), ...t } as Transaction)
  }

  const split: SplitTemplate = {
    id: uid(),
    name: 'Ma répartition mensuelle',
    sourceAccountId: principal.id,
    lines: [
      { accountId: courant.id, amount: 1300 },
      { accountId: livret.id, amount: 300 },
      { accountId: binance.id, amount: 200 },
      { accountId: pea.id, amount: 250 },
    ],
  }
  add('splits', split)

  // Positions
  const btc: Holding = { id: uid(), accountId: binance.id, name: 'Bitcoin', symbol: 'BTC', assetClass: 'crypto', currency: 'EUR', mode: 'units', cryptoId: 'bitcoin', autoPrice: true }
  const eth: Holding = { id: uid(), accountId: binance.id, name: 'Ethereum', symbol: 'ETH', assetClass: 'crypto', currency: 'EUR', mode: 'units', cryptoId: 'ethereum', autoPrice: true }
  const sol: Holding = { id: uid(), accountId: binance.id, name: 'Solana', symbol: 'SOL', assetClass: 'crypto', currency: 'EUR', mode: 'units', cryptoId: 'solana', autoPrice: true }
  const cw8: Holding = { id: uid(), accountId: pea.id, name: 'Amundi PEA Monde', symbol: 'EWLD', assetClass: 'etf', currency: 'EUR', mode: 'units' }
  const ai: Holding = { id: uid(), accountId: pea.id, name: 'Air Liquide', symbol: 'AI', assetClass: 'action', currency: 'EUR', mode: 'units' }
  const avh: Holding = { id: uid(), accountId: av.id, name: 'Assurance-vie Linxea Spirit 2', assetClass: 'assurance_vie', currency: 'EUR', mode: 'amount' }
  for (const h of [btc, eth, sol, cw8, ai, avh]) add('holdings', h)
  const op = (o: Omit<HoldingOp, 'id' | 'createdAt' | 'fees'> & { fees?: number }) => {
    if (o.date > todayStr) return
    add('ops', { id: uid(), createdAt: next(), fees: 0, ...o } as HoldingOp)
  }
  op({ holdingId: eth.id, kind: 'buy', date: startDate, quantity: 0.8, price: 2600 })
  op({ holdingId: sol.id, kind: 'buy', date: startDate, quantity: 12, price: 140 })
  op({ holdingId: ai.id, kind: 'buy', date: startDate, quantity: 10, price: 165, fees: 2 })
  op({ holdingId: avh.id, kind: 'buy', date: startDate, quantity: 0, price: 0, amount: 15000 })
  op({ holdingId: avh.id, kind: 'price', date: lastDayOf(addMonths(end, -1)), quantity: 0, price: 0, amount: 15930 })
  op({ holdingId: ai.id, kind: 'price', date: lastDayOf(addMonths(end, -1)), quantity: 0, price: 178.4 })
  op({ holdingId: ai.id, kind: 'income', date: dayInMonth(addMonths(end, -5), 20), quantity: 0, price: 0, amount: 32, cashAmount: 32 })

  let btcPrice = 78000
  let cwPrice = 29.4

  months.forEach((m, mi) => {
    const isCurrent = m === end
    // Flux fixes validés
    for (const { r, jitter } of recs) {
      if (r.frequency === 'quarterly' && mi % 3 !== 0) continue
      const amount = Math.round(r.amount * (1 + jitter * (rand() - 0.5) * 2) * 100) / 100
      tx({
        kind: r.kind,
        date: dayInMonth(m, r.day),
        amount: jitter ? amount : r.amount,
        accountId: r.accountId,
        label: r.label,
        category: r.category,
        counterparty: r.counterparty,
        employeeId: r.employeeId,
        scope: r.scope,
        recurringId: r.id,
        recurringPeriod: m,
      })
    }
    // Répartition mensuelle
    const date = dayInMonth(m, 2)
    if (date <= todayStr) {
      const groupId = uid()
      for (const l of split.lines) {
        const a = [courant, livret, binance, pea].find((x) => x.id === l.accountId)!
        tx({ kind: 'transfer', date, amount: l.amount, accountId: principal.id, toAccountId: l.accountId, label: `Répartition → ${a.name}`, scope: 'perso', groupId })
      }
      // Achats programmés
      btcPrice = btcPrice * (1 + (rand() - 0.42) * 0.14)
      cwPrice = cwPrice * (1 + (rand() - 0.4) * 0.05)
      const bp = Math.round(btcPrice)
      op({ holdingId: btc.id, kind: 'buy', date: dayInMonth(m, 3), quantity: +(198 / bp).toFixed(6), price: bp, fees: 2, cashAmount: -200 })
      const cp = Math.round(cwPrice * 100) / 100
      const q = Math.floor(250 / cp) || 0
      if (q > 0) op({ holdingId: cw8.id, kind: 'buy', date: dayInMonth(m, 4), quantity: q, price: cp, fees: 0.99, cashAmount: -(q * cp + 0.99) })
    }
    // Clôture du compte courant (mois passés)
    if (!isCurrent) {
      const remain = Math.round(180 + rand() * 320)
      tx({
        kind: 'checkpoint',
        date: lastDayOf(m),
        amount: 0,
        declaredBalance: remain,
        accountId: courant.id,
        label: 'Dépenses courantes',
        category: 'vie_courante',
        scope: 'perso',
      })
    }
  })
  op({ holdingId: cw8.id, kind: 'price', date: todayStr, quantity: 0, price: Math.round(cwPrice * 1.012 * 100) / 100 })

  const mAgo = (n: number, d: number) => dayInMonth(addMonths(end, -n), d)
  // Gros achats & ponctuels
  const macTx: Transaction = {
    id: uid(),
    kind: 'expense',
    date: mAgo(5, 14),
    amount: 2799,
    accountId: principal.id,
    label: 'MacBook Pro 16"',
    category: 'gros_achat',
    counterparty: 'Apple',
    scope: 'perso',
    createdAt: next(),
  }
  const mac: Asset = { id: uid(), name: 'MacBook Pro 16"', category: 'informatique', currency: 'EUR', purchaseValue: 2799, purchaseDate: macTx.date, currentValue: 2799, depreciationYears: 4, scope: 'perso', txId: macTx.id }
  macTx.assetId = mac.id
  add('transactions', macTx)
  add('assets', mac)
  add('assets', { id: uid(), name: 'Peugeot 3008', category: 'vehicule', currency: 'EUR', purchaseValue: 24000, purchaseDate: `${Number(end.slice(0, 4)) - 2}-03-15`, currentValue: 24000, depreciationYears: 8, scope: 'perso' } as Asset)
  add('assets', { id: uid(), name: 'Matériel vidéo agence', category: 'materiel_pro', currency: 'EUR', purchaseValue: 4200, purchaseDate: mAgo(7, 10), currentValue: 4200, depreciationYears: 5, scope: 'pro' } as Asset)
  const groupId = uid()
  tx({ kind: 'expense', date: mAgo(3, 9), amount: 1250, accountId: principal.id, label: 'Voyage au Japon', category: 'voyages', scope: 'perso', groupId })
  tx({ kind: 'expense', date: mAgo(3, 9), amount: 600, accountId: courant.id, label: 'Voyage au Japon', category: 'voyages', scope: 'perso', groupId })
  tx({ kind: 'expense', date: mAgo(4, 15), amount: 2400, accountId: principal.id, label: 'Impôt sur le revenu (solde)', category: 'impots', scope: 'perso', counterparty: 'DGFiP' })
  tx({ kind: 'income', date: mAgo(2, 12), amount: 6500, accountId: pro.id, label: 'Lancement de marque Éclat', category: 'facturation', scope: 'pro', counterparty: 'Éclat Cosmetics' })
  tx({ kind: 'income', date: mAgo(6, 22), amount: 2400, accountId: pro.id, label: 'Shooting campagne été', category: 'facturation', scope: 'pro', counterparty: 'Maison Lumen' })
  tx({ kind: 'expense', date: mAgo(1, 18), amount: 1200, accountId: pro.id, label: 'Vidéaste freelance', category: 'prestataires', scope: 'pro', counterparty: 'Tom Leroy' })
  tx({ kind: 'expense', date: mAgo(7, 10), amount: 4200, accountId: pro.id, label: 'Matériel vidéo', category: 'materiel', scope: 'pro' })
  tx({ kind: 'income', date: mAgo(4, 25), amount: 1500, accountId: wise.id, label: 'Mission client US', category: 'freelance', scope: 'perso', counterparty: 'Brightside LLC' })
  tx({ kind: 'expense', date: mAgo(1, 6), amount: 390, accountId: principal.id, label: 'Dentiste', category: 'sante', scope: 'perso' })
  tx({ kind: 'income', date: mAgo(0, 1) <= todayStr ? mAgo(0, 1) : mAgo(1, 28), amount: 3.2, accountId: livret.id, label: 'Intérêts Livret A', category: 'revenus_placements', scope: 'perso' })

  const loan: Liability = {
    id: uid(),
    name: 'Crédit Peugeot 3008',
    category: 'auto',
    currency: 'EUR',
    initialAmount: 15000,
    remaining: 7400,
    monthlyPayment: 320,
    rate: 3.9,
    startDate: `${Number(end.slice(0, 4)) - 2}-03-15`,
    endDate: `${Number(end.slice(0, 4)) + 2}-03-15`,
    scope: 'perso',
  }
  add('liabilities', loan)

  return items
}
