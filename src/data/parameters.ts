import type { ParameterConfig, ParameterKey } from "../types/waterQuality";

/**
 * Parameter metadata and configured ranges.
 * Ranges are for UI demonstration only — they are not validated
 * drinking-water limits. Later these can come from GET /api/config.
 */
export const PARAMETERS: ParameterConfig[] = [
  { key: "ph", label: "pH", shortLabel: "pH", unit: "pH", range: { min: 6.5, max: 8.5 }, scale: { min: 5, max: 10 }, decimals: 2 },
  { key: "turbidity", label: "Turbidity", shortLabel: "Turbidity", unit: "NTU", range: { min: 0, max: 5 }, scale: { min: 0, max: 10 }, decimals: 2 },
  { key: "temperature", label: "Temperature", shortLabel: "Temp", unit: "°C", range: { min: 15, max: 35 }, scale: { min: 5, max: 45 }, decimals: 1 },
  { key: "tds", label: "TDS", shortLabel: "TDS", unit: "ppm", range: { min: 0, max: 500 }, scale: { min: 0, max: 1000 }, decimals: 0 },
  { key: "conductivity", label: "Conductivity", shortLabel: "Conductivity", unit: "µS/cm", range: { min: 0, max: 1000 }, scale: { min: 0, max: 2000 }, decimals: 0 },
  { key: "dissolvedOxygen", label: "Dissolved Oxygen", shortLabel: "DO", unit: "mg/L", range: { min: 5, max: 12 }, scale: { min: 0, max: 14 }, decimals: 1 },
];

export const PARAMETER_MAP = Object.fromEntries(
  PARAMETERS.map((p) => [p.key, p]),
) as Record<ParameterKey, ParameterConfig>;
