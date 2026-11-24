// Lightweight dependency-free charts for the Reports page.
// LineChart: multi-series SVG line chart with grid + tooltips.
// BarList: horizontal bar list for top-N rankings.

export function LineChart({
  labels,
  series,
  height = 210,
  format = (n: number) => Math.round(n).toLocaleString(),
}: {
  labels: string[];
  series: { name: string; color: string; values: number[] }[];
  height?: number;
  format?: (n: number) => string;
}) {
  const W = 640;
  const H = height;
  const PL = 6;
  const PR = 6;
  const PT = 12;
  const PB = 24;
  const n = labels.length;
  if (n === 0)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">No data</p>
    );
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = (i: number) =>
    n <= 1 ? (W - PL - PR) / 2 + PL : PL + (i * (W - PL - PR)) / (n - 1);
  const y = (v: number) => PT + (1 - v / max) * (H - PT - PB);
  const gridYs = [0, 0.5, 1].map((f) => PT + f * (H - PT - PB));
  const xTicks =
    n <= 2 ? labels.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  const showDots = n <= 45;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="line chart"
      >
        {gridYs.map((gy, i) => (
          <g key={i}>
            <line
              x1={PL}
              x2={W - PR}
              y1={gy}
              y2={gy}
              stroke="currentColor"
              strokeOpacity={i === 2 ? 0.35 : 0.12}
              strokeWidth={1}
            />
            <text
              x={PL + 2}
              y={gy - 3}
              fontSize={9}
              fill="currentColor"
              fillOpacity={0.55}
            >
              {format(max * (1 - (gy - PT) / (H - PT - PB)))}
            </text>
          </g>
        ))}
        {series.map((s, si) => (
          <g key={s.name}>
            {si === 0 && n > 1 && (
              <polygon
                points={`${x(0)},${y(0)} ${s.values
                  .map((v, i) => `${x(i)},${y(v)}`)
                  .join(" ")} ${x(n - 1)},${y(0)}`}
                fill={s.color}
                fillOpacity={0.08}
              />
            )}
            {n > 1 && (
              <polyline
                points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {n === 1 && (
              <circle cx={x(0)} cy={y(s.values[0])} r={4} fill={s.color} />
            )}
            {showDots &&
              n > 1 &&
              s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={2.6} fill={s.color}>
                  <title>{`${labels[i]} — ${s.name}: ${format(v)}`}</title>
                </circle>
              ))}
          </g>
        ))}
        {xTicks.map((i) => (
          <text
            key={i}
            x={Math.min(Math.max(x(i), 18), W - 18)}
            y={H - 6}
            fontSize={9.5}
            textAnchor="middle"
            fill="currentColor"
            fillOpacity={0.6}
          >
            {labels[i]}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

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
