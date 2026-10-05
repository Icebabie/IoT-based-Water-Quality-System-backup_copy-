/**
 * Domain types for the water-quality dashboard.
 *
 * These mirror the JSON the FastAPI backend should return. Keep them in sync
 * with the backend's Pydantic schemas when the API is built.
 */

/** Keys of the six monitored parameters (match the field names on SensorReading). */
export type ParameterKey =
  | "ph"
  | "turbidity"
  | "temperature"
  | "tds"
  | "conductivity"
  | "dissolvedOxygen";

/** Raw reading as sent by the device (one packet). */
export interface SensorReading {
  deviceId: string;
  /** ISO-8601 timestamp */
  timestamp: string;
  ph: number;
  turbidity: number;
  temperature: number;
  tds: number;
  conductivity: number;
  dissolvedOxygen: number;
}

export type ParameterStatus = "NORMAL" | "WARNING" | "CRITICAL";
export type OverallStatus = "NORMAL" | "WARNING" | "ABNORMAL";

/** Static description of a parameter: label, unit, configured range. */
export interface ParameterConfig {
  key: ParameterKey;
  label: string;
  shortLabel: string;
  unit: string;
  /** Configured (demo) normal range, inclusive. NOT validated drinking-water limits. */
  range: { min: number; max: number };
  /** Axis/gauge display bounds (wider than the configured range). */
  scale: { min: number; max: number };
  decimals: number;
}

/** A parameter's latest value combined with its config and derived status. */
export interface SensorParameter {
  config: ParameterConfig;
  value: number;
  status: ParameterStatus;
  /** Change vs. the previous reading, in parameter units. */
  delta: number;
  timestamp: string;
}

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  message: string;
  parameter?: ParameterKey;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Whether the condition is still active */
  active: boolean;
}

export interface Prediction {
  label: OverallStatus;
  /** 0–100 */
  confidence: number;
  anomalyScore: number;
  modelName: string;
  contributingParameters: ParameterKey[];
  /** True while the prediction is mock data and no model is trained/connected. */
  isDemo: boolean;
  timestamp: string;
}

export type ConnectionState = "ONLINE" | "OFFLINE" | "DEGRADED";

export interface DeviceStatus {
  deviceId: string;
  state: ConnectionState;
  wifi: "CONNECTED" | "DISCONNECTED";
  dataIngestion: "ACTIVE" | "STALLED";
  lastPacket: string;
  sensorsActive: number;
  sensorsTotal: number;
  backend: "CONNECTED" | "MOCK";
  database: "CONNECTED" | "MOCK";
}
