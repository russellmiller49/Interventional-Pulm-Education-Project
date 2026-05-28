# Review: Why the Pleural Modules Feel Confusing (and how to fix them)

I pulled the `intro` branch and read the six new modules. The good news: the clinical content, the engine math, and the file structure are all sound — Codex followed the architecture faithfully and the thresholds match the knowledge document. The confusion is not in the data layer. It is uniform across every module and it is pedagogical: **Codex built instruments, not lessons.**

A fellow lands on each module and sees a control panel — dropdowns, sliders, toggles, and live-updating metric cards — with no statement of what the module is for, no instructions on what to do, no clinical anchor to reason about, and no "commit before you see the answer" moment. The tools work. They just don't teach, because nothing frames them.

Below: the three systemic root causes, then the module-specific bugs, then the fix.

## Root cause 1 — No teaching scaffold

Every module jumps straight to interactive controls. There is no:

- **Objective** ("By the end you can classify four effusion patterns and state the management implication of each")
- **Instructions** ("Look at the image, commit to a pattern, then check yourself")
- **Clinical anchor** — a short vignette that gives the controls a reason to exist
- **Takeaway** — the one or two sentences the fellow should leave with

A learner cannot tell whether they are supposed to explore freely, answer a question, or follow steps. That ambiguity _is_ the confusion. The chest-drainage and pleural-fluid-analysis modules that already felt good have this scaffolding (headers, lesson overview, nav). The new ones skipped it.

## Root cause 2 — Reveal-first instead of commit-first

Several modules show the answer before asking the learner to think:

- **Pneumothorax**: pick a scenario from a dropdown → the recommendation is already on screen. No "what would you do?" step.
- **Ultrasound pattern lab**: the case card title is literally the answer ("Septated fluid after pneumonia with persistent fever") and the management implication renders from `groundTruth`, not from the learner's answer. The learner is told the pattern, then asked to classify it.

Learning happens in the gap between committing to an answer and seeing the result. These modules close that gap before it opens.

## Root cause 3 — Developer language and internal jargon leaked into the UI

Text meant for the build process is showing to fellows. The worst example, verbatim from the thoracentesis planner:

> "Inline SVG teaching diagram: ... are rendered as text-described shapes, **so no static asset manifest entry is needed.**"

That last clause is a note to _me_, not to a fellow. Elsewhere: "modeled risk frame," "RPE risk," raw archetype identifiers like `partiallyExpandable`, and section codes like `chest-tube` shown as labels. Each one makes the learner feel they are missing context.

## Module-specific issues

### Pneumothorax pathway — lost its headline feature

This is the biggest single regression. The plan called for an **ACCP 2001 vs BTS 2023 side-by-side**, where the entire learning point is seeing _where the two frameworks agree and where they diverge_. Codex collapsed them into one blended `evaluatePneumothoraxPathway()` that emits a single recommendation. The module no longer teaches the thing it exists to teach. Fix below restores two independent evaluators shown side by side.

### Ultrasound pattern lab — answer leak + confusing control

- `clinicalLabel` and `alt` both reveal the pattern before the learner answers (Root cause 2).
- The reset button is labeled "Hide answer" but actually clears the learner's selection — mislabeled.
- No score/streak across cases, so it does not feel like a lab.

### Thoracentesis planner — three disconnected panels

Triangle of safety, vessel risk, and the manometry trainer sit as three independent cards with no narrative tying them together and no task. Plus the leaked dev note. It reads as a dashboard, not a planning exercise.

### Course wrapper — not actually a course

- It is one long scroll of all 25 pretest items with no phase structure. There is no pretest → study → posttest flow; it just says "repeat the same items as a posttest" with no mechanism.
- The score readout is broken: `{result.totalCorrect}/{result.totalCorrect || answeredCount ? answeredCount : 0}` renders confusing values.
- It reveals correct/incorrect after every answer, so it cannot serve as a baseline measure — it has quietly become a quiz.

### Infection / malignant effusion — same scaffold gap

Both are reveal-first fact displays driven by a selector. The clinical logic is good; they need the same lesson wrapper and a commit-first interaction.

## The fix: one shared scaffold + targeted repairs

The efficient fix is a single shared `LessonScaffold` component that every module wraps itself in, giving all six a consistent spine:

**Objective → Clinical anchor → Instructions → [interactive] → Commit → Reveal → Key takeaway → Disclaimer**

This is one component, applied six times. It fixes Root cause 1 everywhere at once and gives a natural home for the commit-first pattern (Root cause 2). Cleaning the leaked strings (Root cause 3) is a find-and-replace.

I have written four reference files you can drop in:

1. `LessonScaffold.tsx` — the shared spine, with an objectives list, a collapsible "how to use this" block, an optional clinical-anchor vignette, a `revealed` state with a commit gate, and the educational-only disclaimer baked in.
2. `frameworks.fixed.ts` + `PneumothoraxPathway.fixed.tsx` — restores the ACCP-vs-BTS dual evaluator and shows them side by side with an agreement banner.
3. `PatternRecognitionLab.fixed.tsx` — neutral vignette before answering, commit-first reveal, a running score, and a relabeled reset.
4. A corrective Codex prompt set (`corrective_prompts.md`) to roll the scaffold across the remaining modules consistently and strip the dev language.

See the companion files. Start with the scaffold and the pneumothorax fix — they demonstrate the pattern the others follow.
