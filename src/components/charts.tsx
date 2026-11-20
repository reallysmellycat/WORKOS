import type { ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SERIES } from '@/lib/domain';
import { compactNumber } from '@/lib/utils';

const axis = { tickLine: false, axisLine: false, fontSize: 11 } as const;

function TipBox({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-raised px-2.5 py-1.5 text-xs shadow-pop">
      <div className="mb-0.5 font-medium">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5 text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="text-fg tabular-nums">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
          {unit}
        </div>
      ))}
    </div>
  );
}

export function ChartFrame({ height = 200, children }: { height?: number; children: ReactNode }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export function Bars({ data, x, series, height = 200, stacked, unit }: { data: Record<string, unknown>[]; x: string; series: { key: string; label?: string; color?: string }[]; height?: number; stacked?: boolean; unit?: string }) {
  return (
    <ChartFrame height={height}>
      <BarChart data={data} margin={{ top: 6, right: 4, left: -18, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis dataKey={x} {...axis} interval="preserveStartEnd" minTickGap={8} />
        <YAxis {...axis} allowDecimals={false} tickFormatter={(v) => compactNumber(v)} width={44} />
        <Tooltip content={<TipBox unit={unit} />} cursor={{ fill: 'rgb(var(--sunken))', opacity: 0.6 }} />
        {series.length > 1 && <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label ?? s.key} fill={s.color ?? SERIES[i % SERIES.length]} radius={stacked ? 0 : [3, 3, 0, 0]} stackId={stacked ? 'a' : undefined} maxBarSize={28} />
        ))}
      </BarChart>
    </ChartFrame>
  );
}

export function Lines({ data, x, series, height = 200, area, unit }: { data: Record<string, unknown>[]; x: string; series: { key: string; label?: string; color?: string }[]; height?: number; area?: boolean; unit?: string }) {
  if (area)
    return (
      <ChartFrame height={height}>
        <AreaChart data={data} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`g-${s.key.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color ?? SERIES[i % SERIES.length]} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color ?? SERIES[i % SERIES.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={x} {...axis} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...axis} tickFormatter={(v) => compactNumber(v)} width={44} domain={['auto', 'auto']} />
          <Tooltip content={<TipBox unit={unit} />} />
          {series.length > 1 && <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />}
          {series.map((s, i) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label ?? s.key} stroke={s.color ?? SERIES[i % SERIES.length]} strokeWidth={1.8} fill={`url(#g-${s.key.replace(/\W/g, '')})`} connectNulls dot={false} />
          ))}
        </AreaChart>
      </ChartFrame>
    );
  return (
    <ChartFrame height={height}>
      <LineChart data={data} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={x} {...axis} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axis} tickFormatter={(v) => compactNumber(v)} width={44} domain={['auto', 'auto']} />
        <Tooltip content={<TipBox unit={unit} />} />
        {series.length > 1 && <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label ?? s.key} stroke={s.color ?? SERIES[i % SERIES.length]} strokeWidth={1.8} dot={{ r: 2.5 }} activeDot={{ r: 4 }} connectNulls />
        ))}
      </LineChart>
    </ChartFrame>
  );
}

export function Sparkline({ values, color = 'rgb(var(--accent))', height = 32 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return <div style={{ height }} />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const w = 100;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - 2 - ((v - min) / (max - min || 1)) * (height - 4)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function StatusBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <div className="h-2 rounded-full bg-sunken" />;
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-sunken">
        {parts.map((p) => p.value > 0 && <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${p.value}`} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.label} <span className="tabular-nums text-fg">{p.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
