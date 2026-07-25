# IP Preference Card Builder v0.1 — implementation plan

Prepared: 2026-07-25

## Scope and source of truth

This implementation is a thin, end-to-end prototype for deterministic interventional-pulmonology equipment and room-setup preference cards. It is not clinical decision support, an order set, inventory software, or a substitute for current manufacturer IFUs, institutional policy, credentialing, local formulary review, or clinician judgment.

The authoritative supplied source is:

- `Preference_card_module/IP_Procedure_Equipment_Catalog_v0_5_with_GUDID_Verification_Backlog.xlsx`

The workbook inspection confirms Excel row 4 contains headers and row 5 begins data. The expected runtime sheets are present, including 1,221 products, 98 roles, 13 procedures, 174 procedure slots, 2,080 slot-product options, and 179 raw compatibility statements.

`IP_Preference_Card_Builder_MVP_Blueprint.md`, named by the build brief, is not present in the repository. The supplied `AI_Assistant_Build_Instructions_IP_Preference_Card_v0_1.md` is therefore treated as the authoritative product blueprint for this pass.

## Existing architecture

- Next.js 16 App Router with locale-prefixed routes under `src/app/[locale]`.
- Strict TypeScript, React 19, Tailwind CSS, and the existing `src/components/ui` primitives.
- `next-intl` with JSON bundles in `messages/{en,es,zh-CN}.json`.
- Supabase Auth/Postgres/RLS through `src/lib/supabase`; protected routes are authenticated by default.
- Existing permissions use `site_entitlements`; site administrators are represented by `site_admin`.
- Jest is the unit/integration runner, and Playwright is configured for browser tests.
- Feature modules generally live in `src/features/<feature>` with components, content/data, engine/domain code, and tests kept separate.

Unrelated critical-care edits were already present when this branch was created. They will not be modified as part of this feature.

## Files and organization

Planned feature structure:

```text
src/features/preference-cards/
  components/        # dashboard, wizard, card views, warning and print UI
  data/              # server-only generated-catalog loaders and demo bootstrap
  domain/            # pure resolver, schemas, readiness, compatibility, kit logic
  seed/              # reviewed v0.1 golden-scenario operational data
  server/            # access checks, immutable snapshot persistence, mappings
  __tests__/         # domain, import, golden-scenario, and component tests

src/app/[locale]/
  preference-cards/
  admin/preference-cards/

scripts/ip-preference-cards/
data/ip-preference-cards/
  generated/
  seed/

supabase/migrations/
docs/ip-preference-cards/
```

The feature flag will be `NEXT_PUBLIC_ENABLE_PREFERENCE_CARDS`. It is enabled by default outside production and fail-closed in production unless explicitly set to `true`.

## Import strategy

1. Read only the designated workbook sheets with headers on row 4.
2. Treat all identifier columns as text and preserve source IDs exactly.
3. Normalize blanks, booleans, numeric dimensions, dates, selection mode, requiredness, visibility, and coarse verification state.
4. Preserve raw compatibility strings and add exact-match enrichment only; never fuzzy-match them.
5. Validate strict foreign keys, duplicate IDs, JSON fields, modifier/role code collisions, GTIN shape, and visibility conflicts.
6. Write deterministic normalized JSON plus an import report containing counts, warnings, conflicts, unmatched references, and workbook SHA-256.
7. Produce a required coverage report before seed validation.
8. Keep the workbook and generated full catalog server-side; the browser receives only options relevant to the active roles or filtered QA rows.

Planned commands:

```text
npm run ip-cards:import
npm run ip-cards:validate-data
npm run ip-cards:coverage
npm run ip-cards:seed
```

The import is idempotent and does not alter catalog verification or live-visibility fields.

## Domain and resolver strategy

The resolver will be pure TypeScript and will use a stable order:

1. Base recipe slots.
2. Site/location defaults.
3. Ordered modifier actions.
4. Modifier conflict detection.
5. Rescue modules.
6. User overlays.
7. Hospital-local role resolution.
8. Kit/BOM duplicate suppression.
9. Literal quantity evaluation.
10. Room-capability checks.
11. Typed compatibility checks.
12. Per-item resolution.
13. Readiness calculation.
14. Human-readable trace generation.
15. Stable snapshot hashing and persistence.

Unknown compatibility values remain unknown and generate warnings. Required unresolved roles and blocking compatibility failures block readiness. Conditional source text remains verbatim and uses an explicit include/exclude/undecided state. No LLM participates in equipment selection or rule evaluation.

The three implemented scenarios are:

- EBUS-TBNA with ROSE and molecular testing.
- Central airway obstruction / tumor debulking with the reviewed therapeutic modifier set and major-airway-bleeding rescue module.
- Chest tube insertion with mutually exclusive small-/large-bore technique choices, digital drainage, and one kit/BOM suppression example.

## Database and migration strategy

One additive migration will create:

- Imported catalog/provenance tables.
- Organization, membership, site, location, hospital-item, and role-option tables.
- Recipe, modifier, rescue-module, typed-compatibility, and kit tables.
- User overlay, immutable case-card snapshot, item, warning, modifier, and approval-event tables.

RLS will:

- Limit organization/site data to members of that organization.
- Permit authenticated viewers to read their organization’s cards.
- Permit organization builders or the existing `preference_cards_builder`/`site_admin` entitlement to create cards.
- Restrict governance, mappings, typed rules, catalog imports, and waivers to organization admins or site administrators.
- Expose no service-role credential to the browser.
- Reject updates/deletes to generated case-card snapshots and their denormalized items/warnings.

The demo seed is explicitly labeled `Demo IP Program / Demo Hospital / Bronchoscopy Suite 1`. Demo-only stand-ins are enumerated with reasons and cannot contribute to production readiness.

## UI strategy

- Use the existing locale route and UI component conventions.
- Add the required dashboard, four-step builder, generated card, print, formulary, catalog QA, and recipe overview routes.
- Keep English copy in the existing message-bundle structure for v0.1; the same English fallback keys will be present in active locale bundles so parity checks continue to pass.
- Provide keyboard-operable controls, visible focus styles, textual status labels, responsive tables/cards, and print CSS for Letter/A4.
- Display `DRAFT PROTOTYPE — NOT APPROVED FOR CLINICAL USE` on every imported/demo output.
- Render explicit spatial and chronological `Unassigned — needs zone/phase review` groups.

## Verification

- Import and normalization tests, including exact GTIN/catalog-number round trips.
- Pure resolver tests for determinism, conflicts, rescue modules, compatibility unknown/failure states, conditional slots, draft governance, and kit suppression.
- Stable golden-scenario fixtures.
- Focused component/route tests and Playwright smoke checks when local authentication and browser execution are available.
- Repository lint, type check, Jest suite, and production build.

## Assumptions requiring later review

- The build instruction is authoritative because the referenced separate blueprint is absent.
- All imported procedure templates remain draft and have no assigned clinical owner.
- Section-to-zone/phase mappings, modifier actions, typed compatibility rules, local mappings, and demo stand-ins are reviewed seed artifacts—not inferred clinical truth.
- Demo data proves software behavior only. Clinical owners, operational owners, current IFU review, local formulary verification, and institutional approval remain required before any clinical use.
