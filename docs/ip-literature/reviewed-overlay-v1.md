# Literature reviewed overlay V1

> Status: **preparation only.** This document and the `scripts/literature-reviewed-overlay/`
> package prepare an exact physician-reviewed overlay of the 630-record development cohort onto
> the dedicated `IP_Literature` production corpus. Nothing here has been applied to any remote
> system, no schema change has been applied anywhere, and the operator's `apply` command is
> unreachable against production until every later authorization boundary in this document is
> satisfied.

## What the overlay is

The dedicated `IP_Literature` project (`itcttmkxdxvwmwcmzmey`) holds the fixed 132,350-article
bibliographic corpus, every record `draft` / `unreviewed`. Physician review truth for the
owner-authorized development cohort — exactly 630 records — exists only locally: current review
heads in the protected local gold-set database, and the finalized 630-row V3 enrichment artifact.

The reviewed overlay writes that truth onto the production corpus:

- exactly 630 articles become physician-reviewed;
- 283 `include_core`, 75 `include_adjacent`, 272 `exclude` — so exactly 358 physician-reviewed
  relevant records;
- enrichment provenance per record: physician-confirmed, physician-modified, or QC-accepted;
- review history is recorded append-only, one deterministic curation event per article;
- the two known append-only note corrections keep their lineage;
- no article outside the 630 changes in any way;
- no AI-suggestion field participates.

## Representation decision

### The problem

The foundation schema's article-level relevance vocabulary is
`unreviewed | candidate | included | excluded`
(`literature_articles_relevance_state_check`). The physician truth vocabulary is
`include_core | include_adjacent | exclude`. Mapping both include classes to `included` would
destroy a distinction the physician made and the product needs, and the foundation has no field
for enrichment provenance, no marker distinguishing "physician-reviewed from the checksum-bound
gold artifact" from "an admin clicked a button later," and no way to carry correction lineage.

The foundation therefore **cannot durably preserve the reviewed distinctions**, and per the
owner's instruction the package carries the **smallest additive forward-only schema proposal**,
staged at `scripts/literature-reviewed-overlay/schema/reviewed-overlay-proposal.sql`. It is
deliberately **not** placed in `supabase/migrations/` — that directory's Literature membership is
bound by the dedicated-project manifest and protected-bundle tests, and this proposal is not
authorized to join it yet. It is applied only to disposable rehearsal databases in this phase.

### Current state: five additive nullable columns on `literature_articles`

| Column                           | Type / check                                                       | Meaning                                                     |
| -------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| `reviewed_relevance`             | `text`, `include_core \| include_adjacent \| exclude`              | The physician's exact class. Null = not physician-reviewed. |
| `reviewed_enrichment_provenance` | `text`, `physician_confirmed \| physician_modified \| qc_accepted` | How the record's enrichment reached its final state.        |
| `reviewed_source_identity`       | `text`, bounded                                                    | Fixed constant naming batch, kind, and artifact SHA-256.    |
| `reviewed_at`                    | `timestamptz`                                                      | One operation-level timestamp, identical across the cohort. |
| `reviewed_operation_id`          | `uuid`                                                             | The deterministic overlay operation identity.               |

A table CHECK requires all five null together or all five non-null together. The columns are
additive and nullable, so the existing corpus, ingest operator, verify package, UI reads, and
`curate_literature_article_v1` are untouched. The coarse `relevance_state` remains the working
state machine: the overlay sets it to `included` for both include classes and `excluded` for
`exclude`, so every existing consumer (search RPC, admin queue, stats) keeps working, while the
fine class survives beside it. `manual_override` is set `true` — these are human decisions, and
that is the flag re-import protection honors. `visibility_state` stays `draft`: reviewing is not
publishing.

The proposal also creates `literature_reviewed_overlay_operations` — one row per overlay
operation, deterministic UUID primary key, carrying artifact SHA-256, source identity, exact
expected counts, status `started | completed`, and timestamps — the remote registry that makes a
concurrent or repeated operation detectable, exactly as `literature_import_batches` does for the
ingest.

### History: one deterministic append-only event per article

`literature_curation_events` already has an append-only trigger and a free-form `after_value`
JSONB. The overlay inserts exactly one event per article with the **existing**
`event_type = 'relevance_changed'` (no event-vocabulary change is needed), a **caller-supplied
deterministic UUID id** derived from the operation identity and PMID, and an `after_value`
carrying the full reviewed payload:

```jsonc
{
  "relevance_state": "included",
  "reviewed_relevance": "include_core",
  "reviewed_enrichment_provenance": "physician_confirmed",
  "reviewed_source_identity": "…", // constant, includes the artifact SHA-256
  "reviewed_operation_id": "…",
  "persisted_head_revision": null, // 1 for the seven workspace heads, 2 for the corrections
  "note_correction": null, // checksum-bound lineage object on the two corrected records
}
```

`before_value` records `{ "relevance_state": "unreviewed", "reviewed_relevance": null }`.
`actor_user_id` is null and `actor_email` is the writer identity constant
`literature-reviewed-overlay`, mirroring the ingest's pinned `created_by`.

Because the event id is deterministic, a replay cannot create a second history row: the apply RPC
treats "event exists with byte-identical payload and article already in the exact target state"
as `already_applied`, and any other collision as drift that stops the operation.

### The two append-only corrections

PMIDs `36879724` and `39281191` carry a checksum-bound amended physician-rationale authorization:
their local review heads are `revision = 2`, each appended (never overwritten) over the original
review, and their persisted notes are authoritative over the artifact notes
(`NOTE DISPOSITION ALREADY AUTHORIZED`; see `gold-import-field-lineage-v1.md`).

Physician notes are coordinator-only and are **not** imported by this overlay. The corrections
are preserved without disclosing their text:

- the source projection asserts, at validate time, that these two items' persisted heads are
  exactly `revision = 2`, effective, and standard — the corrections still exist and are still
  the effective persisted truth;
- their events and `after_value` payloads carry `persisted_head_revision: 2` plus a
  `note_correction` object naming the amended-authorization SHA-256
  (`b95fc9785ee355b810981c051db62307e868110e06ffb1a83c09c8eff52bf89a`), the per-record bound
  rationale SHA-256, and the rule version
  `amended-two-row-physician-rationale-exception/1.0.0`;
- production current state is written once, directly to the corrected truth: no fabricated
  intermediate production state transition is invented, because production never held the
  superseded value. The full actual history remains in the protected local database, which stays
  untouched.

### What is deliberately not represented

- **Physician notes, confidences, taxonomy tags, sufficiency, blinding, timing** — coordinator
  and local-workflow provenance, out of the overlay's scope. The overlay imports relevance truth
  and enrichment provenance only.
- **`uncertain`** — the finalized cohort contains none; the operator refuses any.
- **AI fields** — `classifier_version`, `classifier_payload`, and `literature_article_topics`
  are never read or written. Physician truth is never collapsed into a suggestion surface.

## Source authority

Two authorities, cross-checked, both required. The observed division (verified against the
real local database and the real artifact during preparation, by guarded read-only queries and
aggregate-only probes):

1. **The protected local gold database** (fixed Docker container
   `supabase_db_ip-literature-local`, published port 55322) is authoritative for **cohort
   membership and persisted review state**. It holds persisted review heads for nine cohort
   items — seven at revision 1 and the two checksum-bound corrections at revision 2 — while the
   remaining 621 items are `pending` with no persisted review row (the V2 import contract
   remains unexecuted; operations/actions/imports/compensations are 0/0/0/0). It is read
   through the existing guarded boundary (`streamGuardedReadOnlyQuery` in
   `scripts/literature-production-ingest/source.ts`): Docker context/endpoint/container/image/
   port guards, `repeatable read read only`, in-band identity attestation, terminal
   `rollback`, stderr discarded.

2. **The finalized 630-row V3 artifact** (SHA-256
   `961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59`) is authoritative for
   **the values to be imported**: every record's relevance class and enrichment provenance,
   exactly as the field-lineage contract assigns it. Its bytes are hashed and compared to the
   pinned constant **and** to the owner's environment pin before one byte is parsed, then
   parsed by the existing protected `parseFinalizedGoldImportArtifact`, which re-verifies the
   SHA, requires the development split literal on every row as a positive schema constant, and
   rejects duplicates. The artifact is handled as coordinator-only: no row content reaches
   stdout, logs, checkpoints, receipts, or errors — aggregates only.

Where the two overlap — the nine persisted heads — they must agree exactly on relevance
(verified: all nine agree), and the imported per-record lineage records each record's
persisted head revision (`null` for the 621 artifact-only records, `1` for the seven workspace
heads, `2` for the two corrections).

### Positive development-cohort authentication

The database cohort is named exactly one way:

```sql
join public.literature_gold_set_batches as batch on batch.id = item.batch_id
where batch.name = 'gold-set-v1'
  and batch.kind = 'gold_standard'
  and item.dataset_split = 'development'
```

`name` is unique in the schema, so the pair is an identity, not a filter that happens to match.
The split literal appears **only** as this positive predicate — never in a SELECT list, never as
an emitted value. There is no anti-join, no complement, no `NOT IN`, no `EXCEPT`, no
`requested_size` / `test_percent` arithmetic, and no other-split literal anywhere in the package;
the mutation-matrix test enforces this textually against every package source file. The held-out
split is never selected, counted, inferred by difference, or described.

The artifact needs no complement logic either: it contains exactly the 630 development rows by
construction, each row's split authenticated positively by the parser's schema literal.

### Cross-checks (every failure stops the operator)

- database cohort count is exactly 630, PMIDs unique, every item in a stable state — `pending`
  with no head fields, or `completed` with an effective, standard head (an `in_progress` or
  `return_later` item, a withdrawn head, or an import/compensation-kind head refuses);
- artifact row count exactly 630, identities unique, SHA-256 exactly the pin;
- database PMID set equals artifact PMID set exactly (compared as sets — missing and extra rows
  are distinguished and both fatal);
- every persisted database head's `relevance_label` equals the artifact's
  `physician_final_label` for that PMID;
- class counts exactly `{include_core: 283, include_adjacent: 75, exclude: 272}`, zero
  `uncertain`, relevant total exactly 358;
- enrichment-provenance counts exactly `{physician_confirmed: 192, physician_modified: 133,
qc_accepted: 305}` — see below;
- the two corrected PMIDs have persisted head revision exactly 2; every payload lineage claim
  is derived from the observed head, not assumed;
- every one of the 630 PMIDs already exists in the production corpus (membership verified
  read-only before mutation; the overlay can create no article).

### The provenance triple 192 / 133 / 305

The owner supplied these as the expected enrichment-provenance distribution. The repository does
not currently record this triple as such (192 appears only as a catalog census figure, 133 as
the taxonomy-v2 candidate-row count, 305 as the protocol-acceptance cohort size). They are
therefore encoded as **owner-expected pins that must equal the artifact-derived aggregate**, and
any discrepancy is a hard stop with a count-only discrepancy report — the operator never adjusts
an expectation to match an observation.

## Operator lifecycle

Package: `scripts/literature-reviewed-overlay/` (outside the protected bundle; no npm scripts
are added — the integration lead may add them later exactly as the ingest README prescribes).

| Command                             | Destination requests                         | Purpose                                                                                                                                                                                          |
| ----------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `validate`                          | none                                         | Guarded source read + artifact verification + all cross-checks; prints aggregate summary and the projection digest an owner reviews.                                                             |
| `dry-run`                           | none                                         | `validate` plus the full bounded batch plan and an immutable dry-run receipt.                                                                                                                    |
| `apply --confirm-production-write`  | bounded RPC calls                            | The production mutation. Unreachable this phase (see locks).                                                                                                                                     |
| `reconcile --checkpoint …`          | observation RPC only (POST body, reads only) | Observes the registry and every unresolved batch; classifies with the strict vocabulary (`absent_exact`, `applied_exact`, `partial`, `mixed`, `drifted`, `ambiguous`, `observation_incomplete`). |
| `verify --checkpoint … --receipt …` | observation RPC only (POST body, reads only) | Re-derives the reviewed set from source + artifact, re-performs the complete post-observation, and requires it to match the completion binding exactly.                                          |

### Production locks (all required before `apply` can mutate)

1. exact destination binding: the three `LITERATURE_SUPABASE_*` variables, byte-exact canonical
   URL, approved ref only, Endoreels refused in every mode, `sb_secret_…` credential class only,
   no legacy/generic fallback, and never supplied through process arguments;
2. artifact present, byte SHA-256 equal to the built-in constant **and** to
   `LITERATURE_REVIEWED_OVERLAY_EXPECTED_ARTIFACT_SHA256`;
3. source projection digest equal to `LITERATURE_REVIEWED_OVERLAY_EXPECTED_PROJECTION_SHA256`
   (owner reviews the digest from `validate` output first);
4. every cross-check above, including the exact 630 / 283 / 75 / 272 / 358 and 192 / 133 / 305;
5. corpus binding: all 630 PMIDs present remotely, zero articles already reviewed by a different
   operation;
6. owner authorization literal
   `LITERATURE_REVIEWED_OVERLAY_OWNER_AUTHORIZATION` set to the exact sentence in the
   authorization template below;
7. `--confirm-production-write` on the command line;
8. remote overlay schema present (probe of the proposal columns/RPC — fails closed today,
   because the proposal is not applied anywhere remote);
9. durable write-ahead checkpoint + exclusive adjacent `.operator-lock` lease (a crash leaves
   the lease for inspection; it is never auto-removed);
10. deterministic operation identity registered remotely (`literature_reviewed_overlay_operations`
    insert with deterministic UUID; a collision is inspected, never overwritten).

### Bounded transactions and the write-ahead protocol

The 630 records are ordered by PMID under `C` collation and split into bounded batches
(default 90 records, cap 250). Each batch is one call to the proposal RPC
`apply_literature_reviewed_overlay_batch_v1`, which is transactional per call: partial
application inside a batch is impossible. Before each request the checkpoint durably records
`submitted`; an exact acknowledgement (per-record dispositions matching the request exactly)
moves it to `acknowledged`; a confirmed PostgREST rejection is `confirmed_failure` (retryable
only by explicit resume); a timeout, transport exception, 408, 5xx, malformed body, or
acknowledgement mismatch is `ambiguous` — the stop signal prevents any further batch, and resume
is blocked until read-only reconciliation proves exact application or exact absence. There is no
automatic retry, no failed-status write, no delete, no compensating mutation.

## Idempotency model

- **Operation identity** is a deterministic UUID derived from the engine version, the artifact
  SHA-256, and the source projection digest. The same truth always names the same operation.
- **Event identity** is a deterministic UUID derived from the operation id and PMID. History can
  therefore never be duplicated: a rerun of a completed operation observes the operation row and
  per-record state and reports an idempotent replay, mutating nothing; a rerun of a partially
  applied operation resumes only after reconciliation, and each already-applied record returns
  `already_applied` from the RPC without inserting a second event.
- **`reviewed_at`** is minted once for a genuinely new operation, persisted in the checkpoint,
  and adopted from the registered remote operation row when the deterministic operation
  already exists (so a from-scratch replay after lost local state converges on the recorded
  identity — a property the disposable rehearsal proves), and it is reused
  verbatim on resume, so a resumed operation cannot fork the current-state timestamp.
- The RPC accepts a record only in one of two states: exactly unreviewed (fresh application) or
  exactly in the target reviewed state with the deterministic event present (replay). Anything
  else — a different reviewed state, a foreign operation id, an event-id collision with a
  different payload — raises and rolls back the batch.

## Expected production effects (after a future authorized apply)

- 630 `literature_articles` rows change: `relevance_state` `unreviewed → included` (358) or
  `unreviewed → excluded` (272); `manual_override` `false → true`; `curation_reason` set to the
  fixed overlay sentence; the five `reviewed_*` columns populated; trigger updates `updated_at`.
- 630 `literature_curation_events` rows inserted, deterministic ids, `relevance_changed`.
- 1 `literature_reviewed_overlay_operations` row, `started → completed` after the final batch
  verifies remote totals in-transaction.
- Nothing else: no journal, source, topic, import-batch, classifier, visibility, or landmark
  change; the 132,350-article corpus outside the 630 is untouched, and the operator's verify
  command proves the untouched complement by total counts (132,350 articles, exactly 630
  reviewed, zero reviewed rows outside the operation id).

## Recovery and reconciliation matrix

| Observed                                                                    | Classification                                                                          | Operator action                                        |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| All batch events + article states present and exact                         | exact application                                                                       | mark `acknowledged`, continue / finalize               |
| No batch events, no batch article changes                                   | exact nonapplication                                                                    | reset stage to `prepared`, explicit resume may retry   |
| Some records applied, some not, all consistent with a mid-transaction abort | impossible inside one batch (transactional RPC); across batches: resume from checkpoint | reconcile per batch                                    |
| Event exists with different payload, or article in a foreign reviewed state | drift                                                                                   | hard stop; human investigation; no automated repair    |
| Reads fail / cannot observe                                                 | observation incomplete                                                                  | stop; retry reconciliation only                        |
| Operation row exists with different identity content                        | foreign/duplicate operation                                                             | hard stop; never overwritten                           |
| Checkpoint `completed` but receipt missing                                  | recovery                                                                                | full read-only verify, then immutable receipt creation |

## Future owner authorization template

A later production apply is authorized only by a message from the owner containing, verbatim:

1. the sentence: `I authorize the exact physician-reviewed overlay of the 630-record
development cohort onto IP_Literature production.`
2. the artifact SHA-256 (`961c19f4…`, full 64 characters);
3. the projection digest from a `validate` run the owner executed or reviewed;
4. confirmation that the additive schema proposal has been independently reviewed and applied to
   the dedicated project through the approved mechanism (it has not been, as of this document);
5. the operating environment: primary checkout or worktree, state directory, and who runs it.

The environment variable `LITERATURE_REVIEWED_OVERLAY_OWNER_AUTHORIZATION` must then carry
exactly the sentence in item 1. The operator refuses anything else, including near-miss
spellings.

## UI-facing reviewed-overlay contract

For the later UI package (not implemented here):

- an article is **physician-reviewed** iff `reviewed_relevance is not null`; the five
  `reviewed_*` fields are one atomic group;
- `reviewed_relevance` is the display class (`include_core | include_adjacent | exclude`);
  `relevance_state` remains the coarse working state and the two never disagree at overlay time
  (`include_* ⇒ included`, `exclude ⇒ excluded`), though later human curation may legitimately
  move `relevance_state` while the reviewed columns keep recording what the physician review
  said;
- `reviewed_enrichment_provenance` is displayable as a provenance badge;
- the event stream for a reviewed article contains exactly one `relevance_changed` event whose
  `after_value.reviewed_operation_id` matches the article, carrying `persisted_head_revision` and,
  for the two corrected records, `note_correction` lineage suitable for an audit view;
- reads should go through a new `reviewed_read`-style operation in the capability allowlist —
  the current `LITERATURE_ACTIVATED_OPERATIONS` does not change in this phase.

## Preparation evidence (2026-08-16)

What this preparation session proved, without any remote write:

- **Real-source validation, read-only.** The operator's own `validate` command ran against the
  protected local database (guarded boundary, repeatable-read read-only, terminal rollback)
  and the located finalized artifact (byte-verified against the pin, parsed through the
  protected boundary). Aggregate results: 630 cohort items = 630 artifact records with
  identical PMID sets; class counts exactly 283 / 75 / 272; enrichment-provenance counts
  exactly **192 physician-confirmed / 133 physician-modified / 305 QC-accepted** (the
  owner-expected triple matches the authoritative development-only projection exactly); nine
  persisted heads, all agreeing with the artifact on relevance; the two corrections at
  revision 2. The derived identity of this exact truth:

  ```text
  projection digest  6bdc086aa8a57a14fe60ce4c25dc43c28dc7d339712aed193f012ded890b8ff7
  operation id       93245053-7bb3-853c-926d-8c05a1c58a32
  ```

  A future owner authorization that pins this projection digest names exactly this reviewed
  truth; any drift in either authority changes the digest and refuses the pin.

- **Disposable end-to-end rehearsal, 16 scenarios.** A throwaway Supabase-image PostgreSQL 17
  container (no published port) received the foundation migration, the additive proposal, and
  a synthetic 132,350-row corpus; the real engine then proved: schema-probe fail-closed on a
  foundation-only database, corpus-absent refusal before any mutation, confirmation-flag
  refusal, confirmed-rejection rollback (a poisoned batch leaves exactly the prior batches'
  events), lost-acknowledgement ambiguity with resume blocked until read-only reconciliation,
  reconciliation classifying exact application, resumed completion at exactly 630 events with
  no duplicate history, correction lineage present in production history, exact verification,
  append-only trigger enforcement, idempotent from-scratch replay (630 events before and
  after), refusal to resume a completed operation, and drift detection by verify.
- **115 unit and adversarial tests** across 11 suites, self-contained and synthetic.

## Tier-1 correction pass (2026-08-17)

An independent Codex review of the preparation PR returned BLOCKED with reproduced
production-integrity defects (while passing the held-out non-access, positive authority,
artifact handling, exact local counts, representation, additive structure, and production
unreachability). The corrections, all landed on the same branch without redesigning the passed
boundaries:

- **Completion is licensed by actual state, not registry metadata.** The apply RPC's
  finalization now counts the actual articles by class _and_ enrichment provenance and the
  actual deterministic events, and refuses completion on any disagreement; the engine
  additionally performs a complete read-only **post-observation** (full registry row, every
  total, the untouched complement, and every record's exact state) before a checkpoint or
  receipt may say completed, binding its checksum into both.
- **Completed operations are immutable.** Every later call must be an exact replay; a fresh
  application, a foreign article, or any metadata difference fails the whole call. Replay
  works across batches in any order and returns `already_applied` only.
- **The frozen curation reason is operation identity**, bound into the deterministic operation
  id, the registry (durable column), the checkpoint, the receipt, the RPC identity comparison,
  every event reason and article `curation_reason`, replay comparison, reconciliation, and
  verification.
- **Fresh and replay predicates are exact** over every protected field (`relevance_state`,
  `visibility_state`, `manual_override`, `is_landmark`, `curation_reason`,
  `classifier_version`, `classifier_payload`, all `reviewed_*` columns, and the full event
  payload/actor/reason); each field is proven load-bearing by a rehearsal tamper scenario.
- **Acknowledgements are context-bound** (fresh non-final → `started`; fresh final →
  `completed`; completed-operation replay → `already_applied`-only with `completed`), and even
  a matching acknowledgement never licenses completion — the post-observation does.
- **Checkpoints are relationally strict** (per-state invariants; acknowledged stages must
  carry both timestamps, exact effects, and exactly one evidence checksum; counters must equal
  the sum of acknowledged effects; completed requires the post-observation binding), and
  **receipts bind the full authority** (canonical URL, approved ref, writer, source, frozen
  reason, pinned counts, checkpoint checksum, post-observation checksum) unconditionally for
  remote outcomes.
- **Reconciliation classifies remote truth** with the strict vocabulary (`absent_exact`,
  `applied_exact`, `partial`, `mixed`, `drifted`, `ambiguous`, `observation_incomplete`),
  observes the registry beside the batches, refuses semantically false receipts, and — because
  a receipt is evidence, not authority — the engine **re-observes** every nominated batch
  freshly before any stage advances. Resume mutates again only after a verified exact absence.
- **The persisted-head lineage is exact**: exactly nine heads — seven ordinary first revisions
  plus the two corrections at revision 2 — enforced in the projection, the reviewed-set
  counts, checkpoints, and receipts.
- **Inputs are validated before any cast** (closed key sets, grammar-checked UUIDs, integers,
  timestamps, booleans; duplicate PMIDs/event ids refused; ordinal-only generic errors), and
  the transport **never carries a response body into an error and never places a PMID in a
  URL** — all reads travel through one bounded, body-based, service-role-only, read-only
  observation RPC added to the staged proposal.
- **Generic credentials are test-killed** (every legacy/main-project variable individually
  refused; Endoreels and arbitrary targets refused; production modules textually free of every
  legacy name), and the proposal is **partial-schema safe**: bare `CREATE` only, one
  transaction — an incompatible same-signature function survives untouched while the proposal
  rolls back whole.

## Relationship to the protected import contracts

The local gold-set V2 import contract (`apply_literature_gold_import_v2`) imports enrichment
**into the protected local database**. This overlay is a different, narrower boundary: local
truth **outward** to the production corpus. It reuses the protected artifact parser and the
guarded source boundary read-only, changes no protected file, adds no npm script, and leaves the
local database byte-untouched (its reads are `repeatable read read only` with terminal
`rollback`). The V2 import remaining unexecuted (operations/actions/imports/compensations
0/0/0/0) is part of this overlay's observed baseline: current local heads are the physician
reviews themselves.
