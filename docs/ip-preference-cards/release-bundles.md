# Immutable release bundles

A recipe version id is a **name**. A name only pins content if something proves the content
behind it never moved.

Before this, a saved card stored `recipeVersionId` and `selectedModuleVersionIds` and the
lookup resolved them exactly — no "latest module", no fallback to the current composition. That
was true and it was not enough, for two reasons:

- **Nothing checked the content behind the names.** Editing a slot inside
  `module-flex-bronch-core-v1-0` changed what every card pinned to it re-resolved to, with the
  pin untouched. Verified by execution — see [`dependency-closure.md`](./dependency-closure.md).
- **The names did not cover everything the resolver reads.** The modifier set, rescue modules,
  typed compatibility rules, and the role alias table all reached `resolveCard` from
  module-level constants with no version at all.

A release bundle is the closure: every immutable authored definition needed to reconstruct one
procedure's card, each addressed by a content hash.

```text
release-ebus-tbna-v1-0
  recipe        recipe-ebus-tbna-v0-1          hash 4b2f…
  modules       module-flex-bronch-core-v1-0   hash 8c01…
                module-ebus-tbna-specific-v1-0 hash a91d…
                module-procedural-fluoroscopy-v1-0 hash 77e3…
  modifiers     definition-set-modifiers       hash 1d5a…
  rescue        definition-set-rescue-modules  hash 0fb2…
  compatibility definition-set-compatibility-rules hash 66c8…
  roles         definition-set-role-taxonomy   hash e402…
  catalog       <catalog release digest>       (recorded, not hashed)
  resolver      ip-cards-resolver/0.2.0        (recorded, not hashed)
```

## The lifecycle

1. **Author a draft.** Add a release to `data/ip-preference-cards/seed/release-bundles.json`
   with `releaseState: "draft"` and no `definitionHash`. An author writes lifecycle facts only;
   nobody hand-writes a pin, because a hand-written pin is a claim about content nothing
   checked.
2. **Review its impact.** `npm run ip-cards:releases` prints the computed hash and, for a
   release that supersedes another, the requirement-level diff — _`AIRWAY_RETRIEVAL_FORCEPS`
   changed (`requiredness`)_, not merely _a hash moved_. The full report lands in
   `generated/release-impact-report.json` and renders on `/admin/preference-cards/recipes`.
   Since the 2026-08-10 P91-C3 correction the requirement layer diffs the **final effective
   recipes** — the exact old and new pinned recipes and modules expanded through the
   canonical action evaluator, every referenced module selected — so a per-slot composition
   action is a first-class requirement change rather than an invisible recipe-pin move, and
   a third layer (`modifierEffectChanges`, `sourceKind: "modifier"`) reports changes to the
   **authored effect of selecting a modifier** the procedure offers (field-level
   before/after for `add_slot` payloads and the targeted action types, plus first-class
   rows for a modifier entering or leaving the offer), explicitly without implying any
   scenario selects it. Today every release resolves the same four definition sets, so the
   modifier layer is empty on real data and a set edit is refused outright by the
   immutability gates; the layer is proven on a synthetic fixture and becomes live the
   moment releases pin **per-bundle** definition sets (the retention mechanism PR #92
   introduces) — at which point a set revision reports its requirement-level effect rather
   than only a moved hash.
3. **Publish.** Copy the reported hash into the seed entry, set `releaseState: "published"`,
   `publishedAt`, `catalogImportId`, and `resolverContractVersion`. Publication **is** freezing
   the hash.
4. **Advance the pointer** — the separate, deliberate act that makes a release current.
5. New cards use the pointed-to release.
6. Existing cards stay on theirs. Nothing migrates them.
7. Superseded releases stay in the file and keep resolving.
8. **Retire** by setting `releaseState: "retired"` and `retiredAt`, and moving the pointer off
   it. It stays retrievable and stops being selectable.
9. Any attempt to mutate or remove a published definition fails the build and the suite.

Steps 3 and 4 are separate on purpose. A release can be published, reviewed, and sitting there
while the program has not switched to it — the fixture's `CHARLIE` is exactly that.

## Why the pointer, and nothing else

`resolveCurrentRelease` reads an explicit pointer and has no fallback. Every alternative
encodes a policy nobody reviewed:

| Shortcut                | Fails when                                                |
| ----------------------- | --------------------------------------------------------- |
| Highest version string  | `v1-10-0` vs `v1-2-0`, depending on whose comparator wins |
| Newest `publishedAt`    | a backported fix outranks the line it was backported from |
| Last entry in the array | a merge appends and silently promotes                     |
| Resolve module code     | the thing the whole pin exists to prevent                 |

`release-bundle.test.ts` proves this with a fixture whose non-current `CHARLIE` release is
simultaneously the highest version string, the newest publication date, **and** the last array
entry. A test that gets `CHARLIE` has caught a version-sorting shortcut.

## What the definition hash covers

Everything pinned: the release id, procedure, scenario, recipe version and its hash, every
module pin, the four set pins, and `supersedesReleaseBundleId`.

Deliberately excluded, with the reason recorded in code as
`RELEASE_BUNDLE_HASH_EXCLUSIONS`:

- `releaseState`, `publishedAt`, `retiredAt` — lifecycle acts, not content edits. **A retired
  release must keep the hash it published with**, or retiring would be indistinguishable from
  mutating.
- `releaseNotes` — prose about the release.
- `governanceState` — derived from the pins, so already implied.
- `catalogImportId`, `resolverContractVersion` — independently versioned; drift is reported.

## Two axes, not one

`releaseState` (`draft` / `published` / `retired`) is whether the definition set is **frozen**.
`governanceState` (`draft` / `in_review` / `approved` / `retired`) is how far the **clinical
content** has got through review.

They are independent, and this prototype needs them to be: every module here is honestly still
clinical-`draft`, and folding the axes together would force a choice between claiming review
that has not happened and never being able to freeze anything. A published-and-immutable
release of draft content keeps its prototype watermark.

## Failure is visible, never silent

| Situation                                    | Result                                   |
| -------------------------------------------- | ---------------------------------------- |
| Pinned release no longer retained            | `release_unknown` → card is view-only    |
| A pinned definition deleted                  | `release_pin_missing` → view-only        |
| A pinned definition edited                   | `release_definition_mutated` → view-only |
| Pointer at a retired or draft release        | build fails                              |
| A published release's hash no longer matches | build fails, naming which pins moved     |
| A superseded release dropped                 | build fails                              |
| Catalog or resolver contract moved           | warning, recorded; cards still open      |

A card that will not reopen keeps its snapshot and still views, prints, shares, and duplicates.
That is the safe direction to fail, and it is visible rather than silent — the alternative is a
card quietly rebuilt from content its author never reviewed.

## What is proved where

Production carries **one release per procedure**. No clinical content has been revised since
bundles were introduced, and fabricating a revision to exercise the machinery would put
invented clinical content in the repository.

So the multi-version behaviour is proved on a synthetic fixture
(`__fixtures__/release-bundle-fixtures.ts`) with three releases across two recipe versions and
one deliberately trivial change — a requirement moving `optional` → `required`.
`release-bundle.test.ts` (31 tests) covers retention, pointer selection, retirement, mutation
and deletion detection, hash coverage, and impact review.
`release-bundle-integrity.test.ts` checks the real committed data on every CI run.

**Retaining a superseded _module_ version** is handled by the module ledger below.
**Retaining a superseded _recipe_ version** is handled the same way by
`generated/composition-ledger.json` (introduced with the 2026-08-09 owner-review data
corrections): the seed carries exactly one — the current — composition per procedure, because
a superseded entry cannot keep rebuilding (it would be validated against the _current_
imported template and module map, both of which the new version exists to change). Every
recipe version a published release pins is instead copied into the ledger once, verbatim, as
the `RecipeVersion` the release hashed into `recipePin`; `recipeForRecipeVersionId` falls
back to it when live data misses, and `validateCompositionLedger` fails the release build on
an edited entry, a live/published divergence, or a pinned version missing from both. The
custom module composition — derived from the current module set — versions forward through
the same ledger.

**Retaining a superseded _definition set_** — the four whole-set pins
(`definition-set-modifiers`, `-rescue-modules`, `-compatibility-rules`, `-role-taxonomy`) —
is handled by `generated/definition-set-ledger.json`, the fourth ledger, introduced with the
F-09 correction. The sets have no version ids, so entries are addressed by
**(set id, content hash)** — the exact pair a pin names — and `getReleaseDefinitionSources`
resolves each set by the bundle's own pin: the live source when its hash matches, the
retained entry otherwise, a typed failure when neither. Two releases pinning two different
modifier sets resolve side by side in one process; mixed current set pins across procedures
are the intended end state, since only the procedures whose behaviour a set change affects
publish forward releases. Full contract, consumer inventory, and failure modes:
[`definition-set-retention.md`](./definition-set-retention.md).

## Adding a new release

```bash
npm run ip-cards:compositions   # if the composition changed
npm run ip-cards:releases       # computes hashes, prints the impact diff
```

1. Author the new composition in `seed/procedure-compositions.json` under a **new**
   `recipeVersionId`, keeping the old entry.
2. Add a release to `seed/release-bundles.json`: `releaseState: "draft"`,
   `supersedesReleaseBundleId` naming the one it replaces, and a `releaseNotes` line saying
   what changed and why.
3. Run the build. Read the impact diff. It is a list of requirement changes, not a hash.
4. Freeze: paste the hash, flip to `published`, record `publishedAt`, `catalogImportId`, and
   `resolverContractVersion`.
5. Move the pointer.
6. Retire the superseded release if it should stop backing new cards. **Leave it in the file.**

## Retaining a superseded module version

A release pins module versions by exact id, and the composition build regenerates
`recipe-modules.json` from the current module map on every run. Those two facts used to be in
direct conflict: once the last composition moved from `FLEX_BRONCH_CORE` v1.0 to v1.1, nothing
produced v1.0 any more, and the build additionally rejected it as "declared but referenced by no
composition" — taking every card pinned to it down with it.

`data/ip-preference-cards/generated/module-ledger.json` closes that. Every module version a
published release pins is copied into it once, verbatim, and never rewritten:

- The release build appends newly published versions. `withPublishedModules` returns an existing
  entry untouched, so it can never be the thing that rewrites history.
- The composition build accepts a module version the ledger retains even when no composition
  references it. "Declared but unused" and "retained because a release pins it" are different
  situations and are now distinguishable.
- Runtime lookup is the union — live map first, ledger for anything current data no longer
  produces — always keyed by exact `moduleVersionId`, never by module code.
- `validateModuleLedger` fails the build when an entry no longer hashes to what it published,
  when the live map contradicts a published definition, and when a pinned version has gone from
  both. Deleting or mutating a retained module is a build failure, not a silent loss.

Re-deriving an old version from the current mapping was considered and rejected: it would
produce something _plausible_ under the old id, which is exactly the substitution every pin in
this module exists to prevent.

## The resolver: two things, checked differently

`resolverContractVersion` is the **semantic** boundary — what resolution means. It is bumped by
a human and asserted behaviourally; a release published under an older contract is reported.

`resolverImplementationHash` is **provenance** — which build produced a card. It moves on every
source edit, including pure refactors, which is precisely why it must not gate support. A signal
that fires on a rename is a signal nobody reads, and treating it as the boundary would mark
every historical card unsupported for an extracted helper.

Both sit outside `definitionHash`; only the contract move is a warning.

## What sits on top of this

[`historical-reconstruction.md`](./historical-reconstruction.md) covers the four things a release
bundle alone did not give a saved card: the retained catalog release its product and role identity
comes from, the reviewed product families a card may name, the split between snapshot integrity and
semantic content, and `npm run ip-cards:release:check-base` — the append-only publication check that
closes the one hole in-tree validation cannot see, where a definition and its frozen hash are
updated in the same commit.
