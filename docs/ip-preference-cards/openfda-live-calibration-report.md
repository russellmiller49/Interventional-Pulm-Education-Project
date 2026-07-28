# openFDA live calibration and match-quality audit

Date: 2026-07-28  
Branch: `codex/ip-openfda-enrichment-v0-1`  
Scope: deterministic 25-product calibration only; no canonical review/apply workflow

This report records a live openFDA UDI calibration against the current preference-card product catalog. It is an identity-matching audit, not an independently reviewed gold standard and not a statement of clinical suitability, current orderability, local formulary status, or matching “accuracy.”

## Catalog input and count reconciliation

The current importer still reads the same 1,221-row source workbook recorded in `generated/import-report.json`:

| Input                     | Path                                                                                              | SHA-256                                                            | Product rows |
| ------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -----------: |
| Current source workbook   | `Preference_card_module/IP_Procedure_Equipment_Catalog_v0_5_with_GUDID_Verification_Backlog.xlsx` | `fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf` |        1,221 |
| Curated catalog additions | `data/ip-preference-cards/seed/catalog-additions.json`                                            | generated seed merged by the importer                              |          253 |
| Generated catalog         | `data/ip-preference-cards/generated/catalog-products.json`                                        | `1948f00c20f673dfbe2092bde6315c78ca02b8cb5f3f1e308e33c223175861fe` |        1,474 |

The count is therefore intentional:

```text
1,221 workbook products + 253 curated additions = 1,474 generated products
```

The 253 added products are the complete `products` array in `seed/catalog-additions.json`. The same seed also contributes 298 product-role rows and 420 product-source rows. It was produced by `scripts/ip-preference-cards/build-catalog-additions.ts` from the cited AccessGUDID and manufacturer sources. Five manufacturers are newly introduced by the import; Teleflex and Olympus were already present.

### Added products by manufacturer

| Manufacturer                     | Added products |
| -------------------------------- | -------------: |
| ICU Medical                      |            124 |
| Teleflex                         |             48 |
| Atrium Medical (Getinge)         |             29 |
| FUJIFILM                         |             19 |
| Auris Health (Johnson & Johnson) |             16 |
| Olympus                          |             12 |
| Noah Medical                     |              5 |
| **Total**                        |        **253** |

### Added products by primary category

| Primary category      | Added products |
| --------------------- | -------------: |
| Airway management     |            124 |
| Pleural procedures    |             77 |
| Peripheral navigation |             21 |
| Bronchoscopy platform |             14 |
| Flexible bronchoscopy |             11 |
| Ultrasound platform   |              5 |
| EBUS platform         |              1 |
| **Total**             |        **253** |

### Added product-role rows

| Role                                 |    Rows |
| ------------------------------------ | ------: |
| Adult cuffed tracheostomy tube       |      86 |
| Surgical thoracic catheter           |      45 |
| Large-bore chest tube set            |      38 |
| Adult cuffless tracheostomy tube     |      31 |
| Pleural drainage unit                |      21 |
| Peripheral guiding device            |      18 |
| Diagnostic flexible bronchoscope     |      12 |
| Pleural drainage accessory           |      11 |
| Therapeutic flexible bronchoscope    |       8 |
| Small-bore chest drain               |       7 |
| Subglottic suction tracheostomy tube |       7 |
| Linear EBUS bronchoscope             |       3 |
| Endoscopic ultrasound processor      |       3 |
| Video processor / light source       |       3 |
| Flexible bronchoscopy biopsy forceps |       1 |
| Pulmonary cytology brush             |       1 |
| Radial EBUS probe drive unit         |       1 |
| Radial EBUS probe                    |       1 |
| Conventional TBNA needle             |       1 |
| **Total**                            | **298** |

The increase is not caused by duplicate or malformed imports:

- There are zero duplicate normalized manufacturer-plus-catalog-number pairs in either the 253 additions or the full 1,474-product catalog.
- The additions contain 242 non-null GTINs, all unique. Eleven intentionally curated Auris rows have no canonical GTIN.
- All 253 additions have non-empty product ID, manufacturer, product name, catalog number, and primary category.
- All additions are each-level catalog rows. There are no duplicated each-versus-box package rows; legitimate size and configuration SKUs remain separate products.
- The import report records no catalog-addition errors, duplicate IDs, malformed specification JSON, or count warnings.

## Repository state and safety boundary

The requested branch was active. The preceding openFDA implementation was uncommitted, and unrelated critical-care/Cardiohelp changes were also present; those unrelated files were preserved.

The pre-change focused baseline passed 7 suites and 37 tests, with the opt-in live integration test skipped. The local script then detected a non-empty `OPENFDA_API_KEY` from the ignored `.env.local` without printing its value.

This work package did not add canonical acceptance, rejection, or apply behavior. The admin page remains a read-only GET/filter/table view. It has no mutation handler, accept/reject control, database write, catalog write, or formulary action.

## Deterministic calibration cohort

The checked-in cohort is `data/ip-preference-cards/seed/openfda-calibration-cohort.json`. Its schema enforces 25 unique product IDs and the intended challenge distribution:

| Expected challenge                              | Products |
| ----------------------------------------------- | -------: |
| Existing exact DI or GTIN                       |        5 |
| Catalog number plus backlog-suggested GUDID     |        5 |
| Catalog number without an existing DI candidate |        5 |
| Package-level ambiguity                         |        4 |
| Legacy or distribution-status question          |        3 |
| Manufacturer-alias complexity                   |        2 |
| Insufficient identifiers                        |        1 |
| **Total**                                       |   **25** |

The selection is deliberately not alphabetical. It favors P0/P1 verification work and covers EBUS needles, bronchoscopes/processors, balloon dilation, airway stents, chest drainage/pleural kits, guidewires, APC/cryo accessories, reusable instruments, capital equipment, and specimen accessories.

## Live execution and cache behavior

No run used `--exhaustive`.

| Run                            | Products | API requests | Cache hits / attempts | Retries | Timeouts | Query errors | Purpose                                                                            |
| ------------------------------ | -------: | -----------: | --------------------: | ------: | -------: | -----------: | ---------------------------------------------------------------------------------- |
| Initial live                   |       25 |           56 |                0 / 56 |       0 |        0 |            0 | First cold-cache cohort                                                            |
| Model-query remediation        |       25 |           18 |               56 / 74 |       0 |        0 |            0 | Filled exact-model queries needed when `catalog_number` was absent                 |
| Local exact-filter remediation |       25 |            6 |               74 / 80 |       0 |        0 |            0 | Filled brand/company follow-ups after analyzed-search false positives were removed |
| Final populated-cache run      |       25 |            0 |               80 / 80 |       0 |        0 |            0 | Final proposal set                                                                 |
| Immediate cached rerun         |       25 |            0 |               80 / 80 |       0 |        0 |            0 | Determinism/cache proof                                                            |
| Targeted `--refresh`           |        3 |            9 |                 0 / 9 |       0 |        0 |            0 | Cache bypass proof, limited to three products                                      |

The initial cold run used a median of 2 and a maximum of 5 API requests per product. Across the initial and two remediation passes, 80 live API requests were made before the final cache proof. The cached rerun served every one of the 24 queryable products from cache; the remaining product was classified as identifier-insufficient without a request. Query-attempt cache reuse was therefore 100%.

The final and immediate cached proposal files are byte-for-byte identical without excluding any fields:

```text
SHA-256 33916a6e906d5b2cf75d35cb12362955f3ff01ff4fbec8348285e756eaec3122
```

The targeted refresh processed exactly three products, made nine API requests, and reported zero cache-served products, proving bypass behavior.

## Final classifications

| Classification            |  Count |
| ------------------------- | -----: |
| High-confidence candidate |      2 |
| Review required           |     17 |
| Unmatched                 |      5 |
| Insufficient identifiers  |      1 |
| Query error               |      0 |
| **Total**                 | **25** |

The complete row-level result, query stage, reason codes, evidence reference, and blank external-review columns are in:

- `data/ip-preference-cards/generated/openfda/calibration/audit.csv`
- `data/ip-preference-cards/generated/openfda/calibration/audit.md`

The two high-confidence identity candidates were independently checked:

1. `PRD-00C13A59AA` — Richard Wolf TEXAS tracheoscope `82520.1441`. Candidate catalog normalizes exactly, `Richard Wolf GmbH` matches the reviewed legal-suffix rule, one deduplicated candidate is eligible, model/configuration agrees under approved normalization, Primary DI agrees with the backlog, and no package or adjacent-SKU ambiguity is present. The record is **Not in Commercial Distribution**, so high confidence applies only to identity and does not resolve its procurement/discontinuation question.
2. `PRD-05670F1B5F` — ERBE flexible cryoprobe `20402-411`. Catalog and model match exactly, `Erbe Elektromedizin GmbH` is an explicit reviewed alias, one deduplicated candidate is eligible, Primary DI agrees with the backlog, and no package or adjacent-SKU ambiguity is present.

Seven provisional exact-DI matches were placed in `review_required` and made the calibration query command exit nonzero because openFDA omitted the candidate `catalog_number`, even though the same order number appeared in `version_or_model_number`:

```text
PRD-05780FEDD7
PRD-09AB6CA202
PRD-189E7EF27A
PRD-2302DA77DA
PRD-5F801B5A8E
PRD-94C61697D9
PRD-9BB524F077
```

This is an intentional invariant outcome, not a silent downgrade. Each proposal contains `high_confidence_invariant_failed` and the precise catalog/eligibility reason.

The five unmatched products were:

```text
PRD-019030A1C7  Karl Storz secretion aspirator
PRD-1BCD8D38BC  Olympus ViziShot 2 needle variant
PRD-2B8AACAB67  Olympus EU-ME3 ultrasound center
PRD-C684D9ADCF  ERBECRYO 2 exhaust gas hose
PRD-E04326B8E4  Olympus EU-ME2 ultrasound center
```

The EU-ME2/EU-ME3 API searches returned prefix/name-related records, but local exact filtering correctly rejected them. `PRD-1A152615A0`, the patient-specific stent design service, was classified `insufficient_identifiers` because `CUSTOM-SERVICE` is a workflow placeholder rather than a UDI identity.

## Calibration metrics

| Metric                                             |                              Result |
| -------------------------------------------------- | ----------------------------------: |
| Backlog agreements                                 |                                  16 |
| Final DI conflicts                                 |                                   0 |
| Final distribution-status conflicts                |                                   0 |
| Exact candidate catalog matches                    |  5 / 19 selected candidates (26.3%) |
| Reviewed manufacturer-alias matches                | 17 / 19 selected candidates (89.5%) |
| Products with multiple candidate records           |                                   6 |
| Cohort products requiring package-level resolution |                                   4 |
| Query errors                                       |                                   0 |
| Cached-rerun query-attempt reuse                   |                                100% |

These rates describe pipeline outcomes only; they are not accuracy measurements.

### Results by expected challenge

| Expected challenge            | High | Review | Unmatched | Insufficient | Query error |
| ----------------------------- | ---: | -----: | --------: | -----------: | ----------: |
| Existing exact DI or GTIN     |    0 |      5 |         0 |            0 |           0 |
| Catalog plus suggested GUDID  |    1 |      4 |         0 |            0 |           0 |
| Catalog without existing DI   |    0 |      1 |         4 |            0 |           0 |
| Package-level ambiguity       |    0 |      4 |         0 |            0 |           0 |
| Legacy/distribution question  |    1 |      1 |         1 |            0 |           0 |
| Manufacturer-alias complexity |    0 |      2 |         0 |            0 |           0 |
| Insufficient identifiers      |    0 |      0 |         0 |            1 |           0 |

### Backlog comparison

| Comparison                                  | Products |
| ------------------------------------------- | -------: |
| Agrees with existing backlog                |       16 |
| Not previously evaluated                    |        7 |
| Adds a missing candidate                    |        1 |
| Existing backlog has more-specific evidence |        1 |
| Conflicts with existing DI                  |        0 |
| Conflicts with distribution status          |        0 |

An intermediate ERBE package-family run briefly selected an older same-catalog record and surfaced a DI/distribution conflict. This exposed a deterministic ranking defect. The sorter now uses an exact backlog DI to break same-catalog ties without promoting multi-record families; the final selected record agrees with the backlog.

## Unresolved package and multi-record review

All four package-challenge products remained correctly review-required:

| Product                                    | Exact eligible candidates | Review issue                                                                                                     |
| ------------------------------------------ | ------------------------: | ---------------------------------------------------------------------------------------------------------------- |
| `PRD-1517AA42DA` Teleflex Arrow-Clarke kit |                         6 | Same catalog across package/configuration records; selected backlog DI still has model/configuration differences |
| `PRD-6D9A7A7E79` Olympus ViziShot 2 needle |                         2 | Same model with multiple records; candidate catalog absent                                                       |
| `PRD-1708F37D2C` ERBE APC applicator       |                         2 | Current and non-current same-catalog records; backlog DI ranks first but ambiguity remains                       |
| `PRD-C094F5AF07` Olympus EBUS balloon      |                         3 | Multiple model records and candidate catalog/model separation                                                    |

Two additional non-package challenges produced multiple candidates:

- `PRD-02BE5F7D32` returned four exact-brand MAXXWIRE variants after the API’s adjacent catalog result was rejected.
- `PRD-E37704D087` returned 63 raw analyzed-search records for short catalog `6522`; local equality retained five exact catalog records, so it remains review-required.

## Matching defects discovered and fixed

1. **Local key detection:** the CLI previously read only exported process variables. It now silently loads ignored `.env.local` when `OPENFDA_API_KEY` is not already exported and never logs the value.
2. **Premature DI stopping:** a single DI hit previously stopped before model discovery, hiding same-model package siblings when openFDA omitted `catalog_number`. Normal mode now always tries exact catalog and, if needed, exact model before stopping.
3. **Incomplete high-confidence gate:** exact DI alone could provisionally pass without exact candidate catalog or reviewed manufacturer identity. A separate runtime invariant now requires exact catalog, explicit alias, one eligible candidate, no model/configuration conflict, no package ambiguity, no product-name-only evidence, no adjacent SKU, a Primary DI, and DI agreement.
4. **Package-family ranking:** same-catalog ties could select an older record before the backlog’s exact DI. Exact backlog DI now ranks first within the still-review-required family.
5. **Analyzed-search false positives:** quoted openFDA searches are not guaranteed full-field equality. Every query stage now applies deterministic local equality before deduplication/classification and records both raw and eligible result counts.
6. **Placeholder identifiers:** `CUSTOM-SERVICE` was queryable as if it were a device catalog number. Known non-device placeholders are now excluded from identity queries.
7. **Real-response regression coverage:** a sanitized package-bearing response fixture now covers absent catalog numbers, Primary/Package identifiers, string package quantities/statuses, nested sterilization, device sizes, product codes, premarket submissions, and future passthrough fields.

## Real-response schema behavior

The final schema audit validated 79 cached query entries and 113 deduplicated records. There were zero schema parse failures and zero malformed retained records.

Fields consistently present in this sample included company and brand name, model number, identifiers, base-package count, commercial-distribution status, public record/version dates and status, record status, product codes, GMDN terms, sterilization, and the retained boolean device flags.

Commonly absent fields were:

| Field                              | Missing / 113 |
| ---------------------------------- | ------------: |
| `storage`                          |           104 |
| `commercial_distribution_end_date` |            97 |
| `device_sizes`                     |            87 |
| `customer_contacts` (passthrough)  |            60 |
| `premarket_submissions`            |            53 |
| `catalog_number`                   |            31 |
| `device_description`               |            26 |

`version_or_model_number` was present and non-blank in all 113 records, with 92 distinct values. The frequent absence of `catalog_number` is the principal reason exact-DI records did not satisfy the high-confidence invariant.

Nested identifiers included 113 Primary, 18 Package, 7 Unit-of-Use, and 2 Previous identifiers. Package fields used strings for quantity, status, and type. Package-type spelling/casing varied (`Case`, `CASE`, `Level 1`, `Level1`, `Peel Pack`, and `Crate`), and six package identifiers omitted a package type. Eleven package identifiers were in commercial distribution and seven were not. Eighteen records had package identifiers; 25 records had more than one identifier.

Distribution statuses encountered were 97 `In Commercial Distribution` and 16 `Not in Commercial Distribution`. Additional FDA fields not used for matching remained available through the passthrough schema. Some FDA boolean-like fields arrived as strings; retained matching fields kept their expected shapes, so no parser coercion defect was required beyond the existing tolerant handling.

## Manufacturer-alias review

Only narrow legal-name variants directly exposed by the cohort were added:

| Canonical manufacturer           | Added explicit alias            | Product(s) exposing need                          | Decision basis                                                     |
| -------------------------------- | ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| ERBE                             | `Erbe Elektromedizin GmbH`      | `PRD-05670F1B5F`, `PRD-1708F37D2C`                | Exact labeler legal name                                           |
| Atrium Medical (Getinge)         | `Atrium Medical Corporation`    | `PRD-94C61697D9`                                  | Exact GUDID labeler named in the curated source seed               |
| Auris Health (Johnson & Johnson) | `Auris Health, Inc.`            | `PRD-09AB6CA202`                                  | Exact labeler legal name; does not alias Johnson & Johnson broadly |
| Merit Medical                    | `Merit Medical Systems, Inc.`   | `PRD-02BE5F7D32`                                  | Exact legal-name variant                                           |
| Olympus                          | `Olympus Medical Systems Corp.` | Olympus needle/balloon/processor/reprocessor rows | Exact labeler legal name                                           |

The following were deliberately **not** aliased:

- `COOK INCORPORATED` and `COOK IRELAND LTD` to `Cook Medical`: these are distinct legal entities/subsidiaries, and a broad `Cook` alias would be unsafe.
- `Gyrus ACMI, LLC` to `Olympus`: the relationship reflects acquisition/legacy ownership, not simple spelling or legal-suffix variation.
- `Johnson & Johnson` to Auris Health: a parent-company name is too broad for product identity matching.

## Safety and immutability verification

The live run preserved all protected inputs:

| Protected file                    | Before SHA-256                                                     | After SHA-256 | Result    |
| --------------------------------- | ------------------------------------------------------------------ | ------------- | --------- |
| `catalog-products.json`           | `1948f00c20f673dfbe2092bde6315c78ca02b8cb5f3f1e308e33c223175861fe` | same          | Unchanged |
| `verification-backlog.json`       | `25ab658850a5df620986d4596d5043f40e46d17132493dd62d7adaffc36c1b38` | same          | Unchanged |
| `hospital-formulary-staging.json` | `f8ceb2433694f7ef1d5f65a6e4533fa6c2b1f83659d6ba017abda5fda4908e73` | same          | Unchanged |
| Source workbook                   | `fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf` | same          | Unchanged |

Additional checks:

- The API key was compared in memory against all tracked/unignored text files and generated calibration output; zero matches were found.
- No raw cache file is tracked by Git.
- No bulk ZIP exists in either permitted bulk location.
- No canonical field, visibility state, verification state, formulary decision, compatibility rule, or approval status was applied.
- The admin queue remains read-only.
- Complete response records remain only in the ignored local cache; checked-in artifacts contain the retained review subset and aggregate schema observations.

Machine-readable evidence is in:

- `data/ip-preference-cards/generated/openfda/calibration/metrics.json`
- `data/ip-preference-cards/generated/openfda/calibration/schema-audit.json`
- `data/ip-preference-cards/generated/openfda/calibration/safety-verification.json`

## Commands run

Repository establishment and baseline:

```bash
git branch --show-current
git status --short
git log -1 --oneline
npx jest scripts/ip-preference-cards/openfda --runInBand
```

Key detection and cohort preview:

```bash
npx tsx -e "import { hasOpenFdaApiKey, loadOpenFdaLocalEnvironment } from './scripts/ip-preference-cards/openfda/env'; loadOpenFdaLocalEnvironment(); console.log(hasOpenFdaApiKey() ? 'OPENFDA_API_KEY_DETECTED_BY_SCRIPT' : 'OPENFDA_API_KEY_NOT_DETECTED')"
npm run ip-cards:openfda:query -- --cohort data/ip-preference-cards/seed/openfda-calibration-cohort.json --dry-run
```

Live, remediation, cached, and refresh runs:

```bash
npm run ip-cards:openfda:query -- --cohort data/ip-preference-cards/seed/openfda-calibration-cohort.json --output-dir data/ip-preference-cards/generated/openfda/calibration/initial --concurrency 3
npm run ip-cards:openfda:query -- --cohort data/ip-preference-cards/seed/openfda-calibration-cohort.json --output-dir data/ip-preference-cards/generated/openfda/calibration/live --concurrency 3
npm run ip-cards:openfda:query -- --cohort data/ip-preference-cards/seed/openfda-calibration-cohort.json --output-dir data/ip-preference-cards/generated/openfda/calibration/postfilter --concurrency 3
npm run ip-cards:openfda:query -- --cohort data/ip-preference-cards/seed/openfda-calibration-cohort.json --output-dir data/ip-preference-cards/generated/openfda/calibration/final --concurrency 3
npm run ip-cards:openfda:query -- --cohort data/ip-preference-cards/seed/openfda-calibration-cohort.json --output-dir data/ip-preference-cards/generated/openfda/calibration/cached --concurrency 3
npm run ip-cards:openfda:query -- --cohort data/ip-preference-cards/seed/openfda-calibration-cohort.json --limit 3 --refresh --output-dir data/ip-preference-cards/generated/openfda/calibration/refresh --concurrency 3
npm run ip-cards:openfda:query -- --cohort data/ip-preference-cards/seed/openfda-calibration-cohort.json --concurrency 3
npm run ip-cards:openfda:calibrate
```

The last query command materialized the final cached cohort at the top-level generated proposal path used by the read-only admin queue. It made zero API requests and performed no canonical write.

Focused tests and type-check were rerun during remediation:

```bash
npx jest scripts/ip-preference-cards/openfda --runInBand
npx jest src/features/preference-cards/__tests__/openfda-review.test.tsx --runInBand
npx tsc --noEmit --pretty false
```

The focused admin-queue test also passed all 4 tests after the final proposals were materialized.

Final repository-wide validation results are recorded below after all implementation and report changes.

## Final validation

| Command                                                    | Result                                                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run ip-cards:validate-data`                           | Passed: 1,474 products, 98 roles, 13 procedures, 174 procedure slots; workbook SHA matched                                               |
| `npx jest scripts/ip-preference-cards/openfda --runInBand` | Passed: 7 suites and 46 tests; 1 opt-in live integration suite/test skipped                                                              |
| `npm run type-check`                                       | Passed                                                                                                                                   |
| `npm run lint`                                             | Passed with 0 errors and 18 pre-existing warnings in unrelated UI/Cardiohelp files                                                       |
| `npm run build`                                            | Passed, including content generation, critical-care/cardiac asset validation, Next.js production compilation, and standalone preparation |

The build emitted existing webpack dynamic-dependency/cache and `metadataBase` warnings; none came from the openFDA implementation and none failed the build.

## Recommendation

**2. Requires another calibration cohort.**

The pipeline now fails safely, preserves canonical data, reproduces proposals from cache, locally rejects analyzed-search false positives, and exposes package/model ambiguity rather than promoting it. However, only 5 of 19 selected candidates carried an exact candidate catalog match, seven exact-DI records were invariant-demoted because openFDA omitted `catalog_number`, four intended package cases remain unresolved, and no independent human decisions exist yet.

Before a larger P0/P1 run, use a second bounded cohort focused on:

- exact DI records whose order number appears only in `version_or_model_number`;
- short or reused catalog numbers across manufacturers;
- package/unit-of-use relationships with externally reviewed correct DIs;
- manufacturer/subsidiary cases deliberately excluded from the alias registry;
- human-reviewed expected outcomes for at least the current two high-confidence and four package-ambiguity cases.

Do not add canonical apply behavior until that second calibration and external review are complete.
