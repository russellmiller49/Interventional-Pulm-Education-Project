# MCS-PRE-REVIEW-01 independent sanity review — 2026-09-21

**SANITY REVIEW: NOT READY TO MERGE**

This disposition applies to the unchanged head of [PR #256](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/256).
Two concrete Prompt-01 defects remained: secondary F19 all-clear signals and an F09 test that
required the known incorrect shared heading. Both are repaired and verified in the accompanying
minimal Codex commit. Integrate that commit before merging Prompt 01. No additional evidenced
Prompt-01 blocker was found. This review does not approve the underlying circulation/device model,
clinical release, or any NOT REVIEWED owner decision.

## Revision and scope record

| Revision                                                             | SHA                                        |
| -------------------------------------------------------------------- | ------------------------------------------ |
| Original implementation/merge base                                   | `c717c9ffae09cb67e19b06a56d37c75487a5605a` |
| PR base reported by GitHub; origin/main at review start; tested base | `d9dbfa2ec33c00f90395c14ec1dc6634623551e2` |
| PR head reviewed (still unchanged at final check)                    | `caa7cee443e2eabd8425e3e6f6db7dc75ce3a29f` |
| Current origin/main at final remote check                            | `5ff2b096f6aa4d7032594b28520e2d78d64df5ed` |

Main advanced during this review through PR #252. Its delta from the tested base contains only
branch-tracing feature/tests/e2e and handoff files; it has no MCS or shared-feedback changes.
The full-suite/build results below are for the pinned tested base, not a claim to have rerun the
newest main. There were no MCS changes between the original implementation base and tested base.

All 25 original PR files were reviewed (full list below): 23 files within the MCS feature and two
MCS handoff/inventory documents. No Device Intelligence, hemodynamics-core, global learning
component, global design token, authentication, database, deployment, or unrelated module changes
are present. Model equations and device responses were not corrected or redesigned. The reducer
change excludes held criteria from both response-score numerator and denominator.

The review ran in isolated checkouts. The Claude branch was not edited or pushed. The repair is
on `codex/pr256-sanity-fixes`, based on the reviewed head, for owner integration under the repository's
branch-ownership rule. It changes two MCS components, two local tests, and two review/handoff docs.

## Reproduced defects and minimal repair

1. **F19: secondary all-clear leak.** With AF, pressure triggering, and aligned offsets, the PR
   still rendered a green `NO ACTIVE MODEL ALARMS` badge beside its amber hold. IABP-02 and
   CAP-IABP-01 also displayed `No active modeled alarm` in their patient-context header. The
   existing warning elsewhere did not contain these success signals. `McsMonitor` now omits
   the clear badge while the existing AF hold applies. `McsWorkbench` uses the existing hold
   sentence as its quiet fallback; actual active alarms still take precedence. The finalized
   regression suite fails 3 tests and passes the sinus control on both base and original head,
   then passes all 4 with the repair. This changes presentation, not physiology or alarm generation.
2. **F09: defect-preserving test.** The added test required the incorrect shared heading and
   prohibited the proper heading. It would predictably fail a correct future shared-owner repair.
   Replace it with a consumer contract exercising every story answer and preserving selected
   rationale, all alternative labels/rationales, and sources. The contract imposes no incorrect
   heading invariant. The handoff now says this explicitly. No shared component was changed,
   copied, or locally forked. The original PR description's claim that this test intentionally
   fails when the shared repair lands should also be updated by the PR owner on integration.

The three pre-existing test changes are legitimate, rather than weakened regressions:

| Suite                      | Independent assessment                                                                                                                                                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `m5-controls-and-surfaces` | Replaces ambiguous “current value” with “instantaneous sample” and a current-time qualifier; preserves the actual readout checks. The old label was the F04 defect.                                                                                                                                              |
| `m5-practice-challenge`    | Makes the same measurand distinction while retaining clock and no-attempt-analytics behavior.                                                                                                                                                                                                                    |
| `mcs-af-presentation`      | Resolves `aria-describedby` to the explanation paragraph instead of reading the entire comparison table. Still requires the control's own limit explanation. Allows one open, read-only comparison instead of prohibiting every `details` element; retains the prohibition on interactive controls in that note. |

## Findings independently checked

**F19 containment after repair.** Thirty-six deterministic matched replays cover AF Learn,
IABP-02, CAP-IABP-01, and a sinus control; each uses ECG/pressure/internal triggers and aligned,
early-inflation, or late-deflation offsets. All physical metrics match base/head exactly.
Aligned AF model ratings remain 50/74/40, with ECG/internal warnings and a quiet pressure alarm;
these disputed values are visible, not corrected or hidden. Sinus ratings remain 100/90/62.
The two held synchrony conditions remain in historical case definitions but contribute neither
positively nor negatively to scoring and never render a reached result. Remaining authored MAP
conditions retain their own denominator. IABP-02 response scores at aligned triggers change from
0/20/0 to 0/0/0; CAP scores change from 10/20/10 to 20/20/20 because only its remaining MAP
condition contributes. These are internal probe results, not learner-facing grades.

Learn and both case routes expose the comparison without an answer gate. Header/context,
alarm bar, causal and goal/explanation surfaces were inspected with all three triggers; the
patched quiet state retains the hold without an all-clear, and real warnings remain readable.
Direct unauthorized LVAD speed dispatch still refuses the change and records
`lvad-unauthorized-speed-change`. This is containment pending OD-01/Prompt 02, not proof of a
clinically correct device model.

**F26 isolated stories.** Both orders A→B and B→A, retry, explanation before any selection,
reload/revisit, and a preceding live preload change to 140 were exercised. Each baseline appears
above its question and comes from the actual isolated state: seed 417, time 5.04 s, preload 55,
RV contractility 0.85, Impella CP P7, correct position, right pump off, RAP 2, wedge 10, MAP 61,
displayed flow 1.7, and effective systemic delivery 3.7. These are not the surrounding section's
RV-failure state. The story replay values match in either order. Live preload and local progress
storage remain unchanged by story actions; the engine probe also preserves its live state.
The volume story explicitly describes a modeled 55%→100% control change with no dose, rate, or
patient fluid prescription. The walkthrough's suggested pressures were not substituted.

**F33/F04/F27/F28/F18.** Runtime enumeration and rendered case tests confirm all 21 conditions
across 12 cases, all classified as authored-model conditions, with no falsely source-supported
clinical criterion. Counts by case are IABP-01/02/03: 2/1/1; IMP-01/02/03: 2/1/2;
LVAD-01/02/03: 2/2/2; CAP-IABP/IMP/LVAD: 2/2/2. Each is identified where the explanation shows
it; the two held AF conditions additionally explain why they are not outcomes. MAP 58 and 50
were preserved. Instantaneous trace samples, modeled means, PA systolic/diastolic quantities,
and the model-only synchrony index are distinguished. The MAP 103 reference is called authored
and high, not clinically normal. F18 no longer calls the annotated reference unannotated.

HM3 wording distinguishes the model's forward flow→power construction from the manufacturer's
power/speed/hematocrit-based displayed estimate. The [Abbott pump-parameters source](https://www.cardiovascular.abbott/content/dam/cv/cardiovascular/hcp/education-training/heart-failure/documents/hf-heartmate3-lvad-pump-parameters.pdf)
does not supply a full estimator equation; the PR does not claim one. Actual transfer flow,
displayed estimate, and systemic/effective flow were not merged into one measurement. Legacy
high-power/estimator fidelity remains an owner/model decision.

**F01 hub contrast.** Actual rendered colors were measured on base and head in light and dark
at 1204×987, 1280×800, 390×844, and 390×844 with 200% root text. The original dark-theme
failure reproduced: group titles approximately 1.05:1 and route body 1.01:1. Head improves those
to 13.51:1 and 12.81:1; route eyebrow improves from 4.29:1 to 5.68:1. The sampled subtitle
remains 4.71:1. The fix is module-local. Keyboard focus has a visible 3 px outline; Enter toggles
the accordion; hover retains readable text. No disabled hub controls were present to measure.

This is not a full accessibility approval. Both base and head retain 184 px document overflow
on the hub at 390 px/200% root text. The AF comparison has no table overflow in the tested sizes,
but its 390 px/200% rendering is cramped with excessive word wrapping (2 px page overflow).
Those ordinary responsive-presentation limitations remain with the planned layout work; they
were not silently reported as flawless or expanded into speculative Prompt-01 CSS changes.

**F09 shared dependency.** The exact consumers are the prediction and transfer verdicts in
`McsStageHost` and the worked-story verdict in `McsStoryProblems`, all using
`ChoiceReasoningFeedback`. The earlier `AnswerVerdict` fix does not reach them. Their sources
and reasoning remain; no MCS concept IDs were removed. Relevant shared tests retain their
source/concept-link coverage. The shared key-aware heading repair remains outstanding and is
not, by itself, a blocker to this scoped containment PR.

## Reproducible checks and results

Commands were run from the corresponding pinned checkout using the same installed dependencies.
Browser scripts and their JSON/screenshot evidence are saved in the evidence directory below.

| Check                                                                                                                            | Tested base                         | Original head                 | Repaired head                       |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------- | ----------------------------------- |
| `npx jest --runInBand --testPathPatterns='mechanical-circulatory-support\|ChoiceReasoning\|AnswerVerdict' --json --outputFile=…` | 40 suites / 825 tests pass          | 42 / 876 pass                 | 43 / 880 pass                       |
| Original 24-test repaired-defect guard transplanted unchanged to base                                                            | 24 fail                             | All 24 pass in focused run    | Pass                                |
| Finalized new 4-test F19 regression                                                                                              | 3 fail / sinus control passes       | 3 fail / sinus control passes | All 4 pass                          |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`                                                         | Pass                                | Pass                          | Pass                                |
| Changed-code `npx eslint … --max-warnings=0`; `npx prettier --check …`; `git diff --check`                                       | Pass for existing counterpart paths | Reviewed with patch           | Pass                                |
| Canonical `npm run build` with that checkout's dev watcher stopped                                                               | Pass through standalone preparation | —                             | Pass through standalone preparation |

The focused selector includes module routes, shared verdict tests, and the MCS adapter suite;
its counts therefore differ from a feature-directory-only handoff count. The scoped file lists
are recoverable from the original PR list below and the repair commit. No production build
relied on fabricated environment credentials or altered `.env.local`.

Full repository runs used `npx jest --maxWorkers=2 --json --outputFile=…`:

- Base: 903 passing, 9 failing, 2 skipped suites; 13,349 passing, 8 failing, 3 skipped tests and 1 todo.
- Original head: 901 passing, 9 failing, 2 skipped suites; 13,346 passing, 8 failing, 3 skipped tests and 1 todo.
- The same nine failing suites were rerun on each side with
  `npx jest --runInBand --runTestsByPath … --json --outputFile=…`: each reproduced 9 failing suites,
  8 failing tests, and 98 passing tests, with the same failing test names.

Failures are in critical-care accessibility, learner-copy, and curriculum sequencing;
IP preference-card U.S. status boundaries and brochure static exposure; literature foundation
manifest; branch-tracing contracts; board-review HTML; and `scripts/training-apps.test.mjs`
(collected by Jest but containing no Jest tests). None is a newly failing MCS suite. The extra
10th-suite/9th-test failure mentioned in the handoff **was not reproduced**; its cause is unknown.
There is no evidence here to label it nondeterministic or to attribute it to this PR.

Additional exact independent probes: `node /tmp/pr256-review/model-probe.cjs <output.json>`
on each checkout; `node /tmp/pr256-review/hub-browser.cjs` for matched hub colors/focus/hover;
`node /tmp/pr256-review/journeys.cjs` for the AF and two-order story journeys;
`node /tmp/pr256-review/compact.cjs` for compact/200% AF comparison screenshots. Browser work
used headless Chromium, fresh signed-out pages, and local review servers on ports 3136/3137.
Routes were `/en/mechanical-circulatory-support`, Learn
`?lesson=iabp-timing-triggering&phase=transfer`, Practice `?case=IABP-02`, Integrated
`?case=CAP-IABP-01`, and Learn `?lesson=impella-suction-purge-rv&phase=observe`.
The browser AF comparisons are internally matched at each captured instant; cross-revision
fixed-time/offset matching is established by the deterministic model probe. Missing local
Supabase configuration caused existing analytics endpoint errors on both sides; no authenticated
or remote analytics workflow is claimed tested.

Explanation-before-answer, retry/revisit and self-paced continuation were exercised. Focused
regressions preserve skip/navigation, IDs, legacy progress interpretation, source links, genuine
interlocks, no attempt/competence analytics, and isolated examples. This is not an authenticated
end-to-end audit of every legacy record.

## Evidence, remaining decisions, and handoff

Derived local evidence (logs, Jest JSON, browser scripts/screenshots, model observations, and
patch) is retained at:

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/mcs-pre-review-01-sanity-2026-09-21`

The original fellow walkthrough SHA-256 was independently checked:
`0f6e31dcfce9723792630e65d4d8b3ee91228fdf6d6396d649ed630d3f365350`.
Required implementation-pack documents and referenced MCS-01/02/03/AF handoffs were read.
Cardiosave references were read in place (hybrid transport-module PDF p16 and troubleshooting
booklet PDF pp5–7). Raw authoring inputs were not copied into or committed to a checkout.

OD-01 through OD-08 remain **NOT REVIEWED** as owner decisions: AF model/device fidelity;
HM3 identity/estimator/reference state; coupled RV/preload/suction/volume response; clinical
threshold selection; current labeling/source/recall adjudication; media provenance/rights;
remaining content choices; and real-learner, clinical-owner, and release approval. Reading a
source to verify the PR's boundary is not adjudicating these decisions. The F09 shared-owner
repair and the planned responsive-layout work remain separately outstanding.

No merge, deployment, shared-state upload/Supabase mutation, or Prompt-02 implementation occurred.
After owner integration of this repair and merge of Prompt 01, Prompt 02 is the next authorized
implementation step. G02 was not restarted.

## Original PR changed files

- `docs/gap-remediation/self-paced/MCS-PRE-REVIEW-01-condition-inventory.md`
- `docs/gap-remediation/self-paced/MCS-PRE-REVIEW-01-handoff.md`
- `src/features/mechanical-circulatory-support/__tests__/m5-controls-and-surfaces.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/m5-practice-challenge.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/mcs-af-presentation.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/mcs-pre-review-01-base-guard.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/mcs-pre-review-01.test.tsx`
- `src/features/mechanical-circulatory-support/components/McsAfTriggerComparison.tsx`
- `src/features/mechanical-circulatory-support/components/McsAfTriggerLimit.tsx`
- `src/features/mechanical-circulatory-support/components/McsCaseWorkflow.tsx`
- `src/features/mechanical-circulatory-support/components/McsMonitor.tsx`
- `src/features/mechanical-circulatory-support/components/mechanical-circulatory-support.module.css`
- `src/features/mechanical-circulatory-support/components/stage/McsStageHost.tsx`
- `src/features/mechanical-circulatory-support/components/stage/McsStoryProblems.tsx`
- `src/features/mechanical-circulatory-support/components/stage/mcs-stage.module.css`
- `src/features/mechanical-circulatory-support/content/afTriggerComparison.ts`
- `src/features/mechanical-circulatory-support/content/afTriggerLimit.ts`
- `src/features/mechanical-circulatory-support/content/lessonTransfers.ts`
- `src/features/mechanical-circulatory-support/content/scenarios.ts`
- `src/features/mechanical-circulatory-support/content/sectionLearningContracts.ts`
- `src/features/mechanical-circulatory-support/content/sources.ts`
- `src/features/mechanical-circulatory-support/content/storyProblems.ts`
- `src/features/mechanical-circulatory-support/engine/model.ts`
- `src/features/mechanical-circulatory-support/engine/reducer.ts`
- `src/features/mechanical-circulatory-support/engine/types.ts`
