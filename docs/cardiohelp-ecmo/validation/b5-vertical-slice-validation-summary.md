# B5 vertical-slice validation summary

**Human novice validation is still pending.** Everything below is automated checking, expert review,
and rendered-browser preflight. No learner has used this slice. No completion rate, participant
count, or observation in this document comes from a person — there are none.
Human findings, when they exist, go in
[`b5-novice-findings-template.md`](./b5-novice-findings-template.md), which is currently empty.

Plan: [`b5-vertical-slice-validation-matrix.md`](./b5-vertical-slice-validation-matrix.md).

---

## 1. What was reviewed

**Scenarios — all six pilot drills**, each confirmed rendering its own panel keyed to the scenario
the _engine_ holds:

| Scenario                     | Panel rendered | Bad tokens (`undefined` / `NaN` / `[object Object]`) |
| ---------------------------- | -------------- | ---------------------------------------------------- |
| `startup-sensor-orientation` | ✅             | none                                                 |
| `preload-drainage-collapse`  | ✅             | none                                                 |
| `vv-recirculation`           | ✅             | none                                                 |
| `gas-source-interruption`    | ✅             | none                                                 |
| `arterial-bubble-stop`       | ✅             | none                                                 |
| `va-differential-hypoxemia`  | ✅             | none                                                 |

**Viewports — all four**, in a real rendered browser against the running dev server:

| Viewport   | Frame   | Arrangement         | Matches intent |
| ---------- | ------- | ------------------- | -------------- |
| 1600 × 900 | 1576 px | wide, three panes   | ✅             |
| 1440 × 900 | 1416 px | laptop              | ✅             |
| 1280 × 720 | 1256 px | laptop              | ✅             |
| 1024 × 768 | 1000 px | compact, three tabs | ✅             |

**Methods.** Rendered browser measurement; jsdom + React Testing Library; and a read-only four-lens
expert review (clinical copy, workspace/accessibility, leakage/provenance, test-matrix) whose 52 raw
findings were each put to an independent adversarial verifier — **26 confirmed, 26 refuted**. The
refuted half were wording preferences, misquotes, concerns already handled by an existing guard, or
proposals that would have changed a frozen identifier.

**Re-verified independently.** The whole matrix was then run a second time against the committed
branch, from a fresh browser session rather than from this document — clean page loads at each of the
four viewports plus all six scenarios, the commit → verdict → continue path driven through the DOM,
and every focused suite re-run individually. D1, D2, D4, D7, D8 and D13 were each confirmed still
holding by direct measurement (0 clipped elements and 0 px of pane overflow at all four viewports; no
ancestor scroller above the frame; every pane tab's `aria-controls` resolving; unreached steps
rendering "Step 3/4/5/6" with no title; the `bedside` signal kind present; the signal-register
scroller carrying `tabIndex 0` and `role="group"` in all six panels). That pass found one further
defect — **D16** below, which made the human-testing packet unrunnable — and four shared-component
observations recorded in §4. The owner then accepted one of those four, **U5**, as an accessibility
blocker rather than a deferred preference; it is fixed here and written up as **D17**.

## 2. Defects found and corrected

Every one was reproduced before it was changed, and every fix has a test that fails without it.
D1–D15 came from the first pass, **D16 and D17 from the independent re-verification**; D17 is the one
shared-component fix the owner accepted, and it is written up in full after the table.

| #   | Defect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Severity | Evidence                                                                                                                  | Fix                                                                                                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **CARDIOHELP console clipped in the Learn pane at every viewport.** Console `min-content` is 859 px; the primary pane is 656 px at 1600 × 900 and less below. Panes are `overflow-x: hidden`, so 110 visible elements were cut by up to 203 px — including the entire physical control panel and the **"SIMULATED VALUES" badge** that marks the readings as not a device measurement. `FitWidthSurface` existed for exactly this and was applied only to the foundation route.                                                                                                                                                              | Blocker  | Browser: `scrollWidth 859` vs `clientWidth 656`; per-element overhang measured                                            | Console (only) wrapped in `FitWidthSurface` on the Learn route. Verified after: 0 px clipped, 0 elements cut, scale 0.7635 at 1600 × 900 and 0.6112 at 1280 × 720. Practice/Assess deliberately untouched. |
| D2  | **Pane tabs were a keyboard trap.** Both tab rows used `role="tab"` with a roving `tabIndex` and no arrow-key handler, so only the selected tab was reachable and no key moved between them. At 1024 × 768 a keyboard-only learner could not reach Teaching or Current task at all — they could not read the teaching or answer the prediction. Tabs also carried no `aria-controls`.                                                                                                                                                                                                                                                        | Blocker  | Browser: `tabbableTabCount: 1`; ArrowRight changed neither focus nor selection                                            | Full tablist keyboard pattern: Arrow keys with wrap, Home/End, focus follows selection, and `aria-controls` resolving to each pane.                                                                        |
| D3  | **Lesson objectives stated the authored answer above the unanswered prediction.** `preload-drainage-collapse` carried "Reduce pump demand before correcting the drainage cause" and "Avoid escalating RPM during collapse" in the header that stays on screen through the prediction step — the best choice and the harmful reflex, named. Same pattern in `gas-source-interruption`, `arterial-bubble-stop`, `va-differential-hypoxemia`.                                                                                                                                                                                                   | Blocker  | Expert review, adversarially confirmed against the authored choice sets                                                   | Objectives rewritten to name the discrimination to make, never the move to make.                                                                                                                           |
| D4  | **The step navigator printed every later step's title.** "Reduce pump demand first", "Correct the recirculation cause", "Restore the verified gas source" were painted directly above the radio group asking what to do. `disabled` never hid the text.                                                                                                                                                                                                                                                                                                                                                                                      | Blocker  | Expert review, confirmed                                                                                                  | Steps the learner has not reached show phase and number only.                                                                                                                                              |
| D5  | **The observe rationale stated the recirculation mechanism and the harmful-reflex direction** on the step immediately before the prediction — the same content the panel withholds behind commitment.                                                                                                                                                                                                                                                                                                                                                                                                                                        | Blocker  | Expert review, confirmed                                                                                                  | Rewritten as a reason to look rather than a statement of what is happening.                                                                                                                                |
| D6  | **A panel model boundary named the mechanism it was withholding.** `DrillPanelFrame` renders boundaries ungated; the recirculation boundary described how the governing quantity moves when the circuit is asked for more.                                                                                                                                                                                                                                                                                                                                                                                                                   | Major    | Expert review, confirmed                                                                                                  | Boundary now names only what the simulation omits. The behaviour is still stated in full, inside the commitment gate.                                                                                      |
| D7  | **A fourth vertical scroller wrapped the three panes.** The frame height was `min(58rem, max(30rem, 100dvh − 16rem))` — every term a guess. At 1024 × 768 the 30 rem floor alone (480 px) exceeded the 479 px the activity viewport had, so the viewport scrolled around three panes that already scroll.                                                                                                                                                                                                                                                                                                                                    | Major    | Browser: `#ecmo-activity-viewport` `scrollHeight 536` vs `clientHeight 479`; 143 px overflow at 1280 × 720                | Frame fills its container (`height: 100%`), with the two boxes above it made definite-height on the Learn route only. Verified after: 0 px overflow at every viewport, panes still scrolling internally.   |
| D8  | **Near-patient clamps were classified as a console measurement.** The row defaulted to `valid` — "On the console: this console measures and displays it" — for a manual bedside clamp the CARDIOHELP has no sensor for. It contradicted itself in adjacent cells ("Bedside circuit" / "On the console") and undercut the one discrimination this drill exists to teach: that a stopped pump is not an isolated patient.                                                                                                                                                                                                                      | Major    | Expert review, confirmed; the existing guard's site allowlist skipped the row entirely                                    | New `bedside` signal kind, plus the guard rewritten (below).                                                                                                                                               |
| D9  | **The drainage-judder trigger was described two ways, both incomplete.** The engine sets `drainageChatter` only when the case is drainage-limited **and** `pVen < −75`; the panel named only the first, in two places.                                                                                                                                                                                                                                                                                                                                                                                                                       | Major    | Engine source vs panel copy                                                                                               | Both conditions stated, in the same words, in both places.                                                                                                                                                 |
| D10 | **A precommit discriminator pointed at "the five rows of the pattern" when four are rendered.** The fifth is inside the commitment gate, so the learner was sent to count rows they could not see.                                                                                                                                                                                                                                                                                                                                                                                                                                           | Major    | Expert review, confirmed                                                                                                  | Corrected to four.                                                                                                                                                                                         |
| D11 | **The startup panel asserted that all three pressure channels were reporting** whenever the pump was turning, derived from the stage rather than the readouts — printed beside a table of dashes.                                                                                                                                                                                                                                                                                                                                                                                                                                            | Major    | Expert review, confirmed                                                                                                  | The sentence is now computed from the readouts.                                                                                                                                                            |
| D12 | **The panel's framing question asserted a juddering limb** that its own live signal row contradicted whenever the flag was not set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Major    | Expert review, confirmed                                                                                                  | Phrased about the presentation the case opened with.                                                                                                                                                       |
| D13 | **The signal-register scroller was unreachable by keyboard.** The table scrolls horizontally inside a pane that is `overflow-x: hidden`, so a keyboard user could not reach the clipped "what it is worth" column in any of the six panels.                                                                                                                                                                                                                                                                                                                                                                                                  | Major    | Expert review, confirmed                                                                                                  | `tabIndex={0}`, `role="group"`, and an accessible name on the shared primitive — one change, all six panels.                                                                                               |
| D14 | **`pInt` / `pArt` printed with no unit**, visually or to a screen reader — the only pressures in the step snapshot without one, and the two the learner is asked to compare.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Minor    | Expert review, confirmed                                                                                                  | Unit passed through.                                                                                                                                                                                       |
| D15 | **The old think-aloud script was wrong on two counts** a facilitator would act on: it said sign-in is required (it is not) and told the facilitator that precommit leakage was "structurally impossible" — which D3–D6 disprove.                                                                                                                                                                                                                                                                                                                                                                                                             | Major    | Route loaded without auth; leaks confirmed                                                                                | Script reduced to a pointer at the B5 packet, with both corrections recorded.                                                                                                                              |
| D16 | **The packet named all six lessons by a title that appears nowhere on the Learn route**, so it could not actually be run. The facilitator guide's scope table carried `scenario.title` under a heading promising "the lesson title as the learner sees it", and the participant sheet repeated four of them as "Open the lesson called …". Learn renders `lesson.title` in the lesson header and `pathway.title` in the rail — one string — while `scenario.title` belongs to the Practice surface. A facilitator following the table, and a participant following the sheet, would each look for six lessons that exist under no such name. | Blocker  | Independent re-verification: all six compared against `cardiohelpLearnLessons` and the rendered header — six of six wrong | Guide table corrected to the rendered title, plus the rail label and a direct link per lesson. The participant sheet now names no lesson at all — see below.                                               |

**D17 — the clinical-context strip could not be reached or scrolled by keyboard.** Raised as U5 by the
re-verification pass and fixed here on owner decision, because on a route claiming human-test
readiness an access failure is a blocker rather than a deferred preference.

_Reproduced first._ A focused suite —
`src/features/learning-module/components/__tests__/ClinicalContextStrip.test.tsx` — was written
against the unmodified component and **7 of its 10 tests failed**: no `tabindex="0"`, `Tab` did not
land on the strip, `ArrowRight`/`End` left `scrollLeft` at `0` where the browser-measured range is
1509, no `aria-describedby`, and no `:focus-visible` rule in the stylesheet. Browser measurements
before the change, per viewport:

| Viewport   | Strip box | Content | Hidden  | "Safety constraints"        |
| ---------- | --------- | ------- | ------- | --------------------------- |
| 1600 × 900 | 1585 px   | 3094 px | 1509 px | 1478 px past the right edge |
| 1440 × 900 | 1425 px   | 3094 px | 1669 px | 1638 px past the right edge |
| 1280 × 720 | 1265 px   | 3094 px | 1829 px | 1798 px past the right edge |
| 1024 × 768 | 1009 px   | 2927 px | 1918 px | 1887 px past the right edge |

_Corrected in one shared component_, `ClinicalContextStrip` — the single element all four activity
frames and the ICU simulator lab wrap their patient context in, so the fix is uniform rather than
per-module. It now carries `tabIndex={0}`, an `aria-describedby` pointing at an `sr-only` instruction,
and a handler for Left/Right/Home/End; `.contextStrip` gained a `:focus-visible` outline and
`overscroll-behavior-x: contain`. **The `<section aria-label="Clinical context">` was left alone**, so
the computed `region` landmark and its accessible name are unchanged — the tab stop was added beside
them, not traded for them. No clinical content was added, removed or reordered.

_Verified after._ The strip still overflows by the same amounts at all four viewports; `End` moves
`scrollLeft` to the full range (1493.5 / 1653.5 / 1813.5 / 1903) and brings "Safety constraints" from
outside the box to **16 px inside its right edge** at every one; `Home` returns to 0; one `ArrowRight`
moves a quarter of the visible width (396 / 356 / 316 / 252 px). Vertical overflow stays 0, no ancestor
scroller appears above the workspace frame, the three-pane arrangement is unchanged at every viewport,
and there are no duplicate ids and no focusable descendants inside the strip. Focusability, tab order,
the accessible name, the keyboard handling and the focus ring are asserted in jsdom; the scroll
dimensions and the visible-region change are measured in the browser. **Document focus is still not
claimable from the Browser pane** (`document.hasFocus()` is `false`), so the browser evidence covers
the geometry and the handler, not the act of focusing.

Every consumer was re-run: `ActivityShellV2` 20, ICU simulation 77, mechanical ventilation 468,
hemodynamics/PAC 180, CRRT 276, MCS 128, learning-module 85 — all passing, with the six existing
`getByRole('region', { name: 'Clinical context' })` assertions across `ActivityShellV2` and the ICU
simulation untouched, which is the direct evidence the landmark survived.

**Why D16 was not a find-and-replace.** Four of the six real titles state the answer: "VV
recirculation despite high displayed flow" answers task 2, "Gas-source interruption with preserved
blood flow" answers task 3, "Arterial bubble intervention and cause-before-**reset**" gives away the
ordering task 4 asks for, and "Preload-limited flow and drainage collapse" names the mechanism.
Putting the correct titles into the participant sheet would have traded an unrunnable packet for a
leaking one. So the facilitator opens each lesson from the guide and hands the screen over, the
participant sheet refers only to the lesson already in front of them, and the guide carries an
explicit **do not read the lesson title aloud** instruction. Two contracts pin it: the guide's table
is parsed and compared against `cardiohelpLearnLessons`, and the participant sheet is checked to
contain neither the lesson title nor the scenario title for any of the six.

**Two guards were also strengthened rather than added**, because they would have passed against the
defects above:

- The off-console provenance check filtered rows through a hard-coded **site allowlist**, so a row
  sited at "Bedside circuit" was skipped and could claim to be a console reading unchallenged. It now
  runs both ways over every row: a non-console site may never be `valid`, and a `valid` row must name
  a place the console actually measures. Confirmed non-vacuous by restoring D8 and watching it fail.
- Reveal-before-focus was asserted only by end state, which passes for either ordering. It now
  asserts the timeline.

## 3. What was checked and found sound

- Panes are hidden, never unmounted, in all three arrangements; the console element survives every
  mode change by DOM identity.
- Committed answer, verdict, and a separate Continue survive context switching. Re-confirmed in the
  browser on `preload-drainage-collapse` at 1280 × 720 after committing the **unsafe** option:
  switching Teaching ↔ Current task left `#cardiohelp-console` the same DOM node, the verdict byte-
  identical at 1996 characters, the chosen radio still checked and disabled by its fieldset, and both
  the post-commitment panel and Continue still present. The hidden pane was `display: none`, mounted.
- Help targeting reveals the simulator pane before focusing the control, in compact. The reveal half
  is now also confirmed in the browser: from the Current task tab with the simulator hidden, the help
  request switched context to `primary`, un-hid the pane, and left the target control rendered and
  visible. The focus half remains jsdom-only — `document.hasFocus()` is `false` in that pane.
- No duplicate DOM or guided-control ids anywhere on the Learn route.
- No `undefined`, `NaN`, or `[object Object]` in any of the six scenarios.
- Pane scroll restoration works. It appeared broken in the browser (640 → 0), but that was the
  environment: programmatic scrolling fires no `scroll` event there, so nothing was ever recorded.
  Verified in jsdom with the browser's `display: none` reset emulated explicitly.
- Practice and Assess are unchanged, and have tests asserting they carry no scaling surface.

## 4. Unresolved observations — for the owner, not fixed here

| #   | Observation                                                                                                                                                                                                                                                                                                                    | Why it was not changed                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| U1  | **The module chrome consumes about half the viewport height at 1280 × 720.** After the site header, module header, phase stepper, and patient-context bar, the activity viewport has 361 px, leaving ~232 px of visible pane. Removing the fourth scroller (D7) made this honest rather than hidden, but it did not create it. | The chrome is the shared `ActivityShell` and the patient-context bar, used by every critical-care module. Changing it is a cross-module decision.                              |
| U2  | **The pump-off model-limitation sentence renders three times on one screen** — the Drainage cell, the ΔP cell, and the `pInt`/`pArt` tile — at ~30 words each, dominating the context bar.                                                                                                                                     | Model boundaries appearing beside the constrained output is a landed A3 contract. Shortening or de-duplicating them is a deliberate change to that contract, not a defect fix. |
| U3  | **The `startup-sensor-orientation` teaching pane holds ~13,500 characters** against ~4,700–8,500 for the other five.                                                                                                                                                                                                           | Density is a documented defect class, but no specific contradiction, leak, or inaccessible presentation was found in it. Worth a human read; flagged for the think-aloud.      |
| U4  | **The laptop grid's `52%` primary-column fallback is dead**, and the shared component clamps drags against a three-column budget the laptop arrangement does not have.                                                                                                                                                         | The fix is a new prop on `ResizableTeachingWorkspace`, shared with mechanical ventilation and hemodynamics. Out of scope for this package.                                     |

### Added by the independent re-verification pass

Four further observations, every one measured in the rendered browser and every one rooted in a
**shared** learning-module component rather than in anything this package owns.

**U5 has since been fixed on owner decision** — see §2, D17. It was the one of the four that was an
accessibility blocker rather than a design preference, because half the clinical context on screen,
including the safety constraints, could not be reached without a pointer on a route claiming
human-test readiness. **U6, U7 and U8 remain deferred**: each would change a component that mechanical
ventilation, hemodynamics, MCS, CRRT, and the ICU simulation also render, for a design preference
rather than an access failure — the same reason U1 and U4 were deferred.

| #   | Observation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Measured                                                                           | Why it was not changed here                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U5  | **The clinical-context strip is a horizontal scroller no keyboard can reach.** `scrollWidth` 3094 against `clientWidth` 1585 at 1600 × 900 — 1509 px hidden, rising to 1829 px at 1280 × 720 and 1918 px at 1024 × 768. No `tabindex`, and **zero focusable descendants**, so the hidden half needs a pointer. Hidden there: ABG/MAP, the active-alarm row, **Immediate goal**, and the entire **SAFETY CONSTRAINTS** block including the "follow current manufacturer instructions, ELSO guidance, and local policy" line.                               | Browser, all four viewports                                                        | **FIXED on owner decision — see §2, D17.** Recorded here because this is where it was found.                                                                                                                                                                    |
| U6  | **The shell's "Current task" drawer overlays the workspace and duplicates a pane.** A `<details>` at `z-index: 30` covers the context strip's right edge when closed (116 × 40 px at x 1472) and **448 × 279 px of the three-pane workspace** when open, restating an objective and required action that already have their own pane on this route.                                                                                                                                                                                                       | Browser at 1600 × 900                                                              | `TaskDrawer` is shared. On a route whose premise is a task pane, suppressing it is a per-route decision for the owner, not a defect in the drawer.                                                                                                              |
| U7  | **Pane proportions never recover when the window grows.** Loading at 1024 × 768 and growing to 1600 × 900 leaves panes at **481 / 280 / 750 px** where a clean 1600 load gives 650 / 438 / 423 — Teaching pinned to its 280 px floor, with 5 px of horizontal overflow in the simulator pane. `normalizeWidths` treats previous widths as _preferred_ and only clamps, so one narrow measurement is permanent for the session. A clean load at any of the four viewports is correct.                                                                      | Browser: load at 1024, grow to 1600                                                | The same function and the same shared component as U4 — this is that item's other half, now measured.                                                                                                                                                           |
| U8  | **The pathway rail is crammed and never scrolls to where the learner is.** `.pathwayNav` is a fixed `10.5rem` intro column plus the rail, so inside the 408 px task pane the rail gets **168 px for 17 sections** — one visible, 1493 px hidden (454 px wide, 1207 px hidden at 1280 × 720). `PathwayNav` has no scroll-into-view, so on section 7 of 17 the rail still shows sections 1–2. Every section button is a real tab stop, so keyboard users reach them and the browser scrolls on focus; pointer and screen readers get one section at a time. | Browser at 1600 × 900, 1440 × 900, 1280 × 720 — `activeInView: false` at all three | `PathwayNav` and `learning-pathway.module.css` are shared. The cramming alone could be overridden from this module's stylesheet, but that masks the shared defect for one module and leaves five, and the scroll-into-view half needs the component regardless. |

## 5. Limits of this review

- **No learner has used this.** Automated and expert review cannot tell you whether a novice can
  read the panels. That is what the packet exists to find out.
- **Semantic leakage is not mechanically detectable.** D3, D4 and D5 were found by expert reading,
  not by a test — "Reduce pump demand" and "Back the pump off now" share no words. The widened
  automated corpus catches verbatim reuse of the debrief chain, the correct workflow, and choice
  rationales; it cannot catch a paraphrase. Future leaks of this kind need a human reader.
- **Clinical correctness is not established here.** Novices cannot falsify it and neither can this
  review. It needs an ECMO clinician reading the panels against the authored sources.
- **Focus and scroll were verified in jsdom, not the browser**, for the environment reasons recorded
  in the matrix. Both are deterministic there; neither is claimed from the browser.
- **The fourteen drills without a live panel were not reviewed** beyond confirming they still show
  the explicit no-panel card.
- **Practice and Assess were not reviewed.** They are out of scope and were verified only to be
  unchanged.

## 6. Verification run

Recorded in the pull request for this package, with actual counts.
