import { useState } from 'react'
import { Plus, Save, Split, X } from 'lucide-react'
import { AccountSelect, accountColor } from '../components/common'
import { SegmentBar } from '../components/charts'
import { AmountInput, Button, Field, Input, Modal, Select, Switch, cx } from '../components/ui'
import { useDerived } from '../lib/calc'
import { formatMoney, isCrypto, parseAmount } from '../lib/currency'
import { monthLabel, monthOf, today } from '../lib/dates'
import { uid, useData } from '../lib/store'
import type { SplitTemplate, Transaction } from '../lib/types'
import { toast, useUI } from '../lib/ui'
import { CategoryGrid, ccy, useActiveAccounts } from './shared'

interface Line {
  accountId: string
  amount: string
  toAmount: string
  touched: boolean
}

export function SplitForm({ onClose, accountId: acc0 }: { onClose: () => void; accountId?: string }) {
  const d = useDerived()
  const dark = useUI((s) => s.isDark)
  const accounts = useActiveAccounts()
  const templates = Object.values(d.db.splits)
  const firstTpl = templates[0]
  const defaultSource = acc0 ?? firstTpl?.sourceAccountId ?? (accounts.find((a) => a.type === 'banque') ?? accounts.find((a) => a.type === 'pro') ?? accounts[0])?.id ?? ''

  const [sourceId, setSourceId] = useState(defaultSource)
  const [isNewIncome, setIsNewIncome] = useState(true)
  const [total, setTotal] = useState('')
  const [incomeLabel, setIncomeLabel] = useState(`Salaire ${monthLabel(monthOf(today())).split(' ')[0].toLowerCase()}`)
  const [incomeCategory, setIncomeCategory] = useState('salaire')
  const [date, setDate] = useState(today())
  const [lines, setLines] = useState<Line[]>(
    firstTpl
      ? firstTpl.lines.map((l) => ({ accountId: l.accountId, amount: String(l.amount).replace('.', ','), toAmount: '', touched: false }))
      : [
          { accountId: accounts.find((a) => a.type === 'courant')?.id ?? '', amount: '', toAmount: '', touched: false },
          { accountId: '', amount: '', toAmount: '', touched: false },
        ],
  )
  const [tplId, setTplId] = useState(firstTpl?.id ?? '')
  const [saveTpl, setSaveTpl] = useState(!firstTpl)
  const [tplName, setTplName] = useState(firstTpl?.name ?? 'Ma répartition mensuelle')
  const [error, setError] = useState('')

  const src = d.db.accounts[sourceId]
  const totalNum = parseAmount(total)
  const allocated = lines.reduce((s, l) => s + parseAmount(l.amount), 0)
  const rest = totalNum - allocated

  const loadTpl = (id: string) => {
    setTplId(id)
    const t = d.db.splits[id]
    if (!t) return
    setSourceId(t.sourceAccountId)
    setTplName(t.name)
    setLines(t.lines.map((l) => ({ accountId: l.accountId, amount: String(l.amount).replace('.', ','), toAmount: '', touched: false })))
  }

  const lineTo = (l: Line) => {
    const a = d.db.accounts[l.accountId]
    if (!a || !src || a.currency === src.currency) return undefined
    return l.touched ? parseAmount(l.toAmount) : d.convert(parseAmount(l.amount), src.currency, a.currency)
  }

  const save = () => {
    setError('')
    if (!src) return setError('Choisis le compte où arrive l’argent')
    const valid = lines.filter((l) => l.accountId && parseAmount(l.amount) > 0 && l.accountId !== sourceId)
    if (!valid.length) return setError('Ajoute au moins un compte de destination avec un montant')
    if (isNewIncome && !(totalNum > 0)) return setError('Indique le montant de la rentrée')
    const groupId = uid()
    const now = Date.now()
    const items: { collection: 'transactions' | 'splits'; item: Transaction | SplitTemplate }[] = []
    if (isNewIncome) {
      items.push({
        collection: 'transactions',
        item: {
          id: uid(),
          kind: 'income',
          date,
          amount: totalNum,
          accountId: sourceId,
          label: incomeLabel.trim() || 'Rentrée',
          category: incomeCategory || 'autre_entree',
          scope: src.scope === 'pro' && incomeCategory !== 'salaire' && incomeCategory !== 'remu_agence' ? 'pro' : 'perso',
          groupId,
          createdAt: now,
        },
      })
    }
    valid.forEach((l, i) => {
      const a = d.db.accounts[l.accountId]
      items.push({
        collection: 'transactions',
        item: {
          id: uid(),
          kind: 'transfer',
          date,
          amount: parseAmount(l.amount),
          accountId: sourceId,
          toAccountId: l.accountId,
          toAmount: lineTo(l),
          label: `Répartition → ${a.name}`,
          scope: 'perso',
          groupId,
          createdAt: now + 1 + i,
        },
      })
    })
    if (saveTpl) {
      const tpl: SplitTemplate = {
        id: tplId || uid(),
        name: tplName.trim() || 'Ma répartition',
        sourceAccountId: sourceId,
        lines: valid.map((l) => ({ accountId: l.accountId, amount: parseAmount(l.amount) })),
      }
      items.push({ collection: 'splits', item: tpl })
    }
    useData.getState().putMany(items)
    toast(`Répartition enregistrée : ${valid.length} virement${valid.length > 1 ? 's' : ''}`)
    onClose()
  }

  const parts = lines
    .filter((l) => l.accountId && parseAmount(l.amount) > 0)
    .map((l, i) => {
      const a = d.db.accounts[l.accountId]
      return { key: `${l.accountId}-${i}`, value: parseAmount(l.amount), color: accountColor(a, dark), label: a?.name ?? '' }
    })
  if (rest > 0 && totalNum > 0) parts.push({ key: 'rest', value: rest, color: dark ? '#334155' : '#cbd5e1', label: 'Reste sur le compte' })

  return (
    <Modal
      title="Répartir une rentrée"
      subtitle="Ventile l'argent du mois vers tes comptes en un seul geste"
      size="lg"
      onClose={onClose}
      icon={<span className="size-10 rounded-xl brand-gradient text-white flex items-center justify-center shrink-0"><Split className="size-5" /></span>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={save}>Valider la répartition</Button>
        </>
      }
    >
      <div className="space-y-5">
        {templates.length > 0 && (
          <Field label="Modèle">
            <Select value={tplId} onChange={(e) => (e.target.value ? loadTpl(e.target.value) : setTplId(''))}>
              <option value="">Nouvelle répartition</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="L'argent arrive sur">
            <AccountSelect value={sourceId} onChange={setSourceId} accounts={accounts} />
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <div className="rounded-2xl border border-line bg-surface-2 p-4 space-y-3">
          <Switch
            checked={isNewIncome}
            onChange={setIsNewIncome}
            label="Enregistrer aussi la rentrée d'argent"
            hint={isNewIncome ? 'On crée l’entrée (ex. salaire) puis les virements.' : 'L’argent est déjà sur le compte : seuls les virements sont créés.'}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={isNewIncome ? 'Montant de la rentrée' : 'Montant à répartir (optionnel)'}>
              <AmountInput value={total} onChange={setTotal} currency={src ? ccy(src.currency) : ''} />
            </Field>
            {isNewIncome && (
              <Field label="Libellé">
                <Input value={incomeLabel} onChange={(e) => setIncomeLabel(e.target.value)} />
              </Field>
            )}
          </div>
          {isNewIncome && <CategoryGrid kind="income" scope="perso" value={incomeCategory} onChange={setIncomeCategory} />}
        </div>

        <div className="space-y-2.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Où va l'argent</div>
          {lines.map((l, i) => {
            const a = d.db.accounts[l.accountId]
            const to = lineTo(l)
            return (
              <div key={i} className="rounded-xl border border-line p-2.5 sm:p-0 sm:border-0 space-y-2">
                <div className="flex gap-2 items-start">
                  <span className="mt-4 size-2.5 rounded-full shrink-0" style={{ background: a ? accountColor(a, dark) : 'transparent' }} />
                  <div className="flex-1 min-w-0">
                    <AccountSelect value={l.accountId} exclude={sourceId} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, accountId: v, touched: false } : x)))} accounts={accounts} />
                  </div>
                  <AmountInput className="w-32 sm:w-40" value={l.amount} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: v, touched: false } : x)))} currency={src ? ccy(src.currency) : ''} />
                  <button type="button" className="h-11 px-1.5 text-muted hover:text-rose-500" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Retirer la ligne">
                    <X className="size-4" />
                  </button>
                </div>
                {to !== undefined && a && (
                  <div className="flex items-center gap-2 pl-4.5 sm:pl-5">
                    <span className="text-xs text-muted">soit</span>
                    <AmountInput
                      className="w-44"
                      value={l.touched ? l.toAmount : to ? String(+to.toFixed(isCrypto(a.currency) ? 8 : 2)).replace('.', ',') : ''}
                      onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, toAmount: v, touched: true } : x)))}
                      currency={ccy(a.currency)}
                    />
                    <span className="text-xs text-muted">{l.touched ? 'saisi' : 'au cours actuel'}</span>
                  </div>
                )}
              </div>
            )
          })}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="soft" icon={Plus} onClick={() => setLines([...lines, { accountId: '', amount: '', toAmount: '', touched: false }])}>Ajouter un compte</Button>
            {rest > 0 && lines.some((l) => !parseAmount(l.amount)) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const idx = lines.findIndex((l) => !parseAmount(l.amount))
                  setLines(lines.map((x, j) => (j === idx ? { ...x, amount: String(+rest.toFixed(2)).replace('.', ',') } : x)))
                }}
              >
                Mettre le reste ({src ? formatMoney(rest, src.currency) : ''})
              </Button>
            )}
          </div>
        </div>

        {(totalNum > 0 || allocated > 0) && src && (
          <div className="rounded-2xl bg-surface-2 border border-line p-4 space-y-3">
            <SegmentBar parts={parts} />
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="text-ink-2">Réparti : <b className="text-ink tnum">{formatMoney(allocated, src.currency)}</b></span>
              {totalNum > 0 && (
                <span className={cx('font-medium tnum', rest < -0.004 ? 'text-neg' : 'text-ink-2')}>
                  {rest < -0.004 ? `Dépassement de ${formatMoney(-rest, src.currency)}` : `Reste sur ${src.name} : ${formatMoney(rest, src.currency)}`}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-2 cursor-pointer">
            <input type="checkbox" checked={saveTpl} onChange={(e) => setSaveTpl(e.target.checked)} className="size-4 accent-indigo-500" />
            <Save className="size-4" /> {tplId ? 'Mettre à jour le modèle' : 'Enregistrer comme modèle'}
          </label>
          {saveTpl && <Input className="sm:flex-1 h-9" value={tplName} onChange={(e) => setTplName(e.target.value)} />}
        </div>

        {error && <div className="text-sm font-medium text-neg">{error}</div>}
      </div>
    </Modal>
  )
}
