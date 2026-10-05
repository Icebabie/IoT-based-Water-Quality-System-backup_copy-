import { BrainCircuit } from "lucide-react";
import { PARAMETER_MAP } from "../data/parameters";
import type { Prediction } from "../types/waterQuality";
import StatusBadge from "./StatusBadge";

export default function PredictionCard({ prediction }: { prediction: Prediction }) {
  const rows = [
    { label: "Confidence", value: `${prediction.confidence.toFixed(1)}%` },
    { label: "Anomaly score", value: prediction.anomalyScore.toFixed(2) },
    { label: "Model", value: prediction.modelName },
  ];

  return (
    <section className="panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="panel-title flex items-center gap-1.5">
          <BrainCircuit size={14} /> AI / ML Water Quality Prediction
        </h2>
      </div>

      {prediction.isDemo && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[11px] font-medium text-amber-800">
          Demo prediction • ML model integration pending
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] text-ink-500">Prediction</div>
            <div className="text-2xl font-semibold tracking-tight">{prediction.label}</div>
          </div>
          <StatusBadge level={prediction.label} />
        </div>

        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-aqua-500" style={{ width: `${prediction.confidence}%` }} />
          </div>
        </div>

        <dl className="mt-3 divide-y divide-slate-100 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between py-1.5">
              <dt className="text-ink-500">{r.label}</dt>
              <dd className="font-mono">{r.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-3">
          <div className="text-[11px] text-ink-500">Key contributing parameters</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {prediction.contributingParameters.map((k) => (
              <span key={k} className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">
                {PARAMETER_MAP[k].label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
