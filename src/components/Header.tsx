import { Activity, Menu, Waves, X } from "lucide-react";
import { useState } from "react";
import { formatTime } from "../lib/format";
import type { DeviceStatus } from "../types/waterQuality";
import { statusStyle } from "./StatusBadge";

const NAV = ["Dashboard", "Monitoring", "Historical Data", "Predictions", "Alerts"];

interface Props {
  device: DeviceStatus | null;
}

export default function Header({ device }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("Dashboard");
  const s = statusStyle(device?.state ?? "OFFLINE");

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-aqua-600 text-white">
            <Waves size={18} />
          </div>
          <span className="text-sm font-semibold leading-tight">
            Smart Water Quality Monitor
          </span>
        </div>

        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <button
              key={n}
              onClick={() => setActive(n)}
              className={`rounded px-3 py-1.5 text-sm ${
                active === n ? "bg-aqua-50 font-medium text-aqua-700" : "text-ink-700 hover:bg-slate-100"
              }`}
            >
              {n}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 rounded border border-slate-200 px-3 py-1">
            <span className="relative flex h-2.5 w-2.5">
              {device?.state === "ONLINE" && (
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${s.dot}`} />
              )}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${s.dot}`} />
            </span>
            <div className="leading-tight">
              <div className="text-xs font-semibold">
                {device?.deviceId ?? "—"} <span className="font-normal text-ink-500">· {device ? device.state[0] + device.state.slice(1).toLowerCase() : "…"}</span>
              </div>
              <div className="hidden font-mono text-[11px] text-ink-500 sm:block">
                Last updated: {device ? formatTime(device.lastPacket) : "--:--:--"}
              </div>
            </div>
          </div>
          <button
            className="rounded p-2 text-ink-700 hover:bg-slate-100 lg:hidden"
            aria-label="Toggle menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-slate-200 bg-white px-4 py-2 lg:hidden">
          {NAV.map((n) => (
            <button
              key={n}
              onClick={() => { setActive(n); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm ${
                active === n ? "bg-aqua-50 font-medium text-aqua-700" : "text-ink-700"
              }`}
            >
              <Activity size={14} /> {n}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
