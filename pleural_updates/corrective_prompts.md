# Corrective Codex Prompts: Make the Pleural Modules Teach

The modules work but feel like control panels, not lessons. These prompts roll
the shared `LessonScaffold` pattern across the remaining modules, restore the
commit-first flow, and strip the developer language that leaked into the UI.

Apply in order. Reference implementations already exist for three of them —
point Codex at those as the pattern to copy.

## Prerequisite (already provided as reference files)

These are built and type-checked against the repo — drop them in first:

- `src/components/learning/LessonScaffold.tsx` — the shared spine.
- `src/features/pneumothorax-pathway/engine/frameworks.ts` — dual ACCP/BTS evaluator.
- `src/features/pneumothorax-pathway/components/PneumothoraxPathway.tsx` — side-by-side + commit-first.
- `src/features/pleural-ultrasound/components/PatternRecognitionLab.tsx` — neutral vignette + commit-first + score.

The pneumothorax test was rewritten for the new API; mirror that style.

---

## Prompt A — Fix the ultrasound assets content (required by the lab fix)

```
In src/features/pleural-ultrasound/content/assets.ts, the case data currently
leaks the answer: clinicalLabel and alt both name the pattern before the
learner classifies it. Add two fields to the asset interface and every entry:

  neutralVignette: string  // clinical context with NO pattern words, e.g.
                           // '62M, dyspnea 3 days, unilateral effusion on CXR'
  revealCaption: string    // the descriptive caption shown only AFTER answering,
                           // e.g. 'Septated effusion with fibrin strands'

Keep `alt` for the post-reveal state, but make it neutral enough that it does
not state the classification (the component shows a generic alt before reveal
and this alt after). Do not remove groundTruth. Keep attribution. Run
verify:pleural-assets and the done-gate.
```

---

## Prompt B — Wrap the thoracentesis planner in the scaffold and remove the dev note

```
Refactor src/features/thoracentesis-planner/components/ThoracentesisPlanner.tsx
to use LessonScaffold from '@/components/learning/LessonScaffold', matching the
pattern in PneumothoraxPathway.tsx.

Specifics:
- DELETE the leaked developer sentence in the Triangle of Safety card that
  reads '...so no static asset manifest entry is needed.' That is a build note,
  not learner content. Replace with a one-line learner-facing description of
  the triangle borders.
- objectives: identify the triangle of safety borders; relate entry position to
  intercostal vessel risk; predict the pleural pressure response for expandable
  vs trapped lung.
- clinicalAnchor: a short vignette ('68F, large symptomatic effusion, INR 1.4,
  on prophylactic anticoagulation — plan a safe tap').
- Turn the three disconnected cards into a sequence framed by the anchor: first
  pick an entry position, then set the bleeding-risk inputs, then run the
  drainage trainer. Add a commit step: before showing the manometry verdict,
  ask the learner to predict whether this lung will drain fully, slow early, or
  trigger early symptoms; reveal compares their prediction to the model.
- Replace internal jargon shown to the learner: 'RPE risk' -> 're-expansion
  pulmonary edema risk', archetype option labels already read fine, but ensure
  no raw identifiers (partiallyExpandable) appear as visible text.
- keyTakeaway: the safe window is above the 9th rib, lateral to avoid tortuous
  collaterals; stop draining on symptoms or steeply negative pressure, not at a
  fixed volume.
Keep the engine and its tests unchanged. Done-gate.
```

---

## Prompt C — Wrap the pleural infection workflow in the scaffold + commit-first

```
Refactor src/features/pleural-infection/components/PleuralInfectionWorkflow.tsx
to use LessonScaffold, matching PneumothoraxPathway.tsx.

- objectives: classify a parapneumonic effusion (uncomplicated / complicated /
  empyema) from pH, glucose, LDH, Gram stain; choose drainage and intrapleural
  therapy; know when irrigation (PIT) replaces lytics.
- clinicalAnchor: a vignette with the fluid numbers to classify.
- commit step: the learner enters/selects the fluid values and PREDICTS the
  stage before revealing the engine's classification; reveal then shows stage,
  antibiotic duration, and the MIST2 vs PIT branch with the bleeding-risk
  overlay.
- Strip any internal labels; present 'alteplase 10 mg + DNase 5 mg' etc. as
  learner-facing text.
- keyTakeaway: complicated parapneumonic (pH <7.2, glucose <40, or LDH >1000)
  needs drainage; tPA+DNase is the evidence-based intrapleural combination;
  irrigation is the fallback when bleeding risk is prohibitive.
Engine and tests unchanged. Done-gate.
```

---

## Prompt D — Wrap the malignant effusion pathway in the scaffold + commit-first

```
Refactor src/features/malignant-effusion/components/MalignantEffusionPathway.tsx
to use LessonScaffold.

- objectives: escalate appropriately after nondiagnostic taps; choose between
  pleurodesis, TPC, and rapid pleurodesis based on lung re-expansion; counsel a
  patient on TPC care.
- clinicalAnchor: a recurrent MPE vignette.
- commit step: after the large-volume drainage, show the three post-drainage
  outcomes (full / partial / trapped) and have the learner PREDICT which
  management arm fits before revealing.
- Surface the 40-60% thoracentesis sensitivity as the reason to escalate after
  1-2 nondiagnostic taps.
- keyTakeaway: full re-expansion -> pleurodesis candidate; trapped or partial ->
  TPC; do not keep tapping a recurrent malignant effusion.
Register any new CXR images in content/assets.ts with neutral pre-reveal alt +
attribution. Engine and tests unchanged. Done-gate.
```

---

## Prompt E — Rebuild the course wrapper into real phases

```
src/features/intro-pleural-course/components/IntroPleuralCourse.tsx is currently
one long scroll of all 25 pretest items with a broken score readout and no
phase structure. Rebuild it as three explicit phases using a stepper:

  Phase 1 PRETEST: present items WITHOUT revealing correctness (this is a
    baseline measure, not a quiz). Save answers. Show 'X of 25 answered' only.
  Phase 2 PRESCRIPTION: after submitting, call scorePretest and show the ranked
    weak-sections-first module list with links (this already works — keep it).
  Phase 3 POSTTEST: same items (plus any new ones), THIS TIME revealing
    correctness and explanation per item, and show a per-section pretest ->
    posttest delta.

Fix the broken score expression
  {result.totalCorrect}/{result.totalCorrect || answeredCount ? answeredCount : 0}
to a correct '{result.totalCorrect} of {pretestItems.length} correct' shown
only in the posttest phase.

Persist phase + answers. localStorage is acceptable for now (the EBUS Supabase
sync can come later); keep the storageKey but namespace pretest vs posttest
answers separately so the delta is real. Add a clear 'Start over' control.
Done-gate.
```

---

## Prompt F — Global sweep for leaked language and jargon

```
Grep every pleural feature for text that is shown to the learner but written
for developers, and replace with learner-facing language. Check for:
- 'manifest', 'asset', 'SVG', 'engine', 'archetype', 'modeled', 'frame' used as
  UI copy
- raw identifiers rendered as labels (camelCase or kebab-case section codes like
  'chest-tube', 'partiallyExpandable' appearing as visible text)
- abbreviations shown without expansion on first use (RPE, PAL, PSP, SSP, TPC,
  PIT) — expand once per screen
Do not change identifiers in code, only the human-visible strings. Done-gate.
```

---

## Acceptance check (run after all prompts)

A fellow opening any module should, without scrolling or guessing, be able to
answer:

1. What am I supposed to learn here? (objectives, visible immediately)
2. What do I do on this screen? (instructions)
3. Why does this case matter? (clinical anchor)
4. Did I get it right? (commit-first reveal, not reveal-first)
5. What do I take away? (key takeaway)

If any module fails one of those five, it is not done.

```

```
