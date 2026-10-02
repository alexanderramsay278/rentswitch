# P0 handover — engine + data layer

**Status as at 2026-10-02 ~10:00.** Alex's lane (data layer + dual-payback engine + letter) is
done for P0. This folder drops into the repo. Nothing here needs the UI to exist.

---

## What's in here

```
rentswitch/
├── CREDITS.md              first-commit requirement, already populated
├── data/
│   ├── constants.json      EVERY model constant, each with source + confidence tier
│   ├── tariffs.json        32 NSW residential plans, reduced from the CDR API
│   ├── cdr_raw/            raw cached API responses (provenance)
│   └── sources/            the government PDFs the numbers came from
├── src/
│   ├── engine.ts           the dual-payback model — Model Maths §2–§10
│   └── letter.ts           landlord letter generator — term sheet, not a request
└── tools/
    ├── fetch_cdr.py        pulls NSW residential plans from the AER CDR API
    ├── extract_tariffs.py  reduces them to data/tariffs.json
    ├── model.py            runnable reference implementation + §12 sanity checks
    └── letter.py           renders the letter with real numbers
```

## For the frontend/engine devs

`src/engine.ts` has **zero dependencies** and exports one entry point:

```ts
import { calculate } from "./engine";

const result = calculate(constants, tariffs, {
  occupants: 2,
  hotWaterFuel: "gas",
  isLastGasAppliance: true,   // drives the supply-charge saving — ask this
  heatPumpRate: "offPeak",    // default
  weeklyRent: 650,            // optional; unlocks the deal calculator
});
```

`result` gives you everything the results page needs, already split into the four Product Spec
§2 sections: `result.saving.total` (S), `result.landlord.incremental` (I),
`result.landlord.yearsOfTenantSaving` (I/S), `result.emissions`, `result.deal`,
and `result.warnings` (assumption strings — **render these, they're a scoring item**).

`src/letter.ts` takes the same result and returns the letter as a string. Copy button + download.

**Load `data/constants.json` and `data/tariffs.json` as static imports.** No API calls at runtime —
the CDR data is already cached. Do not build an ingester.

## Running the model without Node

Node is not installed on Alex's machine. `tools/model.py` is a working twin:

```
python tools/model.py        # full sweep + sensitivities + sanity checks
python tools/letter.py 2 650 # sample letter, 2 occupants, $650/wk
```

Both run on the Python standard library alone.

---

## Headline numbers (2-person NSW household, gas storage → heat pump)

| | |
|---|---|
| Tenant saving `S` | **$703/yr** |
| — of which gas supply charge | **$306/yr (44%)** |
| Landlord incremental `I` | **$2,000** (rebate defaulted to $0) |
| Split incentive `I/S` | **2.8 years** |
| Emissions | **−266 kg CO₂e/yr (−37%)** |

Every one of those traces to a named Australian government source. See `CREDITS.md`.

---

## Three things the team needs to decide

1. **The deal calculator returns OFFER B at every realistic Sydney rent.** Five weeks of rent
   ($2,500 at $500/wk) already exceeds the $2,000 incremental cost, so a longer fixed-term lease
   covers it on its own and no rent adjustment is ever proposed. Offer C only fires at low rents
   or high incremental costs. **This is a stronger story, not a weaker one** — "one avoided
   vacancy more than pays for it" beats a rent-split. But the [[Video Script]] deal branch should
   be written for B, not C.

2. **The rebate is the weakest input and is currently $0.** Today's searches returned installer
   and comparison sites only, which the research rules disqualify. With R = $0 the case already
   works (2.8-year payback), so this is not blocking — but a verified NSW ESS/HEER + STC figure
   would cut the payback to ~1.4 years at $1,000. ⚠️ **Do not present ESS and STCs as additive
   until someone confirms they stack** — in NSW the ESS discount may be net of assigned STCs.

3. **Node.js is not installed on Alex's machine.** Whoever owns the deploy pipeline should
   assume Alex cannot run or test the Next.js app locally. Either he installs Node, or the TS
   engine gets tested by a builder. The Python twin covers the *maths*, not the integration.

---

## Not done yet (P0 scope boundary)

- The five-question form and results page (builders)
- Wiring `engine.ts` into a Next.js route
- P1.5 deal calculator UI, P1 cooktop, P2 "Do now" — all Saturday per the Gameplan
- The three legal claims in the letter are **gated off** until verified Saturday 09:00
