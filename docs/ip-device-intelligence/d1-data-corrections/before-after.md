# Before / after ledger — D1.1 governed-data corrections

Base: `origin/main` @ `2f26cb7632fe4e8f6835a8528458b672e8f360c2` (PR #88 merge). All "before"
values were captured on that tree and reproduced byte-identically by the generators before
any edit (import, scenarios, compositions, releases, audit all left `git status` clean).

## D0 audit

|                                     | before                                                             | after                                                              |
| ----------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `data-readiness-audit.json` SHA-256 | `8c179ce21b3cee48e78d4e90de49f161adb0799e675edb52b7fa0b6950cae541` | `bba2b9402cbfe4a4fbdca4fcb41c61f49ddf473838b2f1c89752e26abfd900ee` |
| global.procedureSlots               | 233                                                                | 232                                                                |
| global.authoredSlotOptions          | 2073                                                               | 2035                                                               |
| global.slotOptionProposals          | 813                                                                | 831                                                                |
| EBUS_TBNA slots (req/cont/opt)      | 15 (7/4/4)                                                         | 17 (7/6/4)                                                         |
| THERAPEUTIC_BRONCH slots            | 29 (3/21/5)                                                        | 30 (3/22/5)                                                        |
| CHEST_TUBE slots                    | 13 (3/7/3)                                                         | 9 (3/4/2)                                                          |

Full semantic classification: [audit-diff.md](./audit-diff.md).

## Template rows (`generated/procedure-slots.json`, via reviewed overlays)

Removed (F-06, `reviewed/procedure-template-corrections.json`): `SLOT-D02F71E583`
(IPC_INSERTION_KIT), `SLOT-B4E5C6A7A9` (IPC_DRAINAGE_KIT), `SLOT-702914B1CF`
(IPC_DRESSING_KIT), `SLOT-67171A33D4` (IPC_MANAGEMENT_ACCESSORY) — all CHEST_TUBE /
Long-term drainage — together with their 38 authored option rows (13/12/2/11), which exist
byte-identically on the IPC_PLACEMENT slots `SLOT-1BCF3D0702` / `SLOT-3FBC244FAF` /
`SLOT-6693BCAEE1` / `SLOT-1E91C231E5`.

Added (F-10, `reviewed/procedure-additions.json`, content copied verbatim from governed
precedent rows): `SLOT-2147BE329B` (EBUS_TBNA BITE_BLOCK ← THERAPEUTIC_BRONCH
`SLOT-D6B291DC80`), `SLOT-0306E7B77D` (EBUS_TBNA GENERIC_AIRWAY_ADAPTER ← TB_RULEOUT
`SLOT-763A2D63F1`), `SLOT-190EFC825B` (THERAPEUTIC_BRONCH GENERIC_AIRWAY_ADAPTER ← same).

## Zone/phase (composed expansions of the current releases)

| Requirement                                                                                                  | before                               | after                                       | finding |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------- | ------- |
| EBUS FNA needle `SLOT-1AF4BEFE3B`                                                                            | specimen_station / specimen_handling | back_table / diagnostic                     | F-04    |
| EBUS FNB needle `SLOT-B83EBD2FBB`                                                                            | specimen_station / specimen_handling | back_table / diagnostic                     | F-04    |
| EBUS mini-forceps `SLOT-D08C74941A`                                                                          | specimen_station / specimen_handling | back_table / diagnostic                     | F-04    |
| EBUS vacuum syringe `SLOT-E8F0B48B49`                                                                        | specimen_station / specimen_handling | back_table / diagnostic                     | F-04    |
| TB biopsy forceps `SLOT-D2974FC11B`                                                                          | specimen_station / specimen_handling | back_table / diagnostic                     | F-04    |
| TB BAL kit `SLOT-FDF73730B0`                                                                                 | specimen_station / specimen_handling | back_table / diagnostic                     | F-04    |
| EBUS specimen containers `SLOT-12ACA27E54`, wash/BAL trap `SLOT-76F4405D68`; TB containers `SLOT-0F8FA96C28` | specimen_station / specimen_handling | unchanged (negative control)                | F-04    |
| EBUS balloon `SLOT-93655BF7C4`, needle adapter `SLOT-CD12842559`                                             | back_table / diagnostic              | unchanged (negative control)                | F-04    |
| 10 Drainage-section slots (CHEST_TUBE ×3, IPC_PLACEMENT ×2, MED_THORACOSCOPY ×3, THORACENTESIS ×2)           | equipment_tower / post_procedure     | equipment_tower / pre_induction_or_sedation | F-05    |
| DRESSING_SECUREMENT `SLOT-4BE1D79D6C`, `SLOT-01010CB364`                                                     | post_procedure                       | unchanged (negative control)                | F-05    |

## Module versions

| Module                                                                      | before                | after                                                          | why        |
| --------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------- | ---------- |
| FLEX_BRONCH_CORE                                                            | v1.0 (2 requirements) | v1.1 (4: + FLEX_BRONCH_BITE_BLOCK, FLEX_BRONCH_AIRWAY_ADAPTER) | F-10       |
| THERAPEUTIC_BRONCH_SPECIFIC                                                 | v1.0                  | v1.1 (bite block re-homed to the core)                         | F-10       |
| CHEST_TUBE_SPECIFIC                                                         | v1.0                  | v1.1 (−4 IPC rows; Drainage re-phase)                          | F-05, F-06 |
| THORACENTESIS_SPECIFIC / IPC_PLACEMENT_SPECIFIC / MED_THORACOSCOPY_SPECIFIC | v1.0                  | v1.1 (Drainage re-phase)                                       | F-05       |
| every other module                                                          | v1.0                  | unchanged                                                      | —          |

All six v1.0 predecessors remain verbatim in `module-ledger.json` (19 → 25 entries).

## Recipes and releases

| Procedure              | recipe before → after                 | release before → after (pointer)                                      |
| ---------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| EBUS_TBNA              | recipe-ebus-tbna-v0-1 → v0-2          | release-ebus-tbna-v1-0 `db46d9cca5db…` → **v1-1 `9fac0962db91d8e9…`** |
| THERAPEUTIC_BRONCH     | v0-1 → v0-2                           | v1-0 `10b7a6ed40b4…` → **v1-1 `2105ccd346777f6f…`**                   |
| CHEST_TUBE             | v0-1 → v0-2                           | v1-0 `ccfa44053d10…` → **v1-1 `30e3aabc01467aaa…`**                   |
| THORACENTESIS          | v0-1 → v0-2                           | v1-0 `e4d69a5f09af…` → **v1-1 `7d2900ed02977cde…`**                   |
| IPC_PLACEMENT          | v0-1 → v0-2                           | v1-0 `6b51ab3cc173…` → **v1-1 `0db14ddecb1c01fe…`**                   |
| MED_THORACOSCOPY       | v0-1 → v0-2                           | v1-0 `8b8878eb3f02…` → **v1-1 `b53baacd1dafa2f0…`**                   |
| CUSTOM_COMPOSITION     | recipe-custom-composition-v1-0 → v1-1 | v1-0 `229c870d61ff…` → **v1-1 `65be5c3697fc3970…`**                   |
| the other 9 procedures | unchanged                             | unchanged, pointers unchanged                                         |

Every superseded release stays `published` in the seed with its frozen hash byte-identical to
`origin/main`; `check-publication-baseline` reports 54 base entries unchanged, 0 lifecycle
moves, and only additions on this branch. The seven v0-1/v1-0 recipe definitions are retained
verbatim in the new `generated/composition-ledger.json` (16 entries at introduction, 23 after
publication), and the historical-reconstruction regressions prove the old expansions still
produce their original semantics (15/29/13 slots, needles at the specimen station, IPC lines
present, drainage post-procedure, two-requirement flex core, nineteen v1-0 custom modules).

## P91 Codex correction pass (2026-08-10)

Base for this pass: PR #91 head `e833b97f`. Full record:
[p91-codex-corrections.md](./p91-codex-corrections.md).

| Requirement (composed expansions of the current releases)                     | before (e833b97f)                           | after                                          | finding |
| ----------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------- | ------- |
| The six F-04 instruments on a **current custom card** selecting their modules | specimen_station / specimen_handling        | back_table / diagnostic                        | P91-C1  |
| MED_THORACOSCOPY chest tube `SLOT-57CA4B1298` (procedure + custom)            | equipment_tower / pre_induction_or_sedation | sterile_field / therapeutic                    | P91-C2  |
| MED_THORACOSCOPY IPC kit `SLOT-9A1C0491F9` (procedure + custom)               | equipment_tower / pre_induction_or_sedation | sterile_field / therapeutic                    | P91-C2  |
| MED_THORACOSCOPY drainage unit `SLOT-AA3C2EAA6D`                              | equipment_tower / pre_induction_or_sedation | unchanged (intended F-05 move stands)          | P91-C2  |
| Canonical impact report, EBUS/THERAPEUTIC v1-0→v1-1 rows                      | six F-04 slot ids absent                    | all six `changed (setupZone, proceduralPhase)` | P91-C3  |

| Recipes and releases    | before                                         | after (pointer)                                        |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| MED_THORACOSCOPY        | recipe v0-2 / release v1-1 `b53baacd1dafa2f0…` | recipe **v0-3** / release **v1-2 `4386eb65a183cf06…`** |
| CUSTOM_COMPOSITION      | recipe v1-1 / release v1-1 `65be5c3697fc3970…` | recipe **v1-2** / release **v1-2 `3d9139efcd2c7ca4…`** |
| the other 14 procedures | unchanged                                      | unchanged, pointers unchanged                          |

Composition ledger 23 → 25 entries (`recipe-med-thoracoscopy-v0-3`,
`recipe-custom-composition-v1-2` appended; nothing rewritten). Module ledger unchanged (the
P91-C2 correction is recipe-authored; MED_THORACOSCOPY_SPECIFIC stays v1.1). D0 audit
byte-identical (`bba2b940…`) — composition actions are not audit inputs.
