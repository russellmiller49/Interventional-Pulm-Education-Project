# Reviewed rebuild, as a new card

Phase 4B.1 made a saved card state addressable and showed an owner what had moved underneath it. It
stopped there deliberately — see
[`card-revisions-and-reconciliation.md`](./card-revisions-and-reconciliation.md) — because reviewing
a change and acting on one are different decisions, and the second needed the first to have
something to cite.

This phase is the acting. It creates a **new** card from one exact immutable revision, on the
release the procedure's pointer names today, after a physician has answered every changed or
unresolved decision one at a time.

| Open item                                               | Closed by                                    |
| ------------------------------------------------------- | -------------------------------------------- |
| Nothing could move a card onto a newer release          | A new card, built from a cited revision      |
| A version-2 card was view-only with no way forward      | A rebuild that produces version-4 inputs     |
| "This was reviewed" was a claim the interface made once | Structured provenance, written with the card |

---

## 1. What a rebuild is not

It is not an upgrade. There is no statement anywhere in `rebuild-card.ts` that writes to the source
card, and the suite asserts the source row and every revision it already had are byte-identical
after a rebuild completes. The original keeps its id, its release pin, its snapshot, its share
token, its history, and its status.

That is why the review is a **gate** rather than a summary. A workflow that carried everything and
showed a report afterwards would be an automatic migration with a receipt.

| Shortcut                                      | Fails when                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Re-resolve the card against the newer release | A requirement's definition moved, and nobody decided what the old selection means under it |
| Carry by slot id                              | The module was republished; every key changes and the selections silently vanish           |
| Carry by role code                            | The same role legitimately appears twice on a card                                         |
| Carry by label resemblance                    | Always. That is not a comparison                                                           |
| Take the newest release as the target         | `CHARLIE` is the highest version, the newest publication, and not current                  |
| One "accept all clinical changes" control     | The record it leaves is indistinguishable from a rebuild nobody read                       |

## 2. The requirement key is the only join

A card's selections are addressed by **composed slot id**. `selectedHospitalItemIds` and
`conditionalStates` are keyed by it, and a waiver is keyed by a warning id built out of it
(`unresolved-required-<slotId>`). A slot id is authored inside a module version, so republishing the
module, moving a requirement into a shared core, or renaming a slot changes every one of those keys
while the requirement the physician chose for is unchanged.

`requirementKey` is the reviewed semantic identity — two slots are the same requirement only when a
reviewed mapping file says so — and it is what the plan joins on. Everything carried is re-keyed
from the source's slot id, through the requirement key, onto the target's slot id.

### The composition is not the requirement set

Both sides are expanded through `effectiveSlots`, which is the composition **plus** whatever the
selected modifiers add — `add_slot` payloads and the slots of any rescue module an
`add_rescue_module` action pulls in. Using the composition alone was a real defect: `HIGH_BLEED_RISK`
adds the major-airway-bleeding rescue module, so a card selecting it carries those requirements on
its snapshot and not in `expandRecipeComposition`. The plan reported each as _removed by the target
release_ and carried none of their selections, while the modifier itself carried perfectly well and
the new card promptly re-added the same requirements, empty.

`remove_slot` and `replace_role` are deliberately not applied. A requirement a modifier would remove
stays in the effective set and its selection is carried, which is the safe direction — a carried key
for a slot the resolved card does not contain is simply never read, whereas dropping a selection for
a requirement that turns out to be present loses a decision. `resolveCard` remains the authority on
what the card actually contains.

`card-rebuild-plan.test.ts` pins the consequence: a card whose requirement key is absent from both
releases matches nothing, and the target's own requirements are reported as **added** rather than
quietly adopting it, even though both lines carry the same role code.

### Two sources, because they answer two questions

_What was chosen_ comes from the revision's stored snapshot — what the physician actually saw
resolved, including lines a modifier or rescue module added, lines a kit suppressed, and
requirements an older card left to the formulary's ranking rather than recording. Reading the raw
input map instead would carry a sparse record forward and let today's ranking fill the gaps, which
is the implicit behaviour [`saved-card-editing.md`](./saved-card-editing.md) describes removing.

_What the requirement is_ comes from the expanded composition on both sides, because a resolved item
does not carry `allowCustom`, `selectionMode`, `responsibleRole`, `sterileStatus`, or the unformatted
quantity expression — and four of those five decide whether a selection is still allowed.

### One definition of "different"

`changedDefinitionFields` compares the fifteen fields in `REQUIREMENT_COMPARED_FIELDS`, imported from
`release-bundle.ts` rather than restated. That list is already the module's answer to what makes two
requirements different — it is what `npm run ip-cards:releases` prints for a reviewer before
publication. A second list here would drift, and the drift would surface as a rebuild carrying a
selection forward unchanged on a requirement the release diff had already reported as changed.

`release-bundle.ts` is deliberately outside `RESOLVER_SOURCE_FILES`, so exporting from it does not
move `resolverImplementationHash` and no release artifact needs rebuilding.

## 3. The seven outcomes

Every decision — about a requirement, a module, a modifier, or a waiver — lands in one of seven
states. One vocabulary rather than one per kind: for a module, `new_requirement` means "the target
introduces this and the source had no counterpart", which is the same fact about a different thing.

| State                     | What the physician sees                      | What the system refuses to guess                            |
| ------------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| `carried_unchanged`       | Listed, no question asked                    | Nothing to guess: key, definition, and identity all held    |
| `carried_requires_review` | A suggestion, and confirm-or-drop            | Whether a moved definition still means what was chosen      |
| `not_carried`             | Reported, with the reason it could not cross | A substitute for a product that is gone                     |
| `new_requirement`         | Reported as added and unresolved             | A default selection — none is authored, so none is invented |
| `removed_requirement`     | Reported, with what was selected for it      | Which target requirement it "really" became                 |
| `unresolved`              | Reported                                     | A selection for a line that resolves to nothing             |
| `incompatible`            | Reported, and blocks the rebuild outright    | Which of two slots claiming one requirement key was meant   |

### Ambiguity blocks; it does not choose

If either side expresses one `requirementKey` through two slots that disagree, `slotIndex` records
the key as ambiguous and the decision is `incompatible`, `blocking`, and **unanswerable** — no
acknowledgement disposes of it, and `createRebuiltCard` refuses with `plan_blocked` before the review
gate runs. Taking the first of two slots would mean carrying a physician's selection onto whichever
sorted first: a guess wearing the costume of a match.

`expandRecipeComposition` already collapses or blocks duplicate keys, so on today's data the
ambiguous set is always empty. It is computed anyway because this is the only place a key becomes a
single slot, and because a modifier-added or rescue-module requirement reaches the effective slot
list _without_ passing through that merge — which is exactly the route by which a duplicate could
arrive.

An added **required** requirement is `blocking`: the card cannot ask for it, and the review says so
rather than filling it in. No default is materialized for it, because a default here would come from
the local formulary's current ranking — choosing a product on the physician's behalf and calling it
carried.

### Per selection kind

| Kind                | Carries only when                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| Exact hospital item | Current hospital-local data still offers that exact item id for the target's role                   |
| Catalogue product   | The target release's retained catalogue maps that exact product id to the target role               |
| Reviewed family     | The family version resolves, is approved, serves the role, and matches the target catalogue release |
| Custom line         | The requirement persists and `allowCustom` is still true — and always requires review               |
| Equipment set       | The set still covers the target requirement's role                                                  |
| Modifier            | The target offers the code **and** its definition hash is byte-identical                            |
| Module              | Matched by code; a moved version is reported, never silently accepted                               |
| Conditional state   | The `dependencyRule` it was answered against is unchanged; otherwise reset to undecided             |
| Waiver              | Never                                                                                               |

A reviewed family whose membership has moved is a special case worth naming: it carries as a
suggestion, and the carried pin is **re-pinned to the membership that is true now**. Writing the
source's hash onto a card resolved through a different catalogue release would produce a card that
refuses to reopen the moment it is saved, because every reconstruction verifies the pin exactly — the
physician would have confirmed a change and been handed a card denying the change happened.

Modifiers are compared per code, not per set. A release pins the whole modifier set with one hash,
which cannot say which modifier moved; attributing a set change to every carried modifier would put
every one on the review list for one edit, and attributing it to none would carry a changed modifier
silently. So each definition is hashed on its own, through the same canonical set hash.

### Why a waiver never carries

A waiver records that a named person accepted a named risk under a named set of definitions. Under a
different release those are not the same definitions, so the acceptance is not the same acceptance
even where the warning code matches. The plan carries the prior rationale as reference text and
names the target warning identity a new waiver would be keyed to — which is a different id, because
a warning id is built from the composed slot id.

## 4. The review gate

The new card cannot be created until every decision with `requiresExplicitConfirmation` has an
answer, every answer is one that decision's state allows, and no answer names a decision the plan
does not contain. That last one matters: a stale review page whose plan has moved underneath it
fails loudly rather than silently applying yesterday's answers to today's decisions.

Three answers, and deliberately no fourth that means "all of the above":

- `confirmed` — carry the suggestion exactly as proposed.
- `dropped` — do not carry it. Offered on requirements and on nothing else.
- `acknowledged_unresolved` — the new card will not have this, and that has been read.

`dropped` is a requirement-only answer because a requirement's selection is the only thing an answer
can actually change. Turning a module off changes which requirements exist, which changes the plan —
so the composition is an _input_ to planning, and offering it as an answer would be offering a
control that quietly did nothing. The composition of the new draft is changed in the builder, where
changing a composition is what the interface is for.

**The rebuild deliberately hosts no product picker.** A blocking requirement is acknowledged, not
filled in, and the new draft opens in the builder to be completed. Duplicating the selection UI here
would create a second path to making a selection, and the one place the two disagreed would be the
place it mattered.

### Acknowledgement is not resolution, and what that costs

Confirming a decision records that a physician read it. It chooses nothing. A requirement whose
selection could not be carried arrives on the new card with `selectedHospitalItemId: null`, and the
resolver reports it — so the card is never silently complete.

The honest limitation, pinned by `card-rebuild.test.ts` so it cannot drift: `resolve-card.ts`
deliberately raises `required_role_unresolved` at **warning** severity rather than blocking, because
many roles have no catalogued product and are met by a custom line, and blocking would make most
procedures unbuildable. A rebuilt card with an unresolved required requirement is therefore
`complete_with_warnings`, **not** `blocked`. It is never `complete`.

There is also **no hard finalization gate** anywhere in this module: `saveCardRequestSchema` accepts
`status: 'final'` without consulting readiness. A physician can mark such a card final in the builder.
The rebuild does not compensate for that by growing a picker — it always creates a `draft`, records
what was unresolved in provenance, and leaves the gate question where it already lives. Closing it is
a separate change to the save path, for every card, not a special case for rebuilt ones.

An `acknowledged_unresolved` answer writes no selection anywhere, and
`applyRebuildAcknowledgements` has no branch that could: only `dropped` touches
`selectedHospitalItemIds`, and only ever to `null`.

## 5. Determinism, and what the hash is for

`planCardRebuild` is pure and total: no clock, no database, no module singleton. Everything it cannot
answer from domain data — whether the room still stocks an item, whether a product is in the
retained catalogue, whether a family pin still resolves — arrives through a `RebuildProbe` the server
implements and a test supplies directly.

So the same source revision, target release, composition, and probe answers produce byte-identical
output, and `rebuildPlanHash` addresses it. On save the server **recomputes the plan** and compares:
a request whose hash does not match is refused, because its answers describe decisions this rebuild
would not make. The hash covers `proposedInputs` as well as the decisions — a hash that covered the
reasoning but not its result would leave the one thing that gets written outside it — and it is taken
over the canonical structured plan, never over rendered prose, which is localized.

Proved in `card-rebuild-plan.test.ts` (37 tests) and `card-rebuild.test.ts` (22 tests): identical
inputs hash identically, a moved probe answer moves the hash, a tampered `proposedInputs` moves the
hash, and a submitted hash that does not match is refused with `plan_moved` and writes nothing.

## 6. What the new card is

A create, not a copy. `createRebuiltCard` names no id, no share token, no `share_enabled`, and no
timestamps, so every one comes from a column default: the new card gets its own identity, sharing
switched off, and its own revision 1 from the append trigger. Status is `draft`. Builder inputs are
schema version 4, pinned to the target release, with `selectionsAreExplicit` set — so a re-ranked
formulary can never fill a gap on a card whose whole purpose is that every changed choice was
reviewed.

`duplicateUserCard` is not the model. It copies `card_snapshot` verbatim without re-resolving, which
is precisely what a rebuild must not do.

### Provenance

`ip_user_preference_cards.rebuild_provenance` is a nullable jsonb column, set in the same statement
that creates the card and never again. It names the source card and revision, both releases and
their definition hashes, the four source hashes, the hashes of the two reconciliation comparisons and
of the mapping plan, and one entry per decision with the answer it actually got.

It is **write-once**, enforced by a `before update` trigger that refuses any change including
null → value, so a card that was not created by a rebuild cannot be given a rebuild's provenance
later. It is deliberately **not** revision-bearing and deliberately **not** mirrored into the
revision table: the value can never change, and revisions cannot outlive their card, so reading it
from the card is reading the value that was true at every revision. See the migration file for the
alternative that was rejected — replacing the applied append trigger to copy a constant into a
nineteenth column.

## 7. Failure is visible, never silent

| Situation                                              | Result                                   |
| ------------------------------------------------------ | ---------------------------------------- |
| Revision belongs to another owner, or does not exist   | `not_found` → 404, indistinguishable     |
| Revision id belongs to a different card                | `not_found` → 404                        |
| Stored snapshot no longer verifies                     | `revision_snapshot_unverifiable`         |
| Version-2 inputs, or no release pin                    | `superseded_builder_inputs`              |
| Product line named by a catalogue-browsing key         | `legacy_family_identity`                 |
| No pointer for the procedure                           | `no_current_release`                     |
| Already pinned to the release the pointer names        | `already_on_current_release`             |
| Pointer names a draft or retired release               | `target_release_not_selectable`          |
| Either release's definitions cannot be reconstructed   | `source_` / `target_release_unavailable` |
| Target's catalogue release no longer retained          | `target_catalog_unavailable`             |
| Requested module or modifier the target does not offer | `module_` / `modifier_not_offered`       |
| Submitted plan hash does not match the recomputed one  | `plan_moved`, nothing written            |
| A decision needing an answer did not get one           | `review_incomplete`, nothing written     |

Every one leaves the source card fully usable. The route renders an explanation rather than an error,
because a card that cannot be rebuilt is not a broken card.

## 8. Where the control lives

`CardRowActions`, beside edit and duplicate — and **not** on the reconciliation page, which lists
every revision and would be the natural home. That page is read-only by construction and
`reconcile/page.test.tsx` asserts it renders no form, no button, and exactly one link. Growing a
rebuild control there would retire a guarantee that is currently expressed as markup, so the entry
point cites the card's current revision instead and the reconciliation page stays exactly as it was.

## 9. What this phase does not do

No in-place upgrade, no automatic migration, no version-2 conversion, no re-resolution of the source
card, no carry-forward of a waiver, no product picker, no substitution of a preferred product for one
that is gone, no matching by role code or label, no recommendation from patient characteristics, no
new clinical recipe content, no product-family approval, no new release, no advancing of any release
pointer, no marking of the source card as superseded, and no change to the reconciliation page.

## Migration status

`supabase/migrations/20260804013000_add_ip_preference_card_rebuild_provenance.sql` **has not been
applied.** The rebuild write path inserts `rebuild_provenance`, so creating a rebuilt card fails
against the live database until it is applied — every other path, including the whole review, works
without it.

It is **the only pending database migration on this branch.** Both Phase 4B.1 migrations are already
deployed — the revision schema as remote version `20260803113527_add_ip_preference_card_revisions`,
and the foreign-key indexes as `20260804015322_index_ip_preference_card_revision_foreign_keys` — and
neither file is editable from here.

Apply it through the Supabase MCP migration action **from the primary checkout**, never
`supabase db push`, because this project's local and remote migration histories have diverged. The
rollback rehearsal is not optional and comes first:
`supabase/verification/20260804013000_verify_ip_preference_card_rebuild_provenance.sql` reads only,
wraps itself in `begin`/`rollback`, and proves the write-once rule _behaviourally_ — it creates a
rebuilt card and an ordinary one, attempts all three forbidden provenance updates, requires every one
to fail, and then requires an ordinary rename to still apply. A trigger that exists and a trigger
that fires are different facts, and only the second is the guarantee.

## Commands

```bash
npx jest src/features/preference-cards 'src/app/.*preference-cards' --runInBand
```

```bash
npm run ip-cards:release:check-base
```
