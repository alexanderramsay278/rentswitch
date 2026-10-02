#!/usr/bin/env python3
"""
Renders the landlord letter from real model output. Mirrors src/letter.ts.
Exists so Alex can read and edit the actual copy today without Node.

Usage:  python tools/letter.py [occupants] [weekly_rent]
"""

import sys
from model import load, run


def money(x):
    return "$" + format(int(round(x)), ",d")


def letter(r, k, tenant="[your name]", landlord="[landlord or agent]",
           address="[property address]",
           urgent_repair=True, depreciation=True):
    # Both default ON since 2026-10-02 - verified against primary sources.
    # See data/constants.json -> legal. Wording separates statute from inference.
    C = k["costs"]["C_heat_pump_installed"]["value"]
    C_gas = k["costs"]["C_gas_storage_installed"]["value"]
    R = r["R"]
    d = r["deal"]
    L = []

    L += [f"Dear {landlord},", ""]
    L += [f"I'd like to propose replacing the gas hot water system at {address} with an "
          f"electric heat pump when it next needs replacing. I've done the numbers from "
          f"both sides, and I think this is worth your time.", ""]

    L += ["WHAT IT ACTUALLY COSTS YOU", ""]
    L += [f"This isn't a request to spend {money(C)} you weren't going to spend. Hot water "
          f"systems fail, and when this one does you're replacing it either way. A "
          f"like-for-like gas replacement costs about {money(C_gas)} installed. A heat pump "
          f"costs about {money(C)}."]
    if R > 0:
        L += [f"After the {money(R)} rebate, your heat pump cost is {money(C - R)}."]
    L += ["", f"So the real decision isn't {money(C)} versus nothing. It's {money(r['I'])} "
              f"extra, once, at a replacement you were already going to pay for.", ""]

    L += ["WHAT IT SAVES - AND WHO GETS THE SAVING", ""]
    L += [f"The change cuts the hot water bill by about {money(r['S'])} a year."]
    if r["S_supply"] > 0:
        L += [f"About {money(r['S_supply'])} of that is the daily gas supply charge, which "
              f"disappears entirely once the last gas appliance is gone. That part is payable "
              f"no matter how little gas is actually used."]
    L += [f"It also cuts emissions by about {round(r['d_em'])} kg CO2-e a year, a reduction "
          f"of {round(r['pct_cut'])}%.", ""]
    L += [f"Here's the problem, stated honestly: I get that saving, and you pay for it. At "
          f"{money(r['S'])} a year against {money(r['I'])} extra, it takes "
          f"{r['years']:.1f} years of my savings to cover your cost - and none of that money "
          f"ever reaches you. That's why these upgrades don't happen in rentals, and it isn't "
          f"anyone behaving badly. So here's what I can offer.", ""]

    L += ["WHAT I'M OFFERING", ""]
    if d["offer"] == "A":
        L += ["At replacement time this costs you nothing extra - the rebates cover the "
              "difference against a like-for-like gas replacement. I'm not asking for anything "
              "in return. I'd just like to agree now that when the system is replaced, it's "
              "replaced with a heat pump."]
    elif d["offer"] == "B":
        L += [f"I'll sign a longer fixed-term lease. A vacancy between tenancies costs you "
              f"around {money(d['V'])} once letting fees and advertising are counted - more "
              f"than the {money(r['I'])} difference. One avoided turnover more than pays for "
              f"this.", ""]
        L += ["I'm not asking for a rent reduction and I'm not asking you to fund anything I'd "
              "take with me. I'm offering certainty, which is the thing that's actually worth "
              "money to you here."]
    elif d["offer"] == "C":
        L += [f"I'll sign a longer fixed-term lease, which is worth about {money(d['V'])} to "
              f"you in avoided vacancy and letting costs. That leaves a gap of about "
              f"{money(d['G'])}.", ""]
        L += [f"To close it, I'll accept a rent adjustment of ${d['r']:.2f} a week at renewal. "
              f"That pays your gap back in about {d['T']:.1f} years, and it's deliberately set "
              f"below what I save - I'd still be about {money(d['B'])} a year better off, and "
              f"so would you. If it were set any higher this would just be a rent rise with a "
              f"climate label on it, and I'm not going to propose that."]
    else:
        L += [f"On the numbers I have, I can't put together an offer that makes this work for "
              f"you without costing me more than I'd save - the gap is about {money(d['G'])}. "
              f"I'd rather tell you that than dress it up."]
    L += [""]

    extra = []
    if urgent_repair:
        extra.append("Replacing it on your timetable is cheaper than replacing it on its own. "
                     "Under the Residential Tenancies Act 2010 (NSW), a failure of the hot water "
                     "service is an urgent repair - so when this one dies, you'll be arranging a "
                     "replacement at short notice. In practice that means less room to compare "
                     "quotes, and the rebate schemes get hard to use: they need an accredited "
                     "installer and a model that's on the register, which is not what turns up "
                     "on a Sunday. Deciding now keeps all of that on the table.")
    if depreciation:
        extra.append("It's also worth asking your accountant about depreciation. A brand-new hot "
                     "water system in a rental is generally a depreciating asset - the 2017 change "
                     "that removed deductions for second-hand assets doesn't apply to new ones. "
                     "I haven't put a number on that, because it depends on your circumstances "
                     "rather than mine.")
    if extra:
        L += ["A COUPLE OF OTHER THINGS", ""] + extra + [""]

    L += ["Happy to talk this through, and happy to be the one who gets the quotes.", ""]
    L += ["Kind regards,", tenant, "", "---", ""]
    L += ["HOW THESE NUMBERS WERE WORKED OUT"]
    L += [f"Tariffs: AER Consumer Data Right, AGL Residential Standing Offer (the regulated "
          f"reference offer), retrieved 2026-10-02. Emissions factors: DCCEEW National "
          f"Greenhouse Accounts Factors 2026. Installed costs: DCCEEW Decision Regulation "
          f"Impact Statement, Heat Pump Water Heaters, April 2026, Table 20. Hot water demand: "
          f"{r['L']} L per person per day, the figure NSW used in its own Energy Savings Scheme "
          f"modelling. Heat pump efficiency: COP {r['cop']}, derived from the minimum 60% "
          f"saving a compliant unit must achieve - a worst-case compliant unit, not a "
          f"best-case one."]
    return "\n".join(L)


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    W = float(sys.argv[2]) if len(sys.argv) > 2 else 650
    k, tariffs = load()
    r = run(k, tariffs, n, weekly_rent=W)
    print("=" * 72)
    print(f"SAMPLE LETTER - {n} occupants, ${W:.0f}/wk rent, OFFER {r['deal']['offer']}")
    print("=" * 72)
    print()
    print(letter(r, k))
