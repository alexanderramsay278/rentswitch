#!/usr/bin/env python3
"""
Apply Novak's landing page, plus the three things he flagged in review but did
not build:

  1. A scroll cue in the hero. His note: "something to make it obvious that
     there is more to go down when you scroll, because someone could miss it
     and just press the button first."
  2. An estimates disclaimer. His note: "somewhere on the site we should say
     that these figures are estimates and not exact and vary case by case."
  3. A clearer way back to the stats from the results page. His note: "once you
     get your thing there is no way to go back to the home page to see stats
     again, or at least it's not obvious."

Run from the repo clone root with Novak's file at ./_novak_page.tsx
"""

import io
import os
import sys

SCROLL_CUE = '''
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
'''

DISCLAIMER = '''        <p className="mt-10 max-w-md text-sm text-stone-500">
          Every figure here is a modelled estimate built from published tariffs and
          government emissions factors. Your own bill depends on your household, your
          plan and your appliances, so treat these as a guide rather than a quote.
        </p>
'''


def main():
    src = "_novak_page.tsx"
    dst = os.path.join("src", "app", "page.tsx")
    if not os.path.exists(src):
        print("missing", src)
        return 1

    s = io.open(src, encoding="utf-8").read()

    # 1. Scroll cue: render it at the end of the Hero section only.
    hero_tail = """      <Link href="/start" className={`${CTA_BUTTON_CLASS} mt-10`}>
        {CTA_LABEL}
      </Link>
    </section>
  );
}"""
    hero_new = """      <Link href="/start" className={`${CTA_BUTTON_CLASS} mt-10`}>
        {CTA_LABEL}
      </Link>
      <ScrollCue />
    </section>
  );
}
""" + SCROLL_CUE
    if hero_tail in s:
        s = s.replace(hero_tail, hero_new, 1)
        print("ok  scroll cue added to hero")
    else:
        print("!!  hero tail not matched, scroll cue NOT added")

    # 2. Estimates disclaimer: inside FinalCta, after the CTA button.
    cta_tail = """        <Link href="/start" className={`${CTA_BUTTON_CLASS} mt-10`}>
          {CTA_LABEL}
        </Link>
      </Reveal>"""
    cta_new = """        <Link href="/start" className={`${CTA_BUTTON_CLASS} mt-10`}>
          {CTA_LABEL}
        </Link>
""" + DISCLAIMER + """      </Reveal>"""
    if cta_tail in s:
        s = s.replace(cta_tail, cta_new, 1)
        print("ok  estimates disclaimer added to final CTA")
    else:
        print("!!  final CTA not matched, disclaimer NOT added")

    io.open(dst, "w", encoding="utf-8", newline="\n").write(s)
    print("ok  wrote", dst)

    # 3. Results page: make the route home say what it does.
    rp = os.path.join("src", "app", "results", "page.tsx")
    r = io.open(rp, encoding="utf-8").read()
    before = r
    for old, new in [
        (">Start over<", ">Back to the numbers<"),
        ("Start over", "Back to the numbers"),
    ]:
        if old in r:
            r = r.replace(old, new)
            break
    if r != before:
        io.open(rp, "w", encoding="utf-8", newline="\n").write(r)
        print("ok  results back-link relabelled")
    else:
        print("--  results back-link text not found, check manually")

    return 0


if __name__ == "__main__":
    sys.exit(main())
