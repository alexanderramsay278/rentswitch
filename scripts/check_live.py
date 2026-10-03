#!/usr/bin/env python3
"""
Rentswitch - check the live deployment: every route returns 200, no en or em dashes in
visible copy, and no text claims an accuracy figure. Prints a report; exits 1 on a failure.
Usage: python scripts/check_live.py [base_url]
"""
import html
import re
import sys
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://rentswitch.vercel.app"
Q = "dwelling=house&heating=none&rent=650"
ROUTES = [
    "/", "/start", "/method", "/state/qld", "/state/sa", "/state/act", "/state/tas",
    f"/results?occ=2&state=NSW&hw=gas&lastGas=yes&cooktop=electric&{Q}",
    f"/results?occ=2&state=NSW&hw=gas&lastGas=no&cooktop=gas&{Q}",
    f"/results?occ=3&state=NSW&hw=electric_tank&lastGas=yes&cooktop=electric&{Q}",
    f"/results?occ=4&state=NSW&hw=unsure&lastGas=yes&cooktop=unsure&{Q}",
    f"/results?occ=1&state=NSW&hw=heat_pump&lastGas=yes&cooktop=induction&{Q}",
    f"/results?occ=2&state=VIC&hw=gas&lastGas=yes&cooktop=electric&{Q}",
    f"/results?occ=2&state=VIC&hw=gas&lastGas=no&cooktop=gas&{Q}",
    f"/results?occ=3&state=VIC&hw=electric_tank&lastGas=yes&cooktop=electric&{Q}",
    f"/results?occ=2&state=NSW&hw=solar&lastGas=yes&cooktop=electric&dwelling=house&heating=none",
]
# Accuracy claims the validation section must never make.
BANNED = [
    r"\d+(\.\d+)?\s*%\s*accura", r"accura\w*\s+(of|to|within)\s+\d", r"tested to", r"validated at",
    r"validated to", r"error of \d",
]


def text(page: str) -> str:
    page = re.sub(r"(?s)<(script|style)[^>]*>.*?</\1>", " ", page)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", page)))


def main() -> int:
    failures = 0
    for route in ROUTES:
        url = BASE + route
        req = urllib.request.Request(url, headers={"User-Agent": "rentswitch-check"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                status, body = r.status, r.read().decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            status, body = e.code, ""
        t = text(body)
        dashes = [m.group(0) for m in re.finditer(r".{30}[–—].{30}", t)]
        claims = [m.group(0) for p in BANNED for m in re.finditer(r".{40}" + p + r".{20}", t, re.I)]
        ok = status == 200 and not dashes and not claims
        failures += not ok
        print(f"{'OK  ' if ok else 'FAIL'} {status} dashes={len(dashes)} claims={len(claims)} {route}")
        for d in dashes + claims:
            print(f"       {d}")
    print(f"\n{len(ROUTES) - failures}/{len(ROUTES)} routes clean")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
