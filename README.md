# Rentswitch

> Shows renters the cheapest bill and emissions cuts they can make without touching the
> building — and writes the landlord business case for the ones they can't.

**Climate Hack-tion 2026** · Challenge: **Electrification** (35% by 2035) · Team **PPC Fans**
**Live: https://rentswitch.vercel.app** · Demo video: `[link — added Sunday]`

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

Built and validated first for **New South Wales**: NSW tariffs, NSW Energy Savings Scheme rules,
NSW emissions factor. **Every other state the survey offers is now modelled too**: Victoria,
Queensland, South Australia, the ACT and Tasmania. Each runs through the same engine with only
its own tariffs and emissions factors changed, which proved the claim that adding a state is
data, not a rewrite.

| 2 people, gas storage → heat pump | Saving/yr | Payback | Emissions cut | Grid (kg CO₂e/kWh) |
|---|---|---|---|---|
| New South Wales | $703 | 2.8 yrs | 266 kg (37%) | 0.67 |
| Victoria | $799 | 2.5 yrs | 40 kg (6%) | 0.85 |
| Queensland | $875 | 2.3 yrs | 156 kg (23%) | 0.76 |
| South Australia | $799 | 2.5 yrs | 535 kg (76%) | 0.24 |
| ACT | $710 | 2.8 yrs | 266 kg (37%) | 0.67 |
| Tasmania | not priced | | | 0.26 |

**The finding.** The bill saving changes by up to about a quarter between states, from $703 a
year in NSW to $875 in Queensland. The emissions cut changes far more, from 6% in Victoria to 76%
in South Australia, because it depends mostly on the grid and partly on each state's upstream
gas factor. At the minimum compliant heat pump efficiency the same switch
cuts three quarters of the hot water's emissions in South Australia and six per cent in
Victoria. That is what the government factors say, and we report it rather than hide it.

**Tasmania's gas case is not priced.** No residential gas standing or regulated offer covers
Hobart in the CDR data, and DCCEEW's Table 6 gives "C" instead of a value for Tasmania's
scope 3 gas factor, so no upstream gas factor is published.
Its electric tank case is priced: $160/yr saved and 268 kg CO₂e/yr cut (60%).

**How each state's data was chosen** (all recorded in `data/constants_<state>.json`):

- **Tariffs:** the AER CDR reference offer for each capital city (postcodes 2088, 3000, 4000,
  5000, 2600, 7000): AGL's standing offer in Sydney, Melbourne, Brisbane and Adelaide,
  ActewAGL's in Canberra, Aurora Energy's regulated offer in Hobart. Read straight from the raw
  API responses by `src/lib/cdr.ts`, which reproduces the NSW and Victorian tariffs exactly.
- **Heat pump rate:** the rate in force at 03:00 on a weekday, the overnight window a timer
  targets. Brisbane and Adelaide also have a cheaper midday rate; we do not use it.
- **Emissions:** DCCEEW NGA Factors 2026, Tables 1, 5 and 6, read from the official XLSX via its
  archived copy, transcribed three times independently and audited. ACT shares NSW's rows.
- **Efficiencies:** the Sydney-climate (Zone 3) values in every state, stated on every result
  outside NSW. Not adjusted for colder or warmer climates.
- **Rebates:** zero everywhere. Outside NSW the only scheme the letter says applies is Small
  scale Technology Certificates, a Commonwealth scheme (the Victorian letter also says Solar
  Homes does not cover rentals), and the letter drops the NSW tenancy-law claim.

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

> This section is the point. A model shown working against real data beats a larger one
> asserted. We ran the external check we could run, and it did not pass cleanly — so that is
> what is reported here.

### External check — AER metered benchmarks

**Source.** AER, *Residential energy consumption benchmarks*, 9 December 2020 (Frontier
Economics), **Table 30: New South Wales gas consumption benchmarks (MJ)**. NSW gas sample:
**1,062 real metered households.** This is the dataset behind the "households like yours" box
on every Australian energy bill. Reproduce it with `python tools/validate_aer.py`.

**What this is, and what it is not.** The AER figure is *total* household gas — hot water plus
cooking plus space heating. Our model covers hot water only. So this is **not** a
predicted-versus-actual accuracy test and we do not claim an error percentage from it. It
answers two falsifiable questions instead.

**Test 1 — plausibility.** Is our modelled hot water a believable share of the gas a real
household of that size actually uses?

| Occupants | AER total gas (MJ/yr) | Our modelled hot water (MJ/yr) | Share | Verdict |
|---|---|---|---|---|
| 1 | 9,835 | 5,625 | 57% | plausible |
| 2 | 16,945 | 11,251 | 66% | plausible |
| 3 | 19,978 | 16,876 | 84% | high |
| 4 | 24,160 | 22,502 | 93% | **implausible** |
| 5+ | 28,799 | 28,127 | 98% | **implausible** |

**Test 2 — scaling.** Our model assumes demand is linear in occupants. Real households are not.

| Occupants | AER actual | Our model | We over-predict by |
|---|---|---|---|
| 1 | 1.00x | 1.00x | — |
| 2 | 1.72x | 2.00x | 16% |
| 3 | 2.03x | 3.00x | 48% |
| 4 | 2.46x | 4.00x | 63% |
| 5+ | 2.93x | 5.00x | **71%** |

### The finding, stated plainly

**The model is reliable for 1–2 person households and increasingly overstates the saving above
that.** At five occupants it implies 98% of all household gas goes to hot water, which cannot
be true.

**Cause.** We assume hot water scales linearly with occupants, because the NSW Energy Savings
Scheme's own modelling uses a flat 45 L/person/day. Real metered households are strongly
sub-linear: five people use 2.93x a one-person household, not 5.00x. Households share
dishwashing, laundry and space heating even though they do not share showers.

**Consequence.** Our worked example is a two-person household, which sits inside the defensible
range. Beyond two occupants the results page quotes **one conservative figure** for the saving
and the payback: hot water demand is scaled to the AER metered ratios above (2.03x at three
people, 2.46x at four). Because those ratios cover *total* household gas, that figure is a floor,
not a calibration, and the page says so, stating the straight model's higher figure alongside.
The headline, breakdown, deal and letter all use the same conservative figure.
Calibrating the per-person curve against hot-water-only metered data is still future work.

> We would rather publish the limit we found than an accuracy figure we did not measure.

### Per-household check — not completed

| Household | Occupants | Hot water | Predicted | Actual | Error |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

Comparing predicted annual cost against individual households' actual bills was planned and
**was not completed** — we could not collect a usable sample inside the event. The one bill
offered was a final bill for a vacant property (2.41 kWh/day against 21.62 the previous year),
which would have produced a meaningless error figure, so it was excluded rather than used.

**No accuracy percentage is claimed anywhere in this project.** The external check above is a
plausibility and scaling test against regulator data, and it is described as exactly that.

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

- **More states.** Every state the survey offers is modelled. Western Australia and the
  Northern Territory are not in the survey yet.
- **Climate-adjusted efficiencies** for colder and warmer capitals, once the heat pump RIS
  zone tables can be read.
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
