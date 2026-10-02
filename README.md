# Rentswitch

> Shows renters the cheapest bill and emissions cuts they can make without touching the
> building — and writes the landlord business case for the ones they can't.

**Climate Hack-tion 2026** · Challenge: **Electrification** (35% by 2035) · Team **PPC Fans**
**Live: https://rentswitchaus.vercel.app** · Demo video: `[link — added Sunday]`

---

## The problem

**29.5% of Australian households rent** (ABS 2021 Census). A renter can switch energy plans,
but they cannot put solar on the roof or replace the gas hot water system — they don't own
them, and under the **Residential Tenancies Act 2010 (NSW)** alterations need the owner's
written consent. So the owner pays for the upgrade and the tenant gets the lower bill.
Both parties behave rationally and nothing gets installed. Economists call it the **split
incentive**, and it is written into policy as well as practice: **Victoria's main hot water
rebate is available to owner-occupiers only.**

Australia cannot reach 35% electrification by 2035 while nearly a third of its housing stock
is locked out by a contract.

---

## Scope

Built and validated for **New South Wales**: NSW tariffs, NSW Energy Savings Scheme rules,
NSW emissions factor. The model is parameterised by state — adding another is a tariff set,
a rebate table and an emissions factor, **not a rewrite**. We scoped to one state deliberately
in order to get the numbers right for that state.

**P0 covers hot water: gas storage → heat pump.** That is the biggest household energy load,
the best-documented, and the one with a real rebate attached. Everything else is in
[Future work](#future-work).

---

## How it works

**We never read your meter.** No sensor, no smart plug, no hardware, no bill upload required.
Rentswitch models the energy a household *must* be using, then prices it.

1. **Occupancy gives the useful energy required.** Hot water demand is
   `litres/person/day × temperature rise × specific heat of water`. That is thermodynamics,
   not measurement — and it is independent of what appliance you own.
2. **The appliance answer converts that into energy actually purchased.** The same hot shower
   needs roughly **1.82 units of gas input**, **1.00 units of resistive electricity**, or
   **0.40 units through a heat pump** — because a heat pump *moves* heat rather than making
   it, so its COP exceeds 1.
3. **Live tariffs turn energy into dollars; DCCEEW factors turn it into kg CO₂e.**

That is why five questions is enough: **the appliance is the variable.**

### Inputs

| # | Question | Why it's needed |
|---|---|---|
| 1 | Which state do you rent in? | Tariffs, rebates and emissions factor are all state-specific |
| 2 | What kind of place is it? | Fallback assumptions when an answer is "not sure" |
| 3 | What heats your hot water? | The appliance being replaced |
| 4 | What do you cook on? | P1 — cooktop |
| 5 | How do you heat the place in winter? | Determines advice shown; **deliberately not priced** (see Validation) |
| + | How many people live there? | Drives the entire hot water model |
| + | Is hot water your only gas appliance? | Decides whether the gas **daily supply charge** disappears |

> 🔑 That last question is worth **44% of the modelled saving.** The gas daily supply charge is
> payable regardless of how little gas you use, and it only goes away when the *connection* goes
> away. Most consumer calculators ignore it entirely.

### Outputs

1. **Do now** — no permission needed, in two columns: `$` saved **and** `kg CO₂e` saved
2. **Ask your landlord** — permission-required upgrades, priced from *both* sides
3. **The letter** — a generated landlord business case, structured as a term sheet
4. **What it adds up to** — household kWh, $ and kg CO₂e per year, tied to the 2035 goal

### The dual-payback model

```
Useful energy          E       = n × L × ΔT × 4.186 / 1000 × 365      [MJ/yr]
Gas delivered          D_gas   = E / η_gas                            [MJ/yr]
Heat pump electricity  D_hp    = E / COP / 3.6                        [kWh/yr]

Tenant saving          S       = (gas usage + gas supply) − heat pump usage   [$/yr]
Landlord incremental   I       = (C_hp − R) − C_gas                           [$]
THE SPLIT INCENTIVE    Years   = I / S
```

`I` is **not** the sticker price. Hot water systems fail, so the landlord is replacing the unit
at end of life either way — `I` is only the *extra* cost of choosing electric over a
like-for-like gas replacement. That counterfactual is what makes the landlord number
defensible, and it is why `I` can come out small or even negative once rebates apply.

`Years = I / S` is the thesis in one number: **how many years of the tenant's saving it takes
to cover a cost the tenant has no authority to incur, and will never see a cent of.**

### Worked example — 2-person NSW household, gas storage → heat pump

| | |
|---|---|
| Tenant saving `S` | **$703/yr** — of which **$306 is the gas supply charge** |
| Landlord incremental `I` | **$2,000** (with the rebate conservatively set to **$0**) |
| Split incentive `I / S` | **2.8 years** |
| Emissions | **−266 kg CO₂e/yr (−37%)** |

Every figure above traces to a named Australian government source. None is a vendor estimate.

---

## Data sources and licences

| Source | What we use it for | How accessed | Licence |
|---|---|---|---|
| **AER Consumer Data Right — Energy Product Reference Data API** | Live NSW retail electricity and gas tariffs, including daily supply charges and controlled-load rates | Live API, no key. **LIST needs `x-v: 1`, DETAIL needs `x-v: 3`.** 190 NSW residential plans matched; 32 cached to `data/` | AER / CDR terms — see `CREDITS.md` |
| **DCCEEW — National Greenhouse Accounts Factors 2026** | NSW electricity factor (0.60 + 0.07 = **0.67 kg CO₂e/kWh**, Table 1 p.10); natural gas (51.53 + 13.1 = **64.63 kg CO₂e/GJ**, Tables 5–6) | Published PDF, transcribed by hand | **CC BY 4.0** |
| **DCCEEW — Decision RIS: Heat Pump Water Heaters, April 2026** | Installed costs (Table 20: heat pump **$4,200**, gas storage **$2,200**); the 60%-saving MEPS level our COP is derived from (Table 19) | Published PDF | See `CREDITS.md` |
| **NSW DCCEEW — ESS Hot Water Rule Change consultation, Sept 2023** | Hot water demand **45 L/person/day**; NSW climate zone HP3-AU; activity definition **D19** | Published PDF | See `CREDITS.md` |
| **energyrating.gov.au (E3 Program)** | Gas storage efficiency **55%** (Zone 3, AS/NZS 4234, medium load) | Published page | See `CREDITS.md` |
| **ABS 2021 Census** | 29.5% of Australian households rent | Published statistic | CC BY 4.0 |
| **Residential Tenancies Act 2010 (NSW) s62, s64** | Hot water failure is an **urgent repair**; alterations require written consent | NSW legislation / Fair Trading | — |
| **ATO QC 103906** | Depreciation treatment of *new* assets in rentals — narrative pointer only | ato.gov.au | — |

Full detail, including AI disclosure, is in [`CREDITS.md`](./CREDITS.md).

---

## Assumptions

We would rather state a limit than imply a precision we don't have. Every assumption below is
also printed **on screen, next to the number it produces**.

| Assumption | Value | Basis |
|---|---|---|
| Hot water demand | **45 L/person/day** | The figure NSW used in its own ESS modelling. The current ESS *rule* baseline is 60 L/person/day (AS/NZS 4234:2008) — we run that as a sensitivity. NSW itself states the standard's reference consumption "is not appropriate for continued use as the baselines". |
| Temperature rise | **45 K** | ⚠️ **Assumption.** AS/NZS 4234 start-up thermal capacity basis. The standard is paywalled; we have not read it line by line. Consistent with ~15 °C cold main to ~60 °C stored. |
| Gas storage efficiency | **0.55** | energyrating.gov.au, Zone 3, medium load. Conservative: NSW is moving its reference gas system to 4 stars, which would *raise* this and increase our modelled saving. |
| Electric resistive efficiency | **1.00** | ⚠️ **Assumption.** Element conversion only; tank standing losses **not** deducted. Deliberately conservative — it shrinks the heat pump's advantage. |
| Heat pump **COP** | **2.5** | 🔑 **Derived, not quoted.** The MEPS level for 2026 is equivalent to a 60% saving in Zone 3, so `COP = η_res / 0.40 = 2.5`. **This is the regulatory floor a compliant unit must meet, not a typical unit.** Real units commonly reach 3–4. Every saving we quote is therefore a worst-case compliant machine. |
| Rebates `R` | **$0** | ⚠️ **No primary dollar figure obtained.** NSW consumer incentive pages are JavaScript-rendered; every other result was an installer or comparison site, which we do not cite. The case is presented with **zero rebate** — any real rebate only improves it. |
| Rebate stacking | *"may be able to claim both"* | NSW material indicates ESS certificates are **additional** to federal STCs for the same activity; heat pumps ≤425 L are excluded from the PDRS specifically to stop three-way stacking, which corroborates it. **Strongly indicated, not confirmed** — so we never say "you can". |
| Electricity rate for the heat pump | **Off-peak, $0.2185/kWh** | Achievable with a timer, no meter change. Controlled load ($0.1755) is cheaper but carries its own daily charge, so the difference is small. Peak is shown as the worst case. |
| Tariff plan | **AGL Residential Standing Offer** | The *regulated reference offer*, not a marketing plan. Cached 2026-10-02. |
| Distributor zone | One representative NSW zone (Ausgrid / Jemena) | Postcode-level distributor mapping is future work. |
| Landlord asset-value uplift, rental premium | **$0, user-adjustable** | No authoritative free Australian dataset prices either for a rental hot water system. Asserting a number here would be inventing data in the exact area judges are told to scrutinise. The output states what premium *would* be required rather than claiming one. |
| Reduced vacancy *as a statistical claim* | **Excluded entirely** | No defensible basis. Note this is **not** the same as the lease offer in the deal calculator — that is a contract the tenant signs, not a prediction. |

### Deliberately not modelled

**Space heating is not given a dollar figure.** It depends on the building's thermal fabric —
insulation, glazing, orientation — which we cannot observe from five questions. Question 5
determines *which advice is shown*, never a number. A heating figure we cannot defend would
contaminate the two we can.

**Hot water tank temperature is never advised.** Australian storage hot water is deliberately
held at ~60 °C for legionella control and tempered at the tap. Advising renters to lower it
would be a health risk. This was in an early draft of our spec and was removed.

---

## Validation

> 🎯 This section is the point. A small model shown working against real data beats a large one
> asserted.

**Method.** For each participating household we take the actual quarterly energy bill and the
appliance types, run them through the engine, and compare predicted annual cost against what
the household actually paid. We report **every** result, including the ones that miss.

`[PENDING — Sunday 09:00–11:00]`

| Household | Occupants | Hot water | Predicted | Actual | Error |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |

**Mean absolute percentage error: `[DERIVE-B]`**

⚠️ **This is a convenience sample** — households known to the team, not a random one. It tells
you the model is approximately right for real NSW homes; it does not tell you it generalises.

### Internal checks

The engine asserts these on every run (`tools/model.py`):

- `D_hp == D_res / COP` — catches a wrong MJ↔kWh conversion
- `S > 0` for gas → heat pump — catches an inverted tariff or efficiency
- `ΔEm > 0` on the NSW grid factor — not automatic; NSW electricity is carbon-intensive at
  0.67 kg/kWh, so this genuinely tests the result rather than assuming it
- The gas supply charge appears **exactly once** — the easiest double-count in the model
- `r < S/52` in every Offer C case — the tenant must be cash-positive every week

---

## The deal calculator

Quantifying the split incentive is only half the job. The letter closes it.

The tenant cannot write a cheque, but they control something the landlord wants and it costs
them nothing: **whether they stay.** A vacancy costs weeks of empty rent plus letting fees.

```
V = W × (v + f)        what a vacancy costs the landlord
G = I − V              the gap remaining after a longer lease is offered
```

| | Offer | Rent change |
|---|---|---|
| `I ≤ 0` | **A** — costs you nothing extra at replacement time | none |
| `V ≥ I` | **B** — a longer fixed term covers it on its own | **none** |
| `G < S × T_max` | **C** — split the saving, capped below it | `r = S/104` |
| otherwise | **D** — no honest deal; we show the gap | none |

**At realistic Sydney rents the answer is Offer B.** Five weeks of rent at $500/wk is $2,500
against an incremental cost of $2,000, so the lease alone closes the gap and **no rent rise is
ever proposed.**

Three invariants are hard-coded and not configurable:

1. **`r < S/52`** — any rent adjustment is strictly below the tenant's weekly saving. Without
   this, the tool is a rent-raising instrument wearing a climate costume.
2. **Tenant capital contribution is always zero.** Tenants move. They share ongoing savings
   only, so leaving costs them nothing. They never fund someone else's asset.
3. **If `I ≤ 0` or `V ≥ I`, then `r = 0`.** Never propose a rise that isn't needed.

**Offer D is a feature.** A model that reports when the numbers don't close is more credible
than one that always finds an answer.

---

## Running it

```bash
# The model, with sensitivities and all sanity checks — standard library only, no install
python tools/model.py

# A sample landlord letter with real numbers (2 occupants, $650/wk)
python tools/letter.py 2 650
```

The TypeScript engine (`src/engine.ts`) has **zero dependencies** and one entry point:

```ts
import { calculate } from "./engine";
const result = calculate(constants, tariffs, {
  occupants: 2, hotWaterFuel: "gas", isLastGasAppliance: true,
  heatPumpRate: "offPeak", weeklyRent: 650,
});
```

---

## Future work

> Everything here was consciously cut to protect the one flow that works. Listing it is the
> scope contract — if it is in this section, it is **not** in the build.

- **More states.** Victoria first: its hot water rebate excludes renters by design, which
  sharpens the thesis. The engine is already parameterised; it needs data, not code.
- **Postcode-level accuracy** — exact distributor zone and exact STC zone rating.
- Cooktop, space heating, insulation, solar, batteries, EV charging.
- Bill upload and OCR instead of five questions.
- A verified rebate table, once the ESS/STC amounts can be sourced primarily.
- Landlord-side asset value and rental premium, if a defensible Australian dataset ever exists.
- Saved comparisons, accounts, sharing — none of which the core argument needs.

---

## AI assistance

AI was used in building this project and is disclosed in full in
[`CREDITS.md`](./CREDITS.md), as Rule 9 requires. The model design, the formulas, the source
hierarchy and the decision to default contested inputs to zero are the team's own, written up
before the event began and implemented afterwards.
