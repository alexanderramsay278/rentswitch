import Link from "next/link";

/**
 * Shared footer for the landing page and /method. Deliberately small: a single line of
 * attribution plus the one link that matters most, kept in sync by living in one file
 * instead of being copied into every page that wants it.
 */
export default function SiteFooter() {
  return (
    <footer className="border-t border-stone-200 px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center text-sm text-stone-500 sm:flex-row sm:justify-between">
        <p>Rentswitch. Built for Climate Hack-tion 2026.</p>
        <Link
          href="/method"
          className="font-semibold text-stone-700 transition-colors hover:text-emerald-700"
        >
          Method and sources
        </Link>
      </div>
    </footer>
  );
}
