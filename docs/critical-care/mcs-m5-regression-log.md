# MCS M5 deliberate-regression log

Fourteen defects, introduced one at a time into the working tree, each run against the smallest test
that should catch it, each reverted with `git checkout -- <file>` before the next. None of them is on
the branch.

A test that passes is not evidence that it can fail. This is the evidence.

| #   | Temporary defect                                                                                               | Test command                                                                                                                 | Failing assertion                                                                                                                               | Restored |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | `initialLesson` ignores `requestedLesson` and always opens the first section                                   | `npx jest …/m5-workbench-routing.test.tsx -t "opens the exact section for the"`                                              | `expect(received).toBe(expected)` on the rail's `aria-current` section — 8 of the 9 table rows failed, the ninth being the first section itself | yes      |
| 2   | `selectActivityPhase` drops the furthest-phase comparison and honours any requested phase                      | `npx jest …/m5-learn-integration.test.tsx -t "refuses a shared-stepper jump past the furthest phase"`                        | `expect(learnPhase()).toBe('recognize')` — the jump to Transfer succeeded                                                                       | yes      |
| 3   | `sequenceWorkedThrough` drops everything after the prediction                                                  | `npx jest …/m5-learn-integration.test.tsx -t "records mcs-foundations-signals only at the transfer endpoint"`                | `expect(storedLessonIds()).toEqual([])` after the prediction commit — the section was already recorded                                          | yes      |
| 4   | the workbench rewrites the progress record on every render, and therefore every tick                           | `npx jest …/m5-learn-integration.test.tsx -t "writes the completion once and does not rewrite it on every simulation tick"`  | `expect(progressWriteCount()).toBe(1)`                                                                                                          | yes      |
| 5   | the `recordedCompletion` key guard is removed, so a state change after completion writes the same result again | `npx jest …/m5-persistence-analytics.test.tsx -t "persists the case result once"`                                            | `expect(progressWriteCount()).toBe(writes)` → `Expected: 1, Received: 2`                                                                        | yes      |
| 6   | `McsCaseWorkflow` always renders the simulation response, ignoring the Challenge rule                          | `npx jest …/m5-practice-challenge.test.tsx -t "opens CAP-IABP-01 regardless of local completion history"`                    | `expect(screen.getByText('Routine teaching deferred'))` — the deferred block was gone and the explanation was showing                           | yes      |
| 7   | `McsControls`' `unavailable()` always returns false                                                            | `npx jest …/m5-controls-and-surfaces.test.tsx -t "closes every patient slider on a case that permits no patient adjustment"` | `expect(element).toBeDisabled()` on the first patient slider                                                                                    | yes      |
| 8   | `selectDevice` no longer clears `showChallengeFeedback` for a new capstone                                     | `npx jest …/m5-practice-challenge.test.tsx -t "drops the previous opt-in when the learner switches capstone"`                | `expect(element).not.toBeChecked()`                                                                                                             | yes      |
| 9   | `saveAndExit` routes without calling `writeMcsProgress`                                                        | `npx jest …/m5-persistence-analytics.test.tsx -t "writes the current record and routes to the module front door"`            | `expect(progressWriteCount()).toBe(1)`                                                                                                          | yes      |
| 10  | the aggregate analytics payload gains `pcwpMmHg`                                                               | `npx jest …/m5-persistence-analytics.test.tsx -t "sends only the device track, the station, and a coarse completion state"`  | `expect(event.eventPayload).toEqual({deviceTrack, station, completion})`                                                                        | yes      |
| 11  | the simulation-interval effect returns no cleanup                                                              | `npx jest …/m5-persistence-analytics.test.tsx -t "clears the interval it installed on unmount"`                              | `expect(everyInstalledIntervalCleared()).toBe(true)`                                                                                            | yes      |
| 12  | the context bar restores a `Shock phenotype` item reading `LV-dominant shock`                                  | `npx jest …/m5-context-bar-consistency.test.tsx -t "offers no item that names a shock phenotype"`                            | `expect(patientContextLabels()).not.toContain('Shock phenotype')`                                                                               | yes      |
| 13  | the flow item prints `state.metrics.deviceFlowLMin.toFixed(1)` instead of the flow account's own text          | `npx jest …/m5-context-bar-consistency.test.tsx -t "reports no direct device flow on counterpulsation"`                      | `expect(value).toMatch(/none reported/i)` — the bar read `device 0.0 L/min`                                                                     | yes      |
| 14  | the balance item is labelled `Perfusion` again                                                                 | `npx jest …/m5-context-bar-consistency.test.tsx -t "labels the venous saturation and cardiac power"`                         | `expect(patientContextLabels()).not.toContain('Perfusion')`                                                                                     | yes      |

## A fifteenth, after review

The monitor's own `DEVICE FLOW` tile was the last surface still printing the arithmetic zero as a
reading. Corrected test-first like the others, and regressed the same way.

| #   | Temporary defect                                                              | Test command                                                                                                              | Failing assertion                                                                                                                 | Restored |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 15  | the tile renders `metric(metrics.deviceFlowLMin, 1)` and a bare `L/min` again | `npx jest …/m5-context-bar-consistency.test.tsx -t "reports no direct pump-flow channel on the counterpulsation monitor"` | `Expected substring: "NONE REPORTED"` · `Received string: "NATIVE FLOW4.5L/min \| DEVICE FLOW0.0L/min \| EFFECTIVE FLOW4.5L/min"` | yes      |

One process note worth keeping. The first attempt at this regression paired a `python … assert` with
a `git checkout --` in the same command line. The assertion failed on a stale anchor, the checkout
ran anyway, and it reverted the correction rather than the defect. The defect was re-applied from a
copy taken beforehand, and the restore was verified by grep before the test ran. A restore step that
runs whether or not the defect was applied is not a restore step.

## What the sweep changed about the tests

Two of the fourteen did not fail on the first attempt, and both are recorded because the fix was to
the test, not to the claim.

**#4 first exposed a defect that could not terminate.** The original formulation removed the
idempotence guard from `recordSectionWorkedThrough` _and_ the `!sectionComplete` guard in
`McsLearnSection`, which put `setProgress` in a render loop rather than producing a repeated write.
A defect that hangs proves nothing about the assertion, so it was reformulated as the write itself
repeating — the same payload, every tick — which is the behaviour the test claims to prevent.

**#5 did not fail at all.** The test advanced the simulation after completion and asserted the write
count had not moved, and it had not — but not because the guard held. The persistence effect
schedules a zero-delay timer and clears it on the next run, so fifty ticks inside one
`advanceTimersByTime` cancel each other and the write never lands either way. The test was measuring
a coincidence. It now performs an action a learner can actually take after the debrief opens —
reassessing, which produces a new state with the same scenario, score and error count — and then
lets the timer fire. With the guard the count holds at 1; without it, 2.

Both are the point of the exercise: a test that cannot fail is not protecting anything.

## Restoration

`git status --short` was clean of component changes after the sweep, and the full MCS suite passes
on the restored tree. The one interruption — an earlier run of the sweep killed mid-defect — left
`McsLearnSection.tsx` and `McsWorkbench.tsx` modified; both were restored with
`git checkout -- <file>` and re-verified before work continued.
