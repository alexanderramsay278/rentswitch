"use client";

import { useState } from "react";

export default function LetterBlock({ letter }: { letter: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable - the text is still selectable by hand.
    }
  }

  function handleDownload() {
    const blob = new Blob([letter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rentswitch-landlord-letter.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Landlord letter
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 shadow-sm transition-colors hover:border-emerald-600 hover:bg-emerald-50"
          >
            <CopyIcon />
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 shadow-sm transition-colors hover:border-emerald-600 hover:bg-emerald-50"
          >
            <DownloadIcon />
            Download
          </button>
        </div>
      </div>
      <pre className="max-h-[36rem] overflow-y-auto whitespace-pre-wrap p-6 font-serif text-[15px] leading-relaxed text-stone-800 sm:p-10">
        {letter}
      </pre>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <rect x="6.5" y="6.5" width="10" height="11" rx="1.5" />
      <path d="M13.5 6.5V4.75A1.25 1.25 0 0 0 12.25 3.5h-7A1.25 1.25 0 0 0 4 4.75v9.5a1.25 1.25 0 0 0 1.25 1.25H6.5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M10 3v10m0 0 3.5-3.5M10 13l-3.5-3.5" />
      <path d="M4 15.5v.75A1.75 1.75 0 0 0 5.75 18h8.5A1.75 1.75 0 0 0 16 16.25v-.75" />
    </svg>
  );
}
