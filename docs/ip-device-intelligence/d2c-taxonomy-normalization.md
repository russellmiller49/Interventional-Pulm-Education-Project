# Phase D2C — Normalized Device Atlas product taxonomy

Status: implemented on `claude/device-intelligence-d2c-taxonomy-normalization-v1` (base `9fd7838858b249654631f3d4152faf9ebb749119`), draft PR pending independent review. Decision record: [decision-log.md](./decision-log.md), D-12.

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

28 populated device classes (29 with the reserved `other_needs_review` fallback, currently empty), within the owner target of ~15–35; 138 controlled subtypes, each owned by exactly one class (`DEVICE_SUBTYPE_CLASS` in [product-taxonomy.ts](../../src/features/device-intelligence/domain/product-taxonomy.ts) is the single source of that relation). Cohort counts at this head:

| Class                | Products |     | Class               | Products |
| -------------------- | -------: | --- | ------------------- | -------: |
| airway_stent         |      233 |     | cryotherapy         |       18 |
| pleural_drainage     |      137 |     | valve_occluder      |       17 |
| forceps_instrument   |      133 |     | cytology_brush      |       16 |
| tracheostomy_tube    |      124 |     | implant_delivery    |       10 |
| electrosurgical      |      108 |     | retrieval_device    |       10 |
| accessory            |      102 |     | catheter_sheath     |        8 |
| bronchoscope         |       95 |     | powered_shaver      |        8 |
| needle               |       46 |     | laser_system        |        6 |
| suction_irrigation   |       46 |     | specimen_collection |        6 |
| ultrasound_device    |       35 |     | pleurodesis_agent   |        5 |
| console_capital      |       31 |     | sizing_measuring    |        5 |
| endoscopic_telescope |       30 |     | guidewire           |        4 |
| navigation_system    |       28 |     | other_needs_review  |        0 |
| balloon_dilation     |       25 |     |                     |          |
| trocar_access        |       24 |     |                     |          |
| reprocessing         |       21 |     |                     |          |

Labels are localized in `messages/{en,es,zh-CN}.json` under `deviceIntelligence.taxonomy.*` with exact topology parity; codes never render.

## Classification method (deterministic, reviewable, no runtime LLM)

Everything is reproducible from two committed inputs:

- **Reviewed rules** — [`data/ip-device-intelligence/reviewed/product-taxonomy-rules.json`](../../data/ip-device-intelligence/reviewed/product-taxonomy-rules.json): 222 pair rules (one per (primary_category, subcategory) pair in the cohort — complete coverage by construction), 16 name rules (deterministic `product_name` regexes scoped to one exact pair, for the pairs that mix physical types), 0 product overrides today (the mechanism exists for owner corrections).
- **Generator** — `npm run ip-intel:taxonomy-overlay` ([build-taxonomy-overlay.ts](../../scripts/ip-device-intelligence/build-taxonomy-overlay.ts)) evaluates, per cohort product, in fixed precedence: product override → first matching name rule → pair rule → explicit `other_needs_review` fallback (unused today; asserted zero). Output is the runtime overlay, byte-deterministic, rows sorted by product id, rules pinned by SHA-256; `--check` fails on staleness.

Permitted evidence is exactly what the rules read: `product_name` and the canonical category pair (plus, for a future override, a product id). Roles/procedures disambiguated nothing at this head and never substitute for physical class. AI assistance was used only to _author_ the reviewed rules during implementation; every committed row is reproducible from the rules file alone, and no AI inference is presented as source evidence.

### Classification basis codes

| Code                 | Meaning                                   |  Rows |
| -------------------- | ----------------------------------------- | ----: |
| `pair_rule`          | Reviewed (category, subcategory) mapping  | 1,270 |
| `name_rule`          | Reviewed name pattern within one pair     |    61 |
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

Review subsets at this head: **1** needs-review product; **335** products whose normalized class differs from the majority class of their source category (`taxonomy-review-class-changed.csv` — the products the normalization actually moved); **11** source categories split into ≥2 normalized classes; **20** normalized classes assembled from ≥2 source categories.

## What D2C changed in the atlas UI — and what it preserved

- The **Category** facet (exact `primary_category` match) is replaced by **Device class** (normalized codes, localized labels, cohort counts). A stale `?category=` link is reported with an honest replacement notice and _not applied_; an unknown `deviceClass` value gets the standard unknown-filter notice. Manufacturer, Clinical role, and Procedure facets are unchanged.
- The **Kind / category** table column became **Device type**, showing the normalized subtype label.
- Atlas **search** additionally matches normalized class/subtype labels in all three locales ("guidewire", "EBUS bronchoscope", "sizing device", "支气管镜") by deterministic token/substring matching; matched cohorts join the candidate list _after_ exact-identifier and fuzzy matches, so exact catalog-number behavior is byte-for-byte preserved.
- **Product detail** leads with Device class / Device subtype; canonical `primary_category` / `subcategory` / `product_kind` moved into an explicitly labeled "Source catalog classification" provenance area with the no-equivalence caption.
- Admin module labels updated to durable beta wording (`src/lib/non-public-modules.ts`); routes stay public-unlisted + noindex, out of navigation.

**Canonical fields preserved:** `catalog-products.json` (and every canonical `primary_category`/`subcategory` value), verification grades, visibility states, slot selectability, product-role and procedure-role links, compatibility rules, the market/safety overlay, and published release artifacts are all byte-identical. Inclusion is unaffected: the cohort remains exactly 1,331 / 200 candidate-excluded / 1 unknown-excluded / 0 owner exclusions. Shared class membership is a discovery grouping only — never equivalence, substitution, compatibility, formulary membership, or orderability, and no product-role link was added, removed, or inferred from taxonomy.

## Known needs-review queue

| Product                                      | Assigned                        | Why flagged                                                                                                                                          |
| -------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| GenCut Core Biopsy System (`PRD-5E5E5933A2`) | `needle` / `core_biopsy_device` | Core sampling device inside the "Navigation-compatible biopsy device" subcategory; broad class plausible, exact physical type for owner confirmation |

Softer review candidates (assigned `moderate`, not flagged): the 98 moderate-confidence rows in `taxonomy-review-full.csv`, dominated by mixed accessory pairs (`Rigid bronchoscope accessory/system`, `Platform accessory`), the ERBE CO2/gas items split between electrosurgical and cryotherapy, and the Fujifilm/Olympus therapeutic-model name rules.
