# CRRT-02 implementation handoff — three worked CRRT cases

## Delivery and scope

CRRT-02 turns **CRRT-05, CRRT-15 and CRRT-16** (the former capstone on the legacy Assess URL) into
worked learning examples. Work was done on `claude/crrt-02` in the `claude-crrt-02` worktree. At
the start the checkout was clean, and `HEAD` and `origin/main` were both `034648ad`. The
historical review baseline `9ef04539` exists in history. Newer CRRT work since then was kept and
built on:

- G01 source dates, reviewer queue and filter-drop hold (`9d43e317`, PR #206).
- The CRRT-01 self-paced conversion (`916eb45e`, PR #208).

This slice follows the v2 learning design brief and the CRRT-02 prompt; the three cases are
learning examples, not a test bank. It stops after these three so reviewers can judge the
pattern before it is scaled.

**Kept module-local.** Only `src/features/baxter-crrt/`, the CRRT-owned Playwright spec, and these
docs changed. There were no edits to:

- `learning-module`, the critical-care catalog or progress, global routes or the shared shell;
- access, authentication or release state;
- any other module, or Device Intelligence.

The only engine edit is an additive `export` of the existing `accessDysfunctionFraction` in
`engine/simulation.ts`, so the worked example reads the same access term the filter model
receives. Behavior is unchanged.

## What a learner now gets in each case

Every one of the three cases replaces CRRT-01's generic "worked plan" with a case-specific worked
example (`content/workedCaseExamples.ts`, rendered by `components/CrrtWorkedCaseExample.tsx`).

1. **Understand this case** shows the goal and the real controls to try, with their live labels.
   For CRRT-05 and CRRT-15 it also offers an optional **Try predicting** check with:
   - Show hint;
   - Show explanation before answering;
   - Check reasoning, with option-specific feedback;
   - Try again, and continue at any time.

   Nothing from the check is stored or scored.

2. **Explain this case** opens the worked example:
   - the learning point, stated first;
   - live values to read;
   - a **modeled comparison** computed by running the case twice through the learner reducer;
   - a case-specific demonstration: the pressure-location table for CRRT-15, or the domain table,
     filter-term readout and worked team summary for CRRT-16;
   - **Your run**: start, now, your change, and the modeled difference;
   - what the simulator does not show, with sources;
   - what to reassess, acceptable alternatives and uncertainty, and the items awaiting review.
3. The **debrief** adds "Expected and observed in this case": the learner's actual run beside the
   modeled difference. With no run it still reads "Example reviewed · no run performed".
4. Generic options are retired from the learner surface: the three unsafe "reasoning badly"
   actions and three "Do not reassess" checkboxes. Their records stay in the registry.
5. Hints, reassessment labels, goal labels, debrief summary, trend review, causal chain and
   reflection prompts are case-specific. They are the same text in the case, the worked example
   and the debrief, and a test pins that they are not reworded by the registry's wording
   substitution.

Actual interventions, time controls, the PrisMax machine surface, action prerequisites, delayed
responses and the reassessment record behave as before. The three kinds of material are labelled
distinctly: modeled comparisons ("an example, not your run"), demonstration tables (direction
only, illustrative operating point), and the learner's own run.

Full wording, numbers and sources are in the [faculty packet](CRRT-02-faculty-packet.md); every
item's disposition is in the [question ledger](CRRT-02-question-ledger.md).

## Simulation findings and repairs

The explanations were checked against the engine before any copy was written. Probe script and
output are kept outside Git in the session scratchpad.

| Case    | Finding                                                                                                                                                                                                                                                                                                                                                                                                             | Resolution in this slice                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRRT-05 | The split action set 900 mL/h pre-filter replacement, but the case hung no pre-filter source bag. The fluid model therefore stopped every pump: after 1 h, delivered dose was 0 and downtime 60 min, while the display read running. Separately, the model holds the concentration reaching the filter (1) and filtration fraction (0.1) constant, so the split cannot change clearance, filter burden or pressure. | **Repaired:** `customizeReplacementSplitCase` hangs a pre-filter source matching the post-filter one. Baseline values are unchanged (pinned from the pre-repair run), and after the split, delivery continues. **Not modeled (stated to learners, held for review):** the dilution effect. The worked example says identical clearance is a simulator limit, not evidence.                                                                        |
| CRRT-15 | The run starts with a low-effective-flow term of 0, and the "Address the verified low-flow contributor" action set it to 0.1. The correction created the contributor and slightly steepened the trend (filter pressure 70.429 vs 70.374 mmHg at 6 h). The description claimed rising trends with intermittently reduced flow that the run never shows.                                                              | **Repaired:** the low-flow effect is removed. The action keeps its 1-hour observation and is relabelled "Check blood-flow delivery and downtime, then observe one hour". Description and findings now describe the stable run. **Held for review:** filter pressure rises only 0.37 mmHg in 6 h, so the run cannot show a readable trend. No pressure event was invented; the existing pressure-location model demonstrates each pattern instead. |
| CRRT-16 | All intervention effects were already removed (CRRT-15 template), so the actions change nothing; the earlier circuit losses exist only in text.                                                                                                                                                                                                                                                                     | **Stated, not changed:** "The actions in this case record your plan and do not change the simulated circuit." The modeled comparison shows all-zero differences. Simulating the history or giving actions effects is listed for review.                                                                                                                                                                                                           |

**Fixture diff (all 18 cases, before and after):** 15 differing paths, all in the two repairs.

- **CRRT-05** — `fixture.bags` gains `pre-replacement-bag`; the path diff is positional.
- **CRRT-15** — `interventions[1].effects` loses `circuit.filter.lowEffectiveBloodFlowFraction set 0.1`.

The other **16 cases are byte-identical**, and no device calculation changed.

## Test-contract migration

| Old assertion                                                                                                                            | New assertion and reason                                                                                                                                                                                                                                                                                                                                                 | Preserved invariant                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `pilotCases.test.ts` "treats low effective flow as a contributor to correct, not one to create" asserted the action sets the term to 0.1 | Same test name: no CRRT-15 intervention targets the low-flow term, and the run starts at 0. The old value created the contributor the test title forbids; the owner-level brief requires a misleading causal response to be repaired, not disclaimed.                                                                                                                    | The dormant completion bound (≤ 0.2) is still asserted; CRRT-14 return-path and CRRT-16 no-template-physiology tests unchanged. |
| (none) The CRRT-05 split had no delivery assertion                                                                                       | `workedCaseExamples.test.tsx` pins that the split keeps delivering, that baseline values match the pre-repair run, and that without the pre-filter source the same split would stop delivery.                                                                                                                                                                            | Engine fluid-coupling rule unchanged and still exercised.                                                                       |
| CRRT-01 all-18 contracts (`selfPaced.test.tsx`, e2e): Explain shows `hiddenMechanism.summary`, hint and example debrief invent no work   | **Unchanged and passing.** For the three cases the summary is now the case's learning point.                                                                                                                                                                                                                                                                             | No prediction, action, reassessment, time or storage write from explanation, hint or debrief.                                   |
| (none)                                                                                                                                   | New `workedCaseExamples.test.tsx` (29 tests): content is exactly three cases; runtime copy equals authored copy; no grading, correctness or software terms; sources resolve and audited topics are supported; one model-matching option per check; retired ids exist; every interpretation claim holds in the simulation; the player journeys; axe on the worked region. | Written as explicit self-paced contracts; no safety, physics, source or data assertion was removed or skipped.                  |
| (none)                                                                                                                                   | New Playwright journey in `e2e/baxter-crrt-self-paced.spec.ts`: explanation first, hint, different answer, retry, real actions, +1 hr, comparison, debrief; CRRT-15 location feedback and narrow layout; CRRT-16 on legacy Assess, reload; storage stays ungraded.                                                                                                       | Existing four CRRT specs unchanged.                                                                                             |

## Executed evidence

Commands ran from the worktree root. Logs are in the session scratchpad (not committed).

| Check                                                                                                                                                                                                                                                                                     | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline, before edits: `npx --no-install jest src/features/baxter-crrt src/features/critical-care/progress/__tests__ src/lib/draft-modules.baxter-crrt.test.ts src/lib/site-search.baxter-crrt.test.ts src/app/sitemap.baxter-crrt.test.ts 'src/app/\[locale\]/baxter-crrt' --runInBand` | **69 suites / 691 tests passed** at `034648ad`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| After source changes, same scope plus `src/features/critical-care/__tests__/learner-copy.test.ts`                                                                                                                                                                                         | 70 suites / 695 tests: **2 failed**. (1) the CRRT-15 low-flow contract, migrated above; (2) the shared learner-copy static-copy lint. Retained as history.                                                                                                                                                                                                                                                                                                                                                                                                            |
| Shared learner-copy lint on an untouched detached `034648ad` checkout                                                                                                                                                                                                                     | **Fails at base** with **23 findings** (MV, MCS, ECMO, and four older CRRT components). The branch has the **identical 23** (set comparison); none is in a file this slice changed.                                                                                                                                                                                                                                                                                                                                                                                   |
| New worked-case suite, first run                                                                                                                                                                                                                                                          | 88 tests (with `pilotCases.test.ts`), **1 failed**: the shared term filter flagged the verb "correct" in CRRT-16's learning point. Reworded to "fix"; rerun **88 passed**.                                                                                                                                                                                                                                                                                                                                                                                            |
| Final jest: baseline scope + learner-copy lint + new suite                                                                                                                                                                                                                                | **71 suites / 724 tests: 723 passed, 1 failed.** The failure is the pre-existing shared learner-copy lint (identical 23 findings).                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| After the final CRRT-15 wording change: `workedCaseExamples`, `pilotCases` and `selfPaced` suites                                                                                                                                                                                         | **3 suites / 122 tests passed** (29 + 59 + 34).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `npx --no-install tsc --noEmit -p tsconfig.json`                                                                                                                                                                                                                                          | Exit 0 on the source changes. After the test file was added: the first run found **1 error** in the new test (`TS18048`: `fixture.bags` possibly undefined). After adding a null guard, the rerun **exited 0**.                                                                                                                                                                                                                                                                                                                                                       |
| ESLint on every changed TypeScript and e2e path                                                                                                                                                                                                                                           | Exit 0 before the test file. Including tests: **exit 0**, rerun after the test fix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `npx --no-install playwright test -c playwright.baxter-crrt.config.ts` (port 3113 confirmed free first)                                                                                                                                                                                   | **15 passed, 1 failed.** The new journey's locator matched four articles, because the other actions print "Requires Complete the initial clinical assessment". Fixed with an exact-text match, as the CRRT-01 test does. All existing CRRT specs, including all 18 case routes, passed.                                                                                                                                                                                                                                                                               |
| Self-paced spec rerun after the locator fix                                                                                                                                                                                                                                               | `npx --no-install playwright test -c playwright.baxter-crrt.config.ts e2e/baxter-crrt-self-paced.spec.ts`: **5 passed** (1.2 m), including the new worked-case journey. Rerun after the final list-marker CSS change: **5 passed** (1.2 m).                                                                                                                                                                                                                                                                                                                           |
| In-app browser check                                                                                                                                                                                                                                                                      | **The in-app Browser pane was not used.** Its launch entry (port 3123) was held by another chat's dev server, and `.claude/launch.json` is tracked, so it was not changed. The visual check used the screenshots the passing Playwright journey captured from the real routes: CRRT-05 desktop after a real split and +1 hr, CRRT-15 at 390 px, and CRRT-16 desktop. The review found missing list markers, which were fixed and re-verified. Tables scroll inside bounded regions, with no page overflow. The screenshots are local artifacts and are not committed. |
| Fixture capture before and after (`normalizeRuntimeCrrtCaseToEngineFixture`, all 18)                                                                                                                                                                                                      | Differences only in the two repairs listed above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Faculty packet                                                                                                                                                                                                                                                                            | Generated by a script that imports the content module, the simulation and the pre-change runtime copy dumped from the base checkout, so quoted numbers and text are what the code produces.                                                                                                                                                                                                                                                                                                                                                                           |

Browser automation is not clinical acceptance or a screen-reader audit.

## Legacy progress and persistence

No storage, analytics or progress code changed.

- **Check state:** the optional check's choice, hint and explanation live in component state only.
  The player tests assert `localStorage` stays empty through explanation, hint, answer, retry and
  debrief.
- **Visits:** CRRT-01's `selfPaced` extension of `baxter-crrt-progress-v3` still records only
  visits and last location.
- **Legacy records:** kept byte-for-byte and read-only.
- **Retired records:** the unsafe-action, critical-error and "do not reassess" records remain for
  compatibility with dormant scoring code, which has no current consumer. Because they are no longer
  rendered, the simulation safety notice cannot be triggered from these three cases.
- **Resets:** re-entering a case starts fresh controls, as before.

## Source and clinical holds

- **No clinical approval.** No reviewer decision, review date or approval was recorded or
  implied; every item in the packet is **NOT REVIEWED**.
- **Awaiting a named reviewer:**
  - CRRT-05: whether to model pre-filter dilution; bedside dose adjustment for predilution; the
    core-curriculum passage behind the predilution and hemoconcentration wording; the PrisMax
    total-predilution and filtration-fraction expressions (the pre-infusion conflict).
  - CRRT-15: a scheduled pressure change so the run shows a readable trend; filter-burden rates;
    alarms and troubleshooting steps for a filter-side pattern.
  - CRRT-16: a source for "factors combine to shorten filter life"; simulating earlier circuits;
    whether actions should change the circuit; the escalation path.
- **G01-CRRT-02** (placement of the PrisMax −25 mmHg filter-drop correction) remains held and is
  cited in the CRRT-15 teaching.
- **Claim-topic map unchanged.** One note claims an audited topic (`REVIEW-CKRT-CORE-2025`,
  solute-transport mechanisms). Device-manual citations rest on their registered claim and page
  locator. Notes without a registered source say so to learners.
- **Out of scope:** citrate and anticoagulation dosing, filter-change criteria, and alarm responses
  are not taught. Learners are pointed to device instructions and local protocol.
- **Model limits stated to learners:** constant filter-inlet concentration and filtration fraction;
  slow filter-burden rates; constant effluent pressure in CRRT-15/16; no anticoagulation control.

## Checks not run

- Clinical, nephrology or operator review.
- Real-console validation.
- Safari or Firefox.
- A formal VoiceOver or screen-reader audit.
- A production build: `next dev` compiled the CRRT routes under Playwright, but `npm run build`
  was not run.
- Account sync, deployment, and any Supabase or upload script.

## Next slice

1. Faculty review of these three cases using the packet. Decide the open questions before
   scaling the pattern.
2. **CRRT-03**, only after that review: apply the worked-case pattern to the remaining generic
   case plans CRRT-01/02/06/07/11 flagged by CRRT-01, and run the same engine checks before writing
   copy. Expect more template-inherited physiology problems like the two repaired here.
3. Naming consistency for the former capstone: the hub card and module nav still say
   "Challenge". Copy only; left unchanged here to keep the slice bounded.
4. The shared learner-copy lint has failed on `main` since before this slice. Four CRRT
   components (`CrrtFoundationTools`, `CrrtIntegrationTool`, `CrrtLivePressureStation`,
   `CrrtOperationalTools`) and MV/MCS/ECMO files need their own copy slice.

## Changed files

- `docs/gap-remediation/self-paced/CRRT-02-faculty-packet.md` (new)
- `docs/gap-remediation/self-paced/CRRT-02-handoff.md` (new)
- `docs/gap-remediation/self-paced/CRRT-02-question-ledger.md` (new)
- `e2e/baxter-crrt-self-paced.spec.ts`
- `src/features/baxter-crrt/__tests__/pilotCases.test.ts`
- `src/features/baxter-crrt/__tests__/workedCaseExamples.test.tsx` (new)
- `src/features/baxter-crrt/components/CrrtCasePlayer.tsx`
- `src/features/baxter-crrt/components/CrrtWorkedCaseExample.tsx` (new)
- `src/features/baxter-crrt/components/crrt-worked-case.module.css` (new)
- `src/features/baxter-crrt/content/completeCases.ts`
- `src/features/baxter-crrt/content/workedCaseExamples.ts` (new)
- `src/features/baxter-crrt/engine/simulation.ts` (additive export only)
- `src/features/baxter-crrt/workedCaseModel.ts` (new)
