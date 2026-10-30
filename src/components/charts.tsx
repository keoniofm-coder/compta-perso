import { useId, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts'
import { formatMoney, formatPct } from '../lib/currency'
import { SERIES, type SeriesKey } from '../lib/meta'
import { useUI } from '../lib/ui'
import { cx } from './ui'

export function useSeriesColor() {
  const dark = useUI((s) => s.isDark)
  return (k: SeriesKey) => (dark ? SERIES[k].dark : SERIES[k].light)
}

function useChrome() {
  const dark = useUI((s) => s.isDark)
  return {
    grid: dark ? '#222c45' : '#e6e8ef',
    axis: dark ? '#7b859b' : '#8a93a6',
    cursor: dark ? 'rgba(148,163,184,0.10)' : 'rgba(15,23,42,0.05)',
    surface: dark ? '#111829' : '#ffffff',
  }
}

const compactFmt = (currency: string) => (v: number) => formatMoney(v, currency, { compact: true, decimals: 0 })

interface TipRow {
  label: string
  value: number
  color: string
}

function TipCard({ title, rows, currency, footer }: { title: ReactNode; rows: TipRow[]; currency: string; footer?: ReactNode }) {
  const privacy = useUI((s) => s.privacy)
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5 shadow-xl text-[12.5px] min-w-[10rem]">
      <div className="font-semibold text-ink mb-1.5">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-ink-2">
            <span className="size-2 rounded-full" style={{ background: r.color }} />
            {r.label}
          </span>
          <span className={cx('font-semibold text-ink tnum', privacy && 'blurred')}>{formatMoney(r.value, currency)}</span>
        </div>
      ))}
      {footer && <div className="mt-1.5 pt-1.5 border-t border-line text-ink-2">{footer}</div>}
    </div>
  )
}

/* ---------------- Courbe d'évolution ---------------- */

export function TrendArea({
  data,
  dataKey,
  currency,
  color = 'blue',
  height = 220,
  label = 'Valeur',
  labelKey = 'label',
  white,
  showAxis = true,
}: {
  data: Record<string, number | string>[]
  dataKey: string
  currency: string
  color?: SeriesKey
  height?: number
  label?: string
  labelKey?: string
  white?: boolean
  showAxis?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const col = useSeriesColor()
  const chrome = useChrome()
  const stroke = white ? '#ffffff' : col(color)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: showAxis ? 0 : 8, bottom: 0 }}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={white ? 0.35 : 0.28} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        {showAxis && <CartesianGrid vertical={false} stroke={white ? 'rgba(255,255,255,0.12)' : chrome.grid} strokeDasharray="0" />}
        {showAxis && (
          <XAxis
            dataKey={labelKey}
            tickLine={false}
            axisLine={false}
            tick={{ fill: white ? 'rgba(255,255,255,0.75)' : chrome.axis, fontSize: 11.5 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
        )}
        {showAxis && (
          <YAxis
            tickLine={false}
            axisLine={false}
            width={62}
            tick={{ fill: white ? 'rgba(255,255,255,0.75)' : chrome.axis, fontSize: 11.5 }}
            tickFormatter={compactFmt(currency)}
            domain={['auto', 'auto']}
          />
        )}
        <Tooltip
          cursor={{ stroke: white ? 'rgba(255,255,255,0.4)' : chrome.axis, strokeWidth: 1, strokeDasharray: '3 3' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TipCard
                title={String(payload[0].payload[labelKey])}
                currency={currency}
                rows={[{ label, value: Number(payload[0].value), color: col(color) }]}
              />
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={stroke}
          strokeWidth={2.25}
          fill={`url(#g${id})`}
          activeDot={{ r: 5, strokeWidth: 2, stroke: white ? '#6d28d9' : chrome.surface, fill: stroke }}
          dot={false}
          isAnimationActive
          animationDuration={700}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ---------------- Barres groupées ---------------- */

export interface BarSeries {
  key: string
  label: string
  color: SeriesKey
}

export function GroupedBars({
  data,
  series,
  currency,
  height = 240,
  labelKey = 'label',
  stacked,
  footer,
}: {
  data: Record<string, number | string>[]
  series: BarSeries[]
  currency: string
  height?: number
  labelKey?: string
  stacked?: boolean
  footer?: (row: Record<string, number | string>) => ReactNode
}) {
  const col = useSeriesColor()
  const chrome = useChrome()
  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
            <span className="size-2.5 rounded-[3px]" style={{ background: col(s.color) }} />
            {s.label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={3} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={chrome.grid} />
          <XAxis dataKey={labelKey} tickLine={false} axisLine={false} tick={{ fill: chrome.axis, fontSize: 11.5 }} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tickLine={false} axisLine={false} width={62} tick={{ fill: chrome.axis, fontSize: 11.5 }} tickFormatter={compactFmt(currency)} />
          <ReferenceLine y={0} stroke={chrome.axis} strokeOpacity={0.5} />
          <Tooltip
            cursor={{ fill: chrome.cursor }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TipCard
                  title={String(payload[0].payload[labelKey])}
                  currency={currency}
                  rows={series.map((s) => ({ label: s.label, value: Number(payload[0].payload[s.key] ?? 0), color: col(s.color) }))}
                  footer={footer?.(payload[0].payload)}
                />
              ) : null
            }
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId={stacked ? 'a' : undefined}
              fill={col(s.color)}
              radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) : [4, 4, 0, 0]}
              maxBarSize={stacked ? 34 : 22}
              stroke={stacked ? chrome.surface : undefined}
              strokeWidth={stacked ? 1 : 0}
              animationDuration={600}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ---------------- Ligne simple ---------------- */

export function SimpleLine({
  data,
  dataKey,
  currency,
  color = 'blue',
  height = 200,
  labelKey = 'label',
  label = 'Solde',
}: {
  data: Record<string, number | string>[]
  dataKey: string
  currency: string
  color?: SeriesKey
  height?: number
  labelKey?: string
  label?: string
}) {
  const col = useSeriesColor()
  const chrome = useChrome()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={chrome.grid} />
        <XAxis dataKey={labelKey} tickLine={false} axisLine={false} tick={{ fill: chrome.axis, fontSize: 11.5 }} interval="preserveStartEnd" minTickGap={12} />
        <YAxis tickLine={false} axisLine={false} width={62} tick={{ fill: chrome.axis, fontSize: 11.5 }} tickFormatter={compactFmt(currency)} domain={['auto', 'auto']} />
        <Tooltip
          cursor={{ stroke: chrome.axis, strokeDasharray: '3 3' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TipCard title={String(payload[0].payload[labelKey])} currency={currency} rows={[{ label, value: Number(payload[0].value), color: col(color) }]} />
            ) : null
          }
        />
        <Line type="monotone" dataKey={dataKey} stroke={col(color)} strokeWidth={2.25} dot={{ r: 3, strokeWidth: 0, fill: col(color) }} activeDot={{ r: 5, stroke: chrome.surface, strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ---------------- Donut ---------------- */

export interface DonutSlice {
  key: string
  label: string
  value: number
  color: string
  sub?: ReactNode
  onClick?: () => void
}

export function Donut({ slices, currency, centerLabel, centerValue, size = 190 }: { slices: DonutSlice[]; currency: string; centerLabel?: string; centerValue?: number; size?: number }) {
  const chrome = useChrome()
  const privacy = useUI((s) => s.privacy)
  const positive = slices.filter((s) => s.value > 0)
  const total = positive.reduce((s, x) => s + x.value, 0)
  if (!positive.length) return <div className="text-sm text-muted text-center py-10">Rien à afficher pour l'instant</div>
  return (
    <div className="@container">
    <div className="flex flex-col @md:flex-row items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TipCard
                    title={String(payload[0].name)}
                    currency={currency}
                    rows={[{ label: 'Montant', value: Number(payload[0].value), color: String(payload[0].payload.color) }]}
                    footer={<span>{formatPct(Number(payload[0].value) / total, false)} du total</span>}
                  />
                ) : null
              }
            />
            <Pie
              data={positive}
              dataKey="value"
              nameKey="label"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={positive.length > 1 ? 1.5 : 0}
              stroke={chrome.surface}
              strokeWidth={2}
              cornerRadius={4}
              animationDuration={700}
            >
              {positive.map((s) => (
                <Cell key={s.key} fill={s.color} onClick={s.onClick} style={{ cursor: s.onClick ? 'pointer' : 'default', outline: 'none' }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {centerLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
            <span className="text-[11.5px] text-muted font-medium">{centerLabel}</span>
            <span className={cx('text-base font-bold text-ink tnum', privacy && 'blurred')}>{formatMoney(centerValue ?? total, currency, { compact: true })}</span>
          </div>
        )}
      </div>
      <ul className="w-full space-y-1.5 min-w-0">
        {positive
          .slice()
          .sort((a, b) => b.value - a.value)
          .map((s) => (
            <li
              key={s.key}
              className={cx('flex items-center gap-2.5 text-[13px] rounded-lg px-2 py-1.5 -mx-2', s.onClick && 'cursor-pointer hover:bg-surface-2')}
              onClick={s.onClick}
            >
              <span className="size-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-ink-2 truncate flex-1">{s.label}</span>
              <span className="text-muted tnum text-xs">{formatPct(s.value / total, false)}</span>
              <span className={cx('font-semibold text-ink tnum', privacy && 'blurred')}>{formatMoney(s.value, currency, { compact: true })}</span>
            </li>
          ))}
      </ul>
    </div>
    </div>
  )
}

/* ---------------- Barre segmentée ---------------- */

export function SegmentBar({ parts, className }: { parts: { key: string; value: number; color: string; label: string }[]; className?: string }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0)
  return (
    <div className={cx('flex h-3 w-full overflow-hidden rounded-full bg-surface-3 gap-[2px]', className)}>
      {total > 0 &&
        parts
          .filter((p) => p.value > 0)
          .map((p) => <div key={p.key} title={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500" />)}
    </div>
  )
}

export function Sparkline({ values, color = '#ffffff', height = 40 }: { values: number[]; color?: string; height?: number }) {
  const data = values.map((v, i) => ({ i, v }))
  const id = useId().replace(/:/g, '')
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#s${id})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
