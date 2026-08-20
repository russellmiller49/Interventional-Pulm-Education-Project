# Brochure product intake review — 2026-08-19

This package is the review and accounting layer for the bounded preference-card brochure intake.
It is not a runtime product database. Canonical additions flow through the governed reviewed-addition
pipeline, and no slot-product option is promoted by this package.

## Frozen input facts

- The supplied CSV **does contain** the exact header `Product ID,Product Name,Manufacturer,Source File`, despite the original brief describing it as headerless.
- Data rows (header excluded): 2060
- Rows with an extracted identifier: 1997
- Rows with `Not stated in source`: 63
- Extracted manufacturer strings: 55
- Referenced source filenames: 121
- Local brochure/source files inventoried: 125 (115 PDF, 7 HTML, 3 Markdown)
- PDF pages inventoried: 2609
- Unresolved local source filenames: 0
- Canonical products added: 397
- Exact repeated identifiers: 21 groups / 43 rows / 22 excess rows
- Normalized repeated identifiers: 30 groups / 61 rows / 31 excess rows
- Byte-identical source files: 4 groups / 8 files / 4 redundant copies
- Addition-to-source support: 398 evidence-source occurrences covering 397 unique products
- Source CSV SHA-256: `9ddcd7c85f32b116e4f19536937deeaf115b4406ff1c1c90f539416c445fda61`

## Evidence method and limits

Local documents are the primary identity evidence. The completed audit successfully ran
`pdfinfo` and `pdftotext` on all 115 PDFs (2609 pages). Three PDFs had
zero native text and required rendered-page inspection/OCR: `Brochure-BodyVision_MOSS.pdf`,
`Y-Stent-Brochure-2022.pdf`, and `eb-530us-esp.pdf`. Page locators distinguish the one-based
PDF page index from a document's printed page. All 397/397
canonical additions have page-level locators. Exact brochure identity does not imply current
orderability or U.S. commercial status.

The governed Chartis source `SRC054` retains its canonical filename, while the local evidence file
adds the dated suffix `-Released-2025-12-18`; the manifest maps `SRC054` to that unique local
filename alias explicitly.

## Dispositions

- `existing_exact`: 803
- `existing_alias_or_format_variant`: 64
- `existing_family_or_package_variant`: 35
- `new_product_added`: 397
- `relevant_but_insufficient_identity`: 9
- `relevant_family_level_only`: 13
- `duplicate_source_row`: 57
- `irrelevant_to_current_scope`: 615
- `source_document_missing`: 0
- `source_evidence_conflicted`: 51
- `needs_owner_review`: 16

## Deterministic review batches

The canonical additions are partitioned by exact canonical manufacturer, ordered lexicographically.
The `review_batch_id` column in `new-product-additions.csv` is the exact member list: every row
also carries its logical input row number(s), deterministic product ID, and the batch's total count.

| Batch                 | Manufacturer    | Products |
| --------------------- | --------------- | -------: |
| `B01-bd`              | BD              |        3 |
| `B02-cardinal-health` | Cardinal Health |       21 |
| `B03-cook-medical`    | Cook Medical    |       31 |
| `B04-efer`            | EFER            |       54 |
| `B05-ethicon`         | Ethicon         |       12 |
| `B06-fujifilm`        | FUJIFILM        |        1 |
| `B07-karl-storz`      | Karl Storz      |      127 |
| `B08-medtronic`       | Medtronic       |       12 |
| `B09-merit-medical`   | Merit Medical   |      109 |
| `B10-pentax-medical`  | PENTAX Medical  |        1 |
| `B11-pulmonx`         | Pulmonx         |        1 |
| `B12-teleflex`        | Teleflex        |       23 |
| `B13-thoracent`       | Thoracent       |        2 |

## Artifacts

- `input-summary.json`: frozen input facts, duplicate accounting, and disposition totals.
- `source-manifest.json`: all local brochure files with hashes, PDF page counts, row matches, and supported additions.
- `row-reconciliation.csv`: one controlled disposition for every data row.
- `new-product-additions.csv`: reviewed exact-identity canonical additions and evidence.
- `existing-product-matches.csv`: exact, alias/format, and family/package matches.
- `unresolved-relevant-products.csv`: insufficient, family-only, missing, conflicted, and owner-review rows.
- `irrelevant-products.csv`: rows outside the current IP/pleural/tracheostomy scope.
- `duplicate-analysis.csv`: exact and normalized repeated identifiers, exact rows, byte-identical files, and duplicate-source decisions.
- `manufacturer-summary.csv`: per-manufacturer row and disposition totals.

The manifest contains portable relative filenames only. Raw brochure contents and the private source
directory are not committed by this generator.
