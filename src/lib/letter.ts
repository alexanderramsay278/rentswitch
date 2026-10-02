/**
 * Rentswitch - landlord letter generator.
 *
 * Product Spec section 2 (output 3) and section 3.5: this is a TERM SHEET, not a request.
 *
 * COPY OWNERSHIP: Alex owns the persuasive copy (Gameplan, deliverable 2).
 * The strings below are a working default built around the real numbers -
 * edit the prose freely, but do NOT change which numbers appear or the
 * assumption disclosures, because the video and submission both promise
 * "where we assumed, the screen says so".
 *
 * LEGAL BLOCKS — VERIFIED 2026-10-02, pulled forward from the Sat 09:00 slot.
 * Both claims below now default ON because each was checked against a primary
 * source (see data/constants.json -> legal). The third item, NSW rent-increase
 * rules, was also verified but does not appear in the letter: it only
 * constrains Offer C, and Offer B is what fires at Sydney rents.
 *
 * ⚠️ The wording below deliberately separates WHAT THE ACT SAYS from WHAT WE
 * INFER. "A failed hot water service is an urgent repair" is statute.
 * "So you'll pay emergency rates" is not — it is a practical consequence, and
 * it is worded as one. Do not tighten that into a legal claim.
 */

import type { Result, Constants } from "./engine";

export interface LetterOptions {
  tenantName?: string;
  landlordName?: string;
  propertyAddress?: string;
  /** Gate: Residential Tenancies Act 2010 (NSW) urgent-repair status. VERIFY the section first. */
  includeUrgentRepairClaim?: boolean;
  /** Gate: NSW rent-increase frequency and notice rules. VERIFY with Fair Trading first. */
  includeRentIncreaseClaim?: boolean;
  /** Gate: depreciation pointer. VERIFY on ato.gov.au. Narrative only - never a computed figure. */
  includeDepreciationPointer?: boolean;
}

const money = (x: number) =>
  "$" + Math.round(x).toLocaleString("en-AU");

export function generateLetter(
  r: Result,
  c: Constants,
  o: LetterOptions = {}
): string {
  const tenant = o.tenantName || "[your name]";
  const landlord = o.landlordName || "[landlord or agent]";
  const address = o.propertyAddress || "[property address]";
  const d = r.deal;

  const lines: string[] = [];

  lines.push(`Dear ${landlord},`);
  lines.push("");
  lines.push(
    `I'd like to propose replacing the gas hot water system at ${address} with an electric heat pump when it next needs replacing. I've done the numbers from both sides, and I think this is worth your time.`
  );
  lines.push("");

  // --- The counterfactual. This is the whole argument. ---
  lines.push("WHAT IT ACTUALLY COSTS YOU");
  lines.push("");
  lines.push(
    `This isn't a request to spend ${money(c.cHeatPump)} you weren't going to spend. Hot water systems fail, and when this one does you're replacing it either way. A like-for-like gas replacement costs about ${money(c.cGasReplace)} installed. A heat pump costs about ${money(c.cHeatPump)}.`
  );
  if (c.rebate > 0) {
    lines.push(
      `After the ${money(c.rebate)} rebate, your heat pump cost is ${money(r.landlord.headlineNetCost)}.`
    );
  }
  lines.push("");
  lines.push(
    `So the real decision isn't ${money(c.cHeatPump)} versus nothing. It's ${money(r.landlord.incremental)} extra, once, at a replacement you were already going to pay for.`
  );
  lines.push("");

  // --- The split incentive, stated plainly. ---
  lines.push("WHAT IT SAVES - AND WHO GETS THE SAVING");
  lines.push("");
  lines.push(
    `The change cuts the hot water bill by about ${money(r.saving.total)} a year.`
  );
  if (r.saving.supply > 0) {
    lines.push(
      `About ${money(r.saving.supply)} of that is the daily gas supply charge, which disappears entirely once the last gas appliance is gone. That part is payable no matter how little gas is actually used.`
    );
  }
  lines.push(
    `It also cuts emissions by about ${Math.round(r.emissions.savedKgPerYear)} kg CO2-e a year, a reduction of ${Math.round(r.emissions.percentCut)}%.`
  );
  lines.push("");
  lines.push(
    `Here's the problem, stated honestly: I get that saving, and you pay for it. At ${money(r.saving.total)} a year against ${money(r.landlord.incremental)} extra, it takes ${r.landlord.yearsOfTenantSaving.toFixed(1)} years of my savings to cover your cost - and none of that money ever reaches you. That's why these upgrades don't happen in rentals, and it isn't anyone behaving badly. So here's what I can offer.`
  );
  lines.push("");

  // --- The offer. Term sheet, not a plea. ---
  lines.push("WHAT I'M OFFERING");
  lines.push("");

  switch (d?.offer) {
    case "A":
      lines.push(
        `At replacement time this costs you nothing extra - the rebates cover the difference against a like-for-like gas replacement. I'm not asking for anything in return. I'd just like to agree now that when the system is replaced, it's replaced with a heat pump.`
      );
      break;

    case "B":
      lines.push(
        `I'll sign a longer fixed-term lease. A vacancy between tenancies costs you around ${money(d.vacancyValue)} once letting fees and advertising are counted - more than the ${money(r.landlord.incremental)} difference. One avoided turnover more than pays for this.`
      );
      lines.push("");
      lines.push(
        `I'm not asking for a rent reduction and I'm not asking you to fund anything I'd take with me. I'm offering certainty, which is the thing that's actually worth money to you here.`
      );
      break;

    case "C":
      lines.push(
        `I'll sign a longer fixed-term lease, which is worth about ${money(d.vacancyValue)} to you in avoided vacancy and letting costs. That leaves a gap of about ${money(d.gap)}.`
      );
      lines.push("");
      lines.push(
        `To close it, I'll accept a rent adjustment of $${d.weeklyRentAdjustment.toFixed(2)} a week at renewal. That pays your gap back in about ${d.paybackYears?.toFixed(1)} years, and it's deliberately set below what I save - I'd still be about ${money(d.tenantNetBenefit)} a year better off, and so would you. If it were set any higher this would just be a rent rise with a climate label on it, and I'm not going to propose that.`
      );
      break;

    default:
      lines.push(
        `On the numbers I have, I can't put together an offer that makes this work for you without costing me more than I'd save - the gap is about ${money(d?.gap ?? r.landlord.incremental)}. I'd rather tell you that than dress it up. If you're replacing the system anyway, or if a rebate applies that I haven't accounted for, the picture changes and I'd like to revisit it.`
      );
      break;
  }
  lines.push("");

  // --- Gated legal claims. OFF until verified. ---
  const legal: string[] = [];
  if (o.includeUrgentRepairClaim ?? true) {
    legal.push(
      `Replacing it on your timetable is cheaper than replacing it on its own. Under the Residential Tenancies Act 2010 (NSW), a failure of the hot water service is an urgent repair — so when this one dies, you'll be arranging a replacement at short notice. In practice that means less room to compare quotes, and the rebate schemes get hard to use: they need an accredited installer and a model that's on the register, which is not what turns up on a Sunday. Deciding now keeps all of that on the table.`
    );
  }
  if (o.includeDepreciationPointer ?? true) {
    legal.push(
      `It's also worth asking your accountant about depreciation. A brand-new hot water system in a rental is generally a depreciating asset — the 2017 change that removed deductions for second-hand assets doesn't apply to new ones. I haven't put a number on that, because it depends on your circumstances rather than mine.`
    );
  }
  if (legal.length) {
    lines.push("A COUPLE OF OTHER THINGS");
    lines.push("");
    lines.push(...legal);
    lines.push("");
  }

  lines.push(
    `Happy to talk this through, and happy to be the one who gets the quotes.`
  );
  lines.push("");
  lines.push("Kind regards,");
  lines.push(tenant);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("HOW THESE NUMBERS WERE WORKED OUT");
  lines.push(
    `Tariffs: AER Consumer Data Right, AGL Residential Standing Offer (the regulated reference offer), retrieved 2026-10-02. Emissions factors: DCCEEW National Greenhouse Accounts Factors 2026. Installed costs: DCCEEW Decision Regulation Impact Statement, Heat Pump Water Heaters, April 2026, Table 20. Hot water demand: ${c.L} L per person per day, the figure NSW used in its own Energy Savings Scheme modelling. Heat pump efficiency: COP ${c.cop}, derived from the minimum 60% saving a compliant unit must achieve - a worst-case compliant unit, not a best-case one.`
  );

  if (r.warnings.length) {
    lines.push("");
    lines.push("Assumptions that apply to your situation:");
    r.warnings.forEach((w) => lines.push(`- ${w}`));
  }

  return lines.join("\n");
}
