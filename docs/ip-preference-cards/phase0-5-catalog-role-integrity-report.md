# Phase 0.5 catalog-role integrity implementation report

Date completed: 2026-07-28

## Branch and scope

- Intended source/target branch: `codex/ip-openfda-enrichment-v0-1`, beginning from
  `25a35a051aab120efa8632de6b78a2ab4df10aae`.
- Work began on that local branch at the same commit. While the shared checkout was dirty,
  another session temporarily switched it to `critical-care/module-rebuild` and later advanced
  that branch to `68b4c0ebaf5d016a3492823f0f4f9fd5466960ab`. The completed Phase 0.5 work has
  now been returned to the intended branch for explicit isolation.
- Existing commits, including the earlier mixed snapshot and intervening critical-care commits,
  were not rewritten, reverted, amended, or otherwise cleaned up. The proposal-generator command
  in `package.json` remains in `25a35a05` and is excluded from this package's explicit staging.
- All other files in this bounded package remain uncommitted while they are isolated through the
  dedicated implementation commit step. No database migration, network request, live OpenFDA run,
  or bulk UDI download was created.

The source workbook, catalog identity, product roles, verification backlog, formulary staging,
OpenFDA artifacts, aliases, classifier, query plan, visibility states, verification grades,
compatibility rules, and resolved-card readiness calculation remain unchanged.

## Outcome

The server now validates the exact `(product_id, role_code)` relationship when rebuilding
ordinary catalog picks and equipment-set members for save. It distinguishes unknown products,
unknown roles, and known products not mapped to the requested role. Invalid requests are
rejected rather than coerced.

Valid multi-role data is retained rather than collapsed: one catalog product or product family
may expose a distinct option for each role it actually carries, and the equipment-set editor
adds, removes, keys, and disables members by exact `(product_id, role_code)` pair.

The role-scoped catalog browser remains intentionally broad: candidate and unverified products
mapped through `Product_Roles` remain discoverable and badged, whether or not they have a
curated exact-slot option. Family picks remain role-scoped, and recipe-permitted custom items
continue to work.

The workbook's 2,080 authored exact-slot options remain canonical. The missing broad-role join
is represented by 475 deterministic, unreviewed proposal rows in a separate artifact. Every
proposal is `selectable: false` and `visible_by_default: false`. The empty exception file
produces zero exclusions and zero stale exceptions.

Exact local GUDID distribution context is carried on 468 proposals (459 in distribution and
9 not in distribution). Seven rows for four products remain unset because exact local records
conflict; distribution context never changes proposal eligibility or review status.

Procedure selection, the dashboard, and the admin recipe view now show catalog alternatives
and curated defaults as separate source-data metrics. Accessible copy explicitly says neither
metric establishes readiness, compatibility, orderability, local approval, or clinical
suitability. `ResolvedCard.readinessState` remains a post-resolution result.

## Supplied Phase 0 patch disposition

Repository inspection found that the supplied automatic-promotion behavior and proposal
artifact had not been applied. A dormant `package.json` command already referenced the
then-missing proposal generator; that script entry was retained and made functional.

- Retained: its drift detection expression,
  `Procedure_Slots × Product_Roles − authored Slot_Product_Options`.
- Replaced: automatic canonical-row creation with a deterministic, review-only proposal
  artifact and strict proposal exceptions.
- Rejected: setting derived pairs to `selectable: true` or
  `visible_by_default: true`, and treating broad role equality as exact-slot eligibility.

## Counts

| Measure                              |    Count |
| ------------------------------------ | -------: |
| Generated catalog products           |    1,474 |
| Product-role relationships           |    1,566 |
| Procedures                           |       13 |
| Procedure slots                      |      174 |
| Authored canonical slot options      |    2,080 |
| Generated unreviewed proposals       |      475 |
| Excluded proposal pairs              |        0 |
| Stale exceptions                     |        0 |
| Authored-row errors                  |        0 |
| Proposal-generation errors           |        0 |
| Required slots with catalog coverage | 56 of 80 |
| Required slots with curated defaults | 41 of 80 |
| Roles without catalog products       |  6 of 98 |

The import command reports the workbook's 1,221 product rows; generated validation reports
1,474 after the pre-existing 253 reviewed catalog additions are merged. The protected
`catalog-products.json` hash proves this work package did not change that catalog.

## Required coverage by procedure

| Procedure            | Required lines | Catalog alternatives | Curated defaults | Required lines allowing custom |
| -------------------- | -------------: | -------------------: | ---------------: | -----------------------------: |
| `CHEST_TUBE`         |              3 |          1/3 (33.3%) |         0/3 (0%) |                              3 |
| `EBUS_TBNA`          |              7 |          5/7 (71.4%) |      5/7 (71.4%) |                              7 |
| `EBV`                |              7 |          6/7 (85.7%) |      5/7 (71.4%) |                              7 |
| `FLEX_DIAGNOSTIC`    |              4 |            2/4 (50%) |        2/4 (50%) |                              4 |
| `ICU_BRONCH`         |              7 |          4/7 (57.1%) |      4/7 (57.1%) |                              7 |
| `IPC_PLACEMENT`      |              6 |          4/6 (66.7%) |      4/6 (66.7%) |                              6 |
| `MED_THORACOSCOPY`   |             11 |         9/11 (81.8%) |     3/11 (27.3%) |                             11 |
| `PERC_TRACH`         |              8 |            6/8 (75%) |      3/8 (37.5%) |                              8 |
| `RIGID_BRONCH`       |              8 |           8/8 (100%) |        6/8 (75%) |                              8 |
| `TB_RULEOUT`         |              6 |            3/6 (50%) |        3/6 (50%) |                              6 |
| `THERAPEUTIC_BRONCH` |              3 |          2/3 (66.7%) |      2/3 (66.7%) |                              3 |
| `THORACENTESIS`      |              4 |            2/4 (50%) |        1/4 (25%) |                              4 |
| `WLL`                |              6 |          4/6 (66.7%) |        3/6 (50%) |                              6 |

Catalog alternatives count required slots whose role has at least one `Product_Roles`
product, including candidate/unverified products. Curated defaults count only selectable
canonical `Slot_Product_Options`; proposal rows never count.

## Server-boundary and regression tests

Tests cover:

- valid exact product-role reconstruction;
- distinct unknown-product, unknown-role, and wrong-role results;
- tampered ordinary `SaveCardRequest` rejection;
- tampered overwrite-request rejection when a `cardId` is present;
- tampered equipment-set-member rejection;
- positive save-time reconstruction for ordinary picks and equipment sets;
- unchanged custom-item reconstruction through the save boundary;
- continued role scoping for family picks, including one line valid for two roles;
- one valid catalog product retained for two mapped roles without collapsing either selection;
- discovery and verification badges for a role-mapped product absent from canonical options;
- rejection of that product for roles it does not carry;
- preserved custom-item behavior in the existing focused suite;
- authored-row integrity and precedence;
- proposal nonselectability, determinism, completeness, and input-order independence;
- inclusion of exact distribution context already stored on local catalog products;
- omission of distribution context when exact local records conflict;
- strict valid, malformed, global, contradictory, overlapping, and stale exception behavior;
- independent catalog/default coverage, including candidate products and excluded proposals;
- explicit, non-readiness UI labels and accessible explanations; and
- deterministic generated scenario and proposal files.

## Files added

- `data/ip-preference-cards/generated/slot-product-option-proposals.json`
- `data/ip-preference-cards/seed/slot-option-exceptions.json`
- `docs/ip-preference-cards/catalog-role-and-slot-semantics.md`
- `docs/ip-preference-cards/phase0-5-catalog-role-integrity-plan.md`
- `docs/ip-preference-cards/phase0-5-catalog-role-integrity-report.md`
- `docs/ip-preference-cards/phase0-5-protected-hash-manifest.md`
- `scripts/ip-preference-cards/coverage-metrics.ts`
- `scripts/ip-preference-cards/coverage-metrics.test.ts`
- `scripts/ip-preference-cards/derive-slot-option-proposals.ts`
- `scripts/ip-preference-cards/derive-slot-option-proposals.test.ts`
- `scripts/ip-preference-cards/protected-artifacts.test.ts`
- `scripts/ip-preference-cards/validate-data.test.ts`
- `src/features/preference-cards/__tests__/PreferenceCardWizardCoverage.test.tsx`
- `src/features/preference-cards/__tests__/user-card-product-role-integrity.test.ts`

## Files modified

- `package.json` (proposal command entry already captured in shared commit `25a35a05`)
- `data/ip-preference-cards/generated/coverage-report.json`
- `data/ip-preference-cards/generated/demo-seed-summary.json`
- `data/ip-preference-cards/generated/import-report.json`
- `data/ip-preference-cards/generated/scenarios.json`
- `docs/ip-preference-cards/data-import.md`
- `docs/ip-preference-cards/pilot-readiness.md`
- `docs/ip-preference-cards/session-handoff-2026-07-27.md`
- `messages/en.json`
- `messages/es.json`
- `messages/zh-CN.json`
- `scripts/ip-preference-cards/coverage.ts`
- `scripts/ip-preference-cards/generate-scenarios.ts`
- `scripts/ip-preference-cards/import-catalog.ts`
- `scripts/ip-preference-cards/import-output.test.ts`
- `scripts/ip-preference-cards/validate-data.ts`
- `scripts/ip-preference-cards/validate-seed.ts`
- `src/app/[locale]/admin/preference-cards/recipes/page.tsx`
- `src/app/[locale]/preference-cards/page.tsx`
- `src/features/preference-cards/__tests__/catalog-messages.test.ts`
- `src/features/preference-cards/__tests__/catalog-pick.test.ts`
- `src/features/preference-cards/__tests__/catalog-queries.test.ts`
- `src/features/preference-cards/__tests__/equipment-set.test.ts`
- `src/features/preference-cards/__tests__/family-pick.test.ts`
- `src/features/preference-cards/__tests__/migration-contract.test.ts`
- `src/features/preference-cards/__tests__/scenarios.test.ts`
- `src/features/preference-cards/__tests__/size-at-procedure.test.ts`
- `src/features/preference-cards/components/EquipmentSetManager.tsx`
- `src/features/preference-cards/components/PreferenceCardWizard.tsx`
- `src/features/preference-cards/data/demo-context.server.ts`
- `src/features/preference-cards/domain/catalog-pick.ts`
- `src/features/preference-cards/domain/equipment-set.ts`
- `src/features/preference-cards/domain/family-pick.ts`
- `src/features/preference-cards/domain/resolve-card.ts`
- `src/features/preference-cards/domain/size-at-procedure.ts`
- `src/features/preference-cards/domain/types.ts`
- `src/features/preference-cards/server/catalog.ts`
- `src/features/preference-cards/server/user-cards.ts`

Unrelated literature, critical-care, mechanical-circulatory-support, and Supabase migration
changes already present in the shared working tree were not modified or included in this file
inventory.

## Validation results

Commands were run in the prescribed order:

| Command                                                                          | Exact result                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run ip-cards:import`                                                        | Passed. Workbook import: 1,221 products, 1,268 product roles, 13 procedures, 174 slots, 2,080 authored options; 80/80 GTINs normalized to 14 digits and zero required review.                                |
| `npm run ip-cards:coverage`                                                      | Passed. Wrote explicit results for all 13 procedures; 6/98 roles have no catalog products.                                                                                                                   |
| `npm run ip-cards:scenarios`                                                     | Passed. Wrote 13 scenarios and 20 generated modifier definitions.                                                                                                                                            |
| `npm run ip-cards:validate-data`                                                 | Passed. Validated 1,474 products, 98 roles, 1,566 product-role rows, 174 slots, 2,080 authored options, 475 proposals, zero exclusions, and zero stale exceptions.                                           |
| `npm run ip-cards:seed`                                                          | Passed. Validated 31 demo-only stand-ins and all 13 scenarios; the legacy four-procedure source gate identified 8 explicitly resolved required roles without curated defaults.                               |
| `npx jest scripts/ip-preference-cards src/features/preference-cards --runInBand` | Passed: 37 suites passed, 1 live-OpenFDA suite intentionally skipped; 361 tests passed, 1 skipped.                                                                                                           |
| `npm run type-check`                                                             | Passed with no TypeScript errors.                                                                                                                                                                            |
| `npm run lint`                                                                   | Passed with 0 errors and 18 warnings outside this work package.                                                                                                                                              |
| `npm run build`                                                                  | Passed. Generated 24 content documents, validated 19 critical-care assets and the cardiac asset set, completed the Next.js webpack production build, and refreshed `.next/BUILD_ID` plus `.next/standalone`. |

The live OpenFDA integration suite was not enabled, consistent with this package's no-network
constraint.

## Protected-file verification

Every protected before/after hash matches, including the workbook, canonical product and role
data, verification/formulary staging, canonical slot options, both manufacturer-alias files,
OpenFDA classifier/query plan, and all 48 OpenFDA generated artifacts. The complete
path-level record is in
[`phase0-5-protected-hash-manifest.md`](./phase0-5-protected-hash-manifest.md).

Current generated work-package artifact hashes:

| Artifact                             | SHA-256                                                            |
| ------------------------------------ | ------------------------------------------------------------------ |
| `slot-product-option-proposals.json` | `e489ede20808f5a87cfb93341fb9b47fffce6a02877b85c2cae7be29f337011f` |
| `coverage-report.json`               | `735b32701decd82d6b4ed77ee8172102f0fd7b0230851795716e4cf58c8cbbe8` |
| `scenarios.json`                     | `4eca70ccf9f8abcf936d9b3f4abf328f7077fe1dd57109f3f7de5fb5d16bc839` |
| `import-report.json`                 | `c5d6fc00b5fa8b3b6df875d26b6d0731fc0fe8ff6889e7faee4756426cce2288` |
| `demo-seed-summary.json`             | `7e7d11f68e0c0f56ea44b487541a2bad30db901c178468e5f9c66c12138bba12` |

## Known limitations and stop point

- The 475 proposal rows are an inspection artifact, not a review queue with decisions,
  ownership, or an apply path.
- There are no explicit exceptions yet. The empty file exercises and locks the validation
  contract but does not encode clinical review.
- Required catalog/default gaps remain real. Custom items keep the builder usable where
  permitted but do not turn a gap into approval or readiness.
- Coverage is descriptive; neither metric validates compatibility, package identity,
  formulary availability, current orderability, or clinical suitability.
- The active locale bundles use the repository's English-fallback convention for the new
  copy rather than completed clinical translation.
- There is no current reopen/edit wizard. The latent overwrite request is revalidated, but
  duplication intentionally copies a frozen snapshot and its builder inputs without
  rebuilding them; legacy invalid rows and owner-scoped direct database writes are outside
  this application-boundary package.
- Import and proposal generation fail closed, but the multi-file catalog import is not a
  transactional filesystem operation if a future run fails partway through.
- The shared working tree still contains unrelated uncommitted literature and Supabase changes.
  They are outside the explicit Phase 0.5 allowlist and remain excluded from this dedicated
  isolation step.

The smallest logical next work package is a read-only clinical review of a small, explicitly
bounded subset of the 475 proposals, producing reviewed decisions and exact exceptions without
building an acceptance/apply workflow or changing canonical options. That next package has
not been started.
