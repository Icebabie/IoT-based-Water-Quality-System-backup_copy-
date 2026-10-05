/**
 * DATA ACCESS LAYER — the only module the UI uses to obtain data.
 *
 * Today every function returns mock data. To connect FastAPI, replace each
 * body with a fetch/Axios call (endpoint noted on each function) and delete
 * the mock imports. Signatures and return types must stay the same, so no
 * component needs to change.
 */
import {
  DEVICE_ID,
  HISTORY_POINTS,
  buildInitialHistory,
  buildMockAlerts,
  buildMockDeviceStatus,
  buildMockPrediction,
  nextReading,
} from "../data/mockData";
import type { Alert, DeviceStatus, Prediction, SensorReading } from "../types/waterQuality";

// ---- mock-only state (remove when using the real API) ----
let history: SensorReading[] = buildInitialHistory();
const alerts: Alert[] = buildMockAlerts();
const delay = (ms = 120) => new Promise<void>((r) => setTimeout(r, ms));
// ----------------------------------------------------------

/** GET /api/readings/latest?deviceId=... */
export async function getLatestReading(): Promise<SensorReading> {
  await delay();
  // Mock: simulate the device sending a new packet on every poll.
  const next = nextReading(history[history.length - 1], new Date());
  history = [...history, next].slice(-HISTORY_POINTS);
  return next;
}

/** GET /api/readings/history?deviceId=...&minutes=40 */
export async function getHistoricalReadings(): Promise<SensorReading[]> {
  await delay();
  return [...history];
}

/** GET /api/alerts?limit=20 */
export async function getAlerts(): Promise<Alert[]> {
  await delay();
  return [...alerts].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/** GET /api/predictions/latest */
export async function getPrediction(): Promise<Prediction> {
  await delay();
  return buildMockPrediction();
}

/** GET /api/devices/{deviceId}/status */
export async function getDeviceStatus(): Promise<DeviceStatus> {
  await delay();
  const last = history[history.length - 1];
  return { ...buildMockDeviceStatus(last.timestamp), deviceId: DEVICE_ID };
}
