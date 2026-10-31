import { SUPABASE_KEY, SUPABASE_URL, supabase } from './supabase'

/** Cours de bourse (actions, ETF, fonds…) via la fonction Supabase `market`, qui relaie Yahoo Finance. */

export interface MarketQuote {
  price: number
  previous?: number
  currency: string
  time: number
  name: string
  exchange?: string
  type?: string
}

export interface MarketResult {
  symbol: string
  name: string
  exchange: string
  type: string
  typeLabel: string
}

// Les cryptos passent par CoinGecko, les indices et devises ne se détiennent pas.
const NOT_HOLDABLE = new Set(['CRYPTOCURRENCY', 'INDEX', 'CURRENCY', 'FUTURE', 'OPTION'])

const TYPE_LABELS: Record<string, string> = { EQUITY: 'Action', ETF: 'ETF', MUTUALFUND: 'Fonds', BOND: 'Obligation', MONEYMARKET: 'Monétaire' }
export const marketTypeLabel = (r: { type: string; typeLabel?: string }) => TYPE_LABELS[r.type] ?? r.typeLabel ?? r.type

async function callMarket<T>(params: string, timeout = 10000): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Connecte-toi pour avoir les cours en direct')
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeout)
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/market?${params}`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY },
      signal: ctl.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

export async function searchMarket(query: string): Promise<MarketResult[]> {
  const j = await callMarket<{ results?: MarketResult[] }>(`q=${encodeURIComponent(query)}`)
  return (j.results ?? []).filter((r) => !NOT_HOLDABLE.has(r.type)).slice(0, 10)
}

export async function fetchQuotes(symbols: string[]): Promise<Record<string, MarketQuote>> {
  if (!symbols.length) return {}
  const j = await callMarket<{ quotes?: Record<string, MarketQuote> }>(`symbols=${encodeURIComponent(symbols.join(','))}`)
  return j.quotes ?? {}
}

export async function fetchQuote(symbol: string): Promise<MarketQuote | undefined> {
  return (await fetchQuotes([symbol]))[symbol]
}
