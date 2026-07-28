# openFDA UDI enrichment — implementation plan

Prepared: 2026-07-27

## Scope and source-of-truth boundaries

This work adds a deterministic, resumable identity-enrichment pipeline for the interventional-pulmonology product catalog. The layers remain intentionally separate:

1. The workbook import and `catalog-products.json` are the canonical catalog.
2. openFDA responses are external evidence used to produce candidate proposals.
3. A future human-review workflow may accept or reject individual proposal fields.
4. Hospital-local formulary approval remains a separate institutional process.

An enrichment run will not write to the source workbook, `catalog-products.json`, `verification-backlog.json`, or `hospital-formulary-staging.json`. It will not change visibility, verification grade, live-dropdown status, hospital-carries, preferred, or locally-approved fields. Every proposal decision remains `pending_review`.

openFDA/GUDID data is treated as identity evidence only. A match is not evidence of current orderability, compatibility, local availability, formulary approval, clinical suitability, or production readiness.

## Current catalog structure

Repository inspection on the source branch found:

- 1,474 normalized products in `data/ip-preference-cards/generated/catalog-products.json`.
- 33 manufacturers in `manufacturers.json`.
- 1,566 product-role links in `product-roles.json`.
- 1,221 existing verification rows in `verification-backlog.json`.
- All catalog identifiers are stored as strings or `null`; the import deliberately preserves leading zeros.
- Products carry `product_id`, `manufacturer_id`, `manufacturer`, `product_name`, `catalog_number`, `alternate_ids`, `gtin`, `global_part_number`, `reference_part_number`, `verification_status`, and `visibility_state`.
- Product roles and backlog procedure/role strings provide the review-page procedure and role filters without creating a second catalog.

The existing GUDID backlog contains, when available, `existing_gtin`, `suggested_primary_di`, `gudid_result`, `match_confidence`, `distribution_status`, `public_version_date`, and `evidence_url`. These values will be compared with openFDA proposals but never overwritten.

The current admin catalog QA route is a locale-aware, server-rendered, read-only table protected by the existing preference-card admin layout. The openFDA review queue will follow those authorization, pagination, navigation, and styling conventions.

## Proposed files

```text
scripts/ip-preference-cards/openfda/
  types.ts
  schemas.ts
  normalize.ts
  manufacturer-aliases.ts
  query-plan.ts
  client.ts
  classify-match.ts
  proposals.ts
  csv.ts
  run-query-enrichment.ts
  download-udi-partitions.ts
  generate-report.ts
  __tests__/
    fixtures.ts
    normalize.test.ts
    query-plan.test.ts
    client.test.ts
    classify-match.test.ts
    proposals.test.ts
    download-udi-partitions.test.ts
    integration.test.ts

data/ip-preference-cards/generated/openfda/
  run-summary.json
  enrichment-proposals.json
  high-confidence-candidates.csv
  review-required.csv
  unmatched-products.csv
  query-errors.csv
  manifest-snapshot.json

src/features/preference-cards/data/openfda-proposals.server.ts
src/app/[locale]/admin/preference-cards/catalog-qa/openfda/page.tsx
src/app/[locale]/admin/preference-cards/catalog-qa/openfda/page.test.tsx
docs/ip-preference-cards/openfda-enrichment.md
```

Small checked-in proposal/report files contain only review fields. Complete parsed API responses and request metadata remain under the ignored local cache.

## API schema and query strategy

The endpoint is `https://api.fda.gov/device/udi.json`. The current openFDA schema exposes `identifiers[].id` for DIs and the top-level `catalog_number`, `company_name`, and `version_or_model_number` fields. Several values that are logically booleans or integers are currently serialized as strings, so Zod preprocessing will normalize only known boolean and numeric fields while preserving identifiers as strings.

Each product receives a stable ordered query plan:

1. Exact `identifiers.id` query for each existing GTIN/DI candidate.
2. Exact catalog-number query.
3. Exact catalog number plus one explicit company alias per query.
4. Exact version/model queries for global part number, reference part number, and individual alternate IDs.
5. At most one narrowly bounded exact brand/family fallback, marked review-only.

Queries use `URL` and `URLSearchParams`; quoted values escape backslashes and quotes. Results are limited to at most 100, deduplicated by record key or stable identity fields, and retain the query kinds that returned them. Unless `--exhaustive` is selected, later fallbacks stop after an exact unique result.

## Matching rules

Classification is rule-based rather than score-only:

- `high_confidence_candidate`: exact DI match; or one unique exact catalog match with an explicitly approved manufacturer alias and no model/configuration conflict.
- `review_required`: ambiguous catalog match, company conflict, model-only or alternate-ID match, package ambiguity, DI conflict, model/configuration contradiction, family-only fallback, or unclear/contradictory distribution evidence.
- `unmatched`: permitted queries completed with no remaining candidate.
- `insufficient_identifiers`: no usable DI, catalog, model, or alternate identifier.
- `query_error`: requests failed after retries or a response could not be validated.

Product-name similarity may only rank candidates that already matched an identifier. Manufacturer, product code, category, or fuzzy name similarity alone can never create a high-confidence candidate.

Manufacturer equivalence comes only from a checked-in registry. Comparison normalization may lowercase, Unicode-normalize, collapse spaces, standardize punctuation, remove trademark marks, and remove ordinary legal suffixes. It will not infer equivalence between acquired companies, distributors, subsidiaries, or similarly named organizations.

## Cache, resume, and outputs

Requests are cached by SHA-256 of endpoint, normalized search expression, limit, and this implementation's API schema version. The key is excluded. Each cache entry stores retrieval time, search expression, limit, status, attempt count, response hash, and parsed response. Atomic writes make interrupted runs resumable. `--refresh` bypasses reads and replaces successful cache entries.

Default locations:

- Cache: `local-data/ip-preference-cards/openfda/cache`
- Bulk ZIPs: `local-data/ip-preference-cards/openfda/bulk`
- Review outputs: `data/ip-preference-cards/generated/openfda`

Proposal JSON is validated with Zod, stably sorted by `product_id`, and formatted with the repository JSON formatter. CSV is RFC-style quoted when a field contains a comma, quote, newline, or carriage return.

Run timestamps and retrieval timestamps necessarily describe a particular execution. All record ordering, reason-code ordering, candidate selection, and serialized key shapes remain deterministic for identical inputs and cache contents.

## Secret handling and client behavior

`OPENFDA_API_KEY` is server-side only and will be documented in `.env.example`; it will never use a `NEXT_PUBLIC_` prefix. Batch querying fails with a setup message when absent. Tests inject a fake key and mocked fetch.

The client uses native `fetch`, `AbortController`, configurable interval pacing and concurrency, a 30-second default timeout, and exponential backoff with jitter for 429, 500, 502, 503, 504, timeouts, and transient network errors. It does not retry ordinary 404/no-results or malformed 4xx queries. URLs included in errors or logs are redacted, and generated artifacts contain only `api_key_used: true|false`.

## Bulk-download boundary

`download-udi-partitions.ts` is a separate opt-in command. Its default behavior fetches and validates `https://api.fda.gov/download.json`, dynamically selects `results.device.udi`, prints export date/count/size, and writes only a compact manifest snapshot.

ZIP transfer requires `--all`, `--partition`, or a bounded `--from/--to` range. Downloads use low concurrency, `.part` files, content-length/truncation checks when available, and atomic rename. Existing complete files are skipped unless `--force` is passed. Files are not unzipped, scanned, indexed, or invoked from CI/build/startup. A later work package may stream the ZIP partitions into a local exact-match index.

## Test strategy

Jest tests will use mocked fetch and temporary directories. Coverage will include:

- leading-zero preservation and adjacent-SKU separation;
- explicit deterministic manufacturer aliases;
- quote/backslash query escaping and stable query order;
- API-key redaction;
- 404 empty results, retryable statuses, timeout retry, cache hits, and refresh;
- exact-DI and exact-catalog-plus-alias high-confidence rules;
- manufacturer conflicts, duplicate candidates, model-only matches, name-only non-matches, and backlog DI conflicts;
- deterministic proposals under reordered API results and immutability of canonical inputs;
- manifest-only downloader defaults and explicit bulk opt-in;
- passthrough API/manifest schemas;
- all classifications and no-run empty state on the read-only admin page.

The optional live integration suite is gated by both `RUN_OPENFDA_INTEGRATION=1` and `OPENFDA_API_KEY`.

## Assumptions and unresolved questions

- The generated catalog, not the source workbook, is the runtime input for this work package.
- `gtin` and backlog `suggested_primary_di` are DI candidates; package identifiers may still require review when they do not identify the base device record.
- `alternate_ids` may contain multiple values separated by commas, semicolons, pipes, or line breaks. Parsing will preserve the source display string and query stable individual tokens.
- The checked-in manufacturer registry will begin conservatively with exact canonical names plus only obvious legal-name variants. Corporate successions and distributor relationships remain unmerged until reviewed.
- openFDA does not expose a separate top-level `primary_di`; the primary proposal is selected from `identifiers` where `type` is `Primary`, falling back only to the exact matched identifier for review.
- Procedure and role filters use existing backlog and product-role data. No new clinical mapping is inferred.
- A separately governed review-and-apply workflow is out of scope. It should later record field-level decisions, reviewer identity, evidence, timestamp, and immutable change history.
