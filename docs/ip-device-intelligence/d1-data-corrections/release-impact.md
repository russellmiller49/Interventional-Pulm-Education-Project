# Release impact ledger — the seven v1-1 supersessions

Produced by `npm run ip-cards:releases` (`generated/release-impact-report.json`); reviewed at
the requirement level before any hash was frozen or any pointer moved. Every row below was
matched one-to-one against an owner finding; nothing unexplained appeared.

> **Corrected by the P91 Codex pass (2026-08-10)** — see
> [p91-codex-corrections.md](./p91-codex-corrections.md). The impact generator now diffs the
> **final effective recipes** (composition actions applied through the canonical evaluator),
> so the EBUS/THERAPEUTIC_BRONCH rows below additionally carry the six F-04 per-requirement
> zone/phase changes the original artifact omitted, and two further supersessions exist:
> `release-med-thoracoscopy-v1-2` (P91-C2, two insertable-device per-slot overrides) and
> `release-custom-composition-v1-2` (P91-C1/C2, sixteen authored custom-composition
> actions). The "(F-04 via recipe pin, see below)" cells and the "Known reporting gap"
> section are retained below as the superseded historical record.

| Procedure          | old release            | new release            | old pins → new pins                                          | requirements added                                                  | removed                                                                   | requiredness changed | zone changed                     | phase changed                                                                                                                                         | pointer advanced | historical retained |
| ------------------ | ---------------------- | ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------- |
| EBUS_TBNA          | release-ebus-tbna-v1-0 | release-ebus-tbna-v1-1 | recipe v0-1→v0-2, flex-core v1-0→v1-1                        | FLEX_BRONCH_BITE_BLOCK, FLEX_BRONCH_AIRWAY_ADAPTER (F-10)           | —                                                                         | —                    | (F-04 via recipe pin, see below) | (F-04 via recipe pin)                                                                                                                                 | yes              | yes                 |
| THERAPEUTIC_BRONCH | …-v1-0                 | …-v1-1                 | recipe v0-1→v0-2, flex-core v1-0→v1-1, tb-specific v1-0→v1-1 | FLEX_BRONCH_BITE_BLOCK, FLEX_BRONCH_AIRWAY_ADAPTER                  | SLOT-D6B291DC80 (the same bite-block line, re-keyed into the core — F-10) | —                    | (F-04 via recipe pin)            | (F-04 via recipe pin)                                                                                                                                 | yes              | yes                 |
| CHEST_TUBE         | …-v1-0                 | …-v1-1                 | recipe v0-1→v0-2, chest-tube-specific v1-0→v1-1              | —                                                                   | SLOT-D02F71E583, SLOT-B4E5C6A7A9, SLOT-702914B1CF, SLOT-67171A33D4 (F-06) | —                    | —                                | SLOT-3631C94D7A, SLOT-CE48C1B108, SLOT-AECDA16326 (F-05)                                                                                              | yes              | yes                 |
| THORACENTESIS      | …-v1-0                 | …-v1-1                 | recipe v0-1→v0-2, thoracentesis-specific v1-0→v1-1           | —                                                                   | —                                                                         | —                    | —                                | SLOT-CA34F60BE9, SLOT-C174DA0A4E (F-05)                                                                                                               | yes              | yes                 |
| IPC_PLACEMENT      | …-v1-0                 | …-v1-1                 | recipe v0-1→v0-2, ipc-placement-specific v1-0→v1-1           | —                                                                   | —                                                                         | —                    | —                                | SLOT-3FBC244FAF, SLOT-27D1A61598 (F-05)                                                                                                               | yes              | yes                 |
| MED_THORACOSCOPY   | …-v1-0                 | …-v1-1                 | recipe v0-1→v0-2, med-thoracoscopy-specific v1-0→v1-1        | —                                                                   | —                                                                         | —                    | —                                | SLOT-57CA4B1298 ("Post-procedure chest tube"), SLOT-AA3C2EAA6D (drainage unit), SLOT-9A1C0491F9 (IPC insertion kit) (F-05 — see the owner follow-ups) | yes              | yes                 |
| CUSTOM_COMPOSITION | …-v1-0                 | …-v1-1                 | recipe v1-0→v1-1 + the six module pin moves above            | the F-05/F-06/F-10 rows above (NOT F-04 — see the owner follow-ups) | the F-06/F-10 removals/additions above                                    | —                    | —                                | the F-05 phase rows above                                                                                                                             | yes              | yes                 |

Set pins (`definition-set-modifiers`, `-rescue-modules`, `-compatibility-rules`,
`-role-taxonomy`): **unchanged on every release** — F-09 was deliberately not applied, and no
other correction touches `operational.ts` or the role taxonomy.

## Known reporting gap: F-04 is inside the recipe pin, not the requirement diff

> **SUPERSEDED (2026-08-10, P91-C3).** This gap is closed: `diffReleaseBundles` expands the
> exact old and new pinned recipes/modules through `expandRecipeComposition` and diffs the
> effective requirement definitions, so the canonical generated report now names all six
> F-04 slots with `changed (setupZone, proceduralPhase)`. The report also gained a generic
> authored **modifier-effect** layer (`modifierEffectChanges`) — fixture-proven now, and
> live once releases pin per-bundle definition sets (PR #92's retention mechanism), so its
> F-09 review reports the requirement-level effect rather than only a set-pin hash. The
> paragraph below is the superseded historical record.

`diffReleaseBundles` indexes requirements from module and recipe _slots_; it does not apply
composition actions. F-04 is authored as per-slot `set_setup_zone` / `set_procedural_phase`
actions inside the new recipe versions, so the EBUS/THERAPEUTIC*BRONCH impact rows show the
recipe pin moving but no per-requirement `setupZone`/`proceduralPhase` line for the six
instruments. The semantic delta is instead proven directly at the expansion level —
`governed-data-corrections-2026-08-09.test.ts` pins the corrected zone/phase for all six
slots in the v0-2 recipes \_and* the original zone/phase in the retained v0-1 recipes — and
recorded in [before-after.md](./before-after.md). Follow-up worth proposing to the owner:
teach `diffReleaseBundles` to diff the _expanded default composition_ so action-borne changes
appear in the impact report natively.

## Publication mechanics

- Two-pass freeze, per the release workflow: drafts (no hash) → build reports hashes and
  impacts → hashes/catalog/resolver context frozen, `publishedAt: 2026-08-09T00:00:00.000Z`,
  pointers advanced → clean re-run.
- The new bundles record the current resolver provenance
  (`resolverImplementationHash 72ea5fc7…`, moved by the `expand-recipe-composition.ts`
  payload-validation hardening alone — the ledger modules are not resolver sources); the v1-0 bundles keep the
  provenance they published with (`ad1228ff…`). The resolver _contract_ version is unchanged
  (`ip-cards-resolver-contract/1`).
- `check-publication-baseline` against `origin/main` (merge base `2f26cb7632fe`): 54
  published base entries unchanged, 0 lifecycle advances, all v1-1 releases / v1.1 modules /
  new ledger content reported as additions. The v1-0 releases were left `published` (not
  retired): they no longer back new cards (pointers moved), and retiring them is a separate
  lifecycle decision the owner can take at any time.

## Owner follow-ups surfaced by adversarial review (2026-08-09)

> **BOTH SUPERSEDED (2026-08-10).** Codex independently reproduced both items as findings
> P91-C1 and P91-C2 and this correction pass closed them —
> [p91-codex-corrections.md](./p91-codex-corrections.md). Item 1: the custom composition now
> carries an authored action channel (`seed/custom-composition.json`,
> `release-custom-composition-v1-2`) and current custom cards resolve the six instruments at
> back_table / diagnostic. Item 2: the two MED_THORACOSCOPY insertable rows carry per-slot
> overrides to sterile_field / therapeutic per their governed home-procedure precedents
> (`release-med-thoracoscopy-v1-2`). The original statements are retained below as the
> historical record.

Two ripple effects of the applied corrections were confirmed by the pre-commit adversarial
review and are surfaced here as explicit owner items rather than silently authored around:

1. **F-04 does not reach the custom module composition.** The zone/phase overrides are
   recipe-level composition actions on the EBUS and therapeutic recipes; the custom
   composition (`recipe-custom-composition-v1-1`) is derived from modules with no action
   channel, so a custom card that selects the EBUS-specific or therapeutic-specific module
   still renders the six sampling instruments at the specimen station — the same values it
   rendered before this pass (no regression, and no D1 route is affected). Closing it needs
   either the section-level template split the owner's F-04 offered as the alternative
   mechanism, or authored action support for the custom composition. OWNER DECISION.
2. **F-05's section-level re-phase moves two insertable devices on MED_THORACOSCOPY.**
   `SLOT-57CA4B1298` (post-thoracoscopy small-bore chest tube, whose label says
   post-procedure) and `SLOT-9A1C0491F9` (optional IPC insertion kit) sit in section
   `Drainage`, so they moved to pre_induction_or_sedation with the rest of the section —
   exactly what F-05's expected behaviour prescribed, but these two are catheters rather
   than drainage hardware, and the same roles phase as `therapeutic` on their home
   procedures. Whether they should carry a per-slot override (the F-04 mechanism) is a
   clinical statement this pass does not invent. OWNER DECISION.
