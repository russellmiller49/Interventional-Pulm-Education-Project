# Immutable card revisions, and read-only reconciliation

Phase 4A.1 made a saved card's dependencies immutable: a release bundle pins the authored
definitions by content hash, a retained catalog release pins product and role identity, and a
reviewed family version pins a product line's membership. See
[`historical-reconstruction.md`](./historical-reconstruction.md).

What a card resolves _through_ is therefore frozen. The card itself is not. This phase closes
two things that follow from that, and deliberately closes nothing else.

| Open item                                   | Closed by                                           |
| ------------------------------------------- | --------------------------------------------------- |
| A saved card state is not addressable       | Append-only revisions, written by the database      |
| Nothing shows an owner what has moved since | A read-only review with two independent comparisons |

---

## 1. Why revisions come before any rebuild

A card id names a moving target. The owner edits a card in place — that is the design, and
[`saved-card-editing.md`](./saved-card-editing.md) explains why the id, the share token, and the
creation date all survive an edit.

So "this was built from card X, as the physician reviewed it" is not a statement a card id can
carry. The card can be edited a minute later and the reference then points at something nobody
read. Any future rebuild has to cite:

- the exact source card id
- the exact source **revision** id
- the exact source release
- the exact builder inputs
- the exact immutable snapshot hashes

None of that is available until ordinary edits become append-only revisions. Which is why this
phase is revisions **and** review, and why it stops there: there is nothing yet to point at a
revision, and building the rebuild first would have meant pointing it at a card id.

## 2. The revision model

`ip_user_preference_card_revisions` — one row per state the card has ever been saved in.

```
id · card_id · user_id · revision_number
title · physician_name · status
builder_inputs · card_snapshot
snapshot_hash · snapshot_integrity_hash · resolved_content_hash
engine_version · release_bundle_id · catalog_release_id
created_at · created_by
```

### Written by the database, not by application code

An `after insert or update` trigger on the cards table appends the revision. Two properties
follow from putting it there and nowhere else, and neither is available to a writer in
TypeScript:

- **Atomic.** The card row and its revision are one statement. There is no window in which a
  card has been saved and its revision has not, and no failure mode where an edit succeeds and
  its history quietly does not.
- **Unforgettable.** `saveUserCard`, `renameUserCard`, and `duplicateUserCard` all reach the
  cards table by different paths. A future fourth writer gets revisions without knowing the
  table exists.

The trigger runs `security invoker`, so row-level security stays the single authority on who may
write what. A `security definer` trigger here would quietly have become a second one.

### What counts as a new state

The trigger compares the eight content columns — title, physician name, status, builder inputs,
snapshot, snapshot hash, engine version, catalog import id — and appends only when one differs.

- **A save appends.** Obviously.
- **A rename appends.** The title and the physician are printed on the card and are covered by
  `printDocumentHash`. A renamed card is a different document even though it says the same
  clinical thing — and the revision list shows exactly that: an unchanged `resolvedContentHash`
  beside a moved `printDocumentHash`.
- **A share toggle does not.** It bumps `updated_at` and changes nothing this table records. A
  revision for it would be an identical row claiming something happened.

The one consequence worth stating plainly: because a share toggle moves `updated_at` and
`printDocumentHash` covers the printed "updated" value, the live card's document hash can differ
from the latest revision's without any state having changed. That is the hash doing its job —
the printed page did change — rather than a gap in the history.

### Append-only, three times over

No update policy, no update grant, and a `before update` trigger that raises. The third exists
because it is the one that still holds if a future migration widens either of the first two.
Service role gets `select, insert` and no more: an append-only table that one role may rewrite is
append-only for everyone not holding that key.

There is deliberately **no** delete trigger. A foreign-key cascade is a referential action rather
than a statement, so a trigger raising on delete would make deleting a _card_ fail. The cascade
is the single delete path: revisions are append-only relative to the card's own lifetime, and an
owner deleting their own card takes its history with it. A revision outliving the document its
owner asked to be rid of would be the wrong default for a personal card.

### Numbering

`revision_number` is dense and monotonic per card, assigned by a `before insert` trigger reading
`max() + 1`. That read is racy on its own; the unique index on `(card_id, revision_number)` is
what makes it safe. Two concurrent saves both read 2, both try to write 3, and one insert fails.
A failed save is recoverable. Two rows both calling themselves revision 3 are not.

### `printDocumentHash` is derived, not stored

The revision stores the integrity hash and the four printed fields; the document hash is computed
on read by the same `printDocumentHash()` the card header calls. Storing it would create a value
that could disagree with its own inputs, and would need a second implementation of a
canonical-JSON hash inside PL/pgSQL.

`created_at` serves as both "when this state came to be" and the `updatedAt` the document hash
covers, because they are the same fact. One column, so they cannot drift.

### The backfill

Existing cards get one revision recording the state they were in when the migration ran, with
`created_at` set to the card's own `updated_at`. That is **not their history** — nothing captured
it, and manufacturing one would be inventing states the physician never saved. It is the honest
floor: revision 1 of a pre-existing card is where recording started.

---

## 3. Reconciliation: two questions, answered separately

`/[locale]/preference-cards/[cardId]/reconcile`. A read route in the strictest sense — no form,
no server action, no submit control, and a test that asserts the rendered page contains none of
them.

### Operational: what today's hospital-local data does

Re-resolve the card's own builder inputs and diff the result against the stored snapshot.

Everything authored is held fixed by `rebuildBuilderContext`: the release bundle, every module
version, the modifier set, the rescue modules, the compatibility rules, the role table, and the
retained catalog release. What is read as _current_ is what has always been read as current and
is meant to be — what the room stocks, how the site ranks it, what the location can do. So the
delta is caused by those and by nothing else.

That claim is checkable rather than merely stated. The delta carries
`otherChangedProjectionKeys`, a generic comparison of every projection field the item, warning,
and readiness lists do not already account for — release identity, recipe version, module
manifest, scope, modifiers. It is asserted empty. A field added to the projection later cannot
slip past it.

**It re-resolves through `resolveForSave`**, the same path the builder and the save path use.
That is the point rather than a convenience: the review is only worth reading if it predicts what
re-saving would actually produce, and a second review-only reconstruction would be a second
answer to that question — disagreeing exactly where it mattered.

### Release: pinned versus current

`resolveReleaseDefinitions` on both sides, then `diffReleaseBundles` — the same requirement-level
diff `npm run ip-cards:releases` prints for a reviewer. Both sides verify every pin first, so a
release whose definitions have moved is reported rather than compared; a diff against mutated
content would describe neither release.

"Current" is the explicit pointer. No version sorting, no newest `publishedAt`, no last entry.

**The card is never resolved against the newer release.** That would be a rebuild — it would
require deciding what each selection means under definitions the physician has not reviewed — and
it is out of scope by construction rather than by discipline: nothing in `reconcile-card.ts`
builds a context from the current release.

Each requirement change is annotated with what it means for this card: whether the card carries a
line with that requirement key, whether that line is active or kit-suppressed, and whether it
holds a selection. Matched on `requirementKey` and on nothing else — the reviewed semantic
identity, where two slots are the same requirement only when a reviewed mapping file says so.
Role-code equality is never sufficient, and `card-reconciliation.test.ts` pins that a role code
passed as a requirement key matches nothing.

A requirement the newer release _adds_ is reported as absent from the card and mapped onto
nothing.

### The two halves are independent

Either can be unavailable while the other is fine, and they are computed and reported separately
because of it. A version-3 card whose product line is named by a catalogue-browsing key can never
be re-resolved — and its release compares perfectly well. Folding them together would hide the
answer that exists behind the one that does not.

| Card                                | Operational                         | Release                             |
| ----------------------------------- | ----------------------------------- | ----------------------------------- |
| Current, release-pinned             | compared                            | compared                            |
| Version 2 (superseded)              | `builder_inputs_not_release_pinned` | same code, same reason              |
| Version 3 with a legacy family pick | `legacy_family_identity`            | **compared**                        |
| Pinned release no longer retained   | `release_unknown`                   | `release_unknown`                   |
| Builder inputs will not parse       | `builder_inputs_unavailable`        | `builder_inputs_not_release_pinned` |

The review is offered on every card, including ones the builder will not reopen. Reviewing what
has moved underneath a card is not editing it.

---

## 4. One definition of "different"

The diff imports `resolvedContentProjection` and `projectResolvedItem` from `card-hashes.ts`
rather than deriving its own comparison. The projection is already the module's documented answer
to what counts as a difference — it excludes rule-trace prose, warning message text, display names
where a stable id exists, and `generatedAt`, each with a recorded reason.

The property that follows, and which the suite pins: **a delta is `identical` exactly when the two
states hash to the same `resolvedContentHash`.** Two answers would drift, and the drift would
surface as a review reporting no changes on a card whose content hash had moved.

Exporting `projectResolvedItem` moved `resolverImplementationHash`, which is exactly the behaviour
[`release-bundles.md`](./release-bundles.md) describes: the digest moves on any source edit
including a pure refactor, which is precisely why it is provenance rather than the support
boundary. `npm run ip-cards:releases` was re-run; only `resolver-release.json` changed, and
`npm run ip-cards:release:check-base` reports all 54 published entries unchanged.

---

## 5. What this phase does not do

No card upgrade, no "rebuild using current release", no carry-forward of selections, no mapping
decisions, no new card from an old one, no automatic migration, no in-place release change, no
version-2 editing, no legacy-family guessing, no new clinical content, no new family membership,
no fuzzy matching, no matching by role code alone, no automatic waiver transfer.

Reconciliation reads and reports. The saved card, its snapshot, and every revision are unchanged
by it — asserted as a fact about the code (`tables.writes` records every mutating statement and is
checked to be empty) rather than as an intention in a comment.

## Commands

```bash
npx jest src/features/preference-cards 'src/app/.*preference-cards' --runInBand
```

```bash
npm run ip-cards:release:check-base
```
