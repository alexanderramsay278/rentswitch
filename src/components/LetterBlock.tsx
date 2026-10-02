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
    <div>
      <div className="mb-3 flex gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-sm transition-colors hover:border-emerald-600 hover:bg-emerald-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-sm transition-colors hover:border-emerald-600 hover:bg-emerald-50"
        >
          Download .txt
        </button>
      </div>
      <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-stone-200 bg-stone-50 p-5 font-mono text-sm leading-relaxed text-stone-800">
        {letter}
      </pre>
    </div>
  );
}
