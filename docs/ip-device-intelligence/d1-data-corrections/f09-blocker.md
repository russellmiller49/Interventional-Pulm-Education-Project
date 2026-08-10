# F-09 — BLOCKED: no historical retention exists for the modifier definition set

> **Resolved on the stacked definition-set-retention branch.** The mechanism proposed at the
> bottom of this document was implemented as `generated/definition-set-ledger.json` and the
> one-line seed edit applied, with forward releases `release-rigid-bronch-v1-1` and
> `release-therapeutic-bronch-v1-2`. The reproduction of this blocker, the ledger contract,
> and the application record live in
> [`docs/ip-preference-cards/definition-set-retention.md`](../../ip-preference-cards/definition-set-retention.md).
> The analysis below is retained as written, as the record of why the pass that produced this
> directory stopped.

**Finding.** `OPS-APC-RIGID` (`APC_APPLICATOR_RIGID`) is authored `requiredness: 'required'`
with no dependency rule inside the APC modifier's `add_slot` action
(`src/features/preference-cards/seed/operational.ts:759–769`). Selecting APC on a
flexible-only case therefore demands a rigid applicator. The owner-authorized target is
`requiredness: 'conditional'` + `dependencyRule: 'Rigid system in use'` — the exact pattern
the governed data already uses for the same role on RIGID_BRONCH (`SLOT-18617846CD`,
"Rigid APC planned") and for the bite block ("Oral insertion without protected airway").

**Why it is not applied in this pass.** The task's versioning check failed:

1. Every one of the 16 releases published on `origin/main` pins one shared
   `modifierSetPin` — a content hash over the merged modifier set, which `operational.ts`
   dominates. All 16 record the identical pin (`e333509636d4564b…`).
2. `getReleaseDefinitionSources` supplies the definition sets **from live code for every
   bundle** — there is no per-release retention of modifier/rescue/compatibility/role sets,
   no analogue of `module-ledger.json` / `composition-ledger.json`.
3. Any edit to `operationalModifiers` therefore moves the recomputed set hash under every
   published release simultaneously: `ip-cards:releases` fails with
   `release_definition_mutated` ×16, the committed bundles fail
   `release_pin_hash_mismatch` ×16 at runtime/test, and every saved card goes view-only.
4. The only local escape — re-freezing all 16 `definitionHash` values — is exactly the
   consistent rewrite `check-publication-baseline` exists to reject: with the bundles now
   published on `origin/main`, it reports `publication_definition_mutated` ×16.

The alternative recorded in the finding (a `set_requiredness` action gated on RIGID_AIRWAY)
is doubly unavailable: no action-level gating construct exists in `ModifierAction`, and the
modifier-path `set_requiredness` (`effective-slots.ts:196–201`) drops `dependencyRule`, which
would leave a conditional slot no UI can ever include. Both owner-recorded options live in
the pinned modifier set, so both are blocked by the same retention gap.

Per instruction — "if historical retention of that definition set is not safely implemented,
stop F-09 rather than mutating history" — **F-09 is left unapplied. No file was changed for
it.**

## Smallest forward-compatible mechanism (proposal, not implemented)

A **definition-set ledger**, mirroring the module and composition ledgers:

1. `generated/definition-set-ledger.json`: every definition set a published release pins is
   copied in once, verbatim, keyed by its content hash — entries for
   `definition-set-modifiers`, `-rescue-modules`, `-compatibility-rules`, `-role-taxonomy`.
   Append-only; `withPublishedDefinitionSets` can never rewrite an entry.
2. `getReleaseDefinitionSources` resolves each set **by the pinned hash**: current code when
   the hash matches the live set, the ledger entry otherwise. (Sources become per-bundle,
   which is the one structural change — today they are globals.)
3. `validateDefinitionSetLedger`: entry-hash integrity, live-divergence naming the set, and
   pinned-hash-present — the same three checks the other ledgers run.
4. `check-publication-baseline` gains the ledger as a fifth protected artifact.

With that in place, F-09 becomes the one-line seed edit the owner described
(`'conditional'` + `'Rigid system in use'` as `addedSlot`'s 5th and 10th arguments), plus a
new modifier-set hash pinned only by the next release generation, while the 23 existing
releases keep resolving the retained set.

**Interim clinical honesty.** Until then the defect remains visible rather than masked: the
APC modifier card lists the rigid applicator among its six additions on every workspace, and
the D1 presentation does not special-case it. The demo scenario co-selects RIGID_AIRWAY, so
the demo readiness view happens not to exhibit the false `missing_required_product_role`; a
flexible-only card would. That residual behaviour is exactly what the owner's F-09 describes,
unchanged.
