#!/usr/bin/env python3
"""
Rentswitch - reduce cached CDR plan detail to the handful of numbers the model needs.

Reads  data/cdr_raw/_index.json  (written by fetch_cdr.py), fetches DETAIL for a
representative sample (x-v: 3), and writes a flat, citable tariff file.

UNITS - verified against live CDR responses 2026-10-02:
  electricity unitPrice        -> DOLLARS per kWh   (e.g. 0.547241 = 54.7 c/kWh)
  gas         unitPrice        -> DOLLARS per MJ    (e.g. 0.053582 = 5.36 c/MJ)
  dailySupplyCharge            -> DOLLARS per day   (e.g. 1.602365 = $1.60/day)
These are NOT cents. The "CDR may return cents" warning in Model Maths section 11
is resolved: this endpoint returns dollars.

Output: data/tariffs.json
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

DETAIL = "https://cdr.energymadeeasy.gov.au/{brand}/cds-au/v1/energy/plans/{plan_id}"
HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "..", "data", "cdr_raw")
OUT = os.path.join(HERE, "..", "data", "tariffs.json")

# How many plans per brand/fuel to pull detail for. Product Spec section 5:
# "pick a handful of representative plans per fuel, cache to JSON, cite the API.
# Do not build an ingester."
SAMPLE_PER_GROUP = 8


def get(url, version):
    req = urllib.request.Request(url, headers={"x-v": str(version), "Accept": "application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.HTTPError, urllib.error.URLError):
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            raise
    return None


def f(x):
    return None if x is None else float(x)


def parse_electricity(c):
    """Pull flat / peak / off-peak / controlled-load rates and supply charge."""
    out = {
        "pricingModel": c.get("pricingModel"),
        "dailySupplyCharge": None,
        "flat": None, "peak": None, "offPeak": None, "shoulder": None,
        "controlledLoad": None, "controlledLoadSupplyCharge": None,
    }

    periods = c.get("tariffPeriod") or []
    if periods:
        p = periods[0]
        out["dailySupplyCharge"] = f(p.get("dailySupplyCharge"))
        if p.get("rateBlockUType") == "singleRate":
            rates = (p.get("singleRate") or {}).get("rates") or []
            if rates:
                out["flat"] = f(rates[0].get("unitPrice"))
        # Scan every period so a seasonal plan still yields peak/off-peak.
        best = {}
        for per in periods:
            for tou in per.get("timeOfUseRates") or []:
                rates = tou.get("rates") or []
                if not rates:
                    continue
                price = f(rates[0].get("unitPrice"))
                t = (tou.get("type") or "").upper()
                key = {"PEAK": "peak", "OFF_PEAK": "offPeak", "SHOULDER": "shoulder"}.get(t)
                if key and price is not None:
                    # Peak = highest seen; off-peak = lowest seen.
                    if key == "peak":
                        best[key] = max(best.get(key, price), price)
                    else:
                        best[key] = min(best.get(key, price), price)
        out.update(best)

    cl = c.get("controlledLoad") or []
    if cl:
        sr = cl[0].get("singleRate") or {}
        rates = sr.get("rates") or []
        if rates:
            out["controlledLoad"] = f(rates[0].get("unitPrice"))
        out["controlledLoadSupplyCharge"] = f(sr.get("dailySupplyCharge"))

    return out


def parse_gas(c):
    """Gas is a stepped block tariff in $/MJ. Blocks are DAILY volumes (period P1D)."""
    out = {"pricingModel": c.get("pricingModel"), "dailySupplyCharge": None, "blocks": []}
    periods = c.get("tariffPeriod") or []
    if not periods:
        return out
    p = periods[0]
    out["dailySupplyCharge"] = f(p.get("dailySupplyCharge"))
    out["blockPeriod"] = (p.get("singleRate") or {}).get("period")
    for r in (p.get("singleRate") or {}).get("rates") or []:
        out["blocks"].append({
            "volumeMJ": f(r.get("volume")),       # None on the final, unbounded block
            "unitPrice": f(r.get("unitPrice")),   # $/MJ
        })
    if out["blocks"]:
        out["firstBlockRate"] = out["blocks"][0]["unitPrice"]
        out["lastBlockRate"] = out["blocks"][-1]["unitPrice"]
    return out


def main():
    idx_path = os.path.join(RAW, "_index.json")
    if not os.path.exists(idx_path):
        print("Run tools/fetch_cdr.py first.", file=sys.stderr)
        return 1
    index = json.load(open(idx_path, encoding="utf-8"))

    results = []
    for group, plan_ids in index.items():
        brand, fuel = group.rsplit("_", 1)
        for plan_id in plan_ids[:SAMPLE_PER_GROUP]:
            cache = os.path.join(RAW, f"detail_{plan_id.replace('@', '_at_')}.json")
            if os.path.exists(cache):
                payload = json.load(open(cache, encoding="utf-8"))
            else:
                try:
                    payload = get(DETAIL.format(brand=brand, plan_id=plan_id), 3)
                except Exception as e:
                    print(f"  ! {plan_id}: {e}", file=sys.stderr)
                    continue
                with open(cache, "w", encoding="utf-8") as fh:
                    json.dump(payload, fh, indent=2)

            d = (payload or {}).get("data") or {}
            rec = {
                "planId": plan_id,
                "brand": brand,
                "fuel": fuel,
                "displayName": d.get("displayName"),
                "customerType": d.get("customerType"),
                "distributors": (d.get("geography") or {}).get("distributors"),
            }
            if fuel == "ELECTRICITY":
                rec.update(parse_electricity(d.get("electricityContract") or {}))
            else:
                rec.update(parse_gas(d.get("gasContract") or {}))
            results.append(rec)
            print(f"  {plan_id:26s} {rec.get('displayName')}")

    out = {
        "_source": {
            "name": "AER Consumer Data Right - Energy Product Reference Data API",
            "endpoint": "https://cdr.energymadeeasy.gov.au/{brand}/cds-au/v1/energy/plans",
            "headers": {"list": "x-v: 1", "detail": "x-v: 3"},
            "retrieved": time.strftime("%Y-%m-%d"),
            "filter": "customerType=RESIDENTIAL, postcode 2088 (Mosman NSW), effective=CURRENT",
            "units": "unitPrice in $/kWh (electricity) and $/MJ (gas); dailySupplyCharge in $/day",
            "licence": "See CREDITS.md - AER / data.gov.au terms",
        },
        "plans": results,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2)
    print(f"\nWrote {len(results)} plans -> {os.path.relpath(OUT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
