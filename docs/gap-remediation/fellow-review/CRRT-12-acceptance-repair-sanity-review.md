# CRRT-12 F06-01 acceptance-repair sanity review

**SANITY REVIEW: READY TO MERGE** for the bounded F06-01 information-gap repair. This is not full Batch-06 acceptance, source approval, a merge, or a deployment.

## Repository state and scope

| Item                                              | Independently checked                                                                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR                                                | #286, claude/crrt12-acceptance-repair into main; open, MERGEABLE/CLEAN at initial fetch; Registry scope check passed                                      |
| Original reviewed PR head                         | 0e34873f24186d41e94fe392d0b41d0377e4b6e0                                                                                                                  |
| Code commit                                       | f2f34fea46a8b782286f5badfbd7066736977ace                                                                                                                  |
| Original repair base and merge base               | 7525229328102d0c01d97528b5db22448665437b                                                                                                                  |
| Current main integrated in isolated review branch | 2105a05e2fdf56951b1e4b2f6c30147651cf8116                                                                                                                  |
| Before integration                                | Main ahead 9, PR ahead 3; 52 main-changed paths, all EBUS and ICU Hemodynamics; zero CRRT/shared/config/repair-path overlap                               |
| Integration                                       | Non-destructive merge into isolated codex/pr286-sanity-review, no conflict; merge commit 4dea91eaade816be7679ed6a3d734239078139ec                         |
| Review repair                                     | Commit 9be6fb5d30a9453eea1b66274e5692a78485beb0: future-tense generic causal-chain copy and a distinct accepted-alternative response; focused tests added |
| Final PR head                                     | Given in the final review handoff after the report commit; a document cannot contain its own commit SHA                                                   |

The root instructions and CRRT local-asset map, Batch-01–04 handoffs and sanity reviews, Batch-04 copy sheet, Batch-05 decision packet and 34-item queue, Batch-06 stopped acceptance, F06-01 repair handoff, and the CRRT implementation pack's COMMON_CONTRACT, FEEDBACK_LEDGER, and OWNER_DECISIONS were consulted. Queue decisions and reviewer fields remain untouched. The nine intervening commits were preserved.

The PR's original six paths were CRRT-12 narrative, evidence scope, one supplied-field descriptor, focused Jest/E2E tests, and the handoff. The review adds only the CRRT-12 narrative/test adjustment and this report. No engine equation, reducer, timed event, intervention ID/effect/prerequisite, numerical fixture, source record/status, clinical/device hold, case/lesson ID, or content/engine version changed.

## Independent baseline reproduction

On unchanged 75252293, the real /en/baxter-crrt/practice?case=CRRT-12 route at 1440×900 showed all four old contradictions. The introduction said the four clinical trends changed alongside interrupted treatment; the opening finding said linked domains changed; the performed review announced linked trends and the delivery timeline became available; and the debrief repeated that claim. The evidence scope was absent. After two learner hours, Patient & trends showed delivered dose 18.82 mL/kg/h, whole-patient balance −320 mL, downtime 0 min, and reassessment Not recorded, but no electrolyte, temperature, medication, or nutrition series. There was no page error.

The original new regression file failed **9/11** tests on unchanged base, with two invariant guards passing. After the review's two additional tests, unchanged base failed **11/13**, and repaired head passed **13/13**. Failures include the actual old runtime/DOM strings, missing scope, old alternative response, and generic no-action debrief wording. The base-passing tests protect state immutability after a review and containment of internal solute pools. Three baseline scope failures arise from the genuinely absent scope, including two null dereferences; the browser reproduction and other failing assertions independently establish the unsupported claim.

## Runtime identity and semantic repair

All 18 constructed runtime case definitions and resolved evidence scopes were serialized on unchanged base and final review code. **CRRT-01–11 and CRRT-13–18 are identical**, including initial patient, access, prescription, bags, timed events, intervention IDs/prerequisites/effects, critical-error rules, debrief, source IDs, and evidence scope. Only CRRT-12 differs. Its initial patient, device overrides, engine fixture/model configurations, timed event, source basis, critical-error rules, versions, and five intervention identities remain identical.

The old claim was copied across introduction, opening finding, objective/goal, mechanism, safe action and correct response option, safe and alternative action responses, hints, causal chain, transfer material, action notes, and debrief trend review. The repair frames these as evidence to obtain. The title names the four domains as a topic without asserting an observation. The safe review response records a request without implying data arrived. The accepted alternative records keeping settings unchanged and clarifying the gap without falsely saying the distinct review request happened. The generic causal chain now calls reassessment a **future** need. The removed duplicate generic debrief was not restored.

## Evidence, source, action, and debrief truth

CRRT-12's scope is visible before action. It reads the actual CRRT-11 seed inherited by CRRT-12 in phase7ReviewCases.ts: potassium **4.8 mmol/L**, bicarbonate **19.0 mmol/L**, pH **7.29**, and temperature **35.8 °C**. Each is “At case start.” The temperature descriptor reads initialPatient.temperatureCelsius, retains °C, and labels one observation rather than a trend. No other case scope uses it.

The scope marks serial electrolyte/acid-base values, serial temperature, medication delivery/exposure, nutrition intake/effect, earlier interruption evidence, and completed multidisciplinary results as absent. Calculated outputs are delivered dose, elapsed time and actual downtime, fluid ledger, current settings, circuit pressures, and action timeline. Chemistry/temperature change, medication exposure/clearance, and nutrition effect are explicitly not modeled. “Absent” is never displayed as zero or normal.

The GUID-RRT-ICU-2026 pointer resolves to a pending guideline record. Its registered claim/topic map covers the prescribed-versus-delivered gap during interruptions; the [published guideline's dose section](https://link.springer.com/article/10.1186/s13054-025-05817-6) describes that gap. The pointer's same-interval comparison and attribution caution are teaching inferences from this gap and the case's missing clinical evidence; they assert no new measured response or target. The broader multidisciplinary pointer has no registered source ID and visibly says “No registered source yet; awaiting clinical review.” No new source or review status was created or approved.

Through the real learning-session reducer, initial assessment followed by review leaves the entire simulation state deep-equal: no settings, patient quantities, clock, delivery/downtime, or observation changes. One performed-action timeline entry is added. No missing series or pharmacist/dietitian/nursing/prescriber result arrives.

| Debrief path              | Actual-run record                                                 | Generic debrief                                                           |
| ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Reveal without action     | No performed review; reassessment Not recorded                    | Missing evidence and future reassessment need; no review request narrated |
| Assessment then review    | Both actions recorded; reassessment Not recorded                  | Request note only in performed-action teaching; no series promised        |
| Assessment only           | Assessment recorded; no review; reassessment Not recorded         | No performed review narrated                                              |
| Assessment + review + 1 h | Both actions and time advance recorded; reassessment Not recorded | Same evidence limitation, with actual elapsed-time record                 |

Batch-01 laboratory containment remains: case-start synthetic labs may display, but changing internal solute pools do not become learner-facing laboratory trends or success/verdict inputs. No temperature, drug, or nutrition series was added.

## Pre-existing 60-second event

**DEFERRED TO RESUMED BATCH-06 ACCEPTANCE — PRE-EXISTING.** The ensureTimedResponse helper in completeCases.ts supplies CRRT-12's crrt12-event-reassessment-checkpoint at **60 simulation seconds** because its CRRT-11 template has no event. Its effect sets device.deliveryState to running; its fixture mapping dispatches SET_DELIVERY_STATE(running). The normal OPEN_STOP_DIALOG then END_TREATMENT sequence sets delivery to ended. Ending at 0 seconds and advancing one hour returns delivery to running; ending after 300 seconds and advancing one hour leaves it ended. Both stop actions were applied. The event, mapping, and behavior are identical on unchanged base and repaired head. This review makes no clinical/device correctness decision and does not modify it.

## Validation

| Check                                             | Result                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused CRRT-12 Jest                              | 13/13 pass on final code; 11 fail/2 pass on unchanged base                                                                                                                                                                                                                                     |
| Full CRRT and relevant shared Jest                | 128/131 suites and 1,495/1,498 tests pass; all CRRT tests pass. Three failures are shared critical-care accessibility image-name, learner-copy MV/MCS terms, and curriculum ordering. Each exact test/assertion/normalized failure output also occurs on untouched same-current-main 2105a05e. |
| Type-check                                        | PASS after generating Contentlayer types in the production build                                                                                                                                                                                                                               |
| Production build                                  | PASS, 776 static pages                                                                                                                                                                                                                                                                         |
| Changed-file ESLint/Prettier and git diff --check | PASS                                                                                                                                                                                                                                                                                           |
| CRRT Playwright production                        | 68 passed, 1 pre-existing beta-wrapper self-skip                                                                                                                                                                                                                                               |
| CRRT Playwright dev                               | 68 passed, 1 pre-existing beta-wrapper self-skip                                                                                                                                                                                                                                               |

The first isolated build attempt failed before compilation because symlinked dependencies made Vite resolve @vitejs/plugin-react from another checkout. Isolated dependency copies resolved that harness issue, and the build passed. No tracked asset or manifest changed.

## Production browser matrix

The direct CRRT-12 production route was exercised with a fresh Chromium context per setting. Each journey checked introduction, Current task, evidence scope, Evidence, Explain this case, assessment, review, Patient & trends after two hours, and debrief. All six showed the four case-start values, six absent-evidence labels, truthful review response, supported delivery/balance/downtime/reassessment values, neutral debrief, and no page errors.

| Display                  | CRRT-local horizontal overflow | Document overflow | Result                                                           |
| ------------------------ | -----------------------------: | ----------------: | ---------------------------------------------------------------- |
| 1440×900                 |                           0 px |              0 px | Readable                                                         |
| 1280×900                 |                           0 px |              0 px | Readable                                                         |
| 1024×768                 |                           0 px |              0 px | Readable                                                         |
| 390×844                  |                           0 px |              0 px | Readable                                                         |
| 320×740                  |                           0 px |              0 px | Readable                                                         |
| 1280×900, 200% root text |                           0 px |             51 px | CRRT copy readable; existing global header overflow, OTHER OWNER |

A separate dev-browser keyboard pass at 390×844 showed Shift+Tab from Evidence reaches Reference and Tab returns to Evidence; both have visible focus within the viewport. Enter opens Evidence and Reference, Escape closes each dialog after the UI update, and Space opens the worked plan and performs the review. The Reference dialog has zero horizontal overflow. A performed-action button is replaced during generic card rerender, leaving focus on BODY. The same behavior was reproduced on unchanged base for both assessment and review, so it is a pre-existing keyboard issue outside this repair. Screenshots, runtime dumps, and browser matrix are outside Git under Interventional-Pulm-Local-Data/renders/output/crrt286-sanity-2026-09-27/.

## Holds and NOT RUN

The CRRT-15 −40.5/−40/−41 discrepancy, device 0 mL / 0 mL versus evidence Unavailable, −25/−18 pressure questions, residual-clearance wiring, makeup, citrate physiology, filter change/loss, renal recovery, BP/pressor response, and predilution remain as Batch-06/owner-source holds left them. The 60-second event and pre-existing focus reset are recorded for later review, not repaired here.

**NOT RUN:** full resumed Batch-06 acceptance; owner clinical/device/source adjudication; native browser zoom, Firefox/WebKit, screen readers, physical devices, real learners, deployment, or merge.
