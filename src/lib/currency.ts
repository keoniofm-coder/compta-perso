import { create } from 'zustand'

export interface CurrencyDef {
  code: string
  name: string
  symbol: string
  crypto?: boolean
  cryptoId?: string
  decimals: number
}

export const FIAT: CurrencyDef[] = [
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'USD', name: 'Dollar US', symbol: '$', decimals: 2 },
  { code: 'GBP', name: 'Livre sterling', symbol: '£', decimals: 2 },
  { code: 'CHF', name: 'Franc suisse', symbol: 'CHF', decimals: 2 },
  { code: 'CAD', name: 'Dollar canadien', symbol: 'CA$', decimals: 2 },
  { code: 'AUD', name: 'Dollar australien', symbol: 'A$', decimals: 2 },
  { code: 'XPF', name: 'Franc pacifique', symbol: 'F', decimals: 0 },
  { code: 'MAD', name: 'Dirham marocain', symbol: 'MAD', decimals: 2 },
  { code: 'AED', name: 'Dirham émirati', symbol: 'AED', decimals: 2 },
  { code: 'JPY', name: 'Yen', symbol: '¥', decimals: 0 },
  { code: 'CNY', name: 'Yuan', symbol: 'CN¥', decimals: 2 },
  { code: 'SGD', name: 'Dollar de Singapour', symbol: 'S$', decimals: 2 },
  { code: 'THB', name: 'Baht', symbol: '฿', decimals: 2 },
  { code: 'BRL', name: 'Real brésilien', symbol: 'R$', decimals: 2 },
  { code: 'XOF', name: 'Franc CFA (BCEAO)', symbol: 'FCFA', decimals: 0 },
]

export const CRYPTO: CurrencyDef[] = [
  { code: 'BTC', name: 'Bitcoin', symbol: '₿', crypto: true, cryptoId: 'bitcoin', decimals: 8 },
  { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', crypto: true, cryptoId: 'ethereum', decimals: 6 },
  { code: 'USDT', name: 'Tether', symbol: 'USDT', crypto: true, cryptoId: 'tether', decimals: 2 },
  { code: 'USDC', name: 'USD Coin', symbol: 'USDC', crypto: true, cryptoId: 'usd-coin', decimals: 2 },
  { code: 'SOL', name: 'Solana', symbol: 'SOL', crypto: true, cryptoId: 'solana', decimals: 4 },
  { code: 'BNB', name: 'BNB', symbol: 'BNB', crypto: true, cryptoId: 'binancecoin', decimals: 4 },
  { code: 'XRP', name: 'XRP', symbol: 'XRP', crypto: true, cryptoId: 'ripple', decimals: 2 },
  { code: 'ADA', name: 'Cardano', symbol: 'ADA', crypto: true, cryptoId: 'cardano', decimals: 2 },
  { code: 'DOGE', name: 'Dogecoin', symbol: 'DOGE', crypto: true, cryptoId: 'dogecoin', decimals: 2 },
  { code: 'DOT', name: 'Polkadot', symbol: 'DOT', crypto: true, cryptoId: 'polkadot', decimals: 3 },
  { code: 'AVAX', name: 'Avalanche', symbol: 'AVAX', crypto: true, cryptoId: 'avalanche-2', decimals: 3 },
  { code: 'LINK', name: 'Chainlink', symbol: 'LINK', crypto: true, cryptoId: 'chainlink', decimals: 3 },
  { code: 'MATIC', name: 'Polygon', symbol: 'POL', crypto: true, cryptoId: 'polygon-ecosystem-token', decimals: 2 },
  { code: 'TRX', name: 'Tron', symbol: 'TRX', crypto: true, cryptoId: 'tron', decimals: 2 },
]

const XPF_PER_EUR = 119.33174
const XOF_PER_EUR = 655.957

let customCryptos: CurrencyDef[] = []
export function setCustomCryptos(list: { symbol: string; id: string; name: string }[] = []) {
  customCryptos = list
    .filter((c) => !CRYPTO.some((k) => k.code === c.symbol.toUpperCase()))
    .map((c) => ({ code: c.symbol.toUpperCase(), name: c.name, symbol: c.symbol.toUpperCase(), crypto: true, cryptoId: c.id, decimals: 6 }))
}

export const allCurrencies = () => [...FIAT, ...CRYPTO, ...customCryptos]

export function currencyDef(code: string): CurrencyDef {
  return allCurrencies().find((c) => c.code === code) ?? { code, name: code, symbol: code, decimals: 2 }
}

export const isCrypto = (code: string) => !!currencyDef(code).crypto

/* ---------------- Formatage ---------------- */

const nfCache = new Map<string, Intl.NumberFormat>()
function nf(key: string, opts: Intl.NumberFormatOptions) {
  let f = nfCache.get(key)
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', opts)
    nfCache.set(key, f)
  }
  return f
}

export function formatMoney(
  value: number,
  currency: string,
  opts: { compact?: boolean; sign?: boolean; decimals?: number } = {},
) {
  const def = currencyDef(currency)
  const v = Number.isFinite(value) ? value : 0
  const signDisplay = opts.sign ? 'exceptZero' : 'auto'
  if (def.crypto) {
    const abs = Math.abs(v)
    const dec = opts.decimals ?? (abs >= 1000 ? 2 : abs >= 1 ? Math.min(4, def.decimals) : def.decimals)
    const s = nf(`c${dec}${signDisplay}`, { maximumFractionDigits: dec, minimumFractionDigits: 0, signDisplay }).format(v)
    return `${s} ${def.symbol}`
  }
  if (opts.compact && Math.abs(v) >= 10000) {
    return nf(`k${currency}${signDisplay}`, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
      signDisplay,
    }).format(v)
  }
  const dec = opts.decimals ?? def.decimals
  try {
    return nf(`f${currency}${dec}${signDisplay}`, {
      style: 'currency',
      currency,
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
      signDisplay,
    }).format(v)
  } catch {
    return `${nf(`n${dec}`, { maximumFractionDigits: dec }).format(v)} ${def.symbol}`
  }
}

export function formatNumber(v: number, max = 2) {
  return nf(`num${max}`, { maximumFractionDigits: max }).format(v)
}

export function formatPct(v: number, sign = true) {
  if (!Number.isFinite(v)) return '—'
  return nf(`pct${sign}`, { style: 'percent', maximumFractionDigits: 1, signDisplay: sign ? 'exceptZero' : 'auto' }).format(v)
}

/** Accepte "1 234,56", "1234.56", "1.234,56"… */
export function parseAmount(input: string | number | undefined | null): number {
  if (typeof input === 'number') return input
  if (!input) return 0
  let s = String(input).replace(/[\s  €$£]/g, '')
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else {
    s = s.replace(',', '.')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/* ---------------- Taux de change ---------------- */

/** Valeur de 1 unité de la devise, en EUR. */
export type Rates = Record<string, number>

const FALLBACK_FIAT: Rates = {
  EUR: 1,
  USD: 0.86,
  GBP: 1.15,
  CHF: 1.07,
  CAD: 0.62,
  AUD: 0.56,
  JPY: 0.0058,
  CNY: 0.12,
  SGD: 0.66,
  THB: 0.026,
  BRL: 0.16,
  MAD: 0.093,
  AED: 0.234,
  XPF: 1 / XPF_PER_EUR,
  XOF: 1 / XOF_PER_EUR,
}

interface RatesState {
  rates: Rates
  fetchedAt: number
  loading: boolean
  error?: string
  overrides: Rates
  setOverrides: (o: Rates) => void
  refresh: (force?: boolean) => Promise<void>
}

const RATES_KEY = 'trezo:rates:v1'

function loadCachedRates(): { rates: Rates; fetchedAt: number } {
  try {
    const raw = localStorage.getItem(RATES_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { rates: { ...FALLBACK_FIAT }, fetchedAt: 0 }
}

async function fetchJSON(url: string, timeout = 8000) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeout)
  try {
    const r = await fetch(url, { signal: ctl.signal })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.json()
  } finally {
    clearTimeout(t)
  }
}

async function fetchFiat(): Promise<Rates> {
  const sources = [
    'https://api.frankfurter.dev/v1/latest?base=EUR',
    'https://api.frankfurter.app/latest?from=EUR',
    'https://open.er-api.com/v6/latest/EUR',
  ]
  for (const url of sources) {
    try {
      const j = await fetchJSON(url)
      const perEur: Record<string, number> = j.rates
      if (!perEur) continue
      const out: Rates = { EUR: 1 }
      for (const [k, v] of Object.entries(perEur)) if (v > 0) out[k] = 1 / v
      out.XPF = 1 / XPF_PER_EUR
      out.XOF = 1 / XOF_PER_EUR
      // Les sources BCE n'ont pas toutes les devises : on complète avec la seconde source si besoin.
      if (!out.AED || !out.MAD) {
        try {
          const j2 = await fetchJSON('https://open.er-api.com/v6/latest/EUR')
          for (const [k, v] of Object.entries(j2.rates as Record<string, number>)) if (!out[k] && v > 0) out[k] = 1 / v
        } catch {
          /* ignore */
        }
      }
      return out
    } catch {
      /* source suivante */
    }
  }
  throw new Error('Taux de change indisponibles')
}

async function fetchCrypto(ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {}
  const j = await fetchJSON(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=eur`,
  )
  const out: Record<string, number> = {}
  for (const id of ids) if (j[id]?.eur) out[id] = j[id].eur
  return out
}

let extraCryptoIds: string[] = []
export function registerCryptoIds(ids: string[]) {
  extraCryptoIds = Array.from(new Set(ids.filter(Boolean)))
}

export const useRates = create<RatesState>((set, get) => {
  const cached = loadCachedRates()
  return {
    rates: { ...FALLBACK_FIAT, ...cached.rates },
    fetchedAt: cached.fetchedAt,
    loading: false,
    overrides: {},
    setOverrides: (overrides) => set({ overrides }),
    refresh: async (force = false) => {
      const { fetchedAt, loading } = get()
      if (loading) return
      if (!force && Date.now() - fetchedAt < 30 * 60 * 1000) return
      set({ loading: true, error: undefined })
      const next: Rates = { ...get().rates }
      let ok = false
      try {
        Object.assign(next, await fetchFiat())
        ok = true
      } catch (e) {
        set({ error: (e as Error).message })
      }
      try {
        const defs = allCurrencies().filter((c) => c.crypto && c.cryptoId)
        const ids = Array.from(new Set([...defs.map((c) => c.cryptoId!), ...extraCryptoIds]))
        const prices = await fetchCrypto(ids)
        for (const d of defs) if (prices[d.cryptoId!]) next[d.code] = prices[d.cryptoId!]
        for (const [id, p] of Object.entries(prices)) next[`cg:${id}`] = p
        ok = true
      } catch {
        set({ error: 'Cours crypto indisponibles pour le moment' })
      }
      const at = ok ? Date.now() : get().fetchedAt
      set({ rates: next, fetchedAt: at, loading: false })
      try {
        localStorage.setItem(RATES_KEY, JSON.stringify({ rates: next, fetchedAt: at }))
      } catch {
        /* ignore */
      }
    },
  }
})

/** Taux effectif (EUR par unité), en tenant compte des taux forcés à la main. */
export function rateOf(code: string, rates: Rates, overrides: Rates): number | undefined {
  if (overrides[code] && overrides[code] > 0) return overrides[code]
  return rates[code]
}

export function makeConverter(rates: Rates, overrides: Rates, base: string) {
  const baseRate = rateOf(base, rates, overrides) ?? 1
  return (amount: number, from: string, to: string = base) => {
    if (!amount) return 0
    if (from === to) return amount
    const rf = rateOf(from, rates, overrides)
    const rt = to === base ? baseRate : rateOf(to, rates, overrides)
    if (!rf || !rt) return 0
    return (amount * rf) / rt
  }
}

export type Converter = ReturnType<typeof makeConverter>

export async function searchCrypto(query: string) {
  const j = await fetchJSON(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`)
  return ((j.coins ?? []) as { id: string; name: string; symbol: string; thumb: string; market_cap_rank?: number }[]).slice(0, 8)
}

export async function fetchCryptoPrice(id: string) {
  const p = await fetchCrypto([id])
  return p[id]
}
