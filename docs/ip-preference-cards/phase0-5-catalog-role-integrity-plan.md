# Phase 0.5 catalog-role integrity implementation plan

## Scope and current state

This work package separates broad catalog discovery from curated exact-slot defaults. It does
not expand the catalog, change product identity or verification, infer compatibility, or run
OpenFDA/GUDID enrichment.

The source workbook is
`Preference_card_module/IP_Procedure_Equipment_Catalog_v0_5_with_GUDID_Verification_Backlog.xlsx`.
Its `Slot_Product_Options` sheet contains 2,080 authored rows. The generated canonical
`slot-product-options.json` contains those same 2,080 rows; the importer currently normalizes
their product visibility and `selectable` state but does not derive extra rows. A repository
inspection found no Phase 0 code that promotes the full role join into canonical options, so
the supplied automatic-promotion patch has not been applied.

Against the current generated data, all 2,080 authored rows have valid slot and product foreign
keys, use the slot's role, have a matching `Product_Roles` relationship, and have unique
`(slot_id, product_id)` keys. The join of `Procedure_Slots × Product_Roles`, after subtracting
those authored rows, currently contains 475 unreviewed pairs. That count is diagnostic only;
the implementation and tests will not treat it as a permanent fixture constant.

Current behavior has one server-side integrity defect: `getCatalogPick(productId, roleCode)`
verifies only that the product exists, then copies the caller-provided role into the rebuilt
pick. The role-scoped picker and `getFamilyPick` are correctly limited by `Product_Roles`, but
a tampered save request can bypass the browser and attach a known product to an arbitrary role.
Equipment-set members use the same unsafe rebuild helper.

## Domain semantics

### `Product_Roles`

`Product_Roles` means that a product is classified under a broad clinical/equipment role and
may be discovered in the role-scoped catalog browser. It does not establish exact slot
eligibility, platform compatibility, adult/pediatric appropriateness, package identity,
orderability, local formulary approval, or clinical suitability.

### `Slot_Product_Options`

`Slot_Product_Options` means that an exact product was specifically authored or reviewed as a
default option for an exact procedure slot. It is a stronger curated relationship and is not
inferred from broad role equality.

### Custom items

Custom items remain per-user, catalog-free requirements that can be entered only where the
recipe allows them. This work does not add an organization-level formulary.

### Resolved-card readiness

`ResolvedCard.readinessState` is calculated only after resolving an actual card. Catalog
coverage and curated-default coverage are descriptive source-data metrics and will not be
called readiness, approval, or completeness.

## Where the relationships are consumed

`Product_Roles` is consumed by:

- `server/catalog-store.ts`, which builds `productIdsByRole` and `rolesByProduct`;
- `server/catalog.ts`, which scopes use browsing, catalog search, role picker results, product
  families, product detail, and family reconstruction;
- `data/demo-context.server.ts`, which lists role-eligible catalog products for the read-only
  administrative view;
- `generate-scenarios.ts` and `coverage.ts`, which currently compute ambiguous role/product
  coverage; and
- the read-only OpenFDA proposal view, which displays mapped roles and procedures without
  changing them.

`Slot_Product_Options` is consumed by:

- `server/catalog-store.ts` and `server/catalog.ts` for the authored “used in” slot list on a
  product detail page; and
- `coverage.ts` for selectable option counts.

It does not currently constrain the role-scoped catalog picker, and this implementation will
preserve that behavior.

## Catalog picker and save-time reconstruction

`CatalogOptionPicker` requests products and product families using the effective requirement
role. `searchProductsForRole` and `searchProductFamiliesForRole` read
`CatalogStore.productIdsByRole`, include candidate/unverified products, and return verification
and distribution badges.

The client saves only product/family identifiers and role codes. `resolveForSave` rebuilds
ordinary catalog picks, families, and equipment-set members from the server catalog before
resolving the stored card. The implementation will introduce an explicit product-role lookup
result that distinguishes unknown products, unknown roles, and known products not mapped to the
requested role. Ordinary picks and equipment-set members will use it. `getCatalogPick` will
remain a safe nullable compatibility wrapper, and `getFamilyPick` will remain role-scoped.

## Files to add

- `scripts/ip-preference-cards/derive-slot-option-proposals.ts`
- `scripts/ip-preference-cards/coverage-metrics.ts`
- focused generator, coverage, and save-boundary tests
- `data/ip-preference-cards/seed/slot-option-exceptions.json`
- `data/ip-preference-cards/generated/slot-product-option-proposals.json`
- `docs/ip-preference-cards/catalog-role-and-slot-semantics.md`
- a protected-file hash manifest and final integrity report if needed for a compact auditable
  before/after record

## Files expected to change

- catalog import and generated-data validation scripts;
- scenario and coverage generators and their generated JSON;
- `package.json` only if a deterministic proposal command needs to be exposed;
- server catalog reconstruction and save-boundary error handling;
- scenario types/loaders and the procedure picker, dashboard, and admin recipe table;
- all active locale bundles using the existing English-fallback convention;
- preference-card tests and generated-data contract tests;
- `data-import.md`, `pilot-readiness.md`, and the current session handoff.

The source workbook, canonical product/role/verification/formulary data, OpenFDA artifacts,
manufacturer aliases, and OpenFDA classifier/query planning source are protected and will not
be edited.

## Generated-data strategy

The canonical `slot-product-options.json` remains a direct normalized representation of
authored workbook rows. A deterministic generator will validate those authored rows, compute
the missing role-join pairs, validate and apply narrowly scoped exceptions, and write a
separate proposal artifact. Every proposal will be `unreviewed`, `selectable: false`, and
`visible_by_default: false`, with enough product, role, source, verification, visibility, and
local distribution context for review.

The exception file will be parsed with Zod. Unknown or contradictory identifiers,
product-only suppression, duplicate/overlapping suppression, trivial rationales, and stale
exceptions will fail generation. Exceptions may suppress proposals only; authored rows are
validated before exception matching and can never be removed by an exception.

`ip-cards:import` will regenerate canonical workbook outputs first and then regenerate the
proposal artifact without mutating canonical options. `ip-cards:validate-data` will rebuild
the expected proposal artifact in memory and fail if checked-in output differs.

## Coverage metrics

A shared pure helper will calculate, per procedure:

- required catalog coverage: required slots whose role has at least one existing
  `Product_Roles` product, including candidate/unverified products;
- required curated-default coverage: required slots with at least one canonical selectable
  `Slot_Product_Options` row; and
- the descriptive count of required slots allowing custom items.

The scenario generator and coverage report will both use this helper. Unreviewed proposals
will not be an input to curated-default coverage. The obsolete
`requiredRoleMappingPercentage` and `emptyRoleCodes` scenario fields have no persisted card or
public API consumer in this repository, so generated scenarios and UI will migrate to explicit
fields instead of retaining an ambiguous alias.

## Backward compatibility

- Existing saved-card request shapes remain unchanged.
- Existing valid catalog picks, family picks, equipment sets, and custom items keep their
  current behavior.
- Invalid product-role pairs that previously slipped through are rejected rather than coerced.
- Stored resolved-card readiness and its calculation are unchanged.
- Role-scoped browsing remains broader than curated defaults.
- The generated scenario shape changes only for descriptive coverage fields; persisted builder
  inputs and resolved card snapshots do not embed those fields.

## Validation and tests

Pure fixture tests will cover authored-row integrity, proposal/nonselectable semantics,
exception validation and staleness, deterministic output under input reordering, authored-row
precedence, and independent coverage metrics. Catalog/server tests will cover valid, unknown,
wrong-role, family-role, tampered save, and equipment-set paths. Existing custom-item,
catalog-browser, verification badge, scenario, and resolution tests will remain in the focused
suite.

Generated-data validation will check canonical foreign keys, uniqueness, slot-role equality,
matching `Product_Roles`, existing visibility/selectability rules, proposal completeness,
exception exactness, and byte-reproducible proposal regeneration. The prescribed import,
coverage, scenario, data validation, seed validation, focused Jest, type-check, lint, and build
commands will run in order.

## Assumptions

- The workbook is the authority for canonical exact-slot options even where its authored rows
  look systematic.
- A role-only exception is allowed by the supplied contract, but it must still match at least
  one concrete proposal and must not overlap another exception.
- Current GUDID confirmation output may supply descriptive commercial-distribution context to a
  proposal; it is not used to accept, reject, or rank the proposal.
- No database migration is needed because enforcement occurs while rebuilding server-side
  inputs before save.

## Protected baseline

Hashes were calculated before this plan was written:

| Protected target                                  | SHA-256                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| Source workbook                                   | `fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf` |
| `catalog-products.json`                           | `1948f00c20f673dfbe2092bde6315c78ca02b8cb5f3f1e308e33c223175861fe` |
| `product-roles.json`                              | `df1f416cecc440ef165ad3f7ee52eff242a429fc816dad6f01ab61cd085fb8c8` |
| `verification-backlog.json`                       | `25ab658850a5df620986d4596d5043f40e46d17132493dd62d7adaffc36c1b38` |
| `hospital-formulary-staging.json`                 | `f8ceb2433694f7ef1d5f65a6e4533fa6c2b1f83659d6ba017abda5fda4908e73` |
| OpenFDA artifact manifest (48 sorted file hashes) | `4cc03adac07ad4f7e2d455559377017af9f2c9048240e3637ced4d46e9add61c` |
| OpenFDA manufacturer aliases                      | `6dff7acd53a5825330bfcc984832a3071c369621a6b80a4b88d42f03d28da902` |
| Server manufacturer aliases                       | `aad9ff0026583744dc77c71f58395dd48167c04a9c358b7549aa67cd80bfeddd` |
| OpenFDA classifier                                | `863c3bf58f2a7e2fd9ca8b616fcf4a25dcc8526bbf5899024970b3c95a69ff7a` |
| OpenFDA query plan                                | `7fe7af1615adc84ed39b2e12db042bdb3e63d61e01cf95ac808e69e6a6d71f84` |

The final report will compare these with post-validation hashes and retain a path-level
OpenFDA manifest rather than relying only on the aggregate.
