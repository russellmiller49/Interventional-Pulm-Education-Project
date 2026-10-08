# PR #327 independent adversarial sanity review

October 4, 2026. Independent semantic/source audit performed by **GPT-6 Astra, High reasoning**;
reproduction, bounded repairs and combined-tree validation performed in the Codex review worktree.
This is an engineering and teaching-contract review, not clinical/device approval.

## Verdict and scope

**Software/runtime merge readiness: READY for the bounded Prompt-04 repair.**
**Clinical/device/content readiness: NOT REVIEWED; specified work remains BLOCKED ON OWNER DECISION.**
**Release readiness: NOT ESTABLISHED.**

No PR merge, deployment, Prompt 05 or Prompt 06 work was performed. The repair touches ECMO copy,
presentation branches and tests. Engine, session, source approvals, shared learner-copy schema,
answer keys, physiological coefficients and thresholds are unchanged relative to current main.

Read in full for the independent audit: original PR diff, Prompt-04 handoff and ledger; the original
walkthrough DOCX; implementation brief, FEEDBACK_LEDGER, SOURCE_AND_CODE_NOTES,
CROSS_MODULE_COORDINATION, SHARED_FEEDBACK_HANDOFF and OWNER_DECISIONS; Prompt-01/02/03 handoffs
and reviews; #315 handoff/post-merge contract; applicable repository instructions. Private sources
were read in place in Local-Data, not copied into Git. The walkthrough is an AI-assisted fellow
persona report, not human learner evidence.

## Git integration

- Original submitted PR head: `17e2f7c5e1f730c0598b688a4f83436cef8f09d8`.
- Original PR base: `9086f2af0a538a0afabf964273cf15a219e165d6`.
- First fetched main: `746c545edaa9d3b247fd4b64d4108a0f26a0b45f`. Its 174 changed paths had no
  ECMO or shared-feedback runtime overlap. True merge: `d0a0fbafb20f45a7a8680c29fd618f99d031535c`.
- Main advanced to `1dfc584501bcd62648f3ceebde691ff645ea309b` (PR #331). Deliberately inspected its
  29-path range, including four ECMO CSS files: `components/cardiohelp-ecmo.module.css`,
  `components/shell/EcmoActivityShell.module.css`, `components/stage/ActivityFlow.module.css`, and
  `components/stage/EcmoLessonStage.module.css`. These alter wide circuit/teaching layout; they do
  not change simulation or feedback semantics. True merge: `8db71d0a5fba52455d5b77f72c186781cbbd46fe`.
  Full ECMO, consumers, 8-GB TypeScript, production builds and production browser checks followed.
- Final integrated main: `fd6805119d9de8bb454d8dcf7f879f4e8165f420` (PR #323). Only
  `docs/gap-remediation/fellow-review/CRRT-FELLOW-06-final-acceptance.md` changed after `1dfc5845`;
  no runtime/test/build-input change. True merge: `1c94edc4b4e6758923cd0d03cbe5ef4f9d6d8601`.
  The detached baseline was advanced to the same main. Production outputs built immediately before
  this documentation-only merge have identical application inputs on the prospective merge tree.
- Local review branch: `codex/ecmo-327-adversarial-review`; updates go to the existing PR branch
  `claude/ecmo-fellow-04`, under the user's explicit exclusive-ownership authorization. No rebase
  or force push. Runtime/test repair commit: `0a2125ad0ec8ef7b364d14a045787393c788e5e1`. The final documentation commit/head is recorded in the PR and review response.

## Defects found and repaired

1. The checklist header alone did not contain the semantics: fallback prompts, expected-response
   labels, submitted status, Now card and debrief still called checklist statements observations or
   recorded findings. The four guidance-derived cases (VV/VA transport and both integrated cases)
   now consistently describe a checklist comparison. Authored reassessment cases retain observation
   wording. IDs, keyed selections, reducer events, gates and timings are unchanged.
2. ECMO's existing `EcmoOtherAnswers` includes every unselected alternative, including the keyed
   answer after a wrong/partial/unsafe choice. Its heading is now **How the other answers compare**.
   This uses the existing module-local component; no shared file or competing feedback system was
   introduced. S1-1's heading is repaired locally; option quality/order/key identification remains
   broader content/shared work. VA6-2 stays partial.
3. The actual VV capstone stem and a newly visible key point still implied committing before
   looking/measuring. Both capstones' residual teaching points now describe an optional prediction
   and comparison. Explanation stays available before an answer.
4. Drainage saturation wording is narrowed to a drainage-line measurement, **not a direct
   measurement** of patient mixed-venous saturation; it no longer asserts universal non-equivalence
   or that no circuit sensor could read a relevant value.
5. Sweep/ventilator FiO₂ language identifies the gas delivery sites (membrane lung/native lungs),
   replacing “act on different lungs.” The registered ELSO VV 2021 guideline already uses FDO₂;
   the handoff's contrary registration claim was corrected without renaming the UI.
6. Alarm acknowledgement **does not correct the underlying cause**. It no longer promises the cause
   necessarily persists until someone corrects it. Blood parameters are called console blood
   parameters, rather than all venous-line values (TArt is arterial temperature).
7. #315's test claiming no second prediction exception passed through distinct reason strings.
   It now accurately describes a VV-local reason and asserts the exact two transport overrides.
   The original, unmodified suite passed before this narrow test repair; persistence is untouched.

## All 52 source-ID dispositions

Final totals: **22 repaired / 10 partly repaired / 3 contained / 13 prior repairs / 2 no change /
2 clinical/content holds**. No row is promoted by resolving an owner decision.

The [copy ledger](ECMO-FELLOW-04-copy-ledger.md) retains each original complaint, original main
baseline, Prompt-04-owned residual, before/after change, support, remaining limitation and owner.
Its baseline column describes `9086f2af`; this review independently checked current-main behavior,
not merely that historical label. None of the subsequent main ranges changed these authored
complaints; #331's geometry was checked separately. The following is the final row-by-row audit.

| ID     | Final disposition | Residual / ownership qualification                                                                                                  |
| ------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| OV-2   | Partial           | Disclosure repaired; clinical/device source review remains human/05 work.                                                           |
| S1-3   | Repaired          | Sweep gas introduced where first requested; key unchanged.                                                                          |
| S1-4   | Repaired          | Delivery and consumption distinguished; exact arithmetic source need stays held.                                                    |
| S1-5   | Repaired          | Supplied example identified; Prompt-02 numeric fixes preserved.                                                                     |
| S1-6   | Repaired          | No nonexistent adjacent circuit/patient promised.                                                                                   |
| S1-7   | Partial           | Existing recap available; exact oxygen-content arithmetic source remains 05.                                                        |
| S2-1   | Repaired          | Optional check truthfully keeps labelled map; no clean-view gate.                                                                   |
| S2-5   | Prior repair      | Prompt-03 model detail disclosure retained.                                                                                         |
| S2-6   | Prior repair      | #315 location/disclosure only; in-progress persistence remains owner-held.                                                          |
| S2-7   | Partial           | Drainage probe/direct-measurement distinction narrowed; common lesson terminology remains 05.                                       |
| S2-8   | Repaired          | Pressed state/task consistency retained; device-authentic Δp.                                                                       |
| S3-2   | Prior repair      | Prompt-02 suction action/reading preserved.                                                                                         |
| S3-4   | Repaired          | Names the actual increase-speed control.                                                                                            |
| S4-4   | Partial           | Gas sites and first-use recirculation gloss repaired; module-wide terminology stays content-owned.                                  |
| S5-3   | Partial           | Key points moved before optional question; repeated tasks/table remain curriculum work.                                             |
| S5-4   | Repaired          | Read replaces a nonexistent decision.                                                                                               |
| S5-5   | Prior repair      | Prompt-03 units, spacing and screen-reader fixes retained.                                                                          |
| S6-2   | Prior repair      | Prompt-02 notation/context fix preserved.                                                                                           |
| S7-1   | Prior repair      | Prompt-03 signal layout/pAux explanation retained.                                                                                  |
| S7-4   | No change         | Target is already beside instruction.                                                                                               |
| S7-5   | Partial           | Alarm name/acknowledgement fixed; saturation context/time remains 02/content. Historical 69.8/74.6 not certified as current values. |
| S8-1   | Repaired          | Visible teaching acknowledged; optional self-check, not withheld assessment.                                                        |
| S8-3   | Held              | Cause selection and recovery timing remain 05 / OWNER-10.                                                                           |
| S9-1   | Repaired          | No false held-back mechanism promise.                                                                                               |
| S9-2   | Partial           | One optional contract; authored/data-driven default disclosure differs, content-owned.                                              |
| S9-3   | Repaired          | Reviewed means progress, not performed/answered; two valid routes remain optional.                                                  |
| S10-1  | Repaired          | Same truthful optional drill contract.                                                                                              |
| S11-1  | Repaired          | No promise the visible teaching hides the answer.                                                                                   |
| S11-2  | Prior repair      | Prompt-02 sweep/time wording preserved.                                                                                             |
| S12-1  | Repaired          | Optional self-check contract.                                                                                                       |
| S12-2  | Repaired          | Acid-base values on patient monitor; console blood parameters include TArt.                                                         |
| S14-1  | No change         | No lane-04 portion; prior containment preserved, OWNER-02 device display held.                                                      |
| S16-1  | Prior repair      | #315 VV 24 percent unchanged.                                                                                                       |
| S17-2  | Prior repair      | Prompt-03 comparison disclosure preserved.                                                                                          |
| S17-3  | Repaired          | Capstone visible pattern/teaching acknowledged, including residual stem and key point.                                              |
| S17-5  | Held              | Question design/repetition remains Q1 / 05.                                                                                         |
| VA5-2  | Repaired          | Original As S5-5 units/spacing plus optional template repaired; duplicate-task issue belongs S5-3.                                  |
| VA6-2  | Partial           | Unsafe/local heading repaired; weak long keyed option remains Q2 / 05.                                                              |
| VA7-1  | Partial           | Shared tour identified as optional; repeated tasks require curriculum mapping.                                                      |
| VA12-1 | Repaired          | No false withheld-answer promise.                                                                                                   |
| VA16-1 | Repaired          | 24 percent agrees with authored battery; second item-local exception verified.                                                      |
| VA17-2 | Repaired          | Comparison remains visible; prediction optional.                                                                                    |
| C1-5   | Prior repair      | Prompt-01/03 controls, routing and comparison retained.                                                                             |
| C7-2   | Prior repair      | Refused unsafe action is not APPLIED; safety checklist stays accessible.                                                            |
| VAC5-2 | Prior repair      | Recognition/escalation truth repaired by 01; absent treatment physiology remains held.                                              |
| VAC6-1 | Partial           | Prompt-02 limb note corrected; realistic recovery timing still OWNER-10 / 05.                                                       |
| IV-1   | Contained         | Untaught separation decision explicitly outside exercise; SB1 / OWNER-11.                                                           |
| IV-2   | Repaired          | Entire checklist comparison path truthful; authored observed responses remain Q3.                                                   |
| IV-3   | Contained         | No trial verdict/duration/restore rule; SB1 / OWNER-09 and -11.                                                                     |
| IA-1   | Contained         | Composite records recognition/escalation, no procedure; SB2 / OWNER-11/-12.                                                         |
| IA-2   | Repaired          | Entire checklist comparison path truthful; authored observed responses remain Q4.                                                   |
| IA-4   | Prior repair      | Prompt-01 alarm and paired-lesson truth preserved.                                                                                  |

S7-5 is downgraded from repaired to partial; VAC6-1 from prior-repaired to partial. Remaining
classifications are scoped to their owned portions, not claims that the entire original complaint
or all clinical shortcomings are resolved.

## Semantic and source verdicts

| Contract                      | Verdict and evidence                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| False exam promises           | PASS after repair. Rendered prediction, map, capstone, unsafe and integrated surfaces preserve teaching/measurements/boundaries/explanation before answering; wrong-answer retry, correct explanation and open navigation remain. No score/mastery/attempt mechanism added.                                                                                                                                  |
| Key points before question    | PASS. All six changed narrative sections render existing key points first, then optional self-checks. Residual capstone concealment words repaired. Source IDs retained; unshown rapid-CO₂-correction hazard point not newly surfaced.                                                                                                                                                                       |
| Answer-leak matchers          | PASS. Regex patterns unchanged; Δp comments/test labels/fixtures only. Case-insensitive transmembrane relationship detection retains all four concepts and still catches unintended disclosure on surfaces whose contract requires it. No matcher weakened to allow the recap.                                                                                                                               |
| Second battery exception      | PASS. VV and VA authored batteryPercent are 24; both learner items say 24 percent. Exact two item-local overrides; all other flagged copy excluded, no inferred runtime, shared schema unchanged.                                                                                                                                                                                                            |
| Δp                            | PASS. Registered CARDIOHELP IFU rev. 2.3 (January 2025), printed p. 136, calls Δp pressure drop calculated as pInt−pArt. Lowercase p is source-authentic. “Trend” is module display wording, not asserted as the IFU term. Different typography/transcription contexts are not new device channels.                                                                                                          |
| Alarm list                    | PASS after narrowing. UI and IFU §9.2/printed p. 158 use Alarm list and last six alarms. IFU alarm controls/printed p. 51 support temporarily silencing the current alarm; optical signal/new alarms remain relevant. The reviewed sentence does not correct a cause, and does not invent inevitable persistence. It is not a claim that the simulator reproduces every hardware sound-timing behavior.      |
| Sweep-gas FiO₂                | PASS after repair. Gas-site wording replaces ambiguous “act on different lungs”; UI term preserved. Registered ELSO VV 2021 Table 7 uses FDO₂, so the historical “no registered source” rationale is false and corrected. Terminology standardization remains content-owned.                                                                                                                                 |
| SvO₂/drainage-line saturation | PASS after narrowing. IFU venous-probe channel (printed p. 39), sensor map and model identify the drainage-line measurement. No direct patient mixed-venous measurement or universal physiological equivalence/non-equivalence is claimed.                                                                                                                                                                   |
| Oxygen balance                | PASS conceptually. Content and flow contribute to delivery; consumption is a separate demand. Registered ELSO VV 2021 supports that distinction. Its numeric convention is not the model's exact 1.34 coefficient; no numeric equation is newly approved.                                                                                                                                                    |
| VV off-sweep scope            | PASS as containment. SET_SWEEP to 0 keeps positive circuit bloodFlow and requested rpm at the action; no same-second patient change. Authored order is oxygenation, work of breathing, PaCO₂/pH. No lesson teaches separation, no trial-success/duration/restore decision is recorded. Rendered monitor and sweep control remain available. Flow is not claimed physiologically constant for all later time. |
| VA composite action           | PASS. Recognition leaves differential-hypoxemia active. Raw patient state matches an untreated branch at action and across 60 steps, with right-arm saturation below 90. No configuration/unloading procedure occurs. Browser journey preserves low right-arm saturation.                                                                                                                                    |
| Checklist vs reassessment     | PASS after full-path repair. Four guidance-derived cases label selections as checklist comparison; authored cases preserve observation language. Submission/debrief are tested on both paths; no measured findings inferred from checklist choices.                                                                                                                                                          |
| Section reviewed              | PASS with precise scope. Final-step performance or explicit final-step skip can display the end card. Skip sets sectionReviewed without adding performedIds or committing prediction. Historical performed/review progress remains distinct; completion is not proof every task was visited, performed or answered. No persistence change.                                                                   |
| End cards                     | PASS. All six next-in-unit pairings checked against pathway resolver/registry, existing case and differing mechanism; click both destinations, both enabled, either order. Four next sections load in place; two route to foundation sections.                                                                                                                                                               |
| Source registry               | PASS. All 15 registered sources have no clinical/device review on record. Status stays outside native details; all 15 claim/limitation/document-check rows remain within. Keyboard Enter/Space opens/closes disclosure. No source data/review metadata deleted; lesson references stay available before answers.                                                                                             |
| S1-1 local other answers      | Local heading REPAIRED in existing component. Tests cover wrong/partial/unsafe/best alternatives and retry. Wider question-quality/order work remains held/shared; not counted as a 53rd row.                                                                                                                                                                                                                |
| Unsafe feedback               | PASS. Both ECMO feedback implementations use the existing frame override; truthful harm warning while retry/navigation continue. Refused actions remain refused, with no applied-action claim or altered penalty semantics.                                                                                                                                                                                  |
| Acquisition language          | PASS on changed surfaces. Acid-base and VA upper/lower-body values/arterial trace belong to the independent patient monitor. Console Blood parameters holds its own channels, including TArt. Reading supplied data is not performing a bedside measurement.                                                                                                                                                 |

The six changed pairings are enumerated independently (all `next-in-unit`, never a claimed
same-mechanism application):

| Lesson                                   | Next section                       | Practice case                     | Mechanism / teaching location                                        |
| ---------------------------------------- | ---------------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| afterload-return-obstruction             | afterload-oxygenator-resistance    | clinical-vv-oxygenator-thrombosis | Return-path → membrane resistance; taught immediately next.          |
| acute-hypercapnia                        | compensated-hypercapnia            | clinical-vv-gas-disconnection     | Acute hypercapnia → gas-path failure; taught later.                  |
| compensated-hypercapnia                  | gas-source-interruption            | clinical-vv-gas-disconnection     | Compensated hypercapnia → gas-path failure; taught immediately next. |
| transport-power-loss                     | vv-integration-capstone            | clinical-vv-circuit-air-embolism  | Power loss → circuit air; taught earlier.                            |
| va-afterload-arterial-return-obstruction | va-afterload-oxygenator-resistance | va-clinical-vasoplegia            | Return-path resistance → vasoplegia; no matching lesson.             |
| va-transport-power-loss                  | va-integration-capstone            | va-clinical-limb-ischemia         | Power loss → limb ischemia; no matching lesson.                      |

“Section reviewed” is transient UI state. The end-card call to `core.completeLearnLesson` is an
explicit no-op. Existing persistence writes occur on entry/navigation: visited topic IDs,
lastVisited and per-track lesson/case pointers, with legacy history preserved. No newly stored
reviewed/completed/answered/performed flag exists. Showing the card after a final-step skip does
not certify every task was visited.

Source cross-check: [registered ELSO VV 2021 guideline](https://pmc.ncbi.nlm.nih.gov/articles/PMC8315725/),
particularly Table 7 for FDO₂. Private IFU page references above provide verification without
redistributing its text. Source confirmation is not human clinical/device review.

## Cross-batch preservation and test quality

- Prompt01: VV/VA air isolation/de-air/resume, premature refusal, idempotent repeat, restart and
  recognition-vs-treatment preserved in Jest and original production browser driver.
- Prompt02: authored t0/no hidden tick, same-second recomputation, reveal freeze, untreated
  C5/VAC5/VAC2, C3 protective-stop chronology, immutable action observations and untreated-from-
  presentation comparison preserved.
- Prompt03: all original layout/focus assertions retained; phone header, console, comparisons and
  conceptual boundaries checked on combined CSS. Additional 1700 px normal/doubled-root checks
  exercise tabs/full-width circuit after #331.
- #315: unmodified preservation tests first passed; only misleading battery-exception description
  and exact override enumeration then changed. Original five browser tests remain unmodified and
  unstubbed. Save & exit, saved location/history, fresh answers/state/actions/snapshots and hub
  “Return to your saved location” are preserved.
- Original Prompt04 suite contained 76 checks. Independently sampled eight baseline-present
  rendered contracts on detached main; all eight failed for the intended missing learner-facing
  behavior (remaining 68 skipped). This supports sensitivity, not a newly reproduced 69/75 claim.
- Added 22 checks (98 total) for local feedback, all narrative sections, all six destinations,
  raw VV/VA action truth, complete checklist submission/debrief and authored observation path.
  Two integrated checklist assertions failed before repair. No answer-leak regex or navigation
  assertion weakened. Prior changes pinned renamed copy, units or exact menu names only.
- Production 350-check driver initially flagged the now-repaired gas-site sentence at all five
  widths because it required “act on different lungs.” Its assertion was updated to the exact new
  gas-site sentence, retaining both FiO₂ identities. No geometry failure suppressed. The new
  browser spec initially had an ambiguous two-status locator; it now selects the actual checklist
  submitted status. These were harness corrections, not product changes to make tests green.

## Validation on the prospective merge tree

Durable evidence lives outside Git at
`Interventional-Pulm-Local-Data/renders/output/ecmo-fellow-04-sanity-2026-10-04/`.
The working evidence directory is `/tmp/ecmo327-review/`. Production servers 3177 (PR) and 3176
(detached current main) use full standalone builds with no .env.local. Current-main application
inputs at fd680511 are identical to 1dfc5845; the last integrated range is CRRT documentation only.

| Check                                         | Final result                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Full ECMO before repairs                      | 82 suites, 2588/2588; original #315 checks unmodified                                              |
| Full ECMO after repairs and #331 merge        | 82 suites, 2610/2610 (`combined-ecmo.json`)                                                        |
| Targeted Prompt04                             | 98/98 in a dedicated final run and full suite                                                      |
| Relevant consumers                            | 56 suites, 631 pass / 3 fail; detached current main exactly 631 pass / 3 fail                      |
| Additional direct-consumer selection          | 454 pass / 3 same baseline failures; no ECMO failure                                               |
| TypeScript                                    | 8 GB heap, pass (`combined-typecheck.log`)                                                         |
| Changed-path ESLint / Prettier / diff check   | ESLint, Prettier --check and git diff --check pass                                                 |
| Full production build including training apps | Pass on combined tree and detached current main                                                    |
| Production changed-flow journeys (350 checks) | 348/350; only the two exact current-main hub overflows                                             |
| New bounded-repair browser spec               | 7/7 at five required viewports plus 1700×900 normal/doubled root                                   |
| Original #315 browser spec                    | 5/5 unmodified, no API stub                                                                        |
| Original Prompt01 driver                      | 29/31; two missing-Supabase global-prefetch error checks, identical 29/31 on detached current main |
| Original Prompt02 driver                      | 29/29                                                                                              |
| Original Prompt03 layout/focus specs          | 36/36 unmodified (12.8 minutes)                                                                    |

The three consumer failures match by test and message: CRRT authored case order, non-ECMO circuit
color accessibility, and static MV/MCS learner-copy vocabulary. None is changed by this PR.

Changed journeys use 1280×961, 390×844, 390×844 root 32 px, 320×740, 320×740 root 32 px. This is **200% root
font enlargement**, not native zoom/CSS zoom. Chromium, fresh contexts, reduced motion, DPR 1;
journey/layout API isolation follows the existing suite. Unstubbed Prompt01 exposes missing
Supabase credentials; no signed-in route or backend validation is implied.

Both reported hub-overflow failures reproduced exactly on current-main production:418/390 and
410/320 at root 32 px. The baseline changed-flow suite is 198/350, including those two failures.
Changed Learn/Practice/integrated surfaces have no new document horizontal overflow. Baseline
hub layout remains lane 03 work, not silently accepted as a passing check.

Additional wide-screen geometry: the 1700×900, root 32 px probe found the global header is 617 px
high and programmatically focused clamp buttons extend below the viewport (bottom 945 px). Both
current main and PR have **identical** geometry; normal-root controls fit and all views have
1700 px document width. This is a separate baseline enlarged-text layout limitation, not a passing
focus-clearance claim. The seven new browser tests cover tab navigation/toggle/overflow, not full
clamp visibility. Screenshots of narrow checklist/feedback and wide circuit were inspected; they
show extensive vertical wrapping at doubled text. No new horizontal overflow was found.

## Holds and limits

Clinical/device/content review remains NOT REVIEWED. All **ECMO-OWNER-01 through -12** remain open,
especially -09 (time/CO₂ pacing), -10 (unrepresented responses/recovery timing), -11 (integrated clinical
scope) and -12 (orientation). S8-3 and S17-5 remain held. Q1–Q10 and SB1–SB2 remain proposals only;
no new question, clinical answer, weaning protocol, resume rule, duration or procedure authored.
The exact oxygen-content arithmetic source remains needed. FDO₂ registration is no longer
incorrectly listed as missing; selecting one module-wide term remains content work.

Not established: real device behavior, human clinical review, real learner outcomes, screen-reader
or touch-device use, non-Chromium browsers, native zoom, higher DPR, translations, signed-in/beta
routes, backend production integration or deployment. Model limitations and the known baseline
layout/environment failures remain visible in this report. A bounded software merge verdict
must not be read as clinical, device or release approval.

## Reproduction and evidence index

- `combined-ecmo.json/log`, `prompt04-final.log`: full ECMO and targeted repair assertions.
- `combined-consumers.json`, `current-main-consumers.json`, `consumer-baseline-comparison.json`:
  same failed test set and byte-equal failure messages after normalizing absolute checkout paths
  and terminal colors. Direct-consumer selection and earlier baseline samples are retained too.
- `combined-build.log`, `current-main-build.log`: `NODE_OPTIONS=--max-old-space-size=8192 npm run build`.
- `combined-typecheck.log`: `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`.
- `final-eslint.log`, `final-format-check.log`, `final-diff-check.log`: changed-path static checks.
- `final-complete-journeys/`, `current-main-journeys/`: all 350 individual rendered assertions,
  including failing hub dimensions; original driver with only the bounded gas-site text assertion
  adjusted. The earlier stale-string failure runs are retained, not substituted for the final run.
- `flow-verified.log`, `flow-results/`: the seven new production tests and five original #315 tests.
  `flow.config.ts` shows the isolated config; its testMatch selects those two files against 3177.
- `layout.log`, `layout-results/`: original 36-check layout/focus run, using
  `ECMO_LAYOUT_BASE_URL=http://127.0.0.1:3177 npx playwright test --config playwright.ecmo-layout.config.ts`.
- `prompt01.log`, `current-main-prompt01.log`, `prompt02-final.log`: original preservation drivers.
- `wide-review.json` and `wide-{main,pr}-{16px,32px}.png`: identical baseline wide-screen clipping.
- `initial-main-paths.txt`, `main-advance-paths.txt`, `final-main-paths.txt`: integration path inventories.

To rerun the new browser tests, use a Playwright config with this repository's `e2e` testDir,
`testMatch: ['ecmo-teaching-flow.spec.ts', 'ecmo-save-location.spec.ts']`, Chromium, one worker,
and `use.baseURL` pointing at a freshly built standalone server. The checked-in test also runs
under the repository's default Playwright config. Root-font scaling is set by each test itself.
