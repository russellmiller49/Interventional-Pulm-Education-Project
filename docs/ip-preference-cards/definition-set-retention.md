# Definition-set retention

The fourth retention ledger: the frozen record of every whole definition set a published
release pins. Recipes have `composition-ledger.json`, module versions have
`module-ledger.json`, catalog releases have `catalog-rows.json` +
`catalog-release-manifests.json`. Until this pass, the four whole-set pins on every release
bundle — `definition-set-modifiers`, `definition-set-rescue-modules`,
`definition-set-compatibility-rules`, `definition-set-role-taxonomy` — had **no retained
copy at all**: the pin was a hash over live module-scope constants, and
`getReleaseDefinitionSources` handed those live constants to every bundle regardless of what
the bundle pinned. The pin could veto (any live edit made every published release refuse to
reconstruct) but never supply. That is the F-09 blocker recorded in
`docs/ip-device-intelligence/d1-data-corrections/f09-blocker.md`, reproduced from scratch in
§2 below.

This document records, in order: the complete consumer inventory of the four sets (§1), the
independent reproduction of the blocker (§2), the ledger design and its guarantees (§3), and
the lifecycle — how content enters the ledger, how it is resolved, and how it fails (§4).

## 1. Consumer inventory

Every direct import or module-level access of the four live definition sets, as of the base
commit of this branch (`e833b97f`). "Set consumed" abbreviations: **M** = modifiers (the
merged set: `operationalModifiers` from `seed/operational.ts` over
`generated/modifier-definitions.json`), **R** = rescue modules, **C** = typed compatibility
rules, **T** = role taxonomy (`ROLE_CATEGORIES`, `LEGACY_ROLE_CATEGORY_MAP`,
`ROLE_CATEGORY_OVERRIDES`, `ROLE_CODE_ALIASES` and the helpers over them). Categories:
**(a)** release-pinned runtime, **(b)** current unpinned surface, **(c)** canonical
authoring/generation, **(d)** test/fixture.

| Consumer                              | File / function                                                                                                                                                                             | Sets                                       | Current source                                                 | Bundle pin available?                                               | Historical-safe before this pass?                                                            | Correction                                                                                                                                                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Context assembly hub                  | `data/demo-context.server.ts` — `allModifierDefinitions` (merge), `buildContextForRecipe`, `getReleaseDefinitionSources`                                                                    | M R C T                                    | Live constants + generated JSON at module load                 | Yes on the release chain (pins verified upstream), no on demo paths | Fail-closed only: live edit ⇒ every pinned card refuses to open                              | **(a)** paths now resolve each set by the bundle's pin (live when the hash matches, ledger entry otherwise); demo paths stay live by design                                                                                                                              |
| Release runtime                       | `data/release-bundles.server.ts` — `loadSources`, `buildReleaseContext`, `validateRetainedReleases`                                                                                         | M R C T                                    | Live, hash-verified against pins                               | Yes — this is the enforcement point                                 | Fail-closed, not retained                                                                    | `loadSources` passes the bundle's four set pins; `buildReleaseContext` builds the context from the resolved (possibly retained) sets, not the live globals                                                                                                               |
| Release generator                     | `scripts/ip-preference-cards/build-release-bundles.ts`                                                                                                                                      | M R C T                                    | Live (its job)                                                 | Creates the pins                                                    | The enforcement mechanism                                                                    | Frozen releases resolve their recorded pins (from the retained generated bundles); ledger generation appended; ledger validation gates writes                                                                                                                            |
| Card create/save                      | `server/user-cards.ts` → `rebuild-builder-context.ts` → `buildReleaseContext`                                                                                                               | M R C (T via aliases)                      | Live, pin-verified                                             | Yes                                                                 | Fail-closed                                                                                  | Inherits pinned resolution through `buildReleaseContext`                                                                                                                                                                                                                 |
| Card view/print/share                 | `server/user-cards.ts` (`loadUserCard`, `loadSharedCard`)                                                                                                                                   | none                                       | Stored snapshot only                                           | n/a                                                                 | Safe (snapshot)                                                                              | None needed                                                                                                                                                                                                                                                              |
| Exact edit / reopen                   | `[cardId]/edit` → `rebuildBuilderContext` → `buildReleaseContext` (card's own pin)                                                                                                          | M R C T                                    | Live, pin-verified                                             | Yes                                                                 | Fail-closed                                                                                  | Inherits pinned resolution                                                                                                                                                                                                                                               |
| Duplication                           | `duplicateUserCard`                                                                                                                                                                         | none                                       | Row copy                                                       | n/a                                                                 | Safe                                                                                         | None needed                                                                                                                                                                                                                                                              |
| Reconciliation                        | `server/reconcile-card.ts` (operational half via `resolveForSave`; release half via `resolveReleaseDefinitions` on both sides)                                                              | M R C T                                    | Live, pin-verified both sides                                  | Yes                                                                 | Fail-closed — and cross-release comparison became **unavailable** exactly when a set changed | Both sides now resolve their own pinned sets, so the comparison works across set changes                                                                                                                                                                                 |
| Reviewed rebuild                      | `server/rebuild-card.ts`, `rebuild-builder-context.ts`, `domain/card-rebuild-plan.ts`                                                                                                       | M R C T                                    | Live, pin-verified both sides                                  | Yes                                                                 | Fail-closed, same unavailability                                                             | Source and target releases each resolve their own pinned sets                                                                                                                                                                                                            |
| D1 workspace/readiness/outputs        | `device-intelligence/server/procedures.server.ts`, `outputs.server.ts` (via `buildDemoContext` / `resolveDemoScenario`)                                                                     | M R C                                      | Live demo context; current bundle fetched for **display** only | Available-but-unused                                                | Current-by-design; coherent with pinned cards only because CI froze live == pinned           | Documented current-by-design surface. Coherence invariant now proven by test: for every procedure, the demo resolution equals the current-pointer release resolution                                                                                                     |
| D1 atlas compatibility conditions     | `device-intelligence/server/compatibility.server.ts` — `typedCompatibilityRules` import                                                                                                     | C                                          | Live constant                                                  | No                                                                  | Current-by-design                                                                            | Documented current-by-design surface (atlas is a current view, not a card reconstruction)                                                                                                                                                                                |
| Role alias routing                    | `[locale]/clinical-roles/[roleCode]`, `preference-cards/catalog/uses/[roleCode]`, `server/catalog.ts`                                                                                       | T                                          | Live tables                                                    | No                                                                  | Current-by-design (permanent-alias policy)                                                   | Documented current-by-design surface                                                                                                                                                                                                                                     |
| Alias use inside pinned paths         | `historical-catalog.server.ts`, `domain/card-rebuild-plan.ts`, `domain/equipment-set.ts`, `domain/product-family.ts`, `rebuild-builder-context.ts`, `rebuild-card.ts` — `canonicalRoleCode` | T                                          | Live alias table, guarded upstream by `roleTaxonomyPin`        | Yes (upstream)                                                      | Fail-closed while live == pin                                                                | Retained taxonomy is now resolved per pin for hash validation; alias **application** deliberately stays on the live table under the permanent-alias contract, guarded by the compatibility check in §3.6 (a live table that contradicts a retained one fails resolution) |
| New-card wizard preview               | `preference-cards/new/page.tsx` (`buildDemoContext`)                                                                                                                                        | M R C                                      | Live                                                           | Release id stamped separately                                       | Current-by-design (authoring)                                                                | Coherence invariant proven by the same demo-equals-current-release test                                                                                                                                                                                                  |
| Dashboard / admin recipes / formulary | `preference-cards/page.tsx`, `admin/preference-cards/*`                                                                                                                                     | M R C                                      | Live via demo context                                          | No                                                                  | Current-by-design                                                                            | Documented current-by-design surfaces                                                                                                                                                                                                                                    |
| Composition generator                 | `scripts/ip-preference-cards/build-recipe-compositions.ts`                                                                                                                                  | M R                                        | Live seed at build time                                        | n/a                                                                 | n/a                                                                                          | None — canonical authoring input                                                                                                                                                                                                                                         |
| Seed/scenario/taxonomy tooling        | `validate-seed.ts`, `generate-scenarios.ts`, `apply-role-taxonomy.ts`, `import-catalog.ts`, `validate-data.ts`                                                                              | M T                                        | Live (canonical application point)                             | n/a                                                                 | n/a                                                                                          | None — canonical authoring/validation                                                                                                                                                                                                                                    |
| D0 audit                              | `scripts/ip-device-intelligence/audit-data-readiness.ts`                                                                                                                                    | M (fs read of `modifier-definitions.json`) | Generated JSON on disk                                         | No                                                                  | Point-in-time audit                                                                          | None — audit is a current snapshot by definition                                                                                                                                                                                                                         |
| Tests binding live content            | `scenarios.test.ts`, `role-taxonomy.test.ts`, `mechanisms.test.ts`, `readiness.test.ts`, etc.                                                                                               | M R C T                                    | Live                                                           | n/a                                                                 | n/a                                                                                          | Category (d); new suites added for retained resolution                                                                                                                                                                                                                   |

Two structural facts the table depends on:

- The only merge point of the modifier set is `allModifierDefinitions` in
  `demo-context.server.ts`; `domain/index.ts` re-exports neither `seed/operational` nor
  `role-taxonomy`, so there is no barrel indirection to chase.
- The release pin was, before this pass, a **validator only**: `pinDiff` hashed the live sets
  against the pins and refused on mismatch, then `buildContextForRecipe` read the same live
  singletons. No path could resolve a pinned card against silently-wrong content — but no
  path could resolve an old pin at all once live moved.

## 2. Reproduction of the F-09 blocker

Performed on a clean tree at `e833b97f` with a temporary, mechanically reversed edit —
`OPS-APC-RIGID` in `seed/operational.ts` changed from `'required'` / no dependency rule to
`'conditional'` / `'Rigid system in use'` (the owner-authorized target). Every number below
was observed, not carried over from the earlier report.

1. **The live modifier-set hash moves and nothing else does.**
   `definition-set-modifiers`: `e333509636d4564b…` → `a9758b0b0ace11f1…`. Rescue-module,
   compatibility-rule, and role-taxonomy hashes unchanged.
2. **The release generator fails closed.** `npm run ip-cards:releases` reports
   **`release_definition_mutated` × 23** — every published release, because all 23 pin the
   single historical modifier-set hash — and writes nothing.
3. **The committed bundles fail at test/runtime.**
   `release-bundle-integrity.test.ts`: 4 tests fail;
   `validateRetainedReleases` emits blocking **`release_pin_hash_mismatch` × 23**, each with
   `changedPins: ["definition-set-modifiers"]`.
4. **Every saved card goes view-only.** Resolving all 23 retained releases through
   `resolveReleaseDefinitions`: 0 resolvable, **`release_definition_mutated` × 23**.
   `buildReleaseContext('release-therapeutic-bronch-v1-1')` returns the typed failure with
   `changedPins: ["definition-set-modifiers"]` — the edit/reopen/reconcile/rebuild surfaces
   all degrade to the snapshot-only fallback.
5. **The only local escape is the consistent rewrite, and the baseline rejects it.**
   Re-freezing all 23 seed `definitionHash` values to the recomputed ones lets the generator
   run clean — and `npm run ip-cards:release:check-base` then reports **32 violations**:
   **`publication_definition_mutated` × 16** and **`publication_dependencies_replaced` × 16**
   (each naming the modifier-set pin move `e3335096… → a9758b0b…`) for the sixteen releases
   published in the protected base. The seven v1-1 releases still in their pre-publication
   window on this branch are reported as additions, not violations.

After the experiment the tree was restored byte-exactly (`git status --short` empty; live
modifier-set hash re-verified at `e3335096…`).

## 3. The ledger

`data/ip-preference-cards/generated/definition-set-ledger.json`, built by
`npm run ip-cards:releases`, validated by `validateDefinitionSetLedger`
(`src/features/preference-cards/domain/definition-set-ledger.ts`), protected by
`npm run ip-cards:release:check-base` as the next protected artifact.

### 3.1 Content addressing

An entry is addressed by `(definitionSetId, definitionHash)` — one of the four stable set
ids plus the exact content hash the release pins. The **pin selects the entry**; nothing
selects by array order, recency, or "latest". Two releases pinning two different
modifier-set hashes resolve two different entries in the same process, at the same time,
in any call order: resolution is a pure lookup over immutable module-level maps, keyed by
the pinned hash, with no module-global "selected set" and no cache keyed by anything other
than the pin.

### 3.2 Verbatim retention

The entry stores the canonical complete set content — the exact `ModifierDefinition[]`,
`RescueModule[]`, `TypedCompatibilityRule[]`, or `RoleTaxonomySnapshot` the release build
hashed into the pin. `definitionSetContentHash(entry)` reproduces the pinned hash from the
stored content alone; the foundation test proves each initial entry is content-identical to
the live source it was captured from (same `stableStringify`, same hash), and the generator
test proves a second run is byte-identical.

### 3.3 Append-only

`withPublishedDefinitionSets` returns an existing entry untouched even when the live set now
says something different — it can never be the thing that rewrites history. New (id, hash)
pairs are appended; entries are sorted by (id, hash) so regeneration is order-stable.
Deletion or mutation of a retained entry is rejected twice: by
`validateDefinitionSetLedger` in the same tree (hash integrity), and by
`check-publication-baseline` against the protected base (a mutated entry changes its
content-addressed key, which reads as a removal — `publication_entry_removed` — and the
recorded hash comparison also fires `publication_definition_mutated`).

### 3.4 Failure modes (all fail closed)

| Condition                                                               | Where it fails                                           | Code                                                           |
| ----------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| Entry content no longer matches its recorded hash                       | build + integrity suite                                  | `definition_set_ledger_entry_mutated`                          |
| Two entries claim one (id, hash) key                                    | build + integrity suite                                  | `definition_set_ledger_duplicate_entry`                        |
| Entry carries an unknown set id                                         | build + integrity suite                                  | `definition_set_ledger_unknown_set`                            |
| A published pin present in neither the matching live set nor the ledger | build + integrity suite + runtime resolution             | `definition_set_ledger_entry_missing` / `release_pin_missing`  |
| Retained taxonomy contradicted by the live table (§3.6)                 | runtime resolution                                       | `release_pin_missing` (typed, card goes view-only)             |
| Tampered ledger content reaching runtime                                | `pinDiff` re-hashes the resolved content against the pin | `release_definition_mutated`                                   |
| Retained entry removed/mutated relative to the protected base           | `check-publication-baseline`                             | `publication_entry_removed` / `publication_definition_mutated` |

There is no fallback from a missing pinned set to the current live set, and no "latest"
selection anywhere.

### 3.5 Historical/runtime parity

`getReleaseDefinitionSources` resolves each of the four sets **once**, by the bundle's pin,
and that single `ReleaseDefinitionSources` object is both what `pinDiff` validates and what
`buildContextForRecipe` builds the reconstruction context from. The validator and the
runtime cannot disagree about which content a bundle means, because they read the same
resolved object.

### 3.6 Role taxonomy: retained for validation, live for alias application — deliberately

The role taxonomy is retained and resolved by pin exactly like the other three sets, and the
retained snapshot is what release hash validation runs against. Alias **application**
(`canonicalRoleCode` inside the rebuild/reconcile/historical-catalog chain) deliberately
stays on the live table, because permanent role aliases are a forward-acting contract: a
card stored under a role code that is renamed _later_ must still resolve, which is the
entire point of the alias table being permanent and append-only. Pinning alias application
would break exactly the historical cards the ledger exists to protect.

What makes this safe rather than a silent fallback: when a bundle's `roleTaxonomyPin` does
not match the live table, resolution verifies the live table is a **conservative extension**
of the retained snapshot — every retained alias maps to the same target, every retained
category still exists, every retained legacy mapping and override is unchanged. A live table
that contradicts the retained one (a retargeted or removed alias, a dropped category) fails
resolution typed rather than applying either table. This is the one documented place a
release-pinned path consults live content, and it consults it only after proving the live
content agrees with everything the pin retained.

### 3.7 Not a "latest definitions" system

The ledger never answers "what is the current modifier set" — the live seed answers that,
and only for unpinned surfaces (the demo context, the D1 workspace, the dashboard, the
new-card preview) that are current by design. The ledger answers exactly one question:
"what content did this exact pinned hash mean when it was published". A release that pins
hash H resolves the content of H forever, whether or not anything current still produces H.

## 4. Lifecycle

**How content enters.** Publication, and nothing else. When `npm run ip-cards:releases`
freezes a release, it appends each of the release's four set contents to the ledger under
that content's hash (if the (id, hash) key is not already present). The first generation on
this branch captured the four sets every one of the 23 published releases pins — copied from
the live sources while those sources were still byte-identical to what the pins were
computed from, in the foundation commit, **before** any set was edited.

**How resolution works.** `getReleaseDefinitionSources(recipeVersionId, contract, setPins)`:
for each set, if the live set's hash equals the pin, the live content is used (the ordinary
case for current releases); otherwise the ledger entry under (id, pin) is used; otherwise
resolution fails typed. The generator resolves frozen releases through their recorded pins
(read from the retained generated bundles), so regenerating after a live-set edit leaves
every frozen release's hash exactly where it was published.

**How new set content is introduced.** Edit the live source (`seed/operational.ts`,
`domain/role-taxonomy.ts`, or the generated modifier definitions), author forward releases
for the procedures whose behavior should consume the new content, generate, review the
impact report, freeze, move the pointers. The next generation appends the new set content
under its new hash when the first release pinning it publishes. Procedures whose behavior
is unaffected keep their pointers, keep their old pins, and keep resolving the retained
content — mixed current pins across procedures are expected and are the reason resolution
is per-bundle.

**What became legitimate that was not before.** Editing a live definition set no longer
invalidates published releases — that is the entire point. The discipline that replaces the
freeze: the ledger keeps every published pin resolvable, the publication baseline keeps
every retained entry and every published pin immutable, and the demo-equals-current-release
invariant test keeps the unpinned surfaces coherent with what a new card would actually pin.

## 5. The F-09 application record

The first real use of the ledger, in the shape the D1.1 release-impact record established.

### 5.1 Correction

`OPS-APC-RIGID` (`APC_APPLICATOR_RIGID`), added by the APC modifier's `add_slot` action in
`seed/operational.ts`: `requiredness` `required` → `conditional`, `dependencyRule`
absent → `"Rigid system in use"` (owner-review finding F-09, 2026-08-09; the exact
owner-authorized phrase, recorded in `d1-review/owner-review-dispositions.md`). No other
field of the slot, no other action of the APC modifier, and no other modifier changed — the
regression suite proves the whole-set delta is exactly this edit.

### 5.2 Forward-release surface

APC reachability was audited across every procedure: a procedure consumes the corrected
modifier definition only if its current release's recipe lists `APC` in
`allowedModifierCodes` (the merged set is filtered by that authored permission before
anything reaches the resolver), and no rescue module adds the role through another door.
Exactly two qualify.

| Procedure               | Current release                 | APC allowed? | APC reachable? | Rigid applicator reachable?               | New set needed? | Reason                                                                                     | New release                     | Pointer moved? |
| ----------------------- | ------------------------------- | ------------ | -------------- | ----------------------------------------- | --------------- | ------------------------------------------------------------------------------------------ | ------------------------------- | -------------- |
| RIGID_BRONCH            | release-rigid-bronch-v1-0       | yes          | yes            | yes (modifier + composed SLOT-18617846CD) | yes             | corrected APC definition is in its active surface                                          | release-rigid-bronch-v1-1       | yes            |
| THERAPEUTIC_BRONCH      | release-therapeutic-bronch-v1-1 | yes          | yes            | yes (modifier)                            | yes             | same                                                                                       | release-therapeutic-bronch-v1-2 | yes            |
| all 14 other procedures | (unchanged)                     | no           | no             | no                                        | no              | APC outside `allowedModifierCodes`; allowed-modifier projection identical under either set | —                               | no             |

Mixed current set pins are the intended end state: the fourteen non-advanced procedures keep
pinning `e3335096…`, now resolved from the ledger, and their resolved cards are byte-identical
under either set because the APC modifier never survives their permission filter — pinned by
the demo-equals-current-release invariant test.

### 5.3 Set-pin statement

The **modifier-set pin** moved for the two new releases and only for them:
`definition-set-modifiers` `e333509636d4564b…` → `a9758b0b0ace11f1…`. The rescue-module,
compatibility-rule, and role-taxonomy pins are unchanged on every release. The two prior
generations of the modifier set are both retained in the ledger.

### 5.4 Known reporting gap

`diffReleaseBundles`' requirement-level diff indexes recipe and module slots; a requirement
living inside a modifier's `add_slot` payload is outside it, so the impact report for each
new release shows the pin change and **zero requirement changes** — the same class of gap
recorded for F-04 in the D1.1 pass. The semantic delta is proven at expansion level instead:
`f09-apc-rigid-applicator.test.ts` diffs the effective slots and the resolved card of
v1-1 vs v1-2 field by field and pins that exactly one item changed, in exactly the four
conditional fields.

### 5.5 Publication mechanics

Two-pass freeze, per the release workflow: drafts (no hash) → generator reported
`release-rigid-bronch-v1-1` = `eee55a3ef86ee5a2…` and `release-therapeutic-bronch-v1-2` =
`759912d06739ec21…` with one pin change each → hashes, catalog release
(`8ece7648b8436…`), resolver contract (`ip-cards-resolver-contract/1`), and resolver build
(`72ea5fc70fc3…`) frozen, `publishedAt` set, both pointers advanced → clean re-run.
`check-publication-baseline` against the `origin/main` merge base: every base entry
unchanged, zero lifecycle advances, everything new reported as additions (the two releases,
the five ledger entries, and the seven D1.1 releases still in their pre-publication window).
The superseded releases stay `published`; retiring them is a separate owner decision.

### 5.6 Generated artifacts

Every generated file this branch touches, with its generator and content identity
(sha256 of the file bytes):

| Artifact                                                | Generator                   | Semantic change                                                                                                                                                                                                                                                                              | Before (base `e833b97f`) | After                                                 |
| ------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------- |
| `generated/definition-set-ledger.json`                  | `npm run ip-cards:releases` | new artifact; 4 entries at the foundation commit, 5 after F-09 (two modifier-set generations)                                                                                                                                                                                                | — (absent)               | `855da98e16d1b240…` (foundation: `5da5ea61fe7b360e…`) |
| `generated/release-bundles.json`                        | `npm run ip-cards:releases` | +2 published releases; 2 pointer moves; all 23 prior bundles byte-identical                                                                                                                                                                                                                  | `8b7453196efecb55…`      | `65087cfe12a3d3bb…`                                   |
| `generated/release-impact-report.json`                  | `npm run ip-cards:releases` | +2 reports, one modifier-set pin change each, zero requirement changes                                                                                                                                                                                                                       | `41ba0880bcf7bfa9…`      | `02f4080f7eb5bb5c…`                                   |
| `docs/ip-device-intelligence/data-readiness-audit.json` | `npm run ip-intel:audit`    | **unchanged** — F-09 is outside the audit's measured surface: the audit reads the generated workbook-derived artifacts (`procedure-slots.json`, `slot-product-options.json`, `modifier-definitions.json`, which excludes the hand-tuned seed modifiers), none of which the seed edit touches | `bba2b9402cbfe4a4…`      | `bba2b9402cbfe4a4…` (identical)                       |

`module-ledger.json`, `composition-ledger.json`, `catalog-rows.json`,
`catalog-release-manifests.json`, `product-family-versions.json`, `catalog-release.json`,
`resolver-release.json`, `modifier-definitions.json`, and every other generated file are
byte-identical to the base.

## 6. Post-implementation import classification

The Phase-9 sweep over every remaining direct import of the four live sets, after the
retention work landed. Categories as in §1.

- **Release-pinned runtime, now resolved by pin** — `data/demo-context.server.ts`
  (`getReleaseDefinitionSources` with `setPins`, `buildContextForRecipe` with `pinnedSets`),
  `data/release-bundles.server.ts` (`loadSources` passes the bundle's pins;
  `buildReleaseContext` builds from the resolved sources). Everything downstream of
  `buildReleaseContext` — create/save, exact edit/reopen, reconciliation, reviewed rebuild —
  inherits pinned resolution.
- **Alias application on the live table, guarded** — `historical-catalog.server.ts`,
  `product-families.server.ts`, `domain/card-rebuild-plan.ts`, `domain/equipment-set.ts`,
  `domain/product-family.ts`, `server/rebuild-builder-context.ts`, `server/rebuild-card.ts`
  (`canonicalRoleCode`). Deliberate, documented in §3.6, guarded by
  `liveTaxonomyExtendsRetained` at bundle resolution.
- **Current-by-design surfaces (unpinned, documented)** —
  `device-intelligence/server/compatibility.server.ts` (atlas display conditions),
  `procedures.server.ts` / `outputs.server.ts` (D1 workspace/readiness/outputs via the demo
  context), `server/catalog.ts` and the two role-code routes (alias routing / browse),
  dashboard and admin pages, the new-card wizard preview. Coherence with pinned resolution
  is not assumed: the demo-equals-current-release invariant test fails if the live sets and
  the pointer targets ever tell different stories.
- **Canonical authoring/generation** — `build-release-bundles.ts` (creates the pins),
  `build-recipe-compositions.ts`, `generate-scenarios.ts` (producer of the generated
  modifier definitions), `validate-seed.ts`, `apply-role-taxonomy.ts`, `import-catalog.ts`,
  `validate-data.ts`.
- **Point-in-time tooling** — `scripts/ip-device-intelligence/audit-data-readiness.ts`
  (fs-reads the generated modifier definitions; an audit is a snapshot by definition).
- **Tests/fixtures** — `scenarios.test.ts`, `role-taxonomy.test.ts`,
  `recipe-composition.test.ts`, `resolver-contract-v1.test.ts`, plus the new
  `definition-set-ledger.test.ts` and F-09 suites.

No release-pinned runtime path reads an unqualified live global for the three
resolver-facing sets. One pre-existing live read inside pinned resolution remains outside
this pass's scope and is recorded as accepted: `isProductCurrentlyUnselectable`
(`server/catalog.ts`) applies the _current_ catalog's slotting governance to historical
catalog picks during rebuild — fail-closed (a pick can become unavailable, never silently
substituted), predates this branch, and concerns catalog governance rather than the four
definition sets.
