# Source Completeness + Owner-Supplied Product Intake V2

This is the deterministic review package for the bounded source-first follow-up after PR #118. It does not rewrite the PR #118 package, source workbook, raw source corpus, historical release, or published release pointer.

## Outcome

| Measure                                                           | Count |
| ----------------------------------------------------------------- | ----: |
| Products discovered in the old corpus but absent from the old CSV |    21 |
| Owner-supplied PDF candidates                                     |    40 |
| Official-web-only candidates                                      |    22 |
| Already canonical products                                        |     4 |
| New exact products added                                          |    65 |
| Family-level/unresolved rows                                      |     6 |
| Irrelevant products                                               |     9 |
| Products needing owner review                                     |     7 |

The prior 125 supported source documents were checked against the frozen PR #118 manifest: 115 PDFs, 7 HTML files, and 3 Markdown files comprising 2,609 PDF pages. All 125 still match; no supported source was added, removed, or hash-changed. Deterministic layout-text extraction scanned all 115 PDFs and identified 17 documents with contiguous multi-page table sections without requiring continuation pages to repeat a heading. Risk-based rendered inspection found 14 R-series candidates in the Shiley Flexible tables and eight additional extended-proximal XLT candidates in the adjacent Shiley XLT document. Thirteen R-series and all eight XLT exact manufacturer/FDA identities were added; the printed `7CN75R` versus FDA `7CN80R` mismatch remains an explicit owner-review conflict. Corpus-wide table-document accounting is in `old-corpus-multipage-document-scan.csv`, and the fully rendered correction sections are in `old-corpus-table-page-coverage.csv`.

The newly used evidence set adds 33 hashed artifacts: 7 PDFs comprising 45 pages (including the owner packet) and 26 official HTML records/pages. Together with the frozen old corpus, the aggregate is 2654 PDF pages.

The old Medtronic brochure contains M5 family context, but it was represented by CSV input row 791; it does not establish an exact source-to-CSV omission. The current Medtronic U.S. pages establish nine new exact powered-airway products. Across the 20-row airway-blade ordering table, seven were accepted, four remain in owner review, and nine laryngeal/ENT-only rows were excluded.

## Owner packet by manufacturer

| Reviewed identity          | Candidates | Added | Existing | Owner review |
| -------------------------- | ---------: | ----: | -------: | -----------: |
| TSC Life / Axess Vision    |          9 |     8 |        0 |            1 |
| Praxis                     |          2 |     2 |        0 |            0 |
| Maverix / Thoracent        |          3 |     3 |        0 |            0 |
| Medinotec                  |          9 |     9 |        0 |            0 |
| EndoTherapeutics / HugeMed |          8 |     8 |        0 |            0 |
| CLR Medical                |          5 |     5 |        0 |            1 |
| Cook Medical               |          4 |     0 |        4 |            0 |

The CLR owner page supplied family/component names without order codes. Official CLR IFUs plus AccessGUDID resolved five exact separately identified products. The CLR Irrigator is added with exact identity and remains a physical-taxonomy review item because the controlled vocabulary has no precise pleural suction/irrigation instrument subtype.

## Reconciliation model

Every discovery row in `source-product-discovery.csv` has exactly one controlled disposition. `missing-from-original-csv.csv` deliberately includes accepted, unresolved, and excluded exact candidates so absence from the old CSV is not confused with permission to import. `new-product-additions.csv` is the accepted 65-product subset.

Duplicate checks covered exact and normalized manufacturer/catalog identity, punctuation and spacing, alternate IDs, GTINs, deterministic IDs, package variants, and distributor/legal-manufacturer relationships. The Cook order numbers and ECHO reference numbers resolve to four existing canonical products and receive only new source relationships.

## Governance

- All 65 new products are `verified_source`, `visibility_state=hidden`, and make no local-orderability claim.
- 59 products receive an existing, evidence-supported role; six remain intentionally roleless. The two Screeni mounting components stay roleless because the existing mount-accessory role is introduced by a later governed overlay, after the catalog-additions validation gate.
- No canonical slot option is authored or promoted. Potential relationships remain in the unreviewed proposal workflow.
- Exactly one taxonomy row is produced for every verified-source product. One narrow pair rule was added for `Therapeutic bronchoscopy / Cryotherapy consumable`; CLR Irrigator intentionally remains `other_needs_review`.
- The owner PDF and all remote source captures remain external; only hashes, locations, URLs, and reviewed facts are committed.

## Files

- `source-manifest.json`: unchanged prior corpus plus every newly used owner/manufacturer/FDA evidence artifact and hash.
- `source-product-discovery.csv`: complete 85-row controlled-disposition ledger.
- `old-corpus-multipage-document-scan.csv`: all 17 multi-page table documents identified by the corpus-wide extractor.
- `old-corpus-table-page-coverage.csv`: page-by-page contract for the flagged multi-page table section and all 14 reconciled Shiley candidates.
- `missing-from-original-csv.csv`: exact candidates absent from the original CSV, with final disposition.
- `owner-supplied-products.csv`: all 40 owner-packet targets.
- `new-product-additions.csv`: the 65 accepted exact products.
- `existing-product-matches.csv`: four Cook alias/exact matches.
- `unresolved-relevant-products.csv`: held exact candidates, the Shiley source conflict, and the added CLR taxonomy-review row.
- `irrelevant-products.csv`: nine constrained ENT exclusions.
- `duplicate-analysis.csv`: per-product exact/alias/package/manufacturer duplicate review.
- `manufacturer-summary.csv`: counts by origin and legal manufacturer.
