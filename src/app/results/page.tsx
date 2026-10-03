import Link from "next/link";
import type { ReactNode } from "react";
import { calculate, type CurrentSystem } from "@/lib/engine";
import { generateLetter } from "@/lib/letter";
import { constants, tariffs } from "@/lib/adapter";
import { queryToAnswers } from "@/lib/questions";
import { formatMoney, formatKg, formatYears, formatNumber } from "@/lib/format";
import LetterBlock from "@/components/LetterBlock";

const CURRENT_SYSTEM_LABEL: Record<CurrentSystem, string> = {
  gas: "gas storage",
  electric_tank: "electric storage tank",
  heat_pump: "electric heat pump",
  solar: "solar hot water",
};

const ESS_ACTIVITY_COPY: Record<"D19" | "D17", string> = {
  D19: "Replacing gas storage with a heat pump (NSW ESS activity D19)",
  D17: "Replacing an electric storage tank with a heat pump (NSW ESS activity D17)",
};

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const answers = queryToAnswers(sp);

  if (!answers) {
    return (
      <Shell>
        <h1 className="mb-4 text-xl font-semibold text-stone-900">
          We&apos;re missing an answer
        </h1>
        <p className="mb-6 max-w-prose text-stone-600">
          Something didn&apos;t come through from the questionnaire. We never guess numbers,
          so please start again.
        </p>
        <StartOverButton />
      </Shell>
    );
  }

  const result = calculate(constants, tariffs, {
    occupants: answers.occupants,
    hotWaterFuel: answers.hotWater,
    isLastGasAppliance: answers.isLastGasAppliance,
    heatPumpRate: "offPeak",
    weeklyRent: answers.weeklyRent,
  });

  const deal = result.deal;
  const isGas = result.currentSystem === "gas";
  const currentLabel = CURRENT_SYSTEM_LABEL[result.currentSystem];

  return (
    <Shell wide>
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-stone-900 hover:text-stone-700"
        >
          Rentswitch
        </Link>
        <Link href="/start" className="text-sm font-medium text-stone-500 hover:text-stone-700">
          Start over
        </Link>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Hero - the three headline figures, or the honest "already       */}
      {/* efficient" state. This is the number the whole product exists   */}
      {/* to produce, so it gets the most weight on the page.              */}
      {/* ---------------------------------------------------------------- */}
      <div className="rs-animate-in mb-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
          Your result
        </p>

        {result.upgradeModelled ? (
          <>
            <p className="mt-4 max-w-prose text-stone-700">
              You gain this every year. Your landlord pays this once. Neither of you is being
              unreasonable. This is the split incentive, in one screen.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <BigStat
                eyebrow="Tenant saving, per year"
                value={formatMoney(result.saving.total)}
                caption="What you keep in your pocket every year if this switch happens."
                accent
              />
              <BigStat
                eyebrow="Landlord cost, once"
                value={formatMoney(result.landlord.incremental)}
                caption="The extra cost over replacing like-for-like, paid once at install."
              />
              <BigStat
                eyebrow="Payback, in years"
                value={formatYears(result.landlord.yearsOfTenantSaving)}
                caption="Years of your saving it takes to cover the landlord's extra cost."
              />
            </div>

            <CostBreakdown
              currentLabel={currentLabel}
              usage={result.cost.gasUsagePerYear}
              supply={result.cost.gasSupplyPerYear}
              heatPump={result.cost.heatPumpUsagePerYear}
            />

            <Notes warnings={result.warnings} />
          </>
        ) : (
          <>
            <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
              You&apos;re already on the most efficient system
            </p>
            <p className="mt-4 max-w-prose text-stone-700">
              {currentLabel} is the best available option on the NSW grid today, so there&apos;s
              no upgrade to chase and nothing to ask your landlord for. There&apos;s still the
              electricity plan switch below, and that one only needs your own permission.
            </p>
            <Notes warnings={result.warnings} />
          </>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 1. Do now - no permission needed                                 */}
      {/* ---------------------------------------------------------------- */}
      <Section title="Do now, no permission needed">
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-5 text-sm text-stone-600">
          <p className="max-w-prose">
            Switching electricity retailer or plan type takes no landlord sign-off. This
            build&apos;s number is the upgrade that does need permission: the hot water system.
          </p>
          <p className="mt-3 max-w-prose">
            Your cooktop and space heating are asked about but deliberately not priced. Space
            heating depends on insulation and glazing, which five questions cannot establish,
            and a number we could not defend would undermine the two we can.
          </p>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 2. Ask your landlord - the offer to actually make                */}
      {/* ---------------------------------------------------------------- */}
      {result.upgradeModelled && deal && (
        <Section title="Ask your landlord" tone="primary">
          {result.essActivity && (
            <p className="mb-5 inline-block rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-600">
              {ESS_ACTIVITY_COPY[result.essActivity]}
            </p>
          )}
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Offer {deal.offer}
            </p>
            <p className="text-stone-800">{deal.headline}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {deal.vacancyValue > 0 && (
                <StatRow label="Avoided vacancy value" value={formatMoney(deal.vacancyValue)} />
              )}
              {deal.weeklyRentAdjustment > 0 && (
                <StatRow
                  label="Weekly rent adjustment"
                  value={`$${deal.weeklyRentAdjustment.toFixed(2)}`}
                />
              )}
              {deal.paybackYears !== null && (
                <StatRow label="Landlord payback" value={formatYears(deal.paybackYears)} />
              )}
              <StatRow label="Your net benefit, per year" value={formatMoney(deal.tenantNetBenefit)} />
            </dl>
            {answers.weeklyRent === undefined && (
              <p className="mt-4 max-w-prose text-sm text-stone-500">
                Add your weekly rent on the questionnaire to see what a longer lease is worth to
                your landlord.
              </p>
            )}
          </div>
        </Section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 3. The letter - only when there's something to actually propose  */}
      {/* ---------------------------------------------------------------- */}
      {result.upgradeModelled && (
        <Section title="The letter" tone="primary">
          <p className="mb-4 max-w-prose text-stone-600">
            A landlord business case, not a request. Built from the numbers above.
          </p>
          <LetterBlock letter={generateLetter(result, constants)} />
        </Section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* 4. What it adds up to                                             */}
      {/* ---------------------------------------------------------------- */}
      <Section title="What it adds up to">
        {result.upgradeModelled ? (
          <>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Energy, per year
                </h3>
                <dl className="space-y-2 text-sm">
                  <StatRow
                    label="Hot water demand"
                    value={`${formatNumber(result.energy.usefulMJPerYear)} MJ`}
                  />
                  {isGas && (
                    <StatRow
                      label="Gas delivered today"
                      value={`${formatNumber(result.energy.gasDeliveredMJPerYear)} MJ`}
                    />
                  )}
                  <StatRow
                    label="Heat pump electricity, if switched"
                    value={`${formatNumber(result.energy.heatPumpKWhPerYear)} kWh`}
                  />
                </dl>
              </div>
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Dollars, per year
                </h3>
                <dl className="space-y-2 text-sm">
                  <StatRow
                    label={isGas ? "Gas usage cost" : "Electric usage cost"}
                    value={formatMoney(result.cost.gasUsagePerYear)}
                  />
                  {isGas && (
                    <StatRow
                      label="Gas daily supply charge"
                      value={`${formatMoney(result.cost.gasSupplyPerYear)}${
                        result.cost.gasSupplyPerYear === 0
                          ? " (other gas appliances keep this charge)"
                          : ", the single largest piece of the saving"
                      }`}
                    />
                  )}
                  <StatRow
                    label="Heat pump running cost"
                    value={formatMoney(result.cost.heatPumpUsagePerYear)}
                  />
                  <StatRow label="Total saving" value={formatMoney(result.saving.total)} strong />
                </dl>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Emissions, per year
              </h3>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <StatRow
                  label={`${isGas ? "Gas" : "Electric"} hot water today`}
                  value={formatKg(result.emissions.gasKgPerYear)}
                />
                <StatRow
                  label="Heat pump, if switched"
                  value={formatKg(result.emissions.heatPumpKgPerYear)}
                />
                <StatRow
                  label="Cut"
                  value={`${formatKg(result.emissions.savedKgPerYear)} (${Math.round(
                    result.emissions.percentCut
                  )}%)`}
                  strong
                />
              </dl>
            </div>
          </>
        ) : (
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Your household, per year
            </h3>
            <dl className="space-y-2 text-sm">
              <StatRow
                label="Hot water demand"
                value={`${formatNumber(result.energy.usefulMJPerYear)} MJ`}
              />
              <StatRow
                label={`Estimated ${currentLabel} emissions`}
                value={formatKg(result.emissions.heatPumpKgPerYear)}
              />
            </dl>
            <p className="mt-4 max-w-prose text-sm text-stone-500">
              Because you&apos;re already on the option this tool would otherwise recommend,
              there&apos;s no further $ or kg CO₂e saving modelled here.
            </p>
          </div>
        )}

        <p className="mt-8 max-w-prose border-t border-stone-200 pt-4 text-sm text-stone-500">
          Australia needs 35% of households electrified by 2035. Almost a third of Australian
          households rent and can&apos;t make this switch without their landlord&apos;s consent.
          This is what one of those households looks like once the split incentive is actually
          quantified.
        </p>
      </Section>
    </Shell>
  );
}

function Notes({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="mt-6 space-y-2 border-t border-stone-200 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
        Notes on these figures
      </p>
      {warnings.map((w, i) => (
        <p key={i} className="max-w-prose text-sm leading-relaxed text-stone-500">
          {w}
        </p>
      ))}
    </div>
  );
}

function StartOverButton() {
  return (
    <Link
      href="/start"
      className="inline-block rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-700"
    >
      Start over
    </Link>
  );
}

function Shell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className={wide ? "w-full max-w-3xl" : "w-full max-w-xl"}>
        {wide ? (
          children
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  tone = "secondary",
  children,
}: {
  title: string;
  tone?: "primary" | "secondary";
  children: ReactNode;
}) {
  const isPrimary = tone === "primary";
  return (
    <section
      className={`mb-8 rounded-xl border shadow-sm ${
        isPrimary
          ? "border-emerald-300 bg-emerald-50/40 p-6 sm:p-8"
          : "border-stone-200 bg-white p-5 sm:p-6"
      }`}
    >
      <h2
        className={`mb-5 font-semibold tracking-tight text-stone-900 ${
          isPrimary ? "text-lg sm:text-xl" : "text-base sm:text-lg"
        }`}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function BigStat({
  eyebrow,
  value,
  caption,
  accent = false,
}: {
  eyebrow: string;
  value: string;
  caption: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white p-5 text-center shadow-sm ring-1 ring-stone-200 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{eyebrow}</p>
      <p
        className={`mt-2 text-4xl font-bold tabular-nums sm:text-5xl ${
          accent ? "text-emerald-700" : "text-stone-900"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs leading-snug text-stone-500">{caption}</p>
    </div>
  );
}

/**
 * Where the saving comes from: today's usage + gas supply charge, stacked against the
 * heat pump's running cost. One flat-colour, directly-labelled comparison, drawn from
 * fields already on `result.cost` - no new numbers, just a picture of the ones that exist.
 */
function CostBreakdown({
  currentLabel,
  usage,
  supply,
  heatPump,
}: {
  currentLabel: string;
  usage: number;
  supply: number;
  heatPump: number;
}) {
  const todayTotal = usage + supply;
  const scale = Math.max(todayTotal, heatPump, 1);
  const usagePct = (usage / scale) * 100;
  const supplyPct = (supply / scale) * 100;
  const heatPumpPct = (heatPump / scale) * 100;

  return (
    <div className="mt-8 border-t border-stone-200 pt-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        Where the saving comes from
      </p>
      <div className="mt-4 space-y-5">
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-stone-700">Today, {currentLabel}</span>
            <span className="font-semibold tabular-nums text-stone-900">
              {formatMoney(todayTotal)}
            </span>
          </div>
          <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-stone-100">
            <div className="h-full bg-stone-700" style={{ width: `${usagePct}%` }} />
            {supply > 0 && (
              <div className="h-full bg-amber-500" style={{ width: `${supplyPct}%` }} />
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
            <Legend swatch="bg-stone-700" label="Usage" value={formatMoney(usage)} />
            {supply > 0 && (
              <Legend swatch="bg-amber-500" label="Gas supply charge" value={formatMoney(supply)} />
            )}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-stone-700">With a heat pump</span>
            <span className="font-semibold tabular-nums text-stone-900">
              {formatMoney(heatPump)}
            </span>
          </div>
          <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-stone-100">
            <div className="h-full bg-emerald-600" style={{ width: `${heatPumpPct}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
            <Legend swatch="bg-emerald-600" label="Running cost" value={formatMoney(heatPump)} />
          </div>
        </div>
      </div>

      {supply > 0 && (
        <p className="mt-4 max-w-prose text-sm text-stone-500">
          {formatMoney(supply)} of today&apos;s cost is the daily gas supply charge. It is billed
          whether the household uses a lot of gas or almost none, and it only goes away when the
          connection does.
        </p>
      )}
    </div>
  );
}

function Legend({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${swatch}`} aria-hidden="true" />
      {label}: <span className="font-medium text-stone-700">{value}</span>
    </span>
  );
}

function StatRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-stone-100 py-1.5 last:border-0">
      <dt className="text-stone-500">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold text-stone-900" : "text-stone-700"}`}>
        {value}
      </dd>
    </div>
  );
}
