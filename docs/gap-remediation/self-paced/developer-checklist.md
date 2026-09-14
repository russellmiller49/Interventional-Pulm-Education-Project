# Self-paced conversion — reusable developer checklist

This is a technical verification aid, **not a required learner sequence**. Apply it to the scoped module's actual routes and state machine. Record PASS / FAIL / BLOCKED / NOT RUN / NOT APPLICABLE with evidence and a reason. A baseline failure can be the reason for conversion; it cannot be relabeled as a passing self-paced check.

## Preparation and inventory

- [ ] Record checkout, branch, clean/dirty status, HEAD and comparison with the historical baseline. Preserve unrelated changes and follow `AGENTS.md`.
- [ ] Enumerate Overview, Learn, Practice, old Assess/Challenge/capstone links, route parameters, results, outline, catalog/hub recommendations, current/legacy storage readers and writers, account sync and lifecycle events. Include query aliases and invalid/stale IDs.
- [ ] Trace each blocking predicate through host → reducer/adapter → side effects. Classify educational, simulation/data or mixed. Identify every protective control that currently checks a response.
- [ ] Choose a bounded question batch and record actual text, teaching purpose, feedback, friction and keep/rewrite/replace/combine/remove. Preserve useful teaching from removed questions; do not require answer-position statistics.

## Browser paths through real handlers

Use an isolated disposable browser context, fresh state and authorized local auth. Do not operate on the user's saved records. Use real clicks/keyboard events; seeding a completed session is not a progression test. Clearly distinguish synthetic legacy fixtures from genuine user journeys.

| Path                           | Required self-paced result                                                                          | Evidence to record                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Fresh entry                    | Recommended next activity and visible meaningful outline; no pretest requirement                    | Final URL, screenshot, headings and actual Start link              |
| No answer                      | Open explanation or continue without selecting a response                                           | UI action and before/after answer/action/capture state             |
| Hint / Help                    | Useful support without penalties or assistance-history writes                                       | Rendered content plus storage/network diff                         |
| Show explanation first         | Explanation opens before submission; no automatic answer or success                                 | Actual reveal click; answer remains absent                         |
| Wrong answer                   | Specific feedback; useful safety explanation when appropriate; retry or continue without punishment | Chosen response, feedback and next action                          |
| Repeat / reset / Back          | Repeat safely; reset scope matches label; reviewing does not replay interventions                   | Before/after operation and historical-record checks                |
| Skip / Continue                | Move on while preserving absent answers, acquisitions and completed-operation evidence as absent    | Handler/reducer integration assertion; visited state may change    |
| Jump to another topic          | Topic selection independent of quiz score or cumulative correct count                               | Outline/link click and final heading                               |
| Legacy Assess / Challenge link | Opens optional case/example or an explicit compatible redirect                                      | Final URL for each supported query form                            |
| Reload / return                | Resume behavior matches declared state; prior history is unchanged; no fabricated restoration       | Byte-level legacy fixture comparison and real fresh-session reload |
| Storage denied/corrupt/stale   | Learning remains available; honest persistence limitation; no destructive repair                    | Error/fallback UI, no silent overwrite                             |
| Keyboard / narrow / zoom       | Help, reveal, retry, outline and leave are reachable; essential content fits                        | Focus sequence, screenshot, overflow/reflow and launch fallback    |

## No grading writes or learner-grade surfaces

- [ ] Diff all existing local/session storage keys before and after mount, answer, wrong answer, hint, reveal, continue, repeat, reload and return. Include hydration migrations and unload/effect writers, not only Submit.
- [ ] Verify no new graded attempts, correctness totals, score/mastery outcomes, first-attempt or assistance analytics, penalty/hint history, or grading-service calls. Allow only the documented minimal navigation/review state and transient feedback responses.
- [ ] Keep legacy score/attempt records byte-for-byte unchanged, including unknown fields and old versions. Preserve authentic historical observations without converting them to current reviewed topics or competence.
- [ ] Inspect visible and accessible text, result tables, badges, home cards and recommendation logic. Spelling out “seven decisions held” still constitutes a learner grade.
- [ ] If dormant compatibility scoring remains, prove it cannot affect current access, recommendations, outcomes or claims. Otherwise remove it from the current execution path.
- [ ] Network observation uses local/disposable data; no production grading, account mutation, consent change or upload is necessary for this check.

## Real simulation evidence and protected controls

- [ ] No-answer/reveal/skip never dispatches a manufactured prediction, control command, frame hold, run, acquisition, capture, measurement or success.
- [ ] Actual operations still enforce supported controls, valid setup, data/frame identity, physical/model interlocks and measurement validity. Use negative tests at the reducer boundary.
- [ ] Protective controls work before a quiz answer while preserving their genuine device predicates. If leaving an active simulated operation requires ending/resetting it, make that explicit without claiming successful completion.
- [ ] Label supplied examples and synthetic/model data; distinguish them from actual learner observations. Inspect fallback/missing media paths.
- [ ] Keep numerical physiology/device/measurement content and current safety explanations. Clinical changes remain pending real review; no green suite implies approval.
- [ ] For causal changes, compare matched branch/device/patient/clock states with wait-only, no-op, unrelated-control and actual causal-control experiments. Record control validity and real measurement versus analytic/estimated output.

## Delivery

- [ ] Record each old/new test contract; run explicit targeted suites with actual test counts. Preserve earlier failures and label every unrun check.
- [ ] If shared runtime files change, justify the narrow need, serialize one integrator, enumerate affected consumers and verify excluded-module behavior unchanged. Device Intelligence itself remains outside the audit/conversion.
- [ ] No new course framework, dependency, backend, graded telemetry, release status, publication, deployment or remote data change.
- [ ] Handoff includes changed files, demonstrated behavior, exact test commands/results, source/clinical/media holds, legacy implications, question ledger and next bounded slice. Stage reviewed paths only and open one PR under repository rules.
