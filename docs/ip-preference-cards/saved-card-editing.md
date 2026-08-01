# Reopening a saved preference card

How a card owner edits a card they already saved, and why almost every rule here is about
refusing to guess.

A saved card is two separate things that must not be confused:

- **`card_snapshot`** — the immutable, content-addressed record of what was resolved and
  printed. It is evidence. It is never edited, never recomputed, and never used as builder
  state.
- **`builder_inputs`** — the physician's own selections, as identifiers. This is the only
  thing the builder reopens from.

Everything below follows from keeping those apart.

## Create versus edit

|                | Create                                      | Edit                                             |
| -------------- | ------------------------------------------- | ------------------------------------------------ |
| Route          | `/[locale]/preference-cards/new?scenario=…` | `/[locale]/preference-cards/[cardId]/edit`       |
| Wizard prop    | `mode="create"` (default)                   | `mode="edit"` + `initialState`                   |
| Procedure step | picker over every scenario                  | read-only panel naming the pinned recipe version |
| Primary action | _Generate immutable draft snapshot_         | _Save changes_, disabled until something changes |
| On save        | `INSERT`, new id, new share token           | `UPDATE` this row, id and share token unchanged  |
| Leaves behind  | a new card                                  | the same card, with a new snapshot               |

Edit and duplicate are deliberately distinct. Duplicate creates a separate card with its own
id and its own sharing state; edit rewrites this one.

## The edit route

`src/app/[locale]/preference-cards/[cardId]/edit/page.tsx`:

1. Validate `cardId` with `cardIdSchema`. A malformed id is a 404.
2. `loadEditableUserCard(cardId)` — reads through the signed-in Supabase client, so RLS
   decides visibility.
3. `not_found` → `notFound()`. **A card belonging to someone else and a card that does not
   exist get the same answer**, so an id cannot be probed for existence, an owner, or a title.
4. Any other failure renders an explanation and a link back to the card. It is not an error
   page: the card is intact, it simply cannot be reopened.
5. Success renders the wizard in edit mode against the pinned recipe's context.

Only the pinned scenario is serialized to the client; the procedure picker is not rendered in
edit mode, so its fifteen definitions are not shipped either.

## Server-side reconstruction, shared with save

`server/rebuild-builder-context.ts` is the single reconstruction path. It takes validated
`BuilderInputs` and returns the scenario, the pinned build context, the context with every
pick folded in, and the rebuilt picks/sets — or a typed failure.

Both callers use it:

- `loadEditableUserCard` — to open the builder.
- `resolveForSave` — to re-resolve on save.

One path, because two would be two chances for the card a physician _sees_ while editing to
differ from the card that gets stored, and a preview that disagrees with saved output is the
failure this module exists to prevent. `saved-card-editing.test.ts` asserts the reopened
preview hashes identically to a fresh reconstruction.

Nothing in it trusts the caller for content. Builder inputs carry identifiers only, and each
one is looked up in the authoritative catalog and the pinned composition:

| Failure                                                 | Code                         |
| ------------------------------------------------------- | ---------------------------- |
| Scenario no longer published                            | `unknown_scenario`           |
| Pinned recipe version no longer published               | `recipe_version_unavailable` |
| Pinned module version missing from generated data       | `recipe_module_unavailable`  |
| Stored scenario and recipe disagree                     | `scenario_recipe_mismatch`   |
| A module the composition does not offer                 | `module_not_offered`         |
| Product unknown, unmapped to its role, or not slottable | `catalog_pick_unavailable`   |
| Product line gone                                       | `product_family_unavailable` |
| An equipment-set member fails any of the above          | `equipment_set_unavailable`  |

## Exact-version reopening

A card reopens against the definitions it was built from, never "what this procedure means
today". Version-3 cards resolve through a **release bundle**, which pins the whole authored
dependency set by content hash — the composition, every module version, the modifier set, the
rescue modules, the typed compatibility rules, and the role alias table. Version-2 cards
resolve through `buildPinnedContext(scenarioId, recipeVersionId)`, which is exact about the
recipe and the modules and unpinned below them. See
[`release-bundles.md`](./release-bundles.md).

- Module versions are exact. `module-flex-bronch-core-v1-0` is looked up by that id; there is
  no lookup by code, and therefore no "latest module" anywhere in the edit or save path.
- A pin that does not resolve is reported, not substituted.
- A pin whose definitions have been **edited since publication** is also reported. This is the
  one a version id alone could never catch: the name still resolves, and the content behind it
  is not what the physician reviewed.
- Publishing a new release, or changing which modules are default-on, moves nothing about a
  saved card.

| Failure                                                  | Code                                                   |
| -------------------------------------------------------- | ------------------------------------------------------ |
| Pinned release no longer retained                        | `release_unknown`                                      |
| A definition the release pins is gone                    | `release_pin_missing`                                  |
| A definition the release pins has changed                | `release_definition_mutated`                           |
| The card's scenario or recipe disagrees with the release | `release_scenario_mismatch`, `release_recipe_mismatch` |

**Versioning policy.** A change that alters what a card resolves to must publish a new release
and retain the previous one. Until it is retained, the older pin fails and its card becomes
view-only — the safe direction to fail, and visible rather than silent. The build enforces
retention: dropping a release that another supersedes, or a composition a release pins, fails.

## What the builder restores

Everything persisted, or the card does not open. A selection that cannot be reconstructed
produces a blocking explanation rather than an apparently-valid card that quietly lost
something.

| Restored                       | From                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Selected module versions       | `input.selectedModuleVersionIds`, verbatim                                                            |
| Modifiers                      | `input.modifierCodes` — **not** the scenario defaults, or a deselected modifier would silently return |
| Conditional decisions          | `input.conditionalStates`                                                                             |
| Hospital-item selections       | `input.selectedHospitalItemIds`                                                                       |
| Waivers                        | `input.waivers`                                                                                       |
| Catalog picks                  | `catalogPicks` refs → full `CatalogPick` records, server-rebuilt                                      |
| Product-line picks             | `familyPicks` refs → full `FamilyPick` records, server-rebuilt                                        |
| Custom lines                   | `customItems`, verbatim (they carry no catalog identity to rebuild)                                   |
| Equipment sets and their roles | `equipmentSets`, server-revalidated                                                                   |
| Title, physician, draft/final  | the card's own columns                                                                                |

## What edit mode will not let you do

- Remove a required module — required modules render locked, and `expandRecipeComposition`
  includes them regardless of what a request asks for.
- Select a module the pinned composition does not offer — rejected server-side before
  resolution.
- Change the procedure. The picker is replaced by a read-only panel. A saved card's procedure
  is its identity; switching it would keep the id, the share link, and the history while
  replacing everything the card says. Create or duplicate instead.
- Move to a newer recipe or module version. See above.

## Equipment sets

Reusable sets live in `localStorage`. A saved card carries **its own copy** of every set it
used, and that copy is what an edit session uses.

- The card's copy wins for the ids it pinned, so a card does not change because a
  similarly-named browser set has changed since.
- The physician's other reusable sets are still offered, so they can add one.
- Nothing writes the card's copy back to `localStorage` — an older copy must never overwrite a
  newer set the physician owns.
- Every member and role is revalidated against the catalog server-side; the browser's copy is
  never the authority.
- `selectedRoleCode` is restored per set. Without it, `withEquipmentSets` would fall back to
  the first covered role and bind the kit to the wrong requirement.
- Role codes on a set's `additionalCoveredRoles` and `selectedRoleCode` are canonicalized on
  the way in, along with a custom line's `roleCode`. Aliases are permanent (taxonomy v2
  renamed eight roles) and a stored card can still name the old code; without this the line
  simply would not match its requirement and would vanish from a reopened card.

A card whose set is absent from this browser reopens correctly. That is the point.

**Which sets get saved** is decided by what the previewed card actually resolved to — the
`set:` ids appearing in its items — not by a role binding. Both alternatives are wrong in a
way that diverges preview from stored output: `withEquipmentSets` offers _every_ known set on
every role it covers and a requirement with no explicit selection takes its first option, so a
tray that merely exists in this browser can satisfy a line in the preview; and a role binding
is never cleared when the physician picks something else, so a set they moved away from would
be stored anyway and go on suppressing the requirements it covers.

## Builder-input schema versioning

`builder_inputs.schemaVersion` distinguishes persisted formats so a future migration does not
have to infer one from which fields happen to be present.

- **1 — pre-composition (flat).** Recorded no module selection, because there were no modules.
  Never written with an explicit version and **never converted**: reconstructing one means
  choosing modules on the physician's behalf. These fail `builderInputsSchema` on
  `selectedModuleVersionIds` alone — the version field is not what excludes them.
- **2 — composed.** Carries exact module versions and every pick as an identifier. Still read,
  still re-saved as version 2.
- **3 — release-pinned.** Current. Adds `releaseBundleId`: the whole authored dependency set,
  hashed.

Absent normalizes to **2, not to the current version**: the only writer that ever omitted it is
the composition work that introduced module selections, so an input satisfying the schema
without naming a version is a version-2 input by construction. An input declaring any _other_
version is rejected rather than coerced. Parsing and normalization are server-side only.

**No version is upgraded in place.** A version-2 card that is edited and saved is written back
as version 2. Stamping the current release onto it would move a saved card to a release its
author never selected — an automatic migration this phase deliberately does not perform, and a
silent one, since nothing on the card would say the pin was the system's choice rather than the
physician's. The schema enforces the pairing in both directions: a version-3 input without a
pin is rejected, and so is a version-2 input carrying one it could not have had.

A version-2 card's recipe and module pins are exact. What it does **not** pin — the modifier
set, rescue modules, compatibility rules, role aliases — is a stated limitation of those cards
rather than a defect introduced by version 3; nothing pinned them when they were written. See
[`dependency-closure.md`](./dependency-closure.md).

## Legacy and non-editable cards

A card whose builder inputs will not parse is not a broken card.

- It views, prints, shares, renames, duplicates, and deletes exactly as before.
- Its snapshot and hash are untouched. Viewing it writes nothing.
- The edit control is not offered — `UserCardSummary.editable` gates it — so it never appears
  and then fails.
- The explanation says what happened without implying fault: _"This card was created with an
  earlier builder version and cannot be reopened for editing. Its saved snapshot remains
  available to view, print, share, duplicate, and retain for reference."_
- Duplicating one produces another legacy card. Duplication does not make a card editable.

There is no automatic migration in this phase, and adding one would mean inventing selections.

## Save-in-place semantics

`saveUserCard` branches on `cardId`. The update patch contains title, physician name,
procedure code, scenario id, status, builder inputs, snapshot, snapshot hash, engine version,
and catalog import id.

Deliberately **absent** from the patch: `user_id`, `share_token`, `share_enabled`,
`created_at`. A share link handed to a colleague must keep working across an edit, and must
not start working because of one. `updated_at` moves — the table's own trigger does that.

The snapshot hash addresses resolved content and excludes `generatedAt`, so a metadata-only
edit stores the same hash. Hash churn would make a rename look like a clinical change.

## Unsaved changes

The wizard fingerprints the exact request it would send, canonicalizing the collections that
are conceptually sets, so toggling a modifier off and on again does not read as a change.
_Save changes_ is disabled until the fingerprint differs, a `beforeunload` guard is installed
while it does, and the guard is cleared before navigating away on a successful save. That is
the whole mechanism; a navigation framework for one feature would be worse than the problem.

## Security

- Owner-only, through the signed-in Supabase client. RLS is the authority; `user-cards.ts`
  contains no ownership check of its own, and the tests emulate RLS rather than stubbing one.
- No service-role key in browser code, and no patient identifiers anywhere.
- Share tokens stay read-only: the shared view has no edit control, and being able to see a
  shared card never confers the ability to edit it.
- Every client-submitted product id, role, module id, and set member is revalidated
  server-side. A resolved card is never accepted from the client.
- A foreign card id reveals nothing — same 404 as an unknown id.
