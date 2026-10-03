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

/** "$707 to $842". Collapses to one figure when both ends round the same. */
export function formatMoneyRange(low: number, high: number): string {
  const a = formatMoney(low);
  const b = formatMoney(high);
  return a === b ? a : `${a} to ${b}`;
}

export function formatKgRange(low: number, high: number): string {
  const a = Math.round(low).toLocaleString("en-AU");
  const b = Math.round(high).toLocaleString("en-AU");
  return a === b ? formatKg(low) : `${a} to ${b} kg CO₂e`;
}

export function formatYearsRange(low: number, high: number): string {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return formatYears(high);
  const a = low.toFixed(1);
  const b = high.toFixed(1);
  return a === b ? formatYears(low) : `${a} to ${b} years`;
}
