import { useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PARAMETERS } from "../data/parameters";
import { formatTime, formatValue } from "../lib/format";
import type { ParameterKey, SensorReading } from "../types/waterQuality";

export default function TrendChart({ history }: { history: SensorReading[] }) {
  const [selected, setSelected] = useState<ParameterKey>("ph");
  const cfg = PARAMETERS.find((p) => p.key === selected)!;

  const series = useMemo(
    () => history.map((r) => ({ t: formatTime(r.timestamp, false), v: r[selected] })),
    [history, selected],
  );
  const values = series.map((s) => s.v);
  const current = values[values.length - 1];
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  // Pad the Y domain so the configured range band and data both stay visible.
  const lo = Math.min(min, cfg.range.min);
  const hi = Math.max(max, cfg.range.max);
  const pad = (hi - lo) * 0.1 || 1;
  const domain: [number, number] = [lo - pad, hi + pad];

  const stats = [
    { label: "Current", value: current },
    { label: "Min", value: min },
    { label: "Max", value: max },
    { label: "Avg", value: avg },
  ];

  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="panel-title">Live Water Quality Trends</h2>
          <p className="text-xs text-ink-500">Last {history.length} samples · shaded band = configured range</p>
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist">
          {PARAMETERS.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={selected === p.key}
              onClick={() => setSelected(p.key)}
              className={`whitespace-nowrap rounded border px-3 py-1 text-sm ${
                selected === p.key
                  ? "border-aqua-600 bg-aqua-600 text-white"
                  : "border-slate-200 bg-white text-ink-700 hover:bg-slate-50"
              }`}
            >
              {p.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-ink-500">{s.label}</div>
            <div className="font-mono text-lg tabular-nums">
              {formatValue(s.value ?? 0, cfg.decimals)} <span className="text-xs text-ink-500">{cfg.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <ReferenceArea y1={cfg.range.min} y2={cfg.range.max} fill="#10b981" fillOpacity={0.07} />
            <XAxis dataKey="t" tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={32} />
            <YAxis
              domain={domain}
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickFormatter={(v: number) => formatValue(v, cfg.decimals > 1 ? 1 : cfg.decimals)}
              width={48}
              label={{ value: cfg.unit, angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 4, border: "1px solid #e2e8f0" }}
              formatter={(v: number) => [`${formatValue(v, cfg.decimals)} ${cfg.unit}`, cfg.label]}
            />
            <Line type="monotone" dataKey="v" stroke="#1d7fa8" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
