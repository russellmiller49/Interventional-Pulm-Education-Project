# Mechanical ventilation: the case is the last task of its section

November 2026. The ICU hemodynamics pattern (#402) and its mechanical circulatory support
counterpart (`mcs-section-cases-2026-10.md`, #487), carried to the mechanical ventilation Learn
sections. Before this, a section ended on "Section finished · A case on this mechanism:" and a link
to `/mechanical-ventilation/practice?case=<id>`; the case ran on its own page, and there was no way
back to the section.

## Which section ends on which case

The pairings are the module's own and are not changed: a section's `practicePairing` of kind
`mechanism-match` (`content/sectionSpecs.ts`). Three cases are paired by two sections each. A case
is run once, in the first section that pairs it. That is the section Practice already names on
the case ("builds on Section N").

| #   | Section                               | Last task                                                         |
| --- | ------------------------------------- | ----------------------------------------------------------------- |
| 1   | breathing-with-support                | none (pairing is "next in this part of the pathway")              |
| 2   | waveform-anatomy                      | none (same)                                                       |
| 3   | controls-and-goals                    | none (same)                                                       |
| 4   | mechanics-load-and-pressure           | MV-13 High airway pressure: secretions, obstruction, bronchospasm |
| 5   | modes-and-breath-delivery             | none ("next in this part of the pathway")                         |
| 6   | lung-protection                       | MV-01 ARDS hypoxemia: recruitment versus overdistension           |
| 7   | expiration-and-air-trapping           | MV-05 COPD: dynamic hyperinflation with ineffective efforts       |
| 8   | triggering-and-cycling                | MV-07 Neuromuscular weakness with trigger delay                   |
| 9   | oxygenation-response                  | none: pairs MV-01, which Section 6 ends on                        |
| 10  | ventilation-and-co2                   | none: pairs MV-05, which Section 7 ends on                        |
| 11  | waveform-reading-sequence             | MV-08 Autotriggering from condensate or circuit leak              |
| 12  | dyssynchrony-mechanisms               | MV-11 Rise-time mismatch: too slow, then too fast                 |
| 13  | safety-reassessment-and-human-factors | MV-15 Air hunger, anxiety, pain and delirium                      |
| 14  | high-peak-pressure-integration        | none: pairs MV-13, which Section 4 ends on                        |

Open for the owner: Sections 9, 10 and 14 have no case of their own. Their units list other cases
(Section 10 lists MV-06, Section 14 lists MV-14 and MV-06; Section 9 lists only MV-01). Whether
MV-01 belongs at the end of Section 9 rather than Section 6 is the same question.

## What changed

- **The task.** `ventilationSectionCase(unitId)` (`content/sectionCases.ts`) names the case a
  section ends on. The lesson's steps are unchanged: the case has no round, no console pane of the
  section's and nothing to capture, so it is not a step. `VentilationStageHost` lists it as the
  last row of "Tasks in this section" and counts it ("Task 7 of 8").
- **Its name in the list.** "Apply it in a patient case". Every row of the list is visible from
  task 1, and case titles name the finding ("COPD: dynamic hyperinflation…" in the section whose
  first question leads to it). The title is shown on the case itself.
- **Going on to it.** The section's own last task now reads "Continue to the case", with "Skip the
  case" beside it. Nothing gates: the case row opens it from any task.
- **The case, inside the section.** `VentilationCaseWorkspace` is the Practice case with its module
  frame taken off: the same reducer, brief, console, actions, coaching and worked explanation.
  Opened from a section (`embedded`) it has a strip ("Case · the last task of Section 7 · …"), its
  title as an `h2` under the section's `h1`, and "Leave the case" and "Finish the case · back to
  Section 7" where Practice has its links to other cases.
- **One patient at a time.** Opening the case pauses the section's patient and takes the section's
  two panes off the page; the case is one column in their place, with its own clock.
- **The return.** Leaving the case lands on the section's last task, now finished: "Section
  finished", the case named, "Run the case again", and "Continue to Section N+1" as the way on.
  Skipping gives the same card with "Open the case".
- **The record.** Opening the case records it as visited, as Practice does. The learner's place
  stays the section, so Resume reopens the section.
- **Sections 9, 10 and 14.** Their finished card keeps its line and link to the case, and adds
  where the case is run ("It is also the last task of Section 7 · …").
- **Practice.** Unchanged: every case is listed and `/practice?case=` opens it on its own page.

## Not changed

- **Minutes.** A section's minutes are a reading estimate ("about 102 min of reading") and the
  cases carry no estimate, so no section's minutes include its case. Hemodynamics and MCS count
  ten minutes a case.
- **The Learn page.** Its case chips still open the case in Practice.
- **The case's own screen.** It is the Practice card as it was: its console is not the section's
  console with the rail.
