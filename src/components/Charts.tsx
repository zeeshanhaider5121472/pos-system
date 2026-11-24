"use client";
// Charts for the Reports page, built on Recharts so they look like a proper
// charting library (smooth curves, gradients, tooltips, legends) while using
// the app's own design tokens (border/muted colors, rounded cards).
// ChartCard  — collapsible card wrapper (chevron in the header)
// TrendChart — smooth area/line chart with grid + tooltip
// SharePie   — donut chart for share-of-total data
// BarList    — horizontal bar list for top-N rankings
// SegmentedToggle — small pill toggle (Line / Pie / Bars …)
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const CHART_COLORS = {
  emerald: "#10b981",
  sky: "#0ea5e9",
  indigo: "#6366f1",
  amber: "#f59e0b",
};
const PIE_COLORS = [
  "#10b981",
  "#0ea5e9",
  "#6366f1",
  "#f59e0b",
  "#f43f5e",
  "#14b8a6",
  "#a855f7",
  "#64748b",
];

const compact = (n: number) =>
  Math.abs(n) >= 1000 ? `${+(n / 1000).toFixed(1)}k` : `${Math.round(n)}`;

/** tooltip styled like the app's popover */
function TT({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
  format?: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const f = format ?? ((n: number) => compact(n));
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label !== undefined && (
        <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      )}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <p key={i} className="num flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-semibold text-popover-foreground">
              {f(Number(p.value ?? 0))}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

/** Card with a collapsible header — click the title row to open/close */
export function ChartCard({
  title,
  actions,
  defaultOpen = true,
  children,
}: {
  title: string;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <div className="flex items-center gap-2 p-4 pb-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          aria-expanded={open}
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
          />
          <h2 className="truncate text-sm font-semibold">{title}</h2>
        </button>
        {open && actions}
      </div>
      {open && <CardContent className="p-4 pt-3">{children}</CardContent>}
    </Card>
  );
}

/** small segmented pill toggle used to switch chart types */
export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex shrink-0 items-center rounded-md border bg-background p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          {o.icon && <o.icon className="size-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** smooth line/area chart for time series */
export function TrendChart({
  rows,
  xKey,
  series,
  format,
  height = 280,
}: {
  rows: Record<string, any>[];
  xKey: string;
  series: { key: string; name: string; color: string }[];
  format?: (n: number) => string;
  height?: number;
}) {
  if (rows.length === 0)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">No data</p>
    );
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart
          data={rows}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`grad-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            minTickGap={28}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={compact}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            content={<TT format={format} />}
            cursor={{ stroke: "var(--border)" }}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** donut chart for share-of-total data (payment mix, share per day …) */
export function SharePie({
  items,
  format,
  height = 280,
}: {
  items: { name: string; value: number }[];
  format?: (n: number) => string;
  height?: number;
}) {
  if (items.length === 0)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">No data</p>
    );
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={items}
            dataKey="value"
            nameKey="name"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {items.map((it, i) => (
              <Cell key={it.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<TT format={format} />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** horizontal bar list for top-N rankings */
export function BarList({
  items,
  format,
  color = "#10b981",
}: {
  items: { label: string; value: number; sub?: string }[];
  format: (n: number) => string;
  color?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0)
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">No data</p>
    );
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label + it.sub} className="text-xs">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-medium">{it.label}</span>
            <span className="num shrink-0 font-semibold">
              {format(it.value)}
              {it.sub ? (
                <span className="ml-1 font-normal text-muted-foreground">
                  {it.sub}
                </span>
              ) : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-muted">
            <div
              className="h-full rounded"
              style={{
                width: `${Math.max(2, (it.value / max) * 100)}%`,
                backgroundColor: color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
