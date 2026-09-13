# Batch A implementation and validation

Base: `d209c8006e693e9d4ee8a250347911e191508029`, clean branch `codex/crrt-9-13`.
Fetched origin before work; the checkout already included the reviewed circuit, source-map,
pressure-projection and static-reference fixes. No reset or historical source replacement.

## Scope and implementation brief

Rebuild only the first four stable Learn IDs. Preserve all eight IDs and the shared pathway
order, the pinned `prismax-aw8035-2xx` profile, case identities, Practice/Assess, release state,
clinical math and unresolved source gates. Batch B and Batch C are not selected.

The current findings A–D and F are present. In a real baseline browser, clearing weight and
opening results left all numbers unavailable but displayed “embedded lab complete”. The two
station snapshots are at four and five hours; they are a recorded comparison with both a
setting change and elapsed time, not an isolated control experiment. Citrate's held-open
physiology remains outside Batch A. Existing feature baseline: 49 suites, 561 tests pass.

The pathway uses explanation → labeled worked example → guided manipulation → a different
application → reviewed feedback. It does not adopt the siblings' six-phase prediction gate.
Use the shared LessonShell and NowCard with focused, document-flow tasks: the broad canonical
circuit and its controls share one reading surface. This is a deliberate presentation choice
to avoid nesting a 1330-unit circuit inside a narrow simulator pane. The course map and deep
references are secondary disclosures. No global stage or stylesheet changes are needed.

Lesson plan:

- Indications: two treatment goals, blood/filter/return orientation, modality preview, changed
  cases identifying goals and continuity constraints.
- Circuit: guided blood/fluid walk; four measurement sites and two relationships; normal then
  known return-side change; six-signal prediction; unknown access pattern with uncertainty and
  discriminating inspection.
- Transport: the same circuit with a filter inset; diffusion, convection and ultrafiltration;
  constrained modality illustrations and a one-input comparison; independent changed example.
- Prescription: one synthetic 80 kg/24 h example, 2,000 mL/h effluent and 3 h downtime;
  staged builder with a bounded downtime comparison and interpretation; machine versus patient
  fluid accounting and a separate transfer task.

Evidence lives in the existing v3 progress store as an optional versioned task-history field.
Old completed IDs are retained without generating revised exercise evidence. Navigation,
Back/Forward, reset and repeat create a new attempt identity and restart all transient work.
Reload retains history, including first responses, but restarts the lesson; it never promises
exact-state resumption. Submission, feedback display and review are distinct recorded events.
Demonstrations never count as independent work or change Practice scores.

## Rechecked findings

| Finding                                     | Current-checkout evidence before changes                                                                                                                                                   | Batch A disposition                                                                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: document and ceremonial phase navigation | Present in the route and its handlers.                                                                                                                                                     | First four lessons now use task-specific teaching, controls and completion. Later lessons retain their existing teaching.                                                                             |
| B: different pressure representations       | Present: the localization SVG omitted the pump/sites; the recorded states were four and five hours apart.                                                                                  | Canonical circuit reused; recorded comparison labeled with time confounding; known-fault and unknown-region tasks separated. Identical access signatures do not force catheter-versus-line precision. |
| C: invalid-entry completion                 | Present in code and reproduced in Chromium: clearing required weight then opening results reported completion with unavailable results.                                                    | Completion requires valid controlled inputs, the required basic calculation, a submitted interpretation and explicit review.                                                                          |
| D: fluid-neutral and never-equal wording    | Present; contradicted the existing canonical ledger's zero-removal and simplified SCUF cases.                                                                                              | Wording corrected, canonical accounting unchanged; patient-level projection added through existing engine functions.                                                                                  |
| E: held-open citrate physiology             | Present in the source registry.                                                                                                                                                            | Gate retained. The physiology expansion belongs to a later batch and was not implemented.                                                                                                             |
| F: parent state on history navigation       | Present in the `popstate` handler. The attempted original browser reproduction timed out before completing the history sequence; it is not claimed as browser-confirmed baseline behavior. | One navigation transition remounts the lesson/attempt. Actual updated Back/Forward, reload and repeat walkthroughs pass.                                                                              |

## Files and preservation

- `content/foundationLessons.ts`, `learnController.ts`, `learnEvidence.ts`,
  `components/CrrtFoundationLesson.tsx`, `components/CrrtFoundationTools.tsx`, and
  `components/crrt-foundations.module.css`: rendered introductory tasks and local controller.
- `components/BaxterCrrtLearn.tsx`: route integration and common navigation reset. Remaining
  lessons also require an explicit feedback-review action instead of recording completion on
  answer submission.
- `foundationModel.ts`: projections through `calculateCrrtPredictedConsequences`, the canonical
  machine ledger, `advanceFluidLedger`, and `calculateWholePatientNetBalanceMl`.
- `components/CrrtPilotCircuit.tsx` and its stylesheet: additive focused presentation and
  controlled highlights, with the original full presentation as default. Formula captions now
  include the existing pinned display offsets; pressure calculations were not changed.
- `components/CrrtPressureLocalizationLab.tsx`, `pressureLocalizationLabModel.ts`: canonical
  circuit, known-fault scaffolding, typed prediction/review callbacks, bounded effluent wording.
- `components/CrrtStagedPrescriptionBuilder.tsx`, its stylesheet and
  `stagedPrescriptionModel.ts`: bound guided example, valid comparison completion, projected-dose
  labels, corrected fluid wording, and optional circuit/advanced detail in the guided results.
- `engine/progress.ts`: optional versioned task history in the existing v3 store. Old completion,
  case attempts, scores, hints and device/content identity safeguards remain intact. First
  responses are retained when display/review events arrive; new attempts do not evict earlier
  Learn responses or manufacture revised evidence from completed IDs.
- `components/CrrtLivePressureStation.tsx`: honest recorded-comparison wording. Its engine
  generation and adapter functions are unchanged.
- `components/BaxterCrrtModuleFrame.tsx`, `components/BaxterCrrtModuleNav.tsx`, and
  `components/baxter-crrt.module.css`: scoped document-flow composition and canonical lesson
  count. No global/shared component, authentication, dependency, database, source registry,
  release catalog, engine version, case identity or numerical source-function changes.
- Behavior checks are in `__tests__/foundationModel.test.ts`,
  `__tests__/foundationLessons.ui.test.tsx`, the existing builder/localization/Practice-Assess
  suites, `e2e/baxter-crrt-foundations.spec.ts` and `playwright.baxter-crrt.config.ts`.

## Routes and instructor walkthrough

All routes below are under `/en/baxter-crrt`; local walkthroughs used
`http://127.0.0.1:3113`. The module remains an unlisted preview.

1. Open `/en/baxter-crrt`, choose **Start the core path**. In
   `/learn?lesson=crrt-indications-modality`, follow the blood circuit, read the separated-goals
   example, select all four conceptual modalities, answer two different cases and review feedback.
2. Continue to `/learn?lesson=crrt-circuit-pressures`. Trace six blood stops, add five fluid
   paths, select the four pressure sites and two calculated relationships, and compare the
   matched-flow return-side change. Predict all six responses to a known return-line obstruction,
   reveal and review. Then identify a supported region and inspection from two unknown patterns.
3. Continue to `/learn?lesson=crrt-solute-transport`. Compare three mechanisms in the filter
   inset, map the four modalities to active paths, compare three independently reset flow changes
   using the ledger, then interpret two changed cases. No patient laboratory trajectory is implied.
4. Continue to `/learn?lesson=crrt-prescription-dosing`. Follow the synthetic 80 kg calculation,
   enter the three-stage builder, and clear downtime: results are unavailable and no evidence is
   awarded. Restore a valid comparison by changing three to six hours; submit an interpretation
   and explicitly review it. Read the zero-removal patient ledger, then solve the changed downtime
   and fluid-total applications. Basic work remains possible with advanced filtration fraction
   unavailable. The optional free builder is a separately labeled calculation reference without
   lesson credit.

Lesson selection, URL entry, restart, Back/Forward and reload start a new exercise. Prior
completion and submitted first responses remain in history; in-progress controls are not restored.
The reached-task map lets the learner reread teaching and first-response feedback. Completion
means worked through and reviewed, including wrong first answers, not mastery or device competence.

## Executed validation

| Command                                                                                                                                                                                   | Result                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline: `npx --no-install jest src/features/baxter-crrt --runInBand`                                                                                                                    | 49 suites, 561 tests passed.                                                                                                                 |
| Baseline: `npm run type-check`                                                                                                                                                            | Passed.                                                                                                                                      |
| Final: `npx --no-install jest src/features/baxter-crrt src/features/learning-module/stage/__tests__ src/features/critical-care/__tests__/hub-pathway-start-alignment.test.ts --runInBand` | 55 suites, 600 tests passed, including existing Practice/Assess, source, numeric, safety, progress, accessibility and analytics contracts.   |
| Final: `npm run type-check`                                                                                                                                                               | Passed.                                                                                                                                      |
| `npm run lint`                                                                                                                                                                            | Exit 0; 15 warnings in unchanged files outside CRRT. No baseline full lint run is claimed.                                                   |
| Final: `npx --no-install eslint src/features/baxter-crrt e2e/baxter-crrt-foundations.spec.ts playwright.baxter-crrt.config.ts`                                                            | Passed without output.                                                                                                                       |
| Final: `npx --no-install playwright test -c playwright.baxter-crrt.config.ts`                                                                                                             | Four Chromium scenarios passed; 25.7 seconds.                                                                                                |
| `NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3113 npm run build`                                    | Passed, including both training-app builds, content generation, asset validators, Next.js production compilation and standalone preparation. |
| `git diff --check`                                                                                                                                                                        | Passed.                                                                                                                                      |

Intermediate failures were fixed before the final runs: stale assertions for the old completion
flow/copy, an invalid conceptual CVVH overlay ID, a numeric-control label matcher, and browser
drivers that initially treated clipped native pressure radios and radio-group keyboard navigation
incorrectly. The final browser driver uses the visible labels for pointer operation and native
Tab/arrow/Space/Enter for keyboard operation, without forced clicks or injected focus. Visual
inspection also corrected omitted formula offsets and excessive nested mobile padding. These are
development findings, not pre-existing failing test suites.

The browser suite exercises both a clean laptop pointer journey at 1440×900 and the **entire four
lessons** at 390×844 with keyboard controls and reduced motion. It also checks wrong responses,
feedback review, invalid downtime, actual stored input/attempt evidence, unchanged Practice scores,
Back/Forward after submissions and lab edits, direct links, reload, restart, and completion reflow
at 1280×720, 1024×768, 900×800, 720×450 and 320×844. No page runtime errors or document horizontal
overflow were detected in those checks. The 720×450 check is a viewport/reflow approximation, not
a claim to have tested browser zoom. Circuit drawings deliberately pan horizontally at compact
widths, with labeled controls, text equivalents and keyboard panning.

Generated evidence is outside Git in
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/baxter-crrt/batch-a-2026-09-13/`:

- Baseline invalid-completion screenshot and baseline logs.
- `crrt-final-tests.log`, `crrt-browser.log`, type/lint logs and the completed build log.
- `browser/`: 33 captured screenshots, including normal orientation, wrong-answer feedback,
  pressure sites/formulas, known-pressure review, membrane inset, flow comparison, worked dose,
  invalid/valid builder results, history boundary and compact reflow. Inspected actual laptop and
  compact circuit, feedback, flow-comparison and prescription-result screenshots. All captured
  images are available for reviewer inspection; capture alone is not clinical review.

## Scoped acceptance

| Rule | Result and evidence                                                                                                                                                                                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1   | PASS within Batch A: existing Overview and next-incomplete resolver, eight stable IDs/order, four navigation destinations. Outside the new lesson header the existing Assess destination retains its “Challenge” navigation label.                               |
| H2   | PASS: normal orientation, worked explanations, guided controls, independent changed examples and explicit feedback. This is implementation verification; novice instructional efficacy remains untested.                                                         |
| H3   | PASS with the owner's task-specific presentation choice: shared LessonShell/NowCard in a CRRT-local focused reading surface. Fixed three panes and sibling prediction-first phases were deliberately not adopted. Shared defaults unchanged.                     |
| H4   | PASS: one current NowCard, actual tools and one progression action; reached-task navigation is secondary. Visible landmarks identify the circuit, builder, localization lab or application check. Pane-location schema audit is N/A to this focused composition. |
| H5   | PASS: the walkthrough renders and operates the teaching/tools for all four routes; deeper calculations and the recorded station are secondary disclosures.                                                                                                       |
| H6   | PASS: no completion on route visit, invalid entry, result reveal or answer submission. Required selections, interpretation and review are tested. Read-only explanations carry no independent evidence.                                                          |
| H7   | PASS: first committed responses retained; feedback rendered only after commitment; review is explicit. Unknown-pressure tasks do not render a cause label before the answer. Practice/Assess regression suites pass.                                             |
| H8   | PASS: original numerical functions, canonical circuit, pinned profile, source gates and full standalone presentations retained. Recorded and conceptual states are labeled; human device review pending.                                                         |
| H9   | PASS: existing progress adapter and case guards retained; versioned task evidence, stale-identity rejection, old completion, wrong first response, 301-record history, restart/history/reload tests.                                                             |
| H10  | PASS for implemented copy: conventional units and explicit projected/recorded/whole-patient distinctions. Specialty wording awaits faculty review.                                                                                                               |
| H11  | PASS: CRRT-local implementation/tests/docs only; no deployment, publication promotion, source promotion, merge or shared-state mutation.                                                                                                                         |
| H12  | PASS for the executed states above: real clean-session desktop and compact keyboard walkthroughs, reduced motion, screenshots and new rendered axe checks. See the limitations below; no full-module or clinical validation claim.                               |

## Review pending and deferred work

Clinical/device review remains pending nephrology/critical-care faculty and a PrisMax-trained
nurse educator, especially the new task wording, physiological simplifications, pressure formula
captions, site interpretations and feedback. The active profile stays `prismax-aw8035-2xx`.
Existing registered sources and synthetic arithmetic are reused; no new dose target, protocol,
market-specific manual, clinical claim promotion or source-conflict resolution was introduced.
`CONFLICT-001`, `CONFLICT-002`, unresolved makeup attribution, citrate held-open mechanisms,
original-artwork restrictions and release gates remain intact.

Not executed: human novice usability sessions, screen-reader testing, Safari/Firefox, true browser
zoom, authenticated production analytics ingestion, physical-device validation, real patient
validation or a new end-to-end Practice/Assess case in the browser. Existing case behavior was
regression-tested with Jest. Anonymous local analytics requests returned 401; server ingestion is
not verified by these browser runs. No production credentials or shared Supabase operations were
used.

Batch B device/delivery/fluid-workflow reconstruction and Batch C citrate physiology/integrated
capstone work are deferred and have not been started. No broader curriculum audit or sibling
module migration was performed.
