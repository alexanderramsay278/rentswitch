/**
 * Rentswitch - per-state letter.
 *
 * src/lib/letter.ts is written for New South Wales and is not edited here. For Victoria
 * the NSW-only content is swapped out after generation:
 *   - the NSW Energy Savings Scheme rebate paragraph becomes a Victorian one
 *   - the Residential Tenancies Act 2010 (NSW) urgent repair claim is left out, because
 *     the Victorian equivalent has not been checked against the Act
 *   - the tariff source line names the Victorian plan and its retrieval date
 * Every swap asserts the text it replaces is still there, so an edit to letter.ts fails
 * loudly in `npm run verify` instead of quietly leaving NSW copy in a Victorian letter.
 */

import type { Constants, Result } from "./engine";
import { generateLetter } from "./letter.ts";
import type { ModelledState } from "./adapter";

const NSW_REBATE_MARKER = "a discount under the NSW Energy Savings Scheme";
const NSW_TARIFF_SOURCE =
  "Tariffs: AER Consumer Data Right, AGL Residential Standing Offer (the regulated reference offer), retrieved 2026-10-02.";

const VIC_REBATE =
  "Those numbers assume no rebate at all, which is the cautious way to put it. Small scale Technology Certificates are a Commonwealth scheme, so they apply in Victoria too, and an accredited installer normally takes them straight off the invoice. Victoria's own Solar Homes hot water rebate is for owner-occupiers only, so it doesn't cover a rental. I haven't put a figure on any of it, because the amount depends on the model you pick and who fits it.";
const VIC_TARIFF_SOURCE =
  "Tariffs: AER Consumer Data Right, AGL Residential Standing Offer for Melbourne postcode 3000 (CitiPower and Australian Gas Networks), retrieved 2026-10-03.";

function swapLine(lines: string[], match: (l: string) => boolean, swap: (l: string) => string): void {
  const i = lines.findIndex(match);
  if (i === -1) {
    throw new Error("Rentswitch stateLetter: expected NSW letter text not found. Was letter.ts edited?");
  }
  lines[i] = swap(lines[i]);
}

export function generateStateLetter(r: Result, c: Constants, state: ModelledState): string {
  if (state === "NSW") return generateLetter(r, c);

  const lines = generateLetter(r, c, { includeUrgentRepairClaim: false }).split("\n");
  if (c.rebate === 0) {
    swapLine(lines, (l) => l.includes(NSW_REBATE_MARKER), () => VIC_REBATE);
  }
  swapLine(
    lines,
    (l) => l.startsWith(NSW_TARIFF_SOURCE),
    (l) => l.replace(NSW_TARIFF_SOURCE, VIC_TARIFF_SOURCE)
  );
  return lines.join("\n");
}
