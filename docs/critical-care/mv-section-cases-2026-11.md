# Mechanical ventilation: the case is the last task of its section

November 2026. The ICU hemodynamics pattern (#402) and its mechanical circulatory support
counterpart (`mcs-section-cases-2026-10.md`, #487), carried to the mechanical ventilation Learn
sections. Before this, a section ended on "Section finished · A case on this mechanism:" and a link
to `/mechanical-ventilation/practice?case=<id>`; the case ran on its own page, and there was no way
back to the section.

## Which section ends on which case

A section ends on its `practicePairing` of kind `mechanism-match` (`content/sectionSpecs.ts`). Nine
sections do, each on a different case. Practice names the same section on the case ("builds on
Section N").

| #   | Section                               | Last task                                                         |
| --- | ------------------------------------- | ----------------------------------------------------------------- |
| 1   | breathing-with-support                | none (pairing is "next in this part of the pathway")              |
| 2   | waveform-anatomy                      | none (same)                                                       |
| 3   | controls-and-goals                    | none (same)                                                       |
| 4   | mechanics-load-and-pressure           | MV-13 High airway pressure: secretions, obstruction, bronchospasm |
| 5   | modes-and-breath-delivery             | none ("next in this part of the pathway")                         |
| 6   | lung-protection                       | none: pairs MV-01, which Section 9 ends on                        |
| 7   | expiration-and-air-trapping           | MV-05 COPD: dynamic hyperinflation with ineffective efforts       |
| 8   | triggering-and-cycling                | MV-07 Neuromuscular weakness with trigger delay                   |
| 9   | oxygenation-response                  | MV-01 ARDS hypoxemia: recruitment versus overdistension           |
| 10  | ventilation-and-co2                   | MV-06 Severe asthma: auto-PEEP with obstructive shock             |
| 11  | waveform-reading-sequence             | MV-08 Autotriggering from condensate or circuit leak              |
| 12  | dyssynchrony-mechanisms               | MV-11 Rise-time mismatch: too slow, then too fast                 |
| 13  | safety-reassessment-and-human-factors | MV-15 Air hunger, anxiety, pain and delirium                      |
| 14  | high-peak-pressure-integration        | MV-14 Sudden loss of compliance: tension pneumothorax             |

### Three pairings ruled by the owner, 2026-11-12

Seven pairings are the module's own, as they were. The first build ran a case in the first section
that paired it, which left Sections 9, 10 and 14 without one (each paired the case an earlier
section already ends on). Proposed to the owner and approved ("Yes, all three"):

- **Section 10 → MV-06** (was MV-05, which Section 7 ends on). Section 10 already listed MV-06, and
  `content/caseTransfer.ts` already names MV-06 as the case that follows MV-05. The section teaches
  that a higher rate can worsen trapping in obstruction; the case's main error is raising the rate
  to correct the CO₂.
- **Section 14 → MV-14** (was MV-13, which Section 4 ends on). Section 14 already listed MV-14, and
  `caseTransfer.ts` names it as the case that follows MV-13: the same alarm with peak and plateau
  rising together.
- **MV-01 is run in Section 9, not Section 6** (`VENTILATION_CASE_HOME` in
  `content/sectionCases.ts`). Both sections still pair it. Three of the case's four objectives are
  FiO₂ and PEEP against plateau, compliance and blood pressure, which Section 9 teaches, and
  Section 9 has Section 6 as a prerequisite. Section 6 keeps its line and link to the case and says
  where it is run.

Known when ruled, and left as it is:

- **MV-06 asks for disconnection before Learn teaches it.** The case requires disconnecting the
  patient to let the chest empty. Learn first teaches that in Section 13 (and asks it in Section
  14's transfer question). At Section 10 the learner has trapped gas and "consider circulation"
  from Section 7, and the case's third hint.
- **A case shows its authored title when it opens**, in Practice and in a section. MV-14's title
  names the diagnosis, in the section whose premise is that the cause is not supplied. The task
  list does not show it.

Follows from the pairings, in Practice: "builds on" now reads Section 9 for MV-01 (was 6), Section
10 for MV-06 (was 7, the first section that listed it) and Section 14 for MV-14 (was 4, likewise).
On the Learn page, the case chips of Sections 10 and 14 are MV-06 and MV-14, and only MV-01 is
still listed a second time.

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
- **The finished card clears the pinned bar.** Leaving or skipping the case scrolls "Section
  finished" clear of the pinned Continue bar (`revealSectionFinished`). Without it, at 1440 × 800
  a long last task left the card behind the bar: after skipping, the card was 29% to 95% clear
  across the nine sections and never whole, and in Section 9 "Open the case" was fully covered.
  The first build's "on screen" figure compared the card with the window and did not count what
  the bar covers.
- **The record.** Opening the case records it as visited, as Practice does. The learner's place
  stays the section, so Resume reopens the section.
- **Section 6.** Its finished card keeps its line and link to the case, and adds where the case
  is run ("It is also the last task of Section 9 · …").
- **Practice.** Unchanged: every case is listed and `/practice?case=` opens it on its own page.

## Not changed

- **Minutes.** A section's minutes are a reading estimate ("about 102 min of reading") and the
  app shows none for a case (the casebook's own run times are 6 to 12 min), so no section's minutes
  include its case. Hemodynamics and MCS count
  ten minutes a case.
- **The Learn page.** Its case chips still open the case in Practice.
- **The case's own screen.** It is the Practice card as it was: its console is not the section's
  console with the rail.
