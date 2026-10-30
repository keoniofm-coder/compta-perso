import { useMemo, useRef, useState } from 'react'
import { Download, KeyRound, LogOut, Monitor, Moon, Plus, RefreshCw, Smartphone, Sparkles, Sun, Trash2, Upload, X } from 'lucide-react'
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Segmented, Select, Switch } from '../components/ui'
import { CurrencySelect } from '../forms/AccountForms'
import { currencyDef, formatMoney, parseAmount, rateOf, useRates } from '../lib/currency'
import { useDerived } from '../lib/calc'
import { today } from '../lib/dates'
import { buildDemo } from '../lib/demo'
import { categoryMeta } from '../lib/meta'
import { LOCAL_USER, saveSettings, uid, useData, useSettings } from '../lib/store'
import { supabase } from '../lib/supabase'
import { COLLECTIONS, type CollectionName, type DB, type Scope } from '../lib/types'
import { confirm, toast, useUI, type ThemeMode } from '../lib/ui'

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function SettingsPage() {
  const d = useDerived()
  const settings = useSettings()
  const db = useData((s) => s.db)
  const userId = useData((s) => s.userId)
  const theme = useUI((s) => s.theme)
  const setTheme = useUI((s) => s.setTheme)
  const privacy = useUI((s) => s.privacy)
  const setPrivacy = useUI((s) => s.setPrivacy)
  const rates = useRates((s) => s.rates)
  const fetchedAt = useRates((s) => s.fetchedAt)
  const loading = useRates((s) => s.loading)
  const ratesError = useRates((s) => s.error)
  const refresh = useRates((s) => s.refresh)
  const [name, setName] = useState(settings.displayName ?? '')
  const [newCat, setNewCat] = useState({ label: '', kind: 'expense' as 'income' | 'expense', scope: 'perso' as Scope })
  const [pw, setPw] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const used = useMemo(() => {
    const s = new Set<string>()
    for (const a of Object.values(db.accounts)) s.add(a.currency)
    for (const h of Object.values(db.holdings)) s.add(h.currency)
    for (const a of Object.values(db.assets)) s.add(a.currency)
    s.delete(settings.baseCurrency)
    return [...s]
  }, [db, settings.baseCurrency])
  const overrides = settings.rateOverrides ?? {}
  const hasDemo = COLLECTIONS.some((c) => Object.values(db[c]).some((x) => (x as { demo?: boolean }).demo))

  const exportJSON = () => {
    download(`trezo-sauvegarde-${today()}.json`, JSON.stringify({ app: 'trezo', version: 1, exportedAt: new Date().toISOString(), db }, null, 2), 'application/json')
  }
  const exportCSV = () => {
    const rows = [['Date', 'Type', 'Libellé', 'Catégorie', 'Compte', 'Vers', 'Montant', 'Devise', 'Montant reçu', 'Perso/Pro', 'Tiers', 'Note']]
    for (const t of d.transactions) {
      const a = db.accounts[t.accountId]
      const to = t.toAccountId ? db.accounts[t.toAccountId] : undefined
      const amount = t.kind === 'checkpoint' ? d.checkpointDelta.get(t.id) ?? 0 : t.kind === 'expense' ? -t.amount : t.amount
      rows.push([
        t.date,
        { income: 'Entrée', expense: 'Sortie', transfer: 'Virement', checkpoint: 'Ajustement' }[t.kind],
        t.label,
        t.category ? categoryMeta(t.category).label : '',
        a?.name ?? '',
        to?.name ?? '',
        String(amount).replace('.', ','),
        a?.currency ?? '',
        t.toAmount != null ? String(t.toAmount).replace('.', ',') : '',
        t.scope,
        t.counterparty ?? '',
        t.note ?? '',
      ])
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    download(`trezo-mouvements-${today()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8')
  }
  const importJSON = async (file: File) => {
    try {
      const json = JSON.parse(await file.text())
      const incoming = (json.db ?? json) as DB
      if (!incoming || typeof incoming !== 'object' || !incoming.accounts) throw new Error('Fichier non reconnu')
      const count = COLLECTIONS.reduce((s, c) => s + Object.keys(incoming[c] ?? {}).length, 0)
      const ok = await confirm({ title: 'Remplacer toutes tes données ?', message: `Le fichier contient ${count} éléments. Tes données actuelles seront remplacées.`, confirmLabel: 'Importer', danger: true })
      if (!ok) return
      useData.getState().replaceAll(incoming)
      toast('Sauvegarde importée')
    } catch (e) {
      toast((e as Error).message || 'Import impossible', 'error')
    }
  }
  const removeDemo = async () => {
    const ok = await confirm({ title: "Effacer les données d'exemple ?", message: 'Seuls les éléments de démonstration seront supprimés.', confirmLabel: 'Effacer', danger: true })
    if (!ok) return
    const items: { collection: CollectionName; id: string }[] = []
    for (const c of COLLECTIONS) for (const x of Object.values(db[c])) if ((x as { demo?: boolean }).demo) items.push({ collection: c, id: (x as { id: string }).id })
    useData.getState().removeMany(items)
    toast("Données d'exemple effacées")
  }
  const wipe = async () => {
    const ok = await confirm({ title: 'Tout effacer ?', message: 'Tous tes comptes, mouvements et placements seront supprimés définitivement. Pense à exporter une sauvegarde avant.', confirmLabel: 'Tout effacer', danger: true })
    if (!ok) return
    const items: { collection: CollectionName; id: string }[] = []
    for (const c of COLLECTIONS) if (c !== 'settings') for (const x of Object.values(db[c])) items.push({ collection: c, id: (x as { id: string }).id })
    useData.getState().removeMany(items)
    toast('Données effacées')
  }
  const changePw = async () => {
    if (pw.length < 8) return toast('8 caractères minimum', 'error')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) toast(error.message, 'error')
    else {
      toast('Mot de passe modifié')
      setPw('')
    }
  }

  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Réglages" title="Ton espace" subtitle="Profil, devises, données et sécurité" />
      <div className="space-y-5">
        <Card className="p-5 sm:p-6">
          <CardHeader title="Profil" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Prénom affiché">
              <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => saveSettings({ displayName: name.trim() || undefined })} />
            </Field>
            <Field label="Devise principale" hint="Tous les totaux et graphiques sont convertis dans cette devise.">
              <CurrencySelect value={settings.baseCurrency} onChange={(v) => saveSettings({ baseCurrency: v })} />
            </Field>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <CardHeader title="Apparence" />
          <div className="space-y-4">
            <Segmented<ThemeMode>
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'auto', label: 'Auto', icon: Monitor },
                { value: 'light', label: 'Clair', icon: Sun },
                { value: 'dark', label: 'Sombre', icon: Moon },
              ]}
            />
            <Switch checked={privacy} onChange={setPrivacy} label="Mode discret" hint="Floute tous les montants (pratique en public). Aussi accessible via l'icône 👁 en haut." />
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <CardHeader
            title="Devises & taux de change"
            subtitle={fetchedAt ? `Taux mis à jour le ${new Date(fetchedAt).toLocaleString('fr-FR')} (BCE + CoinGecko)` : 'Taux par défaut (approximatifs) — actualise pour avoir les vrais cours'}
            action={<Button size="sm" icon={RefreshCw} disabled={loading} onClick={() => void refresh(true)}>Actualiser</Button>}
          />
          {ratesError && <p className="text-xs text-amber-600 mb-3">{ratesError}</p>}
          {used.length === 0 ? (
            <p className="text-sm text-muted">Tous tes comptes sont en {settings.baseCurrency}.</p>
          ) : (
            <div className="divide-y divide-line">
              {used.map((c) => {
                const def = currencyDef(c)
                const auto = rates[c] && rates[settings.baseCurrency] ? rates[c] / rates[settings.baseCurrency] : undefined
                const eff = d.convert(1, c)
                return (
                  <div key={c} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="w-40">
                      <div className="text-sm font-semibold text-ink">{c}</div>
                      <div className="text-xs text-muted">{def.name}</div>
                    </div>
                    <div className="flex-1 text-sm text-ink-2">
                      1 {c} = <b className="text-ink">{formatMoney(eff, settings.baseCurrency, { decimals: eff < 1 ? 4 : 2 })}</b>
                      {overrides[c] ? <Badge tone="warn" className="ml-2">forcé</Badge> : auto ? null : <Badge tone="neg" className="ml-2">indisponible</Badge>}
                    </div>
                    <Input
                      className="w-40 h-9 text-sm"
                      placeholder="Forcer un taux (€)"
                      defaultValue={overrides[c] ? String(overrides[c] / (rateOf(settings.baseCurrency, rates, overrides) ?? 1)).replace('.', ',') : ''}
                      onBlur={(e) => {
                        const v = parseAmount(e.target.value)
                        const next = { ...overrides }
                        if (v > 0) next[c] = v * (rateOf(settings.baseCurrency, rates, overrides) ?? 1)
                        else delete next[c]
                        saveSettings({ rateOverrides: next })
                      }}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <CardHeader title="Catégories personnalisées" subtitle="En plus des catégories intégrées" />
          <div className="flex flex-wrap gap-2 mb-4">
            {(settings.customCategories ?? []).map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 pl-3 pr-1 h-8 text-[13px] text-ink">
                {c.label}
                <span className="text-muted text-xs">· {c.kind === 'income' ? 'entrée' : 'sortie'} {c.scope}</span>
                <button type="button" aria-label="Supprimer" className="size-6 rounded-full hover:bg-surface flex items-center justify-center" onClick={() => saveSettings({ customCategories: (settings.customCategories ?? []).filter((x) => x.id !== c.id) })}>
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            {!(settings.customCategories ?? []).length && <span className="text-sm text-muted">Aucune pour l'instant.</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Input className="flex-1 min-w-48 h-10" placeholder="Nom de la catégorie" value={newCat.label} onChange={(e) => setNewCat({ ...newCat, label: e.target.value })} />
            <Select className="h-10 w-32" value={newCat.kind} onChange={(e) => setNewCat({ ...newCat, kind: e.target.value as 'income' | 'expense' })}>
              <option value="expense">Sortie</option>
              <option value="income">Entrée</option>
            </Select>
            <Select className="h-10 w-28" value={newCat.scope} onChange={(e) => setNewCat({ ...newCat, scope: e.target.value as Scope })}>
              <option value="perso">Perso</option>
              <option value="pro">Pro</option>
            </Select>
            <Button
              icon={Plus}
              onClick={() => {
                if (!newCat.label.trim()) return
                saveSettings({ customCategories: [...(settings.customCategories ?? []), { id: `c_${uid().slice(0, 8)}`, ...newCat, label: newCat.label.trim() }] })
                setNewCat({ ...newCat, label: '' })
              }}
            >
              Ajouter
            </Button>
          </div>
        </Card>

        {Object.keys(db.splits).length > 0 && (
          <Card className="p-5 sm:p-6">
            <CardHeader title="Modèles de répartition" />
            <div className="divide-y divide-line">
              {Object.values(db.splits).map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink">{s.name}</div>
                    <div className="text-xs text-muted truncate">{s.lines.map((l) => `${db.accounts[l.accountId]?.name ?? '?'} ${formatMoney(l.amount, db.accounts[s.sourceAccountId]?.currency ?? settings.baseCurrency)}`).join(' · ')}</div>
                  </div>
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={() => useData.getState().remove('splits', s.id)} />
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-5 sm:p-6">
          <CardHeader title="Données" subtitle={userId === LOCAL_USER ? 'Mode local : données stockées sur cet appareil uniquement' : 'Synchronisées sur ton compte, accessibles depuis tous tes appareils'} />
          <div className="flex flex-wrap gap-2">
            <Button icon={Download} onClick={exportJSON}>Sauvegarde complète (JSON)</Button>
            <Button icon={Download} onClick={exportCSV}>Mouvements (CSV / Excel)</Button>
            <Button icon={Upload} onClick={() => fileRef.current?.click()}>Importer une sauvegarde</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])} />
          </div>
          <div className="h-px bg-line my-5" />
          <div className="flex flex-wrap gap-2">
            {hasDemo ? (
              <Button icon={Sparkles} onClick={removeDemo}>Effacer les données d'exemple</Button>
            ) : (
              <Button
                variant="ghost"
                icon={Sparkles}
                onClick={async () => {
                  if (await confirm({ title: "Charger des données d'exemple ?", message: 'Elles s’ajoutent à tes données et pourront être effacées en un clic.', confirmLabel: 'Charger' })) {
                    useData.getState().putMany(buildDemo())
                    toast("Exemple chargé")
                  }
                }}
              >
                Charger un exemple
              </Button>
            )}
            <Button variant="ghost" icon={Trash2} className="text-rose-600" onClick={wipe}>Tout effacer</Button>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <CardHeader title="Installer l'app sur ton téléphone" icon={Smartphone} />
          <div className="grid sm:grid-cols-2 gap-4 text-sm text-ink-2">
            <div className="rounded-2xl bg-surface-2 border border-line p-4">
              <div className="font-semibold text-ink mb-1">iPhone (Safari)</div>
              Bouton Partager → « Sur l'écran d'accueil ». Trezo s'ouvre ensuite en plein écran comme une vraie app.
            </div>
            <div className="rounded-2xl bg-surface-2 border border-line p-4">
              <div className="font-semibold text-ink mb-1">Android (Chrome)</div>
              Menu ⋮ → « Installer l'application » (ou « Ajouter à l'écran d'accueil »).
            </div>
          </div>
        </Card>

        {userId !== LOCAL_USER && (
          <Card className="p-5 sm:p-6">
            <CardHeader title="Sécurité" icon={KeyRound} />
            <div className="flex flex-wrap gap-2 items-end">
              <Field label="Nouveau mot de passe" className="flex-1 min-w-56">
                <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
              </Field>
              <Button onClick={changePw}>Changer</Button>
            </div>
            <div className="h-px bg-line my-5" />
            <Button
              variant="ghost"
              icon={LogOut}
              onClick={async () => {
                await supabase.auth.signOut()
                useData.getState().close()
              }}
            >
              Se déconnecter
            </Button>
          </Card>
        )}
      </div>
    </div>
  )
}
