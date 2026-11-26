import { BarChart, HeatmapChart, LineChart } from 'echarts/charts'
import { CalendarComponent, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { useEffect, useState } from 'react'
import { formatDate, formatINR, formatINRCompact } from '@/lib/format'
import { fromISODate } from '@/lib/dates'

// Only the chart types we use, to keep the bundle small.
echarts.use([LineChart, BarChart, HeatmapChart, GridComponent, TooltipComponent, LegendComponent, CalendarComponent, VisualMapComponent, CanvasRenderer])

/** Reads a design token (CSS variable) so charts follow the theme. */
function tok(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
}

const FONT = 'Mukta, system-ui, sans-serif'

function base() {
  return {
    textStyle: { fontFamily: FONT, color: tok('ink'), fontSize: 14 },
    animationDuration: 600,
    tooltip: {
      backgroundColor: tok('surface'),
      borderColor: tok('line'),
      borderWidth: 1,
      textStyle: { color: tok('ink'), fontFamily: FONT, fontSize: 14 },
      extraCssText: 'border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.12);padding:8px 12px;',
    },
  }
}

const axisCommon = () => ({
  axisLine: { lineStyle: { color: tok('line') } },
  axisTick: { show: false },
  axisLabel: { color: tok('ink-muted'), fontFamily: FONT, fontSize: 13 },
  splitLine: { lineStyle: { color: tok('grid'), type: 'solid' as const } },
})

/** Re-render charts when the theme or large-text mode changes. */
function useThemeKey() {
  const [key, setKey] = useState(0)
  useEffect(() => {
    const obs = new MutationObserver(() => setKey((k) => k + 1))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    return () => obs.disconnect()
  }, [])
  return key
}

const monthLabel = (ym: string, lang: 'hi' | 'en') =>
  new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'short', year: '2-digit' }).format(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1))

/** Billed vs collected per month: two series, one ₹ axis (never dual-axis). */
export function TrendChart({ data, labels, lang }: { data: { month: string; billed: number; collected: number }[]; labels: [string, string]; lang: 'hi' | 'en' }) {
  const key = useThemeKey()
  const surface = tok('surface')
  const series = (name: string, color: string, values: number[]) => ({
    name,
    type: 'line' as const,
    data: values,
    smooth: false,
    lineStyle: { width: 2, color, cap: 'round' as const, join: 'round' as const },
    itemStyle: { color, borderColor: surface, borderWidth: 2 },
    symbol: 'circle',
    symbolSize: 9,
    emphasis: { focus: 'series' as const, scale: 1.3 },
  })
  const option = {
    ...base(),
    grid: { left: 8, right: 16, top: 44, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 4, textStyle: { color: tok('ink'), fontFamily: FONT, fontSize: 14 } },
    tooltip: {
      ...base().tooltip,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: tok('ink-muted'), width: 1 } },
      valueFormatter: (v: number) => formatINR(v),
    },
    xAxis: { type: 'category', data: data.map((d) => monthLabel(d.month, lang)), boundaryGap: false, ...axisCommon(), splitLine: { show: false } },
    yAxis: { type: 'value', ...axisCommon(), axisLine: { show: false }, axisLabel: { ...axisCommon().axisLabel, formatter: formatINRCompact } },
    series: [series(labels[0], tok('series-1'), data.map((d) => d.billed)), series(labels[1], tok('series-2'), data.map((d) => d.collected))],
  }
  return <ReactEChartsCore key={key} echarts={echarts} option={option} notMerge style={{ height: 300 }} opts={{ renderer: 'canvas' }} />
}

/** Horizontal bars, one hue (single series), value at each bar end. */
export function HBarChart({ rows, format }: { rows: { name: string; value: number }[]; format: (v: number) => string }) {
  const key = useThemeKey()
  const ordered = [...rows].reverse() // largest at the top
  const option = {
    ...base(),
    grid: { left: 8, right: 72, top: 4, bottom: 4, containLabel: true },
    tooltip: { ...base().tooltip, trigger: 'item', formatter: (p: { name: string; value: number }) => `${p.name}: <b>${format(p.value)}</b>` },
    xAxis: { type: 'value', show: false },
    yAxis: { type: 'category', data: ordered.map((r) => r.name), ...axisCommon(), axisLine: { show: false }, axisLabel: { ...axisCommon().axisLabel, color: tok('ink'), width: 120, overflow: 'truncate' } },
    series: [
      {
        type: 'bar',
        data: ordered.map((r) => r.value),
        barMaxWidth: 24,
        itemStyle: { color: tok('series-1'), borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', color: tok('ink'), fontFamily: FONT, fontSize: 13, formatter: (p: { value: number }) => format(p.value) },
        emphasis: { itemStyle: { color: tok('rani-deep') } },
      },
    ],
  }
  return <ReactEChartsCore key={key} echarts={echarts} option={option} notMerge style={{ height: Math.max(120, rows.length * 40 + 16) }} />
}

/** Dues by age bucket: an ordinal single-hue ramp (older = darker). */
export function AgeingChart({ buckets, labelFor, onPick, selected }: { buckets: { label: string; amount: number }[]; labelFor: (b: string) => string; onPick: (i: number) => void; selected: number | null }) {
  const key = useThemeKey()
  const colors = [tok('age-1'), tok('age-2'), tok('age-3'), tok('age-4')]
  const option = {
    ...base(),
    grid: { left: 8, right: 8, top: 32, bottom: 8, containLabel: true },
    tooltip: { ...base().tooltip, trigger: 'item', formatter: (p: { name: string; value: number }) => `${p.name}: <b>${formatINR(p.value)}</b>` },
    xAxis: { type: 'category', data: buckets.map((b) => labelFor(b.label)), ...axisCommon(), splitLine: { show: false } },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'bar',
        barMaxWidth: 24,
        data: buckets.map((b, i) => ({
          value: b.amount,
          itemStyle: { color: colors[i], borderRadius: [4, 4, 0, 0], opacity: selected === null || selected === i ? 1 : 0.35 },
        })),
        label: { show: true, position: 'top', color: tok('ink'), fontFamily: FONT, fontSize: 13, formatter: (p: { value: number }) => (p.value ? formatINRCompact(p.value) : '') },
      },
    ],
  }
  return (
    <ReactEChartsCore
      key={key}
      echarts={echarts}
      option={option}
      notMerge
      style={{ height: 220, cursor: 'pointer' }}
      onEvents={{ click: (p: { dataIndex: number }) => onPick(p.dataIndex) }}
    />
  )
}

/** Calendar heatmap of orders per day, sequential single hue. */
export function CalendarHeat({ days, range, unit }: { days: [string, number][]; range: [string, string]; unit: (n: number) => string }) {
  const key = useThemeKey()
  const [narrow, setNarrow] = useState(() => window.innerWidth < 640)
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 640)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const heat = [0, 1, 2, 3, 4, 5].map((i) => tok(`heat-${i}`))
  const option = {
    ...base(),
    tooltip: { ...base().tooltip, trigger: 'item', formatter: (p: { value: [string, number] }) => `${formatDate(fromISODate(p.value[0]))}: <b>${unit(p.value[1])}</b>` },
    visualMap: {
      type: 'piecewise',
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 14,
      itemHeight: 14,
      itemGap: 6,
      textStyle: { color: tok('ink-muted'), fontFamily: FONT },
      pieces: [
        { value: 0, color: heat[0], label: '0' },
        { value: 1, color: heat[1], label: '1' },
        { value: 2, color: heat[2], label: '2' },
        { min: 3, max: 4, color: heat[3], label: '3–4' },
        { min: 5, max: 7, color: heat[4], label: '5–7' },
        { min: 8, color: heat[5], label: '8+' },
      ],
    },
    calendar: {
      range,
      orient: narrow ? 'vertical' : 'horizontal',
      top: narrow ? 36 : 28,
      left: narrow ? 36 : 40,
      right: narrow ? 8 : 16,
      bottom: 48,
      cellSize: narrow ? ['auto', 16] : ['auto', 18],
      splitLine: { show: false },
      itemStyle: { color: heat[0], borderColor: tok('surface'), borderWidth: 2 },
      dayLabel: { color: tok('ink-muted'), fontFamily: FONT, nameMap: ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'], firstDay: 1 },
      monthLabel: { color: tok('ink-muted'), fontFamily: FONT, nameMap: 'en' },
      yearLabel: { show: false },
    },
    series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: days }],
  }
  const weeks = Math.ceil((fromISODate(range[1]).getTime() - fromISODate(range[0]).getTime()) / (7 * 86_400_000)) + 1
  return <ReactEChartsCore key={`${key}-${narrow}`} echarts={echarts} option={option} notMerge style={{ height: narrow ? weeks * 16 + 100 : 240 }} />
}
