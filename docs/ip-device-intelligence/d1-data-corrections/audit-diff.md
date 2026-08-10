# D0 audit — semantic classification of every change

`npm run ip-intel:audit` was re-run canonically after the data corrections. The audit was
**expected** to change; the old artifact/hash was retained first and every changed path is
classified below against the owner finding that explains it. No golden value was updated
blind: the byte-drift test (`audit-data-readiness.test.ts`) was re-pinned only after this
classification, and each re-pin records old value, new value, and the finding.

Hashes: `8c179ce21b3cee48e78d4e90de49f161adb0799e675edb52b7fa0b6950cae541` →
`bba2b9402cbfe4a4fbdca4fcb41c61f49ddf473838b2f1c89752e26abfd900ee`.

The audit contains **no zone/phase or section fields** (verified: zero occurrences), so F-04
and F-05 cannot and do not appear in it. Every audit delta traces to F-06 and F-10:

## Global block

| Path                                                            | old → new   | Explained by                                                                                                                                                |
| --------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `global.procedureSlots`                                         | 233 → 232   | F-06 (−4 CHEST_TUBE IPC rows) + F-10 (+3 flex-core rows)                                                                                                    |
| `global.authoredSlotOptions`                                    | 2073 → 2035 | F-06: the four removed rows carried 38 authored options; identical sets remain on IPC_PLACEMENT                                                             |
| `global.slotOptionProposals` / `proposalStatusSplit.unreviewed` | 813 → 831   | F-10: the three new rows are proposal-only roles, so the deterministic proposal generator emits 18 more machine proposals (EBUS +10, THERAPEUTIC_BRONCH +8) |
| `global.selectableAndVisibleSlotOptions`                        | 942 → 909   | F-06: the selectable subset of the 38 removed option rows                                                                                                   |

## CHEST_TUBE (F-06)

- `slots.total` 13 → 9; `requiredness` {3,7,3} → {3,4,2} (one optional + three conditional
  IPC rows left).
- `roleCoverage.roles`: the four `IPC_*` role entries are gone; `distinctRoles` 13 → 9.
- `ladder.rolesWithSelectableAuthoredOption` 8 → 4 (the IPC roles were the procedure's
  best-covered content — the exact imbalance the owner named in F-06).
- `dependencies` / `compatibility` / `localAvailability` / `sourceVerification` /
  `dimensionGaps`: the IPC-derived entries drop out (e.g. the dimension-gap denominator
  loses the IPC-only authored-option products — the D1 gaps preview count moved 89 → 70,
  re-pinned in `outputs.test.ts` with the rationale in place).

## EBUS_TBNA (F-10)

- `slots.total` 15 → 17; contingency 4 → 6 (both new rows conditional).
- `roleCoverage.roles`: + `BITE_BLOCK`, + `GENERIC_AIRWAY_ADAPTER`;
  `ladder.rolesWithOnlyProposals` 2 → 4 — both new roles have proposals and no authored
  options, honestly reported as proposal-only (never selectable, never coverage).
- `dependencies`: + the two new dependency rules; `localAvailability` /
  `needsReviewBeforePublic`: the new proposal-only roles join the authoring queue.

## THERAPEUTIC_BRONCH (F-10)

- `slots.total` 29 → 30; contingency 21 → 22 (new adapter row conditional).
- `roleCoverage.roles`: + `GENERIC_AIRWAY_ADAPTER`; `rolesWithOnlyProposals` 7 → 8.
- The BITE_BLOCK role was already on this procedure; its row merely re-homed to the shared
  core, which the audit (keyed by role and slot counts) does not distinguish — no change.

## What deliberately did not change

- `workbookSha256` (`fb25b24e…`) — the protected workbook was not touched; all template
  changes are reviewed overlays.
- `catalogReleaseId` (`8ece7648…`) — slots are not among the catalog-release inputs.
- The 12 non-exemplar procedures' audit blocks, all readiness semantics, the coverage-ladder
  vocabulary, and the proposal governance (unreviewed counts only).
