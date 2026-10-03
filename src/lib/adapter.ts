/**
 * Rentswitch - adapter between the raw data files and the engine's types.
 *
 * data/constants.json and data/tariffs.json are the source of truth (government-sourced,
 * do not edit - see HANDOVER.md). Their shape does not match engine.ts's `Constants` and
 * `Tariffs` interfaces, because constants.json carries provenance (source, tier, url) next
 * to every value and tariffs.json is a flat list of every cached retail plan.
 *
 * This file is the only place that bridges the two. Both JSON files are static imports -
 * no fetch, no API call, nothing at runtime. The data was cached deliberately so the app
 * never needs network access to produce a result.
 */

import type { Constants, GasBlock, Tariffs } from "./engine";
import rawConstants from "../../data/constants.json" with { type: "json" };
import rawTariffs from "../../data/tariffs.json" with { type: "json" };

// ---------------------------------------------------------------------------
// Constants: nested { value, tier, source, ... } -> flat Constants
// ---------------------------------------------------------------------------

export const constants: Constants = {
  L: rawConstants.demand.L_litres_per_person_per_day.value,
  deltaT: rawConstants.demand.deltaT_kelvin.value,
  cWater: rawConstants.demand.specific_heat_water_kJ_per_L_per_K.value,
  etaGas: rawConstants.efficiency.eta_gas_storage.value,
  etaResistive: rawConstants.efficiency.eta_electric_resistive.value,
  cop: rawConstants.efficiency.COP_heat_pump.value,
  efElectricity: rawConstants.emissions.EF_electricity_NSW_kgCO2e_per_kWh.value,
  efGas: rawConstants.emissions.EF_gas_NSW_kgCO2e_per_MJ.value,
  cHeatPump: rawConstants.costs.C_heat_pump_installed.value,
  cGasReplace: rawConstants.costs.C_gas_storage_installed.value,
  cElectricReplace: rawConstants.costs.C_electric_storage_medium_installed.value,
  // Deliberately zero - see data/constants.json -> rebates._WARNING. Do not fill this in
  // with a plausible-looking number; every real rebate only improves the case.
  rebate: rawConstants.rebates.R_default.value,
  vacancyWeeks: rawConstants.deal.v_vacancy_weeks.value,
  lettingFeeWeeks: rawConstants.deal.f_letting_fee_weeks.value,
  maxPaybackYears: rawConstants.deal.T_max_years.value,
};

// ---------------------------------------------------------------------------
// Tariffs: pick two plans out of data/tariffs.json's `plans` array, build one Tariffs object
// ---------------------------------------------------------------------------

const ELECTRICITY_PLAN_ID = "AGL1189640SRE1@EME";
const GAS_PLAN_ID = "AGL1055990SRG3@EME";

interface RawPlan {
  planId: string;
  fuel: string;
  dailySupplyCharge: number;
  peak?: number | null;
  offPeak?: number | null;
  controlledLoad?: number | null;
  controlledLoadSupplyCharge?: number | null;
  blocks?: { volumeMJ: number | null; unitPrice: number }[];
}

const plans = (rawTariffs as { plans: RawPlan[] }).plans;

function findPlan(planId: string): RawPlan {
  const plan = plans.find((p) => p.planId === planId);
  if (!plan) {
    throw new Error(`Rentswitch adapter: tariff plan "${planId}" not found in data/tariffs.json`);
  }
  return plan;
}

const electricityPlan = findPlan(ELECTRICITY_PLAN_ID);
const gasPlan = findPlan(GAS_PLAN_ID);

if (electricityPlan.fuel !== "ELECTRICITY") {
  throw new Error(`Rentswitch adapter: expected ${ELECTRICITY_PLAN_ID} to be an ELECTRICITY plan.`);
}
if (gasPlan.fuel !== "GAS") {
  throw new Error(`Rentswitch adapter: expected ${GAS_PLAN_ID} to be a GAS plan.`);
}
if (!gasPlan.blocks || gasPlan.blocks.length === 0) {
  throw new Error(`Rentswitch adapter: gas plan ${GAS_PLAN_ID} has no blocks.`);
}

// engine.ts's GasBlock.volumeMJ is `number | undefined` (undefined = unbounded final block).
// The JSON encodes that same thing as `null`. Convert explicitly - `null !== undefined` in TS.
const gasBlocks: GasBlock[] = gasPlan.blocks.map((b) => ({
  volumeMJ: b.volumeMJ === null ? undefined : b.volumeMJ,
  unitPrice: b.unitPrice,
}));

export const tariffs: Tariffs = {
  peak: electricityPlan.peak ?? 0,
  offPeak: electricityPlan.offPeak ?? 0,
  controlledLoad: electricityPlan.controlledLoad ?? 0,
  electricitySupply: electricityPlan.dailySupplyCharge,
  controlledLoadSupply: electricityPlan.controlledLoadSupplyCharge ?? 0,
  gasBlocks,
  gasSupply: gasPlan.dailySupplyCharge,
};

// ---------------------------------------------------------------------------
// The other states. Same engine and same constants; each state swaps in its own emissions
// factors (DCCEEW NGA Factors 2026) and its own reference tariffs (AER CDR, capital-city
// postcode), read straight from the raw API responses by src/lib/cdr.ts. Every choice and
// its source is recorded in data/constants_<state>.json.
// ---------------------------------------------------------------------------

import { electricityFromCdr, gasFromCdr, type CdrPlanDetail } from "./cdr.ts";
import rawVic from "../../data/constants_vic.json" with { type: "json" };
import rawQld from "../../data/constants_qld.json" with { type: "json" };
import rawSa from "../../data/constants_sa.json" with { type: "json" };
import rawAct from "../../data/constants_act.json" with { type: "json" };
import rawTas from "../../data/constants_tas.json" with { type: "json" };
import vicElectricity from "../../data/cdr_raw/vic/detail_AGD790710SR_at_VEC.json" with { type: "json" };
import vicGas from "../../data/cdr_raw/vic/detail_AGD790588SR_at_VEC.json" with { type: "json" };
import qldElectricity from "../../data/cdr_raw/qld/detail_AGL1067193SRE2_at_EME.json" with { type: "json" };
import qldGas from "../../data/cdr_raw/qld/detail_AGL15285SRG33_at_EME.json" with { type: "json" };
import saElectricity from "../../data/cdr_raw/sa/detail_AGL1189631SRE1_at_EME.json" with { type: "json" };
import saGas from "../../data/cdr_raw/sa/detail_AGL15384SRG33_at_EME.json" with { type: "json" };
import actElectricity from "../../data/cdr_raw/act/detail_ACT62936SRE15_at_EME.json" with { type: "json" };
import actGas from "../../data/cdr_raw/act/detail_ACT64470SRG12_at_EME.json" with { type: "json" };
import tasElectricity from "../../data/cdr_raw/tas/detail_AUR1119317RRE1_at_EME.json" with { type: "json" };

export type ModelledState = "NSW" | "VIC" | "QLD" | "SA" | "ACT" | "TAS";

export interface StateModel {
  constants: Constants;
  tariffs: Tariffs;
  /** As used in a sentence: "on the NSW grid", "on the Victorian grid". */
  gridName: string;
  /** As used in a sentence: "New South Wales", "the ACT". */
  name: string;
  /** Capital city the tariffs were taken for. */
  city: string;
  /**
   * False when gas hot water cannot be priced in this state (no reference gas offer, or no
   * published emissions factor). The results page must say so rather than show a number.
   */
  hasGas: boolean;
  /** Why hasGas is false, for the page to state plainly. */
  gasTariffMissing: boolean;
  gasFactorMissing: boolean;
  /** Scope 3 (upstream) natural gas factor, kg CO2-e/GJ, DCCEEW Table 6 metro. */
  gasUpstreamKgPerGJ: number | null;
}

interface RawState {
  name: string;
  gridName: string;
  city: string;
  emissions: {
    EF_electricity_kgCO2e_per_kWh: { value: number };
    EF_gas_kgCO2e_per_MJ: { value: number; scope3_kgCO2e_per_GJ: number } | null;
  };
  tariffs: { electricityPlanId: string; gasPlanId: string | null };
}

function cdrState(raw: RawState, electricity: unknown, gas: unknown | null): StateModel {
  const e = electricity as CdrPlanDetail;
  const g = gas as CdrPlanDetail | null;
  if (e.data.planId !== raw.tariffs.electricityPlanId) {
    throw new Error(`Rentswitch adapter: ${raw.name} electricity detail is not ${raw.tariffs.electricityPlanId}.`);
  }
  if ((g?.data.planId ?? null) !== raw.tariffs.gasPlanId) {
    throw new Error(`Rentswitch adapter: ${raw.name} gas detail does not match ${raw.tariffs.gasPlanId}.`);
  }
  const efGas = raw.emissions.EF_gas_kgCO2e_per_MJ;
  const hasGas = g !== null && efGas !== null;
  return {
    constants: {
      ...constants,
      efElectricity: raw.emissions.EF_electricity_kgCO2e_per_kWh.value,
      // NaN, not a plausible number, so an unpriced gas case can never render as a figure.
      efGas: efGas?.value ?? NaN,
    },
    tariffs: {
      ...electricityFromCdr(e),
      ...(g ? gasFromCdr(g) : { gasBlocks: [], gasSupply: NaN }),
    },
    gridName: raw.gridName,
    name: raw.name,
    city: raw.city,
    hasGas,
    gasTariffMissing: g === null,
    gasFactorMissing: efGas === null,
    gasUpstreamKgPerGJ: efGas?.scope3_kgCO2e_per_GJ ?? null,
  };
}

export const STATE_MODELS: Record<ModelledState, StateModel> = {
  NSW: {
    constants,
    tariffs,
    gridName: "NSW",
    name: "New South Wales",
    city: "Sydney",
    hasGas: true,
    gasTariffMissing: false,
    gasFactorMissing: false,
    gasUpstreamKgPerGJ: rawConstants.emissions.EF_gas_NSW_kgCO2e_per_MJ.scope3_kgCO2e_per_GJ,
  },
  VIC: cdrState(rawVic, vicElectricity, vicGas),
  QLD: cdrState(rawQld, qldElectricity, qldGas),
  SA: cdrState(rawSa, saElectricity, saGas),
  ACT: cdrState(rawAct, actElectricity, actGas),
  TAS: cdrState(rawTas as RawState, tasElectricity, null),
};

export function isModelledState(code: string): code is ModelledState {
  // Own keys only: `in` would also accept inherited names such as "constructor".
  return Object.hasOwn(STATE_MODELS, code);
}
