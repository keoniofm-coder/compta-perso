import { useState } from 'react'
import { Archive, ShoppingBag, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { accountColor } from '../components/common'
import { AmountInput, Button, Field, Input, Modal, Segmented, Select, Switch, TextArea, cx } from '../components/ui'
import { useDerived } from '../lib/calc'
import { CRYPTO, FIAT, allCurrencies, formatMoney, parseAmount } from '../lib/currency'
import { addMonths, currentMonth, dateLabel, lastDayOf, monthLabel, monthOf, today } from '../lib/dates'
import { ACCOUNT_TYPE_ORDER, ACCOUNT_TYPES } from '../lib/meta'
import { uid, useData, useSettings } from '../lib/store'
import type { Account, AccountType, Scope, Transaction } from '../lib/types'
import { confirm, navigate, toast, useUI } from '../lib/ui'
import { ccy } from './shared'

const NUM_DATE: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }

const SWATCHES = ['#2a78d6', '#1baf7a', '#eb6834', '#6250d6', '#e87ba4', '#eda100', '#0ea5e9', '#14b8a6', '#e34948', '#64748b']

export function CurrencySelect({ value, onChange, cryptoFirst }: { value: string; onChange: (v: string) => void; cryptoFirst?: boolean }) {
  const custom = allCurrencies().filter((c) => c.crypto && !CRYPTO.some((k) => k.code === c.code))
  const fiat = (
    <optgroup label="Devises">
      {FIAT.map((c) => (
        <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
      ))}
    </optgroup>
  )
  const crypto = (
    <optgroup label="Crypto">
      {[...CRYPTO, ...custom].map((c) => (
        <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
      ))}
    </optgroup>
  )
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {cryptoFirst ? crypto : fiat}
      {cryptoFirst ? fiat : crypto}
    </Select>
  )
}

export function AccountForm({ onClose, id, preset }: { onClose: () => void; id?: string; preset?: { type?: string } }) {
  const d = useDerived()
  const settings = useSettings()
  const dark = useUI((s) => s.isDark)
  const existing = id ? d.db.accounts[id] : undefined
  const [type, setType] = useState<AccountType>(existing?.type ?? (preset?.type as AccountType) ?? 'courant')
  const [name, setName] = useState(existing?.name ?? '')
  const [institution, setInstitution] = useState(existing?.institution ?? '')
  const [currency, setCurrency] = useState(existing?.currency ?? settings.baseCurrency)
  const [initial, setInitial] = useState(existing ? String(existing.initialBalance).replace('.', ',') : '')
  const [initialDate, setInitialDate] = useState(existing?.initialDate ?? today())
  const [scope, setScope] = useState<Scope>(existing?.scope ?? (type === 'pro' ? 'pro' : 'perso'))
  const [color, setColor] = useState(existing?.color ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [exclude, setExclude] = useState(!!existing?.excludeFromNetWorth)
  const [archived, setArchived] = useState(!!existing?.archived)
  const [error, setError] = useState('')

  const save = () => {
    if (!name.trim()) return setError('Donne un nom au compte')
    const acc: Account = {
      ...(existing ?? {}),
      id: existing?.id ?? uid(),
      name: name.trim(),
      type,
      currency,
      initialBalance: parseAmount(initial),
      initialDate,
      institution: institution.trim() || undefined,
      color: color || undefined,
      scope,
      note: note.trim() || undefined,
      excludeFromNetWorth: exclude || undefined,
      archived: archived || undefined,
      order: existing?.order ?? Object.keys(d.db.accounts).length,
    }
    useData.getState().put('accounts', acc)
    toast(existing ? 'Compte mis à jour' : 'Compte créé')
    onClose()
  }

  const del = async () => {
    if (!existing) return
    const linked = d.transactions.filter((t) => t.accountId === existing.id || t.toAccountId === existing.id)
    const holdings = Object.values(d.db.holdings).filter((h) => h.accountId === existing.id)
    const ok = await confirm({
      title: `Supprimer « ${existing.name} » ?`,
      message:
        linked.length || holdings.length
          ? `Ses ${linked.length} mouvement(s) et ${holdings.length} placement(s) seront aussi supprimés. Pour garder l'historique, archive plutôt le compte.`
          : 'Cette action est définitive.',
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    const ops = Object.values(d.db.ops).filter((o) => holdings.some((h) => h.id === o.holdingId))
    const recs = Object.values(d.db.recurrings).filter((r) => r.accountId === existing.id || r.toAccountId === existing.id)
    useData.getState().removeMany([
      { collection: 'accounts', id: existing.id },
      ...linked.map((t) => ({ collection: 'transactions' as const, id: t.id })),
      ...holdings.map((h) => ({ collection: 'holdings' as const, id: h.id })),
      ...ops.map((o) => ({ collection: 'ops' as const, id: o.id })),
      ...recs.map((r) => ({ collection: 'recurrings' as const, id: r.id })),
    ])
    toast('Compte supprimé')
    onClose()
    navigate('/comptes')
  }

  const previewColor = color || accountColor({ type }, dark)

  return (
    <Modal
      title={existing ? 'Modifier le compte' : 'Nouveau compte'}
      onClose={onClose}
      footer={
        <>
          {existing && <Button variant="ghost" icon={Trash2} className="mr-auto text-rose-600" onClick={del}>Supprimer</Button>}
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={save}>{existing ? 'Enregistrer' : 'Créer le compte'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="text-[13px] font-medium text-ink-2 mb-2">Type de compte</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ACCOUNT_TYPE_ORDER.map((t) => {
              const m = ACCOUNT_TYPES[t]
              const active = type === t
              const col = accountColor({ type: t }, dark)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t)
                    if (t === 'pro') setScope('pro')
                    else if (type === 'pro') setScope('perso')
                    if (t === 'crypto' && !existing && currency === settings.baseCurrency) setCurrency(settings.baseCurrency)
                  }}
                  className={cx('rounded-2xl border p-3 text-left transition-all', active ? 'border-transparent ring-2 shadow-md' : 'border-line-strong hover:border-indigo-400/50 bg-surface-2')}
                  style={active ? { boxShadow: `0 0 0 2px ${col}`, background: `${col}14` } : undefined}
                >
                  <m.icon className="size-5 mb-1.5" style={{ color: col }} />
                  <div className="text-[13px] font-semibold text-ink leading-tight">{m.label}</div>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted mt-2">{ACCOUNT_TYPES[type].hint}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nom du compte">
            <Input autoFocus={!existing} value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'courant' ? 'Compte courant' : type === 'crypto' ? 'Binance' : type === 'epargne' ? 'Livret A' : 'Nom'} />
          </Field>
          <Field label="Banque / plateforme" hint="Optionnel">
            <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Ex. Boursorama, Qonto, Ledger…" />
          </Field>
          <Field label="Devise du compte" hint={type === 'crypto' ? 'Exchange multi-crypto → garde ta devise et ajoute tes positions dans Placements. Wallet d’une seule crypto → choisis-la ici.' : undefined}>
            <CurrencySelect value={currency} onChange={setCurrency} cryptoFirst={type === 'crypto'} />
          </Field>
          <Field label={existing ? 'Solde de départ' : 'Solde actuel'} hint={`Au ${dateLabel(initialDate, NUM_DATE)}`}>
            <AmountInput value={initial} onChange={setInitial} currency={ccy(currency)} />
          </Field>
          <Field label="Date du solde">
            <Input type="date" value={initialDate} onChange={(e) => setInitialDate(e.target.value)} />
          </Field>
          <Field label="Usage">
            <Segmented
              className="w-full"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'perso', label: 'Perso' },
                { value: 'pro', label: 'Pro / agence' },
              ]}
            />
          </Field>
        </div>

        <div>
          <div className="text-[13px] font-medium text-ink-2 mb-2">Couleur</div>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={() => setColor('')}
              className={cx('h-8 px-3 rounded-full text-xs font-medium border', !color ? 'border-indigo-500 text-indigo-600 dark:text-indigo-300' : 'border-line-strong text-ink-2')}
            >
              Auto
            </button>
            {SWATCHES.map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`Couleur ${s}`}
                onClick={() => setColor(s)}
                className={cx('size-8 rounded-full transition-transform', color === s && 'ring-2 ring-offset-2 ring-offset-surface scale-110')}
                style={{ background: s, ['--tw-ring-color' as string]: s }}
              />
            ))}
            <span className="ml-2 inline-flex items-center gap-2 text-xs text-muted">
              Aperçu <span className="size-4 rounded-full" style={{ background: previewColor }} />
            </span>
          </div>
        </div>

        <Field label="Note" hint="Optionnel (IBAN partiel, plafond, conditions…)">
          <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <div className="rounded-2xl border border-line bg-surface-2 p-4 space-y-3">
          <Switch checked={exclude} onChange={setExclude} label="Exclure du patrimoine" hint="Ex. compte d'un proche que tu gères, argent qui n'est pas à toi." />
          {existing && (
            <Switch checked={archived} onChange={setArchived} label={<span className="inline-flex items-center gap-1.5"><Archive className="size-4" /> Archiver le compte</span>} hint="Il disparaît des listes mais l'historique est conservé." />
          )}
        </div>
        {error && <div className="text-sm font-medium text-neg">{error}</div>}
      </div>
    </Modal>
  )
}

/* ---------------- Clôture du mois / mise à jour du solde ---------------- */

export function CheckpointForm({ onClose, accountId, month: month0, txId }: { onClose: () => void; accountId: string; month?: string; txId?: string }) {
  const d = useDerived()
  const st = d.accountById.get(accountId)
  const existing = txId ? d.db.transactions[txId] : undefined
  const acc = st?.account
  const isCourant = acc?.type === 'courant'
  const defaultMonth = (() => {
    if (existing) return monthOf(existing.date)
    if (month0) return month0
    // Début de mois : on clôture le mois précédent par défaut.
    return Number(today().slice(8, 10)) <= 10 ? addMonths(currentMonth(), -1) : currentMonth()
  })()
  const [mode, setMode] = useState<'month' | 'date'>(existing ? (existing.date === lastDayOf(monthOf(existing.date)) ? 'month' : 'date') : isCourant ? 'month' : 'date')
  const [month, setMonth] = useState(defaultMonth)
  const [date, setDate] = useState(existing?.date ?? today())
  const [value, setValue] = useState(existing?.declaredBalance != null ? String(existing.declaredBalance).replace('.', ',') : '')
  const [note, setNote] = useState(existing?.note ?? '')

  if (!st || !acc) return null
  const effDate = mode === 'month' ? lastDayOf(month) : date
  // Solde calculé à cette date, sans tenir compte du relevé en cours d'édition.
  let before = acc.initialBalance || 0
  for (const ev of st.events) {
    if (ev.date > effDate) break
    if (ev.txId === existing?.id) continue
    if (ev.kind === 'checkpoint') before = d.db.transactions[ev.txId!]?.declaredBalance ?? before
    else before += ev.delta
  }
  const declared = parseAmount(value)
  const delta = value.trim() ? declared - before : 0
  const months = [0, -1, -2, -3, -4, -5].map((n) => addMonths(currentMonth(), n))

  const save = () => {
    if (!value.trim()) return
    const label = isCourant && delta <= 0 ? `Dépenses courantes — ${monthLabel(monthOf(effDate))}` : `Solde constaté${mode === 'month' ? ` fin ${monthLabel(monthOf(effDate)).toLowerCase()}` : ''}`
    const tx: Transaction = {
      ...(existing ?? {}),
      id: existing?.id ?? uid(),
      kind: 'checkpoint',
      date: effDate,
      amount: 0,
      declaredBalance: declared,
      accountId,
      label,
      category: isCourant ? 'vie_courante' : 'checkpoint',
      scope: acc.scope,
      note: note.trim() || undefined,
      createdAt: existing?.createdAt ?? Date.now(),
    }
    // Une seule clôture par mois pour le compte courant.
    const dupes =
      mode === 'month'
        ? d.transactions.filter((t) => t.kind === 'checkpoint' && t.accountId === accountId && t.date === effDate && t.id !== tx.id)
        : []
    if (dupes.length) useData.getState().removeMany(dupes.map((t) => ({ collection: 'transactions', id: t.id })))
    useData.getState().put('transactions', tx)
    toast(isCourant ? 'Mois clôturé' : 'Solde mis à jour')
    onClose()
  }

  const del = async () => {
    if (!existing) return
    if (!(await confirm({ title: 'Supprimer ce relevé ?', confirmLabel: 'Supprimer', danger: true }))) return
    useData.getState().remove('transactions', existing.id)
    onClose()
  }

  return (
    <Modal
      title={isCourant ? 'Clôturer le mois' : 'Mettre à jour le solde'}
      subtitle={`${acc.name} — indique ce qu'il reste réellement sur le compte`}
      onClose={onClose}
      footer={
        <>
          {existing && <Button variant="ghost" icon={Trash2} className="mr-auto text-rose-600" onClick={del}>Supprimer</Button>}
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={save} disabled={!value.trim()}>Valider</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Segmented
          className="w-full"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'month', label: 'Fin de mois' },
            { value: 'date', label: 'À une date précise' },
          ]}
        />
        {mode === 'month' ? (
          <div className="flex flex-wrap gap-2">
            {months.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonth(m)}
                className={cx('h-9 px-3.5 rounded-full text-[13px] font-medium border transition', month === m ? 'brand-gradient text-white border-transparent' : 'border-line-strong text-ink-2 hover:text-ink')}
              >
                {monthLabel(m)}
              </button>
            ))}
          </div>
        ) : (
          <Field label="Date du relevé">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}

        <div className="rounded-2xl bg-surface-2 border border-line p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] text-ink-2">Solde calculé {mode === 'month' ? `au ${dateLabel(effDate, NUM_DATE)}` : 'à cette date'}</div>
            <div className="text-xs text-muted">D'après tes virements et sorties enregistrés</div>
          </div>
          <div className="text-lg font-bold text-ink tnum">{formatMoney(before, acc.currency)}</div>
        </div>

        <Field label={isCourant ? 'Il me reste réellement' : 'Solde réel du compte'} hint={st.holdings.length ? 'Espèces uniquement (hors positions de placement)' : undefined}>
          <AmountInput big autoFocus value={value} onChange={setValue} currency={ccy(acc.currency)} />
        </Field>

        {value.trim() && (
          <div
            className={cx(
              'rounded-2xl p-4 flex items-center gap-3 anim-pop',
              isCourant ? 'bg-sky-500/10 text-sky-800 dark:text-sky-200' : delta >= 0 ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : 'bg-rose-500/10 text-rose-800 dark:text-rose-200',
            )}
          >
            {isCourant ? <ShoppingBag className="size-5 shrink-0" /> : delta >= 0 ? <TrendingUp className="size-5 shrink-0" /> : <TrendingDown className="size-5 shrink-0" />}
            <div className="text-sm">
              {isCourant ? (
                delta <= 0 ? (
                  <>Tu as dépensé <b>{formatMoney(-delta, acc.currency)}</b> au quotidien sur {mode === 'month' ? monthLabel(month).toLowerCase() : 'la période'}. Ce reste sera reporté sur le mois suivant.</>
                ) : (
                  <>Il te reste <b>{formatMoney(delta, acc.currency)}</b> de plus que prévu (une entrée non enregistrée ?). Le solde sera corrigé.</>
                )
              ) : (
                <>Écart de <b>{formatMoney(delta, acc.currency, { sign: true })}</b> ({delta >= 0 ? 'plus-value / intérêts' : 'moins-value / frais'}) enregistré comme ajustement.</>
              )}
            </div>
          </div>
        )}

        <Field label="Note" hint="Optionnel">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
