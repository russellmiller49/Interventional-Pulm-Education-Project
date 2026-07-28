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
npm run ip-cards:validate-data
npm run ip-cards:seed
```

The importer reads headers from Excel row 4, begins records on row 5, and writes normalized server-side JSON to `data/ip-preference-cards/generated/`. It never parses the workbook in the browser, mutates `verification_status` or `live_dropdown_status`, or copies a suggested GUDID identifier into a canonical product.

## Current workbook result

Workbook SHA-256:

```text
fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf
```

| Dataset                    |  Rows |
| -------------------------- | ----: |
| Workbook products          | 1,221 |
| Product roles              | 1,268 |
| Procedures                 |    13 |
| Procedure slots            |   174 |
| Slot product options       | 2,080 |
| Roles                      |    98 |
| Raw compatibility evidence |   179 |
| Manufacturers              |    28 |
| Sources                    |    46 |
| Product sources            | 1,366 |
| Formulary staging          | 1,221 |
| Modifier catalog           |    30 |
| Verification backlog       | 1,221 |

The importer then merges 253 reviewed rows from `seed/catalog-additions.json`, producing
1,474 products in `generated/catalog-products.json`. The workbook-backed verification
backlog and formulary staging remain 1,221 rows; additions do not fabricate local decisions.
The full count reconciliation and duplicate audit are in
[`openfda-live-calibration-report.md`](./openfda-live-calibration-report.md).

The current supplied workbook has 80 non-null GTIN values, and all 80 are already represented as 14-character strings. This differs from the older measured pattern quoted in the build brief. The importer validates the file actually supplied: it preserves leading zeros, reports non-14-digit values, and never truncates or rounds. The regression fixture confirms `08714729986225` and leading-zero catalog number `02841S` survive exactly.

## Normalization and precedence

- Blank cells become `null`; identifier fields remain strings.
- `Single` and `Single select` both become `single`.
- Unrecognized product visibility values fail closed to `hidden`.
- Product-level visibility is authoritative; the restrictive value wins if a slot-option flag disagrees.
- Raw verification text is preserved, with a coarse derived state of `verified_source`, `candidate`, or `unknown`.
- Raw compatibility endpoints remain free text. Exact canonical matches are enriched, while unresolved model/catalog strings remain untouched.
- Strict workbook foreign keys fail the import when broken.
- Import output and reporting are stable and idempotent for the same workbook bytes.

## Coverage before seed

The coverage command runs before seed validation and writes `coverage-report.json`. In the current catalog, 45 of 98 roles have no selectable product. Required zero-selectable slots in the golden source procedures are explicitly resolved by reviewed demo-only stand-ins; every stand-in and reason is listed in `data/ip-preference-cards/seed/demo-stand-ins.json`.

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

`seed/catalog-additions.json` carries products the workbook does not: Getinge/Atrium and
Teleflex thoracic drainage, FUJIFILM bronchoscopy/ultrasound equipment, Auris and Noah
robotic-bronchoscopy equipment, Olympus scope additions, and ICU Medical tracheostomy
products. Identity, DI/GTIN, distribution status, sterility, and single-use come from GUDID;
manufacturer sources support product family naming, part numbers, dimensions, and
configuration. Only devices the seed-generation review found in commercial distribution
are emitted. `apply-catalog-additions.ts` merges them at import time and validates them
against the workbook's own vocabularies — unknown role codes or source ids, or a colliding
product id, fail the import.

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

## openFDA enrichment is a separate proposal layer

The optional openFDA pipeline documented in
[`openfda-enrichment.md`](./openfda-enrichment.md) reads the normalized catalog and existing
verification backlog but does not participate in workbook import. It writes candidate
proposals and review reports under `generated/openfda/`; it never patches imported products,
verification decisions, hospital formulary staging, or the source workbook.

Re-running `ip-cards:import` is therefore independent of openFDA cache state. Conversely, a
high-confidence openFDA match remains pending human review and does not make a product
selectable, clinically ready, compatible, locally available, or orderable.
