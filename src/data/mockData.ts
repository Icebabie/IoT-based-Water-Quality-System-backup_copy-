import type { Alert, DeviceStatus, Prediction, SensorReading } from "../types/waterQuality";

/**
 * CENTRAL MOCK DATA.
 * Everything the dashboard displays originates here (via services/waterQualityService.ts).
 * When the FastAPI backend exists, the service functions stop importing this file.
 */

export const DEVICE_ID = "ESP32-001";
export const HISTORY_POINTS = 40; // 40 samples x 1 min = last 40 minutes
export const SAMPLE_INTERVAL_MS = 60_000;

/** Baseline the simulator drifts around. */
export const BASELINE = {
  ph: 7.22,
  turbidity: 3.3,
  temperature: 26.6,
  tds: 316,
  conductivity: 640,
  dissolvedOxygen: 6.8,
};

/** Max random step per sample, per parameter. */
export const NOISE = {
  ph: 0.03,
  turbidity: 0.18,
  temperature: 0.12,
  tds: 4,
  conductivity: 8,
  dissolvedOxygen: 0.08,
};

/** Small deterministic PRNG so the initial history is stable between reloads. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (v: number, d: number) => Number(v.toFixed(d));

/** Produce the next reading by nudging the previous one (mean-reverting random walk). */
export function nextReading(prev: SensorReading, timestamp: Date, rand: () => number = Math.random): SensorReading {
  const step = (cur: number, base: number, noise: number, d: number) => {
    const pull = (base - cur) * 0.15;
    return round(cur + pull + (rand() - 0.5) * 2 * noise, d);
  };
  return {
    deviceId: prev.deviceId,
    timestamp: timestamp.toISOString(),
    ph: step(prev.ph, BASELINE.ph, NOISE.ph, 2),
    turbidity: Math.max(0, step(prev.turbidity, BASELINE.turbidity, NOISE.turbidity, 2)),
    temperature: step(prev.temperature, BASELINE.temperature, NOISE.temperature, 1),
    tds: Math.round(step(prev.tds, BASELINE.tds, NOISE.tds, 0)),
    conductivity: Math.round(step(prev.conductivity, BASELINE.conductivity, NOISE.conductivity, 0)),
    dissolvedOxygen: step(prev.dissolvedOxygen, BASELINE.dissolvedOxygen, NOISE.dissolvedOxygen, 1),
  };
}

/** Build the initial history ending at the latest values from the spec (pH 7.24, turbidity 3.42, ...). */
export function buildInitialHistory(now: Date = new Date()): SensorReading[] {
  const rand = mulberry32(42);
  const readings: SensorReading[] = [];
  let prev: SensorReading = {
    deviceId: DEVICE_ID,
    timestamp: now.toISOString(),
    ...BASELINE,
  };
  for (let i = HISTORY_POINTS - 1; i >= 0; i--) {
    const ts = new Date(now.getTime() - i * SAMPLE_INTERVAL_MS);
    prev = nextReading(prev, ts, rand);
    readings.push(prev);
  }
  // Pin the most recent sample to the values shown in the project brief.
  const last = readings[readings.length - 1];
  readings[readings.length - 1] = {
    ...last,
    ph: 7.24,
    turbidity: 3.42,
    temperature: 26.8,
    tds: 318,
    conductivity: 642,
    dissolvedOxygen: 6.7,
  };
  // A short turbidity bump ~22 minutes ago, matching the example warning alert.
  const bumpAt = readings.length - 23;
  readings[bumpAt] = { ...readings[bumpAt], turbidity: 5.4 };
  readings[bumpAt + 1] = { ...readings[bumpAt + 1], turbidity: 5.1 };
  readings[bumpAt + 2] = { ...readings[bumpAt + 2], turbidity: 4.6 };
  return readings;
}

/** Alerts are anchored to "minutes ago" so they always look recent. */
export function buildMockAlerts(now: Date = new Date()): Alert[] {
  const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
  return [
    { id: "a1", severity: "WARNING", parameter: "turbidity", message: "Turbidity increased above configured range", timestamp: ago(22), active: false },
    { id: "a2", severity: "INFO", parameter: "turbidity", message: "Turbidity returned to normal range", timestamp: ago(19), active: false },
    { id: "a3", severity: "INFO", parameter: "ph", message: "pH returned to normal range", timestamp: ago(35), active: false },
    { id: "a4", severity: "INFO", parameter: "tds", message: "TDS within configured range", timestamp: ago(48), active: false },
    { id: "a5", severity: "CRITICAL", parameter: "dissolvedOxygen", message: "Dissolved oxygen dropped below minimum (example event)", timestamp: ago(135), active: false },
  ];
}

export function buildMockPrediction(now: Date = new Date()): Prediction {
  return {
    label: "NORMAL",
    confidence: 94.2,
    anomalyScore: 0.12,
    modelName: "Random Forest",
    contributingParameters: ["turbidity", "tds", "dissolvedOxygen"],
    isDemo: true,
    timestamp: now.toISOString(),
  };
}

export function buildMockDeviceStatus(lastPacket: string): DeviceStatus {
  return {
    deviceId: DEVICE_ID,
    state: "ONLINE",
    wifi: "CONNECTED",
    dataIngestion: "ACTIVE",
    lastPacket,
    sensorsActive: 6,
    sensorsTotal: 6,
    backend: "MOCK",
    database: "MOCK",
  };
}
