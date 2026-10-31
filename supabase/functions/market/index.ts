// Cours de bourse (actions, ETF, fonds, indices…) via Yahoo Finance, relayés côté serveur
// car Yahoo n'autorise pas les appels directs depuis un navigateur (CORS).
//   GET ?q=micro           → recherche par nom, ticker ou ISIN
//   GET ?symbols=MSTR,AI.PA → derniers cours

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

// Yahoo cote certaines places en sous-unités (pence, cents…).
const SUB_UNITS: Record<string, [string, number]> = { GBp: ['GBP', 100], GBX: ['GBP', 100], ZAc: ['ZAR', 100], ILA: ['ILS', 100] }

const SYMBOL_RE = /^[A-Za-z0-9.\-=^]{1,24}$/

function json(body: unknown, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-store' },
  })
}

async function yahoo(path: string) {
  let last = ''
  for (const host of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com${path}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
      if (r.ok) return await r.json()
      last = `HTTP ${r.status}`
    } catch (e) {
      last = String(e)
    }
  }
  throw new Error(`Yahoo indisponible (${last})`)
}

async function quote(symbol: string) {
  const j = await yahoo(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`)
  const m = j?.chart?.result?.[0]?.meta
  if (!m || typeof m.regularMarketPrice !== 'number') return null
  let price: number = m.regularMarketPrice
  let previous: number | undefined = m.chartPreviousClose ?? m.previousClose
  let currency: string = m.currency ?? 'USD'
  const sub = SUB_UNITS[currency]
  if (sub) {
    currency = sub[0]
    price /= sub[1]
    if (previous) previous /= sub[1]
  }
  return {
    price,
    previous,
    currency,
    time: m.regularMarketTime ? m.regularMarketTime * 1000 : Date.now(),
    name: m.longName ?? m.shortName ?? symbol,
    exchange: m.fullExchangeName ?? m.exchangeName,
    type: m.instrumentType,
  }
}

async function search(q: string) {
  // La recherche Yahoo trouve mal les tickers seuls (« mstr ») : on tente aussi le cours direct.
  const ticker = q.toUpperCase()
  const [found, direct] = await Promise.all([
    yahoo(`/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&listsCount=0&lang=fr-FR&region=FR`).catch(() => null),
    SYMBOL_RE.test(q) ? quote(ticker).catch(() => null) : Promise.resolve(null),
  ])
  const quotes: Record<string, unknown>[] = found?.quotes ?? []
  const results = quotes
    .filter((x) => typeof x.symbol === 'string' && !['OPTION', 'FUTURE'].includes(String(x.quoteType)))
    .map((x) => ({
      symbol: x.symbol as string,
      name: (x.longname ?? x.shortname ?? x.symbol) as string,
      exchange: (x.exchDisp ?? x.exchange ?? '') as string,
      type: (x.quoteType ?? '') as string,
      typeLabel: (x.typeDisp ?? '') as string,
    }))
  if (direct && !results.some((r) => r.symbol === ticker)) {
    results.unshift({ symbol: ticker, name: direct.name, exchange: direct.exchange ?? '', type: direct.type ?? '', typeLabel: '' })
  }
  return results
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  try {
    const q = url.searchParams.get('q')?.trim()
    if (q) {
      if (q.length > 60) return json({ error: 'Recherche trop longue' }, 400)
      return json({ results: await search(q) }, 200, 300)
    }
    const symbols = Array.from(new Set((url.searchParams.get('symbols') ?? '').split(',').map((s) => s.trim()).filter((s) => SYMBOL_RE.test(s)))).slice(0, 40)
    if (symbols.length) {
      const entries = await Promise.all(symbols.map(async (s) => [s, await quote(s).catch(() => null)] as const))
      return json({ quotes: Object.fromEntries(entries.filter(([, v]) => v)) }, 200, 60)
    }
    return json({ error: 'Paramètre q ou symbols requis' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 502)
  }
})
