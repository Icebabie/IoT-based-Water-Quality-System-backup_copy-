import { formatTime } from "../lib/format";
import type { DeviceStatus as DeviceStatusT } from "../types/waterQuality";

type Tone = "good" | "warn" | "bad" | "mock" | "plain";

const TONE: Record<Tone, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
  mock: "bg-slate-400",
  plain: "",
};

function Row({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="flex items-center gap-2 font-medium">
        {tone !== "plain" && <span className={`h-2 w-2 rounded-full ${TONE[tone]}`} />}
        <span className={tone === "plain" ? "font-mono" : ""}>{value}</span>
      </span>
    </div>
  );
}

export default function DeviceStatus({ device }: { device: DeviceStatusT }) {
  const sensorsOk = device.sensorsActive === device.sensorsTotal;
  return (
    <section className="panel">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="panel-title">Device / System Status</h2>
      </div>
      <div className="divide-y divide-slate-100 px-4">
        <Row label="ESP32 Device" value={device.state === "ONLINE" ? "Online" : device.state === "OFFLINE" ? "Offline" : "Degraded"} tone={device.state === "ONLINE" ? "good" : device.state === "OFFLINE" ? "bad" : "warn"} />
        <Row label="Wi-Fi" value={device.wifi === "CONNECTED" ? "Connected" : "Disconnected"} tone={device.wifi === "CONNECTED" ? "good" : "bad"} />
        <Row label="Data ingestion" value={device.dataIngestion === "ACTIVE" ? "Active" : "Stalled"} tone={device.dataIngestion === "ACTIVE" ? "good" : "warn"} />
        <Row label="Last data packet" value={formatTime(device.lastPacket)} tone="plain" />
        <Row label="Sensor status" value={`${device.sensorsActive} / ${device.sensorsTotal} Active`} tone={sensorsOk ? "good" : "warn"} />
        <Row label="Backend / API" value={device.backend === "MOCK" ? "Mock / Not Connected" : "Connected"} tone={device.backend === "MOCK" ? "mock" : "good"} />
        <Row label="Database" value={device.database === "MOCK" ? "Mock / Not Connected" : "Connected"} tone={device.database === "MOCK" ? "mock" : "good"} />
      </div>
    </section>
  );
}
