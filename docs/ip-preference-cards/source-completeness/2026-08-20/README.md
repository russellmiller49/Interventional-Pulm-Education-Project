# Source Completeness + Owner-Supplied Product Intake V2

This is the deterministic review package for the bounded source-first follow-up after PR #118. It does not rewrite the PR #118 package, source workbook, raw source corpus, historical release, or published release pointer.

## Corpus-scan ledger

Every page of all 115 frozen old-corpus PDFs (2,609 pages) is scanned by a layout-aware extractor (`source-completeness-corpus-scan.ts`) with no minimum identifier count per page, no contiguous-page requirement, and no page-leading requirement; it reconstructs hyphen-wrapped cells, joins split references, and records matrix header/row context. The scanner output — not a static reviewed list — is the authoritative candidate source for this package: this generator invokes the scanner, joins its candidates against the original CSV, the pre-review catalog, and the reviewed dispositions, and fails closed if any candidate is left without exactly one controlled disposition.

| Ledger measure                                                              | Count |
| --------------------------------------------------------------------------- | ----: |
| Scanner candidates (unique identifier per document)                         |  5767 |
| Dispositions assigned                                                       |  5767 |
| Unhandled candidates                                                        |     0 |
| Represented in the original CSV                                             |   532 |
| Exact identifiers of pre-review canonical products                          |   992 |
| Alias/format variants of canonical products                                 |    96 |
| Accepted new exact product rows                                             |   325 |
| Duplicate source occurrences (paired references, duplicate captures)        |   289 |
| Held in owner review                                                        |   375 |
| Insufficient identity (fragments, truncations)                              |   113 |
| Family-level only                                                           |     3 |
| Source-evidence conflicts                                                   |     4 |
| Out of current scope                                                        |  2187 |
| Not product identifiers (citations, patents, billing codes, revision codes) |   851 |
| Objective high-risk documents (density/matrix/ordering criteria)            |    57 |

## Outcome

| Measure                                             | Count |
| --------------------------------------------------- | ----: |
| Old-corpus exact products added by this review      |   184 |
| Owner-supplied PDF candidates                       |    40 |
| Official-web-only candidates                        |    22 |
| New exact products added (all origins)              |   228 |
| Irrelevant product rows in the product-level ledger |     9 |
| Product rows needing owner review                   |    22 |

The prior 125 supported source documents were checked against the frozen PR #118 manifest: 115 PDFs, 7 HTML files, and 3 Markdown files comprising 2,609 PDF pages. All 125 still match; no supported source was added, removed, or hash-changed.

## Corrected cohorts

- **Cook Thal-Quick**: the one-product-per-page capture pairs one order number with one reference part number per page. All 20 rows (10 trays, 10 sets) were reconciled; the four tray configurations absent from both the original CSV and the baseline catalog (G06885/C-TQTSY-1000, G05464/C-TQTSY-1200, G07090/C-TQTSY-1400, G04220/C-TQTSY-2400) were added with the reference part number as an alternate identifier. The Cook omnibus chest-drainage brochure (SRC076) was reconciled row-by-row; it added the two vinyl connecting tubes (G02327, G02791) and the Cook Chest Drain Valve (G36370), while its pericardiocentesis rows are held in owner review.
- **Novatech DUMON/GSS stents**: the straight-stent diameter-by-length matrix (pages 12-13) and the Y/OKI/ST/DST special-shape tables (pages 14-15) carry 148 exact references. All 148 were reconciled from scanner output; a compact reviewed matrix expands them deterministically, seven were already canonical, and the remaining 141 were added with header-inherited dimensions. The Spanish-edition catalog carries the identical reference set and is accounted as duplicate occurrences.
- **Blue Rhino G2-Multi**: all 21 one-product-per-page ordering rows were reconciled, reconstructing the hyphen-wrapped reference part numbers; the 15 sets/trays absent from both the original CSV and the baseline catalog were added, and the six existing rows received their in-row reference pairings.

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

## Reconciliation model

Every scanner candidate in `old-corpus-candidate-dispositions.csv` and every product row in `source-product-discovery.csv` has exactly one controlled disposition. `missing-from-original-csv.csv` deliberately includes accepted, unresolved, and excluded exact candidates so absence from the old CSV is not confused with permission to import. `new-product-additions.csv` is the accepted 228-product subset.

Duplicate checks covered exact and normalized manufacturer/catalog identity, punctuation and spacing, alternate IDs, GTINs, deterministic IDs, package variants, order/reference pairings, and distributor/legal-manufacturer relationships.

## Governance

- All 228 new products are `verified_source`, `visibility_state=hidden`, and make no local-orderability claim.
- 222 products receive an existing, evidence-supported role; six remain intentionally roleless.
- No canonical slot option is authored or promoted. Potential relationships remain in the unreviewed proposal workflow.
- Exactly one taxonomy row is produced for every verified-source product.
- The owner PDF and all remote source captures remain external; only hashes, locations, URLs, and reviewed facts are committed.

## Files

- `source-manifest.json`: unchanged prior corpus plus every newly used owner/manufacturer/FDA evidence artifact and hash.
- `old-corpus-candidate-extraction.csv`: the complete 5767-candidate scanner output with detection metadata.
- `old-corpus-candidate-dispositions.csv`: one controlled disposition per scanner candidate, with basis, rule, and rationale.
- `old-corpus-page-coverage.csv`: per-page candidate coverage for all 2,609 corpus pages.
- `old-corpus-document-summary.csv`: per-document accounting for all 115 PDFs.
- `scanner-summary.json`: scan totals, per-rule and per-disposition counts, and the derived high-risk document list.
- `old-corpus-table-page-coverage.csv`: rendered-inspection contract for the reconciled ordering/matrix sections.
- `source-product-discovery.csv`: complete 248-row product-level controlled-disposition ledger.
- `missing-from-original-csv.csv`: exact candidates absent from the original CSV, with final disposition.
- `owner-supplied-products.csv`: all 40 owner-packet targets.
- `new-product-additions.csv`: the 228 accepted exact products.
- `existing-product-matches.csv`: four Cook alias/exact matches.
- `unresolved-relevant-products.csv`: held exact candidates and controlled conflicts.
- `irrelevant-products.csv`: constrained exclusions.
- `duplicate-analysis.csv`: per-product exact/alias/package/manufacturer duplicate review.
- `manufacturer-summary.csv`: counts by origin and legal manufacturer.
