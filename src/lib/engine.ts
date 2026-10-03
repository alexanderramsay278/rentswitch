/**
 * Rentswitch - dual-payback engine (P0: hot water, gas -> heat pump)
 *
 * Formulas: Model Maths sections 2-10. Reasoning: Product Spec section 3.
 * If a formula changes, change Model Maths FIRST, then mirror it here.
 *
 * Zero framework dependencies. Pure functions. Drop into any Next.js route.
 *
 * UNITS (Model Maths section 11 - check these first when a number looks wrong):
 *   gas       -> MJ,  $/MJ,  kg CO2-e/MJ
 *   electric  -> kWh, $/kWh, kg CO2-e/kWh
 *   1 kWh = 3.6 MJ
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HotWaterFuel = "gas" | "electric_tank" | "heat_pump" | "solar" | "unsure";
export type ElectricityRate = "peak" | "offPeak" | "controlledLoad";

export interface GasBlock {
  /** Daily volume this block covers, in MJ. Undefined = unbounded final block. */
  volumeMJ?: number;
  /** $/MJ */
  unitPrice: number;
}

export interface Tariffs {
  /** $/kWh */
  peak: number;
  offPeak: number;
  controlledLoad: number;
  /** $/day */
  electricitySupply: number;
  controlledLoadSupply: number;
  /** Stepped daily blocks, $/MJ */
  gasBlocks: GasBlock[];
  /** $/day */
  gasSupply: number;
}

export interface Constants {
  L: number;            // L/person/day
  deltaT: number;       // K
  cWater: number;       // kJ/(L.K)
  etaGas: number;
  etaResistive: number;
  cop: number;
  efElectricity: number; // kg CO2-e/kWh
  efGas: number;         // kg CO2-e/MJ
  cHeatPump: number;        // $
  cGasReplace: number;      // $  like-for-like gas storage replacement
  cElectricReplace: number; // $  like-for-like electric storage replacement
  rebate: number;           // $
  vacancyWeeks: number;
  lettingFeeWeeks: number;
  maxPaybackYears: number;
}

export interface Inputs {
  occupants: number;
  hotWaterFuel: HotWaterFuel;
  /** True if hot water is the ONLY remaining gas appliance. Drives the supply-charge saving. */
  isLastGasAppliance: boolean;
  /** Which electricity rate the heat pump is assumed to run on. Default: offPeak. */
  heatPumpRate?: ElectricityRate;
  /** $/week. Optional - enables the deal calculator. */
  weeklyRent?: number;
}

/** What the household runs today, after resolving "unsure". */
export type CurrentSystem = "gas" | "electric_tank" | "heat_pump" | "solar";

export interface Result {
  /** The system we modelled replacing, after resolving "unsure" to gas. */
  currentSystem: CurrentSystem;
  /**
   * False when there is no hot water upgrade to recommend — the household is
   * already on a heat pump or solar. Every money/emissions figure is then zero
   * and the UI must say so rather than render an empty result as a saving.
   */
  upgradeModelled: boolean;
  /** NSW ESS activity code, for the letter and the README. */
  essActivity: "D19" | "D17" | null;
  energy: {
    usefulMJPerYear: number;
    usefulMJPerDay: number;
    gasDeliveredMJPerYear: number;
    heatPumpKWhPerYear: number;
  };
  cost: {
    gasUsagePerYear: number;
    gasSupplyPerYear: number;
    gasTotalPerYear: number;
    heatPumpUsagePerYear: number;
    heatPumpRateUsed: ElectricityRate;
    heatPumpRateDollars: number;
  };
  saving: {
    usage: number;        // S_usage
    supply: number;       // S_supply
    total: number;        // S
  };
  emissions: {
    gasKgPerYear: number;
    heatPumpKgPerYear: number;
    savedKgPerYear: number;
    percentCut: number;
  };
  landlord: {
    headlineNetCost: number;   // C - R
    incremental: number;       // I = (C - R) - C_gas
    yearsOfTenantSaving: number; // I / S
  };
  deal: DealResult | null;
  warnings: string[];
}

export type OfferType = "A" | "B" | "C" | "D";

export interface DealResult {
  offer: OfferType;
  headline: string;
  /** Weekly rent adjustment proposed. Always 0 for A and B. */
  weeklyRentAdjustment: number;
  /** What a vacancy costs the landlord, $ */
  vacancyValue: number;
  /** Gap remaining after the lease offer, $ */
  gap: number;
  /** Landlord payback on the gap, years. Null for A/B/D. */
  paybackYears: number | null;
  /** Tenant net annual benefit, $ */
  tenantNetBenefit: number;
}

// ---------------------------------------------------------------------------
// Core model - Model Maths sections 2-9
// ---------------------------------------------------------------------------

/** Section 2. Useful energy is independent of the appliance. */
export function usefulEnergyMJPerYear(c: Constants, occupants: number): number {
  return (occupants * c.L * c.deltaT * c.cWater / 1000) * 365;
}

/**
 * Walk a stepped daily gas block tariff.
 * Blocks are DAILY volumes (CDR returns period "P1D"), so we cost one day then annualise.
 */
export function gasUsageCostPerYear(blocks: GasBlock[], deliveredMJPerYear: number): number {
  const perDay = deliveredMJPerYear / 365;
  let remaining = perDay;
  let dailyCost = 0;

  for (const b of blocks) {
    if (remaining <= 0) break;
    const take = b.volumeMJ === undefined ? remaining : Math.min(remaining, b.volumeMJ);
    dailyCost += take * b.unitPrice;
    remaining -= take;
  }
  // Defensive: if blocks were all bounded and volume remains, charge at the last rate.
  if (remaining > 0 && blocks.length > 0) {
    dailyCost += remaining * blocks[blocks.length - 1].unitPrice;
  }
  return dailyCost * 365;
}

function electricityRate(t: Tariffs, rate: ElectricityRate): number {
  switch (rate) {
    case "peak": return t.peak;
    case "offPeak": return t.offPeak;
    case "controlledLoad": return t.controlledLoad;
  }
}

// ---------------------------------------------------------------------------
// Deal calculator - Model Maths section 10
// ---------------------------------------------------------------------------

export function computeDeal(
  c: Constants,
  I: number,
  S: number,
  weeklyRent: number | undefined
): DealResult {
  // 2. if I <= 0 -> OFFER A
  if (I <= 0) {
    return {
      offer: "A",
      headline: "At replacement time this costs you nothing extra.",
      weeklyRentAdjustment: 0,
      vacancyValue: 0,
      gap: I,
      paybackYears: null,
      tenantNetBenefit: S,
    };
  }

  // Deal calculator needs rent. Without it we can still report the gap.
  if (weeklyRent === undefined || weeklyRent <= 0) {
    return {
      offer: "D",
      headline: "Add your weekly rent to see what a longer lease is worth to your landlord.",
      weeklyRentAdjustment: 0,
      vacancyValue: 0,
      gap: I,
      paybackYears: null,
      tenantNetBenefit: S,
    };
  }

  // 3. V = W x (v + f)
  const V = weeklyRent * (c.vacancyWeeks + c.lettingFeeWeeks);

  // 4. if V >= I -> OFFER B
  if (V >= I) {
    return {
      offer: "B",
      headline: "A longer fixed term covers it on its own. No rent change needed.",
      weeklyRentAdjustment: 0,
      vacancyValue: V,
      gap: I - V,
      paybackYears: null,
      tenantNetBenefit: S,
    };
  }

  // 5. G = I - V
  const G = I - V;

  // 6. if G < S x T_max -> OFFER C
  if (G < S * c.maxPaybackYears) {
    // Default split: tenant keeps half the saving.
    const r = S / 104;                 // $/week
    const T = (2 * G) / S;             // years
    const B = S / 2;                   // $/yr

    // INVARIANT (hard-coded, not configurable): tenant must be cash-positive every week.
    if (!(r < S / 52)) {
      throw new Error(
        `Invariant violated: weekly rent adjustment ${r} is not below weekly saving ${S / 52}`
      );
    }

    return {
      offer: "C",
      headline: "Split the saving: a small rent adjustment, capped below what you save.",
      weeklyRentAdjustment: r,
      vacancyValue: V,
      gap: G,
      paybackYears: T,
      tenantNetBenefit: B,
    };
  }

  // 7. OFFER D - no honest deal. This is a feature.
  return {
    offer: "D",
    headline: "These numbers do not close. We are not going to invent a deal that works.",
    weeklyRentAdjustment: 0,
    vacancyValue: V,
    gap: G,
    paybackYears: null,
    tenantNetBenefit: S,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function calculate(c: Constants, t: Tariffs, input: Inputs): Result {
  const warnings: string[] = [];
  const rate: ElectricityRate = input.heatPumpRate ?? "offPeak";

  // --- Resolve which system we are actually replacing -----------------------
  // "unsure" falls back to gas storage, the most common case, and says so.
  const currentSystem: CurrentSystem =
    input.hotWaterFuel === "unsure" ? "gas" : input.hotWaterFuel;

  if (input.hotWaterFuel === "unsure") {
    warnings.push(
      "You weren't sure what heats your water, so we assumed gas storage, which is the most common case. Change it above."
    );
  }

  // Section 2-3: energy. Useful energy is independent of the appliance.
  const E = usefulEnergyMJPerYear(c, input.occupants);
  const D_gas = E / c.etaGas;                      // MJ/yr
  const D_res = E / c.etaResistive / 3.6;          // kWh/yr
  const D_hp = E / c.cop / 3.6;                    // kWh/yr

  const hpRate = electricityRate(t, rate);
  let hpUsage = D_hp * hpRate;
  // Controlled load needs its own metered circuit, which carries its own daily charge.
  if (rate === "controlledLoad") {
    hpUsage += 365 * t.controlledLoadSupply;
  }

  // --- Already efficient: nothing to upgrade --------------------------------
  // A heat pump or solar system is already the best available option. Returning
  // zeros here is deliberate: the alternative is presenting a fabricated saving.
  if (currentSystem === "heat_pump" || currentSystem === "solar") {
    const label = currentSystem === "heat_pump" ? "a heat pump" : "solar hot water";
    warnings.push(
      `You already have ${label}, which is the most efficient option available. There is no hot water upgrade for us to recommend. The permission-free actions below still apply.`
    );
    const nil = computeDeal(c, 0, 0, input.weeklyRent);
    return {
      currentSystem,
      upgradeModelled: false,
      essActivity: null,
      energy: {
        usefulMJPerYear: E,
        usefulMJPerDay: E / 365,
        gasDeliveredMJPerYear: 0,
        heatPumpKWhPerYear: D_hp,
      },
      cost: {
        gasUsagePerYear: 0, gasSupplyPerYear: 0, gasTotalPerYear: 0,
        heatPumpUsagePerYear: hpUsage, heatPumpRateUsed: rate, heatPumpRateDollars: hpRate,
      },
      saving: { usage: 0, supply: 0, total: 0 },
      emissions: {
        gasKgPerYear: 0,
        heatPumpKgPerYear: D_hp * c.efElectricity,
        savedKgPerYear: 0,
        percentCut: 0,
      },
      landlord: { headlineNetCost: 0, incremental: 0, yearsOfTenantSaving: 0 },
      deal: nil,
      warnings,
    };
  }

  // --- Section 4-6: cost and tenant saving, by current system ---------------
  const isGas = currentSystem === "gas";

  // What they pay today.
  const gasUsage = isGas ? gasUsageCostPerYear(t.gasBlocks, D_gas) : 0;
  // UNIT TRAP: the gas supply charge is per CONNECTION, and is only saved when
  // the connection is dropped. It never applies to an all-electric household.
  const gasSupply = isGas && input.isLastGasAppliance ? 365 * t.gasSupply : 0;
  const resUsage = isGas ? 0 : D_res * electricityRate(t, rate);

  const S_usage = (isGas ? gasUsage : resUsage) - hpUsage;
  const S_supply = gasSupply;
  const S = S_usage + S_supply;

  if (isGas && !input.isLastGasAppliance) {
    warnings.push(
      "You have other gas appliances, so the gas daily supply charge stays. Electrify the rest and that's another $" +
        (365 * t.gasSupply).toFixed(0) + " a year."
    );
  }
  if (!isGas) {
    warnings.push(
      "An electric storage tank is the most carbon-intensive way to heat water on the NSW grid, so the emissions saving here is large. The bill saving is smaller than a gas switch though, because there is no gas supply charge to shed."
    );
  }

  // Section 7: emissions. Gas uses EF per MJ; electricity uses EF per kWh.
  const emCurrent = isGas ? D_gas * c.efGas : D_res * c.efElectricity;
  const emHp = D_hp * c.efElectricity;
  const emSaved = emCurrent - emHp;

  // Section 8-9: landlord. The counterfactual is a like-for-like replacement
  // of whatever they have now - NOT the sticker price of the heat pump.
  const headlineNetCost = c.cHeatPump - c.rebate;
  const counterfactual = isGas ? c.cGasReplace : c.cElectricReplace;
  const I = headlineNetCost - counterfactual;
  const years = S > 0 ? I / S : Infinity;

  if (S <= 0) {
    warnings.push(
      "Modelled saving is zero or negative. Check the tariff and efficiency inputs before trusting this."
    );
  }

  const deal = computeDeal(c, I, S, input.weeklyRent);

  return {
    currentSystem,
    upgradeModelled: true,
    essActivity: isGas ? "D19" : "D17",
    energy: {
      usefulMJPerYear: E,
      usefulMJPerDay: E / 365,
      gasDeliveredMJPerYear: isGas ? D_gas : 0,
      heatPumpKWhPerYear: D_hp,
    },
    cost: {
      // For an electric household these carry the CURRENT electric cost, not gas.
      gasUsagePerYear: isGas ? gasUsage : resUsage,
      gasSupplyPerYear: gasSupply,
      gasTotalPerYear: (isGas ? gasUsage : resUsage) + gasSupply,
      heatPumpUsagePerYear: hpUsage,
      heatPumpRateUsed: rate,
      heatPumpRateDollars: hpRate,
    },
    saving: { usage: S_usage, supply: S_supply, total: S },
    emissions: {
      gasKgPerYear: emCurrent,
      heatPumpKgPerYear: emHp,
      savedKgPerYear: emSaved,
      percentCut: emCurrent > 0 ? (emSaved / emCurrent) * 100 : 0,
    },
    landlord: {
      headlineNetCost,
      incremental: I,
      yearsOfTenantSaving: years,
    },
    deal,
    warnings,
  };
}
