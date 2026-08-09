# Phase D1 review packet — route inventory

Phase D1 implementation document (2026-08-08). Companion files: [browser-walkthrough.md](./browser-walkthrough.md), [known-limitations.md](./known-limitations.md), [owner-review-checklist.md](./owner-review-checklist.md).

## New routes (6 pages, 0 API routes, 0 server actions)

All routes are locale-prefixed (`en` / `es` / `zh-CN`), force-dynamic, robots-noindexed per page (`index: false, follow: false, noarchive: true`), stamped `X-Robots-Tag: noindex, nofollow, noarchive` by the proxy through the public-unlisted tier, absent from all site navigation, and gated by `deviceIntelligenceEnabled()` (on outside production; in production requires `NEXT_PUBLIC_ENABLE_DEVICE_INTELLIGENCE === 'true'`, which no deployment sets in Phase D1).

| Route                                            | Purpose                                                                                                                                                              | Data source (all read-only)                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `/[locale]/devices`                              | Atlas index: URL-param search/filter/pagination over the D1 cohort                                                                                                   | `searchCatalog` / `getCatalogFacets` / `getCatalogOverview` evaluated over the cohort-scoped store (`atlas-store.server.ts`) |
| `/[locale]/devices/[productId]`                  | Device detail: identity, identifiers, dimensions, roles, authored procedure use, compatibility statements, sources, related-product discovery lists                  | `getProductDetail` over the cohort store + `compatibility-raw.json` + pinned typed rules                                     |
| `/[locale]/clinical-roles/[roleCode]`            | Role page: verbatim selection guidance, IFU advisory, cohort products by manufacturer, procedure slot usage with authored-option status                              | `getUseDetail` over the cohort store + `getRoleSlotUsage`; legacy aliases 307-redirect via `canonicalRoleCode`               |
| `/[locale]/procedures`                           | Exemplar index (exactly EBUS_TBNA, THERAPEUTIC_BRONCH, CHEST_TUBE)                                                                                                   | `procedures.json` rows + release pointers + derived coverage ladder                                                          |
| `/[locale]/procedures/[procedureCode]`           | Workspace: overview, requirement browser (zone/phase views), coverage ladder, modifier effects, rescue pathways, compatibility conditions, read-only output previews | `getComposedRecipeSlots`, `expandEffectiveSlots`, `buildDemoContext`, `resolveDemoScenario` — the existing engine only       |
| `/[locale]/procedures/[procedureCode]/readiness` | Demo-data-only readiness projection (8 deterministic states)                                                                                                         | Pure projection over one `resolveDemoScenario` result                                                                        |

Not implemented in D1 (per instruction): `/compare`, `/institution/capabilities`.

## Access verification (live, dev server)

- `curl -I /en/devices` → `200`, `x-robots-tag: noindex, nofollow, noarchive`
- `curl -I /en/procedures/EBUS_TBNA/readiness` → `200`, same header
- `/en/devices/PRD-E907C0EB2E` (hidden product) → `404`
- `/en/procedures/BRONCH_ABLATION` (non-exemplar) → `404`
- `/en/clinical-roles/PLEUROSCOPE` (legacy alias) → `307` → `/en/clinical-roles/THORACOSCOPE_SEMIRIGID`

## Preserved routes

All 14 public preference-card pages, 10 admin pages, 6 API routes, and 3 action files are untouched except for two additive cross-links (feature-gated, behavior-preserving):

- `/preference-cards/catalog/product/[productId]` gains a "View in Device Atlas (D1 preview)" link when the product is inside the D1 cohort.
- `/preference-cards/catalog/uses/[roleCode]` gains a "View in Clinical Roles (D1 preview)" link.

No existing route is redirected, removed, or re-gated. Analytics ids for the new areas are `device-intelligence:devices`, `device-intelligence:clinical-roles`, `device-intelligence:procedures` — distinct from `preference-cards`.
