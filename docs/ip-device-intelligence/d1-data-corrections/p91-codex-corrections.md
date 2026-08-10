# P91 Codex corrections (2026-08-10) — bounded post-review pass on the D1.1 governed-data corrections

An independent Codex review of the frozen PR #91 pair
`2f26cb76 → e833b97f` confirmed three findings against the 2026-08-09 D1.1 correction pass.
This pass corrects exactly those three. It reopens nothing else: F-06, F-10, the owner
packets (F-21/F-30/F-33), the F-09 blocker, and every other verified part of PR #91 are
untouched except where a regression now protects them.

The targeted Codex verification of this pass (range `8880d453…`) closed P91-C1, P91-C2, and
P91-C3 and surfaced two residual MEDIUM findings — P91-C4 and P91-C5 — corrected in the
[final residual section](#final-residual-corrections-p91-c4-p91-c5) below.

| #      | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                            | Disposition |
| ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| P91-C1 | HIGH     | F-04 remained wrong in **current custom cards**: server-side save resolution through `release-custom-composition-v1-1` with the EBUS-specific and therapeutic-specific modules selected still placed all six owner-named sampling instruments at specimen_station / specimen_handling. The v1-1 release notes carried this as an accepted limitation; the correction pass rejects that framing — custom-card creation is a real authoring surface. | **FIXED**   |
| P91-C2 | HIGH     | The F-05 section-level `Drainage` re-phase over-reached on MED_THORACOSCOPY: two **insertable devices** that share the section — `SLOT-57CA4B1298` ("Post-procedure chest tube") and `SLOT-9A1C0491F9` (IPC insertion kit, "IPC placement planned") — moved to pre_induction_or_sedation alongside the actual drainage-preparation hardware.                                                                                                       | **FIXED**   |
| P91-C3 | MEDIUM   | The canonical release-impact report (`generated/release-impact-report.json`) omitted all six F-04 semantic changes: `diffReleaseBundles` indexed **raw module slots** and never applied composition actions, so an action-borne change was invisible at exactly the boundary the release review reads.                                                                                                                                             | **FIXED**   |
| P91-C4 | MEDIUM   | Custom-composition payload validation was incomplete: the loader validated payload **values** for only four of the seven action types, and the evaluator cast unvalidated strings — `{ actionType: "set_open_hold_status", payload: { value: "definitely_not_a_status" } }` loaded and propagated the invalid value onto expanded slots.                                                                                                           | **FIXED**   |
| P91-C5 | MEDIUM   | `modifierActionEffectSummary`'s exhaustiveness was compile-time only: at runtime, an unknown modifier action type **returned** the unknown string instead of throwing, so a poisoned definition set produced malformed release-impact data rather than failing the generator.                                                                                                                                                                      | **FIXED**   |

## P91-C1 — the custom composition gains a governed action channel

**Mechanism.** The custom composition's module list stays derived from the current module
set; its **actions** are now authored governed seed content —
`data/ip-preference-cards/seed/custom-composition.json` — validated at server load and
applied by the **same canonical evaluator** the procedure recipes use
(`expandRecipeComposition`). No presentation remap, no save-path special case, no
procedure-code conditional, no second action engine.

The one generic extension the evaluator needed is `ProcedureCompositionAction.optionalTarget`:

- a custom card **chooses** its modules, so an action whose target requirement is not in the
  selected composition is an ordinary inapplicable statement, not an authoring error — it is
  silently skipped (no message, no trace; the trace is hashed, and stamping the absent
  target's identity into every card that never had the line would move those cards'
  identity);
- an optional-target action matching **more than one** requirement blocks
  (`recipe_composition_action_ambiguous`) instead of silently modifying both — a reviewed
  per-requirement statement must not land on a requirement nobody reviewed it for;
- absent the flag, behaviour is unchanged (unmatched still warns
  `recipe_composition_action_unmatched`), so no published recipe's semantics moved.

Load-time validation in `demo-context.server.ts` refuses to start when the seed and
`scenario-ids.ts` disagree on the recipe identity, when an action fails the composition-action
schema, or when a target resolves to anything other than **exactly one** requirement across
the offered module set. _[Corrected by P91-C4: as first shipped, the load-time payload-value
checks covered only `set_setup_zone`, `set_procedural_phase`, `set_requiredness`, and
`set_quantity` — narrower than the loader's own "including its payload values" claim. Every
action type's payload is now validated by one canonical dispatch; see the final residual
section.]_

**Content.** Sixteen per-slot actions, each `optionalTarget: true`, targeting the stable
imported slot ids:

- twelve F-04 actions — the same six per-slot zone/phase statements the EBUS_TBNA and
  THERAPEUTIC_BRONCH recipes carry (`SLOT-1AF4BEFE3B`, `SLOT-B83EBD2FBB`, `SLOT-D08C74941A`,
  `SLOT-E8F0B48B49` → EBUS; `SLOT-D2974FC11B`, `SLOT-FDF73730B0` → therapeutic), all →
  back_table / diagnostic;
- four P91-C2 actions — the two MED_THORACOSCOPY insertable-device placements below, so a
  new custom release does not ship still teaching the over-broad F-05 placement.

**Versioning.** `recipe-custom-composition-v1-2` / `release-custom-composition-v1-2`
(hash `3d9139efcd2c7ca4…`), superseding `-v1-1` (`65be5c3697fc3970…`); the
CUSTOM_COMPOSITION pointer advanced. v1-0 and v1-1 are retained verbatim in
`generated/composition-ledger.json` and still reconstruct their original semantics — a card
pinned to v1-1 resolves the six instruments at the specimen station exactly as saved, and
duplicating it keeps the v1-1 pin.

## P91-C2 — per-slot overrides for the two MED_THORACOSCOPY insertable devices

The section-level F-05 correction **stands** for actual drainage preparation: the drainage
unit `SLOT-AA3C2EAA6D` and every other `Drainage` row remain
equipment_tower / pre_induction_or_sedation.

The over-reach was in F-05's own terms: the owner's finding named the section's
**"required non-catheter items"** — `GENERIC_DRAINAGE_UNIT`, `GENERIC_SUCTION`, and
`PLEURAL_DRAINAGE_ACCESSORY` (owner-review-findings.md, F-05) — so the two catheter rows
were never in its intended scope. The two insertable devices now carry owner-reviewed
per-slot composition actions (the F-04 mechanism) on the new MED*THORACOSCOPY recipe,
placing each at the **zone and phase** its governed **home-procedure precedent** already
established — cited by exact row, not derived from general clinical knowledge (note this is
a precedent-alignment placement, not a revert to the pre-F-05 `post_procedure` value; the
row's own "Post-procedure chest tube" label describes when the tube goes in relative to the
thoracoscopy, while the precedent phases device \_insertion* as therapeutic):

| Slot              | Device                                      | Governed precedent                                                             | Placement                   |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------- |
| `SLOT-57CA4B1298` | Post-procedure chest tube                   | CHEST_TUBE `SLOT-708736B8C2` (CHEST_TUBE_SMALL_BORE, section `Tube`)           | sterile_field / therapeutic |
| `SLOT-9A1C0491F9` | IPC insertion kit ("IPC placement planned") | IPC_PLACEMENT `SLOT-1BCF3D0702` (IPC_INSERTION_KIT, section `Catheter system`) | sterile_field / therapeutic |

Dependency rules, requiredness, labels, role codes, option sets, and provenance are
unchanged — the regression proves v0-3 differs from v0-2 by exactly the two slots' zone and
phase.

**Versioning.** `recipe-med-thoracoscopy-v0-3` / `release-med-thoracoscopy-v1-2`
(hash `4386eb65a183cf06…`), superseding `-v1-1` (`b53baacd1dafa2f0…`); the MED_THORACOSCOPY
pointer advanced. The module stays at MED_THORACOSCOPY_SPECIFIC v1.1 (the correction is
recipe-authored). v0-1 and v0-2 are retained in the composition ledger; v0-2 still
reconstructs the over-broad placement it published.

**The test defect is repaired, not re-encoded.** The 2026-08-09 regression asserted that
_every_ `Drainage` row shares one phase — the assertion that encoded the over-broad
behaviour. It is replaced by exact-slot assertions partitioned by semantic class (the class
is expressed as reviewed slot lists, not derived from a data field): drainage-preparation
rows pre-induction by exact slot id, the two insertables therapeutic by exact slot id, and
no `Drainage` row post_procedure — fail-closed, so a new row entering the section forces a
review rather than inheriting either placement silently.

## P91-C3 — release impact diffs the final effective recipes, and modifier effects generically

`diffReleaseBundles` now expands the **exact old and new pinned sources** (retained recipes
and modules from the ledgers, never live globals) through the canonical action evaluator —
every module the recipe references, so optional modules and the all-optional custom
composition stay diffable — and diffs the final effective requirement definitions over
`REQUIREMENT_COMPARED_FIELDS`. A blocking expansion aborts the diff loudly rather than
under-reporting. The canonical report now carries every F-04 correction:

```text
release-ebus-tbna-v1-1               ← SLOT-1AF4BEFE3B, SLOT-B83EBD2FBB, SLOT-D08C74941A,
                                       SLOT-E8F0B48B49        changed (setupZone, proceduralPhase)
release-therapeutic-bronch-v1-1      ← SLOT-D2974FC11B, SLOT-FDF73730B0
                                                              changed (setupZone, proceduralPhase)
release-custom-composition-v1-2      ← all six above + SLOT-57CA4B1298, SLOT-9A1C0491F9
release-med-thoracoscopy-v1-2        ← SLOT-57CA4B1298, SLOT-9A1C0491F9
```

with `old: specimen_station / specimen_handling → new: back_table / diagnostic` for the six
F-04 rows, proven at the expansion level by the regression suite.

**Owner note on already-reviewed numbers.** The corrected generator makes two rows that were
part of the 2026-08-09 review read larger: EBUS_TBNA v1-0→v1-1 now reports 6 requirement
changes (was 2) and THERAPEUTIC_BRONCH 5 (was 3) — the additions are exactly the F-04
corrections the owner directed, previously hidden inside the recipe pin. Any sign-off read
against the smaller numbers should be re-read against the corrected rows.

**Generic modifier-effect layer** (`modifierEffectChanges`, `sourceKind: "modifier"`). A
release-set change can now report the **authored effect of selecting a modifier** — action
identity/sequence, the requirement it adds or targets, field-level before/after (presence,
requiredness, dependency rule, role, zone/phase, quantity, sterile status, responsible
role, notes, and the slot identity the runtime dedupes by), plus first-class rows when a
modifier enters or leaves the recipe's selectable offer — scoped to the modifiers the
procedure's recipes offer, distinguished from base effective-recipe changes, and explicitly
_not_ implying any scenario selects the modifier (the admin surface renders that note). A
summary never claims an effect the modifier engine does not apply: the modifier evaluator's
`set_requiredness` reads only the requiredness value, so any other authored payload keys
surface under `unappliedPayload` — visible when they change, never presented as an effect.
A synthetic fixture (`createModifierRevisionFixture`) proves the exact PR #92 F-09 shape: a
modifier-added requirement moving from `required` / no dependency rule to `conditional` /
"Rigid system in use" produces a requirement-level report row rather than only a set-pin
hash. Every committed report today carries an empty modifier layer — the current releases
all resolve one shared modifier set, and editing that set is refused by the immutability
gates rather than diffed — so the layer is fixture-proven now and becomes live exactly when
releases pin per-bundle definition sets: PR #92's retention mechanism. After PR #92 is
restacked, its per-bundle set resolution feeds this same diff and F-09's forward releases
report the OPS-APC-RIGID change natively. PR #92 itself was not modified.

## Final residual corrections (P91-C4, P91-C5)

The targeted Codex verification that closed P91-C1/C2/C3 surfaced two residual MEDIUM
findings in the validation infrastructure itself. This bounded pass corrects exactly those
two: validation/runtime contracts and regressions only — **no clinical action, placement,
membership, release id, release hash, pointer, ledger entry, or previously published
definition changed**. The one generated-artifact delta is `generated/resolver-release.json`,
whose per-file source digests and roll-up moved because two resolver source files
(`expand-recipe-composition.ts`, `effective-slots.ts`) were edited — provenance by
construction, explicitly not a support boundary, exactly as on every prior source edit.

### P91-C4 — exhaustive composition-action payload validation

**Codex reproduction.** `{ actionType: "set_open_hold_status", payload: { value:
"definitely_not_a_status" } }` loaded through the custom-composition loader and propagated:
the loader's payload-value switch covered only four of the seven action types
(`set_setup_zone`, `set_procedural_phase`, `set_requiredness`, `set_quantity`), and the
evaluator's `set_open_hold_status` case cast an unvalidated string to `OpenHoldStatus`
while `append_note` accepted any truthy string and `remove_slot` payloads were ignored
entirely. Empty payload values were silently skipped rather than refused.

**Corrected contract.** One canonical, strict payload schema per action type
(`domain/schemas.ts`), and one exported dispatch —
`parseProcedureCompositionActionPayload` — used by **every** boundary an action crosses:

- the governed custom-composition seed loader (`demo-context.server.ts`);
- the composition generator reading the governed procedure seed
  (`build-recipe-compositions.ts`);
- the evaluator itself (`expandRecipeComposition`), which now parses **before** target
  matching and applies only validated values — no casts, no truthy-string reads, no silent
  skip of an empty value — so generated and ledger-retained recipes that never pass a seed
  loader are enforced at execution.

The payload contracts: `remove_slot` — exactly `{}` (an authored payload is a typo, refused
rather than ignored); `set_requiredness` — the five requiredness values plus an optional
non-empty-or-null `dependencyRule`; `set_quantity` — `{ expression }` as a literal quantity
expression; `set_setup_zone` / `set_procedural_phase` / `set_open_hold_status` — `{ value }`
over the canonical zone/phase/status vocabularies; `append_note` — `{ note }` non-empty and
non-whitespace-only, applied verbatim (never trimmed). Every payload schema rejects unknown
keys. The enumerations now derive from single exported constants
(`requirednessValues`, `openHoldStatuses`, `procedureCompositionActionTypes`,
`modifierActionTypes` in `domain/types.ts`), so no schema maintains a second hand-written
copy of a vocabulary. The action object itself deliberately stays non-strict at the top
level: the governed seeds' authoring-rationale `reason` field is read by the loaders and
dropped from what the runtime keeps, exactly as before. An action type outside the union
throws a descriptive error naming the type, the action id, and the operation — at the
schema boundary, the dispatch, and the evaluator's own switch default (which previously
satisfied the compiler with a `never` binding and then **returned** the unknown value at
runtime).

**Regression suite.** `composition-action-payload-validation.test.ts` (114 tests):
a fail-closed matrix enumerating every `ProcedureCompositionActionType` — every canonical
value accepted, invented values / malformed shapes / stray keys / empty-and-whitespace
notes / payloads on `remove_slot` rejected — proven at the dispatch, at the evaluator with
in-memory objects that bypass every loader (including an invalid payload on an
optional-target action whose target is absent), and at the real module-load boundary via a
doctored copy of `seed/custom-composition.json` (the Codex reproduction string verbatim, an
unknown action type, an empty note, a `remove_slot` payload — each refuses to load). The
optional-target semantics the custom correction rides on are re-pinned: a **valid**
inapplicable action is still silently skipped.

### P91-C5 — unknown modifier action types fail loudly at runtime

**Codex reproduction.** `modifierActionEffectSummary`'s `default` branch bound the action
type to `never` for the compiler and then returned it at runtime, so a fixture carrying
`actionType: "future_unknown_action"` flowed a malformed row into release-impact data
instead of failing. The effective-slot modifier engine (`applyModifierAction`) had the same
compile-time-only default, which silently resolved a card as though the unknown action had
never been authored.

**Corrected contract.** Both runtime defaults now throw descriptively —
`Unknown modifier action type "future_unknown_action" in action "<id>" while building
release-impact evidence for modifier "<code>".` (release impact) and
`… while applying modifier "<code>" to the effective requirement set.` (card resolution).
`diffReleaseBundles` therefore aborts rather than returning any `modifierEffectChanges`
row, and the release generator — which computes every impact report inside
`buildReleaseBundles` before `main()` writes a single file — exits nonzero with nothing
written. At the source boundary, the generated `modifier-definitions.json` merge in
`demo-context.server.ts` now refuses to load any generated modifier action whose type is
outside the canonical `modifierActionTypes` (the generated modifiers are informational
today — zero actions — but they arrive by cast, and the acting modifiers in
`seed/operational.ts` are compile-time-typed TypeScript).

**Regression suite.** The synthetic F-09 fixture still reports `required` / no dependency →
`conditional` / "Rigid system in use" for valid actions; swapping the action type for
`future_unknown_action` (a runtime cast — the TypeScript union is not weakened) makes
`diffReleaseBundles` throw with the exact message above; a fourteen-action fixture proves
every current `ModifierActionType` routes through the summary and none reaches the default;
`buildReleaseBundles` fed a poisoned loader for the med-thoracoscopy supersession fails the
whole build on the same message; and the effective-slot oracle pins the card-resolution
throw. Every committed release-impact artifact is byte-identical for valid source data.

## Superseded statements

Two 2026-08-09 records are superseded by this pass (kept in place, marked, not rewritten):

1. _"F-04 does not reach the custom module composition … OWNER DECISION"_ and the
   `release-custom-composition-v1-1` scope note — closed by P91-C1;
   `release-custom-composition-v1-2` carries the corrections.
2. _"F-05's section-level re-phase moves two insertable devices on MED_THORACOSCOPY …
   OWNER DECISION"_ — closed by P91-C2 with the governed precedents above;
   `release-med-thoracoscopy-v1-2` carries the per-slot overrides.

## What did not change

No previously published release, recipe, module, composition, definition hash, ledger
entry, or pointer history was mutated (`ip-cards:release:check-base`: additions only). The
D0 audit artifact is byte-identical (`bba2b940…`). No database, Supabase, upload, flag,
navigation, sitemap, or indexing change; no candidate/hidden exposure; no proposal
promotion; no equivalence or substitution inference. `NEXT_PUBLIC_ENABLE_DEVICE_INTELLIGENCE`
remains unset in production.
