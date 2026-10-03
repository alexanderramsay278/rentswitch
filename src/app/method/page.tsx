import Link from "next/link";
import type { ReactNode } from "react";
import Reveal from "@/components/Reveal";
import SiteFooter from "@/components/SiteFooter";
import { ApplianceUnitsBars, OverPredictBars } from "@/components/MethodVisuals";
import { calculate } from "@/lib/engine";
import { STATE_MODELS, type ModelledState } from "@/lib/adapter";
import { formatMoney, formatKg, formatYears } from "@/lib/format";

const CTA_LABEL = "See your result";
const CTA_BUTTON_CLASS =
  "inline-block rounded-xl bg-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98]";

const SOURCES: { name: string; url: string; use: string; licence: string }[] = [
  {
    name: "AER Consumer Data Right, Energy Product Reference Data API",
    url: "https://cdr.energymadeeasy.gov.au",
    use: "NSW and Victorian electricity and gas tariffs, including the daily supply charge.",
    licence: "AER/CDR terms",
  },
  {
    name: "DCCEEW, National Greenhouse Accounts Factors 2026",
    url: "https://www.dcceew.gov.au/sites/default/files/documents/national-greenhouse-accounts-factors-2026.pdf",
    use: "Emissions factors for NSW and Victorian electricity and natural gas.",
    licence: "CC BY 4.0",
  },
  {
    name: "DCCEEW, Decision Regulation Impact Statement, April 2026",
    url: "https://www.energyrating.gov.au/sites/default/files/2026-04/DRIS%20Energy%20efficiency%20policy%20options%20for%20heat%20pump%20water%20heaters.pdf",
    use: "Installed cost of a heat pump versus a gas storage system, and the efficiency floor the heat pump's COP is derived from.",
    licence: "Australian Government publication",
  },
  {
    name: "NSW Energy Savings Scheme, Hot Water Rule Change consultation, 2023",
    url: "https://www.energy.nsw.gov.au/sites/default/files/2023-09/NSW-ESS-Hot-Water-Consultation-September-2023.pdf",
    use: "Hot water demand of 45 litres per person per day, and the NSW climate zone the model uses.",
    licence: "NSW Government publication",
  },
  {
    name: "energyrating.gov.au",
    url: "https://www.energyrating.gov.au",
    use: "Efficiency of a gas storage hot water system.",
    licence: "Australian Government publication",
  },
  {
    name: "ABS 2021 Census",
    url: "https://www.abs.gov.au/census",
    use: "The share of Australian households that rent.",
    licence: "CC BY 4.0",
  },
  {
    name: "AER, Residential Energy Consumption Benchmarks, 2020",
    url: "https://www.aer.gov.au/system/files/Residential%20energy%20consumption%20benchmarks%20-%209%20December%202020_0.pdf",
    use: "The metered household gas data used in the validation check below.",
    licence: "Australian Government publication",
  },
];

export default function MethodPage() {
  return (
    <div className="flex flex-1 flex-col">
      <MethodNav />
      <PageHeader />

      <div className="mx-auto w-full max-w-3xl space-y-16 px-4 pb-20 sm:px-8">
        <Section
          eyebrow="The model"
          title="We never read a meter"
          lead="Rentswitch does not measure anything in your home. It calculates the hot water energy a household of a given size must be using, then prices that. No sensor, no smart plug, no bill upload."
        >
          <div className="space-y-4 text-stone-700">
            <p>
              <strong className="font-semibold text-stone-900">
                How many people live there gives the useful energy required.
              </strong>{" "}
              That is litres per person per day, multiplied by the temperature rise needed to
              heat it. It is thermodynamics, not a guess, and it holds no matter which appliance
              is actually installed.
            </p>
            <p>
              <strong className="font-semibold text-stone-900">
                The appliance you tell us about converts that useful energy into the energy you
                actually buy.
              </strong>{" "}
              The same hot shower costs a different amount depending on what is heating it.
            </p>
          </div>

          <div className="mt-8">
            <ApplianceUnitsBars />
            <p className="mt-4 text-sm text-stone-500">
              Units of input energy needed to deliver one unit of hot water. A heat pump moves
              heat from the air into the tank rather than generating it from scratch, which is
              why it needs so much less.
            </p>
          </div>

          <p className="mt-8 text-stone-700">
            From there, live electricity and gas tariffs turn that energy into dollars, and
            DCCEEW&apos;s emissions factors turn it into kilograms of CO₂e. Nothing is estimated
            twice.
          </p>
        </Section>

        <Section
          eyebrow="The sources"
          title="Where every number comes from"
          lead="Seven sources, each a government publication or statutory dataset. None of them is a vendor estimate or a comparison site."
        >
          <DataTable
            wide
            caption="Data sources, what each is used for, and its licence"
            head={["Source", "What we use it for", "Licence"]}
            rows={SOURCES.map((s) => [
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-stone-900 underline underline-offset-2 hover:text-emerald-700"
              >
                {s.name}
              </a>,
              s.use,
              s.licence,
            ])}
          />
          <p className="mt-4 text-sm text-stone-500">
            Full detail, including how each figure was checked, is in the repository&apos;s{" "}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">CREDITS.md</code>.
          </p>
        </Section>

        <Section
          eyebrow="The validation"
          title="We checked our model against 1,062 metered households. It did not pass cleanly."
          lead="A model shown working against real data is worth more than a bigger one simply asserted. This is the external check we ran, failure included."
        >
          <div className="space-y-4 text-stone-700">
            <p>
              <strong className="font-semibold text-stone-900">Source.</strong> AER,{" "}
              <em>Residential energy consumption benchmarks</em>, 9 December 2020 (Frontier
              Economics), Table 30: New South Wales gas consumption benchmarks. The NSW gas
              sample covers 1,062 real metered households, the same dataset behind the
              &quot;households like yours&quot; box on an Australian energy bill.
            </p>
            <p>
              <strong className="font-semibold text-stone-900">What this is, and is not.</strong>{" "}
              The AER figure is total household gas: hot water, cooking and space heating
              combined. Our model covers hot water only. So this is a plausibility and scaling
              check, not a predicted-versus-actual accuracy test, and we do not claim an error
              percentage from it. It answers two falsifiable questions instead.
            </p>
          </div>

          <h3 className="mt-10 text-lg font-semibold tracking-tight text-stone-900">
            Test 1: plausibility
          </h3>
          <p className="mt-2 max-w-prose text-stone-600">
            Is our modelled hot water a believable share of the gas a real household of that
            size actually uses?
          </p>
          <div className="mt-5">
            <DataTable
              caption="Plausibility check: modelled hot water as a share of total metered household gas"
              head={["Occupants", "AER total household gas", "Our modelled hot water", "Share"]}
              rows={[
                ["1", "9,835 MJ", "5,625 MJ", "57%"],
                ["2", "16,945 MJ", "11,251 MJ", "66%"],
                ["3", "19,978 MJ", "16,876 MJ", "84%"],
                ["4", "24,160 MJ", "22,502 MJ", "93%"],
                ["5+", "28,799 MJ", "28,127 MJ", "98%"],
              ]}
            />
          </div>

          <h3 className="mt-10 text-lg font-semibold tracking-tight text-stone-900">
            Test 2: scaling
          </h3>
          <p className="mt-2 max-w-prose text-stone-600">
            Our model assumes demand is linear in occupants. Real households are not.
          </p>
          <div className="mt-5">
            <DataTable
              caption="Scaling check: how household gas use actually grows with occupants, against our linear model"
              head={["Occupants", "AER actual", "Our model", "We over-predict by"]}
              rows={[
                ["1", "1.00x", "1.00x", "0%"],
                ["2", "1.72x", "2.00x", "16%"],
                ["3", "2.03x", "3.00x", "48%"],
                ["4", "2.46x", "4.00x", "63%"],
                ["5+", "2.93x", "5.00x", "71%"],
              ]}
            />
          </div>

          <div className="mt-8">
            <OverPredictBars />
          </div>

          <div className="mt-10 space-y-4 text-stone-700">
            <p>
              <strong className="font-semibold text-stone-900">The finding.</strong> The model
              holds for one and two person households. Beyond that, it increasingly overstates
              the saving. At five occupants it would imply that 98% of all household gas goes to
              hot water, which cannot be true.
            </p>
            <p>
              <strong className="font-semibold text-stone-900">The cause.</strong> We assume hot
              water demand scales in a straight line with occupants, because we inherited the
              NSW Energy Savings Scheme&apos;s own flat figure of 45 litres per person per day.
              Real metered households are strongly sub-linear. Five people use 2.93 times the gas
              of a one-person household, not five times, because a household shares far more
              than it shares showers.
            </p>
            <p>
              <strong className="font-semibold text-stone-900">The consequence.</strong> The
              worked example used throughout this site is a two-person household, which sits
              inside the range where the model holds. Beyond two occupants, treat the figure as
              an upper bound. Calibrating the per-person curve against metered data is the first
              item in the project&apos;s future work.
            </p>
          </div>

          <p className="mt-6 border-l-2 border-stone-300 pl-4 text-stone-600 italic">
            We would rather publish the limit we found than an accuracy figure we did not
            measure.
          </p>

          <p className="mt-8 max-w-prose border-t border-stone-200 pt-6 text-sm text-stone-500">
            A third check, comparing predicted annual cost against individual households&apos;
            real bills, was planned and not completed. We could not collect a usable sample
            inside the event, and the one bill we were offered was a final bill for a vacant
            property, which would have produced a meaningless result, so it was left out rather
            than used.
          </p>
        </Section>

        <Section
          eyebrow="Victoria"
          title="The same switch, a different grid"
          lead="Victoria runs through the same engine with its own tariffs and its own emissions factors. Nothing else changes, so the difference between the two columns is the state, not the model."
        >
          <StateComparison />
          <p className="mt-6 max-w-prose text-stone-600">
            The bill saving is similar. The emissions cut is not. Victoria&apos;s grid is dirtier
            than New South Wales&apos;s, at 0.85 kg CO₂e per kWh against 0.67, and its gas supply
            chain is cleaner, at 4.0 kg CO₂e per GJ upstream against 13.1. A heat pump at the
            minimum compliant efficiency therefore cuts far less in Victoria. That is a real
            finding from the government factors, not an error, and it gets larger as the grid
            gets cleaner or the unit gets better.
          </p>
          <p className="mt-4 max-w-prose text-sm text-stone-500">
            Victorian tariffs are the AGL Residential Standing Offer for Melbourne postcode 3000,
            on the CitiPower and Australian Gas Networks networks, retrieved from the AER on
            3 October 2026. AGL publishes Victorian gas blocks per two months; we convert them to
            daily blocks by dividing by 60, which matches EnergyAustralia&apos;s daily blocks on
            the same network exactly. Victoria&apos;s main hot water rebate is for
            owner-occupiers only, so the renter case is modelled with no rebate, the same as NSW.
          </p>
        </Section>

        <Section
          eyebrow="What we left out"
          title="Four things we deliberately did not do"
          lead="Listing these is a scope contract. If a number would have been a guess, it is not in this build."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card title="Rebates">
              Modelled at $0. No primary government source gave us a dollar figure for the NSW
              rebate, so every number quoted on this site is the conservative case. A real
              rebate only improves it.
            </Card>
            <Card title="Property value and rent">
              Never asserted. No authoritative, free Australian dataset prices either a property
              value uplift or a rental premium for a rental hot water system, so we do not invent
              one.
            </Card>
            <Card title="Space heating">
              Never given a dollar figure. It depends on a building&apos;s insulation and
              glazing, which eight questions cannot establish, and a number we could not defend
              would undermine the two we can.
            </Card>
            <Card title="Hot water temperature advice">
              Never given. Australian storage hot water systems are deliberately held near 60°C
              for legionella control. Advising a renter to turn it down would be a health risk,
              not a saving.
            </Card>
          </div>
        </Section>
      </div>

      <ClosingCta />
      <SiteFooter />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Nav + header                                                               */
/* -------------------------------------------------------------------------- */

function MethodNav() {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-3 sm:px-8">
      <Link
        href="/"
        className="text-sm font-semibold tracking-tight text-stone-900 transition-colors hover:text-stone-700"
      >
        Rentswitch
      </Link>
      <Link
        href="/start"
        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98]"
      >
        {CTA_LABEL}
      </Link>
    </div>
  );
}

function PageHeader() {
  return (
    <section className="px-4 pt-14 pb-10 sm:px-8 sm:pt-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
          Method and sources
        </p>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
          How the model works
        </h1>
        <p className="mt-6 text-lg text-stone-600">
          Every figure Rentswitch shows you is calculated, not measured, and every input traces
          back to a named Australian source. This page sets out the method, the sources, and the
          one check that did not pass cleanly.
        </p>
      </Reveal>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Section shells                                                             */
/* -------------------------------------------------------------------------- */

function Section({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <Reveal>
      <section>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          {title}
        </h2>
        {lead && <p className="mt-4 max-w-prose text-stone-600">{lead}</p>}
        <div className="mt-8">{children}</div>
      </section>
    </Reveal>
  );
}

/** Two-person household, gas storage to heat pump, last gas appliance, $650 a week. */
function StateComparison() {
  const rows = (["NSW", "VIC"] as ModelledState[]).map((code) => {
    const m = STATE_MODELS[code];
    const r = calculate(m.constants, m.tariffs, {
      occupants: 2,
      hotWaterFuel: "gas",
      isLastGasAppliance: true,
      heatPumpRate: "offPeak",
      weeklyRent: 650,
      gridName: m.gridName,
    });
    return { name: m.name, r };
  });
  const lines: [string, (r: (typeof rows)[number]["r"]) => string][] = [
    ["Tenant saving, per year", (r) => formatMoney(r.saving.total)],
    ["of which gas supply charge", (r) => formatMoney(r.saving.supply)],
    ["Payback, landlord's extra cost", (r) => formatYears(r.landlord.yearsOfTenantSaving)],
    ["Emissions cut, per year", (r) => `${formatKg(r.emissions.savedKgPerYear)} (${Math.round(r.emissions.percentCut)}%)`],
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Two-person household, gas storage to heat pump, New South Wales against Victoria
        </caption>
        <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-3 py-2 font-semibold sm:px-4">Two people, gas to heat pump</th>
            {rows.map((x) => (
              <th key={x.name} className="px-3 py-2 text-right font-semibold sm:px-4">
                {x.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map(([label, f]) => (
            <tr key={label} className="border-t border-stone-100">
              <td className="px-3 py-2 text-stone-600 sm:px-4">{label}</td>
              {rows.map((x) => (
                <td key={x.name} className="px-3 py-2 text-right tabular-nums text-stone-900 sm:px-4">
                  {f(x.r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">{children}</p>
    </div>
  );
}

function DataTable({
  caption,
  head,
  rows,
  wide = false,
}: {
  caption: string;
  head: string[];
  rows: ReactNode[][];
  /** Set for tables whose cell content (long source names, descriptions) genuinely
   * needs room, so they get a horizontal scroll on narrow screens instead of
   * cramming. The two short, numeric validation tables don't need this and size
   * to fit a phone screen without scrolling. */
  wide?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200">
      <table className={`w-full text-left text-sm ${wide ? "min-w-[640px]" : ""}`}>
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-3 text-stone-700 ${j === 0 ? "font-medium text-stone-900" : "tabular-nums"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClosingCta() {
  return (
    <section className="border-t border-stone-200 bg-emerald-50/40 px-4 py-16 text-center sm:px-8">
      <Reveal className="mx-auto max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
          Get your own number
        </p>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          See what this means for your household
        </h2>
        <p className="mt-4 text-stone-600">
          Eight questions and about a minute. No account, no meter reading.
        </p>
        <Link href="/start" className={`${CTA_BUTTON_CLASS} mt-8`}>
          {CTA_LABEL}
        </Link>
      </Reveal>
    </section>
  );
}
