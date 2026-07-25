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

## Current result

Workbook SHA-256:

```text
fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf
```

| Dataset                    |  Rows |
| -------------------------- | ----: |
| Products                   | 1,221 |
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
