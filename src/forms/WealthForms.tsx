import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { AccountSelect } from '../components/common'
import { AmountInput, Button, Field, Input, Modal, Segmented, Select, Switch, cx } from '../components/ui'
import { useDerived } from '../lib/calc'
import { formatMoney, parseAmount } from '../lib/currency'
import { currentMonth, today } from '../lib/dates'
import { ASSET_CATEGORIES, LIABILITY_CATEGORIES } from '../lib/meta'
import { uid, useData } from '../lib/store'
import type { Asset, AssetCategory, Employee, Liability, LiabilityCategory, Recurring, Scope } from '../lib/types'
import { confirm, toast } from '../lib/ui'
import { CurrencySelect } from './AccountForms'
import { ccy, useActiveAccounts } from './shared'

const num = (v?: number) => (v != null ? String(v).replace('.', ',') : '')

export function AssetForm({ onClose, id, preset }: { onClose: () => void; id?: string; preset?: Record<string, unknown> }) {
  const d = useDerived()
  const existing = id ? d.db.assets[id] : undefined
  const p = (preset ?? {}) as Partial<Asset>
  const [name, setName] = useState(existing?.name ?? p.name ?? '')
  const [category, setCategory] = useState<AssetCategory>(existing?.category ?? p.category ?? 'informatique')
  const [currency, setCurrency] = useState(existing?.currency ?? d.base)
  const [purchaseValue, setPurchaseValue] = useState(num(existing?.purchaseValue ?? p.purchaseValue))
  const [purchaseDate, setPurchaseDate] = useState(existing?.purchaseDate ?? today())
  const [mode, setMode] = useState<'fixed' | 'dep'>(existing ? (existing.depreciationYears ? 'dep' : 'fixed') : ASSET_CATEGORIES[category].defaultYears ? 'dep' : 'fixed')
  const [currentValue, setCurrentValue] = useState(num(existing?.currentValue))
  const [years, setYears] = useState(num(existing?.depreciationYears ?? ASSET_CATEGORIES[category].defaultYears))
  const [scope, setScope] = useState<Scope>(existing?.scope ?? 'perso')
  const [sold, setSold] = useState(!!existing?.sold)
  const [note, setNote] = useState(existing?.note ?? '')
  const [error, setError] = useState('')

  const pv = parseAmount(purchaseValue)
  const yrs = parseAmount(years)
  const preview: Asset = {
    id: '',
    name,
    category,
    currency,
    purchaseValue: pv,
    purchaseDate,
    currentValue: parseAmount(currentValue) || pv,
    depreciationYears: mode === 'dep' && yrs > 0 ? yrs : undefined,
    scope,
  }

  const save = () => {
    if (!name.trim()) return setError('Donne un nom au bien')
    if (!(pv > 0)) return setError("Indique la valeur d'achat")
    const a: Asset = {
      ...(existing ?? {}),
      ...preview,
      id: existing?.id ?? uid(),
      name: name.trim(),
      note: note.trim() || undefined,
      sold: sold || undefined,
    }
    useData.getState().put('assets', a)
    toast(existing ? 'Bien mis à jour' : 'Bien ajouté au patrimoine')
    onClose()
  }

  const del = async () => {
    if (!existing) return
    if (!(await confirm({ title: `Supprimer « ${existing.name} » ?`, confirmLabel: 'Supprimer', danger: true }))) return
    useData.getState().remove('assets', existing.id)
    onClose()
  }

  return (
    <Modal
      title={existing ? 'Modifier le bien' : 'Nouveau bien'}
      subtitle="Immobilier, véhicule, matériel informatique, objets de valeur…"
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
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(ASSET_CATEGORIES) as AssetCategory[]).map((c) => {
            const m = ASSET_CATEGORIES[c]
            const active = category === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCategory(c)
                  if (!existing) {
                    setYears(num(m.defaultYears))
                    setMode(m.defaultYears ? 'dep' : 'fixed')
                  }
                }}
                className={cx('rounded-2xl border p-3 text-left transition', active ? 'brand-gradient text-white border-transparent shadow-md' : 'border-line-strong bg-surface-2 text-ink-2 hover:text-ink')}
              >
                <m.icon className="size-5 mb-1" />
                <div className="text-[12.5px] font-semibold leading-tight">{m.label}</div>
              </button>
            )
          })}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nom">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. MacBook Pro 16" />
          </Field>
          <Field label="Devise">
            <CurrencySelect value={currency} onChange={setCurrency} />
          </Field>
          <Field label="Valeur d'achat">
            <AmountInput value={purchaseValue} onChange={setPurchaseValue} currency={ccy(currency)} />
          </Field>
          <Field label="Date d'achat">
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Valeur actuelle">
          <Segmented
            className="w-full mb-3"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'dep', label: 'Amortissement auto' },
              { value: 'fixed', label: 'Valeur saisie' },
            ]}
          />
          {mode === 'dep' ? (
            <div className="flex items-center gap-3">
              <Input className="w-24" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
              <span className="text-sm text-ink-2">ans → vaut aujourd'hui environ <b className="text-ink">{formatMoney(d.assetValue(preview), currency)}</b></span>
            </div>
          ) : (
            <AmountInput value={currentValue} onChange={setCurrentValue} currency={ccy(currency)} placeholder={purchaseValue || '0'} />
          )}
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Usage">
            <Segmented className="w-full" value={scope} onChange={setScope} options={[{ value: 'perso', label: 'Perso' }, { value: 'pro', label: 'Pro / agence' }]} />
          </Field>
          <Field label="Note" hint="Optionnel">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        {existing && <Switch checked={sold} onChange={setSold} label="Vendu / plus en ma possession" />}
        {error && <div className="text-sm font-medium text-neg">{error}</div>}
      </div>
    </Modal>
  )
}

export function LiabilityForm({ onClose, id }: { onClose: () => void; id?: string }) {
  const d = useDerived()
  const accounts = useActiveAccounts()
  const existing = id ? d.db.liabilities[id] : undefined
  const [name, setName] = useState(existing?.name ?? '')
  const [category, setCategory] = useState<LiabilityCategory>(existing?.category ?? 'auto')
  const [currency, setCurrency] = useState(existing?.currency ?? d.base)
  const [initialAmount, setInitialAmount] = useState(num(existing?.initialAmount))
  const [remaining, setRemaining] = useState(num(existing?.remaining))
  const [monthly, setMonthly] = useState(num(existing?.monthlyPayment))
  const [rate, setRate] = useState(num(existing?.rate))
  const [startDate, setStartDate] = useState(existing?.startDate ?? today())
  const [endDate, setEndDate] = useState(existing?.endDate ?? '')
  const [scope, setScope] = useState<Scope>(existing?.scope ?? 'perso')
  const [makeRec, setMakeRec] = useState(false)
  const [payAccount, setPayAccount] = useState(accounts.find((a) => a.type === 'courant')?.id ?? accounts[0]?.id ?? '')
  const [error, setError] = useState('')

  const save = () => {
    if (!name.trim()) return setError('Donne un nom')
    const rem = parseAmount(remaining)
    const l: Liability = {
      ...(existing ?? {}),
      id: existing?.id ?? uid(),
      name: name.trim(),
      category,
      currency,
      initialAmount: parseAmount(initialAmount) || rem,
      remaining: rem,
      monthlyPayment: parseAmount(monthly) || undefined,
      rate: parseAmount(rate) || undefined,
      startDate,
      endDate: endDate || undefined,
      scope,
    }
    const items: { collection: 'liabilities' | 'recurrings'; item: Liability | Recurring }[] = [{ collection: 'liabilities', item: l }]
    if (makeRec && l.monthlyPayment && payAccount) {
      items.push({
        collection: 'recurrings',
        item: {
          id: uid(),
          kind: 'expense',
          label: `Mensualité ${l.name}`,
          amount: l.monthlyPayment,
          accountId: payAccount,
          category: scope === 'pro' ? 'autre_sortie_pro' : 'credit',
          frequency: 'monthly',
          day: Number(startDate.slice(8, 10)) || 5,
          startMonth: currentMonth(),
          endMonth: endDate ? endDate.slice(0, 7) : undefined,
          scope,
          active: true,
        },
      })
    }
    useData.getState().putMany(items)
    toast(existing ? 'Dette mise à jour' : 'Dette ajoutée')
    onClose()
  }

  const del = async () => {
    if (!existing) return
    if (!(await confirm({ title: `Supprimer « ${existing.name} » ?`, confirmLabel: 'Supprimer', danger: true }))) return
    useData.getState().remove('liabilities', existing.id)
    onClose()
  }

  return (
    <Modal
      title={existing ? 'Modifier la dette' : 'Nouvelle dette / crédit'}
      onClose={onClose}
      footer={
        <>
          {existing && <Button variant="ghost" icon={Trash2} className="mr-auto text-rose-600" onClick={del}>Supprimer</Button>}
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={save}>{existing ? 'Enregistrer' : 'Ajouter'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nom">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Crédit voiture" />
          </Field>
          <Field label="Type">
            <Select value={category} onChange={(e) => setCategory(e.target.value as LiabilityCategory)}>
              {Object.entries(LIABILITY_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Montant emprunté">
            <AmountInput value={initialAmount} onChange={setInitialAmount} currency={ccy(currency)} />
          </Field>
          <Field label="Reste à rembourser">
            <AmountInput value={remaining} onChange={setRemaining} currency={ccy(currency)} />
          </Field>
          <Field label="Mensualité" hint="Optionnel">
            <AmountInput value={monthly} onChange={setMonthly} currency={ccy(currency)} />
          </Field>
          <Field label="Taux (%)" hint="Optionnel">
            <AmountInput value={rate} onChange={setRate} currency="%" />
          </Field>
          <Field label="Début">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Fin" hint="Optionnel">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <Field label="Devise">
            <CurrencySelect value={currency} onChange={setCurrency} />
          </Field>
          <Field label="Usage">
            <Segmented className="w-full" value={scope} onChange={setScope} options={[{ value: 'perso', label: 'Perso' }, { value: 'pro', label: 'Pro' }]} />
          </Field>
        </div>
        {!existing && parseAmount(monthly) > 0 && (
          <div className="rounded-2xl border border-line bg-surface-2 p-4 space-y-3">
            <Switch checked={makeRec} onChange={setMakeRec} label="Ajouter la mensualité aux charges fixes" />
            {makeRec && <AccountSelect value={payAccount} onChange={setPayAccount} accounts={accounts} />}
          </div>
        )}
        {error && <div className="text-sm font-medium text-neg">{error}</div>}
      </div>
    </Modal>
  )
}

export function EmployeeForm({ onClose, id }: { onClose: () => void; id?: string }) {
  const d = useDerived()
  const accounts = useActiveAccounts()
  const existing = id ? d.db.employees[id] : undefined
  const [name, setName] = useState(existing?.name ?? '')
  const [role, setRole] = useState(existing?.role ?? '')
  const [salary, setSalary] = useState(num(existing?.salary))
  const [currency, setCurrency] = useState(existing?.currency ?? d.base)
  const [accountId, setAccountId] = useState(existing?.accountId ?? accounts.find((a) => a.type === 'pro')?.id ?? accounts[0]?.id ?? '')
  const [startDate, setStartDate] = useState(existing?.startDate ?? today())
  const [active, setActive] = useState(existing?.active ?? true)
  const [makeRec, setMakeRec] = useState(!existing)
  const [payDay, setPayDay] = useState('28')
  const [error, setError] = useState('')

  const save = () => {
    if (!name.trim()) return setError('Indique le nom')
    const e: Employee = {
      ...(existing ?? {}),
      id: existing?.id ?? uid(),
      name: name.trim(),
      role: role.trim() || undefined,
      salary: parseAmount(salary),
      currency,
      accountId: accountId || undefined,
      startDate,
      active,
    }
    const items: { collection: 'employees' | 'recurrings'; item: Employee | Recurring }[] = [{ collection: 'employees', item: e }]
    if (makeRec && !existing && e.salary > 0 && accountId) {
      items.push({
        collection: 'recurrings',
        item: {
          id: uid(),
          kind: 'expense',
          label: `Salaire ${e.name}`,
          amount: e.salary,
          accountId,
          category: 'salaires_employes',
          counterparty: e.name,
          employeeId: e.id,
          frequency: 'monthly',
          day: parseInt(payDay) || 28,
          startMonth: currentMonth(),
          scope: 'pro',
          active: true,
        },
      })
    }
    useData.getState().putMany(items)
    toast(existing ? 'Fiche mise à jour' : `${e.name} ajouté·e à l'équipe`)
    onClose()
  }

  const del = async () => {
    if (!existing) return
    if (!(await confirm({ title: `Retirer ${existing.name} de l'équipe ?`, message: "L'historique des paiements est conservé.", confirmLabel: 'Supprimer', danger: true }))) return
    useData.getState().remove('employees', existing.id)
    onClose()
  }

  return (
    <Modal
      title={existing ? 'Modifier la fiche' : 'Nouveau membre de l’équipe'}
      onClose={onClose}
      footer={
        <>
          {existing && <Button variant="ghost" icon={Trash2} className="mr-auto text-rose-600" onClick={del}>Supprimer</Button>}
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={save}>{existing ? 'Enregistrer' : 'Ajouter'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nom">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Poste" hint="Optionnel">
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex. Community manager" />
          </Field>
          <Field label="Salaire / rémunération mensuelle">
            <AmountInput value={salary} onChange={setSalary} currency={ccy(currency)} />
          </Field>
          <Field label="Devise">
            <CurrencySelect value={currency} onChange={setCurrency} />
          </Field>
          <Field label="Payé depuis">
            <AccountSelect value={accountId} onChange={setAccountId} accounts={accounts} />
          </Field>
          <Field label="Depuis le">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
        </div>
        {!existing && (
          <div className="rounded-2xl border border-line bg-surface-2 p-4 space-y-3">
            <Switch checked={makeRec} onChange={setMakeRec} label="Créer l'échéance de salaire mensuelle" hint="Elle apparaîtra dans les fixes : tu n'auras qu'à la valider chaque mois." />
            {makeRec && (
              <Field label="Jour de paie">
                <Input className="w-24" inputMode="numeric" value={payDay} onChange={(e) => setPayDay(e.target.value.replace(/\D/g, ''))} />
              </Field>
            )}
          </div>
        )}
        {existing && <Switch checked={active} onChange={setActive} label="Toujours dans l'équipe" />}
        {error && <div className="text-sm font-medium text-neg">{error}</div>}
      </div>
    </Modal>
  )
}
