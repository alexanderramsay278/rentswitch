/**
 * Rentswitch - per-state letter.
 *
 * src/lib/letter.ts is written for New South Wales and is not edited here. For every other
 * state the NSW-only content is swapped out after generation:
 *   - the NSW Energy Savings Scheme rebate paragraph becomes one that names only what we
 *     know applies there: Small scale Technology Certificates, a Commonwealth scheme
 *   - the Residential Tenancies Act 2010 (NSW) urgent repair claim is left out, because
 *     no other state's tenancy law has been checked
 *   - the tariff source line names that state's plan and its retrieval date
 * Every swap asserts the text it replaces is still there, so an edit to letter.ts fails
 * loudly in `npm run verify` instead of quietly leaving NSW copy in another state's letter.
 */

import type { Constants, Result } from "./engine";
import { generateLetter } from "./letter.ts";
import type { ModelledState } from "./adapter";

const NSW_REBATE_MARKER = "a discount under the NSW Energy Savings Scheme";
const NSW_TARIFF_SOURCE =
  "Tariffs: AER Consumer Data Right, AGL Residential Standing Offer (the regulated reference offer), retrieved 2026-10-02.";

const STC_ONLY = (name: string) =>
  `Those numbers assume no rebate at all, which is the cautious way to put it. Small scale Technology Certificates are a Commonwealth scheme, so they apply in ${name} too, and an accredited installer normally takes them straight off the invoice. I haven't counted any ${name} scheme on top, because I haven't checked what applies to a rental here. I haven't put a figure on any of it, because the amount depends on the model you pick and who fits it.`;

const STATE_LETTER: Record<Exclude<ModelledState, "NSW">, { rebate: string; tariffSource: string }> = {
  VIC: {
    rebate:
      "Those numbers assume no rebate at all, which is the cautious way to put it. Small scale Technology Certificates are a Commonwealth scheme, so they apply in Victoria too, and an accredited installer normally takes them straight off the invoice. Victoria's own Solar Homes hot water rebate is for owner-occupiers only, so it doesn't cover a rental. I haven't put a figure on any of it, because the amount depends on the model you pick and who fits it.",
    tariffSource:
      "Tariffs: AER Consumer Data Right, AGL Residential Standing Offer for Melbourne postcode 3000 (CitiPower and Australian Gas Networks), retrieved 2026-10-03.",
  },
  QLD: {
    rebate: STC_ONLY("Queensland"),
    tariffSource:
      "Tariffs: AER Consumer Data Right, AGL Residential Standing Offer for Brisbane postcode 4000 (Energex and Australian Gas Networks), retrieved 2026-10-03.",
  },
  SA: {
    rebate: STC_ONLY("South Australia"),
    tariffSource:
      "Tariffs: AER Consumer Data Right, AGL Residential Standing Offer for Adelaide postcode 5000 (SA Power Networks and Australian Gas Networks), retrieved 2026-10-03.",
  },
  ACT: {
    rebate: STC_ONLY("the ACT"),
    tariffSource:
      "Tariffs: AER Consumer Data Right, ActewAGL standing offers for Canberra postcode 2600 (Evoenergy), retrieved 2026-10-03.",
  },
  TAS: {
    rebate: STC_ONLY("Tasmania"),
    tariffSource:
      "Tariffs: AER Consumer Data Right, Aurora Energy Residential Peak and Off-Peak regulated offer for Hobart postcode 7000 (TasNetworks), retrieved 2026-10-03.",
  },
};

function swapLine(lines: string[], match: (l: string) => boolean, swap: (l: string) => string): void {
  const i = lines.findIndex(match);
  if (i === -1) {
    throw new Error("Rentswitch stateLetter: expected NSW letter text not found. Was letter.ts edited?");
  }
  lines[i] = swap(lines[i]);
}

export function generateStateLetter(r: Result, c: Constants, state: ModelledState): string {
  if (state === "NSW") return generateLetter(r, c);

  const local = STATE_LETTER[state];
  const lines = generateLetter(r, c, { includeUrgentRepairClaim: false }).split("\n");
  if (c.rebate === 0) {
    swapLine(lines, (l) => l.includes(NSW_REBATE_MARKER), () => local.rebate);
  }
  swapLine(
    lines,
    (l) => l.startsWith(NSW_TARIFF_SOURCE),
    (l) => l.replace(NSW_TARIFF_SOURCE, local.tariffSource)
  );
  return lines.join("\n");
}
