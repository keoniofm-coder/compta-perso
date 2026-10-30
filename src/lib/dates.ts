const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const today = () => toISO(new Date())

export const monthOf = (date: string) => date.slice(0, 7)

export const currentMonth = () => monthOf(today())

export function addMonths(month: string, n: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function daysInMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export const lastDayOf = (month: string) => `${month}-${pad(daysInMonth(month))}`

export const dayInMonth = (month: string, day: number) => `${month}-${pad(Math.min(Math.max(1, day), daysInMonth(month)))}`

export function monthDiff(a: string, b: string) {
  const [ya, ma] = a.split('-').map(Number)
  const [yb, mb] = b.split('-').map(Number)
  return (yb - ya) * 12 + (mb - ma)
}

export function monthRange(from: string, to: string) {
  const out: string[] = []
  let m = from
  while (m <= to) {
    out.push(m)
    m = addMonths(m, 1)
  }
  return out
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function monthLabel(month: string, style: 'long' | 'short' = 'long') {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  if (style === 'short') {
    return cap(d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''))
  }
  return cap(d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))
}

export function monthShortYear(month: string) {
  const [y] = month.split('-')
  return `${monthLabel(month, 'short')} ${y.slice(2)}`
}

export function dateLabel(date: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', opts)
}

export function relativeDay(date: string) {
  const t = today()
  if (date === t) return "Aujourd'hui"
  const [y, m, d] = t.split('-').map(Number)
  const yest = toISO(new Date(y, m - 1, d - 1))
  if (date === yest) return 'Hier'
  return cap(dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long', year: date.slice(0, 4) === t.slice(0, 4) ? undefined : 'numeric' }))
}

export function yearsBetween(a: string, b: string) {
  const da = new Date(a)
  const db = new Date(b)
  return (db.getTime() - da.getTime()) / (365.25 * 24 * 3600 * 1000)
}
