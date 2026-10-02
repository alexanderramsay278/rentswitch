#!/usr/bin/env python3
"""
Rentswitch - external validation against AER metered benchmarks.

WHAT THIS IS
  A plausibility and scaling check of the hot water model against real metered
  consumption from 1,062 New South Wales households.

WHAT THIS IS NOT
  It is NOT a predicted-vs-actual accuracy test. The AER benchmark is TOTAL
  household gas (hot water + cooking + space heating); our model covers hot
  water only. So we cannot say "we were within X%". What we CAN do is ask two
  falsifiable questions:

    1. PLAUSIBILITY  - is our modelled hot water demand a believable share of
                       the total gas a real household of that size actually uses?
                       If it exceeds ~85%, the model is claiming almost all gas
                       goes to hot water, leaving nothing for cooking or heating.
    2. SCALING       - our model assumes demand is LINEAR in occupants
                       (n x L x deltaT). Do real households scale that way?

  Question 2 is the sharper test, and the model fails it.

SOURCE
  AER, "Residential energy consumption benchmarks", 9 December 2020
  (prepared by Frontier Economics). Table 30: New South Wales gas consumption
  benchmarks (MJ), by household size and season. NSW gas sample: 1,062 households.
  https://www.aer.gov.au/system/files/Residential%20energy%20consumption%20benchmarks%20-%209%20December%202020_0.pdf

  Note: 2020 data - the most recent AER benchmark release. Housing stock and
  appliance mix change slowly, but this is 6 years old and that is disclosed.

Usage:  python tools/validate_aer.py
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from model import load, useful_energy_mj_yr  # noqa: E402

# AER Table 30 - NSW gas consumption benchmarks, MJ, (summer, autumn, winter, spring)
AER_NSW_GAS_MJ = {
    1: (1340, 2168, 4033, 2294),
    2: (2219, 3901, 6990, 3835),
    3: (2841, 4636, 7858, 4643),
    4: (3538, 5593, 9172, 5857),
    5: (4117, 6727, 11055, 6900),   # AER category is "5+"
}

# Above this share, "hot water" would be consuming essentially all household gas,
# leaving nothing for cooking or space heating - i.e. the model is over-predicting.
IMPLAUSIBLE_SHARE = 0.85


def main():
    k, _ = load()
    L = k["demand"]["L_litres_per_person_per_day"]["value"]
    dT = k["demand"]["deltaT_kelvin"]["value"]
    eta = k["efficiency"]["eta_gas_storage"]["value"]

    rows = []
    for n in sorted(AER_NSW_GAS_MJ):
        actual = sum(AER_NSW_GAS_MJ[n])
        modelled = useful_energy_mj_yr(n, L, dT) / eta
        rows.append((n, actual, modelled, modelled / actual))

    print("=" * 74)
    print("EXTERNAL VALIDATION - AER metered benchmarks (NSW gas, n=1,062 households)")
    print("=" * 74)
    print(f"Model inputs: L={L} L/person/day, dT={dT} K, eta_gas={eta}")
    print()
    print("TEST 1 - PLAUSIBILITY: is our hot water a believable share of real total gas?")
    print(f"  {'people':>7}{'AER total gas':>16}{'our hot water':>15}{'share':>9}  verdict")
    for n, a, m, s in rows:
        verdict = "plausible" if s < 0.70 else ("high" if s < IMPLAUSIBLE_SHARE else "IMPLAUSIBLE")
        print(f"  {n:>7}{a:>15,.0f}{m:>15,.0f}{s*100:>8.0f}%  {verdict}")

    print()
    print("TEST 2 - SCALING: our model is linear in occupants. Are real households?")
    a1, m1 = rows[0][1], rows[0][2]
    print(f"  {'people':>7}{'AER actual':>14}{'our model':>13}{'we over-predict by':>21}")
    for n, a, m, _ in rows:
        print(f"  {n:>7}{a/a1:>13.2f}x{m/m1:>12.2f}x{((m/m1)/(a/a1)-1)*100:>20.0f}%")

    worst = max(rows, key=lambda r: r[3])
    ok = [r for r in rows if r[3] < 0.70]          # "plausible" band only

    print()
    print("-" * 74)
    print("RESULT - the model does not pass cleanly, and that is the finding.")
    print("-" * 74)
    print(f"""
  The model holds up at {ok[0][0]}-{ok[-1][0]} occupant households, where modelled hot water is
  {ok[0][3]*100:.0f}-{ok[-1][3]*100:.0f}% of real total household gas - believable, since a gas household also
  cooks and often heats with gas.

  It breaks down above that. At {worst[0]} occupants the model claims {worst[3]*100:.0f}% of ALL
  household gas goes to hot water, which cannot be right.

  CAUSE: we assume hot water demand is linear in occupants, because the NSW
  Energy Savings Scheme's own modelling uses a flat {L:.0f} L/person/day. Real
  metered households are strongly sub-linear - AER data shows 5 people use
  {rows[-1][1]/a1:.2f}x a single-person household, not {rows[-1][2]/m1:.2f}x. Households share
  dishwashing, laundry and heating; they do not share showers, but the
  per-person increment clearly falls as the household grows.

  CONSEQUENCE, stated plainly: our quoted savings are reliable for 1-2 person
  households and increasingly OVERSTATE the saving above that. Our worked
  example is a 2-person household, which is inside the defensible range.
""")
    print("  Reported rather than hidden. A model that reports its own limit has been")
    print("  tested; one that reports nothing has not.")

    out = os.path.join(os.path.dirname(__file__), "..", "data", "validation_aer.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({
            "_source": {
                "name": "AER, Residential energy consumption benchmarks, 9 December 2020 "
                        "(Frontier Economics). Table 30: NSW gas consumption benchmarks (MJ).",
                "url": "https://www.aer.gov.au/system/files/Residential%20energy%20consumption%20benchmarks%20-%209%20December%202020_0.pdf",
                "sample": "1,062 NSW households",
                "caveat": "AER figure is TOTAL household gas; our model is hot water only. "
                          "This is a plausibility and scaling check, NOT a predicted-vs-actual "
                          "accuracy test. 2020 data.",
            },
            "results": [
                {"occupants": n, "aer_total_gas_mj": a, "modelled_hot_water_mj": round(m, 1),
                 "hot_water_share": round(s, 3)} for n, a, m, s in rows
            ],
            "finding": "Model is plausible at 1-2 occupants and increasingly over-predicts "
                       "above that. Linear-in-occupants assumption (inherited from the NSW ESS "
                       "45 L/person/day figure) diverges from sub-linear real consumption.",
        }, f, indent=2)
    print(f"\n  Written: {os.path.relpath(out)}")


if __name__ == "__main__":
    main()
