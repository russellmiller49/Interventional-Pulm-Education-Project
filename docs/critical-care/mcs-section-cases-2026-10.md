# Mechanical circulatory support: the case is the last task of its section

October 2026. The ICU hemodynamics pattern of 2026-10-14 (#402; record
`mv-hemodynamics-ecmo-format-2026-10.md`, "Hemodynamics: the case is the last task of its
section"), carried to the mechanical circulatory support (MCS) Learn sections. Before this, each
section's last task ended with "Take it to a patient case", which pushed to
`/mechanical-circulatory-support/practice?case=<id>`; the case ran on its own page, and there was
no way back to the section. It follows the MCS workspace work (`mcs-workspace-format-2026-10.md`,
#415), which had left this out because it was an owner decision for hemodynamics.

## Owner decisions (Russell, 2026-10-17)

1. One case per section, the existing pairings; the two foundations sections have none.
2. Section 8's case, LVAD-03 (power interruption), applies a different mechanism from the section's
   thrombosis-versus-loading concept. It is embedded like the others, and its strip says what it
   applies instead.
3. Practice keeps listing every case; `/practice?case=` still opens any case on its own page.

| #   | Section                          | Last task                                                           |
| --- | -------------------------------- | ------------------------------------------------------------------- |
| 1   | mcs-foundations-signals          | none                                                                |
| 2   | mcs-foundations-mechanisms       | none                                                                |
| 3   | iabp-timing-triggering           | IABP-01 The balloon that stays inflated too long                    |
| 4   | iabp-efficacy-limits             | IABP-03 Correct timing, inadequate circulation                      |
| 5   | impella-unloading-placement      | IMP-02 Malposition with blood-trauma risk                           |
| 6   | impella-suction-purge-rv         | IMP-01 High support, underfilled LV                                 |
| 7   | lvad-parameters-assessment       | LVAD-01 Low flow with severe hypertension                           |
| 8   | lvad-alarms-emergencies          | LVAD-03 Controller alarm after power interruption (other mechanism) |
| 9   | mcs-device-selection-integration | LVAD-02 Low flow with a failing right ventricle                     |

IABP-02 (irregular rhythm, trigger) and IMP-03 (afterload and purge) are not placed in a section;
they stay in Practice and keep their chips on the pathway map.

## What changed

- **The case step.** `buildMcsStageLesson` appends a `case` interaction after the transfer (phase
  `transfer`, id `<section>-case`, presentation `section-case`); step ids before it do not move.
  Its title in "Tasks in this section" is "Apply it in a patient case": several case titles name
  the section's first answer (section 5's "Malposition…", section 9's "failing right ventricle"),
  so the case is named only on its own task card ("Apply it: <case>"). The transfer's Continue
  now reads "Continue to the case".
- **The embedded case.** `McsCaseWorkflow` takes `embedded` (`McsCaseEmbedding`): a one-line strip
  ("Case · <title> · the last task of Section N", plus ", on <what it applies instead>" for
  LVAD-03) replaces the kicker and title; Exit case sits beside Reset; at the end of the case,
  under the worked explanation, "Back to Section N: <title>". `McsSectionCase` runs it on its own
  reducer, in the task card, with no module frame, device tabs, case rail or patient context bar.
- **One engine at a time.** On the case step the section's clock does not tick and its simulator
  pane is not mounted; the case has its own clock in the same `McsClockBar`, at the head of the
  case (the bar's console line is now `mcsClockContext`, shared by both). The task takes the full
  width (`data-single-column="case"`); in the desktop workspace the task body is one scrolling
  pane and the page stays locked. While the case runs, Back and the task list are disabled.
- **The return.** Exit case, the end of the case and "Skip the case · finish the section" all
  close it and finish the section: focus moves to the completion card ("Section finished", and
  whether the case was run or skipped), the recap follows, and the card's pinned way on is
  "Continue to the next section" with "Run the case again" beside it. A double-click on "Continue
  to the case" does not also start the case.
- **The record.** Opening the case records it as visited, as Practice does; the location stays the
  section, so Resume reopens the section, not Practice.
- **Minutes.** Every practice case carries `minutes` (10), and a section's minutes are its
  teaching plus its case. As landed in November 2026, after the text cut (#483): sections 1 and 2
  are 10 and 11 min, sections 3 to 5 are 21, sections 6 to 8 are 20, section 9 is 27; the pathway
  reads 171 min (101 of teaching and seven 10-minute cases). The critical-care activity catalog's
  estimates match, and the beta hub card says the same. The section spec validator refuses a
  section no longer than its case, a case on another mechanism that does not say what it applies,
  and a case placed in two sections.
- **The pathway map.** A section chip names its case as its last task ("Last task · Case: …"); the
  unit's unplaced cases keep their chips to Practice.
- **The case card in the dark stage.** The case card is the Practice card. Practice moved to the
  dark theme in November 2026 (#478), so the card is dark here too: the module's dark block names
  `[data-section-case]` as its fourth selector, and the card's own additions (the strip, the
  end-of-case return) use the stage's palette.

## Landed November 2026

The October commit was never pushed. It was carried onto `main` on 2026-11-10 (branch
`claude/mcs-section-cases`), after the lesson-screen, lead-visual, dark-theme and text-cut work
(#465, #476, #478, #483). What differs from the October description above:

- **Lead visual.** Every step names the picture it opens on; the case step's is `case` (its own
  monitor and console in the task card, no simulator pane).
- **The recap.** It is on the section's last task, so on the case in sections 3 to 9, and it
  stays folded under its heading until the closing answer is committed or the case is closed.
- **Section 8's two pulseless patients** (`McsLvadPerfusionCase`, #441 and #443) stay with the
  closing question, the task before the case, so one screen never offers two cases.
- **Minutes and theme**, as described above.

Checked on 2026-11-10: Jest for MCS, critical care, the beta hub and the shared lesson frame, 1,855
of 1,856 tests (the one failure, `ModuleFrameV2.consumers`, fails on `main` too); `tsc`, ESLint and
Prettier clean; the four current MCS specs against a local dev server, 26 of 26, including
`e2e/mcs-section-case.spec.ts`. In the browser at 1600 × 852, all seven cases were started from
their section, run to the worked explanation and closed back to "Section finished", with no light
surface left on the card; all 75 tasks were walked; at 390 × 844 the case does not scroll sideways.

## Verification

- Jest `src/features/mechanical-circulatory-support`: 52 suites, 1,086 tests, including the new
  `stage-section-case.test.tsx` (21 tests: which sections end on which case, minutes, one engine
  by timer count, the strip, no Practice chrome, the end-of-case return and focus, Exit case, Skip,
  Run again, the double-click, the visit record and Resume, Practice unchanged). With
  `src/features/critical-care`, `src/features/learning-module` and the MCS routes: 99 suites,
  1,567 tests. Seven existing MCS suites were updated where they assumed the transfer was the last
  task. `tsc` has no MCS errors; ESLint and Prettier clean.
- e2e against a local dev server with `MCS_E2E_BASE_URL` set (the specs default to ports nothing
  serves): the eight MCS specs, 98 of 98, including the new `e2e/mcs-section-case.spec.ts` (4
  tests). Two tests in `mcs-pre-review-04.spec.ts` were updated: Section 9 now has seven tasks, and
  the recap is on the case task. One run had a navigation aborted by a hot reload, and a 390 px
  skip walk timed out while Jest ran beside it; both pass on a clean re-run.
- In the browser at 1440 × 900 and 390 × 844: the case fills the task width, its clock stays at
  the top of the pane, nothing scrolls sideways, and the return lands on the completion card.

## Not in this work

- The hub (`McsHub`) is being reworked in a separate session; it is unchanged here.
- The embedded case keeps the Practice case's own type sizes, which are smaller than the
  section's text.
- The optional three-dimensional view of the Practice page is not offered inside the section.
