# IP preference cards — session handoff, updated 2026-07-28

Intended preference-card work branch: `codex/ip-openfda-enrichment-v0-1` at `25a35a05`.
During the final shared-worktree audit, another task switched the checkout to
`critical-care/module-rebuild` and advanced it to `61a7d171`; the uncommitted preference-card
changes were preserved in place rather than risking a branch switch in a dirty checkout.
The proposal-generator command entry in `package.json` had already been captured in the
unrelated `25a35a05` commit; the generator and all other Phase 0.5 files remain uncommitted.
The original v0.2 notes remain below for historical context.

Approved plan: `~/.claude/plans/please-review-the-in-reflective-feather.md`.

## 2026-07-28 Phase 0.5 catalog-role integrity addendum

The safety/semantics work package is implemented in the working tree:

- `getCatalogPick` no longer copies an arbitrary client role. The authoritative server lookup
  distinguishes unknown product, unknown role, and a known product without the requested
  `Product_Roles` mapping. `resolveForSave` uses it for ordinary picks and equipment-set
  members. Family reconstruction remains role-scoped. Valid products and families serving
  multiple roles retain distinct role options, and equipment-set editing uses exact
  product-role member identities.
- The workbook's 2,080 authored `Slot_Product_Options` rows remain canonical and byte-stable.
  The automatic-promotion behavior and artifact were absent and were not adopted; only a
  dormant package command had already landed.
- `derive-slot-option-proposals.ts` produces 475 separate unreviewed proposals, all
  `selectable: false` and `visible_by_default: false`. The checked-in exception file is empty;
  strict Zod validation reports zero exclusions and zero stale exceptions.
- `coverage-metrics.ts` is the single source for scenario and report metrics. All 13
  procedures now expose required catalog-alternative counts separately from required
  curated-default counts.
- Procedure selection, the dashboard, and the admin recipe table use truthful metric names.
  They do not call source-data coverage mapped, ready, complete, or approved.
- Custom items, the role-scoped browser, verification/distribution badges, compatibility
  rules, canonical product identity, and `ResolvedCard.readinessState` are unchanged.
- A checked-in hash guard now enforces the protected workbook, canonical catalog data,
  calibration inputs/report, aliases, classifier/query plan, and the complete 48-file OpenFDA
  artifact set.

The semantic contract is in
[`catalog-role-and-slot-semantics.md`](./catalog-role-and-slot-semantics.md), and the
implementation plan is in
[`phase0-5-catalog-role-integrity-plan.md`](./phase0-5-catalog-role-integrity-plan.md).
The completed command results, file inventory, coverage table, and stop point are in
[`phase0-5-catalog-role-integrity-report.md`](./phase0-5-catalog-role-integrity-report.md).
All protected before/after hashes match; the path-level OpenFDA record is in
[`phase0-5-protected-hash-manifest.md`](./phase0-5-protected-hash-manifest.md).

Current generated counts:

| Measure                          | Count |
| -------------------------------- | ----: |
| Catalog products                 | 1,474 |
| Product-role relationships       | 1,566 |
| Procedures                       |    13 |
| Procedure slots                  |   174 |
| Authored canonical slot options  | 2,080 |
| Unreviewed slot-option proposals |   475 |
| Explicit exclusions              |     0 |
| Stale exceptions                 |     0 |

No OpenFDA/GUDID calibration, proposal acceptance, product verification, visibility,
compatibility, or formulary decision belongs in this phase.

Final validation on 2026-07-28 passed the prescribed import, coverage, scenario, data,
seed, focused Jest, type-check, lint, and production-build sequence. The focused scope had
361 passing tests and one intentionally skipped live-OpenFDA integration test. Lint completed
with zero errors and 18 warnings outside this work package.

## Read this first

**Do not run `supabase db push` against this project.** The local `supabase/migrations/`
directory and the remote history have diverged badly, and a push would try to run **15**
migrations:

- **9 are already applied under different version numbers** — same migration name, different
  timestamp (`add_pccm_intro_course` is local `20260705224434` but remote `20260705235350`,
  and eight more like it).
- **4 are literature migrations** (`20260727032621`, `20260727164510`, `20260727190000`,
  `20260727193432`) that belong to the **separate** Supabase project behind
  `LITERATURE_SUPABASE_URL`, not to this one.
- **2 are access-code rotations** (`rotate_pccm_intro_ucsd_admin_code`,
  `rotate_pccm_intro_ucsd_learner_code`) that have genuinely never been applied here.

A further **20 migrations are applied remotely with no local file at all**, including
`add_procedure_suite_tables`, the `20260426*` learner-approval set, and the
`20260726230945-49` research-memory / Endoreels set. The repo is not a faithful record of this
database.

Apply schema changes **one at a time** through the Supabase MCP connector's `apply_migration`,
which runs exactly the SQL you give it and records it in the remote history. That is how
`20260727224807_add_ip_user_preference_cards` was applied.

**The preference-card migration is applied and verified** (2026-07-27, project
`tqnhxlwvkkswuckszlee`): RLS on, 4 owner-only policies, 10 check constraints, share RPC
`security definer` with `anon` able to neither read the table nor call the function. An
insert/update/delete round-trip with realistic values succeeded, and bad `snapshot_hash`,
bad `status`, and blank `title` were each rejected by their constraint. Saving works.

The never-applied `20260725210000_add_ip_preference_cards.sql` was confirmed absent from the
remote history before applying, and has been `git rm`'d.

## Where it stands

Catalog: **1,474 products / 33 manufacturers / 98 roles / 13 procedures**.
Suite: **2,789 tests passing**, typecheck clean, `npm run build` clean, zero lint warnings in
the module.

Done this session:

- **Family picking in the wizard.** `searchProductFamiliesForRole()` + `getFamilyPick()` in
  `server/catalog.ts`; `domain/family-pick.ts` carries a whole product line as a synthetic
  hospital item. `CatalogOptionPicker` has two views — flat products and product lines with
  their sizes — and opens on the line view for roles where `allowsSizeAtProcedure()` is true.
  Those roles also get **"Add line — size at procedure"**, which records the line and states
  the size is chosen intraoperatively. API: `?group=family` on the catalog-search route.
- **Phase 3 per-user persistence — applied and working.**
  `server/user-cards.ts` — save/list/load/rename/duplicate/delete/share, all under owner-only
  RLS. Share links go through a security-definer RPC granted to `authenticated` only.
  `persist-card.ts`, `load-card.ts`, and `access.ts` are gone, along with the org/site/room
  model they assumed. The dashboard lists real saved cards with row actions; the demo-URL
  fallback and the whole URL-encoded card path are deleted.
- **Custom free-text line items.** `domain/custom-item.ts` + `CustomItemForm`, for the six
  roles with nothing catalogued. Always unverified, never claims a manufacturer.
- **Responsive requirement cards** replacing the `min-w-[1450px]` table.
- **Tracheostomy tubes.** Bivona (93 tubes) plus Portex BLUselect (31), all GUDID-confirmed.
  `TRACH_TUBE_CUFFED` went 15 → 91 products in 17 product lines, `CUFFLESS` → 36, and
  `TRACH_TUBE_EVAC` gained the Portex Suctionaid line. See "Tracheostomy transcription" below
  — the cuff/fenestration data cost real effort to get right.
- **Robotic bronchoscopy platforms.** Monarch (Auris Health / J&J, 16 devices) and Galaxy
  (Noah Medical, 5) join Ion under `GUIDING_DEVICE`, so all three compare side by side.
  GUDID-only evidence — no brochure was supplied, so no dimensions are claimed.
- **Olympus bronchoscopes.** 12 added across EVIS X1, EXERA III, EXERA II and EXERA, and the
  BF-H190 / BF-1TH190 rows corrected. See "Olympus scopes" below — this is the one place the
  in-commercial-distribution rule is deliberately relaxed.
- **Endoscopic ultrasound processors fixed and filled out.** The Olympus EU-ME2 and EU-ME3
  now sit in one **EVIS EUS** product line as the legacy and current generations, and the
  missing FUJIFILM platforms are in. `ULTRASOUND_PROCESSOR` went from 2 products in 2
  disconnected lines to 5 in 3 coherent ones.
- **Print polish.** A `†` on every unverified line with a counted footnote, and custom lines
  marked as written-for-this-card.
- **Open to beta testers by direct link.** `/preference-cards` is now public-unlisted, the same
  gate the critical-care modules use. See "Beta access" below.
- **Two real bugs found and fixed** — see below.

## Beta access

`/preference-cards` and its subroutes are **public-unlisted**: they open without an account
and carry `noindex, nofollow, noarchive`. Listed in `PUBLIC_UNLISTED_EXACT_PATHS` and
`PUBLIC_UNLISTED_PATH_PREFIXES` in `src/lib/site-auth/access.ts`, plus
`unlistedModulePathPrefixes` in `src/lib/draft-modules.ts` so it stays out of navigation.

**What a signed-out beta tester can and cannot do.** Browsing the catalog, building a card,
and previewing the print views all work. **Saving does not** — cards are per-user rows under
RLS, so `saveUserCard` returns "Sign in to save a preference card." and the wizard shows that
error. That is the intended boundary, not a bug.

**`/api/preference-cards/catalog-search` mirrors the module's own gate.** `/api/` bypasses the
proxy, so the route decides for itself — and it now asks `isPublicUnlistedPath('/preference-cards')`
rather than always demanding a session. Without that the wizard's picker 401s for exactly the
beta testers the direct link is for. Re-gating the module automatically re-gates the route;
there is no second policy to keep in sync.

`/admin/preference-cards/*` is unaffected — `/admin` and everything under it still requires the
`site_admin` entitlement, pinned by a test.

## Bugs fixed (worth knowing about)

**The resolver never marked unverified selections as resolved.** In `resolve-card.ts`, the
`verificationState === 'unverified'` branch attached the item and logged an `info` message but
never set `resolutionState`, so it kept its initial value `'unresolved'`. Every unverified
selection — 158 candidate-tier catalog products, every `usStatusPending` product, and every
custom line — showed as an empty requirement in the builder while actually holding a product.
Pinned by a test in `catalog-pick.test.ts`.

**Two plural messages were rendered as bare `t()` calls.** `sets/page.tsx` passed
`t('memberCount')` and `t('roleCount')` — both ICU plurals — down to `EquipmentSetManager`,
which then did `.replace('{count}', …)` by hand. That is the FORMATTING_ERROR trap the last
handoff flagged, in a namespace the guard test did not cover. Fixed by having the client
component translate them itself, the same way `CatalogOptionPicker` does.

## The message guard, now much stronger

`__tests__/catalog-messages.test.ts` was widened from `preferenceCards.catalog.*` to the whole
`preferenceCards` namespace, and it now **runs every message through the real ICU formatter**
(`createTranslator` from use-intl) rather than only pattern-matching the bundles. That is what
caught the two bugs above. It required a jest config change: `next/jest` overwrites
`transformIgnorePatterns`, so `jest.config.cjs` now exports an async function that sets it
after the Next config resolves, allowing the ESM-only `use-intl` and `@formatjs` packages to
be transformed.

**Any new parameterized message must be declared in `parameterizedMessages` there.**

## Pipeline

Run in this order. The whole thing is idempotent — verified this session by hashing the
generated files, re-running all seven commands, and hashing again.

```bash
npm run ip-cards:gudid          # needs the AccessGUDID release; see below
npm run ip-cards:additions
npm run ip-cards:import
npm run ip-cards:coverage
npm run ip-cards:scenarios
npm run ip-cards:gudid-confirm
npm run ip-cards:validate-data
```

The AccessGUDID full release (~5.6 GB) is **not in the repo** and lives at
`Preference_card_module/AccessGUDID_Delimited_Full_Release_20260723`. Only the distilled
`generated/gudid-index.json` is committed (now 15,229 rows). If the release is absent, skip
`ip-cards:gudid` — everything downstream reads the committed index.

### Product overrides

`data/ip-preference-cards/seed/product-overrides.json` + `apply-product-overrides.ts` patch
workbook product rows at import time, before the additions merge. Each entry carries its own
`reason`, must match **exactly one** row, and can declare `expect` values that must still
hold. A match that hits zero or several rows, or an `expect` that no longer holds, **fails
the import** — a stale override is never silently ignored or blindly applied.

This exists because the workbook is a binary xlsx: editing it fixes a symptom without
recording why, and the next workbook refresh drops the fix. Two overrides are in place today,
both on the Olympus ultrasound centres (see below).

### Olympus scopes — the one deliberate exception to the distribution rule

**Olympus was not a discovery company in the GUDID index**, so catalog-number-only matching
kept 49 of its 2,816 records and **not one BF-\* scope**. It is now in
`DISCOVERY_COMPANY_KEYS` (4,219 records; the index went 11,059 → 15,229).

**Olympus files scopes under opaque SKUs** (`N3828922`) or no catalog number at all, with the
recognisable model buried in the version/model string as `OLYMPUS BF TYPE Q180` — note the
release's own typo, `OLYPUS BF TYPE P180`. `OLYMPUS_SCOPES` therefore matches on that model
string while `catalog_number` carries the `BF-…` a clinician says.

**This list intentionally includes models GUDID reports as no longer in commercial
distribution** — BF-P180, BF-Q180-AC, BF-1T180, BF-XT160, BF-PE2. A preference card records
what is in the room, not what is orderable. They are **badged, never hidden**: the badge works
because `buildProductRecord` puts the GUDID model on `global_part_number`, and `gudid-confirm`
joins on `[catalog_number, global_part_number]`. Break that and the badge silently stops
appearing, so a card would list a discontinued scope with nothing saying so. Pinned by
`__tests__/olympus-bronchoscopes.test.ts`. `live_dropdown_status` also reflects the real
status rather than hardcoding "in commercial distribution".

**Spec provenance is recorded per scope.** The 190/X1 models come from Olympus America product
pages; the 160/180 models are parsed from the FDA device description itself
(`BF-P180 VIDEOSCOPE 4.9MM DIA 2.0MM CH`). Channel sizes were cross-checked against the
Olympus Bronchoscope Compatibility Chart. BF-PE2 has an FDA record but no available spec
sheet, so it carries **no dimensions** — a test enforces that.

**Watch the self-referential dedup trap.** The Olympus loop skips scopes the workbook already
carries, read from `catalog-products.json` — which is the _merged_ output and so already
contains this script's own previous additions. Keying the skip on catalog number alone dropped
every scope on the second run and re-added it on the third. It now compares the existing
`product_id` against the one it would generate, so a row this script wrote is recognised as its
own. Any future "already present?" check against generated output needs the same care.

**`product_kind` must match the workbook's term** — bronchoscopes are `Reusable endoscope`
there, and `familyKey` splits on it, so a scope filed as `Reusable instrument` breaks its
series into two identical-looking rows.

### Robotic platforms — GUDID-only evidence

Monarch and Galaxy came in from AccessGUDID exports with **no manufacturer catalog**, so the
entries claim identity, model number, and distribution status and nothing else — `sizeDisplay`,
channel, and working length are all null, and a test enforces that. If a brochure turns up
later, enrich them; do not infer dimensions.

`ROBOTIC_DEVICES` in `build-catalog-additions.ts` is an explicit allowlist because the two
labelers carry much more than bronchoscopy. Deliberately excluded, and a test pins each:

- **Auris `MUR-*`** — ureteroscopy, PCNL, stone baskets. Same labeler, different specialty.
- **`Version *`** records — Monarch tower software releases, not devices.
- **`-RFB` / `MON000005R` / `GALRB*`** — refurbished and Hong Kong variants. Procurement
  options, not card lines.
- **`MON-000005-01`** — a tower upgrade SKU.
- **Monarch fluidics tubing (`MBR-000018`, `MBR-000218`) and the bronchoscope / sheath valves
  (`MBR-000019`, `MBR-000020`)** — no role exists to reach them, same blocker as the FUJIFILM
  accessories.

Roles follow the Ion and superDimension/ILLUMISITE precedent: platform, scope, patches, and
introducer kits are `GUIDING_DEVICE`; needle, forceps, and brush take `TBNA_NEEDLE`,
`BIOPSY_FORCEPS_FLEX`, `CYTOLOGY_BRUSH`.

**`familyKey` splits on `product_kind`**, so one `brand_family` across capital equipment,
single-use, and reprocessed items renders as several identical-looking rows. Monarch and
Galaxy therefore use functional family names — `Monarch Platform`, `Monarch Bronchoscope`,
`Monarch Bronchoscope (Reprocessed)`, `Monarch Procedure Accessories`, `Galaxy Platform`, and
so on — each self-describing. A test asserts they stay distinct.

### Tracheostomy transcription — read before touching either seed

Both trach-tube PDFs have text layers that lie, in different ways. Cuff status, fenestration,
and subglottic suction are stated **only in a table title**, and getting one wrong puts the
wrong tube on a card. `__tests__/tracheostomy-tubes.test.ts` pins all of it.

**Bivona (`seed/bivona-catalog.json`, 93 tubes).** Each page has product photos in the left
margin with the product code as a caption. `pdftotext` interleaves those captions into the
table, and a caption that lands _inline_ with a data row shifts every column: the original
transcription read `855180 855170 7.0 7.0 10.0 80.0` as product `855180`, size `855170`,
I.D. 7, O.D. 7, length 10. Any parser must take **the last code token before the numeric
run**, not the first. A full re-diff against the PDF found exactly one such corruption
(855180) and one row lost outright (855170) — the other 76 were sound.

The seed covers the **adult** catalogue. The PDF has 195 ordering rows; the 102 not seeded
are paediatric and neonatal, deliberately left out because this is an adult IP tool. Product
codes run 5–9 characters (`60A150` through `60AFHXL90`), so a `\d{2}[A-Z0-9]{3,6}` pattern
silently drops the `60AFHXL*` family — use `\d{2}[A-Z0-9]{3,10}`.

**Portex BLUselect (`seed/portex-bluselect-catalog.json`, 31 tubes).** A web-page print from
icumed.com. The ordering rows extract cleanly but **the table titles do not appear in the
text layer at all** — they were read off the page images. Mapping, by code prefix:

| Prefix    | Line                            | Cuff     | Fenestrated | Role                  |
| --------- | ------------------------------- | -------- | ----------- | --------------------- |
| `101/815` | Cuffed                          | cuffed   | no          | `TRACH_TUBE_CUFFED`   |
| `101/816` | Uncuffed w/ Disconnection Wedge | cuffless | no          | `TRACH_TUBE_CUFFLESS` |
| `101/817` | Cuffed Fenestrated              | cuffed   | **yes**     | `TRACH_TUBE_CUFFED`   |
| `101/818` | Uncuffed Fenestrated            | cuffless | **yes**     | `TRACH_TUBE_CUFFLESS` |
| `101/875` | Suctionaid                      | cuffed   | no          | `TRACH_TUBE_EVAC`     |

Suctionaid is subglottic-suction, so it belongs in `TRACH_TUBE_EVAC` next to the Shiley Evac
tubes, **not** in the plain cuffed bucket. Inner cannulas (`101/851`, `101/856`, `101/858`,
18 codes) are excluded: no role exists for them, so they would be unreachable products.

Portex is already a whole-brand entry in the GUDID index, so no allowlist is needed — all 49
BLUselect codes joined to in-distribution device records.

### Targeted brand allowlists

`build-gudid-index.ts` now has a third keep-rule alongside whole-company and whole-brand:
`TARGETED_BRAND_PATTERNS` keeps a brand only for catalog numbers listed in a seed file. Bivona
uses it — the brand alone lists ~53,000 devices, so keeping all of it is not an option, but
the 77 transcribed product codes matched 1:1 and all report In Commercial Distribution. Use
the same mechanism for any other broad brand.

## Remaining work, highest value first

### 1. Bivona paediatric / neonatal tubes (optional)

The seed covers the adult catalogue only. 102 paediatric and neonatal rows are in the PDF and
were deliberately left out — this is an adult IP tool. If they are ever wanted, the extraction
recipe is in "Tracheostomy transcription" above; mind the 9-character product codes.

### 2. Draft autosave

The wizard saves only on Generate. `saveUserCard` already does insert-or-update by id, so
autosave is: keep the returned `cardId`, then debounce subsequent builder-state changes into
`saveUserCardAction` with that id.

### 3. Equipment sets into Postgres

Still in `localStorage` under `ip-preference-cards:equipment-sets:v1`. The stored shape is
versioned for this. It needs its own migration — the one written this session deliberately
contains only tables that have code behind them.

### 4. Lower priority

- **Ion and Medtronic still render as duplicate product lines** in `GUIDING_DEVICE` — "Ion
  Endoluminal System" appears three times and "ILLUMISITE / superDimension" twice, for the
  same `product_kind` reason Monarch and Galaxy were named around. Fixing Ion is ~5 product
  overrides; Medtronic is a judgement call, because `ILLUMISITE / superDimension` lumps two
  distinct platforms under one brand family and splitting them changes what a user searches
  for. Left alone deliberately.
- **Portex inner cannulas** (`101/851`, `101/856`, `101/858`, 18 codes) are transcribable from
  the same BLUselect page and all match GUDID, but there is no inner-cannula role. Same
  blocker as the FUJIFILM accessories below — define the role, then emit them.
- **FUJIFILM accessories not yet catalogued.** The pulmonology catalog and GUDID both cover
  valves (FV-001/FV-002/FV-003, SB-601/602/604/605/606), balloons (B20BU, B20UR, B20UT,
  BS-102), the PB-30 balloon pump, cleaning adapters (the CA-5xx/CA-6xx family), air/water
  buttons (AW-6xx), CP-1/CP-1TB and UC-01. All are in commercial distribution. They are not
  in yet because **no role exists for endoscope valves, buttons, or cleaning adapters** —
  adding them would create products no requirement can reach. Add the roles first.
- Other FUJIFILM boxes in GUDID but absent from the two supplied brochures: **EP-8000**,
  **BL-7000X**, **VP-4440HD**. Identity is confirmable, specs are not; they need a document.
- ERBE PDFs (FiAPC, ERBECRYO 2, connecting cables) to enrich `APC_PROBE_FLEX` (11 products),
  `CRYOPROBE_FLEX` (4), `ENERGY_CABLE_ADAPTER` (69) with specs. Populated but spec-thin.
- Work the confirmation queue: 701 GTIN backfills and 348 hidden-but-distributed products in
  `generated/gudid-confirmations.json`. Proposals only — the queue never mutates products,
  per SRC046's use policy.
- No dashboard/nav card was added. The sibling literature module has no nav or homepage entry
  either, and there is no module registry to add one to, so inventing a placement here would
  have been inconsistent. `/preference-cards` **is** registered in `src/lib/draft-modules.ts`.

## Gotchas that cost time

**`next/jest` overwrites `transformIgnorePatterns`.** Setting it in the object passed to
`createJestConfig` silently does nothing; it has to be applied to the resolved config.

**Server components cannot pass functions to client components** — and passing a
_pre-formatted plural string_ is the subtler version of the same mistake. If a label depends
on a count, the client component must call `useTranslations` itself.

**The dev server on port 3001 may belong to a different worktree.** Check
`ps -o command -p <pid>` shows this directory.

Auth-gated routes: `GET /api/local-dev-auth?token=$LOCAL_DEV_AUTH_TOKEN&next=...` (token in
`.env.local`), then `curl -b "ip_local_dev_auth=$TOKEN"`. The in-app browser did not retain
the cookie reliably; curl plus HTML extraction was the dependable check.

**`src/proxy.ts` short-circuits before the Supabase gate for `/api/`**, so route handlers
authenticate themselves — see `src/app/api/preference-cards/catalog-search/route.ts`.

**Modifiers rewrite slot roles.** `DIGITAL_DRAINAGE` turns `GENERIC_DRAINAGE_UNIT` into
`DIGITAL_DRAINAGE_SYSTEM`, so the picker must use the _resolved item's_ `roleCode`, not the
base recipe role. Pinned by a test in `catalog-pick.test.ts`.

**Manufacturer ids must resolve against the workbook.** A generated id for a vendor the
workbook already has splits it into two groups in the explorer;
`build-catalog-additions.ts` looks up `generated/manufacturers.json` by name first.

**Golden fixture hashes churn** whenever the snapshot payload changes — regenerate
`__fixtures__/golden-scenario-expectations.ts` in the same commit as the causing change.

**Only products GUDID reports in commercial distribution get added.** That rule excludes
FUJIFILM's **EB-530XT** and the **FB-120MP/S/T** fiberoptic bronchoscopes, which appear in the
pulmonology catalog but have no FDA UDI record. Pinned by a test.

**A device being in distribution does not make it an IP device.** The FUJIFILM **ARIETTA 850
FF ENDO** is in commercial distribution but its applicable-endoscope table lists only the
EG-series gastroscopes — it does not drive the EB-530US bronchoscope, so it is deliberately
not an `ULTRASOUND_PROCESSOR` here. The ARIETTA 750 is, because its table does include the
EB-530US. Check the compatibility table, not just the UDI record. Pinned by a test.

**GUDID sometimes records a configuration model, not the ordering number.** The SU-1 is
listed as `SU-1 FV652A` / `SU-1 FV667A`. `buildProductRecord` takes a `catalogNumber`
override so the card shows `SU-1`, with the GUDID model kept on `global_part_number` and the
sibling configuration on `alternate_ids`. Lookups collapse whitespace — `SU-1 PLATINUM
FV651A` has a double space in the release.

**Cuff status comes from the family name, not the word "cuffed."** Fome-Cuf, Aire-Cuf, and TTS
are all cuffed lines whose names do not say so. The Bivona importer keys off the parsed
`cuffType`, which was derived from the family name for exactly this reason.

**Item-id namespaces are all distinct and must stay that way**: `catalog:` (product),
`family:` (product line), `set:` (equipment set), `custom:` (free text). Each has an
`is…ItemId` guard and a test asserting it does not match the others.

**The es/zh-CN bundles carry English strings for the entire `preferenceCards` namespace.**
`src/i18n/translations.test.ts` only enforces key parity, so this passes. New keys were added
in English to all three locales to match the existing convention; real translation is a
separate pass for the whole namespace.

## Verification

```bash
npm run type-check && npm run lint && npm test && npm run build
```

```bash
npx jest src/features/preference-cards src/i18n/translations.test.ts
```

Idempotence check after touching the pipeline: hash the generated files, re-run the seven
commands, hash again — they must match. `git status` alone is misleading because it compares
against the last commit, not the previous run.

Browser walkthrough (logged in, correct dev server):
`/en/preference-cards` (saved-card list, row actions), `/catalog?q=silicone%20stent`,
`/catalog/uses/AIRWAY_STENT_SILICONE_STRAIGHT` (4 family rows, 105 on `?view=all`),
`/catalog/uses/TRACH_TUBE_CUFFED` (13 Bivona lines + Shiley),
`/preference-cards/sets`, `/preference-cards/new?scenario=rigid-bronch` — open the stent
requirement's picker and confirm it lands on the product-line view with the size-at-procedure
button; save the card and confirm it appears on the dashboard and at its UUID URL.
