/**
 * Adapter verification gate - run with `npm run verify`.
 *
 * Confirms src/lib/adapter.ts maps data/constants.json and data/tariffs.json onto the
 * engine's Constants/Tariffs types correctly, by checking the known-good 2-person NSW
 * household figures quoted in README.md and HANDOVER.md. If this fails, the bug is in
 * the adapter - never "fix" it by changing engine.ts or the data files.
 */
import { calculate } from "../src/lib/engine.ts";
import { constants, tariffs, STATE_MODELS } from "../src/lib/adapter.ts";
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

// --- Victoria: same engine, VIC tariffs (AER CDR, postcode 3000) and VIC emissions factors ---
function vicCase(
  label: string,
  hotWaterFuel: "gas" | "electric_tank",
  expected: { saving: number; incremental: number; savedKg: number; offer: string }
): boolean {
  const m = STATE_MODELS.VIC;
  const result = calculate(m.constants, m.tariffs, {
    occupants: 2,
    hotWaterFuel,
    isLastGasAppliance: true,
    heatPumpRate: "offPeak",
    weeklyRent: 650,
    gridName: m.gridName,
  });
  console.log(`\n-- ${label} --`);
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

  // The letter must not carry NSW-only law or rebate schemes into a Victorian letter.
  const letter = generateStateLetter(result, m.constants, "VIC");
  for (const banned of ["NSW Energy Savings Scheme", "(NSW)", "retrieved 2026-10-02"]) {
    const pass = !letter.includes(banned);
    ok = ok && pass;
    console.log(`${pass ? "PASS" : "FAIL"}  VIC letter has no "${banned}"`);
  }
  return ok;
}

const vicGasOk = vicCase("VIC gas storage -> heat pump", "gas", {
  saving: 798.8,
  incremental: 2000,
  savedKg: 40.3,
  offer: "B",
});
const vicElectricOk = vicCase("VIC electric storage -> heat pump", "electric_tank", {
  saving: 198.8,
  incremental: 2400,
  savedKg: 876.6,
  offer: "B",
});

const ok = gasOk && electricOk && vicGasOk && vicElectricOk;

if (!ok) {
  console.error("\nAdapter verification FAILED.");
  process.exit(1);
}
console.log("\nAdapter verification passed.");
