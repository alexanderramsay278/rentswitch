/**
 * Adapter verification gate - run with `npm run verify`.
 *
 * Confirms src/lib/adapter.ts maps data/constants.json and data/tariffs.json onto the
 * engine's Constants/Tariffs types correctly, by checking the known-good 2-person NSW
 * household figures quoted in README.md and HANDOVER.md. If this fails, the bug is in
 * the adapter - never "fix" it by changing engine.ts or the data files.
 */
import { calculate } from "../src/lib/engine.ts";
import { constants, tariffs } from "../src/lib/adapter.ts";

const result = calculate(constants, tariffs, {
  occupants: 2,
  hotWaterFuel: "gas",
  isLastGasAppliance: true,
  heatPumpRate: "offPeak",
  weeklyRent: 650,
});

const checks: [string, number | string, number | string, number][] = [
  ["saving.total", result.saving.total, 703, 1],
  ["landlord.incremental", result.landlord.incremental, 2000, 0.01],
  ["landlord.yearsOfTenantSaving", result.landlord.yearsOfTenantSaving, 2.8, 0.05],
  ["emissions.savedKgPerYear", result.emissions.savedKgPerYear, 266, 1],
];

let ok = true;
for (const [label, actual, expected, tolerance] of checks) {
  const pass = Math.abs(Number(actual) - Number(expected)) <= tolerance;
  ok = ok && pass;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label} = ${actual} (expected ~${expected})`);
}

const offerPass = result.deal?.offer === "B";
ok = ok && offerPass;
console.log(`${offerPass ? "PASS" : "FAIL"}  deal.offer = ${result.deal?.offer} (expected B)`);

if (!ok) {
  console.error("\nAdapter verification FAILED.");
  process.exit(1);
}
console.log("\nAdapter verification passed.");
