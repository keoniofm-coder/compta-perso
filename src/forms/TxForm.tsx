import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Plus, Trash2, X } from 'lucide-react'
import { AccountSelect } from '../components/common'
import { AmountInput, Button, Field, Input, Modal, Segmented, Select, Switch, TextArea, cx } from '../components/ui'
import { useDerived } from '../lib/calc'
import { formatMoney, parseAmount } from '../lib/currency'
import { monthOf, today } from '../lib/dates'
import { ASSET_CATEGORIES, FREQUENCIES, categoryMeta } from '../lib/meta'
import { uid, useData } from '../lib/store'
import type { Asset, AssetCategory, Frequency, Recurring, Scope, Transaction } from '../lib/types'
import { confirm, toast } from '../lib/ui'
import { CategoryGrid, ConvertHint, FormSection, ccy, lastAccount, rememberAccount, useActiveAccounts } from './shared'

type Kind = 'income' | 'expense' | 'transfer'

export function TxForm({
  onClose,
  tx,
  kind: kind0,
  accountId: acc0,
  scope: scope0,
  preset,
}: {
  onClose: () => void
  tx?: Transaction
  kind?: Transaction['kind']
  accountId?: string
  scope?: Scope
  preset?: Partial<Transaction>
}) {
  const d = useDerived()
  const accounts = useActiveAccounts()
  const { put, putMany, remove } = useData.getState()
  const editing = !!tx
  const initKind: Kind = (tx?.kind ?? preset?.kind ?? kind0 ?? 'expense') as Kind
  const [kind, setKind] = useState<Kind>(initKind === ('checkpoint' as Kind) ? 'expense' : initKind)

  const defaultAccount = (k: Kind) => {
    const remembered = lastAccount(k)
    if (remembered && d.db.accounts[remembered] && !d.db.accounts[remembered].archived) return remembered
    const pref = k === 'income' ? accounts.find((a) => a.type === 'banque' || a.type === 'courant') : accounts.find((a) => a.type === 'courant')
    return (pref ?? accounts[0])?.id ?? ''
  }

  const [accountId, setAccountId] = useState(tx?.accountId ?? preset?.accountId ?? acc0 ?? defaultAccount(initKind))
  const [toAccountId, setToAccountId] = useState(tx?.toAccountId ?? preset?.toAccountId ?? '')
  const [amount, setAmount] = useState(tx ? String(tx.amount).replace('.', ',') : preset?.amount ? String(preset.amount).replace('.', ',') : '')
  const [toAmount, setToAmount] = useState(tx?.toAmount != null ? String(tx.toAmount).replace('.', ',') : '')
  const [toAmountTouched, setToAmountTouched] = useState(tx?.toAmount != null)
  const [label, setLabel] = useState(tx?.label ?? preset?.label ?? '')
  const [category, setCategory] = useState(tx?.category ?? preset?.category ?? '')
  const [date, setDate] = useState(tx?.date ?? preset?.date ?? today())
  const acc = d.db.accounts[accountId]
  const [scope, setScope] = useState<Scope>(tx?.scope ?? preset?.scope ?? scope0 ?? acc?.scope ?? 'perso')
  const [counterparty, setCounterparty] = useState(tx?.counterparty ?? '')
  const [employeeId, setEmployeeId] = useState(tx?.employeeId ?? '')
  const [note, setNote] = useState(tx?.note ?? '')
  const [multi, setMulti] = useState(false)
  const [lines, setLines] = useState<{ accountId: string; amount: string }[]>([
    { accountId: accountId, amount: '' },
    { accountId: '', amount: '' },
  ])
  const [addAsset, setAddAsset] = useState(false)
  const [assetCategory, setAssetCategory] = useState<AssetCategory>('informatique')
  const [depYears, setDepYears] = useState('4')
  const [makeRecurring, setMakeRecurring] = useState(false)
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [error, setError] = useState('')

  const toAcc = d.db.accounts[toAccountId]
  const amountNum = parseAmount(amount)
  const crossCurrency = kind === 'transfer' && acc && toAcc && acc.currency !== toAcc.currency
  const autoToAmount = crossCurrency ? d.convert(amountNum, acc.currency, toAcc.currency) : 0
  const effectiveToAmount = crossCurrency ? (toAmountTouched ? parseAmount(toAmount) : autoToAmount) : undefined

  const counterparties = useMemo(() => {
    const s = new Set<string>()
    for (const t of d.transactions) if (t.counterparty) s.add(t.counterparty)
    for (const e of Object.values(d.db.employees)) s.add(e.name)
    return [...s].sort()
  }, [d])
  const employees = Object.values(d.db.employees).filter((e) => e.active || e.id === employeeId)

  const multiTotal = lines.reduce((s, l) => s + parseAmount(l.amount), 0)

  const onAccountChange = (id: string) => {
    setAccountId(id)
    const a = d.db.accounts[id]
    if (a && !editing) setScope(a.scope)
  }

  const save = () => {
    setError('')
    if (kind === 'expense' && multi && !editing) {
      const valid = lines.filter((l) => l.accountId && parseAmount(l.amount) > 0)
      if (valid.length < 1) return setError('Ajoute au moins un compte avec un montant')
      const groupId = uid()
      const lbl = label.trim() || categoryMeta(category || 'autre_sortie').label
      const now = Date.now()
      const items = valid.map((l, i) => ({
        collection: 'transactions' as const,
        item: {
          id: uid(),
          kind: 'expense',
          date,
          amount: parseAmount(l.amount),
          accountId: l.accountId,
          label: lbl,
          category: category || (scope === 'pro' ? 'autre_sortie_pro' : 'autre_sortie'),
          counterparty: counterparty.trim() || undefined,
          note: note.trim() || undefined,
          scope,
          groupId,
          createdAt: now + i,
        } satisfies Transaction,
      }))
      putMany(items)
      if (addAsset) createAsset(lbl, valid.reduce((s, l) => s + d.convert(parseAmount(l.amount), d.db.accounts[l.accountId].currency, acc?.currency ?? d.base), 0), acc?.currency ?? d.base, items[0].item.id)
      toast(`Sortie enregistrée sur ${valid.length} comptes`)
      return onClose()
    }
    if (!accountId) return setError('Choisis un compte')
    if (!(amountNum > 0)) return setError('Indique un montant')
    if (kind === 'transfer') {
      if (!toAccountId) return setError('Choisis le compte qui reçoit')
      if (toAccountId === accountId) return setError('Les deux comptes doivent être différents')
    }
    const lbl =
      label.trim() ||
      (kind === 'transfer' ? `Virement vers ${toAcc?.name ?? ''}`.trim() : categoryMeta(category || (kind === 'income' ? 'autre_entree' : 'autre_sortie')).label)
    const id = tx?.id ?? uid()
    let recurringId = tx?.recurringId
    let recurringPeriod = tx?.recurringPeriod
    if (makeRecurring && !editing) {
      const rec: Recurring = {
        id: uid(),
        kind,
        label: lbl,
        amount: amountNum,
        accountId,
        toAccountId: kind === 'transfer' ? toAccountId : undefined,
        toAmount: effectiveToAmount,
        category: kind === 'transfer' ? undefined : category || undefined,
        counterparty: counterparty.trim() || undefined,
        employeeId: employeeId || undefined,
        frequency,
        day: Number(date.slice(8, 10)),
        startMonth: monthOf(date),
        scope,
        active: true,
      }
      put('recurrings', rec)
      recurringId = rec.id
      recurringPeriod = monthOf(date)
    }
    const next: Transaction = {
      ...(tx ?? {}),
      id,
      kind,
      date,
      amount: amountNum,
      accountId,
      toAccountId: kind === 'transfer' ? toAccountId : undefined,
      toAmount: kind === 'transfer' ? effectiveToAmount : undefined,
      label: lbl,
      category: kind === 'transfer' ? undefined : category || (kind === 'income' ? (scope === 'pro' ? 'autre_entree_pro' : 'autre_entree') : scope === 'pro' ? 'autre_sortie_pro' : 'autre_sortie'),
      counterparty: counterparty.trim() || undefined,
      employeeId: employeeId || undefined,
      note: note.trim() || undefined,
      scope,
      recurringId,
      recurringPeriod,
      createdAt: tx?.createdAt ?? Date.now(),
    }
    if (addAsset && kind === 'expense' && !editing) {
      const assetId = createAsset(lbl, amountNum, acc.currency, id)
      next.assetId = assetId
    }
    put('transactions', next)
    rememberAccount(kind, accountId)
    toast(editing ? 'Mouvement mis à jour' : kind === 'income' ? 'Entrée enregistrée' : kind === 'expense' ? 'Sortie enregistrée' : 'Virement enregistré')
    onClose()
  }

  const createAsset = (name: string, value: number, currency: string, txId: string) => {
    const years = parseAmount(depYears)
    const asset: Asset = {
      id: uid(),
      name,
      category: assetCategory,
      currency,
      purchaseValue: value,
      purchaseDate: date,
      currentValue: value,
      depreciationYears: years > 0 ? years : undefined,
      scope,
      txId,
    }
    useData.getState().put('assets', asset)
    return asset.id
  }

  const del = async () => {
    if (!tx) return
    const ok = await confirm({ title: 'Supprimer ce mouvement ?', message: 'Le solde du compte sera recalculé.', confirmLabel: 'Supprimer', danger: true })
    if (!ok) return
    remove('transactions', tx.id)
    toast('Mouvement supprimé')
    onClose()
  }

  const kindTitle = editing ? 'Modifier le mouvement' : kind === 'income' ? 'Nouvelle entrée' : kind === 'expense' ? 'Nouvelle sortie' : 'Nouveau virement'

  return (
    <Modal
      title={kindTitle}
      subtitle={editing && tx?.recurringId ? 'Mouvement généré depuis une échéance fixe' : undefined}
      onClose={onClose}
      footer={
        <>
          {editing && <Button variant="ghost" icon={Trash2} className="mr-auto text-rose-600" onClick={del}>Supprimer</Button>}
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={save}>{editing ? 'Enregistrer' : 'Ajouter'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        {!editing && (
          <Segmented
            className="w-full"
            value={kind}
            onChange={(k) => {
              setKind(k)
              if (!editing) {
                setCategory('')
                setAccountId(defaultAccount(k))
              }
            }}
            options={[
              { value: 'income', label: 'Entrée', icon: ArrowDownLeft, activeClass: '!text-emerald-600 dark:!text-emerald-400' },
              { value: 'expense', label: 'Sortie', icon: ArrowUpRight, activeClass: '!text-rose-600 dark:!text-rose-400' },
              { value: 'transfer', label: 'Virement', icon: ArrowRightLeft, activeClass: '!text-indigo-600 dark:!text-indigo-300' },
            ]}
          />
        )}

        {!(kind === 'expense' && multi) && (
          <Field label="Montant">
            <AmountInput big autoFocus={!editing} value={amount} onChange={setAmount} currency={acc ? ccy(acc.currency) : ''} />
            {acc && <div className="mt-1"><ConvertHint amount={amountNum} from={acc.currency} /></div>}
          </Field>
        )}

        {kind === 'transfer' ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Depuis">
              <AccountSelect value={accountId} onChange={onAccountChange} accounts={accounts} />
            </Field>
            <Field label="Vers">
              <AccountSelect value={toAccountId} onChange={setToAccountId} accounts={accounts} exclude={accountId} />
            </Field>
            {crossCurrency && (
              <Field
                label={`Montant reçu (${toAcc.currency})`}
                hint={toAmountTouched ? 'Montant saisi à la main' : `Calculé au cours actuel — modifie-le si besoin`}
                className="sm:col-span-2"
              >
                <AmountInput
                  value={toAmountTouched ? toAmount : autoToAmount ? String(+autoToAmount.toFixed(toAcc.currency.length > 3 || ['BTC', 'ETH'].includes(toAcc.currency) ? 8 : 2)).replace('.', ',') : ''}
                  onChange={(v) => {
                    setToAmountTouched(true)
                    setToAmount(v)
                  }}
                  currency={ccy(toAcc.currency)}
                />
              </Field>
            )}
          </div>
        ) : kind === 'expense' && multi ? (
          <FormSection title="Payé depuis plusieurs comptes">
            {lines.map((l, i) => {
              const la = d.db.accounts[l.accountId]
              return (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    <AccountSelect value={l.accountId} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, accountId: v } : x)))} accounts={accounts} />
                  </div>
                  <AmountInput className="w-36" value={l.amount} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: v } : x)))} currency={la ? ccy(la.currency) : ''} />
                  {lines.length > 1 && (
                    <button type="button" className="h-11 px-2 text-muted hover:text-rose-500" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Retirer">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              )
            })}
            <div className="flex items-center justify-between">
              <Button size="sm" variant="soft" icon={Plus} onClick={() => setLines([...lines, { accountId: '', amount: '' }])}>Ajouter un compte</Button>
              <span className="text-sm text-ink-2">Total : <b className="text-ink">{formatMoney(multiTotal, acc?.currency ?? d.base)}</b></span>
            </div>
          </FormSection>
        ) : (
          <Field label={kind === 'income' ? 'Reçu sur' : 'Payé depuis'}>
            <AccountSelect value={accountId} onChange={onAccountChange} accounts={accounts} />
          </Field>
        )}

        {kind === 'expense' && !editing && (
          <button type="button" onClick={() => setMulti(!multi)} className="text-[13px] font-medium text-indigo-600 dark:text-indigo-300 hover:underline -mt-2">
            {multi ? '← Payer depuis un seul compte' : 'Payer depuis plusieurs comptes →'}
          </button>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Libellé">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={kind === 'income' ? 'Ex. Salaire octobre' : kind === 'expense' ? 'Ex. MacBook Pro' : 'Ex. Épargne du mois'} />
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        {kind !== 'transfer' && (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-ink-2">Catégorie</span>
              <Segmented
                size="sm"
                value={scope}
                onChange={(s) => {
                  setScope(s)
                  setCategory('')
                }}
                options={[
                  { value: 'perso', label: 'Perso' },
                  { value: 'pro', label: 'Pro / agence' },
                ]}
              />
            </div>
            <CategoryGrid kind={kind} scope={scope} value={category} onChange={setCategory} />
          </>
        )}

        {kind !== 'transfer' && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={kind === 'income' ? (scope === 'pro' ? 'Client' : 'Payeur') : scope === 'pro' ? 'Fournisseur / bénéficiaire' : 'Bénéficiaire'} hint="Optionnel">
              <Input list="tz-counterparties" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder={scope === 'pro' && kind === 'income' ? 'Ex. Studio Nova' : ''} />
              <datalist id="tz-counterparties">
                {counterparties.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            {kind === 'expense' && scope === 'pro' && employees.length > 0 && (
              <Field label="Employé concerné" hint="Pour le suivi des salaires">
                <Select
                  value={employeeId}
                  onChange={(e) => {
                    setEmployeeId(e.target.value)
                    const emp = d.db.employees[e.target.value]
                    if (emp) {
                      setCounterparty(emp.name)
                      if (!category) setCategory('salaires_employes')
                    }
                  }}
                >
                  <option value="">—</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        )}

        <Field label="Note" hint="Optionnel">
          <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {!editing && (
          <div className="rounded-2xl border border-line bg-surface-2 p-4 space-y-3">
            <Switch
              checked={makeRecurring}
              onChange={setMakeRecurring}
              label="C'est un flux fixe (récurrent)"
              hint="Salaire, loyer, abonnement, virement d'épargne… on le retrouvera dans l'échéancier chaque mois."
            />
            {makeRecurring && (
              <Select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                {Object.entries(FREQUENCIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </Select>
            )}
            {kind === 'expense' && (
              <>
                <div className="h-px bg-line" />
                <Switch
                  checked={addAsset}
                  onChange={setAddAsset}
                  label="Ajouter cet achat à mon patrimoine"
                  hint="Pour les gros achats qui gardent de la valeur : ordinateur, véhicule, matériel…"
                />
                {addAsset && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Type de bien">
                      <Select
                        value={assetCategory}
                        onChange={(e) => {
                          const c = e.target.value as AssetCategory
                          setAssetCategory(c)
                          setDepYears(String(ASSET_CATEGORIES[c].defaultYears ?? ''))
                        }}
                      >
                        {Object.entries(ASSET_CATEGORIES).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Amortir sur (années)" hint="Vide = valeur fixe">
                      <Input inputMode="numeric" value={depYears} onChange={(e) => setDepYears(e.target.value)} />
                    </Field>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {error && <div className={cx('text-sm font-medium text-neg')}>{error}</div>}
      </div>
    </Modal>
  )
}
