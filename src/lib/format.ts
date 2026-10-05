export const formatValue = (v: number, decimals: number) => v.toFixed(decimals);

export const formatTime = (iso: string, withSeconds = true) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
  });

export const formatRange = (min: number, max: number, unit: string) => `${min} – ${max} ${unit}`;
