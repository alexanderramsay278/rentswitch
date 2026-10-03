#!/usr/bin/env python3
"""
Renders the landlord letter from real model output. Mirrors src/letter.ts.

Exists so the letter can be read, edited and exported without Node installed.
Used to produce the sample letter that ships with the submission.

PROSE RULES, applied 2026-10-03 when the copy was rewritten:
  - No em dashes or en dashes anywhere. They were the loudest generated-text tell.
  - No "this isn't X, it's Y" constructions.
  - No signposting ("Here's the problem", "stated honestly", "So here's what I offer").
  - Sentence length varies deliberately.
If src/letter.ts changes, change this to match. src/letter.ts is the shipped copy.

Usage:  python tools/letter.py [occupants] [weekly_rent]
"""

import sys

from model import load, run


def money(x):
    return "$" + format(int(round(x)), ",d")


def letter(r, k, tenant="[your name]", landlord="[landlord or agent]",
           address="[property address]",
           urgent_repair=True, depreciation=True):
    # Both legal blocks default ON since 2026-10-02, verified against primary
    # sources. See data/constants.json -> legal. The wording separates what the
    # Act says from what we infer.
    C = k["costs"]["C_heat_pump_installed"]["value"]
    C_gas = k["costs"]["C_gas_storage_installed"]["value"]
    R = r["R"]
    d = r["deal"]
    L = []

    L += ["Dear %s," % landlord, ""]
    L += ["I want to raise something about the gas hot water system at %s. When it next "
          "needs replacing, I'd like you to consider a heat pump. I've worked through what "
          "that costs you, not just what it saves me." % address, ""]

    L += ["What this actually costs you", ""]
    L += ["Hot water systems fail. When this one does, you're buying a replacement either "
          "way. A like-for-like gas replacement runs about %s installed. A heat pump is "
          "about %s." % (money(C_gas), money(C))]
    if R > 0:
        L += ["After the %s rebate, your heat pump cost is %s." % (money(R), money(C - R))]
    L += ["", "So the question isn't whether to spend %s. It's whether to spend %s more "
              "than you were already going to." % (money(C), money(r["I"])), ""]

    L += ["What it saves, and who gets the saving", ""]
    L += ["The switch cuts the hot water bill by roughly %s a year." % money(r["S"])]
    if r["S_supply"] > 0:
        L += ["Of that, %s is the daily gas supply charge, which only goes away if the gas "
              "connection goes entirely. You pay it whether the household burns a lot of gas "
              "or almost none." % money(r["S_supply"])]
    L += ["It also cuts about %d kg of CO2-e a year, down %d%%."
          % (round(r["d_em"]), round(r["pct_cut"])), ""]
    L += ["Now the awkward part. I get that saving. You pay for it. On those numbers it "
          "takes %.1f years of my savings to cover your cost, and not a cent of it reaches "
          "you. That's the reason this almost never happens in rentals, and it isn't anyone "
          "behaving badly. It's just how the split falls. So I'd rather bring you something "
          "than only ask." % r["years"], ""]

    L += ["What I'm offering", ""]
    if d["offer"] == "A":
        L += ["At replacement time this costs you nothing extra, because the rebates cover "
              "the difference against a like-for-like gas replacement. I'm not asking for "
              "anything back. I'd just like us to agree now that when the system goes, it "
              "gets replaced with a heat pump."]
    elif d["offer"] == "B":
        L += ["I'll sign a longer fixed term. A vacancy between tenancies costs you "
              "somewhere around %s once you add letting fees and advertising, which is more "
              "than the %s difference. One turnover avoided covers it."
              % (money(d["V"]), money(r["I"])), ""]
        L += ["I'm not asking for a rent reduction, and I'm not asking you to buy me "
              "anything I'd take when I go. What I'm offering is certainty about the lease, "
              "which is the part that's actually worth money to you."]
    elif d["offer"] == "C":
        L += ["I'll sign a longer fixed term, which is worth about %s to you in avoided "
              "vacancy and letting costs. That leaves a gap of roughly %s."
              % (money(d["V"]), money(d["G"])), ""]
        L += ["To close it, I'll take a rent adjustment of $%.2f a week at renewal. That "
              "pays your gap back in about %.1f years. I've set it below what I save on "
              "purpose, so I'd still be roughly %s a year better off and so would you. Set "
              "it any higher and this is just a rent rise with a climate label on it, which "
              "I'm not going to propose." % (d["r"], d["T"], money(d["B"]))]
    else:
        L += ["On the numbers I have, I can't put together an offer that works for you "
              "without costing me more than I'd save. The gap is about %s. I'd rather say "
              "that than dress it up." % money(d["G"])]
    L += [""]

    extra = []
    if urgent_repair:
        extra.append(
            "Replacing it while it still works is cheaper than replacing it after it dies. "
            "Under the Residential Tenancies Act 2010 (NSW), hot water failure counts as an "
            "urgent repair, so you'd be organising it at short notice. That usually means "
            "less room to compare quotes. The rebate schemes also need an accredited "
            "installer and a model that's on the register, and that isn't what turns up on "
            "a Sunday afternoon.")
    if depreciation:
        extra.append(
            "Worth asking your accountant about depreciation too. A brand new hot water "
            "system in a rental is generally a depreciating asset. The 2017 change that "
            "stopped deductions for second-hand assets doesn't apply to new ones. I haven't "
            "tried to put a figure on it, since that depends on your situation and not mine.")
    if extra:
        L += ["A couple of other things", ""] + extra + [""]

    L += ["Happy to talk it through. Happy to chase the quotes myself, too.", ""]
    L += ["Kind regards,", tenant, "", "---", ""]
    L += ["Where these numbers come from"]
    L += ["Tariffs: AER Consumer Data Right, AGL Residential Standing Offer (the regulated "
          "reference offer), retrieved 2026-10-02. Emissions factors: DCCEEW National "
          "Greenhouse Accounts Factors 2026. Installed costs: DCCEEW Decision Regulation "
          "Impact Statement, Heat Pump Water Heaters, April 2026, Table 20. Hot water "
          "demand: %s L per person per day, the figure NSW used in its own Energy Savings "
          "Scheme modelling. Heat pump efficiency: COP %s, derived from the minimum 60%% "
          "saving a compliant unit must achieve, so a worst-case compliant unit rather than "
          "a best-case one." % (r["L"], r["cop"])]
    return "\n".join(L)


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    W = float(sys.argv[2]) if len(sys.argv) > 2 else 650
    k, tariffs = load()
    r = run(k, tariffs, n, weekly_rent=W)
    print(letter(r, k))
