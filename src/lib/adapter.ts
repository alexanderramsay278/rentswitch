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
// Victoria. Same engine, same constants, VIC emissions factors and VIC tariffs.
// See data/constants_vic.json for every choice made here and why.
// ---------------------------------------------------------------------------

import rawVic from "../../data/constants_vic.json" with { type: "json" };
import vicElectricityDetail from "../../data/cdr_raw/vic/detail_AGD790710SR_at_VEC.json" with { type: "json" };
import vicGasDetail from "../../data/cdr_raw/vic/detail_AGD790588SR_at_VEC.json" with { type: "json" };

export const vicConstants: Constants = {
  ...constants,
  efElectricity: rawVic.emissions.EF_electricity_VIC_kgCO2e_per_kWh.value,
  efGas: rawVic.emissions.EF_gas_VIC_kgCO2e_per_MJ.value,
};

interface CdrRate {
  unitPrice: string;
  volume?: number;
}

function vicElectricity() {
  const d = vicElectricityDetail.data;
  if (d.planId !== rawVic.tariffs.electricityPlanId) {
    throw new Error(`Rentswitch adapter: VIC electricity detail is not ${rawVic.tariffs.electricityPlanId}.`);
  }
  const period = d.electricityContract.tariffPeriod[0];
  // Both windows are typed SHOULDER in the CDR response. The dearer one (15:00 to 21:00)
  // is the peak, the other covers every remaining hour and is what a timer can target.
  const prices = period.timeOfUseRates.map((t) => Number((t.rates as CdrRate[])[0].unitPrice));
  if (prices.length !== 2) {
    throw new Error("Rentswitch adapter: expected two time of use rates on the VIC plan.");
  }
  const cl = d.electricityContract.controlledLoad[0].singleRate;
  return {
    peak: Math.max(...prices),
    offPeak: Math.min(...prices),
    controlledLoad: Number((cl.rates as CdrRate[])[0].unitPrice),
    electricitySupply: Number(period.dailySupplyCharge),
    // The plan lists no separate controlled load supply charge.
    controlledLoadSupply: 0,
  };
}

// AGL publishes VIC gas blocks per two-month billing period. 60 days per period
// reproduces EnergyAustralia's daily blocks on the same network exactly.
const VIC_GAS_DAYS_PER_P2M = 60;

function vicGas() {
  const d = vicGasDetail.data;
  if (d.planId !== rawVic.tariffs.gasPlanId) {
    throw new Error(`Rentswitch adapter: VIC gas detail is not ${rawVic.tariffs.gasPlanId}.`);
  }
  const period = d.gasContract.tariffPeriod[0];
  if (period.singleRate.period !== "P2M") {
    throw new Error("Rentswitch adapter: VIC gas blocks are no longer two-monthly. Recheck the conversion.");
  }
  const blocks: GasBlock[] = (period.singleRate.rates as CdrRate[]).map((r) => ({
    volumeMJ: r.volume === undefined ? undefined : r.volume / VIC_GAS_DAYS_PER_P2M,
    unitPrice: Number(r.unitPrice),
  }));
  return { gasBlocks: blocks, gasSupply: Number(period.dailySupplyCharge) };
}

export const vicTariffs: Tariffs = { ...vicElectricity(), ...vicGas() };

// ---------------------------------------------------------------------------
// One lookup for the pages.
// ---------------------------------------------------------------------------

export type ModelledState = "NSW" | "VIC";

export interface StateModel {
  constants: Constants;
  tariffs: Tariffs;
  /** As used in a sentence: "on the NSW grid", "on the Victorian grid". */
  gridName: string;
  name: string;
}

export const STATE_MODELS: Record<ModelledState, StateModel> = {
  NSW: { constants, tariffs, gridName: "NSW", name: "New South Wales" },
  VIC: { constants: vicConstants, tariffs: vicTariffs, gridName: "Victorian", name: "Victoria" },
};

export function isModelledState(code: string): code is ModelledState {
  return code === "NSW" || code === "VIC";
}
