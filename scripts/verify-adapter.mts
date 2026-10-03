/**
 * Adapter verification gate - run with `npm run verify`.
 *
 * Confirms src/lib/adapter.ts maps data/constants.json and data/tariffs.json onto the
 * engine's Constants/Tariffs types correctly, by checking the known-good 2-person NSW
 * household figures quoted in README.md and HANDOVER.md. If this fails, the bug is in
 * the adapter - never "fix" it by changing engine.ts or the data files.
 */
import { calculate } from "../src/lib/engine.ts";
import { constants, tariffs, STATE_MODELS, type ModelledState } from "../src/lib/adapter.ts";
import { generateStateLetter } from "../src/lib/stateLetter.ts";

function runCase(
  label: string,
  hotWaterFuel: "gas" | "electric_tank",
  expected: {
    saving: number;
    incremental: number;
    years: number;
    savedKg: number;
    offer: string;
    essActivity: string | null;
  }
): boolean {
  const result = calculate(constants, tariffs, {
    occupants: 2,
    hotWaterFuel,
    isLastGasAppliance: true,
    heatPumpRate: "offPeak",
    weeklyRent: 650,
  });

  const checks: [string, number | string, number | string, number][] = [
    ["saving.total", result.saving.total, expected.saving, 1],
    ["landlord.incremental", result.landlord.incremental, expected.incremental, 0.01],
    ["landlord.yearsOfTenantSaving", result.landlord.yearsOfTenantSaving, expected.years, 0.05],
    ["emissions.savedKgPerYear", result.emissions.savedKgPerYear, expected.savedKg, 1],
  ];

  console.log(`\n-- ${label} --`);
  let ok = true;
  for (const [subLabel, actual, exp, tolerance] of checks) {
    const pass = Math.abs(Number(actual) - Number(exp)) <= tolerance;
    ok = ok && pass;
    console.log(`${pass ? "PASS" : "FAIL"}  ${subLabel} = ${actual} (expected ~${exp})`);
  }

  const offerPass = result.deal?.offer === expected.offer;
  ok = ok && offerPass;
  console.log(`${offerPass ? "PASS" : "FAIL"}  deal.offer = ${result.deal?.offer} (expected ${expected.offer})`);

  const essPass = result.essActivity === expected.essActivity;
  ok = ok && essPass;
  console.log(`${essPass ? "PASS" : "FAIL"}  essActivity = ${result.essActivity} (expected ${expected.essActivity})`);

  return ok;
}

const gasOk = runCase("Gas storage -> heat pump (D19)", "gas", {
  saving: 702.75,
  incremental: 2000,
  years: 2.846,
  savedKg: 266.5,
  offer: "B",
  essActivity: "D19",
});

const electricOk = runCase("Electric storage -> heat pump (D17)", "electric_tank", {
  saving: 225.4,
  incremental: 2400,
  years: 10.6,
  savedKg: 691,
  offer: "B",
  essActivity: "D17",
});

// --- Other states: same engine, each state's own tariffs (AER CDR, capital-city postcode)
// and emissions factors (DCCEEW NGA Factors 2026). Two people, last gas appliance, $650/wk.
function stateCase(
  code: Exclude<ModelledState, "NSW">,
  hotWaterFuel: "gas" | "electric_tank",
  expected: { saving: number; incremental: number; savedKg: number; offer: string }
): boolean {
  const m = STATE_MODELS[code];
  const result = calculate(m.constants, m.tariffs, {
    occupants: 2,
    hotWaterFuel,
    isLastGasAppliance: true,
    heatPumpRate: "offPeak",
    weeklyRent: 650,
    gridName: m.gridName,
  });
  console.log(`\n-- ${code} ${hotWaterFuel} -> heat pump --`);
  const checks: [string, number, number, number][] = [
    ["saving.total", result.saving.total, expected.saving, 1],
    ["landlord.incremental", result.landlord.incremental, expected.incremental, 0.01],
    ["emissions.savedKgPerYear", result.emissions.savedKgPerYear, expected.savedKg, 1],
  ];
  let ok = true;
  for (const [subLabel, actual, exp, tol] of checks) {
    const pass = Math.abs(actual - exp) <= tol;
    ok = ok && pass;
    console.log(`${pass ? "PASS" : "FAIL"}  ${subLabel} = ${actual} (expected ~${exp})`);
  }
  const offerPass = result.deal?.offer === expected.offer;
  ok = ok && offerPass;
  console.log(`${offerPass ? "PASS" : "FAIL"}  deal.offer = ${result.deal?.offer} (expected ${expected.offer})`);

  // The letter must not carry NSW-only law, rebate schemes or the NSW tariff line.
  const letter = generateStateLetter(result, m.constants, code);
  for (const banned of ["NSW Energy Savings Scheme", "(NSW)", "retrieved 2026-10-02"]) {
    const pass = !letter.includes(banned);
    ok = ok && pass;
    console.log(`${pass ? "PASS" : "FAIL"}  ${code} letter has no "${banned}"`);
  }
  return ok;
}

const others = [
  stateCase("VIC", "gas", { saving: 798.8, incremental: 2000, savedKg: 40.3, offer: "B" }),
  stateCase("VIC", "electric_tank", { saving: 198.8, incremental: 2400, savedKg: 876.6, offer: "B" }),
  stateCase("QLD", "gas", { saving: 874.9, incremental: 2000, savedKg: 156.2, offer: "B" }),
  stateCase("QLD", "electric_tank", { saving: 237.2, incremental: 2400, savedKg: 783.8, offer: "B" }),
  stateCase("SA", "gas", { saving: 799.3, incremental: 2000, savedKg: 535.1, offer: "B" }),
  stateCase("SA", "electric_tank", { saving: 305.2, incremental: 2400, savedKg: 247.5, offer: "B" }),
  stateCase("ACT", "gas", { saving: 710.1, incremental: 2000, savedKg: 266.5, offer: "B" }),
  stateCase("ACT", "electric_tank", { saving: 280.5, incremental: 2400, savedKg: 691.0, offer: "B" }),
  stateCase("TAS", "electric_tank", { saving: 159.6, incremental: 2400, savedKg: 268.1, offer: "B" }),
];

// Tasmania has no gas reference offer and a confidential gas factor: it must not be priceable.
const tasGasBlocked = !STATE_MODELS.TAS.hasGas && Number.isNaN(STATE_MODELS.TAS.constants.efGas);
console.log(`\n${tasGasBlocked ? "PASS" : "FAIL"}  TAS gas is not priced (hasGas=false, efGas=NaN)`);

const ok = gasOk && electricOk && others.every(Boolean) && tasGasBlocked;

if (!ok) {
  console.error("\nAdapter verification FAILED.");
  process.exit(1);
}
console.log("\nAdapter verification passed.");
