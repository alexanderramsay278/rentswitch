/** Display formatting. Currency as "$703", emissions as "266 kg CO2e". */

export function formatMoney(x: number): string {
  const sign = x < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(x)).toLocaleString("en-AU")}`;
}

export function formatKg(x: number): string {
  return `${Math.round(x).toLocaleString("en-AU")} kg CO₂e`;
}

export function formatYears(x: number): string {
  if (!Number.isFinite(x)) return "n/a";
  return `${x.toFixed(1)} years`;
}

export function formatNumber(x: number, digits = 0): string {
  return x.toLocaleString("en-AU", { maximumFractionDigits: digits });
}

