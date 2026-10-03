import Link from "next/link";
import Wizard from "@/components/Wizard";

export default function StartPage() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-xl">
        <header className="mb-8 text-center">
          <Link
            href="/"
            className="text-2xl font-semibold tracking-tight text-stone-900 hover:text-stone-700 sm:text-3xl"
          >
            Rentswitch
          </Link>
          <p className="mt-2 text-sm text-stone-600 sm:text-base">
            Five questions. Your bill saving, your landlord&apos;s cost, and the letter that
            closes the gap.
          </p>
        </header>
        <Wizard />
      </div>
    </div>
  );
}
