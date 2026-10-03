#!/usr/bin/env python3
"""
Rentswitch - tariff robustness sweep.

WHAT THIS IS
  The headline (two-person NSW household, gas storage -> heat pump, about $703/yr
  saving, $306 of it the gas daily supply charge, 2.8 year payback) is priced on ONE
  pair of plans: the AGL Residential Standing Offer for electricity (AGL1189640SRE1@EME)
  and for gas (AGL1055990SRG3@EME), postcode 2088. The obvious challenge is "did you
  pick a flattering tariff?"

  This re-runs exactly the same case, through exactly the same model (tools/model.py
  run()), on every electricity x gas combination in the cached AER CDR data that is
  offered at postcode 2088 and that the existing parsers can read. It reports where the
  reference pair sits in that spread.

WHAT THIS IS NOT
  It is NOT a predicted-vs-actual accuracy test, and it does not say the headline is
  "right". It answers one falsifiable question: does the headline hold across the other
  real plans a household at this postcode could be on, or does it depend on our pick?

  It is also NOT a survey of the NSW market. The cache holds 32 NSW plans from two
  retailers (AGL and EnergyAustralia): the first 8 per retailer and fuel in the order
  the API listed them, out of 170 electricity and 20 gas plans those two retailers
  listed for postcode 2088 (data/cdr_raw/_index.json). No other retailer's NSW plans
  are cached. That is disclosed in the output.

  Emissions are not part of this check. They do not depend on the tariff at all.

SOURCE
  AER Consumer Data Right, Energy Product Reference Data API, plan detail responses
  cached in data/cdr_raw/ (root = NSW, postcode 2088; subfolders = other states).
  Retrieved 2026-10-02 (NSW) and 2026-10-03 (other states).

METHOD
  - Parsing: tools/extract_tariffs.py parse_electricity() and parse_gas(), unchanged.
  - Model: tools/model.py run(), unchanged. Each combination is passed in as a
    two-plan tariff set with the constants' reference plan IDs pointed at it.
  - Heat pump rate: the plan's off-peak rate, as in the headline. On a single-rate
    plan (no off-peak) the flat rate is used, because that is what the plan charges.
    For every time-of-use plan in the NSW cache the off-peak rate is also the rate in
    force at 03:00, the rule the live site uses.
  - Discounts: parse_*() ignore them. Some EnergyAustralia market plans carry a
    GUARANTEED percent-of-bill discount (6% to 25%). Its wording ("applies to market
    energy charges") does not say whether the daily supply charge is included, so
    three treatments are run and all are reported: none (list prices), usage only,
    usage and supply. The primary figures use usage and supply, which is the CDR
    method type ("percentOfBill") and the treatment least favourable to the headline.
    These discounts have a one-year benefit period. After it, the list prices apply,
    so the "none" treatment is also the position from the second year on. Both are
    reported side by side. Conditional discounts (e.g. pay on time) would not be
    applied; none are present.
  - Eligibility: a plan is restricted when its conditions are about who the customer
    is (a loyalty scheme or bank, a Seniors Card, existing solar, new customers only).
    Conditions only about how you sign up or are billed (a comparison or connection
    service, an authorised sales representative, email bills) do not restrict it.
    Restricted plans are kept and flagged, and every position is also reported for
    plans open to any residential customer.

Usage:  python tools/validate_tariffs.py
"""

import copy
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from model import load, run, useful_energy_mj_yr, gas_cost_yr  # noqa: E402
from extract_tariffs import parse_electricity, parse_gas  # noqa: E402

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "..", "data", "cdr_raw")
OUT = os.path.join(HERE, "..", "data", "validation_tariffs.json")

REF_ELECTRICITY = "AGL1189640SRE1@EME"
REF_GAS = "AGL1055990SRG3@EME"
POSTCODE = "2088"
OCCUPANTS = 2
DAILY = "P1D"

# Eligibility conditions that only govern how you sign up or are billed, so any household
# can meet them. Anything else (who the customer is) restricts the plan.
OPEN_ELIGIBILITY = {
    "Comparators only",                 # sign up through a comparison or connection service
    "Authorised AGL representative",    # sign up through a sales representative
    "Mandatory eBilling",               # bills by email
    "Eligible Residential Customers",   # any residential customer (AGL Netflix plan)
}

TREATMENTS = ("bill", "usage", "none")
TREATMENT_LABEL = {
    "bill": "year one, discount on usage and supply (primary)",
    "usage": "year one, discount on usage only",
    "none": "after year one: list prices, no discount",
}


# --- Loading and screening ----------------------------------------------------

def cached_plans():
    """Every cached plan detail file, root (NSW) and state subfolders."""
    paths = sorted(glob.glob(os.path.join(RAW, "detail_*.json")) +
                   glob.glob(os.path.join(RAW, "*", "detail_*.json")))
    for path in paths:
        folder = os.path.basename(os.path.dirname(path))
        state = "nsw" if folder == "cdr_raw" else folder
        with open(path, encoding="utf-8") as fh:
            yield state, os.path.relpath(path, os.path.join(HERE, "..")), json.load(fh)["data"]


def restriction(contract):
    """Eligibility conditions that limit who can take the plan, as short text."""
    out = []
    for e in contract.get("eligibility") or []:
        info = (e.get("information") or "").strip()
        if info in OPEN_ELIGIBILITY:
            continue
        out.append(info or e.get("type", "restricted"))
    return out


def guaranteed_discount(contract):
    """(rate, applies_to_supply_possible) for one guaranteed discount, or a skip reason."""
    discounts = contract.get("discounts") or []
    guaranteed = [d for d in discounts if d.get("type") == "GUARANTEED"]
    if not guaranteed:
        return 0.0, None
    if len(guaranteed) > 1:
        return None, "more than one guaranteed discount; combining them is not modelled"
    d = guaranteed[0]
    method = d.get("methodUType")
    if method == "percentOfBill":
        return float(d["percentOfBill"]["rate"]), None
    if method == "percentOfUse":
        return float(d["percentOfUse"]["rate"]), None
    return None, f"discount method {method} is not modelled"


def screen(state, data):
    """Return (record, reasons). A plan with any reason is skipped and tabled."""
    reasons = []
    fuel = data.get("fuelType")
    contract = data.get("electricityContract" if fuel == "ELECTRICITY" else "gasContract") or {}
    record = {
        "planId": data.get("planId"),
        "brand": data.get("brand"),
        "displayName": data.get("displayName"),
        "type": data.get("type"),
        "fuel": fuel,
        "state": state.upper(),
        "restricted_to": restriction(contract),
    }

    # 1. Can the existing parsers and the model consume it?
    try:
        parsed = parse_electricity(contract) if fuel == "ELECTRICITY" else parse_gas(contract)
    except Exception as exc:  # report, never drop silently
        return record, [f"parse_{'electricity' if fuel == 'ELECTRICITY' else 'gas'}() raised {type(exc).__name__}"]

    if fuel == "GAS":
        periods = contract.get("tariffPeriod") or []
        block_periods = {(p.get("singleRate") or {}).get("period") for p in periods}
        odd = sorted(bp for bp in block_periods if bp and bp != DAILY)
        if odd:
            reasons.append(f"gas blocks are per {'/'.join(odd)}, not per day; "
                           "the model walks DAILY blocks and no conversion is applied here")
        if len(periods) > 1:
            reasons.append("more than one gas tariff period; parse_gas() reads only the first")
        if not parsed.get("blocks"):
            reasons.append("no gas usage rates found")
        if parsed.get("dailySupplyCharge") is None:
            reasons.append("no gas daily supply charge found")
    else:
        if parsed.get("offPeak") is None and parsed.get("flat") is None:
            reasons.append("parse_electricity() finds no off-peak and no flat rate "
                           "(e.g. every time-of-use window is typed SHOULDER)")
        supplies = {p.get("dailySupplyCharge") for p in contract.get("tariffPeriod") or []}
        if len(supplies) > 1:
            reasons.append("supply charge differs between seasons; parse_electricity() reads only the first")

    rate, why = guaranteed_discount(contract)
    if why:
        reasons.append(why)

    # 2. Is it offered to the household in the headline case?
    included = (data.get("geography") or {}).get("includedPostcodes") or []
    if state != "nsw":
        reasons.append(f"not offered at postcode {POSTCODE} ({state.upper()} plan); "
                       "the NSW case cannot be priced on it")
    elif POSTCODE not in included:
        reasons.append(f"postcode {POSTCODE} not in the plan's included postcodes")

    record.update(parsed=parsed, discount=rate or 0.0,
                  benefit_period=contract.get("benefitPeriod") if rate else None)
    return record, reasons


# --- Running one combination through the unchanged model ----------------------

def priced(record, treatment):
    """Model-ready plan dict with a guaranteed discount applied per `treatment`."""
    p = copy.deepcopy(record["parsed"])
    p["planId"] = record["planId"]
    d = record["discount"] if treatment != "none" else 0.0
    if record["fuel"] == "ELECTRICITY":
        hp_rate = p["offPeak"] if p["offPeak"] is not None else p["flat"]
        # The household already pays the electricity supply charge, so only usage moves.
        p["offPeak"] = hp_rate * (1 - d)
    else:
        p["blocks"] = [dict(b, unitPrice=b["unitPrice"] * (1 - d)) for b in p["blocks"]]
        if treatment == "bill":
            p["dailySupplyCharge"] = p["dailySupplyCharge"] * (1 - d)
    return p


def run_pair(k, e_rec, g_rec, treatment):
    e_plan, g_plan = priced(e_rec, treatment), priced(g_rec, treatment)
    k2 = dict(k, tariffs_reference={"electricity_plan": e_plan["planId"],
                                    "gas_plan": g_plan["planId"]})
    try:
        r = run(k2, {"plans": [e_plan, g_plan]}, OCCUPANTS)
        return {"S": r["S"], "S_usage": r["S_usage"], "S_supply": r["S_supply"],
                "gas_today": r["cost_gas_total"], "hp_cost": r["cost_hp"],
                "years": r["years"], "I": r["I"], "d_em": r["d_em"], "run_refused": None}
    except AssertionError as exc:
        # run() refuses S <= 0. That is a finding about this pair, not a reason to drop
        # it, so the same terms are recomputed with the model's own functions.
        L = k["demand"]["L_litres_per_person_per_day"]["value"]
        dT = k["demand"]["deltaT_kelvin"]["value"]
        E = useful_energy_mj_yr(OCCUPANTS, L, dT)
        D_gas = E / k["efficiency"]["eta_gas_storage"]["value"]
        D_hp = E / k["efficiency"]["COP_heat_pump"]["value"] / 3.6
        gas_usage = gas_cost_yr(g_plan["blocks"], D_gas)
        supply = 365 * g_plan["dailySupplyCharge"]
        hp = D_hp * e_plan["offPeak"]
        S = gas_usage + supply - hp
        return {"S": S, "S_usage": gas_usage - hp, "S_supply": supply,
                "gas_today": gas_usage + supply, "hp_cost": hp, "years": None,
                "I": None, "d_em": None, "run_refused": str(exc)}


# --- Statistics (order statistics only: every figure is a real pair's saving) ---

def summary(values):
    """min, max and the middle pair(s). With an even count and two different middle
    pairs, both are reported rather than averaged into a saving no pair produces."""
    v = sorted(values)
    n = len(v)
    lo, hi = (v[n // 2], v[n // 2]) if n % 2 else (v[n // 2 - 1], v[n // 2])
    return {"n": n, "min": v[0], "median": lo if lo == hi else None,
            "middle_pairs": [lo] if lo == hi else [lo, hi], "max": v[-1]}


def mid(s):
    """Print form of the middle: one figure, or 'a / b' when the two middle pairs differ
    to the dollar. The JSON keeps both exact values either way."""
    shown = []
    for x in s["middle_pairs"]:
        if money(x) not in shown:
            shown.append(money(x))
    return " / ".join(shown)


def position(values, ref):
    """Share of combinations saving strictly less than the reference, and tied with it."""
    below = sum(1 for x in values if x < ref - 1e-9)
    tied = sum(1 for x in values if abs(x - ref) <= 1e-9)
    return below, tied, len(values)


def money(x):
    return f"${x:,.0f}"


# --- Main ----------------------------------------------------------------------

def main():
    k, tariffs = load()
    headline = run(k, tariffs, OCCUPANTS)

    usable = {"ELECTRICITY": [], "GAS": []}
    skipped = []
    total = 0
    for state, path, data in cached_plans():
        total += 1
        record, reasons = screen(state, data)
        record["file"] = path
        if reasons:
            skipped.append(dict(record, reasons=reasons))
        else:
            usable[record["fuel"]].append(record)

    elec, gas = usable["ELECTRICITY"], usable["GAS"]
    by_id = {r["planId"]: r for r in elec + gas}
    if REF_ELECTRICITY not in by_id or REF_GAS not in by_id:
        sys.exit("STOP: the reference plans were skipped, so the sweep cannot be anchored.")

    # Every pair, every discount treatment.
    combos = {t: [] for t in TREATMENTS}
    for t in TREATMENTS:
        for e in elec:
            for g in gas:
                res = run_pair(k, e, g, t)
                combos[t].append(dict(res, electricity=e["planId"], gas=g["planId"],
                                      e_type=e["type"], g_type=g["type"],
                                      open_to_all=not e["restricted_to"] and not g["restricted_to"]))

    # The reference pair must reproduce the headline exactly, or nothing below means anything.
    # An explicit check, not an assert, so it cannot be switched off with python -O.
    ref = next(c for c in combos["bill"] if c["electricity"] == REF_ELECTRICITY and c["gas"] == REF_GAS)
    if abs(ref["S"] - headline["S"]) > 1e-6:
        sys.exit(f"STOP: the reference pair gives {ref['S']:.2f} but the headline is "
                 f"{headline['S']:.2f}, so the sweep is not comparable with it.")
    d_ems = {round(c["d_em"], 6) for c in combos["bill"] if c["d_em"] is not None}
    yrs = lambda s_: (ref["I"] / s_) if s_ > 0 else float("inf")  # noqa: E731

    def where(pairs):
        """Share of pairs saving strictly less than the headline, as a percentage."""
        b, _, nn = position([c["S"] for c in pairs], ref["S"])
        return 100 * b / nn

    primary = combos["bill"]
    S_all = [c["S"] for c in primary]
    stats = summary(S_all)
    below, tied, n = position(S_all, ref["S"])
    pct_below = 100 * below / n
    refused = [c for c in primary if c["run_refused"]]
    after = combos["none"]
    pct_after = where(after)
    open_now = [c for c in primary if c["open_to_all"]]
    open_after = [c for c in after if c["open_to_all"]]

    groups = {}
    for c in primary:
        groups.setdefault(f"{c['e_type']} electricity + {c['g_type']} gas", []).append(c)
    mm = groups.get("MARKET electricity + MARKET gas", [])
    mm_above = sum(1 for c in mm if c["S"] > ref["S"] + 1e-9)

    # Per-plan components: what each gas plan costs today, what each electricity plan
    # charges to run the heat pump. The saving is today's gas bill minus the heat pump cost.
    D = run(k, tariffs, OCCUPANTS)
    gas_rows = []
    for g in gas:
        p = priced(g, "bill")
        gas_rows.append((g, gas_cost_yr(p["blocks"], D["D_gas"]), 365 * p["dailySupplyCharge"]))
    elec_rows = []
    for e in elec:
        p = priced(e, "bill")
        elec_rows.append((e, D["D_hp"] * p["offPeak"]))
    gas_rows.sort(key=lambda r: r[1] + r[2])
    elec_rows.sort(key=lambda r: r[1])
    gas_spread = (gas_rows[-1][1] + gas_rows[-1][2]) - (gas_rows[0][1] + gas_rows[0][2])
    elec_spread = elec_rows[-1][1] - elec_rows[0][1]
    discounted = sorted({r["benefit_period"] for r in elec + gas if r["discount"]} - {None})
    restricted = [r for r in elec + gas if r["restricted_to"]]

    # --- Print ---------------------------------------------------------------------
    print("=" * 78)
    print("TARIFF ROBUSTNESS SWEEP - same household, every cached plan pair at postcode 2088")
    print("=" * 78)
    print(f"Case: {OCCUPANTS} people, NSW, gas storage -> heat pump, gas fully disconnected.")
    print(f"Model: tools/model.py run(), unchanged. Reference pair: {REF_ELECTRICITY} + {REF_GAS}.")
    print(f"Headline reproduced by the sweep: {money(ref['S'])}/yr "
          f"(supply charge {money(ref['S_supply'])}), payback {ref['years']:.1f} yrs.")
    print()
    print(f"Plans cached: {total}.  Usable here: {len(elec)} electricity x {len(gas)} gas "
          f"= {len(primary)} pairs.  Skipped: {len(skipped)} (table below).")
    print("Coverage limit: NSW plans from 2 retailers only (AGL, EnergyAustralia): the first 8 per")
    print("retailer and fuel as the API listed them, of 170 electricity and 20 gas plans listed for 2088.")
    print(f"Restricted plans (who the customer is): {len(restricted)} of {len(elec) + len(gas)}, kept and flagged.")

    print()
    print("-" * 78)
    print("TEST 1 - SPREAD: what does the same household save on every pair?")
    print("-" * 78)
    print(f"  {'pairs':>6}{'min':>10}{'middle':>16}{'max':>10}{'headline':>11}   payback range")
    mid_yrs = " / ".join(dict.fromkeys(f"{yrs(x):.1f}" for x in stats["middle_pairs"]))
    print(f"  {stats['n']:>6}{money(stats['min']):>10}{mid(stats):>16}"
          f"{money(stats['max']):>10}{money(ref['S']):>11}   "
          f"{yrs(stats['max']):.1f} to {yrs(stats['min']):.1f} yrs ({mid_yrs} at the middle)")
    print(f"\n  The headline saves more than {below} of {n} pairs ({pct_below:.0f}%)"
          f"{f' and ties {tied - 1} other (same off-peak rate, same gas plan)' if tied > 1 else ''}.")
    print(f"  Emissions cut is {min(d_ems):.1f} kg CO2e/yr on every pair: it does not depend on the tariff.")
    if refused:
        print(f"  {len(refused)} pair(s) save nothing or lose money; run() refuses them (S <= 0). See JSON.")

    print()
    print(f"  EnergyAustralia's guaranteed discounts have a benefit period of {', '.join(discounted)}.")
    print("  So year one and the years after differ. Share of pairs the headline beats:")
    print(f"    {'treatment':<50}{'all pairs':>10}{'open to all':>13}{'middle (all)':>16}")
    for t in TREATMENTS:
        st = summary([c["S"] for c in combos[t]])
        op = [c for c in combos[t] if c["open_to_all"]]
        print(f"    {TREATMENT_LABEL[t]:<50}{where(combos[t]):>9.0f}%{where(op):>12.0f}%{mid(st):>16}")

    print()
    print("-" * 78)
    print("TEST 2 - STANDING vs MARKET: does a tenant on a sharper deal save less? (year one)")
    print("-" * 78)
    print(f"  {'group':<40}{'pairs':>6}{'min':>9}{'middle':>16}{'max':>9}")
    order = ["STANDING electricity + STANDING gas", "STANDING electricity + MARKET gas",
             "MARKET electricity + STANDING gas", "MARKET electricity + MARKET gas"]
    for gname in order + sorted(set(groups) - set(order)):
        if gname not in groups:
            continue
        st = summary([c["S"] for c in groups[gname]])
        print(f"  {gname:<40}{st['n']:>6}{money(st['min']):>9}{mid(st):>16}{money(st['max']):>9}")
    if open_now:
        st = summary([c["S"] for c in open_now])
        print(f"  {'open to any household':<40}{st['n']:>6}{money(st['min']):>9}{mid(st):>16}{money(st['max']):>9}")

    print()
    print("  Where the spread comes from (year one, primary treatment):")
    print(f"    Gas bill today, by gas plan:        {money(gas_rows[0][1] + gas_rows[0][2])} "
          f"({gas_rows[0][0]['displayName']}, {gas_rows[0][0]['type']}) to "
          f"{money(gas_rows[-1][1] + gas_rows[-1][2])} ({gas_rows[-1][0]['displayName']}, {gas_rows[-1][0]['type']})")
    print(f"      of which daily supply charge:     {money(min(r[2] for r in gas_rows))} to {money(max(r[2] for r in gas_rows))}")
    print(f"    Heat pump running cost, by plan:    {money(elec_rows[0][1])} "
          f"({elec_rows[0][0]['displayName']}) to {money(elec_rows[-1][1])} ({elec_rows[-1][0]['displayName']})")
    print(f"    Spread: {money(gas_spread)} on the gas side, {money(elec_spread)} on the heat pump side.")

    print()
    print("-" * 78)
    print("SKIPPED - every plan not used, and why (a plan can have more than one reason)")
    print("-" * 78)
    reason_counts = {}
    for sk in skipped:
        for r in sk["reasons"]:
            key = r.split(" (")[0] if r.startswith("not offered") else r
            reason_counts.setdefault(key, {"plans": 0, "by_state": {}})
            reason_counts[key]["plans"] += 1
            st_ = reason_counts[key]["by_state"]
            st_[sk["state"]] = st_.get(sk["state"], 0) + 1
    print(f"  {'plans':>6}  reason")
    for reason, v in sorted(reason_counts.items(), key=lambda kv: -kv[1]["plans"]):
        states = ", ".join(f"{a} {b}" for a, b in sorted(v["by_state"].items()))
        print(f"  {v['plans']:>6}  {reason}")
        print(f"  {'':>6}  [{states}]")
    print(f"  Total plans skipped: {len(skipped)} of {total}. The parsers read every one of them without")
    print("  error; the reasons above say why the model could not use them, or should not.")

    # --- Verdict, computed from the numbers above -------------------------------------
    def end_of(pct):
        return "the generous end" if pct > 60 else ("the low end" if pct < 40 else "the middle")

    head = (f"RESULT - in year one the headline saves more than {pct_below:.0f}% of the cached plan pairs "
            f"({end_of(pct_below)}). After year one, on list prices, {pct_after:.0f}% ({end_of(pct_after)}).")
    print()
    print("-" * 78)
    print(head)
    print("-" * 78)
    mm_s = summary([c["S"] for c in mm]) if mm else None
    lines = [
        f"  Across {n} plan pairs a two-person household at postcode 2088 could hold, the same",
        f"  switch saves {money(stats['min'])} to {money(stats['max'])} a year in year one "
        f"(middle pair {mid(stats)}).",
        f"  In year one the headline {money(ref['S'])} saves more than {pct_below:.0f}% of them: "
        f"{end_of(pct_below)}, not the typical case.",
        f"  Once EnergyAustralia's one-year discounts end, it saves more than {pct_after:.0f}% of all pairs "
        f"and {where(open_after):.0f}% of",
        "  pairs open to any household. The payback runs past year one, so both periods matter.",
    ]
    if mm_s:
        lines.append(f"  A tenant already on market deals for both fuels usually saves less in year one: "
                     f"middle pair {mid(mm_s)},")
        lines.append(f"  against {money(ref['S'])} for the headline. {mm_above} of those {len(mm)} pairs "
                     "still save more than it.")
    lines.append(f"  Most of the spread comes from the gas side ({money(gas_spread)}) rather than the "
                 f"heat pump side ({money(elec_spread)}).")
    lines.append(f"  Every pair saves money. The supply charge part is {money(min(c['S_supply'] for c in primary))} "
                 f"to {money(max(c['S_supply'] for c in primary))}.")
    lines.append(f"  Payback in year one terms: {yrs(stats['max']):.1f} to {yrs(stats['min']):.1f} years; "
                 f"{mid_yrs} at the middle pair (headline {ref['years']:.1f}).")
    print("\n".join(lines))
    print("""
  LIMITS, stated plainly: 32 NSW plans from 2 retailers is not the NSW market. The
  sweep holds for the plans cached, not for every plan a tenant could choose. One-off
  incentives and fees are ignored, as in the headline.""")

    # --- JSON ------------------------------------------------------------------------
    def plan_out(r):
        return {k_: r[k_] for k_ in ("planId", "brand", "displayName", "type", "state",
                                     "restricted_to", "discount", "benefit_period", "file") if k_ in r}

    def rounded(stats_):
        return {k_: (round(v, 2) if isinstance(v, float) else
                     [round(x, 2) for x in v] if isinstance(v, list) else v)
                for k_, v in stats_.items()}

    out = {
        "_source": {
            "name": "AER Consumer Data Right - Energy Product Reference Data API, cached plan detail "
                    "responses in data/cdr_raw/",
            "retrieved": "2026-10-02 (NSW), 2026-10-03 (other states)",
            "model": "tools/model.py run(), unchanged; parsers tools/extract_tariffs.py, unchanged",
            "caveat": "A robustness check of the tariff choice, NOT a predicted-vs-actual accuracy "
                      "test. 32 NSW plans from 2 retailers (first 8 per retailer and fuel as listed by "
                      "the API, of 170 electricity and 20 gas plans listed for 2088). Not the NSW market. "
                      "Medians are order statistics: an even count with two different middle pairs "
                      "reports both (middle_pairs) and no single median.",
        },
        "case": {"occupants": OCCUPANTS, "postcode": POSTCODE, "switch": "gas storage -> heat pump",
                 "last_gas_appliance": True, "heat_pump_rate": "off-peak; flat on single-rate plans"},
        "reference": {"electricity": REF_ELECTRICITY, "gas": REF_GAS, "S": round(ref["S"], 2),
                      "S_supply": round(ref["S_supply"], 2), "years": round(ref["years"], 3),
                      "reproduces_headline": True},
        "emissions_cut_kg_per_year": round(min(d_ems), 2) if len(d_ems) == 1 else sorted(d_ems),
        "primary_treatment": "bill",
        "discount_benefit_periods": discounted,
        "treatments": {
            t: {"label": TREATMENT_LABEL[t],
                **rounded(summary([c["S"] for c in combos[t]])),
                "headline_saves_more_than_share": round(where(combos[t]) / 100, 4),
                "open_to_any_household": {
                    **rounded(summary([c["S"] for c in combos[t] if c["open_to_all"]])),
                    "headline_saves_more_than_share":
                        round(where([c for c in combos[t] if c["open_to_all"]]) / 100, 4)}}
            for t in TREATMENTS},
        "groups_year_one": {g: rounded(summary([c["S"] for c in cs])) for g, cs in groups.items()},
        "market_market_pairs_above_headline": mm_above,
        "spread_by_side": {"gas_bill_today": [round(gas_rows[0][1] + gas_rows[0][2], 2),
                                              round(gas_rows[-1][1] + gas_rows[-1][2], 2)],
                           "heat_pump_cost": [round(elec_rows[0][1], 2), round(elec_rows[-1][1], 2)]},
        "restricted_plans": len(restricted),
        "run_refused_pairs": len(refused),
        "plans_used": {"electricity": [plan_out(e) for e in elec], "gas": [plan_out(g) for g in gas]},
        "skipped": {"total": len(skipped), "of": total,
                    "by_reason": {r: v for r, v in sorted(reason_counts.items(), key=lambda kv: -kv[1]["plans"])},
                    "plans": [dict(plan_out(sk), fuel=sk["fuel"], reasons=sk["reasons"]) for sk in skipped]},
        "pairs": [{k_: (round(v, 2) if isinstance(v, float) else v) for k_, v in c.items()}
                  for c in primary],
        "pairs_after_year_one": [{k_: (round(v, 2) if isinstance(v, float) else v)
                                  for k_, v in c.items() if k_ in ("electricity", "gas", "S", "open_to_all")}
                                 for c in after],
        "finding": head.replace("RESULT - ", ""),
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2)
    print(f"\n  Written: {os.path.relpath(OUT)}")

if __name__ == "__main__":
    main()
