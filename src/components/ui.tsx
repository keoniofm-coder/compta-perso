import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Info, X, type LucideIcon } from 'lucide-react'
import { formatMoney, formatPct } from '../lib/currency'
import { addMonths, currentMonth, monthLabel } from '../lib/dates'
import { useUI } from '../lib/ui'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ---------------- Boutons ---------------- */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type BtnSize = 'sm' | 'md' | 'lg'

const btnBase =
  'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 select-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 active:scale-[0.98] whitespace-nowrap'
const btnVariants: Record<BtnVariant, string> = {
  primary: 'brand-gradient text-white shadow-[0_6px_20px_-8px_rgba(124,58,237,0.7)] hover:brightness-110',
  secondary: 'bg-surface border border-line-strong text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-3 hover:text-ink',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
  soft: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/15',
}
const btnSizes: Record<BtnSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-[15px]',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; icon?: LucideIcon }) {
  return (
    <button type="button" className={cx(btnBase, btnVariants[variant], btnSizes[size], className)} {...rest}>
      {Icon && <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2.2} />}
      {children}
    </button>
  )
}

export function IconButton({
  icon: Icon,
  label,
  className,
  size = 'md',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex items-center justify-center rounded-xl text-ink-2 hover:text-ink hover:bg-surface-3 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500',
        size === 'sm' ? 'size-8' : 'size-10',
        className,
      )}
      {...rest}
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-[18px]'} strokeWidth={2} />
    </button>
  )
}

/* ---------------- Cartes & mise en page ---------------- */

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div
      className={cx('card', onClick && 'cursor-pointer hover:border-line-strong transition-colors', className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, icon: Icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h3 className="font-semibold text-[15px] text-ink flex items-center gap-2">
          {Icon && <Icon className="size-4 text-muted" />}
          {title}
        </h3>
        {subtitle && <p className="text-[13px] text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-1">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6 anim-fade-up">
      <div className="min-w-0">
        {eyebrow && <div className="text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-300 mb-1.5">{eyebrow}</div>}
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-ink-2 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function IconChip({ icon: Icon, color, size = 'md', className }: { icon: LucideIcon; color: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = size === 'sm' ? 'size-8 rounded-lg' : size === 'lg' ? 'size-12 rounded-2xl' : 'size-10 rounded-xl'
  const i = size === 'sm' ? 'size-4' : size === 'lg' ? 'size-6' : 'size-5'
  return (
    <span className={cx('inline-flex items-center justify-center shrink-0', s, className)} style={{ background: `${color}1f`, color }}>
      <Icon className={i} strokeWidth={2.1} />
    </span>
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'pos' | 'neg' | 'warn' | 'brand' | 'info'; className?: string }) {
  const tones = {
    neutral: 'bg-surface-3 text-ink-2',
    pos: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    neg: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
    warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    brand: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300',
    info: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  }
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap', tones[tone], className)}>{children}</span>
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      <div className="size-14 rounded-2xl brand-gradient text-white flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/25">
        <Icon className="size-7" />
      </div>
      <h3 className="font-semibold text-ink">{title}</h3>
      {text && <p className="text-sm text-ink-2 mt-1 max-w-sm">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Progress({ value, color = '#6366f1', className }: { value: number; color?: string; className?: string }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={cx('h-2 rounded-full bg-surface-3 overflow-hidden', className)}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${v * 100}%`, background: color }} />
    </div>
  )
}

/* ---------------- Montants ---------------- */

export function Money({
  value,
  currency,
  sign,
  colored,
  compact,
  className,
  decimals,
}: {
  value: number
  currency: string
  sign?: boolean
  colored?: boolean
  compact?: boolean
  className?: string
  decimals?: number
}) {
  const privacy = useUI((s) => s.privacy)
  const tone = colored ? (value > 0.004 ? 'text-pos' : value < -0.004 ? 'text-neg' : 'text-ink-2') : ''
  return (
    <span className={cx('tnum whitespace-nowrap', tone, privacy && 'blurred', className)}>{formatMoney(value, currency, { sign, compact, decimals })}</span>
  )
}

export function Delta({ value, className }: { value: number; className?: string }) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.0005) return <Badge className={className}>0 %</Badge>
  return (
    <Badge tone={value > 0 ? 'pos' : 'neg'} className={className}>
      {value > 0 ? '▲' : '▼'} {formatPct(Math.abs(value), false)}
    </Badge>
  )
}

export function Stat({
  label,
  value,
  currency,
  icon,
  color,
  sub,
  colored,
  className,
}: {
  label: string
  value: number
  currency: string
  icon: LucideIcon
  color: string
  sub?: ReactNode
  colored?: boolean
  className?: string
}) {
  return (
    <Card className={cx('p-4 sm:p-5', className)}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        <IconChip icon={icon} color={color} size="sm" />
      </div>
      <div className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
        <Money value={value} currency={currency} colored={colored} />
      </div>
      {sub && <div className="mt-1.5 text-[12.5px] text-muted flex items-center gap-1.5 flex-wrap">{sub}</div>}
    </Card>
  )
}

/* ---------------- Formulaires ---------------- */

export function Field({ label, hint, children, className, error }: { label?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; error?: string }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="block text-[13px] font-medium text-ink-2 mb-1.5">{label}</span>}
      {children}
      {error ? <span className="block text-xs text-neg mt-1">{error}</span> : hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full h-11 rounded-xl bg-surface-2 border border-line-strong px-3.5 text-[15px] text-ink placeholder:text-muted outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputCls, className)} {...rest} />
}

export function TextArea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputCls, 'h-auto min-h-20 py-2.5 resize-y', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cx(inputCls, 'appearance-none pr-9 cursor-pointer', className)} {...rest}>
        {children}
      </select>
      <ChevronRight className="size-4 rotate-90 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  )
}

export function AmountInput({
  value,
  onChange,
  currency,
  big,
  autoFocus,
  placeholder = '0',
  className,
}: {
  value: string
  onChange: (v: string) => void
  currency?: string
  big?: boolean
  autoFocus?: boolean
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cx('relative', className)}>
      <input
        inputMode="decimal"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,\-\s]/g, ''))}
        className={cx(inputCls, 'tnum pr-16', big && 'h-16 text-3xl font-bold tracking-tight')}
      />
      {currency && <span className={cx('absolute right-3.5 top-1/2 -translate-y-1/2 font-semibold text-muted', big ? 'text-lg' : 'text-sm')}>{currency}</span>}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; icon?: LucideIcon; activeClass?: string }[]
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className={cx('inline-flex p-1 rounded-xl bg-surface-3 gap-1', className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all whitespace-nowrap',
              size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-9 px-3 text-[13.5px]',
              active ? cx('bg-surface text-ink shadow-sm', o.activeClass) : 'text-ink-2 hover:text-ink',
            )}
          >
            {o.icon && <o.icon className="size-4" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted mt-0.5">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative shrink-0 w-11 h-6 rounded-full transition-colors mt-0.5', checked ? 'bg-indigo-500' : 'bg-surface-3 border border-line-strong')}
      >
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  )
}

export function MonthPicker({ value, onChange, className }: { value: string; onChange: (m: string) => void; className?: string }) {
  const isCurrent = value === currentMonth()
  return (
    <div className={cx('inline-flex items-center gap-1 rounded-xl bg-surface border border-line-strong p-1', className)}>
      <IconButton icon={ChevronLeft} label="Mois précédent" size="sm" onClick={() => onChange(addMonths(value, -1))} />
      <button
        type="button"
        onClick={() => onChange(currentMonth())}
        className="min-w-[9.5rem] text-center text-sm font-semibold text-ink px-2"
        title="Revenir au mois en cours"
      >
        {monthLabel(value)}
        {!isCurrent && <span className="block text-[10.5px] font-medium text-indigo-500 -mt-0.5">revenir à ce mois-ci</span>}
      </button>
      <IconButton icon={ChevronRight} label="Mois suivant" size="sm" onClick={() => onChange(addMonths(value, 1))} />
    </div>
  )
}

/* ---------------- Fenêtres ---------------- */

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = 'md',
  icon,
}: {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  const width = size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl'
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] anim-fade-in" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={cx(
          'relative w-full bg-surface border border-line shadow-2xl flex flex-col max-h-[92dvh]',
          'rounded-t-3xl sm:rounded-3xl anim-sheet sm:anim-pop',
          width,
        )}
      >
        <div className="sm:hidden mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong" />
        <div className="flex items-start gap-3 px-5 sm:px-6 pt-4 sm:pt-6 pb-3">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
            {subtitle && <p className="text-[13px] text-ink-2 mt-0.5">{subtitle}</p>}
          </div>
          <IconButton icon={X} label="Fermer" onClick={onClose} className="-mr-2 -mt-1" />
        </div>
        <div className="px-5 sm:px-6 pb-5 overflow-y-auto overscroll-contain flex-1">{children}</div>
        {footer && <div className="px-5 sm:px-6 py-4 border-t border-line flex items-center justify-end gap-2 safe-bottom bg-surface rounded-b-3xl">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmHost() {
  const spec = useUI((s) => s.confirmSpec)
  if (!spec) return null
  return (
    <Modal
      title={spec.title}
      size="sm"
      onClose={() => spec.resolve(false)}
      icon={
        <span className={cx('size-10 rounded-xl flex items-center justify-center shrink-0', spec.danger ? 'bg-rose-500/12 text-rose-600' : 'bg-indigo-500/12 text-indigo-600')}>
          <AlertTriangle className="size-5" />
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => spec.resolve(false)}>
            Annuler
          </Button>
          <Button variant={spec.danger ? 'danger' : 'primary'} onClick={() => spec.resolve(true)}>
            {spec.confirmLabel ?? 'Confirmer'}
          </Button>
        </>
      }
    >
      {spec.message && <p className="text-sm text-ink-2">{spec.message}</p>}
    </Modal>
  )
}

export function ToastHost() {
  const toasts = useUI((s) => s.toasts)
  const dismiss = useUI((s) => s.dismiss)
  return createPortal(
    <div className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-24 lg:bottom-6 flex flex-col items-center gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto anim-pop w-full flex items-center gap-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-3 shadow-2xl"
          onClick={() => dismiss(t.id)}
        >
          <span
            className={cx(
              'size-6 rounded-full flex items-center justify-center shrink-0',
              t.tone === 'error' ? 'bg-rose-500' : t.tone === 'info' ? 'bg-sky-500' : 'bg-emerald-500',
            )}
          >
            {t.tone === 'error' ? <X className="size-3.5 text-white" /> : t.tone === 'info' ? <Info className="size-3.5 text-white" /> : <Check className="size-3.5 text-white" />}
          </span>
          <span className="text-sm font-medium">{t.message}</span>
        </div>
      ))}
    </div>,
    document.body,
  )
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches)
  useEffect(() => {
    const mq = matchMedia(q)
    const fn = () => setM(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [q])
  return m
}
