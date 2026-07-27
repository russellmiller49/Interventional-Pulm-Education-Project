# IP Literature Explorer: Phase 1 completion report

## Status

Phase 1 is implemented as a working, administrator-only vertical slice on
`feat/ip-literature-explorer`, based on `origin/main` at `e6edd4b1`. The implementation lives in
the isolated worktree:

```text
/Users/russellmiller/Projects/Interventional-Pulm-Education-Project-ip-literature
```

No remote database was modified, no branch was pushed, and no pull request was opened. The
original NBIB archive was not modified or copied into Git.

The module now supports streamed NBIB parsing, normalization, validation, provenance-preserving
and idempotent imports, versioned taxonomy/registry seeds, deterministic topic suggestions,
audited curation, PostgreSQL lexical search, article detail, methods/coverage, and an
administrator review queue.

All Phase 1 literature pages and APIs independently require an active `site_admin` entitlement.
Public-mode database semantics are implemented and tested but are not exposed as public routes in
this phase.

## Architecture

- Next.js App Router pages use server-side Supabase queries and small client components only for
  search controls and curation forms.
- Shared Zod schemas validate configuration, search parameters, article mutations, bulk review,
  PMIDs, pagination, years, known IDs, and workflow states.
- The importer uses Node streams, bounded parser fields/records, bounded database batches, capped
  retries, deterministic metadata hashes, and dry-run-first write controls.
- PMID is the canonical bibliographic key. DOI conflicts are reported rather than merged.
- Every retrieval occurrence is connected to its immutable import batch. Limited sample runs and
  full-file runs have distinct batch identities.
- Human workflow and topic decisions are omitted from bibliographic upserts, stored separately,
  and audited through a database function.
- PostgreSQL full-text search weights titles above MeSH/keywords, abstracts, and citation
  metadata. Browser clients never receive or search the full corpus.
- Abstracts default to `snippet_only`; full abstract publication is not enabled.

See [literature-module-architecture.md](literature-module-architecture.md),
[literature-import-runbook.md](literature-import-runbook.md), and
[literature-curation-policy.md](literature-curation-policy.md).

## Database migration

Migration:

```text
supabase/migrations/20260727032621_add_literature_explorer.sql
```

Tables:

```text
literature_journals
literature_articles
literature_import_batches
literature_article_sources
literature_topics
literature_article_topics
literature_curation_events
literature_import_errors
```

Versioned functions:

```text
curate_literature_article_v1
literature_admin_stats_v1
search_literature_v1
```

The migration also creates the search-vector and updated-at maintenance functions, an append-only
curation-event guard, required GIN/B-tree/trigram indexes, constraints, grants, and deny-by-default
RLS on all eight tables. Only `pg_trgm` is enabled; vector support is deliberately deferred.

The migration was reset from an empty isolated local Supabase project and passed `supabase db
lint`. The complete repository migration chain cannot currently reset from empty because the
pre-existing migration `20260430180000_add_socal_ebus_email_notifications.sql` references
`public.learner_profiles` before that relation exists. This unrelated history issue was not
changed in this branch.

## Local migration and fixture import

Start and reset the project after reconciling the pre-existing migration-chain issue:

```bash
npx supabase start
npx supabase db reset --local
```

Load local connection values without printing them:

```bash
eval "$(npx supabase status -o env 2>/dev/null)"
export LITERATURE_SUPABASE_URL="$API_URL"
export LITERATURE_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export LITERATURE_SUPABASE_ANON_KEY="$ANON_KEY"
```

Seed and import a fixture:

```bash
npm run literature:seed-taxonomy -- --commit --target local
npm run literature:import -- \
  --file tests/fixtures/literature/simple.nbib \
  --commit \
  --target local
```

Run the local integration contract only against a disposable database:

```bash
LITERATURE_INTEGRATION_TEST=1 npm test -- \
  --runInBand \
  src/features/literature/__tests__/database-integration.test.ts
```

## Real-corpus commands

Generate a manifest proposal:

```bash
npm run literature:manifest -- \
  --directory "/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/IP_PubMed/nbib files" \
  --output local-data/literature/import-manifest.json
```

Validate without a database write:

```bash
npm run literature:validate -- \
  --manifest local-data/literature/import-manifest.json
```

Dry-run an import:

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

Commit a full reviewed manifest locally:

```bash
npm run literature:import -- \
  --manifest local-data/literature/import-manifest.json \
  --batch-size 300 \
  --commit \
  --target local
```

A remote write is rejected unless `--commit --target remote --confirm-remote` are all present.

## Corpus validation

The full supplied corpus was validated without modifying the 67 source files:

| Measure                               |        Result |
| ------------------------------------- | ------------: |
| Files                                 |            67 |
| Record occurrences                    |       175,916 |
| Unique PMIDs                          |       132,350 |
| Duplicate PMID occurrences            |        43,511 |
| Missing PMID                          |            28 |
| Missing title                         |            27 |
| Missing abstract                      |        41,323 |
| Unmatched-journal occurrences         |        62,262 |
| Distinct unmatched journal labels     |         3,050 |
| Conflicting DOI records               |             1 |
| Actionable parse/normalization issues |           320 |
| Elapsed validation time               | 16.35 seconds |

The 320 issues comprise 264 malformed lines, 28 missing-PMID records, 27 missing-title records,
and one conflicting DOI. Because the files lack a reviewed provenance manifest, all 175,916
occurrences remain explicitly `needs_mapping`; no source or query was guessed.

The ignored machine-readable report is:

```text
local-data/literature/reports/validation-2026-07-27T04-28-57.844Z.json
```

A 100-record local sample committed successfully, contained 21 records without abstracts and 79
unmatched journals, and produced no parse errors. An identical replay was skipped by checksum.
The local suggestion pass examined 102 unreviewed records and created 41 versioned suggestions.

## Routes and behavior

```text
/{locale}/literature
/{locale}/literature/article/{pmid}
/{locale}/literature/methods
/{locale}/admin/literature
/{locale}/admin/literature/article/{pmid}
/api/literature/search
/api/literature/article/{pmid}
/api/admin/literature/article/{pmid}
/api/admin/literature/bulk-review
```

- The search route provides URL-backed text, topic, journal, year, publication type, landmark,
  sort, page, and admin-preview controls.
- Result cards include citations, identifiers, snippets, publication types, topic provenance,
  landmark state, external links, and deterministic match explanations.
- Detail pages enforce abstract-display policy and show provenance and publication warnings.
- The methods page reports registry/taxonomy versions, coverage layers, database counts, the last
  successful import, review status, and limitations.
- The admin dashboard shows corpus/workflow/source/journal/import statistics and a paginated
  review queue. Per-article review supports relevance, visibility, landmark, and grouped human
  topic decisions with a reason.
- English, Spanish, and Simplified Chinese UI chrome is localized. Bibliographic source text and
  topic labels remain untranslated unless reviewed source translations exist.

Route descriptions are supplied in place of screenshots because every Phase 1 screen requires a
real authenticated `site_admin` session.

## Verification

| Command/check                                  | Outcome                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run build:content`                        | Passed; 24 documents generated                                               |
| `npm run type-check`                           | Passed                                                                       |
| Literature message parity                      | Passed; 254 keys match across `en`, `es`, and `zh-CN`                        |
| Focused literature/auth tests                  | 11 suites passed, 83 tests passed; integration suite skipped unless opted in |
| Local database integration test                | 1 suite and 1 end-to-end invariant test passed                               |
| `npx supabase db lint --local --level warning` | Passed; no schema errors                                                     |
| `npm test -- --runInBand`                      | 266 suites passed, 1 opt-in suite skipped; 1,875 tests passed, 1 skipped     |
| `npm run lint`                                 | Passed with 0 errors and the same 14 pre-existing warnings                   |
| `npm run build`                                | Passed; all literature pages/APIs included in the production route manifest  |

The production build retains pre-existing warnings involving Mermaid's dynamic dependency,
Contentlayer/next-intl cache analysis, and missing `metadataBase` values. No new literature lint
warning or build error was introduced.

Baseline before feature edits:

- `npm install` passed with the lockfile unchanged; npm reported 41 existing audit findings.
- Direct `npm run type-check` failed only because a fresh worktree lacked generated Contentlayer
  types. Running `npm run build:content` first resolves it.
- The baseline suite passed 256 suites and 1,826 tests.
- Baseline lint passed with 0 errors and 14 warnings.

## Security decisions

- Every page and API route verifies `site_admin`; API checks do not rely on proxy middleware.
- The service-role client remains server-only and is never serialized to the browser.
- Literature tables have RLS enabled and no `anon` or `authenticated` table grants.
- Anonymous table reads and RPC execution were explicitly rejected in integration testing.
- Search and mutation input is parsed at the boundary; public response shapes omit raw NBIB tags,
  classifier fields, internal reports, and service data.
- Imported text renders as plain React text. No literature component uses
  `dangerouslySetInnerHTML`.
- Parsers and reports cap untrusted field, record, line, batch, and excerpt sizes.
- Curation events reject update/delete attempts, including service-role attempts.
- No remote write occurred. Scripts require an explicit three-part confirmation for one.

## Deferred work

Phase 2 should create a physician-labeled, stratified validation set before adding a
provider-neutral structured classifier. All model outputs must remain suggestions until recall,
precision, false negatives, and thresholds have been clinically reviewed.

Phase 3 should select an embedding provider and actual dimension before a separate pgvector
migration, then benchmark lexical, semantic, and hybrid retrieval. Full-text PDFs, AI summaries,
evidence grading, live PubMed synchronization, and public navigation are outside Phase 1.

## Physician/editorial decisions still required

- Map each of the 67 NBIB files to its actual journal/query/date provenance.
- Review unmatched journals arising from broad PubMed discovery.
- Define inclusion/exclusion guidance and adjudicate the initial corpus.
- Decide whether any full abstract redistribution is permitted.
- Clinically review Spanish and Simplified Chinese topic labels.
- Approve a Phase 2 validation set, classification thresholds, and false-negative audit.
- Approve public release only after enough records are explicitly included and published.

## Exact files

Modified:

```text
.gitignore
messages/en.json
messages/es.json
messages/zh-CN.json
package.json
src/app/[locale]/admin/page.tsx
src/lib/draft-modules.ts
src/lib/site-auth/access.test.ts
src/lib/site-auth/access.ts
```

Created:

```text
config/literature/import-manifest.example.json
config/literature/pubmed-query-registry.v1.json
config/literature/taxonomy.v1.json
config/literature/topic-rules.v1.json
docs/literature-curation-policy.md
docs/literature-import-runbook.md
docs/literature-module-architecture.md
docs/literature-phase-1-completion-report.md
scripts/literature/generate-import-report.ts
scripts/literature/generate-manifest.ts
scripts/literature/import-nbib.ts
scripts/literature/lib/cli.ts
scripts/literature/lib/config.ts
scripts/literature/lib/database.ts
scripts/literature/lib/files.ts
scripts/literature/lib/input.ts
scripts/literature/lib/report.ts
scripts/literature/lib/validation.ts
scripts/literature/run-rule-suggestions.ts
scripts/literature/seed-taxonomy.ts
scripts/literature/validate-nbib.ts
src/app/[locale]/admin/literature/article/[pmid]/page.tsx
src/app/[locale]/admin/literature/page.tsx
src/app/[locale]/literature/article/[pmid]/page.tsx
src/app/[locale]/literature/layout.tsx
src/app/[locale]/literature/loading.tsx
src/app/[locale]/literature/methods/page.tsx
src/app/[locale]/literature/page.tsx
src/app/api/admin/literature/article/[pmid]/route.ts
src/app/api/admin/literature/bulk-review/route.ts
src/app/api/literature/article/[pmid]/route.ts
src/app/api/literature/search/route.ts
src/features/literature/__tests__/cli.test.ts
src/features/literature/__tests__/config.test.ts
src/features/literature/__tests__/database-contract.test.ts
src/features/literature/__tests__/database-integration.test.ts
src/features/literature/__tests__/nbib-parser.test.ts
src/features/literature/__tests__/normalize.test.ts
src/features/literature/__tests__/release-boundary.test.ts
src/features/literature/__tests__/search-schema.test.ts
src/features/literature/__tests__/topic-suggestions.test.ts
src/features/literature/__tests__/validation.test.ts
src/features/literature/components/LiteraturePagination.tsx
src/features/literature/components/LiteratureResultCard.tsx
src/features/literature/components/LiteratureReviewForm.tsx
src/features/literature/components/LiteratureSearchForm.tsx
src/features/literature/config/index.ts
src/features/literature/constants.ts
src/features/literature/domain/display.ts
src/features/literature/domain/journal-registry.ts
src/features/literature/domain/nbib-parser.ts
src/features/literature/domain/normalize.ts
src/features/literature/domain/text.ts
src/features/literature/domain/topic-suggestions.ts
src/features/literature/schemas/config.ts
src/features/literature/schemas/search.ts
src/features/literature/search/page-params.ts
src/features/literature/search/url.ts
src/features/literature/server/access.test.ts
src/features/literature/server/access.ts
src/features/literature/server/database-mappers.ts
src/features/literature/server/http.ts
src/features/literature/server/queries.ts
src/features/literature/server/types.ts
src/features/literature/types.ts
supabase/.gitignore
supabase/config.toml
supabase/migrations/20260727032621_add_literature_explorer.sql
tests/fixtures/literature/complex.nbib
tests/fixtures/literature/duplicate-a.nbib
tests/fixtures/literature/duplicate-b.nbib
tests/fixtures/literature/malformed.nbib
tests/fixtures/literature/simple.nbib
```
