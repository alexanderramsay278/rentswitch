import { computeDeal, type Constants, type OfferType } from "@/lib/engine";
import { formatMoney } from "@/lib/format";

const OFFER_NAME: Record<OfferType, string> = {
  A: "Costs nothing extra",
  B: "Longer lease covers it",
  C: "Split the saving",
  D: "No honest deal",
};

const LADDER_RENTS = [200, 300, 400, 500, 600, 700, 800];

/**
 * The deal calculator has four branches, and at realistic rents only one of them fires.
 * This shows the same household across a range of weekly rents, so the other branches,
 * including the one that says the numbers do not close, are visible rather than hidden.
 * Every row is computeDeal() itself; nothing here is a separate model.
 */
export default function DealLadder({
  constants: c,
  incremental: I,
  saving: S,
  weeklyRent,
}: {
  constants: Constants;
  incremental: number;
  saving: number;
  weeklyRent?: number;
}) {
  const leaseWeeks = c.vacancyWeeks + c.lettingFeeWeeks;
  // Rent at which a longer lease alone covers the landlord's extra cost.
  const breakEven = I / leaseWeeks;
  // At or below this weekly rent the gap is too big to close inside T_max years: Offer D.
  const dCeiling = (I - S * c.maxPaybackYears) / leaseWeeks;

  // When D can fire for this household, include a row where it does, so it is seen.
  const dRow = dCeiling >= 50 ? [Math.floor(dCeiling / 10) * 10] : [];
  const rents = Array.from(
    new Set([...dRow, ...LADDER_RENTS, ...(weeklyRent ? [weeklyRent] : [])])
  ).sort((a, b) => a - b);
  const rows = rents.map((w) => ({ w, deal: computeDeal(c, I, S, w) }));

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <caption className="sr-only">Which offer the calculator makes at each weekly rent</caption>
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Rent a week</th>
              <th className="px-3 py-2 font-semibold">Offer</th>
              <th className="px-3 py-2 text-right font-semibold">Proposed rent change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ w, deal }) => {
              const yours = w === weeklyRent;
              return (
                <tr
                  key={w}
                  className={`border-t border-stone-100 ${yours ? "bg-emerald-50/70" : ""}`}
                >
                  <td className="px-3 py-2 tabular-nums text-stone-700">
                    {formatMoney(w)}
                    {yours && <span className="ml-2 text-xs font-semibold text-emerald-700">yours</span>}
                  </td>
                  <td className="px-3 py-2 text-stone-900">
                    <span className="font-semibold">{deal.offer}</span>{" "}
                    <span className="text-stone-600">{OFFER_NAME[deal.offer]}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                    {deal.weeklyRentAdjustment > 0
                      ? `+$${deal.weeklyRentAdjustment.toFixed(2)}`
                      : "none"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 max-w-prose space-y-2 text-sm text-stone-600">
        {I > 0 && (
          <li>
            <span className="font-semibold text-stone-800">B</span> fires from{" "}
            {formatMoney(Math.ceil(breakEven))} a week. That is where {leaseWeeks} weeks of rent, the
            vacancy and letting cost a longer lease avoids, matches the {formatMoney(I)} extra cost.
          </li>
        )}
        <li>
          <span className="font-semibold text-stone-800">C</span> fires below that. The rent change
          is always half the weekly saving, so the tenant stays ahead every week.
        </li>
        <li>
          <span className="font-semibold text-stone-800">D</span>{" "}
          {dCeiling > 0
            ? `fires at ${formatMoney(Math.floor(dCeiling))} a week or less. There the gap left after the lease would take more than ${c.maxPaybackYears} years of shared saving to close, so the calculator says the numbers do not close instead of inventing a deal.`
            : `cannot fire for this household at any rent. It would need the saving to fall below ${formatMoney(I / c.maxPaybackYears)} a year, where even ${c.maxPaybackYears} years of it could not close the gap. When that happens the calculator says so instead of inventing a deal.`}
        </li>
        <li>
          <span className="font-semibold text-stone-800">A</span>{" "}
          {I <= 0
            ? "applies at every rent here, because the extra cost is already zero or less."
            : `needs a rebate covering the full ${formatMoney(I)}. We model rebates at $0, so it does not fire here.`}
        </li>
      </ul>
    </div>
  );
}
