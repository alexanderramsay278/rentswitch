# CREDITS — Rentswitch

Climate Hack-tion 2026 · Team **PPC Fans** · Track: **Electrification**

Rule 9 requires everything disclosed — libraries, APIs, datasets, assets, paid tools, and AI
assistance. This file was created in the first commit and is updated as things are added.
**Last updated: 2026-10-02.**

---

## Data sources

### AER Consumer Data Right — Energy Product Reference Data API
Live retail electricity and gas tariffs. Regulator-served, no API key, no accreditation.
- Endpoint: `https://cdr.energymadeeasy.gov.au/{brand}/cds-au/v1/energy/plans`
- **Version gotcha:** LIST requires header `x-v: 1`; DETAIL requires `x-v: 3`. The other returns HTTP 406.
- Retrieved **2026-10-02**. Filtered to `customerType=RESIDENTIAL`, postcode 2088 (Mosman NSW), `effective=CURRENT`.
- 190 matching NSW plans found; 32 cached in full to `data/cdr_raw/` and reduced to `data/tariffs.json`.
- Default plan used by the model: **AGL Residential Standing Offer** (electricity `AGL1189640SRE1@EME`, Ausgrid; gas `AGL1055990SRG3@EME`, Jemena) — chosen because the Standing Offer is the *regulated reference offer*, not a marketing plan.
- **Units verified against live responses:** electricity `$/kWh`, gas `$/MJ`, supply charges `$/day`. These are dollars, not cents.
- Licence: see the AER / CDR terms on the source. ⬜ **TO DO: copy the exact licence line from the source page.**

### DCCEEW — Australian National Greenhouse Accounts Factors 2026
Emission factors. Published August 2026.
- `https://www.dcceew.gov.au/sites/default/files/documents/national-greenhouse-accounts-factors-2026.pdf`
- **Table 1 (p.10)** — NSW/ACT purchased electricity: scope 2 = **0.60**, scope 3 = **0.07** kg CO₂-e/kWh.
- **Table 5 (p.19)** — natural gas distributed in a pipeline, scope 1 combined = **51.53** kg CO₂-e/GJ.
- **Table 6 (p.20)** — NSW/ACT metro, natural gas scope 3 = **13.1** kg CO₂-e/GJ.
- Transcribed by hand from the published PDF. No PDF parser was written.
- **Licence: CC BY 4.0** (stated on p.2 of the document). Attribution as required: *DCCEEW 2026, Australian National Greenhouse Accounts Factors, Department of Climate Change, Energy, the Environment and Water, Canberra, August. CC BY 4.0.*

### DCCEEW / E3 Program — Decision Regulation Impact Statement: Heat Pump Water Heaters (April 2026)
Installed costs and the regulatory efficiency floor.
- `https://www.energyrating.gov.au/sites/default/files/2026-04/DRIS%20Energy%20efficiency%20policy%20options%20for%20heat%20pump%20water%20heaters.pdf`
- **Table 20 (p.84)** — purchase *and* installation costs, Australia (AUD): heat pump **$4,200**; gas storage **$2,200**; gas instantaneous **$1,800**; electric storage medium **$1,800**.
- **Table 19 (p.72)** — MEPS "set at equivalent of **60% savings in Zone 3** for HPWH in 2026". Our COP is derived from this, not taken from a vendor.
- Licence: ⬜ **TO DO: copy the exact licence line from the source page.**

### NSW DCCEEW / Office of Energy and Climate Change — ESS Hot Water Rule Change consultation (Sept 2023)
Hot water demand assumption.
- `https://www.energy.nsw.gov.au/sites/default/files/2023-09/NSW-ESS-Hot-Water-Consultation-September-2023.pdf`
- **Slide 11** — ESS modelling used **45 litres per person per day**.
- **Slide 10** — the current rule baseline uses 60 L/person/day from AS/NZS 4234:2008, and NSW states the standard's reference consumption "is not appropriate for continued use as the baselines". We model 45 and run 60 as a sensitivity.
- Also establishes NSW heat-pump climate zones **HP3-AU** / HP5-AU, and activity **D19** (replace a gas water heater with an air source heat pump) — the exact activity this tool models.
- Licence: ⬜ **TO DO: copy the exact licence line from the source page.**

### energyrating.gov.au (Australian Government E3 Program) — gas water heaters
- Gas storage water heater efficiency **55%**, based on Zone 3 and AS/NZS 4234, medium load.
- Licence: ⬜ **TO DO: copy the exact licence line from the source page.**

### Legal and tax sources — verified 2026-10-02, used in the letter
- **Residential Tenancies Act 2010 (NSW), s62 and s64** — a failure or breakdown of an essential service for hot water is an **urgent repair**. Restated in NSW Fair Trading guidance, *Urgent repairs in residential rental properties*. `https://www.nsw.gov.au/housing-and-construction/rules/urgent-repairs-residential-rental-properties`
- **NSW Fair Trading / nsw.gov.au — rent increases.** Once per 12 months, all lease types, minimum 60 days written notice; in force from 31 October 2024. Not quoted in the letter; constrains Offer C only.
- **ATO, *Depreciating assets in rental properties* (QC 103906).** *"In most cases you can't claim a deduction for second-hand depreciating assets after 1 July 2017"* and *"New assets — You can claim the decline in value of new depreciating assets."* Hot water systems: effective life **12 years** (gas/electric, acquired from 1 July 2004). `https://www.ato.gov.au/individuals-and-families/investments-and-assets/property-and-land/residential-rental-properties/rental-expenses/depreciating-assets-in-rental-properties`
  > ⚠️ Used as a **narrative pointer only**. No tax figure is computed anywhere in this repo, and no eco-specific deduction is implied — none was found to exist.

### Not used in the model as at 2026-10-02
- ABS 2021 Census housing tenure (29.5% of households rent) — used in the *narrative*, not the model.
- **NSW ESS/HEER rebate amounts and federal STC values** — ⚠️ **dollar figures not obtained from any primary source.** Consumer-facing NSW incentive pages are JavaScript-rendered; every other result was an installer or comparison site, which this project does not cite. **The model defaults the rebate to `R = $0`** rather than assert an unverified figure. Verified *conditions* (activity D19, the 60% minimum saving, HP3-AU zone, 12-year life, CER register and 12-month STC window) are recorded in `data/constants.json` → `rebates`.

---

## Standards referenced (not reproduced)
- **AS/NZS 4234** *Heated water systems — Calculation of energy consumption*. Paywalled; **not purchased, not reproduced.** Referenced only as cited by the Australian and NSW government documents above.
- **AS/NZS 5125.1:2014**, **AS/NZS 2712:2007** — referenced in the DRIS, not used directly.

---

## Frameworks, services and libraries
- **Python 3.14** (standard library only — `json`, `urllib`, `os`, `sys`, `time`) — data fetching, model reference implementation, validation.
- **Next.js 16** (App Router) — MIT licence. The frontend framework; `src/engine.ts` and `src/letter.ts` were dropped in unmodified.
- **React 19** / **react-dom 19** — MIT licence. UI runtime Next.js is built on.
- **TypeScript 5** — Apache 2.0 licence. Type-checks the whole frontend, including the adapter between `data/*.json` and `engine.ts`'s types.
- **Tailwind CSS 4** (with `@tailwindcss/postcss`) — MIT licence. All styling; no component library used.
- **ESLint 9** with `eslint-config-next` — MIT licence. Lint only, not shipped.
- **@types/node, @types/react, @types/react-dom** — MIT licence. Type definitions only, not shipped.
- **Vercel** — hosting, zero-config deploy from this repo.

> No third-party Python packages were used. No PDF parsing library was used. No database, auth
> provider, state-management library or UI component library was added to the frontend — this
> was a deliberate scope decision, not an oversight.

---

## AI assistance

**AI was used, and is disclosed here in full, as Rule 9 requires.** The organisers' ruling
(Terence Huynh, 29 Sep) permits AI provided everything used is listed.

- **Claude (Anthropic)**, via Claude Code, used on **2026-10-02** for:
  - writing the CDR API fetch and extraction scripts (`tools/fetch_cdr.py`, `tools/extract_tariffs.py`)
  - locating and reading the government source documents listed above
  - implementing the dual-payback model from the team's own pre-written specification
    (`Product Spec` §3 and `Model Maths` §2–§10, both authored by the team before the event
    as planning documents, which Rule 6 permits)
  - drafting the first version of the landlord letter copy
- **The model design, the formulas, the source hierarchy and the decision to default the
  rebate and asset-value inputs to zero are the team's own**, written up before the event
  started and implemented afterwards.
- All figures were checked against the primary documents cited above. Every numeric claim in
  this repo traces to a named government source or is explicitly labelled an assumption in
  `data/constants.json`.

---

## Assets
- ⬜ None yet. Any icon, font, image or audio added later gets listed here with its licence.
