# Literature data-quality foundation v2

## Scope and safety boundary

These commands operate only on the `gold-set-v1` **development** membership. The database scope
loader selects only batch identity and development PMIDs; it does not select review rows,
physician decisions, or held-out test membership.

Every database command defaults to dry-run mode and accepts only `--target local`. Commit mode is
blocked outside the primary checkout. It is never valid to use these commands against a remote
database.

Generated reports, PubMed responses, and undo logs belong under ignored `local-data/`. The
read-only `local-data/inputs/` mount is explicitly rejected, as are output paths that escape the
checkout or traverse a symlink.

## Current diagnosis and disposition

Merge-readiness audits establish a clear boundary between the canonical local literature database
and the supplied enrichment export:

- The canonical database is already clean with respect to the supplied mojibake defect.
- It already contains the PubMed metadata available under the backfill command's conflict-safe
  policy. Fetching all 630 scoped PMIDs produced no unavailable records, missing article rows,
  proposed fields, or planned writes. The remaining blank MeSH and author-keyword fields therefore
  are not currently backfillable from the fetched source.
- The external-QA findings remain valid findings against the supplied enrichment export, but the
  corrupt text and missing metadata observed there are not present in the canonical database.
- No text-repair commit or PubMed-backfill commit is currently indicated. The next separate
  engineering target is enrichment-source and export fidelity, not database mutation.

The repair and backfill commands below remain fail-closed maintenance infrastructure for future,
separately approved defects.

## Reversible text-encoding audit and repair

The detector scans canonical `literature_articles.title` and `abstract` values rather than a
hardcoded PMID list. A span is repairable only when exactly three UTF-8-as-MacRoman corruption
passes can be reversed and the candidate passes a byte-for-byte forward round trip. One-pass,
two-pass, mixed clean/corrupt, ambiguous, and still-reversible-after-three-pass values fail closed;
clean Unicode for which no reverse pass succeeds is preserved.

Run the read-only audit and dry-run repair with distinct, new report paths:

```bash
npm run literature:audit-text-encoding -- \
  --output local-data/literature/data-quality/text-encoding-audit-v2.json

npm run literature:repair-text-encoding -- \
  --dry-run \
  --output local-data/literature/data-quality/text-encoding-repair-dry-run-v2.json
```

Each report includes affected fields, before/after excerpts and hashes, code points, replacement
counts, scope/source/candidate hashes, and the supplied repair-audit provenance hash. Clean Unicode
is preserved. Any refused span makes the command exit nonzero.

Commit mode is available for a later, separately approved primary-checkout session:

```bash
npm run literature:repair-text-encoding -- \
  --commit --target local \
  --output local-data/literature/data-quality/text-encoding-repair-commit-v2.json \
  --undo-log local-data/literature/data-quality/text-encoding-undo-v2.jsonl
```

The commit path uses sparse, `updated_at`-guarded row updates. Abstract repairs change only
`abstract`. Title repairs also recompute `normalized_title` and `normalized_title_hash`. The
hash-chained, append-only, mode-`0600` JSONL log records the full pre-update value and hashes before
each database write, followed by a separate applied event after success. No metadata hash, raw
tag, relevance, review, or physician field is included in an update.

An exclusive mode-`0600` sidecar lock is held for the undo writer's lifetime. A concurrent run or
stale lock fails closed; stale-lock recovery requires explicit inspection rather than automatic
deletion.

## PubMed metadata backfill

Set an NCBI contact email before running EFetch. An API key is optional:

```bash
export NCBI_EMAIL="contact@example.org"
export NCBI_API_KEY="..." # optional; never written to reports or logs

npm run literature:backfill-pubmed-metadata -- \
  --dry-run \
  --report local-data/literature/data-quality/pubmed-metadata/backfill-dry-run-v2.json
```

The client sends batches of at most 200 PMIDs, defaults to at most three requests per second,
honors `Retry-After`, uses bounded retries and response sizes, and caches raw XML plus metadata
under `local-data/literature/pubmed-efetch-cache/`. Cache and report entries carry SHA-256 hashes;
API keys are redacted from errors.

When a DOCTYPE is present, the XML parser accepts only the tightly constrained external NLM
`PubmedArticleSet` declaration used by official EFetch responses and rejects internal subsets or
entity declarations. It normalizes MeSH headings, author keywords, publication types, and language
codes. Numeric language artifacts fail the general language validator.

The dry-run report lists blank counts, invalid existing/source language values, unavailable and
missing PMIDs, proposed sparse values, nonblank conflicts, cache-source hashes, and current and
candidate database-state hashes. A separate fetched-source hash preserves the normalized PubMed
provenance. Empty or wholly invalid fields may be proposed for replacement. Nonblank valid or
mixed fields are never overwritten when they differ from PubMed; they are reported as conflicts.

Commit mode exists only for a later, separately approved primary-checkout session:

```bash
npm run literature:backfill-pubmed-metadata -- --commit --target local
```

Before its first update, commit mode durably writes an immutable plan report and creates a new
mode-`0600`, append-only JSONL journal. It syncs a `row_attempt` event before every database call,
then records applied, optimistic-conflict, or indeterminate-error outcomes. Report or journal
collisions therefore stop before any update, while a partial database failure retains a durable
per-row trail.

PubMed E-utilities behavior and usage guidance are documented by NCBI:

- <https://www.ncbi.nlm.nih.gov/books/NBK25497/>
- <https://www.ncbi.nlm.nih.gov/books/NBK25499/>

## Read-only external-QA ingestion

The QA command accepts the exported findings CSV and the 630-row development source CSV. It never
connects to a database or the network and has no mutation mode:

```bash
npm run literature:audit-external-qa -- \
  --findings /absolute/path/gold-set-v1_external_QA_findings_v2_status.csv \
  --source /absolute/path/gold-set-v1_enrichment_results_full-text-reconciled-v2_quality-cleaned_630.csv \
  --output local-data/literature/data-quality/external-qa-audit-v2.json
```

Both CSV schemas are exact and identifiers must be unique. Targeted findings are reconciled to
the source by PMID and master-row ID. The report keeps direct targeted findings, rule-based
consistency checks, and global data-quality findings separate, with severity/category/status
summaries. It records unchanged source-input hashes and a before/after hash over physician fields;
the mutation plan is always `null`.

This command is cryptographically pinned to the supplied 630-row quality-cleaned enrichment export
(`62003ac04650a4d303a8cc73785452a0bdf3ddeeca3c1ea87bdf2e4e4bc0b15c`) and findings export
(`1c7992f29bb7c03afc370f3cb0e7a978a237dc9cbb964966e0dcec0cd07b6edd`). Renaming a held-out,
combined, or modified CSV cannot make it pass the development-only boundary.

## Current limitations

This foundation deliberately does not import enrichment/review rows, apply external QA tag/topic
suggestions, change physician relevance labels, resume screening, or read the held-out test split.
PubMed backfill is an independent sparse correction path; a future NBIB re-import still needs an
explicit merge-precedence policy if its older blank metadata would otherwise replace populated
canonical values or values added by any future approved backfill.
