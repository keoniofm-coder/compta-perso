import { useState } from 'react'
import { Archive, ChevronRight, Plus, Wallet } from 'lucide-react'
import { SegmentBar } from '../components/charts'
import { AccountIcon, useAccountColor } from '../components/common'
import { Badge, Button, Card, EmptyState, Money, PageHeader, cx } from '../components/ui'
import { useDerived, type AccountStat } from '../lib/calc'
import { currencyDef, formatPct } from '../lib/currency'
import { dateLabel } from '../lib/dates'
import { ACCOUNT_TYPE_ORDER, ACCOUNT_TYPES } from '../lib/meta'
import { openModal } from '../lib/ui'

function AccountCard({ s }: { s: AccountStat }) {
  const d = useDerived()
  const color = useAccountColor()(s.account)
  const last = s.events[s.events.length - 1]
  return (
    <a href={`#/comptes/${s.account.id}`} className={cx('card group relative overflow-hidden p-5 block hover:-translate-y-0.5 hover:shadow-lg transition-all', s.account.archived && 'opacity-60')}>
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <div className="absolute -right-10 -top-10 size-32 rounded-full opacity-[0.07] group-hover:opacity-[0.12] transition" style={{ background: color }} />
      <div className="flex items-start gap-3">
        <AccountIcon account={s.account} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink truncate">{s.account.name}</div>
          <div className="text-xs text-muted truncate">{s.account.institution || ACCOUNT_TYPES[s.account.type].label}</div>
        </div>
        <ChevronRight className="size-4 text-muted group-hover:translate-x-0.5 transition" />
      </div>
      <div className="mt-5">
        <Money value={s.total} currency={s.account.currency} className="text-2xl font-bold tracking-tight text-ink" />
        {s.account.currency !== d.base && (
          <div className="text-[13px] text-muted mt-0.5">
            ≈ <Money value={s.totalBase} currency={d.base} />
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {s.account.scope === 'pro' && <Badge tone="brand">Pro</Badge>}
        {currencyDef(s.account.currency).crypto && <Badge tone="warn">{s.account.currency}</Badge>}
        {s.holdings.length > 0 && <Badge tone="info">{s.holdings.length} position{s.holdings.length > 1 ? 's' : ''}</Badge>}
        {s.account.excludeFromNetWorth && <Badge>Hors patrimoine</Badge>}
        {s.account.archived && <Badge><Archive className="size-3" /> Archivé</Badge>}
        {last && <span className="text-[11.5px] text-muted ml-auto">Maj {dateLabel(last.date, { day: 'numeric', month: 'short' })}</span>}
      </div>
    </a>
  )
}

export function Accounts() {
  const d = useDerived()
  const colorOf = useAccountColor()
  const [showArchived, setShowArchived] = useState(false)
  const list = d.accounts.filter((s) => showArchived || !s.account.archived)
  const archivedCount = d.accounts.filter((s) => s.account.archived).length
  const total = list.filter((s) => !s.account.excludeFromNetWorth).reduce((sum, s) => sum + s.totalBase, 0)

  const groups = ACCOUNT_TYPE_ORDER.map((t) => ({ type: t, items: list.filter((s) => s.account.type === t) })).filter((g) => g.items.length)
  const parts = groups.map((g) => ({
    key: g.type,
    label: ACCOUNT_TYPES[g.type].plural,
    value: g.items.filter((s) => !s.account.excludeFromNetWorth).reduce((sum, s) => sum + s.totalBase, 0),
    color: colorOf({ type: g.type }),
  }))

  return (
    <div>
      <PageHeader
        eyebrow="Comptes"
        title={<Money value={total} currency={d.base} />}
        subtitle={`Total de tes ${list.length} comptes, converti en ${d.base}`}
        actions={
          <>
            {archivedCount > 0 && (
              <Button variant="ghost" size="sm" icon={Archive} onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? 'Masquer' : 'Voir'} les archivés ({archivedCount})
              </Button>
            )}
            <Button variant="primary" icon={Plus} onClick={() => openModal({ type: 'account' })}>Nouveau compte</Button>
          </>
        }
      />
      {list.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Wallet} title="Aucun compte" text="Ajoute tes comptes bancaires, livrets, wallets crypto, compte pro…" action={<Button variant="primary" icon={Plus} onClick={() => openModal({ type: 'account' })}>Ajouter un compte</Button>} />
        </Card>
      ) : (
        <>
          <Card className="p-5 mb-6 anim-fade-up">
            <SegmentBar parts={parts} className="h-3.5" />
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {parts.map((p) => (
                <span key={p.key} className="inline-flex items-center gap-2 text-[13px]">
                  <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                  <span className="text-ink-2">{p.label}</span>
                  <Money value={p.value} currency={d.base} compact className="font-semibold text-ink" />
                  <span className="text-muted text-xs">{total ? formatPct(p.value / total, false) : ''}</span>
                </span>
              ))}
            </div>
          </Card>
          <div className="space-y-8">
            {groups.map((g) => {
              const m = ACCOUNT_TYPES[g.type]
              const sum = g.items.reduce((s, x) => s + x.totalBase, 0)
              return (
                <section key={g.type} className="anim-fade-up">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-ink flex items-center gap-2">
                      <m.icon className="size-4.5" style={{ color: colorOf({ type: g.type }) }} />
                      {m.plural}
                      <span className="text-muted font-normal text-sm">· {g.items.length}</span>
                    </h2>
                    <Money value={sum} currency={d.base} className="text-sm font-semibold text-ink-2" />
                  </div>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {g.items.map((s) => (
                      <AccountCard key={s.account.id} s={s} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
