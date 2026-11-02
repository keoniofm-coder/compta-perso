import { useMemo, useState } from 'react'
import { ArrowDownLeft, CheckCircle2, CircleDashed, Pencil, Plus, ShoppingBag, TrendingDown, Wallet } from 'lucide-react'
import { SeriesLines, SimpleLine } from '../components/charts'
import { Badge, Button, Card, CardHeader, EmptyState, Money, PageHeader, Select, Stat, cx } from '../components/ui'
import { courantMonths, lastMonths, useDerived, type CourantMonth } from '../lib/calc'
import { formatMoney } from '../lib/currency'
import { addMonths, currentMonth, monthLabel, monthOf } from '../lib/dates'
import { openModal, useUI } from '../lib/ui'

function MonthRow({ m, currency, accountId, isCurrent }: { m: CourantMonth; currency: string; accountId: string; isCurrent: boolean }) {
  const action = () => openModal({ type: 'checkpoint', accountId, month: m.month, txId: m.checkpoint?.id })
  return (
    <tr className="border-t border-line hover:bg-surface-2/60 transition-colors">
      <td className="py-3 pl-4 pr-2">
        <div className="font-medium text-ink text-sm">{monthLabel(m.month)}</div>
        {m.checkpoint ? <Badge tone="pos"><CheckCircle2 className="size-3" /> Clôturé</Badge> : isCurrent ? <Badge tone="info">En cours</Badge> : <Badge tone="warn"><CircleDashed className="size-3" /> À clôturer</Badge>}
      </td>
      <td className="py-3 px-2 text-right"><Money value={m.opening} currency={currency} className="text-sm text-ink-2" /></td>
      <td className="py-3 px-2 text-right"><Money value={m.inflows} currency={currency} sign className="text-sm text-pos font-medium" /></td>
      <td className="py-3 px-2 text-right"><Money value={-m.outflows} currency={currency} sign className="text-sm text-ink-2" /></td>
      <td className="py-3 px-2 text-right">{m.spent != null ? <Money value={-m.spent} currency={currency} sign className="text-sm font-semibold text-neg" /> : <span className="text-muted text-sm">—</span>}</td>
      <td className="py-3 px-2 text-right"><Money value={m.checkpoint ? m.closing : m.expected} currency={currency} className={cx('text-sm font-bold', m.checkpoint ? 'text-ink' : 'text-muted')} /></td>
      <td className="py-3 pl-2 pr-4 text-right">
        <Button size="sm" variant={m.checkpoint ? 'ghost' : 'soft'} icon={m.checkpoint ? Pencil : undefined} onClick={action}>
          {m.checkpoint ? '' : 'Clôturer'}
        </Button>
      </td>
    </tr>
  )
}

function MonthCard({ m, currency, accountId, isCurrent }: { m: CourantMonth; currency: string; accountId: string; isCurrent: boolean }) {
  return (
    <button type="button" onClick={() => openModal({ type: 'checkpoint', accountId, month: m.month, txId: m.checkpoint?.id })} className="w-full text-left rounded-2xl border border-line bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-ink">{monthLabel(m.month)}</span>
        {m.checkpoint ? <Badge tone="pos">Clôturé</Badge> : isCurrent ? <Badge tone="info">En cours</Badge> : <Badge tone="warn">À clôturer</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-y-1.5 text-[13px]">
        <span className="text-muted">Report</span>
        <Money value={m.opening} currency={currency} className="text-right text-ink-2" />
        <span className="text-muted">Approvisionné</span>
        <Money value={m.inflows} currency={currency} sign className="text-right text-pos" />
        {m.outflows > 0 && (
          <>
            <span className="text-muted">Sorties enregistrées</span>
            <Money value={-m.outflows} currency={currency} sign className="text-right text-ink-2" />
          </>
        )}
        {m.spent != null && (
          <>
            <span className="text-muted">Dépenses courantes</span>
            <Money value={-m.spent} currency={currency} sign className="text-right text-neg font-semibold" />
          </>
        )}
        <span className="text-ink font-medium">{m.checkpoint ? 'Reste fin de mois' : 'Disponible estimé'}</span>
        <Money value={m.checkpoint ? m.closing : m.expected} currency={currency} className="text-right font-bold text-ink" />
      </div>
    </button>
  )
}

export function Courant() {
  const d = useDerived()
  const privacy = useUI((s) => s.privacy)
  const courants = d.accounts.filter((s) => s.account.type === 'courant' && !s.account.archived)
  const [selected, setSelected] = useState(courants[0]?.account.id ?? '')
  const st = d.accountById.get(selected) ?? courants[0]
  const accountId = st?.account.id ?? ''
  const month = currentMonth()

  const months = useMemo(() => {
    if (!st) return []
    const start = [monthOf(st.account.initialDate), addMonths(month, -11)].sort()[1]
    return courantMonths(d, accountId, lastMonths(12).filter((m) => m >= start))
  }, [d, accountId, st, month])

  if (!st) {
    return (
      <div>
        <PageHeader eyebrow="Compte courant" title="Le compte de tous les jours" />
        <Card className="p-6">
          <EmptyState
            icon={Wallet}
            title="Pas encore de compte courant"
            text="Ici, tu suis ton compte du quotidien sans détailler chaque dépense : ce que tu y mets en début de mois, ce qu'il reste à la fin, et on calcule le reste."
            action={<Button variant="primary" icon={Plus} onClick={() => openModal({ type: 'account', preset: { type: 'courant' } })}>Créer mon compte courant</Button>}
          />
        </Card>
      </div>
    )
  }

  const a = st.account
  const cur = months[months.length - 1]
  const prev = months[months.length - 2]
  const closed = months.filter((m) => m.spent != null)
  const avgSpent = closed.length ? closed.slice(-6).reduce((s, m) => s + (m.spent ?? 0), 0) / Math.min(6, closed.length) : 0
  const avgIn = months.length ? months.slice(-6).reduce((s, m) => s + m.inflows, 0) / Math.min(6, months.length) : 0
  const lastClosed = closed[closed.length - 1]
  const toClose = prev && !prev.checkpoint ? prev.month : !cur?.checkpoint ? month : undefined

  return (
    <div>
      <PageHeader
        eyebrow="Compte courant"
        title="Suivi du quotidien"
        subtitle="Ce que tu mets dessus, ce qu'il reste : le reste, ce sont tes dépenses courantes."
        actions={
          <>
            {courants.length > 1 && (
              <Select value={accountId} onChange={(e) => setSelected(e.target.value)} className="h-10 w-52">
                {courants.map((c) => (
                  <option key={c.account.id} value={c.account.id}>{c.account.name}</option>
                ))}
              </Select>
            )}
            <Button icon={ArrowDownLeft} onClick={() => openModal({ type: 'tx', kind: 'transfer', preset: { toAccountId: a.id } })}>Approvisionner</Button>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-5 lg:gap-6 mb-6">
        <div className="lg:col-span-2 relative overflow-hidden rounded-[1.5rem] p-6 sm:p-7 text-white shadow-xl shadow-sky-900/20 anim-fade-up" style={{ background: 'radial-gradient(120% 140% at 100% 0%, rgba(56,189,248,.55), transparent 55%), linear-gradient(135deg,#1d4ed8,#0369a1 60%,#0e7490)' }}>
          <div className="absolute -right-12 -bottom-16 size-64 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="text-sm text-white/75 font-medium">{a.name} · {monthLabel(month)}</div>
            <div className={cx('text-4xl sm:text-5xl font-bold tracking-tight mt-1 tnum', privacy && 'blurred')}>{formatMoney(cur?.expected ?? st.cash, a.currency)}</div>
            <div className="text-sm text-white/75 mt-1">disponible estimé (avant tes dépenses du quotidien)</div>
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { l: `Report ${prev ? monthLabel(prev.month, 'short').toLowerCase() : ''}`, v: cur?.opening ?? 0, s: '' },
                { l: 'Approvisionné', v: cur?.inflows ?? 0, s: '+' },
                { l: 'Sorties notées', v: cur?.outflows ? -cur.outflows : 0, s: '' },
              ].map((x) => (
                <div key={x.l} className="rounded-xl bg-white/12 border border-white/15 px-3 py-2.5">
                  <div className="text-[11px] text-white/70 truncate">{x.l}</div>
                  <div className={cx('text-sm sm:text-base font-semibold tnum', privacy && 'blurred')}>{x.s}{formatMoney(x.v, a.currency, { compact: true })}</div>
                </div>
              ))}
            </div>
            {avgSpent > 0 && cur && !cur.checkpoint && (
              <div className="mt-5 rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-sm text-white/90">
                À ton rythme habituel (≈ <b className={cx(privacy && 'blurred')}>{formatMoney(avgSpent, a.currency, { decimals: 0 })}</b> de dépenses courantes par mois), il devrait te rester environ{' '}
                <b className={cx('text-white', privacy && 'blurred')}>{formatMoney(cur.expected - avgSpent, a.currency, { decimals: 0 })}</b> fin {monthLabel(month).split(' ')[0].toLowerCase()}.
              </div>
            )}
            {toClose && (
              <button
                type="button"
                onClick={() => openModal({ type: 'checkpoint', accountId: a.id, month: toClose })}
                className="mt-5 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white text-sky-800 font-semibold text-sm h-11 px-5 shadow-lg hover:bg-sky-50 transition"
              >
                <CheckCircle2 className="size-4" /> Clôturer {monthLabel(toClose).toLowerCase()} — il me reste…
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4">
          <Stat label="Dépenses courantes / mois" value={avgSpent} currency={a.currency} icon={ShoppingBag} color="#0ea5e9" sub={closed.length ? `Moyenne sur ${Math.min(6, closed.length)} mois clôturés` : 'Clôture un mois pour la voir'} />
          <Stat
            label={lastClosed ? `Dépensé en ${monthLabel(lastClosed.month, 'short').toLowerCase()}` : 'Dernier mois'}
            value={lastClosed?.spent ?? 0}
            currency={a.currency}
            icon={TrendingDown}
            color="#f43f5e"
            sub={lastClosed ? <>Reste {formatMoney(lastClosed.closing, a.currency)} reporté</> : '—'}
          />
          <Stat label="Approvisionnement moyen" value={avgIn} currency={a.currency} icon={ArrowDownLeft} color="#10b981" className="col-span-2 lg:col-span-1" sub="Virements reçus par mois" />
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-5 lg:gap-6 mb-6">
        <Card className="p-5 sm:p-6 lg:col-span-3">
          <CardHeader title="Approvisionné vs dépensé" subtitle="Dépensé = sorties notées + dépenses courantes" />
          <SeriesLines
            data={months.map((m) => ({ label: monthLabel(m.month, 'short'), inflows: m.inflows, spent: (m.spent ?? 0) + m.outflows }))}
            series={[
              { key: 'inflows', label: 'Approvisionné', color: 'blue' },
              { key: 'spent', label: 'Dépensé', color: 'red' },
            ]}
            currency={a.currency}
            height={230}
          />
        </Card>
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <CardHeader title="Reste en fin de mois" subtitle="Ce qui est reporté sur le mois suivant" />
          <SimpleLine data={months.filter((m) => m.checkpoint).map((m) => ({ label: monthLabel(m.month, 'short'), value: m.closing }))} dataKey="value" currency={a.currency} color="blue" height={258} label="Reste" />
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-5 sm:p-6 pb-3">
          <CardHeader title="Mois par mois" subtitle="Clique sur un mois pour le clôturer ou corriger ce qu'il restait" />
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="text-[11.5px] uppercase tracking-wider text-muted">
                <th className="text-left font-semibold py-2 pl-4 pr-2">Mois</th>
                <th className="text-right font-semibold py-2 px-2">Report</th>
                <th className="text-right font-semibold py-2 px-2">Approvisionné</th>
                <th className="text-right font-semibold py-2 px-2">Sorties notées</th>
                <th className="text-right font-semibold py-2 px-2">Dépenses courantes</th>
                <th className="text-right font-semibold py-2 px-2">Reste</th>
                <th className="py-2 pl-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <MonthRow key={m.month} m={m} currency={a.currency} accountId={a.id} isCurrent={m.month === month} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden p-4 pt-0 space-y-3">
          {[...months].reverse().map((m) => (
            <MonthCard key={m.month} m={m} currency={a.currency} accountId={a.id} isCurrent={m.month === month} />
          ))}
        </div>
      </Card>
    </div>
  )
}
