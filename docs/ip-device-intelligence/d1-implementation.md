# Phase D1 implementation — read-only Device and Procedure Intelligence vertical slice

Phase D1 implementation document (2026-08-08), built under the bounded scope of decision D-10 as recorded in [decision-log.md](./decision-log.md) and specified in [vertical-slice-spec.md](./vertical-slice-spec.md). Validation results are in [d1-validation.md](./d1-validation.md); the review packet is under [d1-review/](./d1-review/).

## 1. What was built

A strictly read-only presentation layer over the governed preference-card graph:

- **Device Atlas** — `/[locale]/devices` (index) and `/[locale]/devices/[productId]` (detail), restricted to the owner's cohort: `verification_grade = verified_source` AND `visibility_state = prototype_visible` (753 products).
- **Clinical roles** — `/[locale]/clinical-roles/[roleCode]`, with permanent-alias 307 redirects to canonical codes.
- **Procedure workspaces** — `/[locale]/procedures` (exactly the three D-05 exemplars) and `/[locale]/procedures/[procedureCode]` (overview, requirement browser by setup zone / procedural phase, coverage ladder, modifier effects, rescue pathways, compatibility conditions, read-only output previews).
- **Demo readiness** — `/[locale]/procedures/[procedureCode]/readiness`, a deterministic eight-state projection over the fictional demo context, watermarked `DEMO DATA — NOT AN ACTUAL INSTITUTION` on every render.

`/compare` and `/institution/capabilities` were not implemented (deferred by instruction and D-09).

## 2. Architecture and reuse boundary

New feature area `src/features/device-intelligence/`:

```text
feature.ts                 deviceIntelligenceEnabled() gate (own env flag; unset in production)
domain/atlas-cohort.ts     the D-07 cohort predicate + product-id guard (pure)
domain/exemplars.ts        the D-05 exemplar codes (pure)
domain/coverage-ladder.ts  the D0 audit's role-coverage ladder, recomputed from data (pure)
domain/readiness.ts        the eight-state demo readiness projection (pure)
server/atlas-store.server.ts   cohort-scoped CatalogStore via the EXISTING buildCatalogStore
server/atlas.server.ts         atlas queries = existing catalog.ts functions + cohort store
server/compatibility.server.ts raw statements (audit matching rule) + typed rules as conditions
server/procedures.server.ts    workspace/index/readiness view-models over the existing engine
server/outputs.server.ts       outputs 2–5 as projections of ONE resolved demo card
components/                    evidence badges, watermarks, link-tabs, browser, outputs panel
__tests__/                     9 suites / 76 tests
```

**Exact data sources.** Everything reads the statically imported generated JSON already consumed by the preference-card server layer (`data/ip-preference-cards/generated/**`), the reviewed overlay, the seed (`operational.ts` modifiers/rescue/typed rules, `demo-stand-ins.json`), and the release pointers — through the existing modules: `catalog.ts`/`catalog-store.ts`, `demo-context.server.ts` (`buildDemoContext`, `getComposedRecipeSlots`, `resolveDemoScenario`), `release-bundles.server.ts` (`getCurrentReleaseBundle`), `effective-slots.ts` (`expandEffectiveSlots`), `expand-recipe-composition.ts`, and `role-taxonomy.ts`.

**What was deliberately not duplicated.** No second search implementation (the atlas passes a cohort store to the existing query functions — every one of which already takes a store parameter), no second slot expansion, no second card resolution, no second compatibility evaluator (atlas pages render typed rules as _conditions_; the only evaluations shown come from the existing resolver's output), no second product-family implementation (`familyKey` remains display-only discovery).

**Two surgical changes to existing code.**

1. `catalog.ts`: the module-level single-slot Fuse cache became a `WeakMap` keyed by store — the singleton would otherwise have answered one store's fuzzy search with another store's products once a second store instance existed. Behavior for the existing store is unchanged (asserted by the full existing suite).
2. Two preserved pages gained additive, feature-gated cross-links into the new area (product page → device page when cohort-visible; use page → role page).

Access wiring: `/devices`, `/clinical-roles`, `/procedures` joined `PUBLIC_UNLISTED_EXACT_PATHS` + `PUBLIC_UNLISTED_PATH_PREFIXES` (noindex header tier), `unlistedModulePathPrefixes` (hidden from navigation), `nonPublicModules` (admin index, computed access mode), and `resolveSiteModuleId` (distinct analytics ids `device-intelligence:*`).

## 3. Evidence and safety presentation

- Reusable `EvidenceBadge` renders ten distinct states (verified-source fact, candidate fact, unknown, authored selectable, authored non-selectable, unreviewed proposal, demo stand-in, draft procedure, unresolved statement, historical context) as text-carrying badges; independent axes are never collapsed, and the existing `VerificationBadge` continues to carry the six catalog axes on device pages.
- The atlas excludes candidate and hidden products at store construction, so no query, facet, related list, or direct URL can reach them; authenticated/admin surfaces are untouched.
- Proposals surface only as counts with the disclaimer, never as options, coverage, or readiness.
- Related-product lists carry the two mandatory headings verbatim and discovery captions; a copy-safety test allowlists the only keys permitted to mention equivalence/substitution (the disclaimers that deny them) and requires the negation.
- The readiness projection enforces: candidate/unknown grades never produce plain `ready`; demo stand-ins always force a limitation; proposals never count as coverage; a missing attribute resolves `unknown`; every diagnostic carries its source identifier (slot id, rule id, hospital item id, capability, formulary row).

## 4. Demo-only limitations and honest gaps

See [d1-review/known-limitations.md](./d1-review/known-limitations.md) for the complete list — chiefly: the deliberately-failing APC rule lives in a test fixture (so the blocking failure is proven by fixture injection through the existing resolver, not by the live context); readiness states 5/6/8 are fixture-demonstrable exactly as the D0 spec records; `responsibleRole` is unauthored; es/zh-CN strings are English copies per repository convention.

## 5. Deferred (unchanged from D-09/D-10)

Compare view; institutional capability as a real product; formulary/procurement intelligence; shortage/substitution navigation; change-impact dashboard; standalone training academy; governance-workbench rebuild; public indexing (owner launch decision); route consolidation between the two coexisting families.

## 6. Owner-review steps

[d1-review/owner-review-checklist.md](./d1-review/owner-review-checklist.md). The owner's
walkthrough findings are in
[d1-review/owner-review-findings.md](./d1-review/owner-review-findings.md); every finding's
classification, fix, regression test, or deferral is recorded in
[d1-review/owner-review-dispositions.md](./d1-review/owner-review-dispositions.md), including
the governed-data review queue that this branch deliberately does not touch.
