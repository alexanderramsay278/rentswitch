#!/usr/bin/env python3
"""
Rentswitch - tariffs for the remaining states from the AER Consumer Data Right API.

Same API, headers and filters as tools/fetch_cdr.py (NSW) and scripts/fetch_cdr_vic.py,
one capital-city postcode per state. Instead of a hand-picked list of retailers, every
energy brand on the CDR Register is tried, so a state's incumbent (ActewAGL in the ACT,
Aurora in Tasmania) is not missed.

  Register  https://api.cdr.gov.au/cdr-register/v1/energy/data-holders/brands/summary (x-v: 1)
  LIST      {brand}/cds-au/v1/energy/plans  x-v: 1, RESIDENTIAL, postcode in includedPostcodes
  DETAIL    {brand}/cds-au/v1/energy/plans/{planId}  x-v: 3, for STANDING and REGULATED plans
            (Tasmania's reference offer is Aurora's REGULATED standard offer)

Usage: python scripts/fetch_cdr_states.py [state ...]   (default: qld sa act tas)

Output per state: data/cdr_raw/<state>/list_<brand>_<fuel>.json, detail_<planId>.json,
_summary.json (reduced with the parsers in tools/extract_tariffs.py).
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
from extract_tariffs import parse_electricity, parse_gas  # noqa: E402

ALL_STATES = {"qld": "4000", "sa": "5000", "act": "2600", "tas": "7000"}
STATES = {k: v for k, v in ALL_STATES.items() if k in (sys.argv[1:] or ALL_STATES)}
REFERENCE_TYPES = ("STANDING", "REGULATED")
# Some gas plans state coverage by network only, with no postcode list. For those, match the
# capital's gas network by name. Only used when a plan lists no postcodes at all.
GAS_NETWORK_HINTS = {"qld": ("brisbane",), "sa": ("agn metro",), "act": ("evoenergy",), "tas": ("tas",)}
FUELS = ["ELECTRICITY", "GAS"]
REGISTER = "https://api.cdr.gov.au/cdr-register/v1/energy/data-holders/brands/summary"
AER = "https://cdr.energymadeeasy.gov.au/{slug}/cds-au/v1/energy/plans"
FALLBACK_SLUGS = ["agl", "originenergy", "energyaustralia", "redenergy", "alintaenergy",
                  "lumoenergy", "actewagl", "aurora", "auroraenergy", "simplyenergy",
                  "powershop", "momentum", "ovoenergy", "globird", "dodo", "1stenergy",
                  "tango", "sumo", "nectr", "energylocals", "diamondenergy", "kogan"]
OUT = os.path.join(HERE, "..", "data", "cdr_raw")


def get(url, version):
    req = urllib.request.Request(url, headers={"x-v": str(version), "Accept": "application/json",
                                               "User-Agent": "rentswitch-fetch"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            raise
        except urllib.error.URLError:
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            raise
    return None


def brand_bases():
    """Plan-list base URLs for every energy brand on the CDR Register."""
    bases = {}
    try:
        page, total = 1, 1
        while page <= total:
            payload = get(f"{REGISTER}?page={page}&page-size=1000", 1) or {}
            for b in payload.get("data") or []:
                uri = b.get("productBaseUri") or b.get("publicBaseUri") or ""
                slug = uri.rstrip("/").split("/")[-1] if "energymadeeasy" in uri else None
                if slug:
                    bases[slug] = AER.format(slug=slug)
            total = (payload.get("meta") or {}).get("totalPages") or 1
            page += 1
        print(f"Register: {len(bases)} energy brands")
    except Exception as e:
        print(f"Register unavailable ({e}); using fallback list")
    for slug in FALLBACK_SLUGS:
        bases.setdefault(slug, AER.format(slug=slug))
    return bases


def list_all(base, fuel):
    plans, page, total = [], 1, 1
    while page <= total:
        payload = get(f"{base}?page={page}&page-size=1000&fuelType={fuel}&type=ALL&effective=CURRENT", 1) or {}
        plans.extend((payload.get("data") or {}).get("plans") or [])
        total = (payload.get("meta") or {}).get("totalPages") or 1
        page += 1
    return plans


def covers(plan, postcode, state):
    if plan.get("customerType") != "RESIDENTIAL":
        return False
    geo = plan.get("geography") or {}
    if postcode in (geo.get("excludedPostcodes") or []):
        return False
    included = geo.get("includedPostcodes") or []
    if included:
        return postcode in included
    if plan.get("fuelType") == "GAS":
        networks = " ".join(geo.get("distributors") or []).lower()
        return any(h in networks for h in GAS_NETWORK_HINTS.get(state, ()))
    return False


def main():
    bases = brand_bases()
    summaries = {s: [] for s in STATES}
    for slug, base in sorted(bases.items()):
        for fuel in FUELS:
            try:
                plans = list_all(base, fuel)
            except Exception as e:
                print(f"  ! {slug}/{fuel}: {e}")
                continue
            for state, postcode in STATES.items():
                matches = [p for p in plans if covers(p, postcode, state)]
                if not matches:
                    continue
                d = os.path.join(OUT, state)
                os.makedirs(d, exist_ok=True)
                slim = [{k: p.get(k) for k in ("planId", "displayName", "type", "fuelType", "effectiveFrom")}
                        | {"distributors": (p.get("geography") or {}).get("distributors")} for p in matches]
                with open(os.path.join(d, f"list_{slug}_{fuel.lower()}.json"), "w") as fh:
                    json.dump(slim, fh, indent=2)
                standing = [p for p in matches if p.get("type") in REFERENCE_TYPES]
                print(f"{state} {slug}/{fuel}: {len(matches)} plans, {len(standing)} standing")
                for p in standing:
                    pid = p["planId"]
                    try:
                        payload = get(f"{base}/{pid}", 3)
                    except Exception as e:
                        print(f"  ! detail {pid}: {e}")
                        continue
                    with open(os.path.join(d, f"detail_{pid.replace('@', '_at_')}.json"), "w") as fh:
                        json.dump(payload, fh, indent=2)
                    data = (payload or {}).get("data") or {}
                    rec = {"planId": pid, "brand": slug, "fuel": fuel,
                           "displayName": data.get("displayName"),
                           "distributors": (data.get("geography") or {}).get("distributors")}
                    rec.update(parse_electricity(data.get("electricityContract") or {})
                               if fuel == "ELECTRICITY" else parse_gas(data.get("gasContract") or {}))
                    summaries[state].append(rec)
    for state, recs in summaries.items():
        d = os.path.join(OUT, state)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "_summary.json"), "w") as fh:
            json.dump({"_source": {
                "name": "AER Consumer Data Right - Energy Product Reference Data API",
                "headers": {"list": "x-v: 1", "detail": "x-v: 3"},
                "retrieved": time.strftime("%Y-%m-%d"),
                "filter": f"customerType=RESIDENTIAL, postcode {STATES[state]}, effective=CURRENT, type STANDING or REGULATED",
                "units": "unitPrice in $/kWh (electricity) and $/MJ (gas); dailySupplyCharge in $/day",
            }, "plans": recs}, fh, indent=2)
        print(f"{state}: {len(recs)} standing offers summarised")
    return 0


if __name__ == "__main__":
    sys.exit(main())
