import { CheckCircle2, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import { formatTime } from "../lib/format";
import type { Alert, AlertSeverity } from "../types/waterQuality";
import StatusBadge from "./StatusBadge";

const ICONS = {
  INFO: { Icon: CheckCircle2, cls: "text-sky-600" },
  WARNING: { Icon: TriangleAlert, cls: "text-amber-600" },
  CRITICAL: { Icon: OctagonAlert, cls: "text-red-600" },
} as const;

export default function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <section className="panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="panel-title">Recent Alerts</h2>
        <span className="text-xs text-ink-500">{alerts.filter((a) => a.active).length} active</span>
      </div>
      {alerts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center gap-2 p-6 text-sm text-ink-500">
          <Info size={16} /> No alerts recorded
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {alerts.map((a) => {
            const { Icon, cls } = ICONS[a.severity as AlertSeverity];
            return (
              <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                <Icon size={16} className={`mt-0.5 shrink-0 ${cls}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{a.message}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-500">{formatTime(a.timestamp, false)}</p>
                </div>
                <StatusBadge level={a.severity} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
