import { Droplets, FlaskConical, Gauge, Thermometer, Waves, Wind, ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatRange, formatValue } from "../lib/format";
import type { ParameterKey, SensorParameter } from "../types/waterQuality";
import StatusBadge from "./StatusBadge";

export const PARAMETER_ICONS: Record<ParameterKey, LucideIcon> = {
  ph: FlaskConical,
  turbidity: Droplets,
  temperature: Thermometer,
  tds: Waves,
  conductivity: Gauge,
  dissolvedOxygen: Wind,
};

const BAR_COLOR = { NORMAL: "bg-emerald-500", WARNING: "bg-amber-500", CRITICAL: "bg-red-500" } as const;

export default function SensorCard({ param }: { param: SensorParameter }) {
  const { config, value, status, delta } = param;
  const Icon = PARAMETER_ICONS[config.key];
  const { scale, range } = config;
  const span = scale.max - scale.min;
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - scale.min) / span) * 100));
  const threshold = Math.pow(10, -config.decimals);
  const trend = Math.abs(delta) < threshold ? "flat" : delta > 0 ? "up" : "down";
  const TrendIcon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;

  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-ink-700">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-aqua-50 text-aqua-600">
            <Icon size={16} />
          </span>
          <span className="text-sm font-medium">{config.label}</span>
        </div>
        <StatusBadge level={status} />
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-mono text-3xl font-medium tabular-nums">{formatValue(value, config.decimals)}</span>
        <span className="text-sm text-ink-500">{config.unit}</span>
        <span className="ml-auto flex items-center gap-0.5 font-mono text-xs text-ink-500" title="Change since previous reading">
          <TrendIcon size={12} />
          {trend === "flat" ? "stable" : formatValue(Math.abs(delta), config.decimals)}
        </span>
      </div>

      {/* Range bar: shaded band = configured range, marker = current value */}
      <div className="mt-4">
        <div className="relative h-2 rounded-full bg-slate-100">
          <div
            className="absolute inset-y-0 rounded-full bg-emerald-100"
            style={{ left: `${pct(range.min)}%`, width: `${pct(range.max) - pct(range.min)}%` }}
          />
          <div
            className={`absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm ${BAR_COLOR[status]}`}
            style={{ left: `${pct(value)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-500">
          <span>{scale.min}</span>
          <span>Configured range: {formatRange(range.min, range.max, "")}</span>
          <span>{scale.max}</span>
        </div>
      </div>
    </div>
  );
}
