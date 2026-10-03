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

  // The letter must describe the system THIS household actually has.
  // Writing "gas" to an all-electric household is both wrong and obviously wrong
  // to the person receiving it, which destroys the credibility of every number
  // that follows.
  const isGas = r.currentSystem === "gas";
  const systemName = isGas ? "gas hot water system" : "electric hot water tank";
  const counterfactualCost = isGas ? c.cGasReplace : c.cElectricReplace;
  const counterfactualName = isGas
    ? "A like-for-like gas replacement"
    : "A like-for-like electric tank";

  lines.push(`Dear ${landlord},`);
  lines.push("");
  lines.push(
    `I want to raise something about the ${systemName} at ${address}. When it next needs replacing, I'd like you to consider a heat pump. I've worked through what that costs you, not just what it saves me.`
  );
  lines.push("");

  // --- The counterfactual. This is the whole argument. ---
  lines.push("What this actually costs you");
  lines.push("");
  lines.push(
    `Hot water systems fail. When this one does, you're buying a replacement either way. ${counterfactualName} runs about ${money(counterfactualCost)} installed. A heat pump is about ${money(c.cHeatPump)}.`
  );
  if (c.rebate > 0) {
    lines.push(
      `After the ${money(c.rebate)} rebate, your heat pump cost is ${money(r.landlord.headlineNetCost)}.`
    );
  }
  lines.push("");
  lines.push(
    `So the question isn't whether to spend ${money(c.cHeatPump)}. It's whether to spend ${money(r.landlord.incremental)} more than you were already going to.`
  );
  lines.push("");

  // Rebates: state the mechanism, never an amount. No primary source gave us a
  // dollar figure, so the model runs at zero and the letter says so plainly.
  if (c.rebate === 0) {
    lines.push(
      `Those numbers assume no rebate at all, which is the cautious way to put it. Two schemes can apply here and they stack, because one is run by New South Wales and the other by the Commonwealth: a discount under the NSW Energy Savings Scheme, and Small scale Technology Certificates. An accredited installer normally claims both and takes them straight off the invoice. I haven't put a figure on either, because the amount depends on the model you pick and who fits it.`
    );
    lines.push("");
    lines.push(
      `Timing does matter though. The certificates have to be assigned before the system goes in, and nobody can claim them back afterwards. That is the practical reason to settle this before the current unit settles it for us.`
    );
    lines.push("");
  }

  // --- The split incentive, stated plainly. ---
  lines.push("What it saves, and who gets the saving");
  lines.push("");
  lines.push(
    `The switch cuts the hot water bill by roughly ${money(r.saving.total)} a year.`
  );
  if (r.saving.supply > 0) {
    lines.push(
      `Of that, ${money(r.saving.supply)} is the daily gas supply charge, which only goes away if the gas connection goes entirely. You pay it whether the household burns a lot of gas or almost none.`
    );
  }
  lines.push(
    `It also cuts about ${Math.round(r.emissions.savedKgPerYear)} kg of CO2-e a year, down ${Math.round(r.emissions.percentCut)}%.`
  );
  lines.push("");
  lines.push(
    `Now the awkward part. I get that saving. You pay for it. On those numbers it takes ${r.landlord.yearsOfTenantSaving.toFixed(1)} years of my savings to cover your cost, and not a cent of it reaches you. That's the reason this almost never happens in rentals, and it isn't anyone behaving badly. It's just how the split falls. So I'd rather bring you something than only ask.`
  );
  lines.push("");

  // --- The offer. Term sheet, not a plea. ---
  lines.push("What I'm offering");
  lines.push("");

  switch (d?.offer) {
    case "A":
      lines.push(
        `At replacement time this costs you nothing extra, because the rebates cover the difference against ${counterfactualName.toLowerCase()}. I'm not asking for anything back. I'd just like us to agree now that when the system goes, it gets replaced with a heat pump.`
      );
      break;

    case "B":
      lines.push(
        `I'll sign a longer fixed term. A vacancy between tenancies costs you somewhere around ${money(d.vacancyValue)} once you add letting fees and advertising, which is more than the ${money(r.landlord.incremental)} difference. One turnover avoided covers it.`
      );
      lines.push("");
      lines.push(
        `I'm not asking for a rent reduction, and I'm not asking you to buy me anything I'd take when I go. What I'm offering is certainty about the lease, which is the part that's actually worth money to you.`
      );
      break;

    case "C":
      lines.push(
        `I'll sign a longer fixed term, which is worth about ${money(d.vacancyValue)} to you in avoided vacancy and letting costs. That leaves a gap of roughly ${money(d.gap)}.`
      );
      lines.push("");
      lines.push(
        `To close it, I'll take a rent adjustment of $${d.weeklyRentAdjustment.toFixed(2)} a week at renewal. That pays your gap back in about ${d.paybackYears?.toFixed(1)} years. I've set it below what I save on purpose, so I'd still be roughly ${money(d.tenantNetBenefit)} a year better off and so would you. Set it any higher and this is just a rent rise with a climate label on it, which I'm not going to propose.`
      );
      break;

    default:
      lines.push(
        `On the numbers I have, I can't put together an offer that works for you without costing me more than I'd save. The gap is about ${money(d?.gap ?? r.landlord.incremental)}. I'd rather say that than dress it up. If you're replacing the system anyway, or a rebate applies that I haven't counted, the picture changes and I'd like to come back to it.`
      );
      break;
  }
  lines.push("");

  // --- Gated legal claims. OFF until verified. ---
  const legal: string[] = [];
  if (o.includeUrgentRepairClaim ?? true) {
    legal.push(
      `Replacing it while it still works is cheaper than replacing it after it dies. Under the Residential Tenancies Act 2010 (NSW), hot water failure counts as an urgent repair, so you'd be organising it at short notice. That usually means less room to compare quotes. The rebate schemes also need an accredited installer and a model that's on the register, and that isn't what turns up on a Sunday afternoon.`
    );
  }
  if (o.includeDepreciationPointer ?? true) {
    legal.push(
      `Worth asking your accountant about depreciation too. A brand new hot water system in a rental is generally a depreciating asset. The 2017 change that stopped deductions for second-hand assets doesn't apply to new ones. I haven't tried to put a figure on it, since that depends on your situation and not mine.`
    );
  }
  if (legal.length) {
    lines.push("A couple of other things");
    lines.push("");
    lines.push(...legal);
    lines.push("");
  }

  lines.push(
    `Happy to talk it through. Happy to chase the quotes myself, too.`
  );
  lines.push("");
  lines.push("Kind regards,");
  lines.push(tenant);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("Where these numbers come from");
  lines.push(
    `Tariffs: AER Consumer Data Right, AGL Residential Standing Offer (the regulated reference offer), retrieved 2026-10-02. Emissions factors: DCCEEW National Greenhouse Accounts Factors 2026. Installed costs: DCCEEW Decision Regulation Impact Statement, Heat Pump Water Heaters, April 2026, Table 20. Hot water demand: ${c.L} L per person per day, the figure NSW used in its own Energy Savings Scheme modelling. Heat pump efficiency: COP ${c.cop}, derived from the minimum 60% saving a compliant unit must achieve, a worst-case compliant unit, not a best-case one.`
  );

  if (r.warnings.length) {
    lines.push("");
    lines.push("Assumptions that apply to your situation:");
    r.warnings.forEach((w) => lines.push(`- ${w}`));
  }

  return lines.join("\n");
}
