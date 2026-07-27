# IP Literature Explorer: Phase 1 Architecture

## Status and scope

This document records the repository audit and implemented design for the Phase 1 literature
foundation. Phase 1 is an administrator-only vertical slice: ingest PubMed Citation Manager
exports, preserve retrieval provenance, suggest (but do not confirm) IP topics, curate records,
and search approved bibliographic metadata with PostgreSQL full-text search.

The module is a curated discovery aid. It is not a systematic-review search, does not provide
patient-specific advice, and does not rank devices, procedures, or articles by clinical quality.
AI classification, embeddings, natural-language query planning, full-text PDF ingestion, and
article summaries are explicitly deferred.

## Repository audit

### Runtime and package manager

- Package: `interventionalpulm@0.1.0`
- Package manager declared by the repository: `npm@10.8.2`
- Node engine: `>=20.19.0`
- Audit runtime: Node `v26.5.0`, npm `11.17.0`
- Next.js: `16.2.2` with the App Router
- React: `^19.0.0`
- TypeScript: `^5.5.4`, strict mode
- Supabase JavaScript: `^2.76.1`
- Supabase SSR: `^0.7.0`
- Supabase CLI: `2.88.1`
- `next-intl`: `^4.13.0`
- Zod: `^3.23.8`
- Jest: `^30.3.0`

No dependency upgrade is planned for this feature. The current `tsx`, Zod, Jest, Supabase, and
Node standard-library APIs cover the Phase 1 requirements.

### Supabase access patterns

- `src/lib/supabase/server.ts` creates the cookie-aware SSR client and is used to authenticate the
  current user and query user-visible entitlement rows.
- `src/lib/supabase/admin.ts` creates a server-only service-role client and returns `null` when
  server credentials are not configured.
- `src/lib/supabase/browser.ts` owns browser clients and uses only public configuration.
- Existing server APIs authenticate with the SSR client, authorize the request, and then use the
  service-role client for privileged operations.
- Existing private tables enable RLS, revoke `anon`/`authenticated`, and grant only the required
  access to `service_role`.

The literature implementation preserves that boundary. The service-role key is used only in
server-only code and command-line import scripts. It is never referenced by a client component or
returned in a response.

### Administrator authorization

`site_admin` is a row in `public.site_entitlements`. The current pattern:

1. Resolve the authenticated user with `supabase.auth.getUser()`.
2. Require a confirmed email.
3. Query an active, unexpired `site_admin` entitlement.
4. Redirect page requests to the localized login/dashboard flow or return JSON `401`/`403` for
   API requests.

`src/proxy.ts` deliberately bypasses authorization for `/api/*`, so every literature API route
must perform its own server-side administrator check. Page/layout checks are defense in depth,
not a replacement for API authorization.

### Locale and message pattern

- Active locales are `en`, `es`, and `zh-CN`.
- Stable route slugs are localized by the existing path helpers, not translated.
- Visible application strings live in `messages/{locale}.json` and are consumed through
  `next-intl`.
- Server metadata can use `localizeHandoffServerValue`; module UI will use an explicit
  `literature` message namespace.
- Article titles, abstracts, authors, journal names, citations, MeSH terms, and keywords remain in
  their source language.
- Stable topic IDs are language-independent. Topic labels fall back to English when a clinically
  reviewed translation is unavailable.

### Draft and unreleased visibility

`src/lib/draft-modules.ts` hides configured draft paths from normal navigation while allowing
development/admin visibility. For this phase, the stronger approved boundary applies:

- `/[locale]/literature`, all article/detail/methods routes, and `/[locale]/admin/literature` are
  `site_admin` only.
- Literature is not added to normal public navigation.
- Literature paths are marked `noindex`.
- Public-query semantics are nevertheless implemented and tested so a later release migration can
  expose only `included` + `published` records.

## Baseline validation (before feature edits)

Run from a clean worktree based on `origin/main`:

| Command                   | Result                                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`             | Passed; lockfile unchanged. npm reported 41 dependency audit findings already present in the lockfile.                                                                              |
| `npm run type-check`      | Failed because `contentlayer/generated` does not exist in a fresh worktree; the missing generated types produce follow-on implicit-`any` errors in existing board-review/MDX files. |
| `npm test -- --runInBand` | Passed: 256 suites, 1,826 tests.                                                                                                                                                    |
| `npm run lint`            | Passed with 14 existing warnings and no errors.                                                                                                                                     |

The final validation will run `npm run build:content` before type-checking, plus the repository
build. Unrelated baseline failures will remain separate from literature failures.

## Implemented source layout

```text
config/literature/
  import-manifest.example.json
  pubmed-query-registry.v1.json
  taxonomy.v1.json
  topic-rules.v1.json
docs/
  literature-module-architecture.md
  literature-import-runbook.md
  literature-curation-policy.md
local-data/literature/                 # ignored
  import-manifest.json
  nbib/
  reports/
scripts/literature/
  generate-import-report.ts
  generate-manifest.ts
  import-nbib.ts
  run-rule-suggestions.ts
  seed-taxonomy.ts
  validate-nbib.ts
src/app/
  [locale]/literature/
    layout.tsx
    loading.tsx
    page.tsx
    article/[pmid]/page.tsx
    methods/page.tsx
  [locale]/admin/literature/
    page.tsx
    article/[pmid]/page.tsx
  api/literature/
    search/route.ts
    article/[pmid]/route.ts
  api/admin/literature/
    article/[pmid]/route.ts
    bulk-review/route.ts
src/features/literature/
  __tests__/
  components/
  config/
  domain/
  schemas/
  search/
  server/
  types.ts
supabase/migrations/
  *_add_literature_explorer.sql
tests/fixtures/literature/
```

Literature-specific calculations, parser normalization, schema validation, database queries, and
React components remain separate. Client components receive bounded, display-safe data only.

## Database design

The migration creates:

- `literature_journals`: versioned journal registry rows and stable aliases.
- `literature_articles`: PMID-keyed normalized bibliographic metadata, curation state, flags,
  source metadata hash, and weighted `tsvector`.
- `literature_import_batches`: immutable file/run identity, checksums, bounded-run identity,
  counters, and reports.
- `literature_article_sources`: every retrieval source/batch for each PMID.
- `literature_topics`: flattened, stable taxonomy nodes with parent relationships and localized
  labels.
- `literature_article_topics`: versioned query/rule/AI/human assignments; suggestions remain
  distinct from confirmations.
- `literature_curation_events`: append-only human decision audit trail.
- `literature_import_errors`: bounded, nonfatal record/import errors.

PMID is canonical for PubMed records. DOI is normalized and audited but is not unique. Bibliographic
upserts update source fields only when the deterministic metadata hash changes; human relevance,
visibility, landmark, and topic decisions are never overwritten.

The optional `record_limit` is part of import-batch identity. A bounded validation/sample run
therefore cannot cause a later full-file import with the same checksum to be skipped.

### Search

`search_literature_v1` accepts validated text, filters, sort, and pagination inputs. It uses:

- a weighted `tsvector` (title highest; MeSH/keywords high; abstract medium; citation identifiers
  and authors lower);
- `websearch_to_tsquery('english', ...)` for safe user-entered syntax;
- a GIN index on the search vector;
- trigram indexing on normalized title for duplicate review;
- B-tree/GIN indexes for workflow, journal, year, publication type, and topic filters.

The brief requires page-number metadata, so Phase 1 uses bounded `LIMIT/OFFSET` with `page_size <=
50`. This is acceptable for the initial curated corpus and preserves shareable `page` URLs.
Cursor pagination should replace deep page offsets if production query plans show degradation.

Public-mode search always filters to `relevance_state = 'included'` and
`visibility_state = 'published'`. Administrator preview may include other states only after the
server API verifies `site_admin`.

## Security model

- RLS is enabled on every literature table.
- No literature table is directly readable or writable by `anon` or `authenticated` in Phase 1.
- Explicit grants expose only the minimum required tables/functions to `service_role`.
- The search function is `SECURITY INVOKER`, has a fixed search path, and is executable only by
  `service_role` during the administrator-only phase.
- Browser clients never construct SQL. All request parameters and mutation payloads are parsed by
  shared Zod schemas.
- Bibliographic input is untrusted: line length, field size, record size, import batch size, and
  report excerpt length are bounded.
- Imported text renders through normal React text nodes. Search snippets are plain text; no
  bibliographic HTML and no `dangerouslySetInnerHTML`.
- API errors do not include database objects, environment values, classifier payloads, or raw
  NBIB tags.
- Remote writes require `--commit --target remote --confirm-remote`. With no write flag, import is
  a dry run.

The 2026 Supabase Data API default change makes explicit grants necessary for new tables. This
migration does not depend on legacy automatic grants.

## Import and provenance strategy

The supplied corpus remains untouched under the user's existing `IP_PubMed/nbib files/` archive.
`local-data/literature/` and that raw NBIB directory are ignored.

The manifest generator can map only exact, unambiguous source/query IDs or curated filename aliases.
Everything else is emitted as:

```json
{
  "source_kind": "unmapped",
  "source_id": null,
  "query_id": null,
  "status": "needs_mapping"
}
```

Unmapped files can be validated and reported but are not represented as a known source. The actual
manifest and generated reports stay local.

The parser is an async, line-oriented Node implementation. It preserves repeated/unknown fields,
recognizes common PubMed and PMC tags, joins continuation lines deterministically, quarantines
missing PMID records, and enforces bounded input sizes. Imports run in bounded database batches;
each batch uses conflict-safe upserts and checksum-plus-record-limit idempotency.

## Phase boundaries

### Phase 1 (this branch)

- Migration, constraints, RLS, grants, indexes, and lexical-search RPC.
- Versioned registry, taxonomy, topic-rule configuration, and local manifest schema.
- Streaming NBIB parsing, normalization, validation, reports, idempotent import, and provenance.
- Query/rule topic suggestions only.
- Administrator review queue and audited single-record curation.
- Administrator-only search, article detail, and methods/coverage pages.
- Unit, route/schema, migration-contract, and available local database tests.

### Phase 2 (deferred)

- Provider-neutral AI classifier and structured output.
- Versioned prompts, validation set, expert adjudication, and calibrated thresholds.
- No automatic exclusion until physician-approved false-negative review is complete.

### Phase 3 (deferred)

- Provider-selected embedding dimension and a separate pgvector migration.
- Hybrid lexical/vector retrieval and validated natural-language filter planning.
- Retrieval benchmark and public-release migration/navigation.

## Migration and rollout strategy

1. Generate one Phase 1 migration through the repository's Supabase CLI.
2. Apply the Phase 1 migration to an isolated local Supabase verification project. The main
   repository migration chain currently stops earlier on a pre-existing learner-profile
   dependency; see the verification findings below.
3. Seed journals/topics through idempotent scripts rather than embedding mutable taxonomy data in
   UI components.
4. Import fixtures twice and prove no duplicate articles or source links.
5. Dry-run the real corpus; import only a bounded sample locally.
6. Keep all routes administrator-only and all imported records `draft`/`unreviewed`.
7. In a later reviewed release, add a separate migration and navigation change for approved public
   reads; do not weaken Phase 1 RLS in place.

## Known assumptions and unresolved issues

- The supplied 614 MB corpus contains 67 NBIB files but no completed provenance manifest.
  Ambiguous files remain `needs_mapping` pending editorial confirmation.
- Query-registry seed topic IDs use underscores while taxonomy IDs use hyphens and, in several
  cases, different clinical names. A committed explicit alias map will resolve only reviewed
  equivalents; no punctuation-based guessing.
- PubMed abstract redistribution policy is unresolved. The default remains `snippet_only`; full
  abstracts are stored for indexing/curation but not publicly rendered.
- Registry topic labels currently have English source data. Spanish and Simplified Chinese UI
  chrome will be localized, while topic labels use English fallback until clinically reviewed.
- The repository did not contain `supabase/config.toml` on `origin/main`; this branch adds a
  project-local configuration with non-default ports so it can coexist with other local stacks.
- The full pre-existing migration chain cannot currently reset from a blank database:
  `20260430180000_add_socal_ebus_email_notifications.sql` references
  `public.learner_profiles`, which is absent at that point in the chain. The literature migration
  is therefore also tested from a clean, isolated Supabase project without changing that unrelated
  historical migration.
- The project runtime used for this audit is newer than the declared npm version. No package-manager
  metadata will be changed as part of this feature.
- A real remote import is deliberately out of scope without a separate explicit confirmation.

## Verification findings

The final dry-run validation covered all 67 supplied NBIB files without modifying them:

- 175,916 record occurrences and 132,350 unique PMIDs;
- 43,511 duplicate PMID occurrences across files;
- 28 records missing PMID and 27 missing title;
- 41,323 records without an abstract;
- 62,262 unmatched-journal occurrences across 3,050 source labels;
- one conflicting DOI and 320 actionable parse/normalization issues in total.

Because the source/query manifest has not been editorially mapped, all 175,916 occurrences remain
explicitly labeled `needs_mapping`. A separate 100-record local sample demonstrated successful
commit, checksum idempotency on replay, and rule suggestion generation without a remote write.
