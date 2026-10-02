import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { STATES } from "@/lib/questions";

const NAMES: Record<string, string> = {
  VIC: "Victoria",
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

  if (upper === "NSW") {
    redirect("/");
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
          Rentswitch currently models New South Wales
        </h1>
        <p className="mb-4 text-stone-700">
          The engine takes any state&apos;s tariffs, rebates and emissions factor. {name} is next,
          and here&apos;s why it matters there: Victoria&apos;s main hot water rebate is available
          to owner-occupiers only.
        </p>
        <p className="mb-6 text-sm text-stone-500">
          That&apos;s the exact split incentive this project exists to fix. A renter in{" "}
          {name} can&apos;t claim the rebate meant to pay for the upgrade, even though they&apos;d
          be the one to benefit from it. We modelled NSW first to get one state&apos;s numbers
          right rather than every state&apos;s numbers approximately.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Choose NSW instead
        </Link>
      </div>
    </div>
  );
}
