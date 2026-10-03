"use client";

/**
 * Bar visuals for /method, built from the same recipe as src/components/LandingVisuals.tsx:
 * a label and a bold value above a track that animates to width on scroll via Reveal's
 * render-prop. Kept in their own "use client" file for the same reason as LandingVisuals -
 * /method's page.tsx has no data of its own to fetch and stays a plain server component.
 */

import Reveal from "@/components/Reveal";

const APPLIANCE_UNITS: { label: string; units: number; tone: "stone" | "muted" | "accent" }[] = [
  { label: "Gas system", units: 1.8, tone: "stone" },
  { label: "Resistive electric tank", units: 1.0, tone: "muted" },
  { label: "Heat pump", units: 0.4, tone: "accent" },
];

const BAR_TONE: Record<"stone" | "muted" | "accent", string> = {
  stone: "bg-stone-700",
  muted: "bg-stone-400",
  accent: "bg-emerald-600",
};

export function ApplianceUnitsBars() {
  const max = Math.max(...APPLIANCE_UNITS.map((r) => r.units));
  return (
    <Reveal>
      {(visible) => (
        <div className="w-full space-y-4">
          {APPLIANCE_UNITS.map((row) => (
            <div key={row.label}>
              <div className="flex items-baseline justify-between text-sm text-stone-600">
                <span>{row.label}</span>
                <span className="font-semibold tabular-nums text-stone-900">
                  {row.units.toFixed(1)} units in
                </span>
              </div>
              <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-stone-200">
                <div
                  className={`h-full rounded-full transition-[width] duration-[1200ms] ease-out ${BAR_TONE[row.tone]}`}
                  style={{ width: visible ? `${(row.units / max) * 100}%` : "0%" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Reveal>
  );
}

const OVER_PREDICT: { occupants: string; pct: number }[] = [
  { occupants: "1 occupant", pct: 0 },
  { occupants: "2 occupants", pct: 16 },
  { occupants: "3 occupants", pct: 48 },
  { occupants: "4 occupants", pct: 63 },
  { occupants: "5+ occupants", pct: 71 },
];

/**
 * The one visual on this page that is meant to be hard to scroll past. Test 2 in the
 * Validation section shows our model is linear in occupants while real metered households
 * are not, and this is the gap that opens up as a result. Plain neutral colour throughout -
 * this is a limit we found, not a warning badge, so it gets the same stone palette as every
 * other comparison bar on the site rather than a colour borrowed from elsewhere.
 */
export function OverPredictBars() {
  const max = Math.max(...OVER_PREDICT.map((r) => r.pct));
  return (
    <Reveal>
      {(visible) => (
        <div className="w-full space-y-5 rounded-2xl border-2 border-stone-300 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            We over-predict by, versus a real metered household of the same size
          </p>
          {OVER_PREDICT.map((row) => (
            <div key={row.occupants}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-stone-600">{row.occupants}</span>
                <span className="text-2xl font-bold tabular-nums text-stone-900">
                  {row.pct === 0 ? "On the mark" : `+${row.pct}%`}
                </span>
              </div>
              <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-stone-200">
                <div
                  className="h-full rounded-full bg-stone-700 transition-[width] duration-[1200ms] ease-out"
                  style={{ width: visible ? `${(row.pct / max) * 100}%` : "0%" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Reveal>
  );
}
