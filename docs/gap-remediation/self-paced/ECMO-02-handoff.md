# ECMO-02 — findable lesson titles and self-paced catalog language

## Scope and authoritative baseline

Executed the owner-selected ECMO-02 prompt against merged `main` at
`905372bed4f0bbb150234df8ab31a658f31294ff` (September 15, 2026). Initial worktree
`codex-ecmo-02` was clean on `codex/ecmo-02`; after fetching, implementation started on
`codex/ecmo-02-catalog` from `origin/main`. A second fetch before delivery still resolved to
that same commit. Historical baseline `9ef04539118b889a344992c63ba35808ee477f0e` was compared,
not restored.

The September 14 self-paced design brief and the owner's current bounded request govern this
repair. Applicable skills: interventional-pulm-education, medical-education-modules and
structured-medical-modules. Their older universal answer-concealment, mandatory assessment,
completion and layout guidance is superseded within this scope. This is a catalog/copy repair,
not a curriculum migration or clinical update.

### Already merged and retained

- [ECMO-01](ECMO-01.md): direct explanations, optional predictions, hints, retry and skip;
  meaningful case headers/pickers; honest visit/location persistence; separate activity entry
  and real safety/interlock predicates; existing VV/VA routes and model behavior.
- [SHARED-01](SHARED-01-HD-ECMO-handoff.md): ECMO catalog activities are non-credit, with no
  prerequisite gates, mastery rule or completion evidence authority. Historical ECMO records
  cannot drive recommendations, public/restricted account sync, readiness or current claims.
- Subsequent merged self-paced consumers retain their current behavior. All 109 non-ECMO
  generated activity objects are identical to baseline, including HD, CRRT, MV, MCS and ICU.

No progress adapter, account-sync implementation, route resolver, physics, action predicate,
source registry, device asset, dependency, backend, authentication, authorization or release
constant changed. Device Intelligence is outside this PR and was not modified.

## Behavior and changed paths

| Paths                                                                                                                                                               | Old → new behavior                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/critical-care/content/learningPathways.ts`                                                                                                            | Sixteen presentation-only lesson titles now name the existing teaching topic: drainage insufficiency, return obstruction, oxygenator resistance, VV recirculation, acute/compensated hypercapnia, sweep-gas interruption, transport power loss, differential hypoxemia and VA ventricular loading. The same pathway supplies headers, outline labels, catalog entries and next links. Descriptions, objectives, order and minutes are retained. |
| `src/features/critical-care/content/activities.ts`                                                                                                                  | VV integrated-case title becomes **VV off-sweep integrated case**. Existing concept associations are pinned for seven lessons and this case because automatic title-keyword inference otherwise changed them. Generated comparison confirms only 17 title fields change across the complete 155-activity catalog; all other fields remain identical.                                                                                            |
| `src/features/cardiohelp-ecmo/components/CardiohelpHub.tsx`, `EcmoPathwayAccordion.tsx`, `practice/EcmoPracticeActivity.tsx`, `stage/adapters/drillStageAdapter.ts` | Map, resume, next-case and paired-case links use the same existing scenario title as the shared catalog and active case header. Capstone links advertise integrated cases. The already-correct picker behavior remains, with its title lookup consolidated. Same IDs, routes, track query values and same-route next-case handler.                                                                                                              |
| `src/features/cardiohelp-ecmo/content/curriculum.ts`                                                                                                                | Both integrated-case unit summaries replace “no prompting” and “Every drill … comes first” with direct access, optional earlier review and explanation on request. No curriculum ordering or dormant compatibility predicate changed.                                                                                                                                                                                                           |
| `src/features/cardiohelp-ecmo/content/scenarios.ts`                                                                                                                 | Only the two capstone titles change from integration challenge to integrated case, matching shared catalog wording. Scenario definitions, summaries, clinical facts and model settings are unchanged.                                                                                                                                                                                                                                           |
| `src/features/cardiohelp-ecmo/content/casePresentation.ts`                                                                                                          | Presentation wording is documented for a local optional variation, not mandatory concealment in navigation. The unused fallback no longer promises debrief-only explanation or compulsory plan commitment.                                                                                                                                                                                                                                      |
| `src/app/[locale]/cardiohelp-ecmo/page.tsx`, `practice/page.tsx`                                                                                                    | Metadata describes self-paced learning with optional predictions/explanations. Removes the dormant published-description independence claim. Noindex and route handling remain.                                                                                                                                                                                                                                                                 |
| Tests listed below                                                                                                                                                  | Replace obsolete title-security assertions and add catalog, accessible-copy and resume checks; retain identity, source, safety and model checks.                                                                                                                                                                                                                                                                                                |
| `docs/cardiohelp-ecmo/redesign/r4-language-record.md`                                                                                                               | Adds a dated decision resolving R4's deferred diagnosis-title question and documenting exact contextual scanner exceptions. Original findings remain above it.                                                                                                                                                                                                                                                                                  |
| `docs/cardiohelp-ecmo/validation/b5-novice-think-aloud-facilitator-guide.md`                                                                                        | Updates the six-row title/rail table to match current UI and supersedes its title-concealment instruction. Explicitly retains “no human session has been run,” identifies the remaining protocol as historical preparation needing separate review, and points to the pre-change Git record. No participant/session evidence changes.                                                                                                           |
| `docs/gap-remediation/self-paced/ECMO-02-handoff.md`                                                                                                                | This handoff.                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### Catalog and release boundary

The shared authored catalog already carried useful diagnosis-based names for all fourteen
Practice cases; those names are preserved. The public critical-care center still exposes the
ECMO module launcher but **omits draft ECMO case/reference records**. This PR does not publish
them. The real shared card renderer is exercised with an explicit test catalog; production
public exclusion is tested separately and observed in Chromium.

Clinical assessment/reassessment is valid language. The scanner exceptions match an exact file,
full passage and single term: drainage assessment, assessment/treatment of the underlying cause,
and an explicit denial of safety certification. Any modified claim, extra grading term or same
text in another file remains a finding. The scanner still extracts accessible labels, alt text,
placeholders and titles. Other modules' findings remain visible; no broad term ban was silently
removed and no other module's clinical copy was edited.

## Test-contract migration

Original tests and preparation material remain in Git at `905372be`. Baseline and intermediate
logs are retained with the final evidence; no skipped/disabled suites or zero-test acceptance.

| Test file                                                         | Old contract → current contract                                                                                                                                                                                                                                                                                                                                                                                                            | Count before → after |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| `cardiohelp-ecmo/__tests__/learn-precommit-leak.test.ts`          | Global titles, header objectives and unit summaries could not name mechanisms; pathway text could not contain digits. Replaces those catalog restrictions with named-topic findability, title/objective/catalog agreement and open integrated-case summaries. Local optional observation/transfer wording checks, registry coverage, transfer setup and minute checks remain. ECMO-01 rendered tests continue to prove direct reveal/skip. | 144 → 98             |
| `cardiohelp-ecmo/__tests__/hub-accordion.test.tsx`                | Case chips had to hide scenario titles → case chips use catalog titles; adds VV/VA saved-link title and legacy-field preservation checks. Canonical section order, counts, open units and resume behavior retained.                                                                                                                                                                                                                        | 10 → 12              |
| `cardiohelp-ecmo/__tests__/drill-stage-pairing.test.ts`           | Paired-case link had to hide diagnosis → same named case as the catalog. All twenty lesson pairings, seventeen available cases, pairing kinds and three no-pairing exclusions retained.                                                                                                                                                                                                                                                    | 21 → 21              |
| `cardiohelp-ecmo/__tests__/b5-vertical-slice-validation.test.tsx` | Guide asserted titles should not be read aloud → documents self-paced naming and historical/no-clinical-approval boundary. Six-row current-title alignment and all other pilot checks retained.                                                                                                                                                                                                                                            | 40 → 40              |
| `critical-care/__tests__/learner-copy.test.ts`                    | Unqualified static term scan flagged three legitimate ECMO passages → exact contextual exceptions with stale/changed-copy negatives and a real AST accessible-label fixture. Other findings continue to fail.                                                                                                                                                                                                                              | 4 → 6                |
| `critical-care/__tests__/ecmo-catalog.test.tsx`                   | New regression coverage: all 46 ECMO activities preserve route/track/non-credit authority; all fourteen clinical case titles and two integrated titles agree with their scenario; shared cards support search and Practice-filter access to legacy Assess links; production drafts remain excluded.                                                                                                                                        | 0 → 3                |

### Question ledger

No question stem, option, response, rationale or source was edited, added or removed in this
catalog batch. The [ECMO-01 question ledger](ECMO-01-question-ledger.md) remains authoritative:

| Scoped teaching surface                                              | Decision                                  | Teaching purpose and delivery                                                                                                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Twenty Learn prediction items and their existing transfer activities | Keep as optional reinforcement            | Existing named mechanism/signal distinctions, with explanation, retry and skip available. Naming the lesson no longer requires hiding its concept.                               |
| Twenty foundation prediction/transfer items                          | Keep as optional reinforcement            | Existing oxygen-delivery, circuit-location, control-response and VV/VA comparisons; unchanged real-action and anatomical/sensor contracts.                                       |
| Fourteen clinical cases and both integrated cases                    | Keep existing optional case reinforcement | Existing patient/circuit interpretation, action/observation and reassessment reasoning. Questions may be bypassed; opening an explanation does not claim a prediction or action. |
| Catalog/outline/next/resume surfaces                                 | No new question                           | Navigation identifies the useful teaching topic. No quiz was added to protect a title, earn access or prove reading.                                                             |

## Executed evidence

Evidence folder:
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/ecmo-02-self-paced-2026-09-15/`.
Logs, JSON reports, screenshots and the browser harness are local derived evidence, not runtime
inputs or committed artifacts. No token/environment file is included.

| Command/check                                                                                                                                                                                                                     | Actual result                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline `npx --no-install jest src/features/critical-care src/features/cardiohelp-ecmo --runInBand --json --outputFile=/tmp/ecmo-02-evidence/baseline.json`                                                                      | 95 suites: 92 passed, 3 failed. 2,398 tests: 2,395 passed, 3 failed. Every ECMO test passed before edits.                                                                                                                                                                                    |
| Final `npx --no-install jest src/features/cardiohelp-ecmo src/features/critical-care src/features/learning-module 'src/app/\[locale\]/cardiohelp-ecmo' --runInBand --json --outputFile=/tmp/ecmo-02-evidence/verified-tests.json` | 112 suites: 109 passed, 3 baseline failures. 2,555 tests: 2,552 passed, 3 failed, none skipped. ECMO module: **70 suites / 2,125 tests passed**; ECMO routes: **1 / 62 passed**; learning-module: **15 / 134 passed**; shared critical care: **26 / 234, 231 passed and the same 3 failed**. |
| `npx --no-install tsc --noEmit`                                                                                                                                                                                                   | Passed after fixing a test-helper callback signature error. Final log: `typecheck-final.log`.                                                                                                                                                                                                |
| ESLint `--max-warnings=0` on every changed TS/TSX file, then scanner recheck                                                                                                                                                      | Passed, no warnings. `lint.log`, `lint-scanner-final.log`.                                                                                                                                                                                                                                   |
| Prettier on changed paths; `git diff --check`                                                                                                                                                                                     | Passed.                                                                                                                                                                                                                                                                                      |
| Generated catalog comparison via existing `tsx`                                                                                                                                                                                   | 155 before/after activities, all 109 unrelated activities identical; 46 ECMO activities preserve all non-title fields. Exactly 17 ECMO title fields differ. `catalog-comparison.json`.                                                                                                       |
| Chromium, isolated local Next dev server on port 3117, ephemeral localhost auth and dummy preview configuration                                                                                                                   | PASS: eight recorded journey/compatibility checks, no page exceptions. `browser-final.json` and screenshots; details below. No production account/backend operation.                                                                                                                         |

The final shared failures reproduce the baseline:

1. `accessibility.test.tsx`: CRRT pressure-lab image accessible-name expectation differs from the
   merged rendering. Its accessibility checks were not weakened.
2. `curriculum-sequencing.test.tsx`: expected CRRT practice order omits its already-converted
   troubleshooting challenge entry.
3. `learner-copy.test.ts`: the existing all-module scan still reports MV/MCS/CRRT passages.
   Its three ECMO false positives are now explicitly resolved; the separate ECMO scan passes.

Intermediate evidence also records the outdated facilitator-table title failures (fixed in the
current guide) and an added AST helper's array-callback signature error (fixed and rechecked).
These are not concealed as baseline failures.

### Browser matrix

The harness uses real clicks and keyboard input through the existing routes. Screenshot checks
cover 1440×1000 and 390×844:

- Fresh VV overview → open outline → named drainage lesson → explanation before a prediction.
  The reveal explicitly says it performs no simulator action.
- Open the named hemorrhage case → direct explanation with no prediction/action recorded →
  follow the named next-case link → actual tension-pneumothorax case → reload → named resume link.
- Keyboard ArrowRight switches the track; the named differential-hypoxemia link opens VA.
- Both `/assess?track=vv` and `/assess?track=va` retain their URLs and open named integrated cases;
  explanation, Try again, Start guided activity and Hint are available without answering.
- Compact outline labels wrap, links remain usable and the VA explanation is reachable; no
  horizontal page overflow in either viewport.
- Local history checks confirmed that preseeded legacy fields and normalized JSON were unchanged;
  only self-paced visits/location were added. The debrief recorded no prediction or action.

Early harness runs corrected a nonexistent `main` landmark assumption, exact-label assumptions
for explanation/visited text and the shared launcher, and the localhost versus 127.0.0.1 origin mismatch introduced by
local-auth redirect. These were harness failures, not application changes. Screenshots opened
and inspected include the named outline, Learn explanation, Practice no-action debrief and the
compact VA outline/debrief. No human usability or clinician review is claimed.

## Preservation, holds and checks not run

New sessions retain the existing minimal `selfPaced` location/visited-topic writer. Historical
module values and normalized account records remain read-only to the current flow; no grading
writer, migration, assistance history or shared progress service is added. All ECMO source,
review and clinical/device/model holds documented in ECMO-01 remain. Naming a mechanism and
passing tests do not establish clinical approval. The B5 human pilot has still not been run.

Not run: production build/export, whole-repository suite, exhaustive all-case browser matrix,
Safari/Firefox, screen reader, real account synchronization, clinical/source revalidation or
human learner sessions. No deployment, publication, data migration or shared Supabase/upload
operation was performed.

| Structured-module rule | Result within this repair                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| H1                     | PASS under v2: same open curriculum, route/track identities and resolver.                                                         |
| H2                     | NOT APPLICABLE to new teaching: clinical lessons, objectives and question content retained.                                       |
| H3                     | NOT APPLICABLE to layout migration: existing ECMO surfaces reused; no new stage.                                                  |
| H4                     | PASS for preservation: current task/actions remain in the existing host.                                                          |
| H5                     | PASS: named content is rendered; explanations open directly in browser and retained self-paced tests.                             |
| H6                     | PASS under v2: navigation/reveal does not claim a real prediction, action or competence.                                          |
| H7                     | PASS under v2: retained optional/wrong-answer/retry/skip and safety tests; title concealment superseded.                          |
| H8                     | PASS for unchanged engine/source/asset scope and ECMO regression suite; clinical review remains pending.                          |
| H9                     | PASS for route/resume compatibility and legacy-data tests; no persistence implementation changed.                                 |
| H10                    | PASS: useful named topics and documented clinical-language exceptions; no clinical terminology removed to satisfy a blanket scan. |
| H11                    | PASS: bounded ECMO/shared-catalog assignment; Device Intelligence and release state untouched.                                    |
| H12                    | PASS for the executed browser/unit matrix only; excluded checks above remain unrun.                                               |

## Stop boundary and next slice

Deliver this single ECMO-02 PR and handoff. Do not merge or deploy it and do not start ECMO-03,
source/model remediation, another module's scanner cleanup or Device Intelligence work. Any
next ECMO slice requires its own assignment and retains the existing clinical/source holds.
