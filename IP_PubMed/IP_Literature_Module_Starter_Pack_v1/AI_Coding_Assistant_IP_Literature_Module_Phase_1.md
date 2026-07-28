# AI Coding Assistant Implementation Brief

## IP Literature Explorer for interventionalpulm.com

**Target repository:** `russellmiller49/Interventional-Pulm-Education-Project`  
**Recommended branch:** `feat/ip-literature-explorer`  
**Implementation strategy:** build the ingestion, data, review, and lexical-search foundation first; add AI classification and semantic/natural-language search only after the foundation is tested.

---

# 1. Your role

Act as the senior full-stack engineer responsible for adding a production-quality literature discovery module to the existing interventionalpulm.com application.

Work directly in the current repository and follow its existing architecture and conventions. Do not create a separate application. Do not replace working infrastructure. Do not perform broad refactors unrelated to this module.

Before writing code, inspect the repository files listed in §4 and document the implementation plan in `docs/literature-module-architecture.md`. Then proceed with Phase 1 without waiting for additional approval unless a genuinely blocking conflict is discovered.

---

# 2. Product objective

Build an **IP Literature Explorer** that lets clinicians search a curated collection of interventional pulmonology articles collected from:

1. Complete exports from selected core respiratory/IP journals.
2. Topic-filtered exports from selected expanded journals.
3. Broad All-PubMed discovery searches covering the major interventional pulmonology domains.
4. Later, manually curated foundational or landmark articles not completely represented in PubMed.

The available source files are PubMed Citation Manager exports in `.nbib` format. Many records occur in more than one file. The system must deduplicate them while preserving every source/query that discovered each record.

The eventual public product should support:

- Fast keyword and filtered search.
- Multi-label IP topic categorization.
- AI-assisted relevance screening with expert review.
- Natural-language query interpretation.
- Hybrid lexical and semantic retrieval.
- Topic pages, article detail pages, and transparent coverage/methods information.

The module is a **curated discovery aid**, not a substitute for a formal systematic-review search. The UI and methods page must make that distinction clear.

---

# 3. Non-negotiable repository constraints

Use the current repository stack rather than introducing a second stack:

- Next.js App Router and React already present in the repository.
- TypeScript.
- `npm`, not `pnpm` or Yarn.
- Supabase/PostgreSQL using the existing Supabase clients and SQL migrations.
- `next-intl` and the repository’s locale/path helpers.
- Zod for request and model-output validation.
- Jest and the existing lint/type-check/build commands.
- Existing site administration and `site_admin` entitlement patterns.

Do **not** introduce Prisma. Do **not** add an external vector database. Do **not** load the full article corpus into the browser or use client-side Fuse.js for corpus-scale search. Do **not** upgrade Next.js, React, Supabase, or unrelated dependencies as part of this work.

Use existing dependencies whenever possible. A custom NBIB parser can be implemented with Node standard-library APIs, so a parsing package should not be necessary.

Do not expose `SUPABASE_SERVICE_ROLE_KEY` to client code. It may be used only in server-side scripts and server-only administrative code consistent with the existing repository pattern.

---

# 4. Mandatory repository audit before implementation

Inspect at least these files and directories before making architectural decisions:

```text
package.json
src/lib/supabase/admin.ts
src/lib/supabase/server.ts
src/lib/supabase/browser.ts
src/lib/site-auth/access.ts
src/proxy.ts
src/components/layout/Navigation.tsx
src/app/[locale]/admin/page.tsx
src/app/[locale]/dashboard/page.tsx
src/app/[locale]/journal-club-podcasts/page.tsx
src/i18n/locale.ts
src/i18n/
supabase/migrations/
src/lib/draft-modules.ts or the current draft-module visibility implementation
```

Also inspect one existing feature that uses:

- A Supabase migration.
- A server-side API route.
- An admin-only page.
- Localized metadata and visible strings.
- Repository tests.

Record the following in `docs/literature-module-architecture.md`:

- Current versions and package manager.
- Existing Supabase access patterns.
- Existing admin authorization pattern.
- Existing locale/message-file pattern.
- How draft or unreleased modules are hidden.
- Proposed file layout.
- Proposed schema and security model.
- Phase boundaries and migration strategy.
- Known assumptions and unresolved issues.

Run the current baseline commands before editing and record any pre-existing failures separately from failures caused by this module:

```bash
npm install
npm run type-check
npm test
npm run lint
```

Do not “fix” unrelated baseline failures unless they block this feature. Document them instead.

---

# 5. Input files and source provenance

The user has multiple `.nbib` exports, often split by journal, discovery query, and date range. The repository may also receive:

```text
IP_PubMed_Query_Pack_v1.md
ip_pubmed_query_registry_v1.json
literature_taxonomy_v1.json
```

Create these locations:

```text
config/literature/pubmed-query-registry.v1.json
config/literature/taxonomy.v1.json
config/literature/import-manifest.example.json
local-data/literature/nbib/
local-data/literature/import-manifest.json
local-data/literature/reports/
```

Requirements:

- Add `local-data/literature/` to `.gitignore`.
- Never commit the raw `.nbib` exports.
- Never commit Supabase credentials or model/API credentials.
- Commit only the example manifest, registry, taxonomy, fixtures, code, migrations, and documentation.
- The actual manifest is local and ignored.

The NBIB files do not reliably preserve the PubMed query that produced them. Therefore, provenance must come from an explicit manifest rather than assumptions based only on article content.

Implement a manifest schema resembling:

```json
{
  "manifest_version": "1.0.0",
  "query_registry_version": "1.0.0",
  "files": [
    {
      "path": "local-data/literature/nbib/core_chest_2000_2004.nbib",
      "source_kind": "core_journal",
      "source_id": "chest",
      "query_id": "core_chest",
      "date_from": "2000-01-01",
      "date_to": "2004-12-31",
      "notes": null
    }
  ]
}
```

Supported `source_kind` values should initially include:

```text
core_journal
expanded_journal
all_pubmed_discovery
manual_landmark
publisher_supplement
unmapped
```

Create a manifest-generation command that scans a directory and proposes entries. It may infer a mapping only when the filename contains an exact, unambiguous known source/query ID. Ambiguous files must be marked `unmapped` or `needs_mapping`; never silently guess their provenance.

---

# 6. Phased delivery plan

## Phase 1: Foundation and lexical-search vertical slice

Implement in the first pull request:

1. Supabase schema and indexes.
2. Robust, tested `.nbib` parsing and normalization.
3. Idempotent import and provenance tracking.
4. Import-validation and reporting commands.
5. Versioned literature taxonomy seed.
6. Rule/query-derived topic **suggestions**, clearly distinguished from confirmed labels.
7. An admin-only review queue.
8. Server-side full-text search.
9. A draft/admin-preview literature search page.
10. An article detail page and methods/coverage page.
11. Tests, documentation, and package scripts.

The module should remain hidden through the existing draft-module mechanism or accessible only to site administrators until records have been classified and reviewed. Do not add an empty or uncurated module to the normal public navigation.

## Phase 2: AI relevance and multi-label classification

Implement only after Phase 1 works with real imports:

1. Provider-neutral structured AI classifier.
2. Versioned classification prompts and Zod output schema.
3. Human adjudication and correction workflow.
4. Validation set and performance reporting.
5. Calibrated automation thresholds.

## Phase 3: Semantic and natural-language search

Implement only after classification quality is acceptable:

1. Embedding provider abstraction.
2. Supabase pgvector column/index using the chosen model’s actual dimension.
3. Hybrid lexical + vector ranking.
4. Natural-language query-to-filter planning.
5. Retrieval benchmark and regression suite.
6. Public release and navigation integration.

Do not collapse all three phases into one large, unreviewable change.

---

# 7. Proposed feature organization

Use a feature-oriented structure consistent with the existing application:

```text
src/
  app/
    [locale]/
      literature/
        page.tsx
        article/[pmid]/page.tsx
        methods/page.tsx
      admin/
        literature/
          page.tsx
          articles/[pmid]/page.tsx
    api/
      literature/
        search/route.ts
        article/[pmid]/route.ts
      admin/
        literature/
          article/[pmid]/route.ts
          bulk-review/route.ts
  features/
    literature/
      components/
      domain/
      schemas/
      server/
      search/
      curation/
      config/
      types.ts
      constants.ts

scripts/
  literature/
    generate-manifest.ts
    validate-nbib.ts
    import-nbib.ts
    seed-taxonomy.ts
    run-rule-suggestions.ts
    generate-import-report.ts

config/
  literature/
    pubmed-query-registry.v1.json
    taxonomy.v1.json
    import-manifest.example.json

supabase/
  migrations/
    <timestamp>_add_literature_explorer.sql

src/features/literature/__tests__/
tests/fixtures/literature/
docs/literature-module-architecture.md
docs/literature-import-runbook.md
docs/literature-curation-policy.md
```

Adjust names only when repository conventions clearly require a different location. Keep all literature-specific server logic out of client components.

---

# 8. Database design

Create a Supabase migration. Prefer text columns with check constraints for workflow states rather than PostgreSQL enum types, because workflow states may evolve.

## 8.1 `literature_journals`

Suggested fields:

```text
id text primary key
canonical_name text not null
pubmed_abbreviation text
nlm_id text
issn_print text
issn_electronic text
source_tier text check (...)
active_from integer
active_to integer
notes text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Seed from the supplied query registry. Preserve predecessor titles as distinct source records when appropriate.

## 8.2 `literature_articles`

Use PMID as the canonical key for PubMed-imported records.

Suggested fields:

```text
pmid text primary key
doi text
pmcid text
title text not null
abstract text
abstract_display_policy text not null default 'snippet_only'
journal_id text references literature_journals(id)
journal_title text
journal_abbreviation text
nlm_journal_id text
issn_values text[] not null default '{}'
publication_date_raw text
publication_year integer
publication_month integer
publication_day integer
publication_date_precision text
publication_types text[] not null default '{}'
mesh_terms text[] not null default '{}'
author_keywords text[] not null default '{}'
languages text[] not null default '{}'
authors jsonb not null default '[]'::jsonb
collective_authors text[] not null default '{}'
affiliations text[] not null default '{}'
volume text
issue text
pages text
article_number text
place_of_publication text
citation_source text
conflict_of_interest text
pubmed_status text
pubmed_last_revised_at timestamptz
pubmed_created_at timestamptz
raw_nbib_tags jsonb not null default '{}'::jsonb
metadata_hash text not null
normalized_title text not null
normalized_title_hash text not null
relevance_state text not null default 'unreviewed'
visibility_state text not null default 'draft'
is_landmark boolean not null default false
is_retracted boolean not null default false
is_correction boolean not null default false
is_conference_abstract boolean not null default false
manual_override boolean not null default false
classifier_version text
classifier_payload jsonb
search_vector tsvector
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Recommended checks:

```text
relevance_state in ('unreviewed', 'candidate', 'included', 'excluded')
visibility_state in ('draft', 'published', 'hidden')
abstract_display_policy in ('hidden', 'snippet_only', 'full_allowed')
publication_date_precision in ('day', 'month', 'year', 'season', 'unknown')
```

Do not enforce a unique DOI constraint. PMID is the PubMed canonical identifier. DOI collisions should be reported for review, not automatically merged.

Do not discard records without abstracts. Store them and flag them for title-only review.

## 8.3 `literature_import_batches`

Suggested fields:

```text
id uuid primary key default gen_random_uuid()
source_filename text not null
source_file_sha256 text not null
manifest_version text not null
query_registry_version text
source_kind text not null
source_id text
query_id text
date_from date
date_to date
status text not null default 'started'
records_read integer not null default 0
unique_pmids integer not null default 0
inserted_count integer not null default 0
updated_count integer not null default 0
duplicate_count integer not null default 0
error_count integer not null default 0
started_at timestamptz not null default now()
completed_at timestamptz
report jsonb
created_by text
```

Add a unique constraint on the file SHA-256 plus manifest/query identity sufficient to make reruns idempotent. A completed batch with the same checksum should be skipped unless an explicit `--force` option is supplied.

## 8.4 `literature_article_sources`

This is essential because the same article may be retrieved by multiple journal and discovery searches.

Suggested fields:

```text
pmid text references literature_articles(pmid) on delete cascade
batch_id uuid references literature_import_batches(id) on delete cascade
source_kind text not null
source_id text
query_id text
source_filename text not null
first_seen_at timestamptz not null default now()
primary key (pmid, batch_id)
```

Do not overwrite prior provenance when a record is encountered again.

## 8.5 `literature_topics`

Suggested fields:

```text
id text primary key
parent_id text references literature_topics(id)
label_en text not null
label_es text
label_zh_cn text
description_en text
synonyms text[] not null default '{}'
taxonomy_version text not null
sort_order integer not null default 0
active boolean not null default true
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Topic IDs are stable, language-independent identifiers. Never use translated labels as keys.

## 8.6 `literature_article_topics`

Suggested fields:

```text
pmid text references literature_articles(pmid) on delete cascade
topic_id text references literature_topics(id)
confidence numeric
assignment_source text not null
assignment_state text not null default 'suggested'
model_or_rule_version text
evidence jsonb
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
primary key (pmid, topic_id, assignment_source, model_or_rule_version)
```

Recommended checks:

```text
assignment_source in ('query', 'rule', 'ai', 'human')
assignment_state in ('suggested', 'confirmed', 'rejected')
confidence between 0 and 1 when not null
```

A discovery-query match is only a weak suggestion. It is not a confirmed article category.

## 8.7 `literature_curation_events`

Create an immutable audit log for manual changes:

```text
id uuid primary key default gen_random_uuid()
pmid text references literature_articles(pmid) on delete cascade
actor_user_id uuid
actor_email text
event_type text not null
before_value jsonb
after_value jsonb
reason text
created_at timestamptz not null default now()
```

Every manual relevance, visibility, landmark, and topic decision should create an event.

## 8.8 `literature_import_errors`

Store nonfatal parsing or import errors without aborting the entire corpus:

```text
id uuid primary key default gen_random_uuid()
batch_id uuid references literature_import_batches(id) on delete cascade
source_filename text
record_number integer
pmid text
error_code text not null
error_message text not null
raw_excerpt text
created_at timestamptz not null default now()
```

Limit raw excerpts to a safe length and do not include secrets.

---

# 9. Database search and indexing

Phase 1 search must be server-side PostgreSQL full-text search. Never download the corpus into the browser.

Enable only the extensions needed by the chosen implementation, using the repository/Supabase convention. Likely candidates are:

```text
pg_trgm
unaccent
```

Do not enable the vector extension until Phase 3 and until the embedding dimension is known.

Create a trigger or generated/search-maintenance function that weights fields approximately as follows:

- Title: highest weight.
- Author keywords and MeSH: high weight.
- Abstract: medium weight.
- Journal, DOI, PMID, and author names: lower but searchable weight.

Add:

- GIN index on `search_vector`.
- Index on `publication_year`.
- Index on `journal_id`.
- Index on `(relevance_state, visibility_state)`.
- GIN indexes on arrays that are used as filters.
- Trigram index on normalized title for duplicate auditing and fuzzy title search.

Create a versioned database function or server query named similarly to `search_literature_v1` with validated parameters:

```text
query text
journal_ids text[]
topic_ids text[]
year_from integer
year_to integer
publication_types text[]
landmark_only boolean
sort text
page integer
page_size integer
admin_preview boolean
```

Rules:

- `page_size` defaults to 20 and must never exceed 50.
- Public results include only `relevance_state='included'` and `visibility_state='published'`.
- Admin preview may include draft/unreviewed records but must require existing `site_admin` authorization.
- Supported sort values: `relevance`, `newest`, `oldest`, and optionally `journal`.
- Empty text query plus filters is valid and defaults to newest first.
- Cap query length and reject malformed filter values.
- Return total count and page metadata.
- Do not return raw classifier payloads, raw NBIB tags, internal notes, or service-level data in public responses.

Use plain-text snippets. Do not return unsanitized HTML and do not use `dangerouslySetInnerHTML` for search highlighting.

---

# 10. NBIB parser requirements

Implement a dedicated parser with unit tests. Do not parse NBIB using naive `split('\n\n')` logic alone.

The parser must:

1. Read files as UTF-8.
2. Support large files without loading the entire corpus into browser memory; process file-by-file and preferably stream line-by-line.
3. Recognize a field line matching the NBIB tag pattern, such as `PMID- 12345678` or `TI  - Title`.
4. Treat indented lines without a new tag as continuations of the preceding field occurrence.
5. Preserve repeated fields as arrays.
6. Start/finalize records reliably around PMID boundaries and blank record separators.
7. Preserve unknown tags in `raw_nbib_tags` rather than discarding them.
8. Quarantine records missing a PMID rather than assigning an invented identifier.
9. Produce deterministic normalized output.

Explicitly support at least these common tags when present:

```text
PMID OWN STAT DCOM LR IS VI IP DP TI PG LID AB CI
FAU AU CN AD LA PT PL TA JT JID SB MH OT COIS
EDAT MHDA CRDT PHST AID PST SO RIN ROF CRI SI
```

Normalization rules:

### PMID

- Store as trimmed text.
- It is required for normal import.
- Never coerce an invalid PMID to zero.

### DOI

- Search repeated `LID` and `AID` fields for values marked `[doi]`.
- Strip the `[doi]` suffix, optional `doi:` prefix, surrounding whitespace, and trailing punctuation.
- Lowercase for normalized comparison while preserving enough source metadata for audit.
- Report multiple conflicting DOI candidates.

### Title

- Join wrapped continuation lines with spaces.
- Normalize repeated whitespace.
- Preserve punctuation and Unicode.
- Create a separate normalized title for matching; do not display the normalized form.

### Abstract

- Join continuation lines without destroying section labels.
- Normalize accidental repeated whitespace while preserving readable section breaks when possible.
- Store null when absent.
- Do not fabricate an abstract or summary.

### Authors

- Prefer repeated `FAU` values for full names.
- Retain `AU` values as abbreviated names when useful.
- Preserve `CN` collective authors separately.
- Store `AD` values as affiliations without assuming a reliable one-to-one mapping to authors unless the format proves it.

### Journal

- Preserve `JT`, `TA`, `JID`, and `IS` values.
- Resolve to a registry journal only through explicit identifiers/aliases.
- Report unmatched journals rather than silently assigning the wrong registry entry.

### Publication date

- Store the original `DP` value.
- Parse year, month, and day only when actually present.
- Examples such as seasons, ranges, or year-only values must not be converted into invented dates.
- Store a date-precision field.

### Arrays

- Deduplicate exact repeated MeSH terms, keywords, publication types, languages, affiliations, and identifiers while preserving stable order.

### Retractions, corrections, and conference abstracts

- Derive flags conservatively from publication types and explicit related-record fields.
- Preserve related-record tags for later retraction/correction linking.
- Do not infer a retraction from title wording alone unless separately flagged for review.

### Metadata hash

- Create a stable hash from source-controlled bibliographic fields. This hash determines whether a previously imported PMID actually changed and needs reprocessing.
- Manual relevance/topic decisions must never be overwritten by a metadata refresh.

---

# 11. Import command requirements

Add package scripts similar to:

```json
{
  "literature:manifest": "tsx scripts/literature/generate-manifest.ts",
  "literature:validate": "tsx scripts/literature/validate-nbib.ts",
  "literature:import": "tsx scripts/literature/import-nbib.ts",
  "literature:seed-taxonomy": "tsx scripts/literature/seed-taxonomy.ts",
  "literature:suggest-topics": "tsx scripts/literature/run-rule-suggestions.ts"
}
```

Exact names may follow repository conventions, but retain separate commands for validation and committed import.

The importer must support:

```text
--manifest <path>
--file <path>
--directory <path>
--dry-run
--commit
--force
--limit <n>
--batch-size <n>
--target local|remote
--confirm-remote
```

Safety behavior:

- Default to dry-run when neither `--dry-run` nor `--commit` is supplied.
- A remote write requires both `--commit` and `--confirm-remote`.
- Print the target Supabase hostname and planned record count before writing.
- Never truncate tables.
- Never delete records because they are absent from one import file.
- Upsert bibliographic metadata by PMID.
- Do not overwrite human curation fields.
- Use bounded batches, such as 250-500 records, and retry transient failures with capped backoff.
- Continue after nonfatal record errors and include them in the report.
- Skip a previously completed identical file checksum unless `--force` is explicitly provided.

The final report for each validation/import run must include:

```text
files scanned
records parsed
unique PMIDs
duplicate record occurrences
records without PMIDs
records without titles
records without abstracts
insert candidates
update candidates
unchanged records
unmatched journals
conflicting DOI candidates
source/query mappings
parse errors
elapsed time
```

Write a machine-readable JSON report to `local-data/literature/reports/` and print a concise human-readable summary.

Idempotency acceptance test:

1. Import a fixture or local batch.
2. Re-run the identical import.
3. The second run creates no duplicate articles or article-source links and reports zero bibliographic changes unless source data actually changed.

---

# 12. Initial topic suggestions without AI

The supplied taxonomy is multi-label. An article can belong to several topics.

In Phase 1, create **suggestions**, not final labels, from two sources:

1. The discovery query that found the article.
2. High-precision deterministic terms in title, abstract, MeSH, or author keywords.

Examples:

- `EBUS-TBNA`, `endobronchial ultrasound`, and `EUS-B` can suggest EBUS/mediastinal staging.
- `robotic bronchoscopy`, `electromagnetic navigation`, `cone-beam CT`, `CBCT`, and `radial EBUS` can suggest peripheral navigation/imaging.
- `central airway obstruction`, `rigid bronchoscopy`, and explicit debulking modalities can suggest central airway obstruction.
- `airway stent`, `tracheobronchial stent`, and `silicone stent` can suggest airway stents.
- `pleuroscopy`, `medical thoracoscopy`, `indwelling pleural catheter`, and `thoracentesis` can suggest pleural interventions.
- `endobronchial valve` requires a second-stage distinction between emphysema/BLVR and persistent air leak; do not assign only one topic based on that phrase alone.
- `cryobiopsy` requires context to distinguish ILD, peripheral pulmonary lesion biopsy, mediastinal sampling, and endobronchial tumor sampling.

Store the exact matched terms and rule version in `evidence`. Do not auto-exclude articles using Phase 1 rules. Do not mark query-derived or rule-derived suggestions as human-confirmed.

Create the rule configuration as versioned data rather than scattering regular expressions across components.

---

# 13. Admin review experience

Create an administrator-only page under the existing admin structure, such as:

```text
/[locale]/admin/literature
```

Use the repository’s existing `site_admin` authorization. Do not create a second admin authentication system.

The initial admin dashboard should show:

- Total imported articles.
- Unique PMIDs.
- Number with and without abstracts.
- Counts by source kind and journal.
- Unreviewed, candidate, included, excluded, draft, published, and hidden counts.
- Topic-suggestion counts.
- Last import batch and status.
- Import errors and unmapped files.

The review queue should support:

- Title, citation, abstract snippet, PMID, DOI, journal, and year.
- Every source/query that retrieved the article.
- Suggested topics with provenance and confidence.
- Include, exclude, or leave unreviewed.
- Publish, keep draft, or hide.
- Add/remove/confirm/reject topics.
- Mark/unmark landmark status.
- Free-text reason for exclusion or unusual decisions.
- Filter by source, journal, year, abstract availability, topic suggestion, and review state.
- Pagination; never render thousands of rows at once.

Every change must create a curation-event audit row. Manual decisions override later rule or AI suggestions. A later metadata refresh must not erase them.

For the first implementation, a clear, reliable review table is more important than polished bulk-workflow complexity. Bulk actions may be added after single-record actions are tested.

---

# 14. Draft literature-search UI

Create these routes:

```text
/[locale]/literature
/[locale]/literature/article/[pmid]
/[locale]/literature/methods
```

Keep them admin-only or hidden using the current draft-module mechanism until there are reviewed published records.

## Search page

Use shareable URL query parameters:

```text
q
topic
journal
yearFrom
yearTo
publicationType
landmark
sort
page
```

The page should provide:

- One prominent search field.
- Search examples.
- Server-side result count.
- Filters for topic, journal, year, publication type, and landmark status.
- Sort by relevance/newest/oldest.
- Removable filter chips.
- Responsive result list.
- Empty, loading, error, and no-result states.
- Clear indicator when an administrator is previewing draft/unreviewed material.

## Result card

Display:

- Article title.
- First authors or compact author representation.
- Journal, year, volume/issue/pages when available.
- PMID and DOI.
- Short plain-text abstract snippet when available.
- Confirmed topic chips; suggested chips only in admin preview and visibly marked as suggested.
- Study/publication-type chips.
- Landmark badge when curated.
- PubMed and DOI links.
- A deterministic “matched by” explanation based on query terms/filters, not a generated narrative.

Do not display raw classifier rationale to public users.

## Article detail page

Display:

- Full citation metadata.
- Confirmed topics.
- Abstract according to `abstract_display_policy`.
- Source links.
- Retraction/correction/conference-abstract warnings.
- Related articles placeholder for Phase 3.
- Coverage/methodology disclaimer.

Initially use `snippet_only` as the default abstract display policy. Store abstracts for indexing and curation, but do not automatically publish full abstracts until the project’s redistribution policy is settled.

## Methods page

Explain:

- Core, expanded, and All-PubMed discovery layers.
- Date coverage.
- Journals and query registry version.
- Last successful import.
- Number of included and total indexed records.
- AI-assisted classification status.
- Human review role.
- Known coverage gaps, including sources imported outside PubMed when applicable.
- That this is a curated discovery tool rather than a comprehensive systematic-review search.

Generate counts from the database when practical rather than hard-coding them.

---

# 15. Localization and accessibility

Follow the repository’s current locale architecture and active locales.

Requirements:

- Use stable topic IDs and route paths; never use translated strings as identifiers.
- Put visible UI strings into the repository’s established translation/handoff system.
- Maintain working English fallback.
- Do not translate article titles, abstracts, journal names, author names, MeSH terms, or citations in Phase 1.
- Store localized topic labels separately from bibliographic metadata.
- Topic labels may fall back to English until clinically reviewed translations are available.
- Preserve current server/client component boundaries.
- Use semantic headings, associated form labels, keyboard-operable filters, visible focus, and accessible status messaging.
- Do not rely on color alone to distinguish suggested versus confirmed topics.

---

# 16. API and validation requirements

Create shared Zod schemas for:

- Search query parameters.
- Admin article update payloads.
- Bulk review payloads when added.
- Import manifest.
- Taxonomy configuration.
- Later AI classifier output.

Do not allow a language model or browser client to construct SQL.

Validate:

- PMID format.
- Query length.
- Page and page-size bounds.
- Year range.
- Known topic and journal IDs.
- Supported sort values.
- Admin update states.

Return consistent JSON errors without exposing database details.

Avoid `any` in new feature code. Prefer narrow domain types and parsing at boundaries.

---

# 17. Security and privacy

- Treat uploaded/local bibliographic files as untrusted text input.
- Limit field and record sizes to prevent pathological imports.
- Escape or render all bibliographic text as plain React text.
- Never use unsanitized HTML from an abstract.
- Keep the Supabase service-role key server-only.
- Keep RLS enabled.
- No broad public write policies.
- Public read access, when released, must expose only approved fields for included/published records.
- Admin APIs must verify the existing `site_admin` entitlement on the server.
- Do not log secrets, access tokens, or complete environment values.
- The corpus contains publications, not patient data; nevertheless, search telemetry should not solicit or store patient identifiers.

---

# 18. Testing requirements

Add focused tests before relying on the real corpus.

## Parser fixtures

Include fixtures covering:

- One simple article.
- Multiline title and abstract.
- Repeated MeSH, keywords, publication types, and authors.
- DOI in `LID`.
- DOI in `AID`.
- Conflicting DOI values.
- Year-only date.
- Month/year date.
- Full date.
- Seasonal or irregular date.
- No abstract.
- Collective author.
- Conference abstract.
- Retraction or correction metadata.
- Unknown tags.
- Malformed record without PMID.
- Duplicate PMID across two files.

## Unit tests

Test:

- NBIB tokenization and continuation handling.
- Normalization.
- DOI extraction.
- Date precision.
- Stable metadata hashing.
- Journal registry matching.
- Manifest validation.
- Rule-derived topic suggestions.
- Search schema validation.
- URL query serialization.

## Database/integration tests

Where the repository supports them, test:

- Migration applies locally.
- Re-import is idempotent.
- Article-source provenance accumulates without duplication.
- Manual curation survives metadata refresh.
- Public search excludes drafts/unreviewed/excluded records.
- Admin preview can see authorized draft records.
- Non-admin access to admin routes is rejected.
- Search ranking favors title matches over abstract-only matches.
- Filters and pagination return stable counts.

Test representative medical queries:

```text
EBUS-TBNA
EUS-B
robotic bronchoscopy
cone-beam CT
CBCT peripheral nodule
airway stent migration
central airway obstruction
indwelling pleural catheter
endobronchial valve persistent air leak
transbronchial cryobiopsy
```

Do not claim clinical classification accuracy from unit tests; that requires the Phase 2 expert-labeled validation set.

---

# 19. Phase 2 AI classification specification

Do not start this until the Phase 1 importer, review queue, and lexical search work with real records.

## 19.1 Provider abstraction

Create a server-only interface such as:

```ts
interface LiteratureClassifier {
  classify(input: LiteratureClassifierInput): Promise<LiteratureClassificationResult>
}
```

Do not couple database code directly to one model vendor. Configuration must come from environment variables. The first implementation may support one provider, but the domain interface and persisted model metadata must remain provider-neutral.

## 19.2 Input

Provide only source metadata required for classification:

```text
PMID
title
abstract
MeSH terms
author keywords
publication types
journal
retrieval query IDs as weak hints
```

The model must not use journal name alone as the reason for inclusion.

## 19.3 Structured output

Validate every model response with Zod. Use a schema similar to:

```json
{
  "ip_relevant": true,
  "relevance_probability": 0.94,
  "relevance_reason_codes": ["ADVANCED_BRONCHOSCOPIC_PROCEDURE", "PERIPHERAL_LESION_DIAGNOSIS"],
  "topics": [
    {
      "id": "peripheral-navigation.robotic-bronchoscopy",
      "probability": 0.98,
      "evidence_terms": ["robotic bronchoscopy"]
    }
  ],
  "clinical_purposes": ["diagnosis"],
  "diseases": ["lung-cancer"],
  "technologies": ["robotic-bronchoscopy"],
  "study_design": "prospective-cohort",
  "publication_class": "full-article",
  "requires_human_review": false,
  "other_relevant_topic": null
}
```

Rules for the classifier prompt:

- Use only supplied metadata.
- Multi-label classification is allowed and expected.
- Quote only short evidence terms present in the title/abstract/keywords.
- Never invent sample size, outcomes, device names, study design, or conclusions.
- Use an explicit uncertainty/review state.
- Use `other_relevant_topic` for emerging concepts that do not fit the taxonomy.
- Distinguish convex EBUS from radial EBUS.
- Distinguish BLVR valves from valves used for persistent air leak.
- Distinguish ILD cryobiopsy from peripheral-lesion, mediastinal, and endobronchial cryobiopsy.
- Routine bronchoscopy/BAL papers are not automatically IP-relevant.

## 19.4 Persistence and reproducibility

Persist:

- Provider.
- Model identifier.
- Prompt version.
- Taxonomy version.
- Input metadata hash.
- Raw validated result.
- Created time.
- Retry/error state.
- Optional usage/cost metadata.

Never overwrite a human decision. A new classifier version creates new suggestions and can be compared with prior versions.

## 19.5 Batch command

Add a command similar to:

```bash
npm run literature:classify -- \
  --state unreviewed \
  --limit 100 \
  --concurrency 3 \
  --prompt-version v1 \
  --dry-run
```

Requirements:

- Bounded concurrency.
- Rate-limit and transient-error handling.
- Resume safely.
- Skip unchanged article/model/prompt combinations.
- Structured failure log.
- Cost estimate before a large committed batch when provider data allow it.
- No automatic hard deletion or permanent exclusion.

During initial validation, all AI decisions remain suggestions requiring review. Do not automatically hide AI-excluded articles.

## 19.6 Gold-standard validation

Create an export/import workflow for expert labels. Initial validation should include a stratified sample containing:

- All major topics.
- Common negative respiratory/critical-care articles.
- Ambiguous bronchoscopy papers.
- Older and newer terminology.
- No-abstract records.
- Conference abstracts.
- Rare technologies.
- Known landmark papers.

Track at minimum:

```text
IP relevance recall
IP relevance precision
per-topic precision/recall/F1
micro and macro F1
manual-review fraction
confusion pairs
false-negative audit
inter-reviewer agreement when dual labels are available
```

Optimize relevance recall before aggressively reducing false positives. No automatic exclusion threshold should be enabled until false negatives have been reviewed and the threshold is explicitly approved.

---

# 20. Phase 3 semantic and natural-language search specification

Do not create a vector column with a guessed dimension.

## 20.1 Embeddings

Create an abstraction similar to:

```ts
interface LiteratureEmbeddingProvider {
  readonly modelId: string
  readonly dimension: number
  embedDocuments(texts: string[]): Promise<number[][]>
  embedQuery(text: string): Promise<number[]>
}
```

Only after a provider/model is selected:

- Enable Supabase `vector` extension.
- Add the correctly dimensioned vector column in a separate migration.
- Store model/version and input hash.
- Create the appropriate vector index.
- Batch embeddings with resume and retry behavior.

The document text should be deterministic and versioned, for example:

```text
TITLE: ...
MESH: ...
KEYWORDS: ...
ABSTRACT: ...
```

## 20.2 Hybrid ranking

Retrieve independent candidate lists from:

1. PostgreSQL lexical search.
2. Vector similarity.

Fuse them using a transparent method such as Reciprocal Rank Fusion. Apply structured filters consistently. Optionally rerank only a small top candidate set later.

Keep lexical search dominant for exact acronyms, device names, authors, PMIDs, DOIs, and trial names.

## 20.3 Natural-language query planning

The language model should produce a validated query plan, not SQL and not a final medical answer.

Example input:

```text
Prospective studies since 2020 using robotic bronchoscopy with cone-beam CT for peripheral nodules
```

Example validated plan:

```json
{
  "semantic_query": "robotic bronchoscopy cone-beam CT peripheral pulmonary lesion",
  "topic_ids": ["peripheral-navigation.robotic-bronchoscopy", "peripheral-navigation.cone-beam-ct"],
  "year_from": 2020,
  "year_to": null,
  "publication_types": ["prospective-cohort", "diagnostic-accuracy"],
  "journal_ids": [],
  "exclude_publication_classes": ["conference-abstract", "editorial"],
  "sort": "relevance"
}
```

Render interpreted filters as removable chips. The user must be able to correct the interpretation without rewriting the entire query.

No language-model output may directly modify SQL, table names, column names, or unrestricted filter expressions.

## 20.4 Retrieval evaluation

Create a benchmark of realistic IP information needs and known relevant records. Compare:

```text
lexical only
semantic only
hybrid
hybrid plus reranking, if added
```

Track:

```text
Recall@10
Recall@20
Precision@10
MRR
nDCG@10
at least one highly relevant result in top 5
expert usefulness rating
```

Do not replace lexical search with semantic search merely because a demo appears fluent.

---

# 21. Explicit exclusions from the first pull request

Do not implement these in Phase 1:

- Full-text PDF ingestion.
- Automated evidence grading.
- Automated risk-of-bias assessment.
- AI-generated article summaries or conclusions.
- Citation-network visualization.
- Email alerts.
- User collections or social features.
- External vector databases.
- Browser-side corpus search.
- Automatic public display of all imported records.
- Automatic AI exclusion.
- Automated claims that an article is “high quality.”
- Publisher scraping.
- Live PubMed synchronization.

The downloaded NBIB corpus is sufficient for the first build. Live synchronization can be designed after the import pipeline is proven.

---

# 22. Definition of done for Phase 1

The first pull request is complete only when all of the following are true:

- A versioned Supabase migration creates the literature tables, indexes, constraints, and security policies.
- The query registry and taxonomy are validated configuration files.
- Raw NBIB files are ignored by Git.
- The parser handles multiline and repeated fields and has fixtures/tests.
- The importer is dry-run by default and remote writes require explicit confirmation.
- Import is idempotent by PMID and file checksum.
- All retrieval-source provenance is preserved.
- A report summarizes corpus size, duplicates, missing abstracts, errors, and source mappings.
- The admin page can review and curate imported records.
- Manual decisions are audited and survive re-import.
- Server-side lexical search works with pagination and filters.
- Public search logic excludes unreviewed/draft/excluded records.
- Draft/admin preview works without exposing administrative data.
- The methods page explains coverage and limitations.
- Visible UI follows the repository’s localization system.
- `npm run type-check`, `npm test`, `npm run lint`, and `npm run build` pass, except for clearly documented unrelated baseline failures.
- The pull-request summary includes migration instructions, import commands, screenshots or route descriptions, test output, known limitations, and the recommended Phase 2 next step.

---

# 23. Required completion report

At the end of the coding run, provide:

1. Summary of the architecture implemented.
2. Exact files created and modified.
3. Database migration name and tables/functions created.
4. Commands for local migration and test import.
5. Commands for dry-run and committed import.
6. Corpus validation report, when real NBIB files were available.
7. Screens/routes added.
8. Tests run and outcomes.
9. Pre-existing failures separated from new failures.
10. Security decisions.
11. Items deliberately deferred to Phase 2 or 3.
12. Any decisions requiring physician/editorial review.

Do not state that the module is complete when only scaffolding exists. Clearly distinguish working behavior from placeholders.

---

# 24. Begin with this execution sequence

1. Create branch `feat/ip-literature-explorer` from the current default branch.
2. Audit the repository files in §4.
3. Run baseline checks.
4. Write `docs/literature-module-architecture.md`.
5. Add ignored local-data directories and committed configuration/example files.
6. Implement and test the NBIB parser before touching real production data.
7. Implement the migration and apply it to local Supabase only.
8. Implement manifest validation, dry-run validation, and import reporting.
9. Import fixtures and prove idempotency.
10. Run a dry-run against the real NBIB directory when available.
11. Import a small bounded real sample into local Supabase.
12. Build the admin review queue.
13. Build draft lexical search and article detail pages.
14. Test authorization, filters, pagination, and manual-override preservation.
15. Run all quality commands and produce the completion report.

Proceed now. Favor a small, tested vertical slice over an expansive but unreliable implementation.
