"use client";

/**
 * The landing page (src/app/page.tsx) is a server component with no data of its own to
 * fetch - it stays that way for static generation. These three visuals need a render-prop
 * from Reveal (to know when they've scrolled into view), and a function can't cross the
 * server/client boundary as a prop, so they live here as their own small client bundle
 * instead of forcing the whole page to be a client component.
 */

import Reveal from "@/components/Reveal";

export function PercentBar({ pct }: { pct: number }) {
  return (
    <Reveal>
      {(visible) => (
        <div
          role="img"
          aria-label={`${pct} percent`}
          className="h-3 w-full overflow-hidden rounded-full bg-stone-200"
        >
          <div
            className="h-full rounded-full bg-emerald-600 transition-[width] duration-[1200ms] ease-out"
            style={{ width: visible ? `${pct}%` : "0%" }}
          />
        </div>
      )}
    </Reveal>
  );
}

export function SupplyChargeBar() {
  const total = 703;
  const supply = 306;
  const usage = total - supply;
  const usagePct = (usage / total) * 100;
  const supplyPct = (supply / total) * 100;

  return (
    <Reveal>
      {(visible) => (
        <div className="w-full">
          <div
            role="img"
            aria-label="Of $703, $397 is usage and $306 is the gas supply charge"
            className="flex h-4 w-full overflow-hidden rounded-full bg-stone-200"
          >
            <div
              className="h-full bg-stone-700 transition-[width] duration-[1200ms] ease-out"
              style={{ width: visible ? `${usagePct}%` : "0%" }}
            />
            <div
              className="h-full bg-amber-500 transition-[width] duration-[1200ms] ease-out"
              style={{ width: visible ? `${supplyPct}%` : "0%" }}
            />
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm text-stone-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-stone-700" aria-hidden="true" />
              Usage, ${usage}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
              Gas supply charge, ${supply}
            </span>
          </div>
        </div>
      )}
    </Reveal>
  );
}

export function EmissionsCompareBars() {
  const max = 691;
  return (
    <Reveal>
      {(visible) => (
        <div className="w-full space-y-4">
          <div>
            <div className="flex items-baseline justify-between text-sm text-stone-600">
              <span>Switching off gas</span>
              <span className="font-semibold tabular-nums text-stone-900">266 kg</span>
            </div>
            <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-emerald-600 transition-[width] duration-[1200ms] ease-out"
                style={{ width: visible ? `${(266 / max) * 100}%` : "0%" }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between text-sm text-stone-600">
              <span>If the tank is electric</span>
              <span className="font-semibold tabular-nums text-stone-900">691 kg</span>
            </div>
            <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-stone-700 transition-[width] duration-[1200ms] ease-out"
                style={{ width: visible ? `${(691 / max) * 100}%` : "0%" }}
              />
            </div>
          </div>
        </div>
      )}
    </Reveal>
  );
}
