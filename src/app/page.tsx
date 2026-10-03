import Link from "next/link";
import type { ReactNode } from "react";
import Reveal from "@/components/Reveal";
import SiteFooter from "@/components/SiteFooter";
import { PercentBar, SupplyChargeBar, EmissionsCompareBars } from "@/components/LandingVisuals";

const CTA_LABEL = "See your result";
const CTA_BUTTON_CLASS =
  "inline-block rounded-xl bg-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98]";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteNav />
      <Hero />

      <StatSection
        eyebrow="Scale"
        value="29.5%"
        lead="of Australian households are renters."
        citation="ABS, 2021 Census"
        visual={<PercentBar pct={29.5} />}
      />

      <StatSection
        tone="white"
        eyebrow="In New South Wales alone"
        value="944,585"
        lead="rental households."
        citation="ABS, 2021 Census"
        visual={<HouseGrid />}
      />

      <TextSection
        eyebrow="The catch"
        headline="A renter can switch energy plans. They cannot replace the hot water system."
        body="Under the Residential Tenancies Act 2010 (NSW), altering the property needs the owner's written consent."
        visual={<SwitchVsFixed />}
      />

      <TextSection
        tone="white"
        eyebrow="Written into policy"
        headline="In Victoria, the main hot water rebate is for owner-occupiers only."
        body="The exact incentive meant to pay for this upgrade excludes the renters who'd benefit most from it."
        visual={<OwnerVsRenter />}
      />

      <StatSection
        tone="tint"
        eyebrow="The money"
        value="$703"
        lead="a year is what a typical two-person household saves switching gas hot water to a heat pump."
        citation="Rentswitch model, AER tariffs"
      />

      <StatSection
        tone="tint"
        eyebrow="The part most calculators miss"
        value="$306"
        lead="of that is the daily gas supply charge. It is always billed regardless if gas is used or not."
        visual={<SupplyChargeBar />}
      />

      <TextSection
        eyebrow="Why this never happens"
        headline="2.8 years is how long the landlord takes to break even."
        body="The tenant saves while the landlord pays the cost. It simply isn't in the interest of the person who has the capacity to change it."
        visual={<PaybackSplit />}
      />

      <StatSection
        tone="white"
        eyebrow="Environmental Impact"
        value="266 kg CO2-e"
        lead="saved per household each year by switching off gas hot water. 691 kg if the tank it's replacing is electric instead."
        visual={<EmissionsCompareBars />}
      />

      <StatSection
        eyebrow="At scale"
        value="80,000 tonnes"
        lead="a year is what a quarter of New South Wales rental households switching would cut."
        citation="944,585 x 25% x 346 kg"
        visual={<HouseGrid count={32} />}
      />

      <StatSection
        tone="tint"
        eyebrow="The target"
        value="35%"
        lead="electrification by 2035 is the COP31 target. Australia cannot reach it while a third of its homes are locked out by a contract."
        visual={<PercentBar pct={35} />}
      />

      <FinalCta />
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Nav + hero                                                                */
/* ------------------------------------------------------------------------ */

function SiteNav() {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-3 sm:px-8">
      <span className="text-sm font-semibold tracking-tight text-stone-900">Rentswitch</span>
      <div className="flex items-center gap-5">
        <Link
          href="/method"
          className="hidden text-sm font-medium text-stone-600 transition-colors hover:text-stone-900 sm:inline"
        >
          Method and sources
        </Link>
        <Link
          href="/start"
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98]"
        >
          {CTA_LABEL}
        </Link>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="flex min-h-[85vh] flex-col items-center justify-center px-4 py-20 text-center sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Rentswitch</p>
      <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-stone-900 sm:text-6xl">
        Renters can switch energy plans.
        <br />
        They can&apos;t switch what heats their water.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-stone-600">
        Rentswitch prices the upgrade you can&apos;t make alone, and writes the letter that asks
        your landlord to make it.
      </p>
      <Link href="/start" className={`${CTA_BUTTON_CLASS} mt-10`}>
        {CTA_LABEL}
      </Link>
      <ScrollCue />
    </section>
  );
}

function ScrollCue() {
  return (
    <div
      aria-hidden
      className="pointer-events-none mt-14 flex flex-col items-center gap-2 text-stone-400 motion-safe:animate-bounce"
    >
      <span className="text-xs font-medium uppercase tracking-widest">Keep scrolling</span>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}


/* ------------------------------------------------------------------------ */
/* Section shells                                                           */
/* ------------------------------------------------------------------------ */

function sectionClass(tone: "plain" | "white" | "tint") {
  const bg = tone === "white" ? "bg-white" : tone === "tint" ? "bg-emerald-50/40" : "";
  return `flex min-h-screen flex-col items-center justify-center px-4 py-24 sm:px-8 ${bg}`.trim();
}

function StatSection({
  eyebrow,
  value,
  lead,
  citation,
  visual,
  tone = "plain",
}: {
  eyebrow: string;
  value: string;
  lead: string;
  citation?: string;
  visual?: ReactNode;
  tone?: "plain" | "white" | "tint";
}) {
  return (
    <section className={sectionClass(tone)}>
      <Reveal className="flex w-full max-w-2xl flex-col items-center text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">{eyebrow}</p>
        <h2 className="mt-4">
          <span className="block text-4xl font-bold tabular-nums tracking-tight text-stone-900 sm:text-6xl md:text-7xl">
            {value}
          </span>
          <span className="mt-5 block text-lg text-stone-700 sm:text-xl">{lead}</span>
        </h2>
        {citation && (
          <p className="mt-5 text-xs uppercase tracking-wide text-stone-600">{citation}</p>
        )}
        {visual && <div className="mt-10 w-full max-w-sm">{visual}</div>}
      </Reveal>
    </section>
  );
}

function TextSection({
  eyebrow,
  headline,
  body,
  visual,
  tone = "plain",
}: {
  eyebrow: string;
  headline: string;
  body: string;
  visual?: ReactNode;
  tone?: "plain" | "white" | "tint";
}) {
  return (
    <section className={sectionClass(tone)}>
      <Reveal className="flex w-full max-w-2xl flex-col items-center text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">{eyebrow}</p>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
          {headline}
        </h2>
        <p className="mt-5 max-w-lg text-lg text-stone-600">{body}</p>
        {visual && <div className="mt-10 w-full max-w-md">{visual}</div>}
      </Reveal>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={sectionClass("tint")}>
      <Reveal className="flex w-full max-w-2xl flex-col items-center text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
          Get your own number
        </p>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
          Eight questions and about a minute
        </h2>
        <p className="mt-5 max-w-md text-lg text-stone-600">
          is all we need to provide you a tailored figure and response. No account, email or meter reading necessary.
        </p>
        <Link href="/start" className={`${CTA_BUTTON_CLASS} mt-10`}>
          {CTA_LABEL}
        </Link>
        <p className="mt-10 max-w-md text-sm text-stone-500">
          Every figure here is a modelled estimate built from published tariffs and
          government emissions factors. Your own bill depends on your household, your
          plan and your appliances, so treat these as a guide rather than a quote.
        </p>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Original inline visuals - no stock imagery anywhere in this project.     */
/* Flat colour only: one accent (emerald), one secondary semantic colour    */
/* (amber, used only for the gas supply charge, matching the results page), */
/* neutrals otherwise. No 3D, no photography.                              */
/* ------------------------------------------------------------------------ */

function PaybackSplit() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-stone-200 bg-white p-5 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Tenant</p>
        <p className="mt-1 text-stone-700">Gets the saving, every year, starting immediately.</p>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white p-5 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Landlord</p>
        <p className="mt-1 text-stone-700">Pays the extra cost, once, up front.</p>
      </div>
    </div>
  );
}

function SwitchVsFixed() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 text-left">
        <Badge tone="accent">
          <CheckMark />
        </Badge>
        <div>
          <p className="text-sm font-semibold text-stone-900">Energy plan</p>
          <p className="text-xs text-stone-500">Yours to switch, any time</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 text-left">
        <Badge tone="neutral">
          <LockMark />
        </Badge>
        <div>
          <p className="text-sm font-semibold text-stone-900">Hot water system</p>
          <p className="text-xs text-stone-500">Needs the owner&apos;s consent</p>
        </div>
      </div>
    </div>
  );
}

function OwnerVsRenter() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 text-left">
        <Badge tone="accent">
          <CheckMark />
        </Badge>
        <div>
          <p className="text-sm font-semibold text-stone-900">Owner-occupiers</p>
          <p className="text-xs text-stone-500">Eligible for the rebate</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 text-left">
        <Badge tone="muted">
          <CrossMark />
        </Badge>
        <div>
          <p className="text-sm font-semibold text-stone-900">Renters</p>
          <p className="text-xs text-stone-500">Not eligible, by design</p>
        </div>
      </div>
    </div>
  );
}

function HouseGrid({ count = 24 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-8 justify-center gap-2 text-emerald-600 opacity-80 sm:grid-cols-8"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <HouseOutline key={i} className="h-4 w-4" />
      ))}
    </div>
  );
}

/* --- small inline icons, no external assets ------------------------------ */

function Badge({ tone, children }: { tone: "accent" | "neutral" | "muted"; children: ReactNode }) {
  const bg =
    tone === "accent" ? "bg-emerald-600 text-white" : tone === "neutral" ? "bg-stone-700 text-white" : "bg-stone-200 text-stone-600";
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${bg}`}>
      {children}
    </span>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M5 10.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossMark() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function LockMark() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function HouseOutline({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 11.5 12 4l8 7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 10.2V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
