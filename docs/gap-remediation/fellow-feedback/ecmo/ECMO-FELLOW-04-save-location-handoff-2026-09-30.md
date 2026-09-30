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
