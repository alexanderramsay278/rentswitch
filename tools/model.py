#!/usr/bin/env python3
"""
Rentswitch - reference implementation + validator for the P0 dual-payback model.

Mirrors src/engine.ts. Exists for two reasons:
  1. Node is not installed on this machine, so the TS cannot be run here.
     This gives real numbers TODAY for the letter, the video script and the
     submission pack.
  2. Two independent implementations agreeing is actual validation.

Runs every sanity check in Model Maths section 12 as an assertion.

Usage:  python tools/model.py
"""

import json
import os

HERE = os.path.dirname(__file__)
DATA = os.path.join(HERE, "..", "data")


def load():
    with open(os.path.join(DATA, "constants.json"), encoding="utf-8") as f:
        k = json.load(f)
    with open(os.path.join(DATA, "tariffs.json"), encoding="utf-8") as f:
        t = json.load(f)
    return k, t


def pick_plan(tariffs, plan_id):
    for p in tariffs["plans"]:
        if p["planId"] == plan_id:
            return p
    raise KeyError(plan_id)


# --- Model Maths sections 2-9 ------------------------------------------------

def useful_energy_mj_yr(n, L, dT, c_water=4.186):
    """Section 2."""
    return n * L * dT * c_water / 1000 * 365


def gas_cost_yr(blocks, delivered_mj_yr):
    """Section 4, stepped DAILY blocks."""
    per_day = delivered_mj_yr / 365.0
    remaining, daily = per_day, 0.0
    for b in blocks:
        if remaining <= 0:
            break
        vol = b.get("volumeMJ")
        take = remaining if vol is None else min(remaining, vol)
        daily += take * b["unitPrice"]
        remaining -= take
    if remaining > 0 and blocks:
        daily += remaining * blocks[-1]["unitPrice"]
    return daily * 365.0


def deal(I, S, W, v, f, t_max):
    """Section 10 branch logic, in the exact specified order."""
    if I <= 0:
        return {"offer": "A", "r": 0.0, "V": 0.0, "G": I, "T": None, "B": S}
    if not W:
        return {"offer": "D", "r": 0.0, "V": 0.0, "G": I, "T": None, "B": S,
                "reason": "no rent supplied"}
    V = W * (v + f)
    if V >= I:
        return {"offer": "B", "r": 0.0, "V": V, "G": I - V, "T": None, "B": S}
    G = I - V
    if G < S * t_max:
        r = S / 104.0
        T = 2 * G / S
        assert r < S / 52.0, "INVARIANT BREACH: tenant not cash-positive"
        return {"offer": "C", "r": r, "V": V, "G": G, "T": T, "B": S / 2.0}
    return {"offer": "D", "r": 0.0, "V": V, "G": G, "T": None, "B": S}


def run(k, tariffs, occupants, last_gas_appliance=True, rate="offPeak",
        weekly_rent=None, L=None, cop=None, rebate=None):
    e_plan = pick_plan(tariffs, k["tariffs_reference"]["electricity_plan"].split(" - ")[0])
    g_plan = pick_plan(tariffs, k["tariffs_reference"]["gas_plan"].split(" - ")[0])

    L = L if L is not None else k["demand"]["L_litres_per_person_per_day"]["value"]
    dT = k["demand"]["deltaT_kelvin"]["value"]
    eta_gas = k["efficiency"]["eta_gas_storage"]["value"]
    cop = cop if cop is not None else k["efficiency"]["COP_heat_pump"]["value"]
    ef_e = k["emissions"]["EF_electricity_NSW_kgCO2e_per_kWh"]["value"]
    ef_g = k["emissions"]["EF_gas_NSW_kgCO2e_per_MJ"]["value"]
    C = k["costs"]["C_heat_pump_installed"]["value"]
    C_gas = k["costs"]["C_gas_storage_installed"]["value"]
    R = rebate if rebate is not None else k["rebates"]["R_default"]["value"]

    rate_map = {"peak": e_plan["peak"], "offPeak": e_plan["offPeak"],
                "controlledLoad": e_plan["controlledLoad"]}
    p_e = rate_map[rate]

    E = useful_energy_mj_yr(occupants, L, dT)
    D_gas = E / eta_gas
    D_res = E / k["efficiency"]["eta_electric_resistive"]["value"] / 3.6
    D_hp = E / cop / 3.6

    cost_gas_usage = gas_cost_yr(g_plan["blocks"], D_gas)
    cost_gas_supply = 365 * g_plan["dailySupplyCharge"] if last_gas_appliance else 0.0
    cost_hp = D_hp * p_e
    if rate == "controlledLoad":
        cost_hp += 365 * (e_plan.get("controlledLoadSupplyCharge") or 0.0)

    S_usage = cost_gas_usage - cost_hp
    S = S_usage + cost_gas_supply

    em_gas = D_gas * ef_g
    em_hp = D_hp * ef_e
    d_em = em_gas - em_hp

    I = (C - R) - C_gas
    years = I / S if S > 0 else float("inf")
    dl = deal(I, S, weekly_rent, k["deal"]["v_vacancy_weeks"]["value"],
              k["deal"]["f_letting_fee_weeks"]["value"],
              k["deal"]["T_max_years"]["value"])

    # --- Model Maths section 12 sanity checks ---
    assert abs(D_hp - D_res / cop) < 1e-9, "D_hp != D_res/COP -> 3.6 conversion wrong"
    assert S > 0, f"S must be positive for gas->heat pump, got {S:.2f}"
    assert d_em > 0, f"dEm must be positive on the NSW grid factor, got {d_em:.2f}"

    return dict(E=E, D_gas=D_gas, D_hp=D_hp, D_res=D_res,
                cost_gas_usage=cost_gas_usage, cost_gas_supply=cost_gas_supply,
                cost_gas_total=cost_gas_usage + cost_gas_supply, cost_hp=cost_hp,
                S_usage=S_usage, S_supply=cost_gas_supply, S=S,
                em_gas=em_gas, em_hp=em_hp, d_em=d_em,
                pct_cut=100 * d_em / em_gas, I=I, years=years, deal=dl,
                p_e=p_e, rate=rate, R=R, cop=cop, L=L)


def money(x):
    return f"${x:,.0f}"


def main():
    k, tariffs = load()

    print("=" * 72)
    print("RENTSWITCH P0 - gas storage hot water -> heat pump, NSW (Ausgrid/Jemena)")
    print("=" * 72)
    print(f"Tariffs : AGL Residential Standing Offer (the REGULATED reference offer)")
    print(f"L       : {k['demand']['L_litres_per_person_per_day']['value']} L/person/day  [NSW DCCEEW ESS modelling]")
    print(f"COP     : {k['efficiency']['COP_heat_pump']['value']}  [derived from the 60%-saving MEPS floor, DRIS Apr 2026]")
    print(f"eta_gas : {k['efficiency']['eta_gas_storage']['value']}  [energyrating.gov.au, Zone 3, AS/NZS 4234]")
    print(f"Costs   : heat pump {money(k['costs']['C_heat_pump_installed']['value'])} vs "
          f"like-for-like gas {money(k['costs']['C_gas_storage_installed']['value'])}  [DRIS Apr 2026 Table 20]")
    print(f"Rebate  : {money(k['rebates']['R_default']['value'])} (default zero - every dollar only improves this)")

    print("\n" + "-" * 72)
    print("HOUSEHOLD SIZE SWEEP  (heat pump on OFF-PEAK, gas fully disconnected)")
    print("-" * 72)
    hdr = f"{'people':>7}{'gas $/yr':>11}{'HP $/yr':>10}{'SAVING':>10}{'kg CO2e':>10}{'cut':>7}{'I/S yrs':>9}"
    print(hdr)
    for n in (1, 2, 3, 4):
        r = run(k, tariffs, n)
        print(f"{n:>7}{r['cost_gas_total']:>11,.0f}{r['cost_hp']:>10,.0f}"
              f"{r['S']:>10,.0f}{r['d_em']:>10,.0f}{r['pct_cut']:>6.0f}%{r['years']:>9.1f}")

    print("\n" + "-" * 72)
    print("WHERE THE SAVING COMES FROM  (2-person household)")
    print("-" * 72)
    r = run(k, tariffs, 2)
    print(f"  Gas usage                        {money(r['cost_gas_usage']):>10}")
    print(f"  Gas daily supply charge          {money(r['cost_gas_supply']):>10}   <- paid regardless of usage")
    print(f"  Gas total                        {money(r['cost_gas_total']):>10}")
    print(f"  Heat pump electricity            {money(r['cost_hp']):>10}")
    print(f"  {'-'*40}")
    print(f"  Saving on usage                  {money(r['S_usage']):>10}")
    print(f"  Saving on supply charge          {money(r['S_supply']):>10}   <- {100*r['S_supply']/r['S']:.0f}% of the total")
    print(f"  TENANT SAVING  S                 {money(r['S']):>10} /yr")
    print(f"  LANDLORD INCREMENTAL  I          {money(r['I']):>10}")
    print(f"  SPLIT INCENTIVE  I/S             {r['years']:>10.1f} years")

    print("\n" + "-" * 72)
    print("ELECTRICITY RATE SENSITIVITY  (2 people)")
    print("-" * 72)
    for rate in ("peak", "offPeak", "controlledLoad"):
        rr = run(k, tariffs, 2, rate=rate)
        print(f"  {rate:<16} @ ${rr['p_e']:.4f}/kWh   saving {money(rr['S']):>8}/yr   payback {rr['years']:.1f} yrs")

    print("\n" + "-" * 72)
    print("ASSUMPTION SENSITIVITY  (2 people, off-peak)")
    print("-" * 72)
    base = run(k, tariffs, 2)
    print(f"  base (L=45, COP=2.5)                     saving {money(base['S']):>8}/yr   payback {base['years']:.1f} yrs")
    for label, kw in [("L=60 (AS/NZS 4234:2008 baseline)", dict(L=60)),
                      ("COP=3.5 (typical, not the floor)", dict(cop=3.5)),
                      ("rebate $1,000", dict(rebate=1000)),
                      ("rebate $1,800", dict(rebate=1800))]:
        rr = run(k, tariffs, 2, **kw)
        print(f"  {label:<40} saving {money(rr['S']):>8}/yr   payback {rr['years']:.1f} yrs")

    print("\n" + "-" * 72)
    print("GAS STAYS CONNECTED  (other gas appliances remain) - 2 people")
    print("-" * 72)
    rr = run(k, tariffs, 2, last_gas_appliance=False)
    print(f"  saving {money(rr['S'])}/yr   payback {rr['years']:.1f} yrs"
          f"   <- supply charge NOT saved; {money(base['S'] - rr['S'])}/yr worse")

    print("\n" + "-" * 72)
    print("DEAL CALCULATOR  (2 people, off-peak, rent sweep)")
    print("-" * 72)
    for W in (500, 650, 800, 1000):
        rr = run(k, tariffs, 2, weekly_rent=W)
        d = rr["deal"]
        t = f"{d['T']:.1f}y" if d["T"] else "-"
        print(f"  rent ${W:>5}/wk  ->  OFFER {d['offer']}   vacancy value {money(d['V']):>8}"
              f"   gap {money(d['G']):>8}   rent adj ${d['r']:.2f}/wk   payback {t}")

    print("\n" + "=" * 72)
    print("ALL MODEL MATHS section 12 SANITY CHECKS PASSED")
    print("=" * 72)


if __name__ == "__main__":
    main()
