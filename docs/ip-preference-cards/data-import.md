# IP preference-card catalog import

## Source and commands

The v0.1 source workbook is:

```text
Preference_card_module/IP_Procedure_Equipment_Catalog_v0_5_with_GUDID_Verification_Backlog.xlsx
```

Run the deterministic pipeline from the repository root:

```bash
npm run ip-cards:import
npm run ip-cards:coverage
npm run ip-cards:scenarios
npm run ip-cards:validate-data
npm run ip-cards:seed
```

The importer reads headers from Excel row 4, begins records on row 5, and writes normalized server-side JSON to `data/ip-preference-cards/generated/`. It never parses the workbook in the browser, mutates `verification_status` or `live_dropdown_status`, or copies a suggested GUDID identifier into a canonical product.

## Current workbook result

Workbook SHA-256:

```text
fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf
```

| Dataset                       |  Rows |
| ----------------------------- | ----: |
| Workbook products             | 1,221 |
| Product roles                 | 1,268 |
| Procedures                    |    13 |
| Procedure slots               |   174 |
| Authored slot product options | 2,080 |
| Roles                         |    98 |
| Raw compatibility evidence    |   179 |
| Manufacturers                 |    28 |
| Sources                       |    46 |
| Product sources               | 1,366 |
| Formulary staging             | 1,221 |
| Modifier catalog              |    30 |
| Verification backlog          | 1,221 |

The importer then merges 311 reviewed rows from `seed/catalog-additions.json`, producing 1,532
products in `generated/catalog-products.json`: 779 are hidden and 753 are prototype-visible. The
workbook-backed verification backlog and formulary staging remain 1,221 rows; additions do not
fabricate local decisions. The linked
[`openfda-live-calibration-report.md`](./openfda-live-calibration-report.md) preserves the earlier
1,221 + 253 = 1,474 calibration snapshot and its duplicate audit as historical evidence; it is
not the current catalog reconciliation.

The current supplied workbook has 80 non-null GTIN values, and all 80 are already represented as 14-character strings. This differs from the older measured pattern quoted in the build brief. The importer validates the file actually supplied: it preserves leading zeros, reports non-14-digit values, and never truncates or rounds. The regression fixture confirms `08714729986225` and leading-zero catalog number `02841S` survive exactly.

## Normalization and precedence

- Blank cells become `null`; identifier fields remain strings.
- `Single` and `Single select` both become `single`.
- Unrecognized product visibility values fail closed to `hidden`.
- Product-level visibility is authoritative; the restrictive value wins if a slot-option flag disagrees.
- Raw verification text is preserved, with a coarse derived state of `verified_source`, `candidate`, or `unknown`.
- Raw compatibility endpoints remain free text. Exact canonical matches are enriched, while unresolved model/catalog strings remain untouched.
- Strict workbook foreign keys fail the import when broken.
- Every authored slot option must use its slot's role and have the same exact
  `Product_Roles` relationship.
- Import output and reporting are stable and idempotent for the same workbook bytes.

## Authored options and unreviewed proposals

The source workbook carries 2,080 `Slot_Product_Options` rows. The governed proposal overlay
removes 31 semantically invalid relationships and adds ten reviewed installed-base alternatives.
The completed-review implementation then removes four reviewer-rejected generic options and
adds 18 clinician-reviewed drainage options, producing 2,073 options at that historical
milestone. Later owner-review corrections removed 38 duplicate IPC assignments while retaining
the corresponding IPC-placement sets, producing 2,035 current canonical exact-slot options.
Import does not promote every product sharing the slot's broad role into that file. Instead,
`derive-slot-option-proposals.ts` writes a separate deterministic review artifact:

```text
data/ip-preference-cards/generated/slot-product-option-proposals.json
```

The current artifact has 831 unreviewed pairs and zero exclusions. The pre-remediation 475-row
queue and the earlier 429-row completed-review queue are historical snapshots. Every current
proposal is nonselectable and hidden by default. Exceptions in
`seed/slot-option-exceptions.json` are Zod-validated, exact, proposal-only suppressions; stale
or contradictory exceptions fail generation. See
[`catalog-role-and-slot-semantics.md`](./catalog-role-and-slot-semantics.md).

The proposal artifact remains immutable at
`reviewed/external-review-corrections.json`. The returned decisions are normalized in
`reviewed/external-review-remediation-decisions.json`, and their compiled, old-state-guarded
catalog delta is `reviewed/external-review-completed-implementation.json`. Import verifies the
review ID, proposal SHA-256, completed workbook SHA-256, all 97 valid decision keys, and exact
coverage of the 24 decisions that require a delta before mutating any array.

## Coverage before seed

The coverage command writes `coverage-report.json` for all 13 procedures using the same pure
helper as the scenario generator. It reports two separate metrics:

- required catalog coverage: required slots whose broad role has at least one existing
  `Product_Roles` product, including candidate/unverified products; and
- required curated-default coverage: required slots with at least one selectable canonical
  `Slot_Product_Options` row.

Unreviewed proposals do not count toward curated-default coverage. In the current catalog, 9
of 116 roles have no catalog product. Required slots without curated defaults in the golden
source procedures are explicitly resolved by reviewed demo-only stand-ins; every stand-in and
reason is listed in `data/ip-preference-cards/seed/demo-stand-ins.json`. Neither coverage
metric is card readiness or clinical approval.

The JSON output is the runtime source for the prototype. The additive database migration provides normalized import tables for a later controlled database load; v0.1 does not perform an automatic destructive catalog replacement.

## Catalog additions and GUDID confirmation (v0.2)

The workbook remains the source of truth for everything it covers. Two extra inputs sit
alongside it, each with its own generator, and the full pipeline is idempotent — running it
twice with unchanged inputs leaves `git status` clean.

```bash
npm run ip-cards:gudid          # AccessGUDID release  -> generated/gudid-index.json
npm run ip-cards:additions      # gudid-index          -> seed/catalog-additions.json
npm run ip-cards:import         # workbook + additions -> generated/*.json
npm run ip-cards:coverage
npm run ip-cards:scenarios      # -> generated/scenarios.json, modifier-definitions.json
npm run ip-cards:gudid-confirm  # -> generated/gudid-confirmations.json
npm run ip-cards:validate-data
```

### AccessGUDID index

`scripts/ip-preference-cards/build-gudid-index.ts` streams the ~5.6 GB AccessGUDID
delimited full release (not committed; expected at
`Preference_card_module/AccessGUDID_Delimited_Full_Release_<date>`) and keeps only what this
catalog needs: the complete listing for thoracic/airway-specific labelers, plus any device
whose catalog number already appears in our product list. Broad-line suppliers such as
Cardinal Health would otherwise contribute hundreds of thousands of unrelated records.

### Curated catalog additions

`seed/catalog-additions.json` carries products the workbook does not: Getinge/Atrium and Teleflex
thoracic drainage, FUJIFILM bronchoscopy/ultrasound equipment, Auris and Noah robotic-bronchoscopy
equipment, Olympus scope additions, ICU Medical tracheostomy products, reviewed taxonomy-v2
energy, imaging, ablation, laser, photodynamic, and emerging-device cohorts, plus the dated
brochure-intake cohort described below.
Each product retains its source-specific evidence: GUDID supports identity, DI/GTIN, distribution,
sterility, and single-use fields when available, while manufacturer sources support family naming,
part numbers, dimensions, and configuration. The earlier GUDID-derived cohort emitted only devices
reported in commercial distribution; later reviewed cohorts keep their own conservative
verification and visibility grades rather than inferring current U.S. distribution.
`apply-catalog-additions.ts` merges them at import time and validates them against the workbook's
own vocabularies. Its runtime contract rejects malformed or unexpected fields, duplicate IDs and
relationship pairs, unknown manufacturer/source/role references, missing primary provenance, and
manufacturer-scoped catalog-number collisions before any additions are returned.

### Reviewed brochure intake

The 2026-08-19 brochure gap audit is a reviewed, data-only input to the same generator:

```text
data/ip-preference-cards/reviewed/brochure-intake-additions-2026-08-19.json
  -> scripts/ip-preference-cards/catalog-additions-brochure-intake.ts
  -> scripts/ip-preference-cards/build-catalog-additions.ts
  -> data/ip-preference-cards/seed/catalog-additions.json
  -> scripts/ip-preference-cards/import-catalog.ts
  -> data/ip-preference-cards/generated/*.json
```

The reviewed file pins exact manufacturer/catalog identities, deterministic product IDs, source
locators, conservative hidden/verified-source fields, and only those existing role links supported
by the evidence. The emitter recomputes each ID and performs manufacturer-aware collision checks,
including the self-ID case produced by an idempotent rerun. It does not create canonical slot
options; the existing proposal generator continues to emit any broad-role joins as unreviewed,
nonselectable proposals.

The comprehensive accounting package under
`docs/ip-preference-cards/brochure-intake/2026-08-19/` is review evidence, not a runtime input. Its
row-reconciliation CSV covers every extracted input row, and its source manifest records hashes and
page counts without committing the external brochure files or local absolute paths.

### Brand-level discovery

Some relevant lines sit inside labelers far too large to index wholesale. `build-gudid-index.ts`
therefore also matches on GUDID `brandName`: the Pleur-evac line inside Teleflex (~29,000
devices) and the Portex range inside ICU Medical. A brand match is evaluated before the
company match, so a brand reaches the index even when its labeler is not otherwise a catalog
manufacturer. Bivona is deliberately not matched — it alone lists ~53,000 devices.

**Known limitation.** Portex GUDID records carry no `deviceDescription` and no
`catalogNumber`, only a bare `versionModelNumber`. They are indexed so the confirmation
machinery covers them, but no Portex products have been added: identifying them needs an
ordering list that maps product code to model number, and tracheostomy tube dimensions are
too consequential to infer from a mangled PDF table.

### Confirmation queue

`gudid-confirm.ts` matches catalog products against the index and writes a review queue. It
never mutates product records: AccessGUDID's use policy (SRC046) states a GUDID record is not
by itself evidence of current orderability, and verification changes stay a human decision.
Matches are graded — `manufacturer_and_catalog_number` is strong, `catalog_number_only` is
reported at lower strength because a shared catalog number across vendors is weak evidence.

The explorer surfaces one derived signal from this queue: a **Not currently distributed**
badge. A product is flagged only when _every_ strong match says the device is out of
commercial distribution, so a product that is discontinued in one package configuration but
still active in another is not mislabeled.

## openFDA enrichment and current U.S. status research are separate proposal layers

The optional openFDA pipeline documented in
[`openfda-enrichment.md`](./openfda-enrichment.md) reads the normalized catalog and existing
verification backlog but does not participate in workbook import. It writes candidate
proposals and review reports under `generated/openfda/`; it never patches imported products,
verification decisions, hospital formulary staging, or the source workbook.

Re-running `ip-cards:import` is therefore independent of openFDA cache state. Conversely, a
high-confidence openFDA match remains pending human review and does not make a product
selectable, clinically ready, compatible, locally available, or orderable.

OpenFDA/GUDID identity enrichment also does not create `Product_Roles`, canonical
`Slot_Product_Options`, or accepted slot-option proposals, and it does not affect either
coverage metric.

The dated current U.S. status workflow builds a hidden-product cohort and combines exact identity,
UDI/GUDID distribution, registration/listing, authorization or exemption, official manufacturer
U.S. evidence, and a separate official FDA safety-action layer. Its compact artifacts stay under
`data/ip-preference-cards/research/us-status/<YYYY-MM-DD>/`; raw API and manufacturer-source data
stay in ignored `local-data/ip-preference-cards/us-status/`. Every result is a nonapplying research
proposal with `canonical_change_applied: false`.

Market status and safety action stay independent. A recall never establishes that a product is
discontinued and never changes its distribution state, but an active exact FDA safety action does
hold ordinary prototype-visibility review until a physician/governance safety review occurs. A
completed safety search is required before either the positive or the negative distribution review
disposition is proposed.

Neither proposal layer runs during import, CI, build, postinstall, application startup, a public
route, or a server action. Neither has an apply endpoint or changes generated catalog data,
visibility, verification grade, selectability, role/slot assignments, compatibility, formulary
state, release pointers, or ledgers.
