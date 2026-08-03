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
title · physician_name · status · procedure_code · scenario_id
builder_inputs · card_snapshot
snapshot_hash · snapshot_integrity_hash · resolved_content_hash
engine_version · release_bundle_id · catalog_release_id
created_at · created_by
```

`procedure_code` and `scenario_id` are there even though edit mode cannot change either — the
picker is a read-only panel. The revision is meant to be the complete row state, so a reader
reconstructing one does not have to assume a rule that held when it was written still holds, and a
future writer that did change the procedure could not produce a revision that failed to say so.

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
- **A share toggle does not.** It changes nothing this table records. A revision for it would be
  an identical row claiming something happened.

That last one only works because `updated_at` was made to mean something narrower — see below.
Under the generic `set_site_updated_at`, sharing a card moved its timestamp, which is printed on
the card and covered by `printDocumentHash`; the live document hash would then have differed from
the latest revision's with no state having changed. The card table now carries its own content
timestamp trigger instead, so the two agree and there is no caveat to remember.

### `updated_at` is a content version

`ip_set_preference_card_content_updated_at` moves the timestamp only when revision-bearing content
changes, and leaves it exactly where it was for an access-control-only update. `set_site_updated_at`
is shared by a dozen other tables and is untouched; only this table's trigger is replaced.

Two things depend on that, and neither would be safe under a row-touch timestamp:

- **The printed document.** `printDocumentHash` covers the "updated" value the page shows. Sharing
  a card must not change what the card printed.
- **The concurrency token.** An open editor holds `updated_at` and submits it back. If sharing a
  card moved it, a colleague sharing the card would eject every open editor for no reason.

Both triggers read one function, `ip_preference_card_content_changed`. Two hand-maintained column
lists would drift, and the drift would be silent in both directions — a timestamp that moved
without a revision, or a revision whose recorded timestamp belongs to a different state.

### Trigger-only, and append-only three times over

**No Data API role may insert.** `authenticated` and `service_role` hold `select` and nothing else,
and there is no insert policy. That is what makes "revisions are trigger-written" a property rather
than a convention: a signed-in owner cannot PostgREST an append of their own construction, and the
service role — which bypasses RLS entirely — cannot either, so the guarantee does not quietly
exclude whoever holds that key.

The trigger therefore cannot run as the invoker. It is `security definer`, owned by the migration
role, with `search_path` pinned empty and every reference schema-qualified. Its `execute` is revoked
from `public`, `anon`, and `authenticated`; it returns `trigger`, so PostgREST will not expose it as
an RPC in any case; it refuses to run attached to any table but the cards table; and every value it
writes comes from `new.*`, so it takes no caller-supplied input at all.

**What still authorizes the write is the cards table's own RLS, unchanged.** The function only runs
because an insert or update on a card already passed those policies. The caller's right to change
the card is the caller's right to produce its revision, and nothing in the definer function
re-decides that or can be reached without it.

For rewriting: no update policy, no update grant, and a `before update` trigger that raises. The
third exists because it is the one that still holds if a future migration widens either of the
first two.

There is deliberately **no** delete trigger. A foreign-key cascade is a referential action rather
than a statement, so a trigger raising on delete would make deleting a _card_ fail. The cascade
is the single delete path: revisions are append-only relative to the card's own lifetime, and an
owner deleting their own card takes its history with it. A revision outliving the document its
owner asked to be rid of would be the wrong default for a personal card.

### Numbering, which is not concurrency control

`revision_number` is dense and monotonic per card, assigned by a `before insert` trigger reading
`max() + 1`. That read is racy on its own; the unique index on `(card_id, revision_number)` is
what makes it safe. Two concurrent inserts both read 2, both try to write 3, and one fails. A
failed statement is recoverable. Two rows both calling themselves revision 3 are not.

**This is a uniqueness guarantee and nothing more.** It says two revisions cannot share a number.
It says nothing about an editor that loaded revision 1 saving over revision 2 — that insert would
simply become revision 3, and the state it overwrote would survive as history while silently
ceasing to be the card. Stale-edit protection is the conditional update below: a different
mechanism, solving a different problem.

### Optimistic concurrency

Every content-changing update to a card is conditional on the content version it was built from:

```sql
update public.ip_user_preference_cards
   set ...
 where id = $1 and updated_at = $2
```

Both predicates are in the same statement, which is the whole point — reading the row and comparing
before updating would leave a window between the two for a concurrent save to land in. The editor
records `updated_at` when it loads and submits it as `expectedUpdatedAt`;
`saveCardRequestSchema` requires it whenever `cardId` is present and rejects it when `cardId` is
absent, so an unguarded overwrite cannot be constructed and a create needs no token.

A miss then needs a name, because the update alone cannot tell three situations apart — somebody
saved first, the card is gone, it was never yours — and all three match zero rows. One owner-scoped
follow-up select separates the first from the other two and deliberately cannot separate the other
two from each other:

| Outcome      | Meaning                               | Remedy          |
| ------------ | ------------------------------------- | --------------- |
| `stale_edit` | the card exists and has moved on      | reload, reapply |
| `not_found`  | gone, or never visible to this caller | nothing to do   |

A foreign card id and an unknown card id give the identical answer, exactly as they do everywhere
else in this module — a different answer here would turn a save into a probe for whether a card id
is real. `renameUserCard` takes the same token for the same reason: a rename is revision-bearing.

A rejected save changes nothing and records nothing. It is not a partial write.

### `printDocumentHash` is derived, not stored

The revision stores the integrity hash and the four printed fields; the document hash is computed
on read by the same `printDocumentHash()` the card header calls. Storing it would create a value
that could disagree with its own inputs, and would need a second implementation of a
canonical-JSON hash inside PL/pgSQL.

`created_at` serves as both "when this state came to be" and the `updatedAt` the document hash
covers, because — now that `updated_at` moves only on a content change — they are the same fact.
One column, so they cannot drift.

### The extracted columns cannot lie

`snapshot_integrity_hash`, `resolved_content_hash`, `release_bundle_id`, and `catalog_release_id`
are lifted out of the JSON so a reader does not have to dig for them. That convenience is only safe
while they cannot disagree with their source, so each is constrained against it with
`is not distinct from` — which keeps the legacy shapes valid, since a pre-split snapshot carries
neither the key nor the column and null on both sides is a match.

Ownership is a database fact too: `(card_id, user_id)` is a composite foreign key into
`ip_user_preference_cards (id, user_id)`, so a revision naming an owner other than its card's is
rejected on every write, including a future one nobody has thought of yet. That reference is also
what cascades a card's history away with the card.

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

## Applying and verifying the migration

The migration is `supabase/migrations/20260803052432_add_ip_preference_card_revisions.sql`. This
project's local and remote migration histories have diverged, so it is applied one at a time
through the Supabase MCP migration action from the primary checkout — never `supabase db push`.

Immediately afterwards, run `supabase/verification/20260803052432_verify_ip_preference_card_revisions.sql`
in the SQL editor. It is one transaction ending in `rollback`, so it is non-destructive by
construction: the temporary card it creates, edits, renames, shares and deletes never exists
outside the transaction, and no card belonging to anybody is touched. It checks the structure
(table, RLS, SELECT-only grants, one SELECT-only policy, definer trigger with an empty
`search_path`, no client-callable functions), the existing data (every card has dense history,
every extracted column agrees with its payload, every revision belongs to its card's owner), and
the behaviour (revision 1 on create, 2 on edit, 3 on rename, none on a share toggle with the
content timestamp held still, a stale conditional update matching nothing while a current one
still applies, cascade on delete, and direct insert/update/delete refused as `authenticated`).

## Commands

```bash
npx jest src/features/preference-cards 'src/app/.*preference-cards' --runInBand
```

```bash
npm run ip-cards:release:check-base
```
