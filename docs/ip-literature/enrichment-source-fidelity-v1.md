# Literature enrichment-source fidelity v1

## Purpose and boundary

`literature:build-gold-enrichment-source` creates a deterministic, development-only CSV by
joining the finalized physician relevance decisions to canonical `literature_articles` metadata.
The prior enrichment CSV is required only as a checksum-bound fidelity-audit input. It never supplies
metadata to the output.

The command is read-only with respect to the database. It selects only:

- the exact `gold-set-v1` batch UUID `fff41ba3-811d-4d28-ba73-9302db3a942a`;
- `literature_gold_set_items` rows filtered to `dataset_split = development`; and
- canonical metadata for those development PMIDs from `literature_articles`.

There is no update, insert, upsert, delete, RPC, review import, test unlock, taxonomy expansion,
external-QA application, or screening path. Test/all/held-out CLI options and path semantics are
rejected.

## Checksum-bound inputs

The required physician CSV must be supplied through an absolute path. Its complete UTF-8 byte
stream is pinned to SHA-256:

```text
7542878664c44ce1bf34d355c0ac795c3fc46fe2e3ae4632210be3197ebc1f98
```

The parser requires the exact 36-column schema, 630 unique PMIDs in database display order, and
the finalized distribution of 283 `include_core`, 75 `include_adjacent`, 272 `exclude`, and zero
`uncertain`. Confidence must be 598 high, 31 moderate, and 1 low. Every row must retain
`human_ai_assisted` provenance and completed physician-review flags.

The physician projection includes master-row/PMID identity plus every physician decision field.
Its expected and output SHA-256 is:

```text
90b4b198da5803158685a9dd89d3f59578b91bad9bbd14e1cc55ebf5fdc9a01e
```

The required prior quality-cleaned export is audit-only and pinned to:

```text
62003ac04650a4d303a8cc73785452a0bdf3ddeeca3c1ea87bdf2e4e4bc0b15c
```

Both sources are decoded with fatal UTF-8 validation, re-encoded byte-for-byte, and re-read before
artifact creation to detect concurrent changes.

## Command

```bash
npm run literature:build-gold-enrichment-source -- \
  --batch gold-set-v1 \
  --reviews /absolute/path/gold-set-v1_physician_relevance_final_630.csv \
  --output local-data/literature/gold-sets/gold-set-v1/enrichment-source-v2.csv \
  --prior-source /absolute/path/gold-set-v1_enrichment_results_full-text-reconciled-v2_quality-cleaned_630.csv
```

The output and default sidecar receipt are created exclusively under ignored `local-data/` and
are never overwritten. `local-data/inputs/`, symlink traversal, remote targets, and output paths
outside the checkout's `local-data/` tree are rejected.

## Export contract

Canonical fields come only from `literature_articles`: title, abstract, authors, journal title and
abbreviation, publication year, publication types, MeSH, author keywords, and language. Structured
authors and multi-value metadata use deterministic JSON cells. A canonical null abstract is an
empty CSV cell with `no_abstract = True`; the physician source's synthetic
`[NO ABSTRACT AVAILABLE]` text is not exported.

Master-row identity, screening provenance, physician label/confidence, physician review fields,
and `human_ai_assisted` provenance are copied without normalization. Database `display_order` is
also retained separately; it is a gapped global order and must not replace `master_row_id`.

No Unicode normalization, lossy transcoding, or external-QA mojibake repair map is applied. Every
output value is checked for well-formed Unicode and the complete CSV must survive a strict UTF-8
round trip.

The receipt is deterministic and contains:

- physician and prior-source SHA-256 values;
- canonical database-state SHA-256 before and after export;
- output and physician-field SHA-256 values;
- canonical and prior field coverage;
- title and abstract differences;
- PMID membership/order and physician-field mismatches;
- invalid language values;
- nonblank prior/canonical metadata conflicts; and
- the retained PR #69 publication-type conflict for PMID `41347323`.

## Real read-only validation

The command was run twice against the same local database and source files. Both CSVs and both
receipts were byte-identical.

| Measurement                                |    Result |
| ------------------------------------------ | --------: |
| Development rows                           |       630 |
| MeSH populated / blank                     | 515 / 115 |
| Author keywords populated / blank          | 254 / 376 |
| Publication types populated / blank        |   630 / 0 |
| Language populated / blank                 |   630 / 0 |
| Invalid canonical languages                |         0 |
| Title differences from prior export        |         0 |
| Abstract differences from prior export     |        82 |
| Canonical-null vs prior sentinel abstracts |        55 |
| Nonblank abstract differences              |        27 |
| PMID membership/order mismatches           |         0 |
| Master-row/label/confidence mismatches     |         0 |
| Nonblank prior metadata conflicts          |         0 |

The prior export had zero populated MeSH, author-keyword, publication-type, or language cells.
PubMed-absent MeSH (115 rows) and author keywords (376 rows) remain valid canonical nullability,
not errors.

For PMID `41347323`, the canonical database retains `Journal Article`, `Review`, and
`Systematic Review`. PR #69's PubMed EFetch audit supplied `Journal Article` and
`Systematic Review`; the extra nonblank `Review` remains reported as a conflict and is not changed.

The first validated artifact hashes were:

```text
CSV SHA-256:       d2942507531a4ba55a5a4195a6919c959eff77cd3473a83eeae16074861b1e64
Receipt SHA-256:   38a0316ab5a3161bdf502a8e0c8b9c69753386862c858336f4d3e912a6ad21ef
Database SHA-256:  0ef6a23d64adf1d8c7e93852f637702b0cf76f8ab8afadae1d578443be5f2cda
```

These generated artifacts remain ignored local development files. This PR does not perform
enrichment or import any result.
