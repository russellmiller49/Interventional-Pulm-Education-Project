# Five-controls teaching pilot

## Scope and before-state

September 12, 2026. Baseline `ab05b9d6`, clean task branch
`codex/bronch-foundations-improvement-9-12`. Implement only `five-controls`, its
instrument orientation, and module entry/progress integration. Audit other lessons;
leave their lesson behavior, assessment keys, anatomy, shared stage and release state intact.

Source inspection and a real localhost walkthrough confirmed that `stageLessons.ts`
places a prediction before the first scope action; `BronchStageHost.tsx` locks the
controls; `BronchTeachingColumn.tsx` withholds mechanism/worked teaching and then
renders it together after commitment. The old depth goal accepts two undifferentiated
insertion events. These are observed behaviors. Increased novice cognitive load is
a design hypothesis, not an observed learner outcome.

Start currently resolves through the canonical order to shared-airway. Keep its
safety preparation sequence. Introduce the physical instrument within the pilot and
make that orientation accessible as a prerequisite reference from pre-use-check.

## Implementation plan

- Use the current shared StageLayout/NowCard/StepList through the module-local host.
- Opt the pilot into current-step teaching, with instrument orientation, depth,
  deflection, rotation, combined aiming, a formative check, suction, and a changed target.
- Drive demonstrations with the existing scope reducer in separate transient state.
  Keep learner goals and records separate; initialize each new attempt at its authored start.
- Check actual advance and withdrawal; use the rendered optical frame for target checks.
  No new motion model or mandatory rotation before an already aligned target.
- Version pilot learning completion and formative attempts; retain historical records.
  Resume at the beginning of an incomplete section, not a claimed saved mid-step.
- Verify rendered handlers, negative completion, demonstration isolation, assessment
  disclosure, other lessons, and wide/compact browser behavior.

Source basis: supplied knowledge specification v2, sections 3.1 and 4.1–4.5,
read in Local-Data; existing S1/S2/S3 and T10/T11 provenance retained. No raw source
redistribution. New targets, distances and angles are authored exercise parameters,
not device limits or clinical standards. Faculty/media review remains pending.

Baseline: 17 Jest suites passed, 261 tests passed, one existing todo.
Browser: Start reached shared-airway; direct five-controls opened with mechanism
withheld and disabled rotation/deflection/depth controls, confirmed at 1440 × 900.

## Delivered pilot and alignment

The stable `five-controls` link now renders 13 short units. This is an explicit opt-in
in the module-local adapter/host, using the existing shared StageLayout, NowCard,
StepList, pane captions, and 0.26/0.29/remainder layout configuration. Shared files
and default behavior were not edited. The shared-stage reference was also inspected
at `mechanical-ventilation/learn?activity=breathing-with-support` at 1440×900 and
390×844; the earlier module plan names `ImagingStageHost` as its integration reference.

| Concept              | First teaching and example                                                                     | Learner action                                                                          | Later check                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Instrument and hands | Unit 1: existing full-scope photograph, labeled component diagram, source-qualified hand setup | Locate the handle, insertion tube, distal section, angulation lever and suction control | The control labels connect these parts to later movement                      |
| Depth                | Unit 2: advance/withdraw demo through the real reducer                                         | Advance, then withdraw to the initial depth                                             | Unit 3 repeats without the action cue; final target adds depth                |
| Deflection           | Unit 4: lever, bending section and scope view                                                  | Bend and return to straight                                                             | Unit 5 without the cue; later aim from a new view                             |
| Rotation             | Unit 6: camera and bending plane shown together                                                | Turn straight scope, bend, then turn the bent scope                                     | Unit 7 without the cue; unchanged N03 formative item in unit 9                |
| Combined aiming      | Unit 8: off-axis gold target and a worked example                                              | Center the target and approach within the authored 12–16 mm band                        | Unit 13 moves the target below center; rotation is not required               |
| Suction              | Unit 10: request indicator, stationary tip; no fluid-clearance claim                           | Apply, then release suction                                                             | Unit 11 without the cue; accessory operation remains in Protected accessories |
| Integration          | Unit 12: connect depth, bend and rotation                                                      | Unit 13 changed target; optional hint and reset                                         | Completion records guided screen-based learning, not clinical competence      |

The component diagram is an authored teaching schematic, not a device-specific IFU.
It labels the lever without claiming an unsupported annotation on the photograph.
Both optical and observer views use the current scope state; demos run supported
commands through the same reducer in separate transient state. The bench fallback
projects a fixed reference card using the actual optical frame. No second motion
model, anatomy graph, clinical image, or engine replacement was introduced.

Before: a learner had to answer N03 before operating the controls, then received the
mechanism, worked explanation, control panel and other teaching together.
After: the learner sees the instrument, watches/tries one relationship at a time,
repeats with less support, and reaches N03 after practice. Only that unit's teaching
is rendered. The pending check has neutral adjacent teaching and no solution overlay.

The final task checks optical aim and depth, with an observed off-target-advance error
that requires reset. It does not require a memorized rotation/bend/insertion sequence.
Direction-specific events require real nonzero travel, so two advances cannot stand
in for an advance and withdrawal. No grip, torque, force, tissue injury or hand-skill
measurements are inferred. All target coordinates, angles, distances and tolerances
are authored exercise values.

## Integration and compatibility

- Overview describes preparation for supervised adult flexible bronchoscopy, intended
  learners, safety preparation, and the pilot boundary. The canonical 23-section order
  and Start/Continue resolver remain authoritative. Fresh Start still opens shared-airway.
- Pre-use-check receives the same instrument orientation as an open prerequisite reference
  on its first step. Its functional checks, identification activity, answer keys and
  subsequent teaching retain their existing behavior.
- The existing local record key and version-1 envelope remain readable. A default-empty
  `sectionVersions` map records `five-controls: 2` only after the revised lesson is finished.
  An old completion is retained as history, but does not count as completion of this pilot.
  Continue points to the revised lesson when the older core path is already complete.
- New first-answer key: `five-controls-learn-v2:N03`. New performance key:
  `five-controls-learn-v2`. Old `five-controls:*` answers and performance are retained.
  A retry changes the transient answer/feedback; it never overwrites the first answer.
- Demonstrations do not enter the learner reducer, consume a check, complete a goal, or
  write performance. Replays initialize fresh demo state; Try initializes fresh learner
  state. A requested hint is recorded as support. Lesson completion is always guided.
- Reload/revisit starts the section at unit 1. First answers and completed records remain;
  there is no claim to restore an unfinished scope position. Final continuation names
  the next canonical lesson, branch-entry.
- Learn's formatting supersedes the old prediction-first preference only for this pilot.
  Practice, Assess, reviewed keys, safety feedback, scoring, and non-target lesson guards
  remain in place. The module remains `unlisted-preview`. No deployment or merge is part
  of this change. Repository AGENTS supplies the ordinary branch/commit/push/PR workflow.

Primary implementation paths are under `src/features/bronchoscopy-foundations/`:
`content/fiveControlsLearn.ts`, `learnUnit.ts`, `lessonVersions.ts`, `stageLessons.ts`;
`components/stage/BronchStageHost.tsx`, `BronchPilotTeaching.tsx`,
`InstrumentOrientation.tsx`, `useScopeDemonstration.ts`; the module Overview/frame and
progress accordion; scope dock, views, fallback and new `BenchSchematic.tsx`;
`engine/learnProgress.ts`, `stageSession.ts`, `scope/scopeReducer.ts`,
`scope/scopeBenchTarget.ts`, goal evaluation and event types. Tests are module-local
plus `e2e/bronchoscopy-foundations.spec.ts`. The Git diff is the exact file manifest.

## Verification and captures

Executed against an isolated development server on port 3140, started with
`npx --no-install next dev --webpack --port 3140`.

| Command/check                                                                                                                                                                                        | Result                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Baseline `npx --no-install jest src/features/bronchoscopy-foundations --runInBand`                                                                                                                   | 17 suites, 261 passed, one existing todo                                   |
| `npx --no-install jest src/features/bronchoscopy-foundations src/features/learning-module/stage src/features/learning-module/curriculum/__tests__/resizable-teaching-workspace.test.tsx --runInBand` | 22 suites, 296 passed, one existing todo                                   |
| `npm run type-check`                                                                                                                                                                                 | PASS                                                                       |
| `npx --no-install eslint src/features/bronchoscopy-foundations e2e/bronchoscopy-foundations.spec.ts`                                                                                                 | PASS, no warnings                                                          |
| `BRONCH_FOUNDATIONS_BASE_URL=http://localhost:3140 npx --no-install playwright test --config playwright.bronchoscopy-foundations.config.ts`                                                          | 12 passed                                                                  |
| Pilot journey repeated after final narrow-view reticle correction with `--grep 'teaching-first pilot' --output /tmp/bronch-pilot-final-flow`                                                         | Desktop and phone pass; includes optical-viewport/reticle center alignment |
| `git diff --check`                                                                                                                                                                                   | PASS                                                                       |

The rendered tests use real host transitions and native form controls, not session
injection. They cover demonstration isolation/replay, advance/withdraw direction,
reset, back/review, wrong answer and retry, first-answer retention, a requested hint,
legacy records, all 23 lessons to completion, and the final target without rotation.
Every authored demo also finishes with its actual modeled task goal satisfied.

Browser coverage includes the full pilot at 1440×900 and 390×844, keyboard control,
native touch advance/withdraw in the phone journey, reduced-motion configuration,
WebGL failure and the explicit Use the schematic view fallback, Start, direct links,
reload, Practice's first answer, unsafe capstone failure, survey/report safeguards,
and six representative lesson surfaces at 1440, 1024, 390 and 320 px. Compact tab
switching is checked with arrow keys after responsive hydration. This is not a full
screen-reader audit or an accessibility certification.

The installed `audit-stage.mjs` smoke script was also run against the pilot at
1440×900, 1024×700 and 390×844, and the shared reference at 1440×900 and 390×844.
Its raw result is **FAIL**, retained in the evidence. It sampled transient hydration/
resize states: the pilot phone measurement reported three equal-width panes with
`compact=false`; the reference desktop reported `compact=true`, three visible panes,
and no switcher. Subsequent actual browser observations and explicit hydrated E2E
assertions verify the correct pane count, order, width and compact keyboard switching.
The smoke script/shared stage was not changed to force a pass. These initial-state
races are a limitation of that measurement, not evidence of full layout compliance.

Capture/log root (outside Git):
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/bronchoscopy-foundations-pilot-2026-09-12/`.

- `desktop/` and `phone/`: `01-before-answer-teaching.png`, `02-instrument.png`,
  `03-real-engine-demonstration.png`, `04-learner-depth-return.png`,
  `05-wrong-answer-feedback.png`, `06-check-retry.png`, `07-changed-target.png`,
  `08-target-error-feedback.png`, `09-target-retry-success.png`, `10-completion.png`.
- `fallback/fallback-depth.png`: working schematic after WebGL failure.
- `regression/`: unchanged representative lessons at the four test widths.
- `layout-smoke-pilot/` and `layout-smoke-reference/`: original JSON reports and captures,
  including the failed smoke measurements. `logs/` retains exact command output.
- Before-state pilot and landing walkthrough screenshots were inspected inline during
  the initial browser review; they were not persisted as baseline PNG files. They must
  not be confused with captures of unchanged later lessons.

Images were opened and inspected, including instrument labels, explanation before
answers, demo, wrong-answer feedback, retry, final changed target and completion on
both viewport sizes. The review led to shorter simulator context, new-unit scroll
reset, keeping the two bench views adjacent on phones, and matching the reticle to
the actual optical viewport's center.

A separate agent walkthrough followed visible instructions, not test recipes or
state injection: orientation → each demo/practice/repeat → off-axis target → wrong
rotation answer → explanatory feedback → retry → suction → changed target → finish.
The final target was completed using deflection and four depth increments without
rotation or a hint. These are agent observations, not human usability or efficacy data.

## H1–H12, limited to the assigned pilot

| Rule                    | Status                  | Evidence and boundary                                                                                                                                  |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H1 One curriculum       | PASS                    | Registry-derived Start/Continue and all 23 stable links; safety first; Overview/Learn/Practice/Assess retained, along with the existing Reference link |
| H2 Teach first          | PASS                    | Instrument, five worked demos, guided/repeated practice before N03; changed final target                                                               |
| H3 Shared stage         | PASS                    | Existing imports/configuration preserved; no shared files edited; reference comparison performed                                                       |
| H4 Current task         | PASS                    | NowCard, real landmarks, controls/goals, compact context/actions; one active task                                                                      |
| H5 Rendered teaching    | PASS                    | Complete browser journeys and inspected pre-answer teaching; current unit only                                                                         |
| H6 Real completion      | PASS                    | Motion/aim predicates, negative tests, explicit confirmation; reading has no fake device gate                                                          |
| H7 Mode-aware feedback  | PASS                    | Wrong answer/retry; immutable first answer; neutral pending check; unchanged assessment disclosure and unsafe-case tests                               |
| H8 Fidelity             | PASS                    | Same reducer/frame/scene assets; schematic uses that frame; authored values labeled; physical skills excluded                                          |
| H9 Honest progress      | PASS                    | Versioned pilot completion, retained legacy records, supported reload boundary, guided/hint records                                                    |
| H10 Clinical language   | PASS (editorial)        | Concrete movements, source-qualified hands, device/model limits; faculty review remains pending                                                        |
| H11 Scope/release       | PASS                    | Pilot plus prerequisite/entry integration only; no shared defaults, anatomy, keys, services or release changes                                         |
| H12 Experience evidence | PASS with stated limits | Rendered/E2E/independent agent journey and visual checks; raw smoke failures disclosed; human and full assistive-technology reviews still outstanding  |

## Broad audit and proposed subsequent batches

These are proposals, not implemented rollout. Source-level observations apply to the
shared adapter/renderer and named section definitions; right-side and pre-use-check
were also inspected through their actual routes during this run.

| Area                         | Verified finding                                                                                                                                                                                                                                                                       | Subsequent work                                                                                                                                                                                                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Preparation                  | Pre-use-check already shows the four functional systems before its answer. Its suction-path mechanism and worked case are `after-commitment`; one section spans parts, function, readiness, compatibility and release. The new first-look reference fixes only the pilot prerequisite. | A separate named preparation batch: `pre-use-check`. Teach parts/functions, show a complete ready scope, then guided fault localization with IFU/reprocessing review.                                                                                                                                  |
| Normal anatomy               | Right-side starts with controls locked and asks which airway the scope is in before “The right side, airway by airway” becomes visible. Parentage/number vocabulary is present, but the complete normal sequence is withheld. Source deny patterns include “intermedius.”              | **Next recommended batch: `reference-frames`, `larynx-and-entry`, `right-side`, `left-side`.** Full airway names and labeled normal examples first, guided navigation second, unlabeled changed-view identification third. Separate naming errors from control errors.                                 |
| Guided inspection            | `branch-entry`, `view-loss`, `systematic-survey` use the existing pattern. Survey correctly distinguishes visiting from inspecting, and prevents unsupported inspection claims.                                                                                                        | Named guided-inspection batch: `branch-entry`, `view-loss`, `systematic-survey`; fade guidance while preserving ledger and contact/view-loss rules.                                                                                                                                                    |
| Findings and sampling        | `describe-findings` explicitly uses a described vignette and a normal comparison still; it has no abnormal-airway image. Sampling carries technique/policy nuance and safety checks that must remain.                                                                                  | Named batch: `describe-findings`, `washing-and-lavage`, `poor-return`, `protected-accessories`, `specimen-pathway`. Keep description-from-vignette separate from image recognition. Obtain de-identified, rights-cleared abnormal examples with faculty annotation before claiming visual recognition. |
| Deterioration and completion | Deterioration/bleeding are core; tube and ICU physiology are identifiable later sections. Reporting and completion appropriately limit claims.                                                                                                                                         | Named completion/safety batch: `deterioration`, `bleeding-priorities`, `honest-report`, `what-completion-means`. Keep deterioration recognition essential. Then a separately named ventilated-patient batch: `scope-in-a-tube`, `icu-physiology`; do not make rescue recognition optional.             |

The likely reduction in novice cognitive load is a design hypothesis. No learner
outcomes, transfer to hands-on skill, faculty approval, image rights clearance or
clinical validation were established by this implementation.

## Short human review

Use `http://localhost:3140/en/bronchoscopy-foundations` and the stable pilot link
`http://localhost:3140/en/bronchoscopy-foundations/learn?section=five-controls`.

1. A bronchoscopy faculty reviewer checks instrument callouts, hand-position qualifications,
   movement-to-image relationships, suction wording, and the distinction between authored
   bench behavior and a real instrument. Confirm photo provenance/rights before release.
2. Ask three novice clinicians to complete the pilot without coaching. Have them point to
   each part, explain each view change, retry one error, and decide how to reach the changed
   target. Record where they search for instructions, confuse the views, or need help.
3. Repeat the control task with keyboard and on a phone; have an assistive-technology user
   assess the text equivalent, tab order, labels and feedback announcements.
4. Ask each learner what completion establishes and what supervised physical practice is
   still needed. Use observed difficulties to revise the pilot before approving any named
   rollout. Do not treat an agent walkthrough as a substitute for this review.
