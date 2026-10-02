#!/usr/bin/env python3
"""
Rentswitch - AER Consumer Data Right tariff fetcher.

Source: AER CDR Energy Product Reference Data API (regulator-served, no key, no signup).
  LIST   endpoint requires header  x-v: 1   (x-v: 3 -> 406)
  DETAIL endpoint requires header  x-v: 3   (x-v: 1 -> 406)

Pulls NSW RESIDENTIAL electricity + gas plans covering a target postcode,
then fetches full detail for a representative sample and caches to JSON.

Usage:  python tools/fetch_cdr.py
Output: data/cdr_raw/<brand>_<fuel>_plans.json   (list results, filtered)
        data/cdr_raw/detail_<planId>.json        (full plan detail)
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = "https://cdr.energymadeeasy.gov.au/{brand}/cds-au/v1/energy/plans"

# Mosman NSW - Ausgrid distributor zone. One representative zone, stated as an
# assumption in the UI (Product Spec section 1: "State is a question, not a postcode").
TARGET_POSTCODE = "2088"
TARGET_DISTRIBUTOR_HINT = "ausgrid"

BRANDS = ["agl", "originenergy", "energyaustralia", "redenergy", "alintaenergy"]
FUELS = ["ELECTRICITY", "GAS"]

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "cdr_raw")


def get(url, version):
    req = urllib.request.Request(url, headers={"x-v": str(version), "Accept": "application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503, 504) and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            raise
        except urllib.error.URLError:
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            raise
    return None


def covers_target(plan):
    """True if this plan is residential and serves the target postcode."""
    if plan.get("customerType") != "RESIDENTIAL":
        return False
    geo = plan.get("geography") or {}
    included = geo.get("includedPostcodes") or []
    excluded = geo.get("excludedPostcodes") or []
    if TARGET_POSTCODE in excluded:
        return False
    if TARGET_POSTCODE in included:
        return True
    # Some plans express coverage by distributor only.
    if not included:
        dists = " ".join(geo.get("distributors") or []).lower()
        if TARGET_DISTRIBUTOR_HINT in dists:
            return True
    return False


def list_plans(brand, fuel):
    """Page through the LIST endpoint (x-v: 1), keeping only matching plans."""
    matches, page, total_pages = [], 1, 1
    while page <= total_pages:
        url = (f"{BASE.format(brand=brand)}?page={page}&page-size=1000"
               f"&fuelType={fuel}&type=ALL&effective=CURRENT")
        try:
            payload = get(url, 1)
        except Exception as e:
            print(f"  ! {brand}/{fuel} page {page}: {e}", file=sys.stderr)
            break
        if not payload:
            break
        plans = (payload.get("data") or {}).get("plans") or []
        total_pages = ((payload.get("meta") or {}).get("totalPages")) or 1
        matches.extend(p for p in plans if covers_target(p))
        print(f"  {brand}/{fuel} page {page}/{total_pages}: "
              f"{len(plans)} returned, {len(matches)} matching so far")
        page += 1
    return matches


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    index = {}

    for fuel in FUELS:
        for brand in BRANDS:
            print(f"\n== {brand} / {fuel} ==")
            matches = list_plans(brand, fuel)
            if not matches:
                print(f"  (no residential plans covering {TARGET_POSTCODE})")
                continue
            path = os.path.join(OUT_DIR, f"{brand}_{fuel.lower()}_plans.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(matches, f, indent=2)
            index[f"{brand}_{fuel}"] = [p["planId"] for p in matches]
            print(f"  -> {len(matches)} plans saved to {os.path.relpath(path)}")

    idx_path = os.path.join(OUT_DIR, "_index.json")
    with open(idx_path, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2)
    print(f"\nIndex written: {os.path.relpath(idx_path)}")
    for k, v in index.items():
        print(f"  {k}: {len(v)} plans")


if __name__ == "__main__":
    main()
