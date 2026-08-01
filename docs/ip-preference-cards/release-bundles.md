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

**Retaining a superseded _recipe_ version works today**: compositions are keyed by
`recipeVersionId`, and adding a second seed entry for a procedure retains both. **Retaining a
superseded _module_ version does not yet** — the build's "every module is referenced by some
composition" rule rejects it. Named in [`dependency-closure.md`](./dependency-closure.md).

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
