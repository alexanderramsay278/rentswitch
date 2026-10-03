#!/usr/bin/env python3
"""
Rentswitch - Victorian tariff fetch from the AER Consumer Data Right API.

Same source and method as tools/fetch_cdr.py (NSW), pointed at Melbourne:
  LIST   endpoint, header x-v: 1, RESIDENTIAL plans covering postcode 3000
  DETAIL endpoint, header x-v: 3, for every standing / default offer found

Runs in GitHub Actions (.github/workflows/fetch-vic-tariffs.yml) because the API is
not reachable from every build environment. Writes raw responses for provenance and a
reduced summary using the same parsers as tools/extract_tariffs.py.

Output: data/cdr_raw/vic/list_<brand>_<fuel>.json
        data/cdr_raw/vic/detail_<planId>.json
        data/cdr_raw/vic/_summary.json
"""

import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
from extract_tariffs import parse_electricity, parse_gas  # noqa: E402
from fetch_cdr import BASE, get  # noqa: E402

TARGET_POSTCODE = "3000"
BRANDS = ["agl", "originenergy", "energyaustralia", "redenergy", "alintaenergy", "lumoenergy"]
FUELS = ["ELECTRICITY", "GAS"]
STANDING = re.compile(r"standing|default offer", re.I)
OUT = os.path.join(HERE, "..", "data", "cdr_raw", "vic")


def covers(plan):
    if plan.get("customerType") != "RESIDENTIAL":
        return False
    geo = plan.get("geography") or {}
    if TARGET_POSTCODE in (geo.get("excludedPostcodes") or []):
        return False
    return TARGET_POSTCODE in (geo.get("includedPostcodes") or [])


def list_plans(brand, fuel):
    out, page, total = [], 1, 1
    while page <= total:
        url = (f"{BASE.format(brand=brand)}?page={page}&page-size=1000"
               f"&fuelType={fuel}&type=ALL&effective=CURRENT")
        try:
            payload = get(url, 1) or {}
        except Exception as e:
            print(f"  ! {brand}/{fuel} page {page}: {e}")
            break
        plans = (payload.get("data") or {}).get("plans") or []
        total = (payload.get("meta") or {}).get("totalPages") or 1
        out.extend(p for p in plans if covers(p))
        page += 1
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    summary = []
    for fuel in FUELS:
        for brand in BRANDS:
            matches = list_plans(brand, fuel)
            print(f"{brand}/{fuel}: {len(matches)} residential plans cover {TARGET_POSTCODE}")
            if not matches:
                continue
            slim = [{k: p.get(k) for k in ("planId", "displayName", "type", "fuelType",
                                           "customerType", "effectiveFrom", "lastUpdated")}
                    | {"distributors": (p.get("geography") or {}).get("distributors")}
                    for p in matches]
            with open(os.path.join(OUT, f"list_{brand}_{fuel.lower()}.json"), "w") as fh:
                json.dump(slim, fh, indent=2)
            for p in matches:
                if not STANDING.search(p.get("displayName") or ""):
                    continue
                pid = p["planId"]
                url = f"{BASE.format(brand=brand)}/{pid}"
                try:
                    payload = get(url, 3)
                except Exception as e:
                    print(f"  ! detail {pid}: {e}")
                    continue
                with open(os.path.join(OUT, f"detail_{pid.replace('@', '_at_')}.json"), "w") as fh:
                    json.dump(payload, fh, indent=2)
                d = (payload or {}).get("data") or {}
                rec = {"planId": pid, "brand": brand, "fuel": fuel,
                       "displayName": d.get("displayName"),
                       "distributors": (d.get("geography") or {}).get("distributors")}
                rec.update(parse_electricity(d.get("electricityContract") or {})
                           if fuel == "ELECTRICITY" else parse_gas(d.get("gasContract") or {}))
                summary.append(rec)
                print("  " + json.dumps(rec))
    with open(os.path.join(OUT, "_summary.json"), "w") as fh:
        json.dump({"_source": {
            "name": "AER Consumer Data Right - Energy Product Reference Data API",
            "endpoint": BASE,
            "headers": {"list": "x-v: 1", "detail": "x-v: 3"},
            "retrieved": time.strftime("%Y-%m-%d"),
            "filter": f"customerType=RESIDENTIAL, postcode {TARGET_POSTCODE} (Melbourne VIC), "
                      "effective=CURRENT, standing or default offers only",
            "units": "unitPrice in $/kWh (electricity) and $/MJ (gas); dailySupplyCharge in $/day",
        }, "plans": summary}, fh, indent=2)
    print(f"\n{len(summary)} standing/default offers written")
    return 0 if summary else 1


if __name__ == "__main__":
    sys.exit(main())
