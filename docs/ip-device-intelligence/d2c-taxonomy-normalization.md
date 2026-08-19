# Phase D2C — Normalized Device Atlas product taxonomy

Status: implemented on `claude/device-intelligence-d2c-taxonomy-normalization-v1` (base `9fd7838858b249654631f3d4152faf9ebb749119`), draft PR pending independent review. The first independent review returned **B. FAIL** (protected architecture passed; three medium user-facing semantic taxonomy defects plus five low findings), and one bounded correction pass (2026-08-19, D2C-REV-001…008 below) has been applied; the final independent review remains pending. Decision record: [decision-log.md](./decision-log.md), D-12.

## Why the source categories could not be the public taxonomy

The canonical `primary_category` / `subcategory` fields are governed **import provenance** — they carry whatever axis the source catalog was organized by. Across the 1,331-product atlas cohort the 33 source categories mix at least five different axes:

| Axis                            | Examples                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physical device class           | `Airway stent`, `Guidewire`, `Endobronchial valve`                                                                                                 |
| Device subtype                  | `EBUS sampling`, `Sampling accessory`                                                                                                              |
| Clinical application / workflow | `Airway stenting`, `Airway dilation`, `Airway isolation`, `Retrieval`, `Reprocessing`, `Pleurodesis`                                               |
| Procedure domain                | `Rigid bronchoscopy`, `Flexible bronchoscopy`, `Medical thoracoscopy`, `Pleural procedures`, `Therapeutic bronchoscopy`, `Peripheral bronchoscopy` |
| Platform / modality grouping    | `Bronchoscopy platform`, `Endoscopy platform`, `EBUS platform`, `Energy platform`, `Ultrasound platform`                                           |

The physician owner's production findings, all reproduced from the committed catalog and pinned as mandatory test regressions:

1. **`Guidewire` vs `Airway stenting`:** the Amplatz Super Stiff and Jagwire wires sat under `Guidewire`, while the two MAXXwire Guide Wires (180/260 cm) sat under `Airway stenting` — four physically similar guidewires split across two facets.
2. **`Airway stenting` mixed physical types:** it held the two MAXXwire guidewires _and_ the AEROSIZER Airway Sizing Device — a workflow bucket, not a device class.
3. **Bronchoscopes split by manufacturer:** Olympus reusable video bronchoscopes lived under `Flexible bronchoscopy`, Fujifilm's under `Bronchoscopy platform`, Olympus EBUS scopes under `EBUS platform`, Fujifilm EBUS scopes under `Bronchoscopy platform`, robotic scopes under `Peripheral navigation`.

Baseline audit of the cohort: 33 distinct `primary_category` values, 213 distinct `subcategory` values, 222 distinct (category, subcategory) pairs. Several pairs also mix physical types at the product level (e.g. `Rigid bronchoscope system` holds scope tubes, a head, ports, an injection cannula, and O-rings; the Micro-Tech straight-SEMS subcategory mixes covering variants; `Rigid bronchoscopy suction/accessory` holds suction tubes and cotton swabs).

## The four vocabularies, and what each answers

| Vocabulary               | Question it answers                      | Source                                                        |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------- |
| **Device class** (D2C)   | What kind of device is this, physically? | `deviceIntelligence.taxonomy.classes.*` over the D2C overlay  |
| **Device subtype** (D2C) | What specific normalized physical type?  | `deviceIntelligence.taxonomy.subtypes.*` over the D2C overlay |
| Clinical role            | What is it used for?                     | Governed `Product_Roles` links (unchanged)                    |
| Procedure                | Which procedures request that role?      | Governed procedure slots (unchanged)                          |

Clinical use is already represented by role and procedure, so applications ("Airway stenting") and procedure domains ("Flexible bronchoscopy") are barred from the class vocabulary by test. A device class is also never a manufacturer, brand family, single catalog family, or size/configuration difference.

## Controlled vocabulary

29 populated device classes (30 with the reserved `other_needs_review` fallback, currently empty), within the owner target of ~15–35; 140 controlled subtypes, each owned by exactly one class (`DEVICE_SUBTYPE_CLASS` in [product-taxonomy.ts](../../src/features/device-intelligence/domain/product-taxonomy.ts) is the single source of that relation). Cohort counts at this head:

| Class                | Products |     | Class               | Products |
| -------------------- | -------: | --- | ------------------- | -------: |
| airway_stent         |      233 |     | cryotherapy         |       18 |
| forceps_instrument   |      140 |     | valve_occluder      |       17 |
| pleural_drainage     |      137 |     | cytology_brush      |       16 |
| tracheostomy_tube    |      124 |     | implant_delivery    |       10 |
| electrosurgical      |      108 |     | catheter_sheath     |        8 |
| accessory            |      100 |     | powered_shaver      |        8 |
| bronchoscope         |       95 |     | specimen_collection |        7 |
| needle               |       48 |     | laser_system        |        6 |
| suction_irrigation   |       43 |     | retrieval_basket    |        5 |
| ultrasound_device    |       35 |     | sizing_measuring    |        5 |
| console_capital      |       31 |     | guidewire           |        4 |
| endoscopic_telescope |       30 |     | therapeutic_agent   |        4 |
| navigation_system    |       28 |     | delivery_applicator |        1 |
| balloon_dilation     |       25 |     | other_needs_review  |        0 |
| trocar_access        |       24 |     |                     |          |
| reprocessing         |       21 |     |                     |          |

Labels are localized in `messages/{en,es,zh-CN}.json` under `deviceIntelligence.taxonomy.*` with exact topology parity; codes never render.

## Classification method (deterministic, reviewable, no runtime LLM)

Everything is reproducible from two committed inputs:

- **Reviewed rules** — [`data/ip-device-intelligence/reviewed/product-taxonomy-rules.json`](../../data/ip-device-intelligence/reviewed/product-taxonomy-rules.json): 222 pair rules (one per (primary_category, subcategory) pair in the cohort — complete coverage by construction), 21 name rules (deterministic `product_name` regexes scoped to one exact pair, for the pairs that mix physical types), 0 product overrides today (the mechanism exists for owner corrections; committed overrides are validated against the current atlas cohort before generation — an unknown, candidate/unknown-grade, or owner-excluded id fails the build instead of riding along as a silent no-op).
- **Generator** — `npm run ip-intel:taxonomy-overlay` ([build-taxonomy-overlay.ts](../../scripts/ip-device-intelligence/build-taxonomy-overlay.ts)) evaluates, per cohort product, in fixed precedence: product override → first matching name rule → pair rule → explicit `other_needs_review` fallback (unused today; asserted zero). Output is the runtime overlay, byte-deterministic, rows sorted by product id, rules pinned by SHA-256; `--check` fails on staleness.

Permitted evidence is exactly what the rules read: `product_name` and the canonical category pair (plus, for a future override, a product id). Roles/procedures disambiguated nothing at this head and never substitute for physical class. AI assistance was used only to _author_ the reviewed rules during implementation; every committed row is reproducible from the rules file alone, and no AI inference is presented as source evidence.

### Classification basis codes

| Code                 | Meaning                                   |  Rows |
| -------------------- | ----------------------------------------- | ----: |
| `pair_rule`          | Reviewed (category, subcategory) mapping  | 1,263 |
| `name_rule`          | Reviewed name pattern within one pair     |    68 |
| `product_override`   | Reviewed per-product assignment           |     0 |
| `unmatched_fallback` | No rule matched (honest degradation path) |     0 |

### Confidence semantics

`high` (1,232) / `moderate` (98) / `needs_review` (1) is **review metadata only**. It never affects visibility, searchability, role or procedure membership, market/safety display, or any recommendation gate — the schema enforces `needs_review = true` whenever confidence is `needs_review`, and tests assert flagged products stay fully visible and searchable. Per the owner's error preference, ambiguous products get the most plausible broad class (`moderate`) rather than being forced into `Other`: the single `needs_review` row is the GenCut Core Biopsy System (a core sampling device inside a forceps-dominated subcategory), assigned the broad `needle` class pending owner review.

## Runtime overlay

[`data/ip-device-intelligence/generated/product-taxonomy-overlay.json`](../../data/ip-device-intelligence/generated/product-taxonomy-overlay.json) — 1,331 rows, ~345 KB, prettier-ignored (byte-deterministic), validated by a **closed** zod schema ([taxonomy-overlay-schema.ts](../../src/features/device-intelligence/domain/taxonomy-overlay-schema.ts)) on generation and again at runtime. Rows carry controlled codes only: `product_id`, `device_class_code`, `device_subtype_code`, `taxonomy_confidence`, `needs_review`, `classification_basis`. No free-text rationale, no source-category copy, no label text. The overlay is imported by `server/product-taxonomy.server.ts` (`server-only`) and never crosses to the client; label keys are derivable from codes (`deviceIntelligence.taxonomy.classes.<code>`), so they are not duplicated per row.

Row scope is the D2B inclusion-first cohort (`verified_source` minus explicit owner exclusions), filtered through the same `isAtlasCohortProduct` predicate as the atlas store: candidate/unknown identities cannot enter the artifact, and taxonomy state can never change atlas membership — `getProductTaxonomy` is total, and a hypothetical missing row degrades to the visible `other_needs_review` fallback.

## Owner correction workflow

1. Find the row in [`d2c-review/taxonomy-review-full.csv`](./d2c-review/taxonomy-review-full.csv) (or the needs-review / class-changed subsets).
2. Record the correction as a `product_overrides` entry (per product) or amend the pair/name rule (per group) in the reviewed rules file; overrides always win.
3. `npm run ip-intel:taxonomy-overlay && npm run ip-intel:d2c-review`, commit both regenerated artifacts; `--check` and the coverage tests hold the line.

Review subsets at this head: **1** needs-review product; **338** products whose normalized class differs from the majority class of their source category (`taxonomy-review-class-changed.csv` — the products the normalization actually moved); **12** source categories split into ≥2 normalized classes; **20** normalized classes assembled from ≥2 source categories.

## What D2C changed in the atlas UI — and what it preserved

- The **Category** facet (exact `primary_category` match) is replaced by **Device class** (normalized codes, localized labels, cohort counts). A stale `?category=` or `?subcategory=` link is reported with an honest replacement notice and _not applied_; an unknown `deviceClass` value gets the standard unknown-filter notice. Manufacturer, Clinical role, and Procedure facets are unchanged.
- The **Kind / category** table column became **Device type**, showing the normalized subtype label.
- Atlas **search** additionally matches normalized class/subtype labels in all three locales ("guidewire", "EBUS bronchoscope", "sizing device", "支气管镜") by deterministic token/substring matching; matched cohorts join the candidate list _after_ exact-identifier and fuzzy matches, so exact catalog-number behavior is byte-for-byte preserved. When the normalized query **exactly equals a controlled class label** in any locale, taxonomy expansion adds that class only and never also expands through subtype-label substring matches (D2C-REV-004) — so the exact zh-CN class label 支气管镜 returns exactly the 95 Bronchoscope-class products instead of 235 products swept in by subtype labels that merely contain the phrase.
- **Product detail** leads with Device class / Device subtype; canonical `primary_category` / `subcategory` / `product_kind` moved into an explicitly labeled "Source catalog classification" provenance area with the no-equivalence caption.
- Admin module labels updated to durable beta wording (`src/lib/non-public-modules.ts`); routes stay public-unlisted + noindex, out of navigation.

**Canonical fields preserved:** `catalog-products.json` (and every canonical `primary_category`/`subcategory` value), verification grades, visibility states, slot selectability, product-role and procedure-role links, compatibility rules, the market/safety overlay, and published release artifacts are all byte-identical. Inclusion is unaffected: the cohort remains exactly 1,331 / 200 candidate-excluded / 1 unknown-excluded / 0 owner exclusions. Shared class membership is a discovery grouping only — never equivalence, substitution, compatibility, formulary membership, or orderability, and no product-role link was added, removed, or inferred from taxonomy.

## Known needs-review queue

| Product                                      | Assigned                        | Why flagged                                                                                                                                          |
| -------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| GenCut Core Biopsy System (`PRD-5E5E5933A2`) | `needle` / `core_biopsy_device` | Core sampling device inside the "Navigation-compatible biopsy device" subcategory; broad class plausible, exact physical type for owner confirmation |

Softer review candidates (assigned `moderate`, not flagged): the 98 moderate-confidence rows in `taxonomy-review-full.csv`, dominated by mixed accessory pairs (`Rigid bronchoscope accessory/system`, `Platform accessory`), the ERBE CO2/gas items split between electrosurgical and cryotherapy, and the Fujifilm/Olympus therapeutic-model name rules.

## Independent-review corrections (2026-08-19)

The first independent review returned **B. FAIL**: the protected architecture passed, but three medium user-facing semantic taxonomy defects and five low findings required one bounded correction pass. All eight were corrected here; the nonblocking count-map hardening observation was deliberately **not** pursued (the generator recomputes counts, the committed `--check` gates reconcile them, and runtime never trusts caller-supplied count maps). The pass moved exactly **21** of 1,331 rows; every role and procedure code is unchanged for all 1,331 products (verified by diffing `taxonomy-review-full.csv` before/after).

- **D2C-REV-001 — retrieval forceps and baskets.** The mixed `retrieval_device` class (7 forceps + 3 baskets) is retired. The seven flexible foreign-body grasping forceps are now `forceps_instrument` / `foreign_body_grasping_forceps` (physically forceps; retrieval use stays in the governed role/procedure facets — materially analogous rigid foreign-body forceps were already `forceps_instrument` with rigid/optical subtypes). All five physical baskets — the two Zero Tip Airway Retrieval Baskets, the Mini Grasping Basket (`PRD-C2CB78AC4C`, no longer typed as forceps), and the two rigid Foreign Body Baskets (`PRD-212BC58910`, `PRD-A2FCA81CFA`, no longer generic accessories) — share the new coherent class `retrieval_basket` / `foreign_body_retrieval_basket`. Documented exception: the Wire Basket for the ERBECRYO 2 Cart (`PRD-913352C891`) is a storage basket on capital equipment, not a patient-facing retrieval instrument, and stays `cryotherapy` / `cryotherapy_accessory`. The two Retrieval-category nets are candidate-grade and outside the atlas cohort.
- **D2C-REV-002 — the aspiration/irrigation source pair splits by physical type.** Within the exact pair `Rigid bronchoscopy » Bronchoscopy aspiration/irrigation accessory` (8 products): the Angled and Straight Aspiration Biopsy Needles (`PRD-2F1A67DE53`, `PRD-DF989CBDCB`) are now `needle` / `aspiration_biopsy_needle`; the Single-Use Plastic Collection Device (`PRD-129E6C270A`) is now `specimen_collection` / `specimen_trap`; the two aspirators, two HUZLY suction tubes, and the HUZLY aspirator/irrigator remain `suction_irrigation` / `rigid_suction_catheter`. Implemented as exact-pair-scoped name rules, never a broadened regex.
- **D2C-REV-003 — pleurodesis agent versus delivery instrument.** The mixed `pleurodesis_agent` class (label "Pleurodesis agent or applicator") is retired; no class label unions agent with applicator anymore. The three STERITALC vials are `therapeutic_agent` / `sterile_talc`; the reusable Optical Powder Blower (`PRD-D14312CC6A`) is `delivery_applicator` / `powder_blower`. **Dominant-identity decision for the disposable kit:** the STERITALC PF3 Poudrage Kit (`PRD-D1DCE936D2`) is named and dosed by its 3 g talc content, sits in the same STERITALC family as the F2/F4 vials, and is refilled by the PF3 Supplement Vial sold under `Sterile talc vial` — the sold item's dominant catalog identity is the talc agent, so it is `therapeutic_agent` / `talc_poudrage_kit` (also recorded in the reviewed rule's note). Clinical pleurodesis role/procedure membership is untouched.
- **D2C-REV-004 — exact class-label search precedence.** See the search bullet above; regression-tested in en/es/zh-CN, with fuzzy product-name behavior, additive non-exact taxonomy search, and exact catalog-number ordering all preserved.
- **D2C-REV-005 — stale subcategory notice.** A stale `?subcategory=` URL now renders the same honest replacement notice as `?category=` and is never silently applied on the atlas (canonical preference-card subcategory filtering unchanged).
- **D2C-REV-006 — override validation.** Committed `product_overrides` are validated against the loaded current atlas cohort before generation in both generators; unknown canonical ids (e.g. `PRD-0000000000`), candidate/unknown-grade ids, and owner-excluded ids fail the build with the reason, duplicates fail the rules schema, and a valid override is proven to change exactly one generated row.
- **D2C-REV-007 — literal NUL.** The pair-rule dedup delimiter in `taxonomy-overlay-schema.ts` is now the reviewable source escape `\u0000` instead of a raw NUL byte; runtime semantics are identical (split-vs-duplicate pair keys regression-tested) and Git treats the file as ordinary text.
- **D2C-REV-008 — suction catheter subtype.** The Suction Catheter 5 Fr, Pack of 6 (`PRD-D7A7620198`) now shares `rigid_suction_catheter` with the analogous 5/6/7 Fr "with Adapter" catheters via a narrow name rule; the three "Adapter for … Fr" products remain `suction_accessory`.
