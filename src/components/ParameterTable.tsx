import { formatRange, formatTime, formatValue } from "../lib/format";
import type { SensorParameter } from "../types/waterQuality";
import StatusBadge from "./StatusBadge";

export default function ParameterTable({ params }: { params: SensorParameter[] }) {
  return (
    <section className="panel">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="panel-title">Parameter Summary</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-ink-500">
            <tr>
              {["Parameter", "Current Value", "Unit", "Configured Range", "Status", "Last Updated"].map((h) => (
                <th key={h} className="px-4 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {params.map((p) => (
              <tr key={p.config.key}>
                <td className="px-4 py-2.5 font-medium">{p.config.label}</td>
                <td className="px-4 py-2.5 font-mono tabular-nums">{formatValue(p.value, p.config.decimals)}</td>
                <td className="px-4 py-2.5 text-ink-500">{p.config.unit}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-ink-700">
                  {formatRange(p.config.range.min, p.config.range.max, p.config.unit)}
                </td>
                <td className="px-4 py-2.5"><StatusBadge level={p.status} /></td>
                <td className="px-4 py-2.5 font-mono text-xs text-ink-500">{formatTime(p.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
