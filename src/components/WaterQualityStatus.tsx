import { CheckCircle2, ShieldAlert, TriangleAlert } from "lucide-react";
import type { OverallStatus } from "../types/waterQuality";
import StatusBadge from "./StatusBadge";

interface Props {
  status: OverallStatus;
  monitored: number;
  needingAttention: number;
  activeAlerts: number;
}

const VIEW = {
  NORMAL: {
    icon: CheckCircle2,
    ring: "border-emerald-200 bg-emerald-50 text-emerald-600",
    text: "text-emerald-700",
    message: "Water quality conditions are currently within configured monitoring ranges.",
  },
  WARNING: {
    icon: TriangleAlert,
    ring: "border-amber-200 bg-amber-50 text-amber-600",
    text: "text-amber-700",
    message: "One or more parameters are outside their configured range. Review the readings below.",
  },
  ABNORMAL: {
    icon: ShieldAlert,
    ring: "border-red-200 bg-red-50 text-red-600",
    text: "text-red-700",
    message: "Abnormal water-quality conditions detected. Parameters are well outside configured ranges.",
  },
} as const;

export default function WaterQualityStatus({ status, monitored, needingAttention, activeAlerts }: Props) {
  const v = VIEW[status];
  const Icon = v.icon;
  const stats = [
    { label: "Parameters monitored", value: monitored },
    { label: "Requiring attention", value: needingAttention },
    { label: "Active alerts", value: activeAlerts },
  ];

  return (
    <section className="panel flex flex-col gap-5 p-5 md:flex-row md:items-center">
      <div className="flex items-center gap-4 md:w-1/2">
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 ${v.ring}`}>
          <Icon size={30} />
        </div>
        <div>
          <div className="panel-title">Overall Water Quality</div>
          <div className={`text-2xl font-semibold tracking-tight ${v.text}`}>{status}</div>
          <div className="mt-1"><StatusBadge level={status} /></div>
        </div>
      </div>
      <div className="md:w-1/2">
        <p className="text-sm text-ink-700">{v.message}</p>
        <dl className="mt-3 grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              <dt className="text-[11px] leading-tight text-ink-500">{s.label}</dt>
              <dd className="font-mono text-xl font-medium tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
