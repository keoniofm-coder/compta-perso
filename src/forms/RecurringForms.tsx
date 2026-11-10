import { useState } from 'react'
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, CheckCircle2, Trash2 } from 'lucide-react'
import { AccountSelect } from '../components/common'
import { AmountInput, Button, Field, Input, Modal, Segmented, Select, Switch } from '../components/ui'
import { expectedAmount, recurringHistory, useDerived } from '../lib/calc'
import { formatMoney, parseAmount } from '../lib/currency'
import { currentMonth, dayInMonth, monthLabel } from '../lib/dates'
import { FREQUENCIES, categoryMeta } from '../lib/meta'
import { uid, useData } from '../lib/store'
import type { Frequency, Recurring, Scope, Transaction } from '../lib/types'
import { confirm, toast } from '../lib/ui'
import { CategoryGrid, ConvertHint, ccy, useActiveAccounts } from './shared'

export function RecurringForm({ onClose, id, preset }: { onClose: () => void; id?: string; preset?: Record<string, unknown> }) {
  const d = useDerived()
  const accounts = useActiveAccounts()
  const existing = id ? d.db.recurrings[id] : undefined
  const p = (preset ?? {}) as Partial<Recurring>
  const [kind, setKind] = useState<Recurring['kind']>(existing?.kind ?? p.kind ?? 'expense')
  const [label, setLabel] = useState(existing?.label ?? p.label ?? '')
  const [amount, setAmount] = useState(existing ? String(existing.amount).replace('.', ',') : p.amount ? String(p.amount).replace('.', ',') : '')
  const [accountId, setAccountId] = useState(existing?.accountId ?? p.accountId ?? accounts.find((a) => a.type === 'courant')?.id ?? accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(existing?.toAccountId ?? '')
  const [category, setCategory] = useState(existing?.category ?? p.category ?? '')
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly')
  const [day, setDay] = useState(String(existing?.day ?? p.day ?? 1))
  const [startMonth, setStartMonth] = useState(existing?.startMonth ?? currentMonth())
  const [endMonth, setEndMonth] = useState(existing?.endMonth ?? '')
  const [scope, setScope] = useState<Scope>(existing?.scope ?? p.scope ?? d.db.accounts[accountId]?.scope ?? 'perso')
  const [counterparty, setCounterparty] = useState(existing?.counterparty ?? p.counterparty ?? '')
  const [employeeId, setEmployeeId] = useState(existing?.employeeId ?? p.employeeId ?? '')
  const [active, setActive] = useState(existing?.active ?? true)
  const [auto, setAuto] = useState(!!existing?.auto)
  const [variable, setVariable] = useState(!!existing?.variable)
  const [error, setError] = useState('')

  const acc = d.db.accounts[accountId]
  const toAcc = d.db.accounts[toAccountId]
  const employees = Object.values(d.db.employees)

  const save = () => {
    const amt = parseAmount(amount)
    if (!(amt > 0)) return setError('Indique un montant')
    if (!accountId) return setError('Choisis un compte')
    if (kind === 'transfer' && (!toAccountId || toAccountId === accountId)) return setError('Choisis le compte qui reçoit')
    const rec: Recurring = {
      ...(existing ?? {}),
      id: existing?.id ?? uid(),
      kind,
      label: label.trim() || (kind === 'transfer' ? `Virement vers ${toAcc?.name ?? ''}` : categoryMeta(category).label),
      amount: amt,
      accountId,
      toAccountId: kind === 'transfer' ? toAccountId : undefined,
      toAmount: kind === 'transfer' && toAcc && acc && toAcc.currency !== acc.currency ? d.convert(amt, acc.currency, toAcc.currency) : undefined,
      category: kind === 'transfer' ? undefined : category || (kind === 'income' ? 'autre_entree' : 'autre_sortie'),
      counterparty: counterparty.trim() || undefined,
      employeeId: employeeId || undefined,
      frequency,
      day: Math.min(31, Math.max(1, parseInt(day) || 1)),
      startMonth,
      endMonth: endMonth || undefined,
      scope,
      active,
      variable: (kind !== 'transfer' && variable) || undefined,
      auto: (auto && !(kind !== 'transfer' && variable)) || undefined,
      // Les mois passés restent à valider à la main : l'automatique part du mois où on l'active.
      autoFrom: auto ? (existing?.auto && existing.autoFrom ? existing.autoFrom : currentMonth()) : undefined,
      skipped: auto ? existing?.skipped : undefined,
    }
    useData.getState().put('recurrings', rec)
    toast(existing ? 'Flux fixe mis à jour' : 'Flux fixe ajouté')
    onClose()
  }

  const del = async () => {
    if (!existing) return
    const ok = await confirm({
      title: `Supprimer « ${existing.label} » ?`,
      message: 'Les mouvements déjà validés restent dans ton historique.',
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    useData.getState().remove('recurrings', existing.id)
    onClose()
  }

  return (
    <Modal
      title={existing ? 'Modifier le flux fixe' : 'Nouveau flux fixe'}
      subtitle="Revenus et charges qui reviennent : salaire, loyer, abonnements, salaires d'employés…"
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
        <Segmented
          className="w-full"
          value={kind}
          onChange={(k) => {
            setKind(k)
            setCategory('')
          }}
          options={[
            { value: 'income', label: 'Revenu', icon: ArrowDownLeft, activeClass: '!text-emerald-600 dark:!text-emerald-400' },
            { value: 'expense', label: 'Charge', icon: ArrowUpRight, activeClass: '!text-rose-600 dark:!text-rose-400' },
            { value: 'transfer', label: 'Virement auto', icon: ArrowRightLeft, activeClass: '!text-indigo-600 dark:!text-indigo-300' },
          ]}
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Libellé">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={kind === 'income' ? 'Salaire' : kind === 'expense' ? 'Loyer' : 'Épargne Livret A'} />
          </Field>
          <Field label={variable ? 'Montant estimé' : 'Montant'}>
            <AmountInput value={amount} onChange={setAmount} currency={acc ? ccy(acc.currency) : ''} />
            {acc && <div className="mt-1"><ConvertHint amount={parseAmount(amount)} from={acc.currency} /></div>}
          </Field>
          <Field label={kind === 'income' ? 'Reçu sur' : kind === 'expense' ? 'Payé depuis' : 'Depuis'}>
            <AccountSelect value={accountId} onChange={(v) => { setAccountId(v); if (!existing) setScope(d.db.accounts[v]?.scope ?? 'perso') }} accounts={accounts} />
          </Field>
          {kind === 'transfer' ? (
            <Field label="Vers">
              <AccountSelect value={toAccountId} onChange={setToAccountId} accounts={accounts} exclude={accountId} />
            </Field>
          ) : (
            <Field label="Usage">
              <Segmented
                className="w-full"
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
            </Field>
          )}
        </div>

        {kind !== 'transfer' && <CategoryGrid kind={kind} scope={scope} value={category} onChange={setCategory} />}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Fréquence" className="col-span-2 sm:col-span-1">
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              {Object.entries(FREQUENCIES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Jour du mois">
            <Input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="À partir de">
            <Input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
          </Field>
          <Field label="Jusqu'à" hint="Optionnel" className="col-span-2 sm:col-span-1">
            <Input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} />
          </Field>
        </div>

        {kind !== 'transfer' && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={kind === 'income' ? 'Payeur / client' : 'Bénéficiaire'} hint="Optionnel">
              <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
            </Field>
            {kind === 'expense' && scope === 'pro' && employees.length > 0 && (
              <Field label="Employé">
                <Select
                  value={employeeId}
                  onChange={(e) => {
                    setEmployeeId(e.target.value)
                    const emp = d.db.employees[e.target.value]
                    if (emp) {
                      setCounterparty(emp.name)
                      setCategory('salaires_employes')
                      if (!label) setLabel(`Salaire ${emp.name}`)
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

        {kind !== 'transfer' && (
          <Switch
            checked={variable}
            onChange={setVariable}
            label="Montant variable"
            hint={
              kind === 'income'
                ? "Pour un salaire qui dépend de ton CA. Le montant ci-dessus sert d'estimation, puis l'app prend la moyenne de tes 3 derniers mois validés. Tu saisis le montant exact quand tu es payé."
                : "Pour une facture qui change chaque mois. Le montant ci-dessus sert d'estimation, puis l'app prend la moyenne de tes 3 derniers mois validés."
            }
          />
        )}
        {existing?.variable && variable && expectedAmount(d.db, existing) !== existing.amount && (
          <p className="-mt-2 text-xs text-muted">
            Estimation actuelle : <b className="text-ink">≈ {formatMoney(expectedAmount(d.db, existing), acc?.currency ?? d.base)}</b> (moyenne de {recurringHistory(d.db, existing).length} mois)
          </p>
        )}
        {!(kind !== 'transfer' && variable) && (
        <Switch
          checked={auto}
          onChange={setAuto}
          label={kind === 'income' ? 'Versement automatique' : kind === 'transfer' ? 'Virement automatique' : 'Prélèvement automatique'}
          hint="Validé tout seul à sa date chaque mois, tu n'as rien à cocher. Tu peux toujours le modifier ou l'annuler."
        />
        )}
        <Switch checked={active} onChange={setActive} label="Actif" hint="Désactive-le pour le mettre en pause sans le supprimer." />
        {error && <div className="text-sm font-medium text-neg">{error}</div>}
      </div>
    </Modal>
  )
}

/** Valider une échéance : crée le mouvement réel (montant ajustable). */
export function ValidateForm({ onClose, recurringId, month }: { onClose: () => void; recurringId: string; month: string }) {
  const d = useDerived()
  const r = d.db.recurrings[recurringId]
  const estimate = r ? expectedAmount(d.db, r) : 0
  // Montant variable : champ vide pour saisir le montant exact, l'estimation reste visible en indice.
  const [amount, setAmount] = useState(r && !r.variable ? String(r.amount).replace('.', ',') : '')
  const [date, setDate] = useState(r ? dayInMonth(month, r.day) : '')
  const [error, setError] = useState('')
  if (!r) return null
  const history = r.variable ? recurringHistory(d.db, r) : []
  const acc = d.db.accounts[r.accountId]
  const to = r.toAccountId ? d.db.accounts[r.toAccountId] : undefined

  const save = () => {
    const amt = parseAmount(amount)
    if (!(amt > 0)) return setError(r.variable ? 'Indique le montant exact reçu' : 'Indique un montant')
    const tx: Transaction = {
      id: uid(),
      kind: r.kind,
      date,
      amount: amt,
      accountId: r.accountId,
      toAccountId: r.toAccountId,
      toAmount: r.toAccountId && to && acc && to.currency !== acc.currency ? d.convert(amt, acc.currency, to.currency) : undefined,
      label: r.label,
      category: r.category,
      counterparty: r.counterparty,
      employeeId: r.employeeId,
      scope: r.scope,
      recurringId: r.id,
      recurringPeriod: month,
      createdAt: Date.now(),
    }
    useData.getState().put('transactions', tx)
    toast(`${r.label} validé`)
    onClose()
  }

  return (
    <Modal
      title={`Valider « ${r.label} »`}
      subtitle={`${monthLabel(month)} · ${acc?.name ?? ''}${to ? ` → ${to.name}` : ''}`}
      size="sm"
      onClose={onClose}
      icon={<span className="size-10 rounded-xl bg-emerald-500/12 text-emerald-600 flex items-center justify-center shrink-0"><CheckCircle2 className="size-5" /></span>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={save}>Valider</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label={r.variable ? (r.kind === 'income' ? 'Montant exact reçu' : 'Montant exact payé') : 'Montant réel'}
          hint={r.variable ? `Estimation : ≈ ${formatMoney(estimate, acc?.currency ?? d.base)}${history.length ? ` (moyenne de ${history.length} mois)` : ''}` : `Prévu : ${formatMoney(r.amount, acc?.currency ?? d.base)}`}
        >
          <AmountInput big autoFocus value={amount} onChange={setAmount} currency={acc ? ccy(acc.currency) : ''} placeholder={r.variable ? `≈ ${String(Math.round(estimate * 100) / 100).replace('.', ',')}` : undefined} />
        </Field>
        {history.length > 0 && (
          <div className="flex flex-wrap gap-1.5 -mt-1">
            {history.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setAmount(String(t.amount).replace('.', ','))}
                className="h-8 px-3 rounded-full border border-line-strong text-[12.5px] text-ink-2 hover:text-ink hover:border-indigo-400"
              >
                {monthLabel(t.recurringPeriod!, 'short')} : <b className="text-ink">{formatMoney(t.amount, acc?.currency ?? d.base)}</b>
              </button>
            ))}
          </div>
        )}
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {error && <div className="text-sm font-medium text-neg">{error}</div>}
      </div>
    </Modal>
  )
}
