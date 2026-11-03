export type Scope = 'perso' | 'pro'

export type AccountType = 'courant' | 'banque' | 'epargne' | 'crypto' | 'invest' | 'pro' | 'cash' | 'autre'

export interface Account {
  id: string
  name: string
  type: AccountType
  currency: string
  initialBalance: number
  initialDate: string
  institution?: string
  color?: string
  scope: Scope
  note?: string
  archived?: boolean
  excludeFromNetWorth?: boolean
  order?: number
  demo?: boolean
}

export type TxKind = 'income' | 'expense' | 'transfer' | 'checkpoint'

export interface Transaction {
  id: string
  kind: TxKind
  date: string
  /** Montant positif, dans la devise du compte source (ou du compte crédité pour une entrée). */
  amount: number
  accountId: string
  /** Virement : compte crédité et montant reçu (si devise différente). */
  toAccountId?: string
  toAmount?: number
  /** Clôture / mise à jour : solde réel constaté à cette date. */
  declaredBalance?: number
  label: string
  category?: string
  counterparty?: string
  employeeId?: string
  note?: string
  scope: Scope
  recurringId?: string
  recurringPeriod?: string
  groupId?: string
  assetId?: string
  createdAt?: number
  demo?: boolean
}

export type Frequency = 'monthly' | 'quarterly' | 'semiannual' | 'yearly'

export interface Recurring {
  id: string
  kind: 'income' | 'expense' | 'transfer'
  label: string
  amount: number
  accountId: string
  toAccountId?: string
  toAmount?: number
  category?: string
  counterparty?: string
  employeeId?: string
  frequency: Frequency
  day: number
  startMonth: string
  endMonth?: string
  scope: Scope
  active: boolean
  /** Prélèvement / virement automatique : validé tout seul à sa date, à partir du mois `autoFrom`. */
  auto?: boolean
  autoFrom?: string
  /** Mois dont la validation automatique a été annulée à la main. */
  skipped?: string[]
  note?: string
  demo?: boolean
}

export type AssetClass =
  | 'action'
  | 'etf'
  | 'crypto'
  | 'obligation'
  | 'fonds'
  | 'assurance_vie'
  | 'scpi'
  | 'immobilier'
  | 'private_equity'
  | 'livret'
  | 'autre'

export interface Holding {
  id: string
  accountId: string
  name: string
  symbol?: string
  assetClass: AssetClass
  currency: string
  /** units : quantité × prix ; amount : versements + valorisation (assurance-vie, SCPI…). */
  mode: 'units' | 'amount'
  cryptoId?: string
  /** Symbole Yahoo Finance (ex. MSTR, AI.PA, CW8.PA) pour le cours en direct des actions, ETF, fonds. */
  quoteSymbol?: string
  autoPrice?: boolean
  note?: string
  archived?: boolean
  demo?: boolean
}

export type HoldingOpKind = 'buy' | 'sell' | 'income' | 'price'

export interface HoldingOp {
  id: string
  holdingId: string
  kind: HoldingOpKind
  date: string
  quantity: number
  price: number
  fees: number
  /** Revenu (dividende, intérêts) : montant total. */
  amount?: number
  /** Impact sur les espèces du compte, dans la devise du compte (négatif pour un achat). */
  cashAmount?: number
  note?: string
  createdAt?: number
  demo?: boolean
}

export type AssetCategory = 'immobilier' | 'vehicule' | 'informatique' | 'materiel_pro' | 'objet_valeur' | 'autre'

export interface Asset {
  id: string
  name: string
  category: AssetCategory
  currency: string
  purchaseValue: number
  purchaseDate: string
  currentValue: number
  depreciationYears?: number
  scope: Scope
  note?: string
  txId?: string
  sold?: boolean
  demo?: boolean
}

export type LiabilityCategory = 'immobilier' | 'auto' | 'conso' | 'pro' | 'perso' | 'autre'

export interface Liability {
  id: string
  name: string
  category: LiabilityCategory
  currency: string
  initialAmount: number
  remaining: number
  monthlyPayment?: number
  rate?: number
  startDate: string
  endDate?: string
  scope: Scope
  note?: string
  demo?: boolean
}

export interface SplitTemplate {
  id: string
  name: string
  sourceAccountId: string
  lines: { accountId: string; amount: number }[]
  demo?: boolean
}

export interface Employee {
  id: string
  name: string
  role?: string
  salary: number
  currency: string
  accountId?: string
  startDate?: string
  active: boolean
  note?: string
  demo?: boolean
}

export interface Settings {
  id: string
  displayName?: string
  baseCurrency: string
  rateOverrides?: Record<string, number>
  customCryptos?: { symbol: string; id: string; name: string }[]
  customCategories?: { id: string; label: string; kind: 'income' | 'expense'; scope: Scope }[]
  onboarded?: boolean
}

export interface Collections {
  accounts: Account
  transactions: Transaction
  recurrings: Recurring
  holdings: Holding
  ops: HoldingOp
  assets: Asset
  liabilities: Liability
  splits: SplitTemplate
  employees: Employee
  settings: Settings
}

export type CollectionName = keyof Collections

export const COLLECTIONS: CollectionName[] = [
  'accounts',
  'transactions',
  'recurrings',
  'holdings',
  'ops',
  'assets',
  'liabilities',
  'splits',
  'employees',
  'settings',
]

export type DB = { [K in CollectionName]: Record<string, Collections[K]> }
