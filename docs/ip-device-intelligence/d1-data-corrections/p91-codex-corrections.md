# P91 Codex corrections (2026-08-10) — bounded post-review pass on the D1.1 governed-data corrections

An independent Codex review of the frozen PR #91 pair
`2f26cb76 → e833b97f` confirmed three findings against the 2026-08-09 D1.1 correction pass.
This pass corrects exactly those three. It reopens nothing else: F-06, F-10, the owner
packets (F-21/F-30/F-33), the F-09 blocker, and every other verified part of PR #91 are
untouched except where a regression now protects them.

| #      | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                            | Disposition |
| ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| P91-C1 | HIGH     | F-04 remained wrong in **current custom cards**: server-side save resolution through `release-custom-composition-v1-1` with the EBUS-specific and therapeutic-specific modules selected still placed all six owner-named sampling instruments at specimen_station / specimen_handling. The v1-1 release notes carried this as an accepted limitation; the correction pass rejects that framing — custom-card creation is a real authoring surface. | **FIXED**   |
| P91-C2 | HIGH     | The F-05 section-level `Drainage` re-phase over-reached on MED_THORACOSCOPY: two **insertable devices** that share the section — `SLOT-57CA4B1298` ("Post-procedure chest tube") and `SLOT-9A1C0491F9` (IPC insertion kit, "IPC placement planned") — moved to pre_induction_or_sedation alongside the actual drainage-preparation hardware.                                                                                                       | **FIXED**   |
| P91-C3 | MEDIUM   | The canonical release-impact report (`generated/release-impact-report.json`) omitted all six F-04 semantic changes: `diffReleaseBundles` indexed **raw module slots** and never applied composition actions, so an action-borne change was invisible at exactly the boundary the release review reads.                                                                                                                                             | **FIXED**   |

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
the offered module set.

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
