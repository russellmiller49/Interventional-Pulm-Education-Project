# openFDA UDI enrichment

## Purpose and safety boundary

This pipeline uses the [openFDA UDI endpoint](https://open.fda.gov/apis/device/udi/) to create reviewable identity-enrichment proposals for the normalized interventional-pulmonology catalog.

The layers are deliberately separate:

```text
workbook/imported canonical catalog
  != openFDA candidate proposal
  != human verification decision
  != hospital-local formulary approval
```

An openFDA/GUDID match does not establish current orderability, compatibility, local availability, formulary approval, clinical suitability, or production readiness. The endpoint contains manufacturer-submitted identity records, and openFDA itself treats API results as unvalidated. All proposed fields require human verification against current manufacturer and institutional sources.

Enrichment never changes:

- `catalog-products.json`;
- `verification-backlog.json`;
- `hospital-formulary-staging.json`;
- the source workbook;
- visibility, verification, live-dropdown, hospital-carries, preferred, or locally-approved fields.

## API key

Request a free key from the [openFDA authentication page](https://open.fda.gov/apis/authentication/). Store it only in a local shell environment or ignored local environment file:

```bash
export OPENFDA_API_KEY="<your-openfda-api-key>"
```

The local CLIs silently load the ignored `.env.local` when `OPENFDA_API_KEY` is not already exported. Existing process-environment configuration takes precedence. The scripts never print the value. Never add the key to a `NEXT_PUBLIC_*` variable, command committed to shell history, source file, URL in documentation, cache key, report, or log.

Batch query execution fails before making requests when `OPENFDA_API_KEY` is absent. Unit tests use mocked fetch responses and do not require a real key.

Optional configuration:

```text
OPENFDA_REQUESTS_PER_SECOND=3
OPENFDA_MAX_RETRIES=5
OPENFDA_TIMEOUT_MS=30000
OPENFDA_CACHE_DIR=local-data/ip-preference-cards/openfda/cache
OPENFDA_BULK_DIR=local-data/ip-preference-cards/openfda/bulk
```

## Commands

Preview deterministic query plans without a key or network calls:

```bash
npm run ip-cards:openfda:query -- --limit 10 --dry-run
```

Run a bounded enrichment:

```bash
npm run ip-cards:openfda:query -- --limit 10
```

Supported selection and execution options:

```text
--product-id PRD-...
--manufacturer "Boston Scientific"
--limit 25
--priority P0
--cohort data/ip-preference-cards/seed/openfda-calibration-cohort.json
--output-dir data/ip-preference-cards/generated/openfda/calibration/example
--refresh
--exhaustive
--dry-run
--anonymous
--concurrency 3
```

`--anonymous` is an explicit low-quota fallback. Authenticated batch execution remains the
default and fails closed when the local key is absent.

Generate the checked-in historical 25-product calibration audit after the documented initial,
final, cached, and targeted-refresh outputs exist:

```bash
npm run ip-cards:openfda:calibrate
```

The calibration definition is schema-checked for exactly 25 unique products and its intended
challenge-category counts. Query output directories are restricted to
`data/ip-preference-cards/generated/openfda/`. That calibration and its report preserve the
earlier 1,474-product identity-enrichment snapshot; they are historical evidence, not the current
catalog baseline.

Regenerate CSV reports from an existing validated proposal file:

```bash
npm run ip-cards:openfda:report
```

Inspect the current bulk-download manifest without downloading ZIPs:

```bash
npm run ip-cards:openfda:download
```

## Dated current U.S. status research (proposal only)

The current normalized catalog contains 1,532 products: 779 are hidden and 753 are
prototype-visible. The deterministic research cohort includes all 779 hidden products and keeps
their reasons separate: 578 hidden `verified_source` products are specification-sourced with
current U.S. status pending, while 200 hidden `candidate` products and one hidden `unknown`
product still require identity or specification work.

The current U.S. status research package builds on the existing exact-query, local-filtering,
cache, retry, and alias infrastructure without writing to the ordinary
`generated/openfda/` proposal queue. Use a new explicit snapshot date for each evidence pass:

```bash
research_snapshot=2026-08-13
research_root="data/ip-preference-cards/research/us-status/${research_snapshot}"

npm run ip-cards:us-status:cohort -- \
  --output "${research_root}/cohort-manifest.json"
npm run ip-cards:us-status:calibration-cohort -- \
  --manifest "${research_root}/cohort-manifest.json" \
  --output "${research_root}/calibration-cohort.json"
npm run ip-cards:us-status:manufacturer-sources -- \
  --snapshot "${research_snapshot}" \
  --output "${research_root}/manufacturer-source-snapshot.json"

# Run the stratified calibration selection first.
npm run ip-cards:us-status:research -- \
  --snapshot "${research_snapshot}" \
  --cohort "${research_root}/cohort-manifest.json" \
  --manufacturer-source-manifest "${research_root}/manufacturer-source-snapshot.json" \
  --selection "${research_root}/calibration-cohort.json" \
  --output-dir "${research_root}/calibration/status-50"
npm run ip-cards:us-status:calibration-review -- \
  --cohort "${research_root}/calibration-cohort.json" \
  --proposals "${research_root}/calibration/status-50/us-status-evidence-proposals.json" \
  --output-dir "${research_root}/calibration/status-50"

# After calibration review gates pass, process the full computed hidden cohort.
npm run ip-cards:us-status:research -- \
  --snapshot "${research_snapshot}" \
  --cohort "${research_root}/cohort-manifest.json" \
  --manufacturer-source-manifest "${research_root}/manufacturer-source-snapshot.json" \
  --output-dir "${research_root}"
```

Compact, schema-validated proposals, review CSVs, source manifests, run summaries, and methodology
files stay under `data/ip-preference-cards/research/us-status/<YYYY-MM-DD>/`. Raw openFDA responses,
manufacturer page/document bodies, extracted text, and cache metadata stay in the ignored
`local-data/ip-preference-cards/us-status/` tree. A refresh must use a new dated snapshot rather
than silently replacing historical evidence.

The evidence layers remain independent:

1. exact identity and UDI/GUDID configuration/distribution evidence;
2. FDA registration and listing;
3. marketing authorization or classification/exemption evidence;
4. exact official manufacturer U.S. pages or documents; and
5. official FDA safety actions as separate safety context.

Registration/listing is not approval, historical authorization is not current distribution, a
recall is not evidence of discontinuation, and website absence is not a negative finding. Exact
positive and negative current-status proposals require the package's independent invariants and
remain recommendations for human review.

### FDA safety-action layer

The safety layer reads two official FDA systems through the same cache/retry/provenance client as
the other layers, using two additional endpoint-scoped caches under
`local-data/ip-preference-cards/us-status/<snapshot>/openfda/`:

| System                   | Endpoint                  | Contributes                                          |
| ------------------------ | ------------------------- | ---------------------------------------------------- |
| Enforcement Report       | `device/enforcement.json` | classification, ongoing/terminated status, lot codes |
| Recall Enterprise System | `device/recall.json`      | recall status, posted date, linked submissions       |

No manufacturer page, press release, or general web search result is admitted as safety authority,
and no page or API body is committed: only normalized records, bounded `code_info` excerpts, and
source provenance (request search, response SHA-256, retrieval timestamp, portable cache
reference) reach the dated artifacts.

A safety action is tied to a product only through an exact governed identifier — the catalog/REF
number, or a device identifier of the exact device including its package configuration. Evidence
linked only by a shared clearance or family name is recorded as `family_or_ambiguous_action` and
is never presented as an exact-product action, which keeps an adjacent SKU in the same clearance
family from contaminating the determination.

The layer records four fields, none of which collapse into one another:

- `safety_search_status`: `searched` | `not_searched` | `query_error`
- `safety_action_state`: `active_exact_product_action` | `historical_exact_product_action` |
  `family_or_ambiguous_action` | `no_exact_action_found` | `unknown`
- `safety_action_scope`: `lot_specific` | `product_wide` | `family_level` | `unknown`
- `visibility_review_eligibility`: `eligible_for_owner_review` | `hold_active_safety_action` |
  `hold_safety_search_incomplete` | `hold_safety_identity_ambiguous` | `not_applicable`

A disagreement between the two FDA systems about whether the same action is still open resolves to
`unknown` and holds review rather than picking a side. A historical (terminated) exact action is
retained as safety context and does not by itself block ordinary review. Safety evidence never
contributes to the distribution conclusion; it can only hold the review disposition.

### Inaccessible manufacturer sources

A manufacturer fetch that times out or fails transport-level is recorded with
`retrieval_status: "inaccessible"`, a null `content_sha256`, `identity_scope: "context_only"`, and
no matched identifiers. The SHA-256 of an empty body describes nothing about the document, so it is
not committed as a content hash, and an unread source supports neither a current-distribution nor a
discontinuation claim.

Every research artifact records `canonical_change_applied: false`. These commands have no apply
endpoint or importer and cannot change catalog visibility, verification grade, selectability,
roles, compatibility, formulary state, release pointers, ledgers, or feature flags. They are local
research commands only: no current U.S. status script or openFDA endpoint is invoked from CI,
build, postinstall, application startup, a route, a server action, or a client component.

## Ordered query plan

For each product, the script builds a stable query sequence:

1. Exact `identifiers.id` for canonical GTIN/DI candidates and existing backlog identifiers.
2. Exact `catalog_number`.
3. Exact `catalog_number` plus each checked-in company alias, one alias per bounded query.
4. Exact `version_or_model_number` for catalog, global-part, reference-part, and individual alternate identifiers.
5. One exact brand-family fallback that can only produce a review candidate.

Quoted values escape quotes and backslashes. A request returns at most 100 records. Because openFDA quoted searches are analyzed rather than guaranteed full-field equality, every response is locally filtered against the query source value under the same reviewed normalization rules before deduplication or classification. Query attempts retain both raw and locally eligible result counts.

Results are deduplicated by openFDA record key or stable identity fields. Unless `--exhaustive` is selected, normal mode runs exact DI and catalog queries; if the candidate omits `catalog_number`, it also runs the exact model query so package/model siblings are not hidden. It stops before name-family fallback once identity evidence is available.

Manufacturer equivalence is defined only in `scripts/ip-preference-cards/openfda/manufacturer-aliases.ts`. Comparison normalization removes ordinary legal suffixes and formatting differences; it does not infer acquisitions, distributors, subsidiaries, or similarly named companies.

## Classifications

Every requested product receives exactly one classification:

- `high_confidence_candidate`: one unique eligible record with an exact candidate catalog match, an approved company alias, a Primary DI, no model/distribution/package conflict, no name-only evidence, no adjacent SKU, and agreement with any existing DI evidence.
- `review_required`: ambiguity, company conflict, model-only or alternate-ID evidence, family fallback, package ambiguity, backlog conflict, configuration conflict, or unclear distribution status.
- `unmatched`: permitted queries completed with no candidate.
- `insufficient_identifiers`: no usable DI, catalog, model, or alternate identifier.
- `query_error`: a request failed after bounded retries or returned an invalid response.

“High confidence” still means a candidate awaiting review. Product-name similarity, product code, manufacturer, brand family, and generic device category can never independently create a high-confidence classification.

Every provisional high-confidence result is independently audited at runtime. A violation places the product in `review_required` with `high_confidence_invariant_failed` plus granular reason codes. Cohort/calibration query commands then exit nonzero after writing those review artifacts, so an invariant failure cannot be mistaken for a successful high-confidence result.

## Cache and resume behavior

Successful and ordinary no-result responses are stored in:

```text
local-data/ip-preference-cards/openfda/cache/
```

The request cache key is the SHA-256 of:

- endpoint;
- normalized search expression;
- limit;
- this code’s API schema version.

It never includes the API key. Cache metadata records retrieval time, safe search expression, limit, HTTP status, attempt count, and response SHA-256. Writes are atomic, so a later run resumes after interruption. `--refresh` bypasses cache reads and replaces successful entries.

The client uses native Node fetch, a shared request interval, configurable product concurrency, a 30-second default timeout, and exponential backoff with jitter for 429, 500, 502, 503, 504, timeouts, and transient network failures. A 404 is a normal empty result.

## Review outputs

Small deterministic outputs are written under:

```text
data/ip-preference-cards/generated/openfda/
```

Files:

- `run-summary.json`;
- `enrichment-proposals.json`;
- `high-confidence-candidates.csv`;
- `review-required.csv`;
- `unmatched-products.csv`;
- `query-errors.csv`;
- `manifest-snapshot.json`.

The top-level checked-in run and the named 25-product calibration artifacts preserve the earlier
1,474-product catalog era. Keep them as historical retrieval evidence; use the dated current U.S.
status research root for the 1,532-product baseline.

Calibration artifacts additionally include:

- `calibration/audit.csv` and `calibration/audit.md`;
- `calibration/metrics.json`;
- `calibration/schema-audit.json`;
- `calibration/safety-verification.json`;
- separate initial, remediation, final, cached, and targeted-refresh run directories.

Proposals are sorted by `product_id`, validated with Zod, and contain only a useful review subset. Complete passthrough response records stay in the ignored raw cache. Reports contain no API key and no server-download route for cache files.

The read-only admin queue is:

```text
/{locale}/admin/preference-cards/catalog-qa/openfda
```

It uses the existing preference-card authorization/layout and supports classification, manufacturer, procedure, role, backlog-conflict, and distribution-status filters. It cannot approve a proposal or write canonical data.

## Bulk partitions

The default downloader fetches `https://api.fda.gov/download.json`, validates `results.device.udi`, prints export date/partition count/record count/size, and writes only the small manifest snapshot. It downloads nothing without an explicit selection:

```bash
npm run ip-cards:openfda:download -- --partition 1
npm run ip-cards:openfda:download -- --from 1 --to 5
npm run ip-cards:openfda:download -- --all
```

`--force` replaces an existing apparently complete partition; `--concurrency 2` controls low-concurrency transfer. ZIPs use `.part` files and atomic rename after content-length and obvious-truncation checks. They remain compressed and ignored by Git.

openFDA bulk exports are snapshots: when the export date changes, all partitions must be refreshed to form a complete current dataset. The script never runs from CI, build, postinstall, application startup, or a public route.

## Known limitations

- openFDA can return package and base-device identifiers that require human interpretation.
- Manufacturer spelling is accepted only through the conservative checked-in registry.
- Distribution status describes the submitted GUDID record; it does not prove procurement status or local availability.
- Some current products have no UDI record, incomplete catalog/model fields, or multiple package configurations.
- Many real records place the order number only in `version_or_model_number`; the strict high-confidence invariant does not treat that as an exact candidate catalog match.
- Short catalog terms can produce analyzed-search false positives at the API layer; local exact filtering is authoritative for candidate eligibility.
- Timestamps describe a particular retrieval; deterministic ordering does not make external data immutable.
- The pipeline does not scan bulk ZIPs or construct a multi-gigabyte local database.

## Future governed workflows

A separate review-and-apply work package should let an authorized reviewer accept or reject individual proposed fields while recording reviewer, evidence, timestamp, rationale, previous value, new value, and immutable change history. Acceptance should update the authoritative source through its controlled import process rather than patching generated JSON.

A later bulk-index work package may stream each downloaded ZIP, validate its records with the same passthrough schema, and build a local exact-match index keyed by DI, catalog number, normalized approved company identity, and version/model number. It should verify that every partition comes from one export date and should not infer fuzzy clinical compatibility.
