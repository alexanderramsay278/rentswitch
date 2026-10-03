import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { STATES } from "@/lib/questions";

const NAMES: Record<string, string> = {
  QLD: "Queensland",
  SA: "South Australia",
  ACT: "the Australian Capital Territory",
  TAS: "Tasmania",
};

export default async function StatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const upper = code.toUpperCase();

  if (upper === "NSW" || upper === "VIC") {
    redirect("/start");
  }

  const known = STATES.some((s) => s.code === upper);
  if (!known) {
    notFound();
  }

  const name = NAMES[upper] ?? upper;

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-xl rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-4 text-xl font-semibold text-stone-900 sm:text-2xl">
          Rentswitch currently models New South Wales and Victoria
        </h1>
        <p className="mb-4 text-stone-700">
          The engine takes any state&apos;s tariffs, rebates and emissions factor, and {name}
          needs exactly that: its own tariffs and its own grid. Victoria shows why it matters.
          Its main hot water rebate is available to owner-occupiers only.
        </p>
        <p className="mb-6 text-sm text-stone-500">
          That&apos;s the exact split incentive this project exists to fix. A renter in
          Victoria can&apos;t claim the rebate meant to pay for the upgrade, even though they&apos;d
          be the one to benefit from it. We model two states properly rather than every
          state&apos;s numbers approximately.
        </p>
        <Link
          href="/start"
          className="inline-block rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98]"
        >
          Choose NSW or Victoria instead
        </Link>
      </div>
    </div>
  );
}
