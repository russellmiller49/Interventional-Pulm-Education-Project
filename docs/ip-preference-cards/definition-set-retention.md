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

| Consumer                              | File / function                                                                                                                                                                              | Sets                                       | Current source                                                 | Bundle pin available?                                               | Historical-safe before this pass?                                                            | Correction                                                                                                                                                                                                                                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context assembly hub                  | `data/demo-context.server.ts` — `allModifierDefinitions` (merge), `buildContextForRecipe`, `getReleaseDefinitionSources`                                                                     | M R C T                                    | Live constants + generated JSON at module load                 | Yes on the release chain (pins verified upstream), no on demo paths | Fail-closed only: live edit ⇒ every pinned card refuses to open                              | **(a)** paths now resolve each set by the bundle's pin (live when the hash matches, ledger entry otherwise); demo paths stay live by design                                                                                                                                                               |
| Release runtime                       | `data/release-bundles.server.ts` — `loadSources`, `buildReleaseContext`, `validateRetainedReleases`                                                                                          | M R C T                                    | Live, hash-verified against pins                               | Yes — this is the enforcement point                                 | Fail-closed, not retained                                                                    | `loadSources` passes the bundle's four set pins; `buildReleaseContext` builds the context from the resolved (possibly retained) sets, not the live globals                                                                                                                                                |
| Release generator                     | `scripts/ip-preference-cards/build-release-bundles.ts`                                                                                                                                       | M R C T                                    | Live (its job)                                                 | Creates the pins                                                    | The enforcement mechanism                                                                    | Frozen releases resolve their recorded pins (from the retained generated bundles); ledger generation appended; ledger validation gates writes                                                                                                                                                             |
| Card create/save                      | `server/user-cards.ts` → `rebuild-builder-context.ts` → `buildReleaseContext`                                                                                                                | M R C (T via aliases)                      | Live, pin-verified                                             | Yes                                                                 | Fail-closed                                                                                  | Inherits pinned resolution through `buildReleaseContext`                                                                                                                                                                                                                                                  |
| Card view/print/share                 | `server/user-cards.ts` (`loadUserCard`, `loadSharedCard`)                                                                                                                                    | none                                       | Stored snapshot only                                           | n/a                                                                 | Safe (snapshot)                                                                              | None needed                                                                                                                                                                                                                                                                                               |
| Exact edit / reopen                   | `[cardId]/edit` → `rebuildBuilderContext` → `buildReleaseContext` (card's own pin)                                                                                                           | M R C T                                    | Live, pin-verified                                             | Yes                                                                 | Fail-closed                                                                                  | Inherits pinned resolution                                                                                                                                                                                                                                                                                |
| Duplication                           | `duplicateUserCard`                                                                                                                                                                          | none                                       | Row copy                                                       | n/a                                                                 | Safe                                                                                         | None needed                                                                                                                                                                                                                                                                                               |
| Reconciliation                        | `server/reconcile-card.ts` (operational half via `resolveForSave`; release half via `resolveReleaseDefinitions` on both sides)                                                               | M R C T                                    | Live, pin-verified both sides                                  | Yes                                                                 | Fail-closed — and cross-release comparison became **unavailable** exactly when a set changed | Both sides now resolve their own pinned sets, so the comparison works across set changes                                                                                                                                                                                                                  |
| Reviewed rebuild                      | `server/rebuild-card.ts`, `rebuild-builder-context.ts`, `domain/card-rebuild-plan.ts`                                                                                                        | M R C T                                    | Live, pin-verified both sides                                  | Yes                                                                 | Fail-closed, same unavailability                                                             | Source and target releases each resolve their own pinned sets                                                                                                                                                                                                                                             |
| D1 workspace/readiness/outputs        | `device-intelligence/server/procedures.server.ts`, `outputs.server.ts` (via `buildDemoContext` / `resolveDemoScenario`)                                                                      | M R C                                      | Live demo context; current bundle fetched for **display** only | Available-but-unused                                                | Current-by-design; coherent with pinned cards only because CI froze live == pinned           | Documented current-by-design surface. Coherence invariant now proven by test: for every procedure, the demo resolution equals the current-pointer release resolution                                                                                                                                      |
| D1 atlas compatibility conditions     | `device-intelligence/server/compatibility.server.ts` — `typedCompatibilityRules` import                                                                                                      | C                                          | Live constant                                                  | No                                                                  | Current-by-design                                                                            | Documented current-by-design surface (atlas is a current view, not a card reconstruction)                                                                                                                                                                                                                 |
| Role alias routing                    | `[locale]/clinical-roles/[roleCode]`, `preference-cards/catalog/uses/[roleCode]`, `server/catalog.ts`                                                                                        | T                                          | Live tables                                                    | No                                                                  | Current-by-design (permanent-alias policy)                                                   | Documented current-by-design surface                                                                                                                                                                                                                                                                      |
| Alias use inside pinned paths         | `historical-catalog.server.ts`, `domain/card-rebuild-plan.ts`, `domain/product-family.ts`, `rebuild-builder-context.ts`, `rebuild-card.ts` — `roleCanonicalizerFor(context.roleCodeAliases)` | T                                          | The release's **resolved** taxonomy, carried on `BuildContext` | Yes                                                                 | Fail-closed on contradiction; **byte-stable** under live extension                           | P92-C1: alias **application** now uses the release's resolved snapshot — retained from the ledger when the pin no longer matches live — so a future live alias can never reinterpret a historical role. §3.6 rewritten; `liveTaxonomyExtendsRetained` stays as the governance tripwire for contradictions |
| New-card wizard preview               | `preference-cards/new/page.tsx` (`buildDemoContext`)                                                                                                                                         | M R C                                      | Live                                                           | Release id stamped separately                                       | Current-by-design (authoring)                                                                | Coherence invariant proven by the same demo-equals-current-release test                                                                                                                                                                                                                                   |
| Dashboard / admin recipes / formulary | `preference-cards/page.tsx`, `admin/preference-cards/*`                                                                                                                                      | M R C                                      | Live via demo context                                          | No                                                                  | Current-by-design                                                                            | Documented current-by-design surfaces                                                                                                                                                                                                                                                                     |
| Composition generator                 | `scripts/ip-preference-cards/build-recipe-compositions.ts`                                                                                                                                   | M R                                        | Live seed at build time                                        | n/a                                                                 | n/a                                                                                          | None — canonical authoring input                                                                                                                                                                                                                                                                          |
| Seed/scenario/taxonomy tooling        | `validate-seed.ts`, `generate-scenarios.ts`, `apply-role-taxonomy.ts`, `import-catalog.ts`, `validate-data.ts`                                                                               | M T                                        | Live (canonical application point)                             | n/a                                                                 | n/a                                                                                          | None — canonical authoring/validation                                                                                                                                                                                                                                                                     |
| D0 audit                              | `scripts/ip-device-intelligence/audit-data-readiness.ts`                                                                                                                                     | M (fs read of `modifier-definitions.json`) | Generated JSON on disk                                         | No                                                                  | Point-in-time audit                                                                          | None — audit is a current snapshot by definition                                                                                                                                                                                                                                                          |
| Tests binding live content            | `scenarios.test.ts`, `role-taxonomy.test.ts`, `mechanisms.test.ts`, `readiness.test.ts`, etc.                                                                                                | M R C T                                    | Live                                                           | n/a                                                                 | n/a                                                                                          | Category (d); new suites added for retained resolution                                                                                                                                                                                                                                                    |

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
Deletion or mutation of a retained entry is rejected twice, by two different guards
covering the two ways the tampering can be written: `check-publication-baseline` catches a
changed **hash** — the content-addressed key changes with it, which reads as removing a
published entry (`publication_entry_removed`) — while a content edit that leaves the
recorded hash field intact is invisible to the baseline (it never re-hashes content) and is
caught instead by `validateDefinitionSetLedger`'s re-hash, in the build gate and the
committed-data suite (`definition_set_ledger_entry_mutated`). The recorded first publisher
is protected as an undeclared lifecycle field: any later change to it is
`publication_lifecycle_field_rewritten`.

### 3.4 Failure modes (all fail closed)

| Condition                                                                     | Where it fails                                           | Code                                                          |
| ----------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| Entry content no longer matches its recorded hash                             | build + integrity suite                                  | `definition_set_ledger_entry_mutated`                         |
| Two entries claim one (id, hash) key                                          | build + integrity suite                                  | `definition_set_ledger_duplicate_entry`                       |
| Entry carries an unknown set id                                               | build + integrity suite                                  | `definition_set_ledger_unknown_set`                           |
| A published pin present in neither the matching live set nor the ledger       | build + integrity suite + runtime resolution             | `definition_set_ledger_entry_missing` / `release_pin_missing` |
| Retained taxonomy contradicted by the live table (§3.6)                       | runtime resolution                                       | `release_pin_missing` (typed, card goes view-only)            |
| Tampered ledger content reaching runtime                                      | `pinDiff` re-hashes the resolved content against the pin | `release_definition_mutated`                                  |
| Retained entry removed, or its hash rewritten, relative to the protected base | `check-publication-baseline`                             | `publication_entry_removed`                                   |
| Retained entry's content edited with its recorded hash left intact            | build gate + committed-data suite (re-hash)              | `definition_set_ledger_entry_mutated`                         |

There is no fallback from a missing pinned set to the current live set, and no "latest"
selection anywhere.

One diagnosability note, accepted deliberately: a §3.6 taxonomy contradiction surfaces
through the same null as an unresolvable pin, so the typed failure an operator sees is
`release_pin_missing` — the message will point at a missing ledger entry when the actual
cause is a retargeted or removed alias in the live table. Fail-closed behaviour is correct
either way; a distinct code would only improve the error's aim, and is recorded as accepted
debt rather than silently improved here.

### 3.5 Historical/runtime parity

`getReleaseDefinitionSources` resolves each of the four sets **once**, by the bundle's pin,
and that single `ReleaseDefinitionSources` object is both what `pinDiff` validates and what
`buildContextForRecipe` builds the reconstruction context from. The validator and the
runtime cannot disagree about which content a bundle means, because they read the same
resolved object.

### 3.6 Role taxonomy: retained for validation **and** for alias application (P92-C1)

The role taxonomy is retained and resolved by pin exactly like the other three sets, and the
resolved snapshot is what release hash validation runs against — and, since the P92-C1
correction, what alias **application** runs against too. The resolved snapshot's
`roleCodeAliases` rides on the release's `BuildContext` (a release-pinned field, enforced by
the context-field classification in `release-bundle.ts`), and every canonicalization in the
pinned chain — stored picks, custom lines, equipment-set roles, family pins, historical
catalog lookups, the rebuild plan — goes through `roleCanonicalizerFor` over that table. The
module-level live `canonicalRoleCode` is for current-data surfaces only: catalog browse, the
pickers, the client-side equipment-set library.

The previous design applied the **live** table inside pinned paths, guarded by a
conservative-extension check. Codex review (P92-C2 pass, finding P92-C1) showed the guard
protected retained alias _keys_ but not active historical role codes from becoming **new**
alias sources: a future live alias `APC_APPLICATOR_RIGID → ENERGY_PLATFORM` passed the
extension check and silently re-aimed the rigid APC applicator inside
`release-rigid-bronch-v1-0` while resolution reported ok. Pinned application closes the
whole class structurally: the historical role universe — every code reachable through the
release's recipe slots, module slots, modifier-added slots, modifier targets, rescue
modules, compatibility participants, retained aliases, and pinned catalog mappings — is
protected because release-semantic canonicalization never consults live data at all. A
benign live extension leaves every historical card and context byte-identical, proven by
`release-taxonomy-stability.test.ts` against the real ledger data.

The forward-acting half of the permanent-alias contract is unaffected: a card stored under a
code that is renamed later still resolves, because the release it pins retained the alias
table of its own era, aliases are append-only, and a _rebuild onto a newer release_
canonicalizes in the target release's vocabulary — which contains every older alias. What a
rename can no longer do is reach **backwards** into an already-published release.

`liveTaxonomyExtendsRetained` remains at bundle resolution, with a narrower job: it is the
governance tripwire for the permanent-table contract. A live table that **contradicts** what
a published release retained — a retargeted or removed alias, a dropped category, a changed
override — is a rewrite of a permanent table, and every release that retained the
contradicted content fails resolution typed (`release_pin_missing`) rather than resolving as
if nothing happened. Extensions pass; contradictions refuse; and in neither case does the
live table reach a historical card's semantics.

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

### 5.4 Reporting gap — CLOSED by the merged-main integration

As first published on this branch, `diffReleaseBundles`' requirement-level diff indexed
recipe and module slots; a requirement living inside a modifier's `add_slot` payload was
outside it, so the impact report for each new release showed the pin change and **zero
requirement changes** — the same class of gap recorded for F-04 in the D1.1 pass, accepted
at the time with the semantic delta proven at expansion level instead
(`f09-apc-rigid-applicator.test.ts`).

That limitation did not survive the integration with merged main (§7). PR #91's P91-C3
added the generic `modifierEffectChanges` layer to `diffReleaseBundles`, fixture-proven
against exactly this F-09 shape and waiting for per-bundle set resolution to feed it real
old/new sets. The integration is that feed: the generator resolves each frozen release's
sources through its recorded whole-set pins, so the diff's previous side carries the
retained `e3335096…` modifier set and the next side the `a9758b0b…` set, and the canonical
report for both F-09 releases now carries the authored effect natively —
`sourceKind: "modifier"`, modifier `APC`, action `apc-232` (`add_slot`, sequence 232),
requirement `OPS-APC-RIGID`, `changedFields: ["dependencyRule", "requiredness"]`, with the
full before/after (`required`/null → `conditional`/`"Rigid system in use"`). Base
`requirementChanges` remain zero for both releases — correct, not a gap: APC is not
selected by default, so the base effective recipe is unchanged; the modifier-effect layer
is where a set revision's authored consequence is reported. The expansion-level proof in
`f09-apc-rigid-applicator.test.ts` still stands, now alongside the canonical artifact
rather than in place of it.

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

### 5.6 Owner observation (data/UX, no action taken)

On a RIGID_BRONCH card with the APC modifier selected, the resolved card carries two
conditional rows for the same role: the composed `SLOT-18617846CD` ("Rigid or malleable APC
applicator", dependency "Rigid APC planned") and the modifier-added `OPS-APC-RIGID` ("Rigid
APC applicator", dependency "Rigid system in use"). The duplication is pre-existing
(requirement keys keep operationally authored lines distinct by design, and before F-09 the
modifier row was hard-required — strictly worse); what is new is that both rows now ask a
question, and on a rigid case "Rigid system in use" is definitionally true while "Rigid APC
planned" is the discriminating one. Whether the APC modifier's row should be suppressed or
re-phrased on rigid procedures is clinical authoring — recorded here for the owner rather
than decided in code.

### 5.7 Generated artifacts

Every generated file this branch touches, with its generator and content identity
(sha256 of the file bytes):

| Artifact                                                | Generator                   | Semantic change                                                                                                                                                                                                                                                                              | Before (base `e833b97f`) | After                                                 |
| ------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------- |
| `generated/definition-set-ledger.json`                  | `npm run ip-cards:releases` | new artifact; 4 entries at the foundation commit, 5 after F-09 (two modifier-set generations)                                                                                                                                                                                                | — (absent)               | `855da98e16d1b240…` (foundation: `5da5ea61fe7b360e…`) |
| `generated/release-bundles.json`                        | `npm run ip-cards:releases` | +2 published releases; 2 pointer moves; all 23 prior bundles byte-identical                                                                                                                                                                                                                  | `8b7453196efecb55…`      | `65087cfe12a3d3bb…`                                   |
| `generated/release-impact-report.json`                  | `npm run ip-cards:releases` | +2 reports, one modifier-set pin change each — regenerated again in §7 with the F-09 `modifierEffectChanges` row on both                                                                                                                                                                     | `41ba0880bcf7bfa9…`      | `02f4080f7eb5bb5c…` (superseded in §7)                |
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
- **Alias application on the release's resolved table (P92-C1)** —
  `historical-catalog.server.ts`, `product-families.server.ts` (`resolveProductFamilyPin`),
  `domain/card-rebuild-plan.ts`, `domain/product-family.ts`,
  `server/rebuild-builder-context.ts`, `server/rebuild-card.ts` — all take a
  `RoleCodeCanonicalizer` built from `context.roleCodeAliases` /
  `plan.target.roleCodeAliases`. The live table (`canonicalRoleCode`,
  `domain/equipment-set.ts` localStorage parsing, the by-role picker indexes) serves only
  current-data surfaces. Documented in §3.6; `liveTaxonomyExtendsRetained` remains as the
  contradiction tripwire at bundle resolution.
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

One adjacent live read sits outside the four sets and is documented rather than pinned:
the reopen path resolves the card's **scenario** from the live `scenarios.json`
(`buildReleaseContext` → `getScenarioDefinition`), and the wizard's modifier picker
intersects the pinned context's modifiers with the live scenario's
`availableModifierCodes`. The pinned recipe's `allowedModifierCodes` stays the
authorization boundary (the server re-validates against it on save), and an intersection
can only narrow the picker, never widen it — the residual risk is presentational: a
scenario regeneration that drops a code a retained release still grants would silently
hide that modifier from a reopened card's picker. `release-bundle-integrity.test.ts`
("never lets the live scenario list narrow a pinned recipe's modifier offer") pins the
pairing so that narrowing forces a review instead of shipping.

## 7. Integration with merged main (PR #91, 2026-08-10)

Everything above §7 records the branch as built on the pre-review PR #91 head
(`e833b97f`) — deliberately left intact as the historical record, including the §2
reproduction performed at that commit. PR #91 subsequently passed independent Codex
review and merged (`66eddbb2b41a417cef8b6a20b0d2c8e1cfe6b245`); this branch merged that
state in and reconciled both directions. What changed against the record above:

- **Release universe.** Merged main publishes 25 releases (the 23 of §4 plus the P91
  correction releases `release-custom-composition-v1-2` and
  `release-med-thoracoscopy-v1-2`); with the two F-09 releases this branch totals 27.
  Both P91 releases pin the same four set hashes as the original 23, so the ledger's
  five entries (§5.7) cover every pin of every release on the integrated branch — the
  foundation was re-validated, not re-captured, against the 27-bundle universe: every
  (set, hash) pin resolves, every retained payload re-hashes to its recorded key, no
  duplicate keys, deterministic order. `check-publication-baseline` against merged main
  (merge base `66eddbb2…`): 94 base entries unchanged, 0 lifecycle advances, 7 additions
  (the two F-09 releases and the five ledger entries).
- **Release generation.** The definition-set ledger is now the **tenth** validated target
  inside PR #91's build-first/write-last orchestration (`runBuildReleaseBundles`,
  `RELEASE_GENERATION_TARGET_FILENAMES`, `writeReleaseArtifacts`), with the same
  fail-before-write guarantee — proven by the CLI atomicity suite, which also
  distinguishes the four read-and-merge retained artifacts (the ledgers and
  `release-bundles.json`, whose recorded whole-set pins are themselves retained history)
  from the write-only targets, and pins that a corrupted retained artifact fails loudly
  rather than degrading to "empty and rebuilt".
- **Release impact.** §5.4's accepted gap is closed: both F-09 reports carry the
  canonical `modifierEffectChanges` row. The two frozen F-09 release hashes
  (`eee55a3e…`, `759912d0…`) were reproduced unchanged by regeneration against merged
  main; the only regenerated artifact delta of the integration is the impact report.
- **Pointer delta vs merged main.** Exactly `RIGID_BRONCH` (v1-0 → v1-1) and
  `THERAPEUTIC_BRONCH` (v1-1 → v1-2). The P91 pointer advances (CUSTOM_COMPOSITION,
  MED_THORACOSCOPY) arrive from main unchanged.
- **Create/edit boundary hardening.** The create-currency guard (a NEW card originates
  only on the current pointer) gained its missing sibling: `saveUserCard`'s edit branch
  now refuses a request whose `releaseBundleId` differs from the stored card's pin, so
  create-then-edit can no longer land a fresh card on a superseded release the ledger
  keeps resolvable. Moving a card between releases remains the rebuild flow's job.
- **D0 audit boundary.** `data-readiness-audit.json` is byte-identical to merged main
  (`bba2b940…`), as §5.7 predicted — the F-09 seed edit is outside the audit's measured
  surface.
