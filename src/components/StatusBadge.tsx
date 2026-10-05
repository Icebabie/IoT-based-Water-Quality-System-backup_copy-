import type { AlertSeverity, ConnectionState, OverallStatus, ParameterStatus } from "../types/waterQuality";

type Level = ParameterStatus | OverallStatus | AlertSeverity | ConnectionState;

const STYLES: Record<string, { cls: string; dot: string }> = {
  NORMAL: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  ONLINE: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  INFO: { cls: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  WARNING: { cls: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  DEGRADED: { cls: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  CRITICAL: { cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  ABNORMAL: { cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  OFFLINE: { cls: "bg-slate-100 text-slate-600 border-slate-300", dot: "bg-slate-400" },
};

export function statusStyle(level: Level) {
  return STYLES[level] ?? STYLES.OFFLINE;
}

export default function StatusBadge({ level, label }: { level: Level; label?: string }) {
  const s = statusStyle(level);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {label ?? level}
    </span>
  );
}
