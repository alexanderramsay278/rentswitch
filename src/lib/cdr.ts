/**
 * Rentswitch - read tariffs straight out of an AER Consumer Data Right plan detail response.
 *
 * Used for every state except NSW (which reads the reduced data/tariffs.json, unchanged since
 * the numbers quoted in the submission were verified against it). The rules here are the
 * ones the NSW and Victorian models already follow, written down once:
 *
 *   - Heat pump rate: the rate in force at 03:00 on a weekday. A heat pump on a timer runs
 *     overnight. This reproduces the NSW off-peak rate and the Victorian overnight rate
 *     exactly. In Queensland and South Australia a cheaper midday rate exists; we do not
 *     use it, which keeps the saving conservative.
 *   - Peak: the dearest time-of-use rate on the plan.
 *   - Gas blocks: converted to daily volumes. Two-monthly blocks divide by 60, which matches
 *     a retailer's own daily blocks on the same Victorian network exactly; other periods
 *     use 30 days a month and 365 a year.
 *
 * Anything ambiguous (seasonal periods that disagree at 03:00, an unknown block period, no
 * rate covering 03:00) throws instead of guessing, so `npm run verify` and the build fail.
 */

import type { GasBlock } from "./engine";

interface CdrRate {
  unitPrice: string;
  volume?: number;
}

interface CdrWindow {
  days?: string[];
  startTime?: string;
  endTime?: string;
}

interface CdrTouRate {
  type?: string;
  rates: CdrRate[];
  timeOfUse?: CdrWindow[];
}

interface CdrPeriod {
  dailySupplyCharge?: string;
  rateBlockUType?: string;
  singleRate?: { rates: CdrRate[]; period?: string };
  timeOfUseRates?: CdrTouRate[];
}

interface CdrControlledLoad {
  singleRate?: { rates: CdrRate[]; dailySupplyCharge?: string };
}

export interface CdrPlanDetail {
  data: {
    planId: string;
    electricityContract?: { tariffPeriod: CdrPeriod[]; controlledLoad?: CdrControlledLoad[] };
    gasContract?: { tariffPeriod: CdrPeriod[] };
  };
}

export interface ElectricityTariff {
  peak: number;
  offPeak: number;
  controlledLoad: number;
  electricitySupply: number;
  controlledLoadSupply: number;
}

export interface GasTariff {
  gasBlocks: GasBlock[];
  gasSupply: number;
}

/** The hour a timer-driven heat pump is assumed to be running. */
const HEAT_PUMP_TIME = "03:00";
const WEEKDAY = "TUE";

function fail(planId: string, why: string): never {
  throw new Error(`Rentswitch CDR: ${planId}: ${why}`);
}

/** "HH:MM" -> minutes. CDR end times are inclusive ("20:59") or exclusive ("21:00"). */
function minutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function windowCovers(w: CdrWindow, time: string, day: string): boolean {
  if (w.days && !w.days.includes(day)) return false;
  const t = minutes(time);
  const start = minutes(w.startTime ?? "00:00");
  const end = minutes(w.endTime ?? "23:59");
  // A window that ends before it starts wraps past midnight ("21:00" to "06:59").
  return start <= end ? t >= start && t <= end : t >= start || t <= end;
}

function rateAt(period: CdrPeriod, planId: string): number {
  if (period.singleRate) {
    return Number(period.singleRate.rates[0].unitPrice);
  }
  const hits = (period.timeOfUseRates ?? []).filter((r) =>
    (r.timeOfUse ?? []).some((w) => windowCovers(w, HEAT_PUMP_TIME, WEEKDAY))
  );
  const prices = new Set(hits.map((r) => Number(r.rates[0].unitPrice)));
  if (prices.size !== 1) {
    fail(planId, `expected exactly one rate at ${HEAT_PUMP_TIME}, found ${prices.size}`);
  }
  return [...prices][0];
}

export function electricityFromCdr(detail: CdrPlanDetail): ElectricityTariff {
  const { planId, electricityContract: c } = detail.data;
  if (!c || c.tariffPeriod.length === 0) fail(planId, "no electricity tariff periods");

  const overnight = new Set(c.tariffPeriod.map((p) => rateAt(p, planId)));
  if (overnight.size !== 1) fail(planId, "seasonal periods disagree on the overnight rate");
  const supplies = new Set(c.tariffPeriod.map((p) => Number(p.dailySupplyCharge)));
  if (supplies.size !== 1) fail(planId, "seasonal periods disagree on the supply charge");

  const allRates = c.tariffPeriod.flatMap((p) =>
    p.singleRate
      ? [Number(p.singleRate.rates[0].unitPrice)]
      : (p.timeOfUseRates ?? []).map((r) => Number(r.rates[0].unitPrice))
  );

  const cl = c.controlledLoad?.[0]?.singleRate;
  return {
    peak: Math.max(...allRates),
    offPeak: [...overnight][0],
    // Zero when the plan has no controlled load circuit. The results page prices the heat
    // pump at the overnight rate, never on controlled load, so this is never used as a price.
    controlledLoad: cl ? Number(cl.rates[0].unitPrice) : 0,
    electricitySupply: [...supplies][0],
    controlledLoadSupply: cl?.dailySupplyCharge ? Number(cl.dailySupplyCharge) : 0,
  };
}

/** Days per CDR block period. P2M = 60 is cross-checked against a daily (P1D) plan. */
const DAYS_PER_PERIOD: Record<string, number> = {
  P1D: 1,
  P1M: 30,
  P2M: 60,
  P3M: 90,
  P1Y: 365,
};

export function gasFromCdr(detail: CdrPlanDetail): GasTariff {
  const { planId, gasContract: c } = detail.data;
  if (!c || c.tariffPeriod.length !== 1) fail(planId, "expected one gas tariff period");
  const period = c.tariffPeriod[0];
  if (!period.singleRate) fail(planId, "expected a single-rate (block) gas tariff");
  const blockPeriod = period.singleRate.period ?? "P1D";
  const days = DAYS_PER_PERIOD[blockPeriod];
  if (days === undefined) fail(planId, `unknown gas block period ${blockPeriod}`);
  return {
    gasBlocks: period.singleRate.rates.map((r) => ({
      volumeMJ: r.volume === undefined || r.volume === null ? undefined : r.volume / days,
      unitPrice: Number(r.unitPrice),
    })),
    gasSupply: Number(period.dailySupplyCharge),
  };
}
