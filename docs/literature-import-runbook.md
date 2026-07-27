# IP Literature Explorer import runbook

## Guardrails

- Raw NBIB exports, the working manifest, and generated reports belong under
  `local-data/literature/` or the existing ignored `IP_PubMed/nbib files/` archive.
- The committed example manifest is a template, not evidence that a file has known provenance.
- Import commands are dry-run by default.
- Local writes require `--commit --target local`.
- Remote writes require all three flags: `--commit --target remote --confirm-remote`.
- Never put a service-role or secret key in a browser environment, command argument, report, or
  committed file.
- No import command truncates tables or removes records that are absent from a source file.

## 1. Install and start local services

```bash
npm install
npx supabase start
```

This branch assigns the project local Supabase ports `55320` through `55329` so it can coexist
with another conventional `5432x` Supabase project. The application development server remains on
port `3001`.

Apply the repository migration chain:

```bash
npx supabase db reset --local
```

At the time Phase 1 was built, the pre-existing migration
`20260430180000_add_socal_ebus_email_notifications.sql` referenced
`public.learner_profiles`, which is not created by the migration history on `origin/main`. That
unrelated baseline issue prevents a clean reset of the complete repository chain. The literature
migration was therefore also applied and linted in an isolated clean local Supabase project. Fix
or reconcile the earlier migration before treating a full-project reset as verified.

Load local credentials into the current shell without printing them:

```bash
eval "$(npx supabase status -o env 2>/dev/null)"
export LITERATURE_SUPABASE_URL="$API_URL"
export LITERATURE_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
```

The import tools refuse `--target local` when the configured URL is not loopback.

## 2. Seed the versioned registry and taxonomy

Preview the planned seed:

```bash
npm run literature:seed-taxonomy
```

Commit it locally:

```bash
npm run literature:seed-taxonomy -- --commit --target local
```

The seed is idempotent. Phase 1 seeds 21 journal/source records and 77 topic nodes from registry
and taxonomy version `1.0.0`.

## 3. Generate and review a provenance manifest

```bash
npm run literature:manifest -- \
  --directory "/absolute/path/to/nbib files" \
  --output local-data/literature/import-manifest.json
```

The generator maps a file only when its filename contains exactly one unambiguous registry source
or query ID. Every other entry is emitted as:

```json
{
  "source_kind": "unmapped",
  "source_id": null,
  "query_id": null,
  "status": "needs_mapping"
}
```

Review every entry against the actual export history. Do not infer a retrieval query from article
content. The generator never overwrites an existing manifest; it writes a sibling
`.proposed.json` file or stops.

## 4. Validate without database writes

Validate the manifest corpus:

```bash
npm run literature:validate -- \
  --manifest local-data/literature/import-manifest.json
```

Or validate one file:

```bash
npm run literature:validate -- --file "/absolute/path/to/export.nbib"
```

Reports are written as timestamped JSON files under `local-data/literature/reports/`. They include
checksums, file and record counts, duplicate PMID occurrences, missing identifiers/titles/
abstracts, unmatched journals, DOI conflicts, source mappings, bounded detailed errors, and
elapsed time.

Print the newest report across validation and import prefixes:

```bash
npm run literature:report
```

## 5. Dry-run and import

Import remains a dry-run when `--commit` is absent:

```bash
npm run literature:import -- \
  --manifest local-data/literature/import-manifest.json
```

Commit a bounded local sample:

```bash
npm run literature:import -- \
  --manifest local-data/literature/import-manifest.json \
  --limit 100 \
  --batch-size 50 \
  --commit \
  --target local
```

Commit the full reviewed manifest:

```bash
npm run literature:import -- \
  --manifest local-data/literature/import-manifest.json \
  --batch-size 300 \
  --commit \
  --target local
```

A limited run records `record_limit` as part of its batch identity, so a sample can never cause a
later full import of the same checksum to be skipped. An identical completed run is skipped.
`--force` reuses that exact batch identity, clears its prior error rows, and reprocesses it without
duplicating article-source links.

Bibliographic columns are upserted by PMID only when the deterministic metadata hash changes.
Relevance, visibility, landmark, manual-override, curation-reason, and human-topic fields are not
part of the importer update.

## 6. Generate topic suggestions

Preview rules for a bounded review state:

```bash
npm run literature:suggest-topics -- \
  --state unreviewed \
  --limit 100
```

Commit suggestions locally:

```bash
npm run literature:suggest-topics -- \
  --state unreviewed \
  --limit 100 \
  --batch-size 100 \
  --commit \
  --target local
```

Query- and rule-derived rows always use `assignment_state=suggested`. They never include, exclude,
publish, or hide an article. A human confirmation or rejection takes precedence in search
behavior while automated evidence remains auditable.

## 7. Verify the local database contract

For a disposable local Supabase database with the literature migration applied:

```bash
export LITERATURE_SUPABASE_ANON_KEY="$ANON_KEY"
LITERATURE_INTEGRATION_TEST=1 npm test -- \
  --runInBand \
  src/features/literature/__tests__/database-integration.test.ts

npx supabase db lint --local --level warning
```

The integration test writes reserved fixture PMIDs. Use a disposable local database, not a shared
or remote project. It verifies checksum idempotency, limited/full batch separation, provenance
accumulation, metadata refresh, manual-override preservation, curation audit immutability,
suggestion precedence, RLS denial, ranking, filters, and pagination.

## 8. Remote import boundary

No Phase 1 build or verification command writes remotely. If a later operator is explicitly
authorized to do so, the command boundary is:

```bash
npm run literature:import -- \
  --manifest local-data/literature/import-manifest.json \
  --commit \
  --target remote \
  --confirm-remote
```

Before any write, the tool prints the selected target, Supabase hostname, and planned record
count. Stop if any value is unexpected.

## Recovery notes

- A malformed record is quarantined or recorded as a nonfatal import error; other records continue.
- A failed batch remains in the audit history. A later run can create a new attempt.
- Use `--force` only to replay the same checksum and import scope intentionally.
- Correct manifest provenance by creating a new manifest version; do not rewrite historical batch
  rows.
- Never use table truncation as an import-recovery step.
