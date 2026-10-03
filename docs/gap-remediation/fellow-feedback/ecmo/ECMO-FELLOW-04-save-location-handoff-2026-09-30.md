# ECMO Batch04 — location-only exit disclosure

This closes only the mechanical disclosure portion of S2-6 from the September19 ECMO
implementation pack. It is not the full Batch04 or combined acceptance.

## Scope and ownership

Base: freshly fetched `origin/main`, `46c5bb94f779a1464da6198bba4bcf8550379419`.
Branch: `codex/ecmo-resume-disclosure-20260930`, in its own worktree.

The fresh 22-open-PR inventory includes actual bases, exact heads, descriptions and all
changed paths. No selected path intersects an open PR. #134 changes adjacent ECMO stages,
feedback and shared layout; #308 changes shared theme storage handling. Those changes are
separate work, not repeated or modified here. Relevant implementation trees were clean;
allowed process working-directory checks found no current ECMO writer. Comprehensive live
session ownership was unavailable; clean trees do not certify every session's intent.

CRRT `fb6f3910`, Hemodynamics `11d7c6fb` and ECMO `046ae64a`, acceptance evidence and dirty
roadmap notes remain intact. Literature and Device Intelligence are user-owned and excluded.
Medical thoracoscopy/Wolf is held. No other checkout, shared helper or roadmap ledger was edited.

## Before and after

Before, Save & exit had no accessible description of what was saved, and the hub's case
return link said **Return to your saved work**. Existing restore notices appeared only after
reopening. The current engine stores self-paced topic/location metadata separately from
historical fields; it does not restore a learner's answers, snapshots or simulator actions.

The activity header now explains this boundary before exit and connects the visible note
to Save & exit through `aria-describedby`. The case link now says **Return to your saved
location**, keeping its existing title and destination. The note appears only when the
header actually offers Save & exit. Existing exit callbacks and reopen behavior are unchanged.

Learn deliberately uses the pathway Continue link rather than the saved-case aside. A first
baseline browser probe incorrectly expected that aside after Learn exit and timed out; the
log and already-captured unchanged-header screenshot are retained. That was a probe assumption,
not a product defect. Final journeys separately exercise Learn reopening and the Practice link.

No new storage, migration, grading, required acknowledgement, prediction gate, physiology,
clinical terminology, source approval or permission was added. S2-6's requested persistence
expansion is still an owner decision; this slice implements the pack's authorized disclosure.

## Verification

| Check                                                                          | Actual result                                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused regressions before implementation                                      | 3 failed, 11 passed across two suites                                                                                                                                                             |
| Final focused Jest                                                             | 205 tests passed across six suites; exit disclosure, hub, phase restoration, foundation activity, workbench/header and rendered precommit boundaries                                              |
| Final Chromium                                                                 | Four passed: Learn at 1440×900, 390×844, 390×844 with 200% root text; Practice saved-location destination and keyboard reopening                                                                  |
| UI/storage behavior                                                            | Notice visible and associated with exit; no document horizontal overflow; actual next-step/exit/reopen; unchanged synthetic historical fields; fresh Learn opening; existing Practice destination |
| ESLint, Prettier and whitespace                                                | Passed for changed paths                                                                                                                                                                          |
| Full module/repository suites, TypeScript and production build                 | Not run for this bounded two-component disclosure change; production acceptance remains outstanding                                                                                               |
| Native browser zoom, other engines, screen-reader software and clinical review | Not performed; root-text enlargement is not native zoom                                                                                                                                           |

The dev preview did not carry private environment credentials or serve all sparse-excluded
model/media assets. Telemetry logged missing Supabase configuration; persistence of analytics
and 3D/media fidelity were not validated. No configuration or shared service was changed.
No long deterministic job requiring `codex-run-and-wake` or broad costly suite was launched.

## Evidence and next review

Evidence is outside Git at:
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/beta-build-reconciliation-20260930/`.
It contains the nine-module reconciliation, full fresh PR inventory, worktree inventory,
before/after logs, screenshots, browser report, sanitized preview log and exact commit checkpoint.
All browser data is synthetic and isolated; no owner profile or patient data was used.

Independent review of this local commit is next. The rest of ECMO04 and clinical/device
decisions remain pending. HD03 presentation and scoped existing-PR repairs are independent
assignment candidates after matching their specific files and active owners. No push, PR,
merge, deployment, publication or new implementation tranche was performed.

## PR #315 final repair and current-main integration — October 2, 2026

Verified submitted PR head: `0326ed6218fbbc657f06846d09f06559713b2966`.
The handoff's known main, `f962a3819b5e8d946de59b2401532a3ed681ae6a`, was
already an ancestor of fetched main `e961695391bebdadb7c5f3fb95438ea3f6b1acbe`.
Reviewed the intervening commit inventory and all 133 changed paths since original
base `46c5bb94f779a1464da6198bba4bcf8550379419`: peripheral imaging, MCS, device
comparison, Wolf preview, and beta capture. There was no overlap with the PR's
eight paths or change to ECMO storage, engine, routes, or shared lesson stage.
The shared site-access change adds only Wolf preview destinations. Integrated main
with true merge `14066d961abdd05caffeadc5735091147e5e86ac`, retaining the submitted
head and fetched main as its two parents. Tested repair commit:
`b023ff890784e686860ec10809b8ddf451d7683b`.

The visible notice and focused Jest/E2E expectations now say:

> Save & exit saves your location, not the current teaching or case state. Your existing progress history is retained. Reopening starts fresh; answers, snapshots, and simulator actions from this run are not restored.

The storage boundary was independently traced through the current Learn and
Practice routes, `FoundationStageHost`, `foundationSession`, `useEcmoSessionCore`,
and `engine/progress.ts`. Learn initializes fresh session/progression reducers;
Practice loads the authored scenario and creates fresh view state. Current answers,
model state, snapshots, comparisons, and action records are session-only.
`writeLearningProgress` stores only visited topics, last visited location, and
per-track lesson/case IDs under `selfPaced` in the existing storage key, spreading
the historical outer envelope unchanged. Foundation Save & exit navigates after
the existing topic-visit write; Practice writes that same location payload before
navigation. Neither exit callback erases history. No persistence code changed.

Production Chromium journeys now commit a Learn answer before exit at desktop,
phone, and phone with 200% root text, reopen through the actual hub destination,
and verify empty answer state. Practice commits a prediction, inspects the gas
pathway, reconnects the gas source through its simulator control, exits, follows
**Return to your saved location** by keyboard, and verifies fresh prediction and
disconnected-gas state. A fifth journey captures a reference snapshot, runs 20
modeled seconds, exits/reopens, and verifies that captured-snapshot teaching and
action evidence are cleared. Synthetic stored attempt counts, best scores, critical
error flags, mastery, completed labs/lessons/foundation sections, and an unknown
historical field remain unchanged in all five journeys. The notice is visible and
accessible; document-width checks detect no new overflow.

The transport prediction visibly renders **24 percent**, matching the authored
`batteryPercent: 24`. Its feature-local exception has one `percent` token and is
used only by that item. Focused regression guards reject unrelated `score`,
`competent`, and `engine` terms across stem, explanation, choice labels, and
rationales. The shared learner-copy schema blob is identical to original base
and current main. No other clinical/device wording changed.

Final verification and evidence:

- Focused PR Jest: **397/397**, eight suites.
- Full ECMO Jest: **2,511/2,511**, 81 suites.
- Prompt-01/02/03 Jest preservation: **174/174**, four suites.
- Save/location production E2E: **5/5**, including fresh snapshot/action state.
- Prompt-01 production browser: **29/31**; its two existing resource-error checks
  encounter missing-Supabase-credentials 500s on global navigation prefetches.
- Prompt-02 production browser: **29/29**.
- Exact-current-main production comparison: `/en`, `/en/search`, and
  `/en/board-prep` return the same missing-credentials 500s on main and the PR.
  Two normal-motion focus probes also fail on both main and the PR; both pass
  with the established preservation config’s `reducedMotion: reduce`. The
  initial generic-config preservation run was stopped after identifying this
  configuration difference; no application repair was made for those probes.
- Prompt-03 production layout/focus: **36/36**, using the established
  `playwright.ecmo-layout.config.ts` against the integrated production build.
- Full repository TypeScript with an 8 GB Node heap: **exit 0**.
- Full production build, including embedded training apps, content, asset
  validation, Next webpack build, and standalone preparation: **exit 0**.
- Changed-path ESLint, Prettier, and both working-tree/PR whitespace checks: **pass**.

Evidence is outside Git at
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/ecmo-pr315-final-acceptance-20261002/`.
The browser uses the integrated production build at localhost port 3155. The
established preservation harnesses retain their API stubs; the five save/location
journeys use actual browser localStorage and application controls without API
stubbing or auth bypass. Private credentials, analytics delivery, native browser
zoom, screen-reader software, and full 3D/media fidelity were not verified.
Existing clinical/device owner holds remain outside this bounded acceptance.
No PR merge, deployment, storage expansion, grading/model change, or additional
ECMO-FELLOW-04 tranche was performed.

The bounded PR #315 repair and current-main integration are ready for conversion
from draft and merge without another substantive engineering review. The PR was
not converted or merged by this task. Broader module persistence and clinical/device
acceptance remain outside this decision.
