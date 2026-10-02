/**
 * Shared question definitions, option labels and the query-string encoding used to carry
 * answers from the wizard (src/components/Wizard.tsx) to the results page
 * (src/app/results/page.tsx). Kept separate from the engine/adapter - this file has no
 * bearing on the maths, only on what the UI asks and how it's labelled.
 */
import type { HotWaterFuel } from "./engine";

export const STATES = [
  { code: "NSW", label: "NSW" },
  { code: "VIC", label: "VIC" },
  { code: "QLD", label: "QLD" },
  { code: "SA", label: "SA" },
  { code: "ACT", label: "ACT" },
  { code: "TAS", label: "TAS" },
] as const;
export type StateCode = (typeof STATES)[number]["code"];

export const DWELLINGS = [
  { value: "apartment", label: "Apartment" },
  { value: "townhouse", label: "Townhouse or terrace" },
  { value: "house", label: "Freestanding house" },
] as const;
export type DwellingType = (typeof DWELLINGS)[number]["value"];

export const HOT_WATER_OPTIONS: { value: HotWaterFuel; label: string }[] = [
  { value: "gas", label: "Gas" },
  { value: "electric_tank", label: "Electric (standard tank)" },
  { value: "heat_pump", label: "Electric heat pump" },
  { value: "solar", label: "Solar hot water" },
  { value: "unsure", label: "Not sure" },
];

export const COOKTOP_OPTIONS = [
  { value: "gas", label: "Gas cooktop" },
  { value: "electric", label: "Electric (coil or ceramic)" },
  { value: "induction", label: "Induction" },
  { value: "unsure", label: "Not sure" },
] as const;
export type CooktopAnswer = (typeof COOKTOP_OPTIONS)[number]["value"];

export const HEATING_OPTIONS = [
  { value: "gas", label: "Gas heater" },
  { value: "electric", label: "Electric heater (plug-in or panel)" },
  { value: "reverse_cycle", label: "Reverse-cycle air con" },
  { value: "none", label: "Nothing or rarely" },
  { value: "unsure", label: "Not sure" },
] as const;
export type HeatingAnswer = (typeof HEATING_OPTIONS)[number]["value"];

export const OCCUPANT_OPTIONS = [1, 2, 3, 4] as const;
export type OccupantAnswer = (typeof OCCUPANT_OPTIONS)[number];

/** All the answers the wizard collects. */
export interface Answers {
  occupants: OccupantAnswer;
  state: StateCode;
  dwelling: DwellingType;
  hotWater: HotWaterFuel;
  /** Only meaningful (and only asked) when hotWater is "gas" or "unsure". */
  isLastGasAppliance: boolean;
  cooktop: CooktopAnswer;
  heating: HeatingAnswer;
  /** $/week. Optional - unlocks the landlord deal calculator. */
  weeklyRent?: number;
}

/** True when the P0 engine has a model for this household's hot water situation at all. */
export function hotWaterIsModelled(hotWater: HotWaterFuel): boolean {
  return hotWater === "gas" || hotWater === "unsure";
}

const QUERY_KEYS = {
  occupants: "occ",
  state: "state",
  dwelling: "dwelling",
  hotWater: "hw",
  isLastGasAppliance: "lastGas",
  cooktop: "cooktop",
  heating: "heating",
  weeklyRent: "rent",
} as const;

export function answersToQuery(a: Answers): string {
  const params = new URLSearchParams();
  params.set(QUERY_KEYS.occupants, String(a.occupants));
  params.set(QUERY_KEYS.state, a.state);
  params.set(QUERY_KEYS.dwelling, a.dwelling);
  params.set(QUERY_KEYS.hotWater, a.hotWater);
  params.set(QUERY_KEYS.isLastGasAppliance, a.isLastGasAppliance ? "yes" : "no");
  params.set(QUERY_KEYS.cooktop, a.cooktop);
  params.set(QUERY_KEYS.heating, a.heating);
  if (a.weeklyRent !== undefined && a.weeklyRent > 0) {
    params.set(QUERY_KEYS.weeklyRent, String(a.weeklyRent));
  }
  return params.toString();
}

const HOT_WATER_VALUES = new Set(HOT_WATER_OPTIONS.map((o) => o.value));
const DWELLING_VALUES = new Set(DWELLINGS.map((d) => d.value));
const COOKTOP_VALUES = new Set(COOKTOP_OPTIONS.map((o) => o.value));
const HEATING_VALUES = new Set(HEATING_OPTIONS.map((o) => o.value));

/** Parses the /results?... query string back into Answers. Returns null if incomplete/invalid. */
export function queryToAnswers(
  sp: Record<string, string | string[] | undefined>
): Answers | null {
  const get = (key: string): string | undefined => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const occRaw = Number(get(QUERY_KEYS.occupants));
  if (!OCCUPANT_OPTIONS.includes(occRaw as OccupantAnswer)) return null;

  const state = get(QUERY_KEYS.state);
  if (!state) return null;

  const dwelling = get(QUERY_KEYS.dwelling);
  if (!dwelling || !DWELLING_VALUES.has(dwelling as DwellingType)) return null;

  const hotWater = get(QUERY_KEYS.hotWater);
  if (!hotWater || !HOT_WATER_VALUES.has(hotWater as HotWaterFuel)) return null;

  const lastGasRaw = get(QUERY_KEYS.isLastGasAppliance);
  const cooktop = get(QUERY_KEYS.cooktop);
  if (!cooktop || !COOKTOP_VALUES.has(cooktop as CooktopAnswer)) return null;

  const heating = get(QUERY_KEYS.heating);
  if (!heating || !HEATING_VALUES.has(heating as HeatingAnswer)) return null;

  const rentRaw = get(QUERY_KEYS.weeklyRent);
  const weeklyRent = rentRaw ? Number(rentRaw) : undefined;

  return {
    occupants: occRaw as OccupantAnswer,
    state: state as StateCode,
    dwelling: dwelling as DwellingType,
    hotWater: hotWater as HotWaterFuel,
    isLastGasAppliance: lastGasRaw === "yes",
    cooktop: cooktop as CooktopAnswer,
    heating: heating as HeatingAnswer,
    weeklyRent: weeklyRent && weeklyRent > 0 ? weeklyRent : undefined,
  };
}
