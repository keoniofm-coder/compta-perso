import { useEffect, useState } from 'react'
import { Link2Off, Loader2, Search, Trash2, Zap } from 'lucide-react'
import { AccountSelect } from '../components/common'
import { AmountInput, Button, Field, Input, Modal, Segmented, Switch, cx } from '../components/ui'
import { replayHolding, useDerived } from '../lib/calc'
import { CRYPTO, fetchCryptoPrice, formatMoney, formatNumber, parseAmount, registerCryptoIds, registerQuoteSymbols, searchCrypto, useRates } from '../lib/currency'
import { fetchQuote, marketTypeLabel, searchMarket, type MarketQuote, type MarketResult } from '../lib/market'
import { today } from '../lib/dates'
import { ASSET_CLASS_ORDER, ASSET_CLASSES } from '../lib/meta'
import { uid, useData } from '../lib/store'
import type { AssetClass, Holding, HoldingOp, HoldingOpKind } from '../lib/types'
import { confirm, toast } from '../lib/ui'
import { CurrencySelect } from './AccountForms'
import { ccy, useActiveAccounts } from './shared'

const AMOUNT_CLASSES: AssetClass[] = ['assurance_vie', 'livret', 'scpi', 'immobilier', 'private_equity', 'fonds']

function CryptoSearch({ onPick }: { onPick: (c: { id: string; symbol: string; name: string }) => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<{ id: string; name: string; symbol: string; thumb: string }[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (q.trim().length < 2) {
      setRes([])
      return
    }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        setRes(await searchCrypto(q.trim()))
      } catch {
        setRes([])
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {CRYPTO.slice(0, 8).map((c) => (
          <button key={c.code} type="button" onClick={() => onPick({ id: c.cryptoId!, symbol: c.code, name: c.name })} className="h-8 px-3 rounded-full border border-line-strong text-[12.5px] font-semibold text-ink-2 hover:text-ink hover:border-amber-400">
            {c.code}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="size-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <Input className="pl-9" placeholder="Rechercher une autre crypto (ex. Pepe, Sui…)" value={q} onChange={(e) => setQ(e.target.value)} />
        {loading && <Loader2 className="size-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />}
      </div>
      {res.length > 0 && (
        <div className="rounded-xl border border-line divide-y divide-line max-h-56 overflow-y-auto">
          {res.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onPick({ id: c.id, symbol: c.symbol.toUpperCase(), name: c.name })
                setQ('')
                setRes([])
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-2 text-left"
            >
              <img src={c.thumb} alt="" className="size-6 rounded-full" />
              <span className="text-sm font-medium text-ink">{c.name}</span>
              <span className="text-xs text-muted">{c.symbol.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MarketSearch({ onPick }: { onPick: (r: MarketResult) => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<MarketResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setError('')
    if (q.trim().length < 2) {
      setRes([])
      return
    }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await searchMarket(q.trim())
        setRes(r)
        if (!r.length) setError('Aucun résultat. Essaie le ticker (ex. MSTR, CW8) ou le code ISIN.')
      } catch (e) {
        setRes([])
        setError((e as Error).message.startsWith('Connecte') ? (e as Error).message : 'Recherche indisponible pour le moment')
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="size-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <Input className="pl-9" placeholder="Rechercher : nom, ticker ou ISIN (ex. Strategy, MSTR, CW8…)" value={q} onChange={(e) => setQ(e.target.value)} />
        {loading && <Loader2 className="size-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />}
      </div>
      {error && <p className="text-xs text-muted">{error}</p>}
      {res.length > 0 && (
        <div className="rounded-xl border border-line divide-y divide-line max-h-64 overflow-y-auto">
          {res.map((r) => (
            <button
              key={r.symbol}
              type="button"
              onClick={() => {
                onPick(r)
                setQ('')
                setRes([])
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink truncate">{r.name}</span>
                <span className="block text-xs text-muted truncate">
                  {r.symbol} · {r.exchange}
                </span>
              </span>
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted">{marketTypeLabel(r)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function HoldingForm({ onClose, id, accountId: acc0 }: { onClose: () => void; id?: string; accountId?: string }) {
  const d = useDerived()
  const accounts = useActiveAccounts()
  const refreshRates = useRates((s) => s.refresh)
  const existing = id ? d.db.holdings[id] : undefined
  const defaultAcc = acc0 ?? accounts.find((a) => a.type === 'invest')?.id ?? accounts.find((a) => a.type === 'crypto')?.id ?? accounts[0]?.id ?? ''
  const [accountId, setAccountId] = useState(existing?.accountId ?? defaultAcc)
  const acc = d.db.accounts[accountId]
  const [assetClass, setAssetClass] = useState<AssetClass>(existing?.assetClass ?? (acc?.type === 'crypto' ? 'crypto' : 'etf'))
  const [mode, setMode] = useState<Holding['mode']>(existing?.mode ?? 'units')
  const [name, setName] = useState(existing?.name ?? '')
  const [symbol, setSymbol] = useState(existing?.symbol ?? '')
  const [currency, setCurrency] = useState(existing?.currency ?? (acc && acc.currency.length === 3 && !CRYPTO.some((c) => c.code === acc.currency) ? acc.currency : d.base))
  const [cryptoId, setCryptoId] = useState(existing?.cryptoId ?? '')
  const [quoteSymbol, setQuoteSymbol] = useState(existing?.quoteSymbol ?? '')
  const [quote, setQuote] = useState<(MarketQuote & { symbol: string }) | undefined>()
  const [autoPrice, setAutoPrice] = useState(existing?.autoPrice ?? true)
  const [note, setNote] = useState(existing?.note ?? '')
  const [archived, setArchived] = useState(!!existing?.archived)
  // Opération initiale
  const [date, setDate] = useState(today())
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [amount, setAmount] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [fees, setFees] = useState('')
  const [cashImpact, setCashImpact] = useState(false)
  const [error, setError] = useState('')

  const pickCrypto = async (c: { id: string; symbol: string; name: string }) => {
    setName(c.name)
    setSymbol(c.symbol)
    setCryptoId(c.id)
    setAutoPrice(true)
    if (!price) {
      try {
        const p = await fetchCryptoPrice(c.id)
        if (p) setPrice(String(+d.convert(p, 'EUR', currency).toFixed(p > 1 ? 2 : 6)).replace('.', ','))
      } catch {
        /* ignore */
      }
    }
  }

  // Cours de l'actif lié, pour l'aperçu (valeur exacte, devise de cotation).
  useEffect(() => {
    if (!quoteSymbol) return setQuote(undefined)
    let alive = true
    fetchQuote(quoteSymbol)
      .then((q) => alive && setQuote(q ? { ...q, symbol: quoteSymbol } : undefined))
      .catch(() => alive && setQuote(undefined))
    return () => {
      alive = false
    }
  }, [quoteSymbol])

  const pickMarket = async (r: MarketResult) => {
    if (!existing || !name.trim()) setName(r.name)
    setSymbol(r.symbol.split('.')[0])
    setQuoteSymbol(r.symbol)
    setAutoPrice(true)
    if (!existing && (r.type === 'ETF' || r.type === 'EQUITY' || r.type === 'MUTUALFUND')) setAssetClass(r.type === 'ETF' ? 'etf' : r.type === 'MUTUALFUND' ? 'fonds' : 'action')
    if (!existing) setMode('units')
    if (!existing && !price) {
      try {
        const q = await fetchQuote(r.symbol)
        if (q) {
          const p = d.convert(q.price, q.currency, currency)
          if (p) setPrice(String(+p.toFixed(p > 1 ? 2 : 4)).replace('.', ','))
        }
      } catch {
        /* ignore */
      }
    }
  }

  const save = () => {
    if (!accountId) return setError('Choisis le compte qui détient ce placement')
    if (!name.trim()) return setError('Donne un nom au placement')
    const h: Holding = {
      ...(existing ?? {}),
      id: existing?.id ?? uid(),
      accountId,
      name: name.trim(),
      symbol: symbol.trim().toUpperCase() || undefined,
      assetClass,
      currency,
      mode,
      cryptoId: assetClass === 'crypto' && cryptoId ? cryptoId : undefined,
      quoteSymbol: assetClass !== 'crypto' && mode === 'units' && quoteSymbol ? quoteSymbol : undefined,
      autoPrice: (assetClass === 'crypto' && cryptoId) || (assetClass !== 'crypto' && mode === 'units' && quoteSymbol) ? autoPrice : undefined,
      note: note.trim() || undefined,
      archived: archived || undefined,
    }
    const items: { collection: 'holdings' | 'ops'; item: Holding | HoldingOp }[] = [{ collection: 'holdings', item: h }]
    if (!existing) {
      const now = Date.now()
      if (mode === 'units' && parseAmount(qty) > 0) {
        const q = parseAmount(qty)
        const p = parseAmount(price)
        const f = parseAmount(fees)
        items.push({
          collection: 'ops',
          item: {
            id: uid(),
            holdingId: h.id,
            kind: 'buy',
            date,
            quantity: q,
            price: p,
            fees: f,
            cashAmount: cashImpact ? -d.convert(q * p + f, currency, acc.currency) : undefined,
            createdAt: now,
          },
        })
      } else if (mode === 'amount' && parseAmount(amount) > 0) {
        const a = parseAmount(amount)
        const f = parseAmount(fees)
        items.push({
          collection: 'ops',
          item: { id: uid(), holdingId: h.id, kind: 'buy', date, quantity: 0, price: 0, fees: f, amount: a, cashAmount: cashImpact ? -d.convert(a, currency, acc.currency) : undefined, createdAt: now },
        })
        const cv = parseAmount(currentValue)
        if (cv > 0 && Math.abs(cv - (a - f)) > 0.005) {
          items.push({ collection: 'ops', item: { id: uid(), holdingId: h.id, kind: 'price', date: today(), quantity: 0, price: 0, fees: 0, amount: cv, createdAt: now + 1 } })
        }
      }
    }
    useData.getState().putMany(items)
    if (h.cryptoId || h.quoteSymbol) {
      const all = [...Object.values(d.db.holdings).filter((x) => x.id !== h.id), h]
      registerCryptoIds(all.map((x) => x.cryptoId ?? ''))
      registerQuoteSymbols(all.map((x) => (x.autoPrice && !x.archived && x.quoteSymbol) || ''))
      void refreshRates(true)
    }
    toast(existing ? 'Placement mis à jour' : 'Placement ajouté')
    onClose()
  }

  const del = async () => {
    if (!existing) return
    const ok = await confirm({ title: `Supprimer « ${existing.name} » ?`, message: 'Toutes ses opérations seront supprimées.', confirmLabel: 'Supprimer', danger: true })
    if (!ok) return
    const ops = Object.values(d.db.ops).filter((o) => o.holdingId === existing.id)
    useData.getState().removeMany([{ collection: 'holdings', id: existing.id }, ...ops.map((o) => ({ collection: 'ops' as const, id: o.id }))])
    onClose()
  }

  return (
    <Modal
      title={existing ? 'Modifier le placement' : 'Nouveau placement'}
      subtitle="Action, ETF, crypto, assurance-vie, SCPI…"
      onClose={onClose}
      footer={
        <>
          {existing && <Button variant="ghost" icon={Trash2} className="mr-auto text-rose-600" onClick={del}>Supprimer</Button>}
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={save}>{existing ? 'Enregistrer' : 'Ajouter'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="text-[13px] font-medium text-ink-2 mb-2">Type de placement</div>
          <div className="flex flex-wrap gap-1.5">
            {ASSET_CLASS_ORDER.map((c) => {
              const m = ASSET_CLASSES[c]
              const active = assetClass === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setAssetClass(c)
                    if (!existing) setMode(AMOUNT_CLASSES.includes(c) ? 'amount' : 'units')
                  }}
                  className={cx('h-9 px-3 rounded-full text-[12.5px] font-medium border inline-flex items-center gap-1.5 transition', active ? 'brand-gradient text-white border-transparent shadow' : 'border-line-strong text-ink-2 hover:text-ink')}
                >
                  <m.icon className="size-3.5" /> {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {assetClass === 'crypto' && !existing && <CryptoSearch onPick={pickCrypto} />}
        {assetClass !== 'crypto' && mode === 'units' && !quoteSymbol && <MarketSearch onPick={pickMarket} />}
        {assetClass !== 'crypto' && mode === 'units' && quoteSymbol && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 flex items-center gap-3">
            <span className="size-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Zap className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink truncate">
                {quoteSymbol}
                {quote?.exchange ? <span className="font-normal text-muted"> · {quote.exchange}</span> : null}
              </div>
              <div className="text-xs text-muted">
                {quote ? (
                  <>
                    Cours : <b className="text-ink">{formatMoney(quote.price, quote.currency)}</b>
                    {quote.currency !== currency && d.convert(quote.price, quote.currency, currency) ? ` ≈ ${formatMoney(d.convert(quote.price, quote.currency, currency), currency)}` : ''}
                  </>
                ) : (
                  'Cours en direct'
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" icon={Link2Off} onClick={() => setQuoteSymbol('')}>
              Délier
            </Button>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nom">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={assetClass === 'etf' ? 'MSCI World' : assetClass === 'crypto' ? 'Bitcoin' : assetClass === 'assurance_vie' ? 'Assurance-vie Linxea' : 'Nom'} />
          </Field>
          <Field label="Symbole / ticker" hint="Optionnel">
            <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="CW8, AI, BTC…" />
          </Field>
          <Field label="Détenu sur le compte">
            <AccountSelect value={accountId} onChange={setAccountId} accounts={accounts} />
          </Field>
          <Field label="Devise de cotation">
            <CurrencySelect value={currency} onChange={setCurrency} />
          </Field>
        </div>

        <Field label="Suivi">
          <Segmented
            className="w-full"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'units', label: 'Quantité × cours' },
              { value: 'amount', label: 'Versements + valeur' },
            ]}
          />
          <span className="block text-xs text-muted mt-1.5">
            {mode === 'units' ? 'Pour les actions, ETF, cryptos : tu saisis des quantités et un prix unitaire.' : 'Pour assurance-vie, SCPI, livrets… : tu saisis des versements et mets à jour la valeur de temps en temps.'}
          </span>
        </Field>

        {assetClass === 'crypto' && cryptoId && mode === 'units' && (
          <Switch checked={autoPrice} onChange={setAutoPrice} label="Cours en direct" hint={`Mis à jour automatiquement (CoinGecko : ${cryptoId})`} />
        )}
        {assetClass !== 'crypto' && quoteSymbol && mode === 'units' && (
          <Switch checked={autoPrice} onChange={setAutoPrice} label="Cours en direct" hint={`Mis à jour automatiquement (${quoteSymbol}${quote && quote.currency !== currency ? `, coté en ${quote.currency} et converti en ${currency}` : ''})`} />
        )}

        {!existing && (
          <div className="rounded-2xl border border-line bg-surface-2 p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">Ce que tu possèdes déjà</div>
            {mode === 'units' ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantité">
                  <AmountInput value={qty} onChange={setQty} />
                </Field>
                <Field label="Prix d'achat unitaire (PRU)">
                  <AmountInput value={price} onChange={setPrice} currency={ccy(currency)} />
                </Field>
                <Field label="Frais" hint="Optionnel">
                  <AmountInput value={fees} onChange={setFees} currency={ccy(currency)} />
                </Field>
                <Field label="Date d'achat">
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                {parseAmount(qty) > 0 && parseAmount(price) > 0 && (
                  <div className="col-span-2 text-sm text-ink-2">
                    Montant investi : <b className="text-ink">{formatMoney(parseAmount(qty) * parseAmount(price) + parseAmount(fees), currency)}</b>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Total versé">
                  <AmountInput value={amount} onChange={setAmount} currency={ccy(currency)} />
                </Field>
                <Field label="Valeur actuelle" hint="Si différente">
                  <AmountInput value={currentValue} onChange={setCurrentValue} currency={ccy(currency)} />
                </Field>
                <Field label="Frais d'entrée" hint="Optionnel">
                  <AmountInput value={fees} onChange={setFees} currency={ccy(currency)} />
                </Field>
                <Field label="Date du 1er versement">
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
              </div>
            )}
            <Switch checked={cashImpact} onChange={setCashImpact} label="Débiter les espèces du compte" hint="À activer si l'argent de cet achat est déjà compté dans le solde du compte." />
          </div>
        )}

        {existing && <Switch checked={archived} onChange={setArchived} label="Archiver (position soldée)" />}
        <Field label="Note" hint="Optionnel">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error && <div className="text-sm font-medium text-neg">{error}</div>}
      </div>
    </Modal>
  )
}

const OP_LABELS: Record<HoldingOpKind, string> = { buy: 'Achat', sell: 'Vente', income: 'Revenu', price: 'Cours' }

export function OpForm({ onClose, holdingId, id, kind: kind0 }: { onClose: () => void; holdingId: string; id?: string; kind?: string }) {
  const d = useDerived()
  const hs = d.holdingById.get(holdingId)
  const existing = id ? d.db.ops[id] : undefined
  const h = hs?.holding
  const acc = h ? d.db.accounts[h.accountId] : undefined
  const [kind, setKind] = useState<HoldingOpKind>(existing?.kind ?? (kind0 as HoldingOpKind) ?? 'buy')
  const [date, setDate] = useState(existing?.date ?? today())
  const [qty, setQty] = useState(existing ? String(existing.quantity).replace('.', ',') : '')
  const [price, setPrice] = useState(existing ? String(existing.price).replace('.', ',') : hs?.price ? String(+hs.price.toFixed(hs.price > 1 ? 2 : 6)).replace('.', ',') : '')
  const [amount, setAmount] = useState(existing?.amount != null ? String(existing.amount).replace('.', ',') : '')
  const [fees, setFees] = useState(existing?.fees ? String(existing.fees).replace('.', ',') : '')
  const [cashImpact, setCashImpact] = useState(existing ? existing.cashAmount != null : kind0 !== 'price')
  const [note, setNote] = useState(existing?.note ?? '')
  if (!hs || !h || !acc) return null
  const isAmount = h.mode === 'amount'

  const cashOf = (): number | undefined => {
    if (!cashImpact || kind === 'price') return undefined
    const f = parseAmount(fees)
    let v = 0
    if (isAmount || kind === 'income') {
      const a = parseAmount(amount)
      v = kind === 'buy' ? -a : kind === 'sell' ? a - f : a
    } else {
      const total = parseAmount(qty) * parseAmount(price)
      v = kind === 'buy' ? -(total + f) : total - f
    }
    return d.convert(v, h.currency, acc.currency)
  }

  const save = () => {
    const op: HoldingOp = {
      ...(existing ?? {}),
      id: existing?.id ?? uid(),
      holdingId,
      kind,
      date,
      quantity: isAmount || kind === 'income' ? 0 : parseAmount(qty),
      price: isAmount || kind === 'income' ? 0 : parseAmount(price),
      fees: parseAmount(fees),
      amount: isAmount || kind === 'income' ? parseAmount(amount) : undefined,
      cashAmount: cashOf(),
      note: note.trim() || undefined,
      createdAt: existing?.createdAt ?? Date.now(),
    }
    if (kind === 'price' ? !(isAmount ? op.amount! > 0 : op.price > 0) : isAmount || kind === 'income' ? !(op.amount! > 0) : !(op.quantity > 0)) return
    useData.getState().put('ops', op)
    toast('Opération enregistrée')
    onClose()
  }

  const del = async () => {
    if (!existing) return
    if (!(await confirm({ title: 'Supprimer cette opération ?', confirmLabel: 'Supprimer', danger: true }))) return
    useData.getState().remove('ops', existing.id)
    onClose()
  }

  const before = replayHolding(h, hs.ops.filter((o) => o.id !== existing?.id), date)

  return (
    <Modal
      title={existing ? "Modifier l'opération" : 'Nouvelle opération'}
      subtitle={`${h.name} · ${acc.name}`}
      onClose={onClose}
      footer={
        <>
          {existing && <Button variant="ghost" icon={Trash2} className="mr-auto text-rose-600" onClick={del}>Supprimer</Button>}
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Segmented
          className="w-full"
          value={kind}
          onChange={(k) => {
            setKind(k)
            setCashImpact(k !== 'price')
          }}
          options={(['buy', 'sell', 'income', 'price'] as HoldingOpKind[]).map((k) => ({
            value: k,
            label: isAmount ? { buy: 'Versement', sell: 'Retrait', income: 'Revenu', price: 'Valeur' }[k] : OP_LABELS[k],
          }))}
        />
        <div className="grid grid-cols-2 gap-3">
          {isAmount || kind === 'income' ? (
            <Field label={kind === 'price' ? 'Valeur totale actuelle' : kind === 'income' ? 'Montant reçu (dividende, intérêts, loyer…)' : 'Montant'} className="col-span-2">
              <AmountInput big autoFocus value={amount} onChange={setAmount} currency={ccy(h.currency)} />
            </Field>
          ) : kind === 'price' ? (
            <Field label="Cours actuel (prix unitaire)" className="col-span-2">
              <AmountInput big autoFocus value={price} onChange={setPrice} currency={ccy(h.currency)} />
            </Field>
          ) : (
            <>
              <Field label="Quantité" hint={kind === 'sell' ? `Détenu : ${formatNumber(before.qty, 8)}` : undefined}>
                <AmountInput autoFocus value={qty} onChange={setQty} />
              </Field>
              <Field label="Prix unitaire">
                <AmountInput value={price} onChange={setPrice} currency={ccy(h.currency)} />
              </Field>
            </>
          )}
          {(kind === 'buy' || kind === 'sell') && (
            <Field label="Frais" hint="Optionnel">
              <AmountInput value={fees} onChange={setFees} currency={ccy(h.currency)} />
            </Field>
          )}
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        {!isAmount && (kind === 'buy' || kind === 'sell') && parseAmount(qty) > 0 && parseAmount(price) > 0 && (
          <div className="text-sm text-ink-2">
            Total : <b className="text-ink">{formatMoney(parseAmount(qty) * parseAmount(price) + (kind === 'buy' ? 1 : -1) * parseAmount(fees), h.currency)}</b>
          </div>
        )}
        {kind !== 'price' && (
          <Switch
            checked={cashImpact}
            onChange={setCashImpact}
            label={kind === 'buy' ? `Débiter les espèces de ${acc.name}` : `Créditer les espèces de ${acc.name}`}
            hint="Désactive si l'argent vient d'ailleurs ou n'est pas suivi dans ce compte."
          />
        )}
        <Field label="Note" hint="Optionnel">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {kind === 'price' && hs.priceSource === 'live' && <p className="text-xs text-muted">Ce placement suit déjà le cours en direct ; un cours manuel servira pour l'historique.</p>}
      </div>
    </Modal>
  )
}
