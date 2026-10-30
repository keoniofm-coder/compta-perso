import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  Bitcoin,
  BriefcaseBusiness,
  Building2,
  Car,
  CandlestickChart,
  Coins,
  CreditCard,
  Gem,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  Lightbulb,
  Megaphone,
  Package,
  PiggyBank,
  Plane,
  Receipt,
  RefreshCcw,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
  Wallet,
  Wifi,
  Wrench,
  Gift,
  Baby,
  Percent,
  Handshake,
  FileText,
  Hammer,
  Briefcase,
  LineChart,
  Layers,
  Shield,
  ChartPie,
  Rocket,
} from 'lucide-react'
import type { AccountType, AssetCategory, AssetClass, LiabilityCategory, Scope } from './types'

/** Palette catégorielle validée (ordre fixe), avec variantes sombres. */
export const SERIES = {
  blue: { light: '#2a78d6', dark: '#3987e5' },
  orange: { light: '#eb6834', dark: '#d95926' },
  aqua: { light: '#1baf7a', dark: '#199e70' },
  yellow: { light: '#eda100', dark: '#c98500' },
  magenta: { light: '#e87ba4', dark: '#d55181' },
  green: { light: '#008300', dark: '#008300' },
  violet: { light: '#6250d6', dark: '#9085e9' },
  red: { light: '#e34948', dark: '#e66767' },
  slate: { light: '#7c8595', dark: '#8b93a3' },
} as const
export type SeriesKey = keyof typeof SERIES

export interface AccountTypeMeta {
  label: string
  plural: string
  icon: LucideIcon
  series: SeriesKey
  hint: string
  gradient: string
}

export const ACCOUNT_TYPES: Record<AccountType, AccountTypeMeta> = {
  courant: {
    label: 'Compte courant',
    plural: 'Comptes courants',
    icon: Wallet,
    series: 'blue',
    hint: 'Le compte de tous les jours : suivi mensuel global',
    gradient: 'from-sky-500 to-blue-600',
  },
  banque: {
    label: 'Compte bancaire',
    plural: 'Autres comptes bancaires',
    icon: Landmark,
    series: 'violet',
    hint: 'Compte de réception, compte joint, néobanque…',
    gradient: 'from-indigo-500 to-violet-600',
  },
  epargne: {
    label: 'Épargne',
    plural: 'Épargne',
    icon: PiggyBank,
    series: 'aqua',
    hint: 'Livret A, LDDS, LEP, compte à terme…',
    gradient: 'from-emerald-500 to-teal-600',
  },
  crypto: {
    label: 'Crypto',
    plural: 'Crypto',
    icon: Bitcoin,
    series: 'orange',
    hint: 'Exchange (Binance, Kraken…) ou wallet (Ledger…)',
    gradient: 'from-amber-500 to-orange-600',
  },
  invest: {
    label: 'Investissement',
    plural: 'Investissements',
    icon: CandlestickChart,
    series: 'violet',
    hint: 'PEA, compte-titres, assurance-vie, SCPI…',
    gradient: 'from-violet-500 to-purple-600',
  },
  pro: {
    label: 'Compte pro',
    plural: 'Comptes pro',
    icon: BriefcaseBusiness,
    series: 'magenta',
    hint: "Compte de l'agence / de la société",
    gradient: 'from-pink-500 to-rose-600',
  },
  cash: {
    label: 'Espèces',
    plural: 'Espèces',
    icon: Banknote,
    series: 'yellow',
    hint: 'Liquide, coffre…',
    gradient: 'from-yellow-400 to-amber-500',
  },
  autre: {
    label: 'Autre',
    plural: 'Autres',
    icon: Coins,
    series: 'slate',
    hint: 'Tout le reste',
    gradient: 'from-slate-500 to-slate-700',
  },
}

export const ACCOUNT_TYPE_ORDER: AccountType[] = ['courant', 'banque', 'epargne', 'invest', 'crypto', 'pro', 'cash', 'autre']

export interface CategoryMeta {
  id: string
  label: string
  kind: 'income' | 'expense'
  scope: Scope
  icon: LucideIcon
  color: string
}

const c = (id: string, label: string, kind: 'income' | 'expense', scope: Scope, icon: LucideIcon, color: string): CategoryMeta => ({
  id,
  label,
  kind,
  scope,
  icon,
  color,
})

export const CATEGORIES: CategoryMeta[] = [
  // Entrées perso
  c('salaire', 'Salaire', 'income', 'perso', Banknote, '#10b981'),
  c('remu_agence', 'Rémunération agence', 'income', 'perso', BriefcaseBusiness, '#ec4899'),
  c('freelance', 'Freelance / missions', 'income', 'perso', Handshake, '#8b5cf6'),
  c('loyers_percus', 'Loyers perçus', 'income', 'perso', Home, '#0ea5e9'),
  c('revenus_placements', 'Dividendes & intérêts', 'income', 'perso', TrendingUp, '#6366f1'),
  c('vente', 'Vente', 'income', 'perso', Tag, '#f59e0b'),
  c('remboursement', 'Remboursement', 'income', 'perso', RefreshCcw, '#14b8a6'),
  c('aides', 'Aides & allocations', 'income', 'perso', HandCoins, '#22c55e'),
  c('cadeau_recu', 'Cadeau reçu', 'income', 'perso', Gift, '#f43f5e'),
  c('autre_entree', 'Autre entrée', 'income', 'perso', Sparkles, '#64748b'),
  // Sorties perso
  c('loyer', 'Loyer / crédit immo', 'expense', 'perso', Home, '#3b82f6'),
  c('charges', 'Charges & énergie', 'expense', 'perso', Lightbulb, '#f59e0b'),
  c('telecom', 'Internet & téléphone', 'expense', 'perso', Wifi, '#06b6d4'),
  c('assurances', 'Assurances', 'expense', 'perso', ShieldCheck, '#6366f1'),
  c('abonnements', 'Abonnements', 'expense', 'perso', Smartphone, '#a855f7'),
  c('transport', 'Transport & véhicule', 'expense', 'perso', Car, '#0ea5e9'),
  c('impots', 'Impôts & taxes', 'expense', 'perso', Landmark, '#ef4444'),
  c('sante', 'Santé', 'expense', 'perso', HeartPulse, '#f43f5e'),
  c('gros_achat', 'Gros achat / équipement', 'expense', 'perso', Laptop, '#8b5cf6'),
  c('voyages', 'Voyages & loisirs', 'expense', 'perso', Plane, '#14b8a6'),
  c('famille', 'Famille', 'expense', 'perso', Baby, '#ec4899'),
  c('formation', 'Formation', 'expense', 'perso', GraduationCap, '#22c55e'),
  c('credit', 'Remboursement de prêt', 'expense', 'perso', Scale, '#78716c'),
  c('frais_bancaires', 'Frais bancaires', 'expense', 'perso', CreditCard, '#64748b'),
  c('cadeaux', 'Cadeaux & dons', 'expense', 'perso', Gift, '#e11d48'),
  c('autre_sortie', 'Autre sortie', 'expense', 'perso', ShoppingBag, '#64748b'),
  // Entrées pro
  c('facturation', 'Facturation client', 'income', 'pro', FileText, '#10b981'),
  c('commission', 'Commission / affiliation', 'income', 'pro', Percent, '#6366f1'),
  c('subvention', 'Subvention / aide', 'income', 'pro', HandCoins, '#22c55e'),
  c('apport', 'Apport / prêt reçu', 'income', 'pro', Building2, '#0ea5e9'),
  c('autre_entree_pro', 'Autre entrée pro', 'income', 'pro', Sparkles, '#64748b'),
  // Sorties pro
  c('salaires_employes', 'Salaires employés', 'expense', 'pro', Users, '#ec4899'),
  c('prestataires', 'Freelances & prestataires', 'expense', 'pro', Handshake, '#8b5cf6'),
  c('publicite', 'Publicité & ads', 'expense', 'pro', Megaphone, '#f97316'),
  c('logiciels', 'Logiciels & outils', 'expense', 'pro', Layers, '#06b6d4'),
  c('materiel', 'Matériel', 'expense', 'pro', Wrench, '#a855f7'),
  c('locaux', 'Locaux & bureaux', 'expense', 'pro', Building2, '#3b82f6'),
  c('comptable', 'Comptable & juridique', 'expense', 'pro', Scale, '#64748b'),
  c('cotisations', 'Cotisations & charges sociales', 'expense', 'pro', Shield, '#ef4444'),
  c('impots_pro', 'Impôts & TVA', 'expense', 'pro', Landmark, '#dc2626'),
  c('deplacements', 'Déplacements', 'expense', 'pro', Plane, '#14b8a6'),
  c('remu_dirigeant', 'Rémunération dirigeant', 'expense', 'pro', Briefcase, '#f59e0b'),
  c('autre_sortie_pro', 'Autre sortie pro', 'expense', 'pro', Package, '#64748b'),
]

const CUSTOM_COLORS = ['#0ea5e9', '#a855f7', '#f97316', '#14b8a6', '#e11d48', '#84cc16']
let customCats: CategoryMeta[] = []
export function setCustomCategories(list: { id: string; label: string; kind: 'income' | 'expense'; scope: Scope }[] = []) {
  customCats = list.map((x, i) => ({ ...x, icon: Tag, color: CUSTOM_COLORS[i % CUSTOM_COLORS.length] }))
}

export const allCategories = () => [...CATEGORIES, ...customCats]

export const SPECIAL_CATEGORIES: Record<string, CategoryMeta> = {
  vie_courante: c('vie_courante', 'Dépenses courantes', 'expense', 'perso', ShoppingBag, '#0ea5e9'),
  transfer: c('transfer', 'Virement interne', 'expense', 'perso', RefreshCcw, '#6366f1'),
  checkpoint: c('checkpoint', 'Mise à jour du solde', 'expense', 'perso', Scale, '#64748b'),
  invest: c('invest', 'Placement', 'expense', 'perso', LineChart, '#8b5cf6'),
}

export function categoryMeta(id?: string): CategoryMeta {
  if (!id) return SPECIAL_CATEGORIES.checkpoint
  return allCategories().find((x) => x.id === id) ?? SPECIAL_CATEGORIES[id] ?? c(id, id, 'expense', 'perso', Tag, '#64748b')
}

export function categoriesFor(kind: 'income' | 'expense', scope: Scope) {
  return allCategories().filter((x) => x.kind === kind && x.scope === scope)
}

export const ASSET_CLASSES: Record<AssetClass, { label: string; icon: LucideIcon; series: SeriesKey }> = {
  etf: { label: 'ETF / trackers', icon: ChartPie, series: 'blue' },
  action: { label: 'Actions', icon: CandlestickChart, series: 'violet' },
  crypto: { label: 'Crypto', icon: Bitcoin, series: 'orange' },
  assurance_vie: { label: 'Assurance-vie', icon: ShieldCheck, series: 'aqua' },
  livret: { label: 'Livrets / dépôts', icon: PiggyBank, series: 'green' },
  scpi: { label: 'SCPI / pierre-papier', icon: Building2, series: 'yellow' },
  immobilier: { label: 'Immobilier locatif', icon: Home, series: 'magenta' },
  obligation: { label: 'Obligations', icon: FileText, series: 'red' },
  fonds: { label: 'Fonds / OPCVM', icon: Layers, series: 'blue' },
  private_equity: { label: 'Private equity / startups', icon: Rocket, series: 'violet' },
  autre: { label: 'Autre placement', icon: Gem, series: 'slate' },
}

export const ASSET_CLASS_ORDER: AssetClass[] = [
  'etf',
  'action',
  'crypto',
  'assurance_vie',
  'livret',
  'scpi',
  'immobilier',
  'obligation',
  'fonds',
  'private_equity',
  'autre',
]

export const ASSET_CATEGORIES: Record<AssetCategory, { label: string; icon: LucideIcon; defaultYears?: number }> = {
  immobilier: { label: 'Immobilier', icon: Home },
  vehicule: { label: 'Véhicule', icon: Car, defaultYears: 8 },
  informatique: { label: 'Informatique & tech', icon: Laptop, defaultYears: 4 },
  materiel_pro: { label: 'Matériel pro', icon: Hammer, defaultYears: 5 },
  objet_valeur: { label: 'Objet de valeur', icon: Gem },
  autre: { label: 'Autre bien', icon: Package },
}

export const LIABILITY_CATEGORIES: Record<LiabilityCategory, { label: string; icon: LucideIcon }> = {
  immobilier: { label: 'Crédit immobilier', icon: Home },
  auto: { label: 'Crédit auto', icon: Car },
  conso: { label: 'Crédit conso', icon: CreditCard },
  pro: { label: 'Prêt professionnel', icon: BriefcaseBusiness },
  perso: { label: 'Prêt entre proches', icon: Users },
  autre: { label: 'Autre dette', icon: Receipt },
}

export const FREQUENCIES = {
  monthly: { label: 'Mensuel', months: 1, perYear: 12 },
  quarterly: { label: 'Trimestriel', months: 3, perYear: 4 },
  semiannual: { label: 'Semestriel', months: 6, perYear: 2 },
  yearly: { label: 'Annuel', months: 12, perYear: 1 },
} as const
