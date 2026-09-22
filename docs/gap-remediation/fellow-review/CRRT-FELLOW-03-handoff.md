# CRRT-FELLOW-03 — readable workbench, Help, navigation and visual teaching

**Status:** implementation complete for the assigned findings; one bounded PR, not merged, not deployed.
**Assigned:** F-09, F-10, F-11, F-12, F-13, F-15; F-14 (equation presentation only); F-20 (badge
layout); F-22 (truthful role UI, preserving the Batch-01 state repair); X-02 / X-03 presentation.
**Not started here:** Batch 04 (self-paced teaching and units), prompt 05 (clinical/device model
and source decisions), Batch 06 (combined acceptance).

## 1. Execution context

| Item                          | Value                                                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository                    | `russellmiller49/Interventional-Pulm-Education-Project`                                                                                                                                                                  |
| PR #263 / CRRT-FELLOW-02      | **MERGED** as `745146f6e40bd536c201313f0480ddde2ee03ca3`, 2026-09-22T18:25:19Z                                                                                                                                           |
| **Base SHA**                  | `745146f6e40bd536c201313f0480ddde2ee03ca3` (= `origin/main` at fetch)                                                                                                                                                    |
| Worktree                      | `Interventional-Pulm-Education-Worktrees/claude-crrt03` (exclusively owned; created at the base SHA for this task)                                                                                                       |
| Branch                        | `claude/crrt-fellow-03` (the session branch `claude/crrt03`, renamed before any commit; never pushed under the old name)                                                                                                 |
| `origin/main` during the work | advanced to `bf613270` (PR #259 MV, PR #254 BF). **No file overlap** with this branch (checked with `git diff --name-only`); not merged in                                                                               |
| Dev server                    | `node node_modules/next/dist/bin/next dev --webpack -p 3113` (the CRRT Playwright config's own port; its `reuseExistingServer` picks it up)                                                                              |
| Production server             | `node .next/standalone/server.js` on 3113 from the real `npm run build` output                                                                                                                                           |
| Environment                   | synthetic `NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only`, `NEXT_PUBLIC_MODULE_FEEDBACK_MODE=owner-local` (for the beta-wrapped route only), passed on the command line |
| Browser                       | Playwright Chromium (isolated contexts, fresh storage per test) and the in-app browser pane; no signed-in browser; synthetic local progress only                                                                         |
| Content version               | `1.1.0-sme-review.1`; engine unchanged                                                                                                                                                                                   |
| Validated code head           | `c4ee1182` (implementation); this handoff is the following docs-only commit, whose SHA is reported in the PR rather than embedded here                                                                                   |
| `.env.local`, `launch.json`   | **not created, not modified**                                                                                                                                                                                            |

Active worktrees at start (relevant ones): `claude-pi04` (another session, same base SHA — different
module), `codex-crrt-263-sanity` / `codex-crrt-263-base` (Batch-02 sanity review, done), and the
trashed `claude-crrt-9-22` (Batch 02). No other session's process was stopped; only this worktree's
dev/production servers on 3113 were started and stopped, each checked by its working directory.

The module is draft / unlisted and every route stays `noindex`. No access, publication, review
status, reviewer, date or signoff changed.

## 2. Reproduction on the merged Batch-02 base (before)

Measured with a Playwright probe (kept outside Git) on the base dev server, CRRT-02 Practice
(hyperkalemia case) and the Learn lessons named. Raw JSON and 36 screenshots:
`Interventional-Pulm-Local-Data/renders/output/crrt-fellow-03-2026-09-22/before-*`.

| Viewport      | Evidence strip `scrollWidth`/box | Labels visible without side-scroll | Label covered by "Current task" | Footer                                      | Help                                                  | Learn circuit scale / min label | Membrane inset             | Learn primary / skip y |
| ------------- | -------------------------------- | ---------------------------------- | ------------------------------- | ------------------------------------------- | ----------------------------------------------------- | ------------------------------- | -------------------------- | ---------------------- |
| 1440×900      | 3,625 / 1,425                    | 5 / 9                              | Delivered / balance             | static 59 px                                | focus stays on Help; hint in a **closed** `<details>` | 0.602 · 6 px                    | 247×73 px · 6 px           | 1,226 / 441            |
| 1280×900      | **3,625** / 1,265                | 4 / 9                              | Effluent / patient removal      | static 59 px                                | same                                                  | 0.602 · 6 px                    | 247×73 px · 6 px           | 1,226 / 441            |
| 1024×768      | 3,458 / 1,009                    | 3 / 9                              | Modality / blood flow           | **sticky** 59 px                            | same                                                  | 0.602 · 6 px                    | 700×208 (layout-dependent) | 1,374 / 519            |
| 390×844       | **2,650** / 351                  | 1 / 9                              | Case, Device                    | **sticky 144 px**                           | same                                                  | 0.602 · 6 px (panned)           | 319×95 · 9 px              | 1,770 / 686            |
| 320×740       | 2,601 / 281                      | 0 / 9                              | Case                            | sticky 168 px                               | same                                                  | 0.602 · 6 px (panned)           | 249×74 · 6 px              | 1,960 / 780            |
| 1280×900 200% | 5,016 / 1,265                    | 3 / 9                              | Patient, Modality / blood flow  | static 96 px; **case viewport 247 px tall** | same                                                  | 0.602 · 6 px                    | 700×208                    | 2,798 / 1,389          |
| 390×844 200%  | 5,027 / 327                      | 0 / 9                              | Case                            | **sticky 499 px** of 844                    | same                                                  | 0.602 · 6 px                    | 252×75                     | 5,003 / 2,283          |

The walkthrough's own figures reproduce exactly: a 3,625 px strip at 1280×900, a 2,650 px strip and a
144 px fixed footer at 390×844. Scroll owners at base: from 1024×700 up, the document was locked and
the case scrolled inside `#crrt-activity-viewport` while the strip scrolled sideways inside
`section[aria-label="Clinical context"]` — two nested scrollers. Also reproduced: the case title
ellipsised off a phone screen (shared `.activityTitleRow h1 { white-space: nowrap }`); the case
surface tabs scrolling sideways at 390 px (423 px of tabs in 336 px); the hub map walking lessons
1, 3, 4, 5, 7, 2, 6, 8 (F-10); the "Topics visited" text sharing the 35 px number-circle style (F-20);
the circuit formula chips reading `TMP = (FILTER + RETURN)/2 − EFFLUENT -18 mmHg` (F-14); and the
Lesson-2 tiles showing TMP 37 / drop 5 from filter 50, return 20, effluent −20 with the corrections
explained only in prose below. The role lens was traced: `roleLens` is written to the session and
the simulation and **read by nothing** (no copy, value, device control, action, record or score).

## 3. Ownership, traced before changing anything

| Surface                                                              | Owner                                                 | What this batch did                                                                                                                                       |
| -------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CrrtActivityWorkspace` + its local `CrrtWorkspaceShell`             | **CRRT**                                              | Rebuilt as a CRRT-local workbench                                                                                                                         |
| `NativeWorkbenchFrame` (learning-module)                             | shared file, **only consumer is CRRT**                | CRRT stopped using it; file **not changed**                                                                                                               |
| `PatientContextBar`, `TaskPanel` (learning-module)                   | shared: CRRT + MCS                                    | CRRT stopped using them; **not changed**                                                                                                                  |
| `ClinicalContextStrip`, `TaskDrawer` (learning-module)               | shared: several frames                                | not used by CRRT any more; **not changed**                                                                                                                |
| `ActivityChrome` header/footer (learning-module)                     | shared: CRRT, MV, ICU sim                             | **not changed**. Title wrap and footer unpinning are CRRT-scoped CSS under `.moduleShell` only                                                            |
| `ReferenceDrawer`, `EvidenceDrawer`, `DebriefPanel`, `ResumeBanner`  | shared                                                | consumed as-is; CRRT supplies its own styled trigger buttons                                                                                              |
| `learning-module/stage` (`LessonShell`, `NowCard`)                   | shared stage, hands-off                               | **not changed**; the Learn task controls are a CRRT-local component rendered as `NowCard` children                                                        |
| Global site header, `html { scroll-behavior: smooth }`, beta wrapper | platform (PI platform task 05)                        | **not changed**; residual items recorded in §11                                                                                                           |
| `critical-care/content/learningPathways.ts`                          | shared content                                        | **not changed** (its CRRT order already equals the lesson registry; now asserted)                                                                         |
| `learning-module/__tests__/criticalCareShellConvergence.test.tsx`    | shared test; CRRT had one entry in its app-shell list | CRRT's entry moved into its own assertion describing the document-scroll model (§4). Every other module's assertion is unchanged                          |
| `e2e/systemic-ux*.spec.ts`                                           | systemic cross-module contracts                       | **not changed**; the CRRT Learn layout was fitted to them (§8)                                                                                            |
| `docs/gap-remediation/self-paced/G01-crrt-source-review-queue.json`  | G01 reviewer packet                                   | two learner-surface excerpts and wordings updated to the reworded diagram labels, with a `laterWordingChange` note; every decision stays **NOT REVIEWED** |

## 4. Workbench, evidence and scroll model (F-11, F-12)

**Mechanism.** Practice and Challenge now scroll the **document** (`data-learning-scroll-owner="document"`
on the CRRT module shell, the same model the focused Learn lesson already used). CRRT-scoped rules in
`baxter-crrt.module.css` return the shared activity frame and chrome to normal flow inside CRRT only.
There is no inner case scroller and no sideways strip.

New `components/CrrtWorkbench.tsx` + `crrt-workbench.module.css` (container queries in rem, so 200%
root text falls back to one column):

- **Wide (workbench ≥ 72rem):** a left column holds **Current task** then **Live patient,
  prescription, and circuit**, beside the case. It is `position: sticky` below the site header, in its
  own column (never over the case), and scrolls by itself when taller than the window; it takes a tab
  stop only while it actually overflows (ResizeObserver).
- **Narrower:** Cases → Current task → evidence → case, one column. Below 40rem the task body folds
  behind one "Show task details" toggle (`aria-expanded`); the **immediate goal is never folded**.
- **Evidence panel:** the **active alert leads** (amber when active), then rows grouped under
  "Supplied at case start · not modeled over time", "Current settings · prescription in force" and
  "Live model output · simulation, now". Every value keeps its label and unit. Nothing the old strip
  carried is dropped except the case title, which is the page heading and the Cases control.
  - **Set vs actual blood flow** are now separate rows (the old strip showed only the setting as
    "blood flow" — a Batch-02 distinction it had missed).
  - Labs stay `Supplied labs at case start … · not modeled over time` (Batch-01 containment). MAP sits
    under "Supplied at case start", consistent with Batch 02 (held, not modeled).
  - Device profile and the two safety constraints are one named disclosure away.
- **Current task:** immediate goal, required action, a disclosure with the objective and findings
  (or learning objectives), and **Show hint / Reference / Evidence as three separately named buttons**
  (previously "Reference Evidence" read as one phrase in a footer). The inline hint is a passive
  `role="status"` reveal; focus stays on its toggle.
- **Title** wraps on a phone (CRRT-scoped override of the shared `nowrap`); the **case surface tabs**
  wrap (`auto-fit` grid) instead of scrolling sideways; the **footer** is in flow (static) and holds
  only the progress label.
- **Case-player text floor:** the case player's 38 smallest sizes (0.56–0.68rem, 9–11 px) were raised
  by one step (0.72–0.8rem). No text in the new surfaces renders under 0.7rem.
- Site-wide smooth scrolling now reached this document-scrolled page and left a just-focused control
  part-way off screen mid-animation (caught by the Batch-02 sanity spec). CRRT sets
  `scroll-behavior: auto` and a `scroll-padding-top` of the site header's height while the workbench is
  mounted — the same opt-out the focused Learn lesson already had.
- "Return to saved case" no longer appears for every `?case=` link: it shows only when local history
  held an earlier visit to that case before this load (the wording was already truthful about not
  replaying state).

**After (production build), same probe:** `…/after-prod-geometry.json`, `after-prod-*.png`.

| Viewport      | Document overflow               | Evidence overflow | Labels covered | Footer       | Help                                          |
| ------------- | ------------------------------- | ----------------- | -------------- | ------------ | --------------------------------------------- |
| 1440×900      | 0                               | 0 (395/395)       | **0 of 8**     | static 48 px | dialog in view; focus on Close; Escape → Help |
| 1280×900      | 0                               | 0 (395/395)       | 0 of 8         | static 48 px | same                                          |
| 1024×768      | 0                               | 0 (998/998)       | 0 of 8         | static 48 px | same                                          |
| 390×844       | 0                               | 0 (364/364)       | 0 of 8         | static 48 px | same                                          |
| 320×740       | 0                               | 0 (294/294)       | 0 of 8         | static 48 px | same                                          |
| 1280×900 200% | 51 px — **global header** (§11) | 0 (1230/1230)     | 0 of 8         | static 96 px | same; body scrolls inside the dialog          |
| 390×844 200%  | 0                               | 0 (340/340)       | 0 of 8         | static 96 px | same                                          |

"Covered" is `elementFromPoint` at each label's centre after scrolling it into view. At 1280×900,
before the page scrolls, the task and the first evidence rows are in view; once the page scrolls the
sticky column shows the task, the alert, the supplied values and the settings, and the live-model rows
are a short scroll within that column. Beta-wrapped route (`/en/development-beta/baxter-crrt`, iframe
1280×835): strip `scrollWidth` 3,625 → evidence 395/395; document overflow 0 in the frame.

## 5. Help (F-09)

`CrrtHelpDialog` (Radix dialog via the CRRT-local `CrrtDialog`) opens from the shared header's Help
button by mouse or keyboard. It shows the case's **existing first hint** (`hintLadder[0]`) and where
each surface is. Description: "Opening help changes nothing in your run: no simulated time passes, no
setting changes, and nothing is recorded or scored."

- Deliberate transition: focus moves into the dialog (to Close, the first control), the focus trap
  holds Tab inside, **Escape** or Close returns focus to **Help** (the opener is remembered because
  the shared button is not a Radix trigger).
- Viewport-bounded (`min(44rem, 100vw − 1.5rem)`, `max-height: 100dvh − 1.5rem`, body scrolls); in view
  at every tested size including 320 px and 200% text.
- Verified to change nothing: simulated clock, performed actions, case heading, URL, evidence text and
  the stored progress record are identical before and after (jsdom and production Chromium). It
  dispatches nothing and is not an attempt, a hint use or a penalty. Passive updates (inline hint,
  selection counts, perspective note) never move focus.

## 6. Cases (F-09)

`CrrtCaseNavigator` above the task: "**Core case 2 of 10**" (or "Additional case 2 of 7 · optional"),
the station, and "Any order; this is a place in the list, not a score or a requirement." Then
**Previous case**, a visible **Cases** `<select>` (six station groups plus "Additional cases ·
optional" — the seventeen practice cases; the old collapsed extras list is gone), **Next case**, and
the existing **Next recommended** link. At a list end the button is replaced by a stated reason
("First core case", "Last core case · more in Cases").

Every control calls Practice's existing `chooseCase`, the Batch-01 canonical path (`router.push` with
`?case=`); no new case store. Position comes from `caseNavigation.ts#selectCrrtCaseNavigation`, a pure
read of the authored lists. Verified: direct selection, previous, next, an additional case, URL,
**Back**, **Forward** and **reload** (production Chromium), plus the Batch-01 route-change/fallback
tests. Case position is never used as progress, mastery or a requirement.

## 7. Role (F-22)

Traced: nothing reads `roleLens`. The control is kept (Batch-01's `SET_ROLE_LENS` preservation stays
exercised) but is now a truthful **"Reading perspective"** group — Prescriber / Operator / **Both
roles** — with a one-line reflection prompt per perspective and the described statement "Switching
keeps your run: it changes no patient value, device control, action or record, and it is not scored or
saved." Exercised: before any action, after an action, after +1 hr, after a committed reassessment,
and five repeated switches — clock, completed actions, evidence text and stored record unchanged; no
URL change. Legacy role records untouched.

## 8. Learn: canonical order, task hierarchy, circuit (F-10, F-13, X-03)

**One order.** `BAXTER_CRRT_LEARN_LESSON_IDS` is the only sequence: a test asserts it equals
`baxterCrrtLearnLessons` and the critical-care pathway sections. New `learnSequence.ts` numbers and
steps through it. Applied to: the lesson picker ("2. Circuit anatomy…"), a "Lesson 2 of 8" kicker,
new **Previous lesson / Next lesson** buttons (with "First lesson" / "Last lesson" at the ends), the
end-of-lesson "Continue to lesson 3: …", the hub's resume link ("Lesson 2: …") and a new
**Recommended Learn sequence** (1–8) on the hub map. Stations are relabelled as topical groups ("six
topic stations", "They are not a required order") and each station chip keeps the canonical number
("Lesson 2 · Circuit anatomy…"). No lesson ID, stored location, deep link or clinical order changed;
Resume still follows the existing local record.

**Task hierarchy.** `CrrtTaskActions` (CRRT-local) renders an exercise's controls **directly after the
exercise** (before a circuit task's summary prose): "Review observations and continue" leads, disabled
with a **specific** reason ("Still to select, in order: Blood pump, Filter, Return segment, Patient
return."), and "Continue without this exercise" sits beside it — full-size (44 px), secondary styling,
keyboard-reachable. "Continuing without the exercise marks nothing as reviewed." The count beside the
tool's own buttons ("2 of 6 stops selected · select them in order") reports this visit's real
selections only; nothing is stored, graded or required. A "Go to this task's continue controls" button
in the card's "Where to look" line moves to the controls (a button, not a hash link, so the Learn
`popstate` handler cannot restart the lesson). Reading tasks keep their single Continue on the card;
exercises with their own check keep only the optional skip plus a note. Measured at 1280×900 on the
blood-path task: the skip moved from 441 px (the first full-width control) to beside the completion
button; the completion button moved from 1,226 to 1,521 px because the drawing above it is larger —
the stop buttons and their live count are at the top of the exercise, and the "Go to this task's
continue controls" button reaches the completion controls in one step. **X-03:** the ten-task
alarms lesson's "Lesson tasks" outline now shows two labelled parts (set-up/normal run; the alert run);
a test holds the parts to the authored task order. Proposed split map (not implemented, for Batch 04 /
owner): Part 1 `machine-orientation … delivery-interpretation` and Part 2 `alarm-arrival …
alarm-transfer` could become two lessons only with an owner-approved ID and progress plan.

**Circuit.** Topology, connections, line styles and labels are unchanged (`CRRT_CIRCUIT_VIEWBOX`, paths
and nodes untouched; the SVG was only extracted into one renderer used twice).

- On a wide lesson the controls stand in a column beside the drawing; the reading surface widens to
  1,440 px when it holds a circuit. Measured scale **0.60 → 0.73 at 1280×900 and 0.795 at
  1440/1600×900**; smallest rendered label 6 → 7–9 px; median 9 → 10–11 px. At 1024×768 (stacked)
  0.61; on a phone the drawing keeps its 800 px panning width (0.60) and Expand is the larger view.
  The cap is set by the systemic adjacency contract (control + drawing span < 680 px and within the
  window), which all five circuit families meet.
- A **legend** of the line styles active in the view now appears under every lesson circuit, with
  "Dimmed lines and parts belong to the same circuit but are not active in this view."
- **Expand circuit** opens the same drawing in a dialog with Fit / 100% / 150% / 200% (a phone opens at
  100%), a keyboard-scrollable drawing region, the legend and the full text equivalent; Escape returns
  focus to the button. At 100% the smallest label renders at 9 px; at 150%, 13.5 px.
- First and last stops (Patient access, Patient return) and every stop between were driven by keyboard
  with visible focus.

## 9. Pressure arithmetic (F-14 — presentation only)

New `pressureArithmetic.ts` describes the arithmetic the PrisMax calculation adapter already
performs; `CrrtPressureArithmetic` lays it out. The **result is always the adapter's own
`calculateDisplayedPressures` output** for the same readings, and both correction constants are the
engine's imports (a test forbids restating 18 or 25 in the presentation code).

- Terms on separate lines: monitored readings, the operation, the correction as its own bracketed
  signed term, the result, and the validity statement. Walkthrough case, now on the Lesson-2 tiles:
  `(50 + 20) ÷ 2 − (−20) + (−18) = 37 mmHg` and `(50 − 20) + (−25) = 5 mmHg`, with "Filter − return,
  before correction 30 mmHg".
- **−18 mmHg:** "printed in the manual's displayed-TMP expression (manual p217 · PDF p218) … not an
  alarm limit or a clinical threshold" (MATH-PM-002).
- **−25 mmHg:** "Correction applied by this simulation · placement held for device review" with the
  existing G01 wording (DEV-PM-010, manual pp201–202 · PDF pp202–203). Placement, magnitude and both
  formulas are unchanged; G01-CRRT-02 / O-04 stay held.
- Where rounded terms would not reproduce the rounded result, the block says the result was
  calculated from unrounded readings. Every block ends "Shown as this simulation calculates it;
  clinical and device review of this arithmetic is pending."
- Shown beside the TMP / filter-drop reading in the live pressure profile (Practice machine surface,
  operational and integration lessons) — with the Batch-02 **no-flow validity note carried through**
  (e.g. `(5 − 5) + (−25) = −25 mmHg` plus "No blood is moving through the circuit…") — and beside the
  Lesson-2 tiles. The live profile keeps its existing no-device-name contract, so there the source
  line gives the page locator only.
- Circuit chips: `TMP = (FILTER + RETURN) ÷ 2 − EFFLUENT + (−18)` and `FILTER DROP = FILTER − RETURN +
(−25 · IN REVIEW)`, under "CALCULATED FROM MONITORED SITES · mmHg".

## 10. Membrane transport (F-15) and badges (F-20)

`CrrtMembraneTransport` replaces the 247×73 px inset with **three panels side by side** (stacked in a
narrow container): diffusion, convection, ultrafiltration, the selected one outlined. Measured: 360×276
px per panel at 1280, 413×317 at 1440; labels 19–21 px (was 6 px). Captions are the inset's existing
text verbatim. Every mark is traceable: dot density = "concentration gradient"; blood down / dialysate
up = the circuit model's "countercurrent" dialysate path; water arrow carrying dots = "water carries
eligible solute"; replacement arrow = "replacement enters the blood path"; water arrow alone =
ultrafiltration. **One dot size only** — no molecule-size or relative-clearance example (not supported
by the current source set; left for prompt 05). Static: no animation; "Static drawing; nothing in it
is measured or animated" and "not a quantitative clearance or patient model". Text equivalent: "What
each panel shows" lists all three captions and what each panel draws.

**F-20:** the "Topics visited" note is its own wrapping pill instead of text squeezed into the station
number circle; the station number gains a screen-reader "Topic station" prefix. The note still says
only "visited" — completion/tick semantics are Batch 04.

## 11. Global and other-owner items (deferred, not fixed here)

1. **Site header overflows at 200% root text** (1280 px): the "Intro to Bronchoscopy" nav link ends at
   x = 1,321, so any document-scrolled page shows 51 px of horizontal overflow (already true on the base
   CRRT Learn route). Practice used to hide it because the app shell locked `body`. Owner: global
   header / PI platform task 05. The Batch-02 sanity spec's overflow check now measures `#main-content`
   when the document overflows, with this reason in a comment.
2. **Site-wide `html { scroll-behavior: smooth }`** animates keyboard focus scrolling on every
   document-scrolled page; CRRT opts out locally. Owner: platform.
3. Shared `ActivityChrome` still pins its footer below 1200 px and ellipsises titles for **MV and ICU
   sim**; CRRT overrides both only inside its own shell. Owner: learning-module chrome.
4. The beta wrapper serves the module only in owner-local feedback mode or to a signed-in account; the
   new e2e test skips itself otherwise.

## 12. Clinical / device claims intentionally unchanged

No engine file changed. No new or changed: solution chemistry, Na/K/HCO₃ kinetics, citrate or calcium
physiology, renal recovery, MAP/vasopressor/arrhythmia response, filter failure, predilution penalty,
filtration-fraction formula, clinical threshold, alarm priority, downtime, latency behaviour, solution
profile or dose recommendation. `latencySeconds` stays unread. Batch-01 containment (supplied labs
only, no evolving solute), actual-run debrief, refused-action history, supplied-zero vs missing, and
Batch-02 machine-workflow authority, prescription-review truth, set-vs-actual flow, pressure validity,
held MAP, CRRT-05 MODEL NOT IMPLEMENTED and CRRT-15/16/17/18 distinctions are all untouched and
re-verified by their existing suites. Source IDs used for new presentation: MATH-PM-002, DEV-PM-010,
the circuit model's `dialysate-supply` text equivalent, and the existing filter-inset captions.

## 13. Classification

| Finding | Classification                                                                             | Note                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-09    | **FIXED**                                                                                  | Help dialog; visible Cases control on the canonical route                                                                                           |
| F-10    | **FIXED**                                                                                  | One Learn order on hub, picker, numbers, previous/next, end-of-lesson, resume                                                                       |
| F-11    | **FIXED**                                                                                  | No hidden strip; grouped evidence; Reference/Evidence separate; nothing covers labels                                                               |
| F-12    | **FIXED** (CRRT surfaces) · **GLOBAL/OTHER OWNER** (header at 200%)                        | Title/tabs wrap, footer unpinned, no sideways scroll; site header item §11.1                                                                        |
| F-13    | **FIXED**                                                                                  | Controls follow the exercise with specific reasons; skip visible and secondary; circuit 0.60 → 0.73–0.80 + legend + expanded view                   |
| F-14    | **FIXED** (presentation) · **OWNER/SOURCE HOLD** (−25 placement, G01-CRRT-02 / O-04)       | Arithmetic laid out from the adapter; formulas and constants unchanged                                                                              |
| F-15    | **FIXED** (presentation) · **DEFERRED** to 05 (molecule-size / relative-transport example) | Three enlarged, traceable, static panels with a text equivalent                                                                                     |
| F-20    | **FIXED** (badge layout) · **DEFERRED** to 04 (visited vs completed semantics, ticks)      |                                                                                                                                                     |
| F-22    | **FIXED**                                                                                  | Truthful "Reading perspective"; Batch-01 preservation re-verified                                                                                   |
| X-02    | **ALREADY ADDRESSED / DEFERRED**                                                           | Supplied-example labelling done in Batch 02; builder goals were already grouped by fieldset; further load reduction is a Batch-04 teaching decision |
| X-03    | **FIXED** (in-lesson outline) · **DEFERRED** (the split itself; proposed map in §8)        |                                                                                                                                                     |

Still held, not touched: O-01–O-06, O-09, O-10, CONFLICT-001, CONFLICT-002, G01-CRRT-02.
MODEL NOT IMPLEMENTED items from Batches 01–02 are unchanged; a clearer layout closes none of them.

## 14. Tests

### New

| File                                                                | Tests | What they exercise                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/workbenchWayfinding.test.tsx`                            | 13    | every evidence label and group; set vs actual flow; task fold and separate Reference/Evidence; Help by mouse and keyboard, Escape/Close focus return, no state change (Practice and Challenge); Cases position, previous/next, ends, additional, route change, model; role perspective across five switches                                         |
| `__tests__/learnOrderAndTaskControls.test.tsx`                      | 14    | one order across registry/lessons/pathway; first/middle/last; picker and previous/next; hub sequence and chip numbers; resume from the local record; visited pill; controls after the exercise with specific reason, live count, skip marks nothing reviewed, read and own-check tasks; outline parts equal authored order                          |
| `__tests__/pressureArithmeticAndVisuals.test.tsx`                   | 10    | adapter-equal results for five reading sets; correction terms and held status; no-flow validity kept; no restated constants; circuit chips; legend; expanded view keyboard/size/focus; membrane panels, text equivalent, static, one dot size                                                                                                       |
| `e2e/baxter-crrt-workbench-wayfinding.spec.ts` (in the CRRT config) | 18    | six-viewport geometry (no overflow in the shell, labels uncovered, task/first action reachable, columns never overlap, footer static); all-detail-expanded; Help at four viewports; Cases with Back/Forward/reload; role; Learn order/resume; task controls and circuit scale/pair span; expanded view; membrane and arithmetic; beta-wrapped route |

A new-surface test fails on the base because the surface is absent; the behavioural "before" evidence is
the probe in §2, not those failures.

### Updated (intentional contract changes)

`practiceAssess.ui.test.tsx`, `caseIdentityAndRole.test.tsx`, `legacyProgressBytes.test.tsx` (picker is
now the visible "Cases" control, additional cases inside it); `learningWorkflow.ui.test.tsx` (role
group is "Reading perspective", "Both roles"); `criticalCareShellConvergence.test.tsx` (CRRT's app-shell
entry replaced by its own document-scroll assertion); `e2e/baxter-crrt-foundations.spec.ts`
("Continue to lesson N: …"); `e2e/baxter-crrt-self-paced.spec.ts` (Cases control, "Both roles");
`e2e/baxter-crrt-sanity-review.spec.ts` (overflow measured inside `#main-content` when only the global
header overflows); `G01-crrt-source-review-queue.json` (two excerpts, §3).

### Commands

```
npx --no-install jest src/features/baxter-crrt                          → 73 suites, 805 tests, pass
npx --no-install jest src/features/critical-care/progress src/app/api/analytics \
  src/app/sitemap.baxter-crrt.test.ts src/features/module-beta \
  'src/app/[locale]/baxter-crrt' src/features/learning-module          → 29 suites, 347 tests, pass
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit                  → exit 0
npx --no-install eslint <changed .ts/.tsx>                               → 0 problems
npx --no-install prettier --check <changed files>                        → clean
git diff --check                                                         → clean
npm run build (8 GB heap, synthetic env)                                 → success (pre-existing dependency warnings only)
CRRT Playwright, dev server (3113)                                       → 45 / 45
CRRT Playwright, production build (3113)                                 → 45 / 45
Systemic UX specs, CRRT tests only (-g "CRRT|crrt"), production          → 52 / 52
```

The systemic run first failed 20 then 5 checks on the enlarged stacked circuit (pair span over 680 px /
below the window); the side-by-side wide layout and the height caps in §8 were chosen to meet those
contracts, and the final production run passed all 52.

## 15. Browser matrix

Production Chromium (Playwright) at 1440×900, 1280×900, 1024×768, 390×844, 320×740 and 1280×900 with
200% root text (plus 390×844 at 200% in the probe, and 1600×900 via the systemic specs): Practice
(CRRT-02, CRRT-04, CRRT-06, CRRT-11, CRRT-13, CRRT-17), Challenge, hub, Learn lessons 1, 2, 3, 5, 8,
and the beta-wrapped route. Exercised: Help (mouse, keyboard, Escape, Close), Cases (select,
previous/next, additional, Back/Forward/reload), role, every evidence row, task and evidence
disclosures all open, Reference and Evidence sheets, first/last circuit stops, expanded circuit,
Learn previous/next/resume, task transition, disabled completion with reason, skip. The site theme
toggle was switched to light: the CRRT module keeps its fixed dark palette (as before), the Reference
sheet and the CRRT dialogs stay legible; no alternate CRRT theme is claimed.

Evidence: `Interventional-Pulm-Local-Data/renders/output/crrt-fellow-03-2026-09-22/`
(`before-*`, `after-dev-*`, `after-prod-*` screenshots; `before-geometry.json`,
`after-dev-geometry.json`, `after-prod-geometry.json`). Playwright traces for failures went to
`/tmp/crrt-batch-c-playwright` and the session scratchpad.

## 16. NOT RUN

- No screen reader or other assistive technology; no native browser zoom (200% was root text, not
  zoom); no Safari/WebKit or Firefox; no real phone or touch hardware; no `es` / `zh-CN` locale pass.
- No real learner, fellow or operator session. The walkthrough is AI-assisted persona feedback.
- The systemic specs were run for their CRRT tests only; their MV, MCS, ECMO, BBT, PI, EBUS and BF tests
  were not run (this branch changes none of those modules).
- No clinical, device or source claim was verified or added; no manual page was re-read beyond the
  locators already registered.

## 17. Remaining dependencies

- **Batch 04:** visited vs completed semantics and hub ticks (F-20 rest); terminology and internal
  codes (F-19, F-24; e.g. humanised alarm codes, "Active alert" naming under O-09); whether to cut the
  prescription builder's goal load further (X-02); teaching copy for the perspective prompts if the
  owner wants them reviewed.
- **Prompt 05:** molecule-size / sieving example for the membrane panels (F-15); the −25 mmHg placement
  (O-04 / G01-CRRT-02); O-01–O-06, O-09, O-10, CONFLICT-001/002 unchanged.
- **Owner:** whether Lesson 5 should split along the proposed part boundary (X-03); the platform items
  in §11.
- **Batch 06:** re-measure §2/§4 with the probe; the evidence panel's grouping and the Cases control
  are the new contracts to protect.

## 18. Files

Added: `src/features/baxter-crrt/{caseNavigation,learnSequence,pressureArithmetic}.ts`;
`components/{CrrtWorkbench,CrrtCaseNavigator,CrrtDialog,CrrtMembraneTransport,CrrtPressureArithmetic}.tsx`
and their five CSS modules; three `__tests__` files; `e2e/baxter-crrt-workbench-wayfinding.spec.ts`;
this handoff.

Modified: `components/{BaxterCrrtAssess,BaxterCrrtHub,BaxterCrrtModuleFrame,BaxterCrrtPractice,CrrtActivityWorkspace,CrrtCasePlayer,CrrtFoundationLesson,CrrtFoundationTools,CrrtLivePressureDevice,CrrtPilotCircuit}.tsx`;
`components/{baxter-crrt,crrt-case-player,crrt-foundations,crrt-pilot-circuit}.module.css`; four
CRRT test files; `learning-module/__tests__/criticalCareShellConvergence.test.tsx`; three CRRT e2e
specs; `playwright.baxter-crrt.config.ts`; `G01-crrt-source-review-queue.json`.

Not modified: every file under `src/features/baxter-crrt/engine/` and `content/`, every shared
learning-module component and the stage package, `src/styles/globals.css`, `.env.local`,
`.claude/launch.json`.
