# Critical Care Learning Resource — Implementation Plan (Version 5.1)

**For:** an AI coding assistant working in this repository
**Date:** 2026-07-25 (revised from Version 5, 2026-07-24)
**Supersedes:** `critical-care-integrated-curriculum-plan.md` (v2), `critical-care-integrated-curriculum-plan_v2.md` (v3), `critical-care-integrated-curriculum-plan-v4.md` (v4). Archive those; do not implement from them.
**Related:** `PLAN-REVIEW-2026-07-24.md` — background audit, factual findings still valid. `hemodynamics-module-review.md` — the review that produced this revision.

> **What changed in 5.1.** `icu-hemodynamics` has now been built to this plan and reviewed. It works, and it is the reference implementation — §0.4 tells you what to copy. The review also surfaced a class of defect Version 5 never named: **the teaching content and the simulation engine drifting apart.** Eight instances in one module. §7 turns that into a set of tests. New in this revision: §0.4 (reference implementation), §3.4 (intra-activity navigation), §6.6 (feedback rendering contract), §7 (content–engine consistency, entirely new), §10 (per-module adaptation map), and a substantially expanded §11.2 checklist. Full changelog at §17.

---

## 0. Read this first

### 0.1 What this product is

v4 planned a fellowship-grade assessment program: cut scores, validity arguments, competency evidence, mastery gating. **That is not the product.**

This is a **supplemental online learning resource** for clinicians who want to understand critical-care devices and physiology better. There are no tests. Scores are not shown. Nothing is gated. People arrive with a question, land anywhere, and leave when they have what they came for.

The product is two things:

1. **Scenarios you practice, where mistakes teach you something.**
2. **Explanations you can reach in one click from anywhere you get stuck.**

Everything in this document serves those two things.

### 0.2 Non-negotiable constraints

Do not violate these, ever, without an explicit instruction from the repository owner.

| #   | Rule                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Do not change activity IDs, route paths, storage keys, or progress envelope versions.** Six legacy progress adapters depend on them.                         |
| 2   | **Do not rewrite the simulation engines, physics, or deterministic behavior.** `engine/` directories in all six modules are working and tested.                |
| 3   | **Do not remove schema fields.** Several exist only to satisfy validators and tests. Stop _rendering_ them; do not delete them.                                |
| 4   | **Do not commit PDFs or synthesis files.** See §1.                                                                                                             |
| 5   | **No learner-facing score, percentage, pass/fail, grade, or mastery claim.** See §4.                                                                           |
| 6   | **No route is blocked by incomplete prerequisites, and no phase transition requires a correct answer.** See §3.                                                |
| 7   | **Every clinical statement shown to a learner carries a resolvable citation.** See §8.                                                                         |
| 8   | **A clinical number appears in exactly one place in the codebase.** No threshold is written as a literal in both prose and an engine predicate. See §7.2.      |
| 9   | **If the content promises the learner an observable finding, a test proves the engine produces it.** See §7.3.                                                 |
| 10  | **If a derived value is displayed, an interpretive range is authored for it.** Showing a number with no way to read it is worse than not showing it. See §7.5. |
| 11  | Run `npm run type-check`, `npm run lint`, and the focused Jest suites before considering any work package done.                                                |

Rules 8–10 are new in 5.1. Each corresponds to a defect found in the first completed module; none would have been caught by type-checking, linting, or any existing test.

### 0.3 The codebase you're working in

Verified 2026-07-24. Trust this over any older document.

- **133 registered activities** (127 distinct — `icu-simulation`'s 6 scenarios are registered twice, once as `practice` and once as `assess`, from the same seed array at `src/features/critical-care/content/activities.ts:859-860`).
- Six modules: `icu-hemodynamics` (16), `mechanical-ventilation` (24), `mechanical-circulatory-support` (20), `cardiohelp-ecmo` (36), `baxter-crrt` (25), `icu-simulation` (12/6 distinct).
- Catalog and content: `src/features/critical-care/content/` — `activities.ts`, `modules.ts`, `competencies.ts` (25), `pathways.ts` (17), `references.ts` (12), `assets.ts`.
- Activity type: `src/features/learning-module/activity/types.ts:64-86`; Zod schema at `.../schema.ts:39-96`.
- Progress: `src/features/learning-module/activity/progress.ts`, key `critical-care-activity-progress-v1`.
- Per-module engines, evidence registries, and content live under `src/features/<module>/`.
- Tests: Jest 30, 298 test files (117 in the critical-care surface). **No e2e framework. No `jest-axe`. No visual regression.**
- **Zero i18n coverage** for critical care — all strings hardcoded English despite locale-prefixed routes.

**Shared infrastructure that now exists** (built during the hemodynamics pass — reuse, do not rebuild):

- `src/features/critical-care/content/concepts.ts` — 42 concepts, `criticalCareConceptById`, keyword→concept mapping, and derivation of `teachesConceptIds` / `assumedConceptIds` from activity titles and per-module defaults.
- `src/features/critical-care/components/AssumedConceptStrip.tsx` — the inline refresher, dismissible per-activity and globally, with cross-module thread callbacks.
- `src/features/critical-care/components/CriticalCareConceptDetail.tsx` and the `/critical-care/concepts/[id]` route.
- `src/features/learning-module/scenarioFeedback.ts` — the `ScenarioFeedback` type.
- `src/features/learning-module/components/ScenarioFeedbackCard.tsx`, `ScenarioTeachingDebrief.tsx`, `ActivityShell.tsx`, `ActivityChrome.tsx`, `ActivityStepper.tsx`, `DebriefPanel.tsx`, `TaskPanel.tsx`, `SimulationLaunchGate.tsx`, `ResumeBanner.tsx`.
- `src/features/learning-module/activity/clinicalLearningItem.ts` — item schema with required `evidenceIds`, typed choice `plausibility`, and the learner-copy blocklist.
- `ModuleFrameV2` / `ModuleNavV2` — the four-tab module chrome.

### 0.4 The reference implementation

**`icu-hemodynamics` has been built to this plan and reviewed. Read it before starting any other module.** Where this document and that module disagree, ask — do not silently pick one.

Canonical files to study, and what each demonstrates:

| File                                                                                      | Pattern it establishes                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `icu-hemodynamics/content/hemodynamicTeaching.ts`                                         | Five-part feedback authored per intervention, with case-specific sharpening and a generic fallback. **This is the single most important file to imitate.**                                                               |
| `icu-hemodynamics/content/waveformAtlas.ts`                                               | Signal atlas whose figures are generated by the _same_ engine functions that drive the live display, so an annotation points at the sample the learner actually sees. Header comment at lines 1–8 explains the decision. |
| `icu-hemodynamics/content/troubleshootingAtlas.ts`                                        | Failure taxonomy with `appearance` / `causes` / `numbersTeaching` / `whyItMatters` / `actions` / **`doNot`** / `callouts` per entry, plus reference rows and validity checks.                                            |
| `icu-hemodynamics/content/pacLearningItems.ts`                                            | Distractor design: every choice carries a typed `plausibility` _and_ its own mechanism-level rationale. Line 52–55 is the model — mechanism, discriminating cue, and the wrong reasoning in one sentence.                |
| `icu-hemodynamics/content/pacLearningPathway.ts` + `components/PacLearningPathwayNav.tsx` | Free section navigation: ordered by default, every button enabled, "Jump ahead or revisit any section."                                                                                                                  |
| `icu-hemodynamics/content/sources.ts`                                                     | Per-source `sourceType`, `intendedUse`, and an explicit `limitation`.                                                                                                                                                    |
| `icu-hemodynamics/components/WaveformStrip.tsx:197-231`                                   | Generated `aria-label` that is a real text equivalent for a graphical signal.                                                                                                                                            |
| `icu-hemodynamics/components/{Overview,Learn,Practice,Assess}LandingV2.tsx`               | The four-tab landing pattern with no progress gating.                                                                                                                                                                    |
| `icu-hemodynamics/components/ResizablePacWorkspace.tsx:183-304`                           | Keyboard-operable pane resize with `role="separator"` and `aria-valuetext`.                                                                                                                                              |

**Known defects in the reference implementation** — these are being fixed; do not copy them:

- The five-part feedback renders `likelyFrame` and `theCue` inside a collapsed `<details>`. See §6.6 — render all four inline.
- Intra-activity phase transitions require the keyed-correct answer. See §3.4.
- Eight content–engine contradictions. See §7.
- Six derived values displayed with no interpretive range. See §7.5.
- `plausibility` is authored on every choice and never rendered. See §6.5.

---

## 1. WP0 — Repository hygiene

**Do this before anything else. It takes under an hour and it is currently urgent.**

### Problem

`git ls-files "*.pdf"` returns **132 tracked PDFs**, including full copyrighted textbooks under `critical_care_references/`. `.git` is **4.5 GB**. `Critical_Care_Reference/` is untracked but **not gitignored** — a single `git add -A` commits another 39 PDFs and 10.7 MB of synthesis files.

### Tasks

1. Append to `.gitignore`:

   ```gitignore
   # Private authoring corpus — copyrighted source material, never commit
   /Critical_Care_Reference/
   /critical_care_references/
   **/Full_textbooks/
   **/Summary files/
   ```

   Note: the two plan/review markdown files in `Critical_Care_Reference/` are worth keeping in version control. Either move them to `docs/critical-care/` first, or add a negation for those specific paths.

2. Add a pre-commit check (extend the existing husky setup) that fails on any staged `*.pdf` outside an allowlist.

3. Add a repo-root `NOTICE-SOURCES.md` stating that reference texts are licensed to the owner for personal authoring use and are not distributed.

4. **Flag to the owner, do not do unilaterally:** the 132 already-committed PDFs need a `git filter-repo` history rewrite. This is disruptive and requires a decision.

**Acceptance:** `git status` shows no untracked reference material as addable; `git check-ignore -v Critical_Care_Reference/` resolves.

---

## 2. Design model — how the resource behaves

Read this section before writing any code. Every work package below implements part of it.

### 2.1 The learner

An intensivist, fellow, NP/PA, or nurse who wants to understand something — usually because they hit it on service. They are not enrolled. They have 15 minutes. They will not do modules in order and should not be asked to.

### 2.2 Three ways in, all equal

| Entry                   | What it looks like                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **By device or system** | "I want to understand CRRT." Lands on the module, sees a basics→advanced ordering, starts wherever they like.                 |
| **By concept**          | "What is transmural pressure?" Lands on a concept page showing every place in the program it appears, across all six modules. |
| **By scenario**         | "Give me something to work through." Lands in a practice scenario directly.                                                   |

The concept entry is the one that doesn't exist today and matters most — it is how people actually use an online reference.

### 2.3 Progression without gates

Content is **ordered** basics → advanced. It is never **locked**.

The mechanism that makes this work is not gating — it's **just-in-time scaffolding**:

> An advanced activity declares the concepts it assumes. On open, those appear as a quiet strip of chips. Any chip expands _in place_ into a three-sentence refresher with a link to the full treatment in a side panel. The learner never leaves the page they chose.

Someone comfortable with the basics sees the strip, ignores it, and proceeds. Someone who isn't gets exactly what they need without being redirected into an intro module. This single pattern replaces the entire foundation-gating design in v2–v4.

### 2.4 Mistakes are the curriculum

There are no tests. A scenario is not an examination of what you know; it is a place to find out what you _thought_ you knew. The feedback after a wrong move is the actual teaching content of this product, and it should be authored with more care than the lessons.

---

## 3. WP1 — Open navigation

**Goal:** any activity is reachable in one or two clicks from anywhere, with ordering as a suggestion.

### 3.1 Remove gating

Search for and remove any logic that blocks navigation, disables a link, or hides an activity based on incomplete prerequisites or progress state. Specifically:

- `prerequisiteActivityIds` becomes **advisory metadata only**. Keep the field, keep referential-integrity validation, keep it for suggestion ordering. It must not disable a route, a card, or a button.
- `hiddenUntilAssessment: true` (in `src/features/cardiohelp-ecmo/content/scenarios.ts`) — remove the hiding behavior. Those two capstones become ordinary advanced scenarios.
- The 13 activities that currently carry prerequisites (6 hemodynamics learn activities, hemodynamics assess, 3 MCS capstones, 2 ECMO capstones, 1 CRRT capstone) all become directly reachable.
- Any "locked" iconography, disabled state, or "complete X first" blocking message is deleted.

### 3.2 Difficulty as a visible axis

`CriticalCareDifficulty` (`foundation | intermediate | advanced`) already exists on every activity. Use it.

- Default sort within any module or library view: `foundation` → `intermediate` → `advanced`.
- Render as a quiet badge, never as a lock.
- Add a filter control. Filtering is the user's choice; it is not applied for them.
- Audit the existing assignments — with ordering now carrying the whole weight of progression, a mislabeled activity is a real usability problem. Verify each module reads sensibly top to bottom.

### 3.3 Concept index (new pages)

Add `/[locale]/critical-care/concepts` and `/[locale]/critical-care/concepts/[conceptId]`.

A concept page shows:

- A short plain-language explanation (3–6 sentences, authored — see §5.2).
- "Where this shows up": every activity across all modules that declares this concept, grouped by module, difficulty-sorted.
- Related concepts.
- Citations.

This page is the single highest-value addition in the plan. It converts the app from six separate courses into one connected resource.

### 3.4 Freedom _inside_ an activity — new in 5.1

Version 5 said "no route is blocked." Hemodynamics implemented that correctly and then rebuilt the gate one level down. Every activity runs a forced `recognize → predict → act → observe → explain → transfer` machine with one "next" button per phase, and several transitions refuse to advance until the learner picks the keyed-correct answer:

```
PacGuidedSkillActivity.tsx:678      disabled={completed || !transferCorrect || !isObjectiveComplete}
PacSignalValidationActivity.tsx:733 requires transferInterpretation === 'overdamped-system'
HemodynamicCaseActivity.tsx:716     requires transferChoiceId === 'overdamped-after-position-change'
PacGuidedSkillActivity.tsx:517      silent return blocking commit unless catheter is wedged — button appears dead
```

For someone who opened the page with a specific question, that is the same friction the route-level work removed. Rules:

- **A wrong answer advances, with feedback.** Never block a phase transition on correctness. The feedback is the teaching; withholding the next phase adds nothing.
- **The stepper is interactive.** `learning-module/components/ActivityStepper.tsx:29-48` currently renders non-interactive `<li>`s. Make each phase a button that jumps. Phases the learner hasn't reached are still reachable — they just show less.
- **No silent blocks.** If an action genuinely cannot proceed (a real device interlock, like fast-flushing a wedged PA catheter), say so with a reason. A button that does nothing is a bug.
- **Never hide the correct options.** `HemodynamicCaseActivity.tsx:55-59` filters three interventions out of the HD-08 action list, including the correct ones. If progressive discovery is intended, make it explicit and reversible.
- **Device-suitability interstitials stay dismissible and get a lower threshold.** `SimulationLaunchGate` currently interposes a full-screen card below 1024px width or 700px height — a hard stop for a laptop user who just wanted to read something.

### 3.5 Search

Extend the existing fuzzy search to index concept IDs, concept titles, and concept explanations alongside activity titles and descriptions. Someone typing "wedge pressure" or "recirculation" should land somewhere useful.

### 3.6 Delete dead code carrying the old vocabulary

Hemodynamics still contains `controlsUnlocked`, `"Prediction locked"`, and `"Commit a mechanism and priority to unlock interventions"` in `CaseWorkflow.tsx:36,119,169-173`, plus a "Preview review gate" in `IcuHemodynamicsLab.tsx:366-372`. Both are reachable only from tests. Delete them in every module before someone revives the pattern by reading it.

**Acceptance:** every one of the 127 distinct activities is reachable by direct URL and by at least two navigation paths, with no prerequisite check anywhere in the render path; no phase transition in any activity is conditional on answer correctness; the stepper is operable.

---

## 4. WP2 — Remove assessment framing

**Goal:** nothing in the learner interface implies a test, a score, or a grade — without breaking the schemas, validators, or tests that depend on those fields.

### 4.1 Keep in code, remove from the interface

| Keep (internal)                                                | Why                                                               | Remove from UI                           |
| -------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| `engine/scoring.ts`, all engines                               | Now selects _which feedback fires_, and ranks revisit suggestions | Any numeric score, percentage, or total  |
| Critical-error definitions                                     | Now triggers a hard interrupt and its explanation (§6.3)          | "Critical error" as a penalty label      |
| `masteryRuleId`                                                | Field required by schema for `assessment` kinds                   | Any "mastery" badge, threshold, or claim |
| `creditPolicy`, `completionEvidenceAuthority`, `competencyIds` | Validators and tests depend on them                               | Not surfaced at all                      |
| `status: 'mastered'` in the progress enum                      | Envelope compatibility                                            | Render as "revisited" or omit            |
| `kind: 'assessment'`                                           | ID and schema stability                                           | Display label becomes **"Challenge"**    |

### 4.2 Repurpose the 14 assessment activities as challenge scenarios

Owner decision: **repurpose, do not retire or delete.** These are the hardest authored content in the product.

For each of the 14:

1. Change the display label from "Assessment" to "Challenge." Add a one-line framing: _"A harder case with less help. Feedback comes at the end so you can work through it uninterrupted."_
2. **Remove masking.** The `masked-seeded` selection logic and `hiddenUntilAssessment` flag stop hiding content. The FNV-1a `hashSeed` deterministic selection in `src/features/mechanical-ventilation/content/lessons.ts:706-719` can stay as a scenario-variety mechanism; it just no longer serves secrecy.
3. **Change feedback timing, not feedback existence.** In a Practice scenario, feedback fires per action. In a Challenge, it accumulates silently and is delivered in full at the end. Same content, different delivery point. Learners can opt into per-action feedback with a toggle at the start.
4. No pass/fail outcome. The end state is the debrief (§6.4), not a verdict.

### 4.3 Copy rules — enforce with a test

`src/features/learning-module/activity/clinicalLearningItem.ts` already has a `learnerCopyReviewTerms` blocklist that fails validation on software jargon unless an override reason is supplied. **Extend that existing mechanism** — do not build a second one.

Add to the blocklist, for learner-facing strings:

```
score, scored, points, grade, graded, percent, %, pass, passed, fail, failed,
correct, incorrect, wrong, mastery, mastered, exam, test, quiz, assessment,
attempt N of, X out of Y, certification, certified, competent, competency
```

Preferred replacements, to be used consistently:

| Instead of               | Write                                                          |
| ------------------------ | -------------------------------------------------------------- |
| "Incorrect."             | "Here's what happened."                                        |
| "You failed this case."  | "This one didn't go the way you expected — let's look at why." |
| "Score: 72%"             | _(nothing)_                                                    |
| "Mastery achieved"       | "You've worked through this"                                   |
| "Assessment"             | "Challenge"                                                    |
| "You got 3 of 5 correct" | _(nothing — no tallies anywhere)_                              |

Add a Jest test that scans learner-facing content modules for blocklisted terms and fails the build.

**Acceptance:** grep the rendered string sources for the blocklist and get zero hits; all 133 activities still validate; all existing engine and progress tests still pass.

---

## 5. WP3 — Concept layer

**Goal:** the connective tissue that makes §3.3 and §6 possible. This is the main new data structure in the plan.

### 5.1 Registry

New file: `src/features/critical-care/content/concepts.ts`.

```ts
export interface CriticalCareConcept {
  readonly id: string // e.g. 'cc.flow.transmural-pressure'
  readonly title: string // 'Transmural pressure'
  readonly shortExplanation: string // 3-6 sentences, plain language, standalone
  readonly relatedConceptIds: readonly string[]
  readonly threadId?: CriticalCareThreadId // see 5.3
  readonly evidenceIds: readonly string[] // must resolve — see §8.3
  readonly reviewStatus: 'draft' | 'sme-review' | 'released'
}
```

Starting set — carried from the v2 spine, which was well-designed. Target 40–60 concepts total; treat growth past 80 as a signal the spine has become a topic list.

```
Measurement and interpretation
  cc.measurement.measurand
  cc.measurement.reference-and-zero
  cc.measurement.signal-validity
  cc.measurement.measured-estimated-inferred
  cc.measurement.trends-and-perturbations

Pressure, flow, and perfusion
  cc.flow.pressure-gradient
  cc.flow.resistance-and-impedance
  cc.flow.transmural-pressure
  cc.flow.venous-return
  cc.flow.rv-lv-coupling
  cc.perfusion.cardiac-output
  cc.perfusion.oxygen-content
  cc.perfusion.oxygen-delivery-extraction
  cc.perfusion.macro-micro-coherence

Device and circuit behavior
  cc.device.source-active-component-destination
  cc.device.preload-afterload-dependence
  cc.device.selected-vs-delivered-support
  cc.device.native-device-effective-flow
  cc.device.normal-patient-device-state
  cc.device.patient-device-coupling

Extracorporeal transport
  cc.membrane.diffusion
  cc.membrane.convection
  cc.membrane.ultrafiltration
  cc.membrane.gas-exchange
  cc.membrane.resistance-and-aging
  cc.circuit.pressure-zones

Troubleshooting
  cc.troubleshooting.localize-before-intervene
  cc.troubleshooting.patient
  cc.troubleshooting.measurement-sensor
  cc.troubleshooting.access-position
  cc.troubleshooting.inflow-pre-pump
  cc.troubleshooting.active-component
  cc.troubleshooting.outflow-post-pump
  cc.troubleshooting.exchanger-filter
  cc.troubleshooting.gas-fluid-path
  cc.troubleshooting.controller-power
  cc.troubleshooting.reassess-convergent-signals
```

**Granularity rule:** a concept is the smallest unit that can be independently explained in one short panel and independently linked to from a feedback message. If it needs two panels, split it. If it is never linked to separately from its neighbor, merge them.

### 5.2 Activity metadata

Extend `CriticalCareActivityDefinition` with **non-persisted** fields:

```ts
readonly teachesConceptIds: readonly string[]    // what this activity is actually about
readonly assumedConceptIds: readonly string[]    // what it takes for granted — drives §5.4
```

Do not remove `competencyIds` or `pathwayIds`. Add validation that every concept ID resolves, plus **cycle detection** across `assumedConceptIds` (currently missing for `prerequisiteActivityIds` too — add it there while you're in the file).

### 5.3 Longitudinal threads

Three concepts recur in every module. Tag them so the UI can call them out:

```ts
type CriticalCareThreadId =
  | 'thread.rv-failure'
  | 'thread.heart-lung-interaction'
  | 'thread.measurement-validity'
```

When a learner opens an activity that touches a thread they've already met elsewhere, show a one-line callback: _"You saw transmural pressure in the ventilation module — same mechanism, different circuit."_ This is the resource's differentiator; nothing else in this space connects across devices.

### 5.4 The inline refresher — the key UI pattern

New component: `src/features/critical-care/components/AssumedConceptStrip.tsx`.

Behavior:

- Renders at the top of any activity with non-empty `assumedConceptIds`, collapsed by default.
- Label: _"This assumes you're comfortable with:"_ followed by concept chips.
- Clicking a chip expands `shortExplanation` **in place**, inline, without navigation.
- A "Read more" link inside the expansion opens the full concept page in a **side panel**, not a route change.
- If the learner has already engaged with activities that teach that concept, the chip renders in a muted state — a nudge, never a claim about what they know.
- Dismissible per-activity and globally ("don't show me these").

Requirements: keyboard operable, expansion announced via `aria-live` (the repo already uses this in 48 files), no layout shift on expand, respects `prefers-reduced-motion`.

**This component is why nothing needs to be gated.** Build it early and well.

**Acceptance:** every activity declares at least one `teachesConceptIds` entry; the strip renders and expands without navigation; concept validation and cycle detection pass in the catalog validator.

---

## 6. WP4 — The feedback system

**This is the product. Budget accordingly.**

### 6.1 Feedback structure

Every response to a learner action in a scenario has five parts. **Author all five. Render all four text parts inline.** (Version 5 said "render the first two always and the rest progressively" — that was wrong, see §6.6.)

The type exists at `src/features/learning-module/scenarioFeedback.ts`:

```ts
interface ScenarioFeedback {
  whatHappened: string // The system's response, described plainly.
  whyItHappened: string // Causal chain, 1-2 sentences, mechanism level.
  likelyFrame?: string // "If you were thinking X, that's a reasonable read because…"
  theCue: string // What in the display would have distinguished this.
  conceptIds: readonly string[] // Where to go deeper. Renders as chips.
  evidenceIds: readonly string[]
}
```

`likelyFrame` is what makes this feel like teaching rather than correction, and it is the part most likely to be skipped under time pressure. Require it for every feedback entry attached to an error path — hemodynamics has it on 14 of 16 and the three gaps are all on interventions a learner plausibly reaches.

The register to aim for, from `icu-hemodynamics/content/hemodynamicTeaching.ts:329-340`:

> **whyItHappened:** "Low flow can arise from inadequate preload or excessive afterload, not only from impaired contractility."
> **likelyFrame:** "If you were responding to a low cardiac index, that cue fits—but low flow can also arise from inadequate preload or excessive afterload."
> **theCue:** "Use the filling-pressure pattern and the paired MAP response to distinguish those mechanisms."

Note what `likelyFrame` does: it names the cue the learner _correctly_ read, then widens the differential. It does not say "you were wrong."

### 6.2 Timing rules

| Situation                                                                   | Timing                                               | Rationale                                                                                                             |
| --------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Measurement or setup error (zeroing, leveling, transducer position)         | **Immediate**                                        | No learning value in delay; the consequence is a corrupted reading, not a teachable event                             |
| Localization or interpretation error, observable and reversible in-scenario | **Delayed until the consequence appears**            | Letting the learner see their intervention not work produces better troubleshooting transfer than preventing the move |
| Action that would be catastrophic and irreversible in reality               | **Immediate hard interrupt, with the reason stated** | Never let this play out, even in simulation                                                                           |
| Challenge-mode scenarios (the repurposed 14)                                | **All feedback deferred to the end**                 | Uninterrupted reasoning, full debrief after                                                                           |

Each scenario declares an explicit `hardInterruptActionIds` list. Nothing not on that list gets interrupted.

Never let an error play out **silently**. The non-response is only a teaching moment if the debrief names it.

### 6.3 Critical errors, reframed

The existing critical-error definitions stay — they now do a better job than they did as scoring penalties. A critical error triggers:

1. Hard interrupt.
2. A stated reason: _"Stopping here — in a real patient this would [consequence]."_
3. Full five-part feedback.
4. The option to rewind to just before the action and try again.

No penalty. No tally. No effect on anything persisted beyond a "you found this tricky" marker.

### 6.4 End-of-scenario debrief

Every scenario ends with this sequence, in this order. Do not reorder — step 1 must precede any reveal.

1. **Frame capture, before anything is revealed.** _"Before we look at what happened — what did you think was going on?"_ Free text, **session-only, never persisted**. The value is in articulating it, not in storing it.
2. **Decision trace.** Timestamped reconstruction of what the learner did and what the system was doing at each point.
3. **Expert reasoning contrast.** Side by side with an authored expert path — not "the right answer" but _how someone experienced read this, which cues they used, and when they committed._
4. **Divergence point.** The learner selects where their path diverged. Structured input, not free text. No right answer scored; the selection just drives step 5.
5. **Concept links.** Chips to the specific concepts involved. Never "restart the module."

**Authoring consequence:** an **expert reasoning trace is a required artifact per scenario.** This is real authoring work — roughly comparable to writing the scenario itself. It is also the single thing that most separates this from a device simulator. There are 69 practice scenarios plus 14 challenges; sequence this per module rather than attempting it globally.

### 6.5 Render `plausibility` — new in 5.1

`clinicalLearningItem.ts` already requires a typed `plausibility` on every choice:

```ts
;'best' | 'reasonable-but-incomplete' | 'incorrect-mechanism' | 'unsafe'
```

Hemodynamics authors it on all 12 items and **renders none of it**. That field is a ready-made "your reasoning was partially right" affordance sitting unused in the data. Render it as the framing for the response:

| `plausibility`              | Framing                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| `best`                      | "That's the read the cues support."                                        |
| `reasonable-but-incomplete` | "That's a defensible read as far as it goes —" + what it misses            |
| `incorrect-mechanism`       | "That mechanism would produce a different pattern than the one on screen." |
| `unsafe`                    | Hard interrupt, per §6.2                                                   |

`reasonable-but-incomplete` is the whole reason the field exists. A binary right/wrong response to a partially correct answer teaches the learner that their reasoning was worthless when it was 80% there.

### 6.6 Rendering contract — new in 5.1

**This is the mistake to avoid.** Hemodynamics authored excellent five-part feedback and then put the two best parts behind a closed disclosure widget:

```tsx
// ScenarioFeedbackCard.tsx — do NOT replicate
<details>
  <summary>Read the reasoning cues</summary>
  …likelyFrame… …theCue…
</details>
```

`whatHappened` and `whyItHappened` render inline; `likelyFrame` and `theCue` do not. Most learners will never open a widget when the box above already reads as a complete answer — so the two elements that make this teaching rather than correction reach almost nobody.

Rules:

- **All four text parts render inline, unconditionally.** No `<details>`, no accordion, no "read more" for feedback content.
- If vertical space forces a cut, **collapse `whatHappened`** — the learner just watched it happen. Never collapse `theCue` or `likelyFrame`.
- Concept chips render inline below the text.
- Hard-interrupt feedback renders in full immediately, with the rewind affordance visible without scrolling.
- Feedback is not dismissible until the learner has taken an action that acknowledges it.

### 6.7 Worked-example fading

Within any skill sequence: first instance fully worked, second partially worked with the learner completing the final step, third independent. The existing `Recognize → Predict → Act → Observe → Explain → Transfer` phase model supports this — use the `guided` / `practice` mode distinction that already exists in `supportedModes`.

**Acceptance:** a representative scenario implements all five feedback parts rendered inline, all four timing rules, `plausibility` framing, and the full debrief sequence, before the pattern is rolled out across the module.

---

## 7. WP5 — Content–engine consistency (new in 5.1)

**This work package did not exist in Version 5. It is the largest single addition, and it caught eight defects in the first module.**

### 7.1 The problem

A learning module has two sources of truth about the same physiology: the **prose** the learner reads and the **engine** that generates what they see. Nothing in the type system, the linter, or any existing test connects them. They drift, silently, and the failure is invisible to every automated check while being immediately obvious to a physician.

Every one of these is real, from `icu-hemodynamics`:

| Defect               | Content says                                                                                 | Engine does                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| PH threshold         | mPAP > 20 is pulmonary hypertension (`cases.ts:535`)                                         | Alarms at > 25 (`simulation.ts:542`)                                                |
| PEEP–wedge           | +2–3 per 5 cmH₂O above PEEP 10 (`troubleshootingAtlas.ts:554`)                               | +1.4 mmHg per 5 above PEEP 5 (`simulation.ts:237`)                                  |
| Hydrostatic constant | 0.7355 defined (`waveformMorphology.ts:57`), never used; prose says 7.5 mmHg per 10 cm       | 0.74 hardcoded three times                                                          |
| Tamponade            | "Equalization of diastolic pressures" promised as a recognition cue (`waveformAtlas.ts:487`) | Multipliers 0.72 and 0.62 make equalization arithmetically impossible               |
| Wedge oximetry       | ">90% confirms a true wedge; the most confirmatory check"                                    | HD-04 sets arterial saturation to 88 — the check cannot pass                        |
| `false-wedge`        | Central artifact of the capstone case                                                        | No entry in `artifactDefinitions`; `troubleshootingForArtifact` returns `undefined` |
| PPV                  | Validity screen warns of false positives in RV failure                                       | PPV is derived _from_ `fluidResponsiveness`, so it can never be falsely positive    |
| Fick                 | Equation taught, TD-vs-Fick comparison set up (`PacMeasurementTeaching.tsx:83`)              | Fick CO never computed; no Hb, PaO₂, or VO₂ in the parameter set                    |

None of these is a typo. Each is a reasonable local decision made in one file without checking the other.

### 7.2 Single-source every clinical number

Create `src/features/<module>/content/clinicalThresholds.ts` (or a shared one where a number crosses modules — see §7.6):

```ts
export const CLINICAL_THRESHOLDS = {
  meanPapPulmonaryHypertensionMmHg: 20,
  pawpPreCapillaryMaxMmHg: 15,
  pvrElevatedWoodUnits: 2,
  // …
} as const
```

Rules:

- **No numeric literal in an engine alarm, trigger, or classification predicate.** Every one reads from the constants module.
- **No threshold written as a bare number in learner prose.** Interpolate from the same constant, or if the prose must read naturally, add a test asserting the string contains the constant's value.
- **Physical constants appear exactly once.** One `MMHG_PER_CM_H2O`, imported everywhere.
- Each constant carries a comment with its `evidenceId`.

**Test:** lint rule or Jest scan — fail on a numeric literal inside an alarm predicate; fail if the same physical quantity appears with two different values anywhere in a module.

### 7.3 Promised findings must be reproducible

Every observable finding a module tells the learner to look for gets a test that runs the engine under the parameters of the case that claims it, and asserts the finding appears.

```ts
// tamponade equalization — the test that would have caught the 0.72/0.62 bug
const state = simulate(casesById['HD-07'].baseParameters)
expect(Math.abs(state.rapMmHg - state.pawpMmHg)).toBeLessThanOrEqual(2)
```

Write one of these for every `recognitionCues` entry that asserts a numeric relation, every atlas annotation that names a landmark, and every troubleshooting `appearance` description. If a finding cannot be tested because the engine does not model it, that is the answer — either model it or stop promising it.

### 7.4 Exhaustive coverage of engine states

Every member of a module's artifact/failure/alarm union has a content entry. Enforce with an exhaustive mapped type, not a lookup that can return `undefined`:

```ts
const artifactDefinitions: Record<PressureArtifact, ArtifactDefinition> = { … }
// adding 'false-wedge' to the union now fails the build until content exists
```

Apply to: artifact unions, alarm IDs, intervention IDs, failure modes, and device states. Also verify the reverse — every content entry maps to a state the engine can actually produce (`liveArtifact: null` on three of seven hemodynamics artifacts means they can never be demonstrated).

### 7.5 Every displayed value needs an interpretive range

Hemodynamics computes and displays PAPi, CPO, PA compliance, SVR, SvO₂, and PPV **with no normal range, cutoff, or interpretive text anywhere in the module.** The learner sees `PAPi 1.4` and has no way to know what that means. Six numbers, zero scaffolding.

Create a display registry paired with a range registry and test that their key sets are identical:

```ts
interface DerivedValueGuide {
  id: string
  label: string
  formula: string
  normalRange: string // "800–1200 dyn·s·cm⁻⁵"
  actionableThresholds?: string // "PAPi < 0.9 suggests RV failure in acute MI"
  caveats: string // when the number misleads
  evidenceIds: readonly string[]
  conceptIds: readonly string[]
}
```

**Before building one from scratch, check the other modules.** `mechanical-circulatory-support/engine/model.ts:913,932` already implements PAPi and CPO _with_ interpretation. Cross-link rather than duplicate — and where two modules interpret the same value, §7.6 applies.

### 7.6 Cross-module threshold agreement

mPAP > 20 must mean the same thing in hemodynamics, MCS, ECMO, and the ICU simulator. A shared `src/features/critical-care/content/sharedClinicalThresholds.ts` holds every quantity used by more than one module; module-local files hold only the rest.

**Test:** no quantity name appears in two module-local threshold files.

This also surfaces real source disagreements rather than burying them. Where the syntheses document a genuine conflict — the ECMO anti-Xa targets (0.2–0.3 units/mL vs 0.3–0.7 IU/mL), the Impella CP maximum flow (3.8 vs 3.5 L/min in the same source) — the shared module holds **both values with their sources**, and the content surfaces the disagreement. It never picks one silently and it never averages.

### 7.7 Case answer-key distinctness

Hemodynamics shares one `commonMechanisms` / `commonPriorities` menu across all eight cases, producing six distinct answers for eight scenarios. HD-04 (acute PE) and HD-05 (chronic PH crisis) resolve identically; so do HD-03 (LV failure) and HD-06 (PEEP transmission), even though HD-06's actual teaching point is intrathoracic pressure transmission.

**Rule:** no two cases in a module share an answer key unless the shared answer is the deliberate teaching point, marked explicitly. **Test:** assert distinctness, with an allowlist requiring a stated reason.

Related: every case needs at least one unsafe intervention. HD-02 has `unsafeInterventionIds: []`, so giving fluid in vasodilatory shock is never flagged — contradicting the case's own debrief.

### 7.8 Success criteria must agree with the debrief

HD-04 scores success at `meanPapMmHg ≤ 30`, while its own expert trace says _"Reassess oxygenation and systemic perfusion rather than chasing PAP alone"_ — because in massive PE a falling mPAP can mean a failing RV. The scoring rewards the behavior the teaching warns against.

**Review item, not automatable:** for every case, read the success criteria and the debrief side by side and confirm they reward the same behavior.

### 7.9 Scoring hygiene

The 100-point rubric still runs internally and is invisible to the learner (correct, per §4). But it should only contain terms that actually drive feedback selection or revisit ranking. Hemodynamics awards **5 of 100 points for expanding a `<details>` panel** (`FormulaDrawer.tsx:69-70` fires `VALIDATE_SIGNAL` from `onToggle`), and 15–20 signal-validity points are farmable identically in every case.

Strip terms that no longer do anything. A rubric nobody sees does not need to be comprehensive — it needs to be a good feature vector for "what should this learner revisit."

**Acceptance for WP5:** every threshold single-sourced; every promised finding has a passing test; artifact/alarm/intervention unions exhaustively covered; every displayed derived value has an authored range; no cross-module threshold disagreement; case answer keys distinct.

---

## 8. WP6 — Citations and accuracy

Owner decision: **lighter than v4.** Keep what makes the content trustworthy and auditable; drop the machinery that existed to defend assessment scores.

### 8.1 Keep

**Source manifest** — one row per source document, in `docs/critical-care/source-manifest.json`:

```
doc_id · title · edition/year · publisher · ISBN/DOI · sha256 ·
source_type (guideline | IFU | journal | textbook | chapter | local-protocol) ·
rights_status · review_status · verified_on
```

**Source-authority hierarchy** — a textbook synthesis is never sufficient authority for a clinical recommendation or a device workflow claim:

1. Current guidelines and consensus statements → clinical recommendations
2. Current manufacturer IFUs and manuals → device workflow and software behavior
3. Systematic reviews and primary evidence → disputed or time-sensitive claims
4. Textbooks and syntheses → stable mechanisms and curriculum discovery
5. Labeled local protocols → institution-specific actions
6. Explicit model specifications → simulator behavior

**Three claim types only** (down from v4's nine):

```ts
type ClaimType = 'clinical' | 'device-workflow' | 'model-behavior'
```

`model-behavior` covers anything the simulator does that is a modeling choice rather than a clinical fact. Label it visibly to the learner wherever it could be mistaken for physiology.

**Visible citations.** The repo already has `EvidenceDrawer.tsx`, `ReferenceDrawer.tsx`, and per-module `SourcesPanel.tsx`. Wire concept explanations and scenario feedback into them.

**Conflicts surfaced, not resolved.** The syntheses document real source disagreements — ECMO anti-Xa targets (0.2–0.3 units/mL vs 0.3–0.7 IU/mL), a hemodynamics GEF formula conflict, an Impella CP max-flow discrepancy within a single source. Show both positions with their sources. Never average, never silently pick one.

### 8.2 Drop

Claim-class taxonomy beyond the three above; applicability matrices; `reverifyBy` scheduling; the objective registry; the assessment blueprint. Replace re-verification with a simple annual review list covering device-workflow and guideline-derived claims only.

### 8.3 Fix: `evidenceIds` are validated against nothing

**Highest-leverage single technical fix in this plan.** `validateCriticalCareCatalogs()` checks moduleIds, pathwayIds, competencyIds, assetIds, and prerequisiteActivityIds — but never resolves `evidenceIds`. Two IDs in the live catalog (`mcs-device-source-registry`, `mechanical-ventilation-source-boundary`) resolve to nothing.

Build a unified resolver over the six existing per-module registries (`cardiohelp-ecmo/content/evidence.ts`, `mechanical-ventilation/content/evidence.ts`, `icu-simulation/content/evidence.ts`, `icu-hemodynamics/content/sources.ts`, `mechanical-circulatory-support/content/sources.ts`, `baxter-crrt/content/provenance.ts`). **Map them, don't merge them** — leave each module's registry authoritative and shape-stable. Fail the build on any unresolvable ID.

### 8.4 Source-registry hygiene — new in 5.1

The hemodynamics registry has 14 entries: 3 guidelines + 4 reviews + 1 original research are citable; the other 6 are grey literature, user-supplied files, or self-reference. Two won't survive scrutiny:

- `clinical-hemodynamics-waveforms` carries `year: 2026` but is cited in the atlas as "3rd ed." (2017), with no edition or page numbers — **and it anchors 9 of 12 atlas entries.** The loosest source does the most work.
- `ssc-sepsis-2026` has no authors, no journal, no DOI, and a generic landing-page URL. It reads like a placeholder that reached a live registry.

Per-module rules:

- Every entry has a verifiable year, edition where applicable, and page or section anchors for the specific claims it supports.
- Run a **load-bearing check**: sort sources by how many learner-facing claims cite them. If a grey-literature or user-supplied source is in the top three, either upgrade the claims to a tier 1–3 source or accept that the module cannot make them.
- Keep the `sourceType` / `intendedUse` / `limitation` triple that hemodynamics uses (`content/sources.ts`) — it is the right shape.
- A module that displays computed numbers needs more than one piece of primary evidence behind its thresholds.

### 8.5 The synthesis corpus is not yet a reliable anchor target

If you are asked to trace a claim into `Critical_Care_Reference/Summary files/`, know that the corpus has unresolved problems:

- Four incompatible anchor schemes across the five files.
- References to upstream sections `§9`–`§16` of per-source extracts **that are not in this repository** — 547 occurrences in the MCS file, 256 in Educational, 133 in Hemodynamics, 118 in ECMO, 98 in CRRT.
- `CRRT_Synthesis.md` declares all 840 of its anchors twice (its §8 index is not backticked, unlike Educational's and Hemodynamics'), so deep links are non-deterministic.
- Two page citations exceed their source's page count.
- `Mechanical_Circulatory_Support.md` is 96% §3, source-siloed rather than deduplicated despite its heading, carries 198 `##### Chunk NN` pipeline artifacts, and has 507 `[[INFERRED:]]`/`[LOW-CONF]` reliability tags.

Treat the syntheses as **discovery material** — good for finding what to teach and for mechanism explanations — and verify anything clinical or device-specific against a tier 1–3 source before it reaches a learner. Do not build tooling that depends on anchor resolution until the corpus is normalized.

**Acceptance:** every `evidenceIds` entry across all 133 activities and all concepts resolves; build fails on an unresolvable ID; concept pages and scenario feedback render citations.

---

## 9. WP7 — Personal history, not a gradebook

Owner decision: **keep personal history.** Reuse `critical-care-activity-progress-v1` and its envelope; add derived views only.

### 9.1 Reframe the existing fields

| Field                   | New treatment                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `status`                | Render as "not started / in progress / worked through". Map `mastered` → "worked through" or omit. |
| `bestScore`             | **Never rendered.** Retained internally to rank revisit suggestions.                               |
| `attempts`, `hintCount` | Never rendered as counts. Used to derive "found this tricky".                                      |
| `competencyEvidenceIds` | Not surfaced.                                                                                      |
| `resume`                | Surfaced prominently — "pick up where you left off" is the most useful thing here.                 |

### 9.2 Derived views (computed, not persisted)

- **Continue** — the resume pointer.
- **You found these tricky** — activities where hints were used, a scenario was repeated, or a critical error fired. Framed as an offer, never as a deficiency. Copy: _"Worth another look?"_
- **Concepts you've touched** — derived from `teachesConceptIds` of engaged activities. A map of ground covered, not a completion percentage. **No progress bars, no "X% complete."**
- **Revisit suggestions** — optional spaced resurfacing. Because concepts are shared across modules, a concept met in ventilation can resurface in an ECMO context weeks later. Interleaved across modules, expanding intervals, derived from existing completion data with **no new persisted schema**. Always dismissible, never a notification, never a streak.

### 9.3 Privacy

Local-first. Exportable as JSON. One-click delete. No leaderboards, no streaks, no points — v2's `rebuild-architecture.md` already lists these as non-goals; keep it that way.

**Acceptance:** no percentage or progress bar anywhere; existing progress adapter tests pass unchanged; export and delete work.

---

## 10. Per-module adaptation map (new in 5.1)

Hemodynamics established a shape. Every module has the same shape with different physiology. **Do not invent a new structure per module** — find each module's answer to these seven questions, then build the same files.

### 10.1 The seven structural roles

| Role                         | Hemodynamics instance                                       | What it is                                                                       |
| ---------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **The spine claim**          | measured value vs _valid_ signal                            | The one distinction the whole module exists to teach                             |
| **Ordered learning pathway** | `pacLearningPathway.ts` — 7 sections, `kind` discriminant   | The staged sequence, surfaced as a landing arc and a persistent in-activity rail |
| **Signal atlas**             | `waveformAtlas.ts` — 12 traces, normal first                | Every signal the learner must recognize, generated by the live engine            |
| **Failure taxonomy**         | `troubleshootingAtlas.ts` — 7 artifacts + 13 reference rows | Every way the picture can lie, with `doNot` lists                                |
| **Normal-state panel**       | RA/RV/PA/wedge normals, insertion depths                    | What right looks like, before anything abnormal                                  |
| **Derived values**           | SVR, PVR, CI, PAPi, CPO, PPV                                | Computed numbers — each needs a range (§7.5)                                     |
| **Capstone**                 | HD-08 signal validation                                     | The case where the device lies and the learner must localize                     |

> **The pathway role was missing from the original §10, and that is why the other five modules do not read as courses.** This plan assumed sequencing would emerge from difficulty ordering. It does not: `difficulty` is section-derived at `activities.ts:188-190`, so all 50 learn activities are `foundation` and all 69 practice activities are `intermediate`. Sorting by difficulty is sorting by section.
>
> Full remediation — per-module sequences, the shared abstraction to build, and two bugs that actively re-sort authored order into alphabetical — is specified in **`WP10-curricular-sequencing-PROMPT.md`**. Treat it as this section's missing half.

### 10.2 Per-module translation

**`cardiohelp-ecmo`**

- **Spine:** circuit blood flow vs **effective** flow — recirculation in VV, native-circuit competition in VA. This is the module's whole reason to exist.
- **Signal atlas:** access / pre-membrane / post-membrane pressures and ΔP; flow-vs-RPM relation; sweep and gas-phase parameters; pre- and post-oxygenator saturations. Normal VV and normal VA states first, as separate baselines.
- **Failure taxonomy:** chatter/suckdown, access insufficiency, recirculation, oxygenator thrombosis (ΔP rise + gas-transfer fall), differential hypoxemia (Harlequin), circuit air, cannula migration, tubing kink.
- **Derived values:** recirculation fraction, membrane VO₂/VCO₂, sweep:blood ratio, ΔP, effective flow. All need ranges.
- **Capstone:** displayed flow unchanged, patient deteriorating — patient, drainage, membrane, or measurement?
- **Consistency watch (§7.6):** the synthesis documents a genuine anti-Xa target disagreement (0.2–0.3 units/mL vs 0.3–0.7 IU/mL) and self-reports that no universally endorsed adult anticoagulation target set exists. Hold both, surface the conflict, never encode one as _the_ threshold. The §8.7 operative-technique appendix is authoring material only — this product excludes cannulation technique.

**`baxter-crrt`**

- **Spine:** prescribed vs **delivered** dose — and, separately, clearance dose vs net fluid removal. Learners conflate these two distinctions constantly; teach them as two things.
- **Signal atlas:** the circuit pressure profile — access, filter, return, effluent, TMP — and how each shifts by failure mode. The profile _is_ the waveform here.
- **Failure taxonomy:** positional access alarm, filter clotting (TMP and ΔP rise together), return-pressure rise, air detection, circuit disconnection, downtime accumulation.
- **Derived values:** filtration fraction, effluent dose (mL/kg/hr), TMP, sieving coefficient, delivered:prescribed ratio, net UF rate. Ranges needed for all.
- **Capstone:** pressure localization — given the profile, where in the circuit is the problem?
- **Note:** this module already has the most formal provenance layer in the repo (`content/provenance.ts` with SHA-256 source documents and conflict records). Extend it; do not replace it. If downtime's effect on delivered dose is taught, the engine must model it (§7.3).

**`mechanical-circulatory-support`**

- **Spine:** `selected support → displayed/estimated flow → native flow → effective systemic flow → patient perfusion`. Already in the plan; make it a first-class teaching object with its own concept page.
- **Signal atlas:** placement signal, motor current, aortic and ventricular pressure waveforms, IABP augmentation waveform with each timing error.
- **Failure taxonomy:** suction, inlet/outlet malposition across the valve, purge-pressure abnormality, hemolysis, RV failure limiting delivery, IABP early/late inflation and deflation.
- **Derived values:** PAPi, CPO, effective flow, unloading indices. **PAPi and CPO already have interpretation here** (`engine/model.ts:913,932`) — this module is the source of truth and hemodynamics should cross-link to it.
- **Capstone:** low displayed flow — patient, position, preload, afterload, or purge?
- **Consistency watch:** the synthesis records an Impella CP maximum-flow conflict _within a single source_ (3.8 L/min in a table, 3.5 in the narrative). Hold both.

**`mechanical-ventilation`**

- **Spine:** set vs delivered vs **alveolar** — plateau, driving pressure, auto-PEEP.
- **Signal atlas:** pressure, flow, and volume waveforms plus the PV loop, per mode. Normal for each mode before any abnormal.
- **Failure taxonomy:** auto-PEEP, the dyssynchrony family (trigger, flow, cycling, double-trigger, reverse-trigger), leak, circuit obstruction, secretions, ETT malposition.
- **Derived values:** static and dynamic compliance, resistance, driving pressure, mechanical power, RSBI, P0.1. Ranges needed for all.
- **Capstone:** high peak pressure — resistance, compliance, auto-PEEP, or patient effort?
- **This is a retrofit, see §11.1.**

**`icu-simulation`**

- **Spine:** which support is limiting — the cross-system version of the same question.
- No new atlas. It consumes the other five, which is exactly why §7.6 matters most here: an ICU scenario that alarms on a threshold different from the focused module's is the most damaging version of the drift problem.
- **Failure taxonomy:** interaction failures, not device failures — the ventilator setting that worsens RV output, the fluid that helps one organ and harms another.
- **Capstone:** the six scenarios themselves.
- **Do this module last.**

### 10.3 The rule that generalizes

Every module teaches some version of **"the number on the screen is not the thing you care about."** Hemodynamics: the transducer lies. ECMO: circuit flow isn't effective flow. CRRT: prescribed isn't delivered. MCS: selected isn't effective. Ventilation: set isn't alveolar.

Make that explicit in each module, link all five to a shared concept, and the resource stops being six courses.

---

## 11. WP8 — Content passes, per module

Do these one module at a time. Each is independently shippable.

### Order

1. **`icu-hemodynamics`** (16 activities) — **done, with known defects listed in §0.4.** Fix those first; they are the template everything else copies.
2. **`mechanical-circulatory-support`** (20) — validates the pattern on a device module, and owns PAPi/CPO interpretation.
3. **`baxter-crrt`** (25) — already the most mature content (7 lessons, 17 cases, formal provenance records). Mostly reframing.
4. **`cardiohelp-ecmo`** (36) — largest; the two hidden capstones become ordinary advanced scenarios.
5. **`mechanical-ventilation`** (24) — see §11.1.
6. **`icu-simulation`** (6 distinct) — do last; it depends on concepts from all five others.

### 11.1 Mechanical ventilation is a reconciliation, not a build

The owner's ventilation synthesis is nearly complete. Note that **24 activities already exist** (8 lessons, 15 cases MV-01…MV-15, 1 challenge), authored _before_ the synthesis existed. When it lands:

1. Map all 24 existing activities against the new synthesis and current clinical guidance.
2. Identify contradictions between existing authored content and the sources.
3. **Default rule: when authored content contradicts a tier 1–3 source, the content is pulled pending rewrite.** Confirm this rule with the owner before applying it — it may remove content that is currently live.
4. Then build the foundation sequence: oxygenation/ventilation, equation of motion, breath variables, normal waveforms, patient–ventilator interaction.

Three ventilation textbooks totaling 3,193 pages feed this synthesis — more source material than the CRRT and ECMO syntheses drew on combined. Expect real contradictions, not cosmetic ones.

### 9.2 Per-module checklist

For each module:

**Structure (§10)**

- [ ] The module's spine claim is written down and has its own concept page
- [ ] Signal atlas exists, normal states first, figures generated by the live engine
- [ ] Failure taxonomy exists with `doNot` lists per entry
- [ ] Capstone case exists and is the "the device is lying to you" scenario

**Navigation (§3)**

- [ ] Every activity reachable by direct URL; no prerequisite check in any render path
- [ ] No phase transition conditional on answer correctness
- [ ] Stepper is interactive
- [ ] No silent blocks; no hidden correct options
- [ ] Difficulty assignments audited for a sensible basics→advanced read
- [ ] Dead "locked/unlock" vocabulary deleted

**Concepts (§5)**

- [ ] Every activity declares `teachesConceptIds` and `assumedConceptIds`
- [ ] `AssumedConceptStrip` renders and expands inline
- [ ] At least one module landing links into the concept index
- [ ] `teachesConceptIds` surfaced somewhere, not just `assumed`

**Feedback (§6)**

- [ ] Every practice scenario has five-part feedback on its common error paths
- [ ] All four text parts render inline — no `<details>`
- [ ] `likelyFrame` present on every error-path entry
- [ ] `plausibility` rendered, with `reasonable-but-incomplete` framed as partial credit for reasoning
- [ ] Every scenario has an expert reasoning trace
- [ ] Every scenario declares `hardInterruptActionIds`
- [ ] Learn-pathway items use the same five-part structure as cases, not verdict + explanation

**Content–engine consistency (§7)**

- [ ] Every clinical threshold read from a single constants module; no literals in alarm predicates
- [ ] Every physical constant appears exactly once
- [ ] Every promised observable finding has a passing reproduction test
- [ ] Artifact / alarm / intervention unions exhaustively covered by content
- [ ] Every displayed derived value has an authored interpretive range
- [ ] No cross-module threshold disagreement
- [ ] Case answer keys distinct; every case has at least one unsafe intervention
- [ ] Success criteria and debriefs reward the same behavior
- [ ] Internal rubric contains only terms that drive feedback or revisit ranking

**Sources (§8)**

- [ ] All `evidenceIds` resolve; citations render
- [ ] Load-bearing check run — no grey-literature source in the top three by claim count
- [ ] Every source has a verifiable year, edition, and page anchors
- [ ] Documented source conflicts surfaced rather than resolved

**Accessibility (§12) and tests**

- [ ] No status conveyed by an `aria-hidden` icon without a text alternative
- [ ] No color-only correct/incorrect or state encoding
- [ ] Focus-visible styling on every interactive element
- [ ] Text equivalents for every graphical signal
- [ ] Reduced-motion rules apply to live components, not dead ones
- [ ] Existing engine, scoring, and progress tests still pass

---

## 12. WP9 — Accessibility and quality tooling

Currently the repository asserts accessibility standards it cannot verify: no `jest-axe`, `e2e/` is empty, no visual regression, and automated a11y is limited to the Storybook addon across 12 stories.

Either install the tooling or stop claiming the standard. Recommended minimum:

1. Add `jest-axe` and assert `toHaveNoViolations` on the shell components, the concept pages, the refresher strip, and the debrief.
2. Add Playwright for a small set of journeys: land on a concept page → open an activity → expand a refresher → run a scenario → make a mistake → read feedback → reach the debrief.
3. **Color-vision deficiency is a specific, high-likelihood risk here.** Pressure zones, alarm states, and waveform overlays are color-coded across ECMO, CRRT, and MCS. Every color-coded state must carry a redundant shape, label, or pattern. Test with a CVD simulator.
4. Existing contract from `docs/critical-care/activity-contract.md` still applies: keyboard operation, non-color status, text equivalents for waveform/3D/circuit views, reduced motion, 200% zoom, 320px reflow.

### 12.1 Module-level a11y standards — new in 5.1

The hemodynamics review found the same five issues that will recur in every module. Treat these as the standard, with hemodynamics' good patterns as the reference:

| Requirement                                       | Reference implementation                                                                                   | Failure mode to avoid                                                                                                                                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Graphical signals have generated text equivalents | `WaveformStrip.tsx:197-231` — label, sweep duration, range, reference line, landmarks, transitions, cursor | —                                                                                                                                                                                                                  |
| Status icons carry text alternatives              | —                                                                                                          | `PacSignalValidationActivity.tsx:212-229` renders `CheckCircle2` vs `Circle`, **both `aria-hidden`**, as the primary progress readout of the act phase. A screen-reader user cannot tell whether any step is done. |
| Correct/incorrect never encoded by color alone    | —                                                                                                          | `WaveformRecognitionDrill.tsx:129` + CSS at `4729-4737` uses border color, background, and font weight only                                                                                                        |
| Focus-visible styling exists                      | —                                                                                                          | `focus-visible` appears 0× in any `.tsx` in the module, and `src/app/globals.css` has no focus rule at all. **Fix this globally, once.**                                                                           |
| Reduced-motion rules target live components       | Tick loops in all three activities honor it                                                                | CSS `@media (prefers-reduced-motion)` scoped to `.labShell`, which no route renders                                                                                                                                |
| 3D/canvas views are keyboard operable             | WebGL fallback + text HUD at `HemodynamicHeart3D.tsx:271-290, 341-351`                                     | `OrbitControls` has no keyboard path                                                                                                                                                                               |
| Progress glyphs mean what they look like          | —                                                                                                          | `PacLearningPathwayNav.tsx:44-49` renders a checkmark for the **active** section, which reads as completed                                                                                                         |
| No nested live regions                            | —                                                                                                          | `ActivityChrome.tsx:89` wraps `bottomContent` in `aria-live` while children also use `role="status"`                                                                                                               |

**Localization:** defer entirely. There is zero i18n coverage for critical care today. Author new learner-facing strings as externalized strings so it remains possible later, but do not build the translation pipeline now.

---

## 13. Cognitive load rules

Apply while authoring, not as a separate work package.

- **Element-interactivity budget.** Foundation activities display no more than 5 simultaneously novel elements; intermediate no more than 8. Exceeding it requires a stated reason in the activity definition.
- **One manipulated variable per mechanism lab.** Split rather than layer.
- **Normal before abnormal.** Before any troubleshooting content, the learner must be able to see: correct configuration, flow direction, qualitative pressure relationships, expected signals, direct control–response behavior, which values are measured vs. estimated vs. inferred, markers of adequate support, and the conditions that make the display misleading. This contract from v2 is the strongest idea in the earlier plans — keep it verbatim.
- **Definitions before abbreviations.** Always.
- **Expertise reversal is why nothing is gated.** Scaffolding that helps a novice actively slows an expert. This is the reason for §3 and §5.4 — noted here so no future revision "improves" the product by adding required intro modules.

### The device grammar

Every device explanation covers, in this order: source → active component → destination → direct effect → dependency → limitation.

And every device module teaches this distinction explicitly. It is program-level, not Impella-specific:

```
selected support
displayed / estimated flow
native flow
effective systemic flow
patient perfusion
```

### Scenario difficulty ladder

Order scenarios within a module along this progression. It is an authoring guide, not a gate.

1. Stable normal-state reconstruction
2. Single perturbation, complete data
3. Single problem, incomplete data
4. Patient problem mimicking device failure
5. Device or measurement problem mimicking patient deterioration
6. Two interacting problems
7. Cross-system capstone

---

## 14. Definition of done

A module is done when:

1. Every activity is reachable directly; no route is gated.
2. **No phase transition inside any activity requires a correct answer.**
3. Activities read basics → advanced by default and can be filtered but not locked.
4. Every activity declares the concepts it teaches and assumes.
5. The assumed-concept strip renders and expands inline without navigation.
6. Concept pages exist for every concept the module uses, and list every cross-module appearance.
7. Every practice scenario gives five-part feedback on its common error paths, **all four text parts rendered inline**.
8. `plausibility` is rendered, and a partially correct answer is told it was partially correct.
9. Every scenario has an expert reasoning trace and a full debrief.
10. Every scenario declares which actions hard-interrupt and which are allowed to play out.
11. No score, percentage, pass/fail, or mastery language appears anywhere in the interface; the copy blocklist test passes.
12. **Every clinical threshold is single-sourced, and no numeric literal appears in an engine predicate.**
13. **Every observable finding the content promises has a passing test proving the engine produces it.**
14. **Every displayed derived value has an authored interpretive range.**
15. **Every artifact, alarm, and intervention the engine can produce has a content entry — enforced by an exhaustive type, not a nullable lookup.**
16. Case answer keys are distinct, every case has at least one unsafe intervention, and success criteria agree with debriefs.
17. Every clinical statement carries a resolvable citation; the build fails on unresolvable evidence IDs.
18. Documented source conflicts are shown with both positions, not averaged.
19. Simulator modeling choices are labeled as such where they could be mistaken for physiology.
20. Personal history shows where you've been and what to revisit — with no progress bar and no completion percentage.
21. No status is conveyed by color alone or by an `aria-hidden` icon; focus-visible styling exists.
22. All existing engine, scoring, progress, and catalog tests pass unchanged.
23. `npm run type-check`, `npm run lint`, and the a11y suite pass.

Items 2, 7–8, and 12–16 are new in 5.1. Every one of them corresponds to something the first module got wrong.

---

## 15. What was deliberately dropped from v4

Listed so nobody re-adds them by reading an older document.

| Dropped                                                                              | Why                                                                                        |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Cut scores and standard setting (Angoff/Hofstee)                                     | No scores                                                                                  |
| Messick validity argument                                                            | No assessment to validate                                                                  |
| Miller's pyramid framing and the "Shows how" ceiling                                 | Not a competence claim                                                                     |
| Workplace-based assessment handoff                                                   | Not a fellowship component                                                                 |
| Competency evidence and credit policy as learner-facing concepts                     | Schema fields retained; not surfaced                                                       |
| Formal needs assessment with program directors                                       | Reduced to informal input on what people arrive wanting                                    |
| ACGME alignment section                                                              | Not an accreditation-adjacent product                                                      |
| Faculty facilitation kit                                                             | Not a facilitated product                                                                  |
| Moore's program evaluation levels                                                    | Replaced by usability testing and qualitative feedback                                     |
| Objective registry with conditions and standards                                     | Concepts carry the structure instead                                                       |
| Claim-class taxonomy (9 classes), applicability matrices, re-verification scheduling | Reduced to three claim types and an annual device/guideline review                         |
| Foundation gating and readiness gating                                               | Replaced by the inline refresher strip                                                     |
| Program renaming and scope-statement requirements                                    | Lower stakes for a supplemental resource; a plain scope note on the landing page is enough |

**Retained from v2 because it was genuinely good:** the normal-before-abnormal contract, the scenario difficulty ladder, the troubleshooting localizer spine, the device grammar, the `selected → displayed → native → effective → perfusion` distinction, and the shared concept spine.

---

## 16. Suggested order of work

| #   | Package                                 | Status                                            | Depends on         | Rough size                               |
| --- | --------------------------------------- | ------------------------------------------------- | ------------------ | ---------------------------------------- |
| WP0 | Repo hygiene                            | **Not done — urgent**                             | —                  | Under an hour                            |
| WP1 | Open navigation                         | Route level done; §3.4 intra-activity outstanding | —                  | Small                                    |
| WP2 | Remove assessment framing               | Done in hemodynamics                              | WP1                | Medium                                   |
| WP3 | Concept layer + refresher strip         | Built; §5 gaps outstanding                        | —                  | Medium                                   |
| WP4 | Feedback system                         | Authored well; §6.6 rendering outstanding         | WP3                | Large                                    |
| WP5 | **Content–engine consistency**          | **New — not started**                             | WP4                | Medium, high value                       |
| WP6 | Citations and `evidenceIds` enforcement | Partial                                           | WP3                | Medium                                   |
| WP7 | Personal history                        | Done in hemodynamics                              | WP2                | Small                                    |
| WP8 | Content passes, module by module        | Module 1 of 6                                     | WP5 harness exists | Large — the bulk of the remaining effort |
| WP9 | A11y tooling                            | Not started                                       | —                  | Small; do before anything ships          |

**Immediate sequence:** fix the hemodynamics defects listed in §0.4, build the WP5 test harness against them (each defect is a test case you already know the answer to), then move to `mechanical-circulatory-support` with the harness in place. Building the consistency tests _after_ you know eight real failures is far cheaper than inventing them speculatively.

---

## 17. Changelog

**5.1 — 2026-07-25.** Revised after `icu-hemodynamics` was built to Version 5 and reviewed.

| Change                                                 | Why                                                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| §0.2 rules 8, 9, 10 added                              | Three defect classes in the first module that no existing check would catch                                         |
| §0.4 reference implementation added                    | The pattern now exists in code; point at it rather than describing it                                               |
| §3.4 intra-activity navigation added                   | Route-level freedom was implemented correctly and the gate was rebuilt one level down                               |
| §3.6 dead-vocabulary deletion added                    | `controlsUnlocked` / "Prediction locked" survive in unreachable code and will be copied                             |
| §6.1 revised: render all four parts                    | Version 5 said "render the first two, rest progressively." That instruction produced the collapsed-feedback defect. |
| §6.5 `plausibility` rendering added                    | Field authored on every choice in the first module and never rendered                                               |
| §6.6 rendering contract added                          | Feedback visibility turns out to matter as much as feedback content                                                 |
| **§7 content–engine consistency — entirely new**       | Eight defects in one module, all invisible to type-checking and linting                                             |
| §8.4 source-registry hygiene added                     | The loosest source anchored 9 of 12 atlas entries; one citation looks like a placeholder                            |
| **§10 per-module adaptation map — entirely new**       | Prevents six differently-shaped modules; names each module's spine claim, atlas, taxonomy, capstone                 |
| §11.2 checklist expanded from 10 to ~40 items, grouped | The old checklist would have passed a module with all eight consistency defects                                     |
| §12.1 module a11y standards added                      | Same five issues will recur in every module; hemodynamics has good reference patterns for three of them             |
| §14 definition of done: 15 → 23 items                  | Items 2, 7–8, 12–16 each correspond to a real first-module defect                                                   |
| §16 order of work: status column, WP5 inserted         | Reflects what is actually built                                                                                     |

**Unchanged from Version 5:** product positioning, the no-tests/no-scores decision, personal-history scope, the lighter provenance model, cognitive-load rules, the scenario difficulty ladder, and everything in §15.
