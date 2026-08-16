# R0 — redesign baseline decision

**Owner decision record.** This document retires the B5 human-test freeze over learner-facing
flow, declares the change surface for the ECMO Learn-flow rebuild, and records the decisions the
R1 implementation depends on. It is the authority any later package cites when it touches a file
that the B5/B6 baseline table listed as frozen.

- Decided: 2026-08-15 by the repository owner (Russell Miller), on approval of the R0–R1
  implementation plan.
- Evidentiary basis: [`r0-b5-pilot-outcome.md`](./r0-b5-pilot-outcome.md).
- Previous freeze record: `docs/cardiohelp-ecmo/synthetic-review/b6-frozen-human-test-baseline.md`
  on draft [PR #94](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/94)
  (head `3860181e`), pinning production SHA `2f26cb7632fe4e8f6835a8528458b672e8f360c2`.
- Pre-redesign reference build: `origin/main` at `14df243f`, verified byte-identical to
  `2f26cb76` across all twenty-eight pinned files.

---

## D-1 — The B5 freeze served its purpose and is retired for flow work

**Decision.** The freeze is closed, not violated.

The freeze existed to hold one build stable while human think-aloud sessions ran against it. The
sessions were attempted; they ended in a task-blocking navigation failure and produced no
codable findings (`r0-b5-pilot-outcome.md`, O-1 to O-4). A freeze whose study has concluded
without measurable output has no further protective work to do: continuing to hold the build
preserves the exact structure that blocked the study.

The freeze is therefore **retired with respect to navigation, ordering, framing, and
learner-facing flow.** It is not retired with respect to anything in D-4.

## D-2 — Learner-facing flow may now change deliberately

**Decision.** Navigation, entry points, section ordering as _presented_, section framing, and
learner-facing wording on entry surfaces are open to deliberate change, subject to the normal
contracts (copy lint, leakage rules, evidence policy, accessibility).

"Deliberate" means: each change is named in a plan, carries a test, and cites this record.
Nothing about D-2 authorises incidental edits discovered mid-implementation.

## D-3 — The six pilot panels are no longer frozen against sequence-enabling change

**Decision.** The six pilot teaching panels
(`StartupSensorOrientationPanel`, `PreloadDrainageCollapsePanel`, `VvRecirculationPanel`,
`GasSourceInterruptionPanel`, `ArterialBubbleStopPanel`, `VaDifferentialHypoxemiaPanel`) are
released from the byte-freeze **to the extent a change is necessary to create a usable learner
sequence.**

They remain protected by every content contract that is not the freeze: persistent scenario and
activity identifiers; the pre-commitment leakage contract; answer/verdict semantics; evidence
and source policy; the engine coupling their live values depend on; and their non-credit draft
status. A panel edit that is not required by the sequence is out of scope by default.

**R1 changes none of them.** D-3 grants a permission that R1 does not exercise; it exists so a
later package (the Circuit Walk, the shared minimap, the localization card) is not blocked by a
freeze whose study has ended.

## D-4 — Protected contracts, unchanged

The following remain protected. A conflict with any of them is an owner decision, never an
implementation assumption:

- Route paths, and the `?lesson=` / `?track=` / `?case=` / `?phase=` query contract.
- Scenario identifiers, section identifiers, activity identifiers.
- The progress storage key `cardiohelp-ecmo-progress-v1` and envelope `version: 2`.
- Scoring, mastery rules, and credit semantics.
- Engine physiology: `engine/simulation.ts` and `engine/reducer.ts` response behaviour.
- Practice behaviour and Assess behaviour, including their case and capstone definitions.
- Evidence and source policy, registered value guides, and the no-invented-threshold rule.
- Publication and credit eligibility: `cardiohelpEcmoPublicationStatus` stays `draft`, the
  module stays public-unlisted and `noindex`, and nothing here makes any content
  credit-eligible.

## D-5 — Future human testing uses a newly declared baseline

**Decision.** The next human round declares its own baseline commit, recorded in a new file
under `docs/cardiohelp-ecmo/validation/`, stamping the commit SHA, the worktree, the branch, and
the start-state test result — the way the B6 record stamped `2f26cb76`.

`2f26cb76` is retired as a testing baseline. It is retained as history and as the provenance of
the ported B6 registers.

The next round also adopts the navigation-competence precondition described in
`r0-b5-pilot-outcome.md` §6: if a learner cannot reach the intended starting point unaided, the
clinical tasks are not interpretable and the session stops there.

## D-6 — Draft PR #94 stays held

**Decision.** B6 owner decision OD-01 is re-affirmed without change. PR #94 is not merged, not
rebased, not edited, and not cherry-picked. Its fourteen draft panels remain draft,
non-credit-eligible, and held from deployment.

R0 ports four of its documents forward as records, verbatim with provenance headers only; see
[`r0-pr94-migration-matrix.md`](./r0-pr94-migration-matrix.md). Porting a record is not
promoting content.

## D-7 — B6 owner decision OD-13 is resolved

OD-13 asked: _should foundations be the default entry, how should the intentionally open
capstone be named, and must every transfer CTA be mechanism-matched?_ Its disposition was
"Owner must define the intended sequence before code changes."

**Decision, the part R1 needs:** the intended learner sequence is the canonical order in
`learningPathways.ts` — seventeen sections per track, beginning at
`why-extracorporeal-support`, with console orientation in position seven. Every primary entry
call to action resolves to the learner's next incomplete section of that order. The seven-unit
curriculum view becomes a presentation of that same order, never a competing one.

**Explicitly still open in OD-13:** capstone nomenclature (`prerequisite` / `unlock` /
`capstone-unlocked` naming that may imply gating the interface does not enforce), and
mechanism-matched transfer CTAs (B6-010). Both are out of scope for R0–R1.

Browsing stays open. This decision introduces no URL gating, no prerequisite locks, and no
inaccessible route. Recommendation is not restriction.

## D-8 — R1 decisions recorded

| ID          | Decision                                                                                                             | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OD-R1-A** | How foundation-section completion is tracked, given that the foundation activity deliberately persists nothing today | **Option A.** `ProgressV2` gains an optional `completedFoundationSectionIds`, shaped exactly like the existing optional `lastVisited` field (absent → omitted; present-but-invalid → whole envelope rejected). The storage key and `version: 2` are unchanged, so existing envelopes load with no migration. The marker is written on **transfer-item commit**, not on a navigation click: every one of the seventeen sections has a transfer item, including both integration capstones, whereas the "Continue to next section" control does not render on the last section — writing there would make the all-complete state unreachable. The field means **worked**, never mastered: it feeds navigation only, and never scoring, mastery, credit, or the shared critical-care envelope. Inferring completion from later drill activity was rejected as fabricating traversal the learner may not have made. |
| **OD-R1-B** | Which formerly frozen files R1 may modify                                                                            | `CardiohelpModuleNav.tsx` (descriptions only — the four nav titles are pinned by `criticalCareShellConvergence.test.tsx` and stay); `engine/types.ts` and `engine/progress.ts` (additive only, per OD-R1-A); `EcmoFoundationLessonActivity.tsx` (the single traversal write and its contract comment). Every other file in the retired frozen table is untouched by R1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **OD-R1-C** | Must a fresh learner choose a track before the shared foundations?                                                   | **No.** No gate anywhere. The door defaults to VV by the existing resolution order (URL → last visited → VV), the first four sections are shared by both tracks, and the track chooser gains a decision aid rather than a barrier.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **OD-R1-D** | How the hub presents the seven-unit view                                                                             | **Derived grouping.** The units become a presentation of the canonical seventeen-section order, contract-tested so the grouped order flattens exactly to the canonical order and every section appears exactly once.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## D-9 — What the retired freeze is replaced by

Deleting a freeze without a replacement contract would leave the identifiers and order it
incidentally protected unguarded. The replacement is
`src/features/cardiohelp-ecmo/__tests__/redesign-baseline-contracts.test.ts`, which pins
identity and order rather than bytes: both tracks' full section-ID sequences, the drill, case
and capstone identifier sets, the foundation identifier set, the deep-link shape, and the draft
publication status.

The full disposition of every current freeze-enforcing artifact — retain, re-scope, narrow,
extend, or superseded — is
[`r0-freeze-contract-inventory.md`](./r0-freeze-contract-inventory.md). No failing freeze test
is removed there without a named replacement.

---

## Scope retained

R0 changes no runtime behaviour. R1 is bounded by the plan's out-of-scope list: no Circuit Walk,
no minimap, no localization card, no Three Knobs, no Watershed Explorer, no foundation-prose
rewrite, no panel migration, no Practice or Assess change, no engine change, no critical-care
shell redesign, and no change to any B6 backlog item other than B6-011.
