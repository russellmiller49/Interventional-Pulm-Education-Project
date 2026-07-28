Implement openFDA UDI enrichment for the IP product catalog

You are a senior TypeScript engineer working in:

russellmiller49/Interventional-Pulm-Education-Project

Use this branch as the source branch:

codex/ip-preference-card-builder-v0-1

Create a child feature branch:

codex/ip-openfda-enrichment-v0-1

Do not reset, rewrite, or modify unrelated work. Inspect the working tree before making changes. Preserve all existing preference-card behavior, identifiers, generated data, safety controls, and tests.

1. Objective

Build a deterministic, resumable openFDA UDI enrichment pipeline for the interventional-pulmonology product catalog.

The pipeline must:

Read the existing normalized catalog.
Query openFDA for candidate UDI records.
Match candidates using exact identifiers and explicit manufacturer aliases.
Extract useful identity, packaging, regulatory, and distribution fields.
Preserve raw evidence and query provenance.
Classify each product as:
high-confidence candidate;
human review required;
unmatched;
skipped because insufficient identifiers;
query error.
Produce reviewable JSON and CSV reports.
Never automatically overwrite canonical product data.
Never interpret a GUDID/openFDA match as proof of:
current orderability;
local availability;
compatibility;
local formulary approval;
clinical suitability;
production readiness.
Add an optional bulk UDI partition downloader, but do not download the complete dataset during ordinary development, testing, CI, or build.

The base endpoint is:

https://api.fda.gov/device/udi.json

The downloadable-file manifest is:

https://api.fda.gov/download.json 2. Inspect the existing implementation first

Before coding, review at minimum:

package.json
.env.example
.gitignore

scripts/ip-preference-cards/catalog-utils.ts
scripts/ip-preference-cards/import-catalog.ts
scripts/ip-preference-cards/validate-data.ts

data/ip-preference-cards/generated/catalog-products.json
data/ip-preference-cards/generated/manufacturers.json
data/ip-preference-cards/generated/product-roles.json
data/ip-preference-cards/generated/verification-backlog.json
data/ip-preference-cards/generated/import-report.json

src/features/preference-cards/data/demo-context.server.ts
src/app/[locale]/admin/preference-cards/catalog-qa/page.tsx

Create this implementation plan before writing production code:

docs/ip-preference-cards/openfda-enrichment-implementation-plan.md

The plan must document:

current catalog structure;
existing GUDID-related fields;
proposed files;
API query strategy;
matching rules;
cache and output locations;
secret handling;
bulk-download boundary;
test strategy;
assumptions and unresolved questions.

Proceed after writing the plan without waiting for approval unless a genuinely blocking repository conflict exists.

3. Preserve the current source-of-truth boundaries

Treat these as separate layers:

Canonical workbook/imported catalog
≠ openFDA candidate enrichment
≠ human verification decision
≠ hospital-local formulary approval

Do not modify these files during an enrichment run:

catalog-products.json
verification-backlog.json
hospital-formulary-staging.json
the source Excel workbook

The openFDA pipeline may compare against them, but it must write separate proposals and reports.

Do not change:

visibility_state
verification_grade
live_dropdown_status
hospital_carries
preferred
locally_approved

A high-confidence match remains a candidate awaiting review.

4. Add the following feature structure

Use this structure unless repository inspection reveals a stronger established convention:

scripts/ip-preference-cards/openfda/
├── types.ts
├── schemas.ts
├── normalize.ts
├── manufacturer-aliases.ts
├── query-plan.ts
├── client.ts
├── classify-match.ts
├── proposals.ts
├── csv.ts
├── run-query-enrichment.ts
├── download-udi-partitions.ts
├── generate-report.ts
└── **tests**/
├── normalize.test.ts
├── query-plan.test.ts
├── client.test.ts
├── classify-match.test.ts
├── proposals.test.ts
└── fixtures.ts

Use native Node fetch, AbortController, current repository dependencies, and strict TypeScript. Do not add a request library.

Use Zod for:

openFDA responses;
manifest responses;
generated proposal records;
run summaries;
cache metadata.

OpenFDA schemas must use .passthrough() where appropriate so future additional FDA fields do not break the parser.

5. Configuration and secret handling

Add this server-side variable to .env.example:

# Server-side API key used only by local openFDA catalog-enrichment scripts.

# Never expose this through NEXT*PUBLIC*\* or commit a real value.

OPENFDA_API_KEY=

Requirements:

Never use a NEXT*PUBLIC* prefix.
Never print the key.
Never include it in cache keys, logs, error messages, generated JSON, CSV, or URLs shown to the user.
Redact api_key from any logged request.
Do not make openFDA requests from browser code.
Do not run the synchronization from a public route.
Batch enrichment should fail with a clear setup message when the key is absent.
Unit tests must not require a real key.

Support these optional environment variables:

OPENFDA_REQUESTS_PER_SECOND=3
OPENFDA_MAX_RETRIES=5
OPENFDA_TIMEOUT_MS=30000
OPENFDA_CACHE_DIR=local-data/ip-preference-cards/openfda/cache
OPENFDA_BULK_DIR=local-data/ip-preference-cards/openfda/bulk

Use conservative defaults below the published rate limit.

6. Add ignored local-data locations

Add explicit .gitignore entries:

/local-data/ip-preference-cards/openfda/
/data/ip-preference-cards/openfda-bulk/

Downloaded ZIP files, raw responses, temporary files, and local indexes must never be committed.

Small deterministic summaries and proposals may be stored under:

data/ip-preference-cards/generated/openfda/ 7. Input data

Primary input:

data/ip-preference-cards/generated/catalog-products.json

Supplementary inputs:

data/ip-preference-cards/generated/manufacturers.json
data/ip-preference-cards/generated/verification-backlog.json

For each product preserve:

product_id
manufacturer_id
manufacturer
product_name
catalog_number
alternate_ids
gtin
global_part_number
reference_part_number
verification_status
visibility_state

All identifiers remain strings. Never coerce them to numbers. Preserve leading zeros and original punctuation in display values.

8. Manufacturer aliases

Create a checked-in explicit alias file or TypeScript registry.

Example shape:

interface ManufacturerAliasGroup {
canonicalManufacturerId: string
canonicalName: string
aliases: string[]
}

Normalize only for comparison:

lowercase;
Unicode normalization;
trim whitespace;
collapse repeated spaces;
remove trademark symbols;
standardize punctuation;
optionally remove ordinary legal suffixes such as Inc, LLC, and Corporation.

Do not automatically treat acquired companies, distributors, subsidiaries, or similarly named companies as identical.

Do not use fuzzy company matching to approve a candidate.

Every alias must be reviewable in source control.

9. Identifier normalization

Implement separate functions for:

display value
exact comparison value
loose search fallback value

Exact catalog-number comparison may normalize:

case;
surrounding whitespace;
hyphens;
spaces;
periods;
slashes only when explicitly configured.

Never delete characters from the stored source value.

Examples that may compare as equal after exact-comparison normalization:

MAJ-2056
MAJ 2056
maj2056

Examples that must not automatically be treated as equal:

M00552350
M00552351

Name similarity may rank two already identifier-matched candidates, but product-name similarity alone must never create a high-confidence match.

10. Query plan

Build a deterministic ordered query plan for each product.

Use this general sequence:

Query 1: existing primary DI or GTIN

When the product already contains a valid DI candidate, search the relevant nested identifier field after verifying the current openFDA response schema.

Query 2: exact catalog number
catalog_number:"<catalog number>"
Query 3: exact catalog number plus company
catalog_number:"<catalog number>" AND company_name:"<manufacturer alias>"

Try explicit manufacturer aliases individually. Do not create one uncontrolled broad query.

Query 4: exact version or model number

Use the catalog number, global part number, reference part number, or individual alternate identifiers as exact model-number candidates only when the previous searches return nothing.

Query 5: narrowly bounded fallback

A fallback may use an exact brand or product-family term only to generate a human-review candidate. It must never produce automatic acceptance.

Requirements:

Build requests with URL and URLSearchParams.
Escape quotes and backslashes correctly.
Request no more than 100 records for an individual product query unless a documented case requires more.
Treat a 404/no-results response as an ordinary empty result.
Deduplicate records returned by multiple query attempts.
Record which query produced each candidate.
Do not run all fallback queries after an exact unique result has already been found unless --exhaustive is selected. 11. API client behavior

Implement:

token-bucket or interval-based request pacing;
configurable concurrency;
30-second default timeout;
retry with exponential backoff and jitter for:
429;
500;
502;
503;
504;
transient network failures;
maximum five attempts by default;
no retry for malformed queries or ordinary no-result responses;
deterministic local caching;
resume after interruption.

Cache requests by a SHA-256 hash of:

endpoint
normalized search expression
limit
API schema version used by this code

Do not include the API key in the hash.

Each cached response must include metadata:

retrieved_at
request_search
limit
http_status
attempt_count
response_sha256

Support:

--refresh

to bypass the cache.

12. openFDA fields to retain

Retain, when supplied:

record_key
public_device_record_key
brand_name
company_name
catalog_number
version_or_model_number
device_description
device_count_in_base_package
device_sizes
identifiers
commercial_distribution_status
commercial_distribution_end_date
is_kit
is_single_use
sterilization
storage
has_expiration_date
has_lot_or_batch_number
has_manufacturing_date
has_serial_number
mri_safety
product_codes
premarket_submissions
gmdn_terms
publish_date
public_version_date
public_version_number
public_version_status
record_status

Do not assume all fields exist.

Preserve the complete parsed candidate record in the ignored raw cache. Put only the useful review subset in committed proposal output.

13. Deterministic match classification

Use explicit rule-based classifications. A numeric score may rank candidates but must not be the sole acceptance mechanism.

high_confidence_candidate

Allow only when one of these is true:

Existing DI matches an openFDA identifier exactly; or
Catalog number matches exactly, manufacturer matches an explicit alias group, the result is unique after deduplication, and no model/configuration conflict exists.

This status still means “candidate awaiting review.”

review_required

Use when:

multiple records share the catalog number;
catalog number matches but company does not;
manufacturer matches but only the model number matches;
only an alternate identifier matches;
package-level records cannot be distinguished;
existing suggested DI conflicts with the newly found DI;
model or configuration information is contradictory;
a product-family result exists without an exact SKU match;
distribution status is unclear or contradictory.
unmatched

No candidate remains after the permitted exact and bounded fallback queries.

insufficient_identifiers

No usable catalog number, DI, model number, or alternate identifier is available.

query_error

The product could not be evaluated because requests failed after retries or the response was invalid.

Never classify a product as high confidence based only on:

product-name similarity;
same FDA product code;
same manufacturer;
same generic device category;
same brand family;
fuzzy matching. 14. Compare with the existing verification backlog

For every product, compare openFDA results with these existing fields when present:

suggested_primary_di
gudid_result
match_confidence
distribution_status
evidence_url

Record one of:

agrees_with_existing_backlog
adds_missing_candidate
conflicts_with_existing_di
conflicts_with_distribution_status
existing_backlog_has_more_specific_match
not_previously_evaluated

Do not overwrite the existing backlog.

Conflicts must be prominent in the review report.

15. Enrichment proposals

Generate:

data/ip-preference-cards/generated/openfda/
├── run-summary.json
├── enrichment-proposals.json
├── high-confidence-candidates.csv
├── review-required.csv
├── unmatched-products.csv
├── query-errors.csv
└── manifest-snapshot.json

Suggested proposal shape:

interface OpenFdaEnrichmentProposal {
format_version: 1
product_id: string
manufacturer: string | null
product_name: string
catalog_number: string | null

classification:
| 'high_confidence_candidate'
| 'review_required'
| 'unmatched'
| 'insufficient_identifiers'
| 'query_error'

reason_codes: string[]
query_attempts: OpenFdaQueryAttemptSummary[]
candidate_count: number
selected_candidate: OpenFdaCandidateSummary | null

proposed_fields: {
primary_di: string | null
additional_identifiers: OpenFdaIdentifierProposal[]
brand_name: string | null
company_name: string | null
version_or_model_number: string | null
device_description: string | null
device_count_in_base_package: number | null
device_sizes: unknown[]
commercial_distribution_status: string | null
commercial_distribution_end_date: string | null
is_kit: boolean | null
is_single_use: boolean | null
sterilization: unknown | null
storage: unknown[]
product_codes: unknown[]
premarket_submissions: unknown[]
public_version_date: string | null
record_status: string | null
}

backlog_comparison: string
retrieved_at: string | null
raw_cache_reference: string | null
decision: 'pending_review'
}

Ensure the output is:

deterministic;
stably sorted by product_id;
formatted with the repository’s existing JSON formatter;
free of API keys;
free of uncontrolled raw response payloads;
valid against a Zod schema.

CSV files must escape commas, quotes, newlines, and Unicode correctly.

16. Run summary

Include:

catalog input SHA-256
catalog product count
products requested
products processed
products served from cache
API requests made
retry count
high-confidence count
review-required count
unmatched count
insufficient-identifier count
query-error count
existing backlog conflicts
started_at
completed_at
openFDA endpoint
API key used: true/false

Do not include the key itself.

Assert:

processed classifications + query errors = attempted products 17. CLI commands

Add these scripts to package.json:

{
"ip-cards:openfda:query": "tsx scripts/ip-preference-cards/openfda/run-query-enrichment.ts",
"ip-cards:openfda:report": "tsx scripts/ip-preference-cards/openfda/generate-report.ts",
"ip-cards:openfda:download": "tsx scripts/ip-preference-cards/openfda/download-udi-partitions.ts"
}

Support options such as:

--product-id PRD-...
--manufacturer "Boston Scientific"
--limit 25
--priority P0
--refresh
--exhaustive
--dry-run
--concurrency 3

Example development run:

OPENFDA_API_KEY="..." npm run ip-cards:openfda:query -- --limit 10

Do not place the key directly in documentation examples other than an obvious placeholder.

18. Bulk-download support

Implement a separate opt-in downloader.

Default behavior:

npm run ip-cards:openfda:download

must only:

retrieve the current download manifest;
identify the UDI partitions dynamically;
display export date, partition count, record count, and expected total size when available;
write a small manifest snapshot;
download nothing.

Require an explicit flag:

npm run ip-cards:openfda:download -- --all

to download every UDI partition.

Also support:

--partition 1
--from 1 --to 5
--force
--concurrency 2

Downloader requirements:

Never hard-code the number of partitions.
Validate the manifest.
Download sequentially or with low concurrency.
Write to filename.part.
Atomically rename after successful completion.
Skip an existing complete file unless --force is selected.
Detect clearly truncated responses.
Preserve the manifest export date.
Warn that a new export requires refreshing all partitions.
Do not unzip all files automatically.
Do not execute in CI, production build, postinstall, or application startup.
Do not commit ZIP files.

Do not build a multi-gigabyte local database in this work package. Leave a documented extension point for a later partition scanner or local exact-match index.

19. Minimal admin review integration

Extend the existing read-only catalog QA area without adding a second catalog.

Preferred route:

/[locale]/admin/preference-cards/catalog-qa/openfda

The page should:

load the compact proposal file server-side;
show summary counts;
filter by:
classification;
manufacturer;
procedure;
role;
backlog conflict;
distribution status;
show:
canonical product identity;
query classification;
candidate DI;
candidate catalog number;
candidate manufacturer;
candidate model;
distribution status;
reason codes;
existing backlog comparison;
public-version date;
remain read-only;
not expose raw local cache paths as downloadable server files;
not expose the API key;
show a clear empty state when no enrichment run exists.

Add navigation from the current catalog QA page.

Use the existing authorization, locale, layout, pagination, and styling conventions. English fallback strings should be added to all active locale files in the same manner as the existing preference-card feature.

Do not add approval or canonical-write actions in this phase.

20. Safety copy

Display this message on the review page:

OpenFDA/GUDID enrichment supports device identity review only. A match does not establish current orderability, compatibility, local availability, formulary approval, or clinical suitability. All proposed changes require human verification against current manufacturer and institutional sources. 21. Tests

All ordinary tests must use mocked fetch responses and local fixtures.

Required tests:

Leading-zero identifiers remain strings.
Catalog-number comparison does not conflate adjacent SKUs.
Manufacturer aliases are explicit and deterministic.
Quotes and backslashes are safely escaped in queries.
API keys are absent from logs and output.
A 404 becomes an empty result.
429 and 5xx responses retry.
A timeout aborts and retries as configured.
Cached responses prevent duplicate requests.
--refresh bypasses cache.
Exact DI match becomes high_confidence_candidate.
Exact catalog plus approved manufacturer alias becomes high confidence.
Exact catalog with manufacturer conflict requires review.
Multiple exact candidates require review.
Model-only match requires review.
Product-name-only similarity cannot become high confidence.
Existing backlog DI conflict is surfaced.
Output is deterministic when API result order changes.
Proposal generation never mutates catalog-products.json.
Bulk downloader performs manifest-only behavior by default.
Bulk download requires an explicit flag.
API response schemas tolerate additional unknown FDA fields.
Admin page renders all classifications and an empty state.

Add one optional live integration test that runs only when:

RUN_OPENFDA_INTEGRATION=1
OPENFDA_API_KEY is present

It must never run in the ordinary Jest suite or CI by default.

22. Validation

Run at minimum:

npm run ip-cards:validate-data
npm run ip-cards:openfda:query -- --limit 10
npm run ip-cards:openfda:report
npx jest scripts/ip-preference-cards/openfda src/features/preference-cards --runInBand
npm run type-check
npm run lint

Do not report a command as successful unless it actually completed successfully.

Do not run the full bulk download merely to validate the implementation.

23. Documentation

Create:

docs/ip-preference-cards/openfda-enrichment.md

Document:

how to obtain and store the API key;
commands;
query order;
matching classifications;
cache behavior;
output files;
human-review requirements;
bulk-download behavior;
refresh behavior;
known limitations;
why GUDID identity does not prove commercial or local status;
how a later review-and-apply workflow should work;
how a future bulk partition scanner could consume the downloaded ZIPs.

Also update:

docs/ip-preference-cards/data-import.md
docs/ip-preference-cards/pilot-readiness.md

Clarify that openFDA enrichment is separate from the workbook import and does not alter clinical readiness.

24. Definition of done

The work is complete when:

A developer can run the enrichment against 10 or all catalog products.
The process resumes from cache after interruption.
Every attempted product receives exactly one classification.
Exact, ambiguous, unmatched, skipped, and error cases are distinguishable.
Existing GUDID backlog results are compared rather than overwritten.
No canonical catalog field changes automatically.
No API key appears in Git, logs, cache metadata, reports, or rendered pages.
Bulk files are opt-in and ignored by Git.
The admin page provides a useful read-only review queue.
Tests cover the matching safety rules.
Existing preference-card tests and catalog validation remain green.
Documentation clearly identifies the feature as identity enrichment, not a clinical or procurement approval system. 25. Final implementation report

At completion, report:

files added
files modified
commands run
test results
sample run count
high-confidence count
review-required count
unmatched count
backlog conflict count
known limitations
recommended next work package

The recommended next work package should be a separately governed human review and apply workflow that can accept or reject individual proposed fields with reviewer, evidence, timestamp, and change history. It must not be included implicitly in this implementation.
