import Link from "next/link";
import type { ReactNode } from "react";
import { calculate } from "@/lib/engine";
import { generateLetter } from "@/lib/letter";
import { constants, tariffs } from "@/lib/adapter";
import { queryToAnswers, hotWaterIsModelled } from "@/lib/questions";
import { formatMoney, formatKg, formatYears, formatNumber } from "@/lib/format";
import LetterBlock from "@/components/LetterBlock";

const NOT_MODELLED_COPY: Record<string, { heading: string; body: string }> = {
  heat_pump: {
    heading: "You've already made this switch",
    body:
      "You told us your hot water already runs on an electric heat pump - that's the end state this whole tool is trying to get renters to. There's no upgrade left to model here.",
  },
  electric_tank: {
    heading: "Not modelled in this version",
    body:
      "Rentswitch's first build models one switch only: gas storage hot water to an electric heat pump. An electric resistive tank to heat pump switch is a real saving too, but it runs on a different formula that isn't built yet - it's in the project's future work, not invented on the spot.",
  },
  solar: {
    heading: "Not modelled in this version",
    body:
      "Solar hot water is already a low-emissions setup, and the gas-to-heat-pump switch this tool models doesn't apply to your case. We'd rather say that plainly than force a number that doesn't mean anything.",
  },
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
        <p className="mb-6 text-stone-600">
          Something didn&apos;t come through from the questionnaire. No numbers are being
          guessed here - please start again.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white hover:bg-emerald-700"
        >
          Start over
        </Link>
      </Shell>
    );
  }

  if (!hotWaterIsModelled(answers.hotWater)) {
    const copy = NOT_MODELLED_COPY[answers.hotWater];
    return (
      <Shell>
        <h1 className="mb-4 text-xl font-semibold text-stone-900 sm:text-2xl">
          {copy.heading}
        </h1>
        <p className="mb-6 text-stone-700">{copy.body}</p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white hover:bg-emerald-700"
        >
          Start over
        </Link>
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

  const letter = generateLetter(result, constants);
  const deal = result.deal;

  return (
    <Shell wide>
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-stone-900 sm:text-2xl">Your results</h1>
        <Link href="/" className="text-sm font-medium text-stone-500 hover:text-stone-700">
          Start over
        </Link>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 1. Do now - no permission needed (placeholder)                   */}
      {/* ---------------------------------------------------------------- */}
      <Section title="Do now — no permission needed">
        <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
          <p className="font-medium text-stone-600">Coming soon.</p>
          <p className="mt-1">
            No-permission moves like switching electricity retailer or plan type belong here.
            This build prices the one upgrade that needs your landlord&apos;s sign-off - P0 is
            hot water, gas storage to heat pump. Cooktop and space heating (what you told us in
            questions 4 and 5) aren&apos;t priced in this version; see the project&apos;s Future
            work.
          </p>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 2. Ask your landlord - the central claim                         */}
      {/* ---------------------------------------------------------------- */}
      <Section title="Ask your landlord" highlight>
        <p className="mb-6 text-stone-700">
          You gain this every year. Your landlord pays this once. Neither of you is being
          unreasonable - this is the split incentive, in one screen.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <BigStat label="You save every year" value={formatMoney(result.saving.total)} accent />
          <BigStat label="Landlord pays, once" value={formatMoney(result.landlord.incremental)} />
          <BigStat
            label="Years of your saving to cover it"
            value={formatYears(result.landlord.yearsOfTenantSaving)}
          />
        </div>

        {result.warnings.length > 0 && (
          <div className="mt-6 space-y-2">
            {result.warnings.map((w, i) => (
              <p
                key={i}
                className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
              >
                ⚠️ {w}
              </p>
            ))}
          </div>
        )}

        {deal && (
          <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-5">
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
              <p className="mt-4 text-sm text-stone-500">
                Add your weekly rent on the questionnaire to see what a longer lease is worth to
                your landlord.
              </p>
            )}
          </div>
        )}
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 3. The letter                                                     */}
      {/* ---------------------------------------------------------------- */}
      <Section title="The letter">
        <p className="mb-4 text-stone-600">
          A landlord business case, not a request - built from the numbers above.
        </p>
        <LetterBlock letter={letter} />
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 4. What it adds up to                                             */}
      {/* ---------------------------------------------------------------- */}
      <Section title="What it adds up to">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Energy, per year
            </h3>
            <dl className="space-y-2 text-sm">
              <StatRow
                label="Hot water demand"
                value={`${formatNumber(result.energy.usefulMJPerYear)} MJ`}
              />
              <StatRow
                label="Gas delivered today"
                value={`${formatNumber(result.energy.gasDeliveredMJPerYear)} MJ`}
              />
              <StatRow
                label="Heat pump electricity, if switched"
                value={`${formatNumber(result.energy.heatPumpKWhPerYear)} kWh`}
              />
            </dl>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Dollars, per year
            </h3>
            <dl className="space-y-2 text-sm">
              <StatRow label="Gas usage cost" value={formatMoney(result.cost.gasUsagePerYear)} />
              <StatRow
                label="Gas daily supply charge"
                value={`${formatMoney(result.cost.gasSupplyPerYear)}${
                  result.cost.gasSupplyPerYear === 0 ? " (stays - other gas appliances)" : " - the single largest piece of the saving"
                }`}
              />
              <StatRow
                label="Heat pump running cost"
                value={formatMoney(result.cost.heatPumpUsagePerYear)}
              />
              <StatRow label="Total saving" value={formatMoney(result.saving.total)} strong />
            </dl>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Emissions, per year
          </h3>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <StatRow label="Gas hot water today" value={formatKg(result.emissions.gasKgPerYear)} />
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

        <p className="mt-6 border-t border-stone-200 pt-4 text-sm text-stone-500">
          Australia needs 35% of households electrified by 2035. Almost a third of Australian
          households rent and can&apos;t make this switch without their landlord&apos;s consent -
          this is what one of those households looks like once the split incentive is actually
          quantified.
        </p>
      </Section>
    </Shell>
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
  highlight = false,
  children,
}: {
  title: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`mb-8 rounded-xl border p-6 shadow-sm sm:p-8 ${
        highlight
          ? "border-emerald-300 bg-emerald-50/40"
          : "border-stone-200 bg-white"
      }`}
    >
      <h2 className="mb-5 text-lg font-semibold text-stone-900 sm:text-xl">{title}</h2>
      {children}
    </section>
  );
}

function BigStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-white p-5 text-center shadow-sm ring-1 ring-stone-200">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p
        className={`mt-2 text-4xl font-bold tabular-nums ${
          accent ? "text-emerald-700" : "text-stone-900"
        }`}
      >
        {value}
      </p>
    </div>
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
