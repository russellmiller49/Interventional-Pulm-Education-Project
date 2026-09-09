---
name: medical-education-modules
description: >-
  Author, restructure, or review online medical education content — curricula, lesson and drill
  sequences, foundation prose, simulation teaching panels, quiz/case items, learning pathways, and
  module navigation — so it teaches basics-to-complex, stays clinically accurate and source-backed,
  and reads as professional courseware rather than an encyclopedia. Use this whenever a task touches
  educational content for clinicians or trainees in any form: writing or editing a lesson, unit,
  module, tutorial, walkthrough, teaching panel, question-bank item, or case; sequencing, reordering,
  or splitting curriculum content; responding to "confusing," "hard to follow," or "doesn't flow"
  feedback on a module; designing assessments or simulations that teach; or auditing existing
  educational content for quality, answer leakage, or safety problems — even when the user doesn't
  say "education" explicitly (e.g., "add a section teaching X," "make this module clearer," "write
  quiz questions about Y," "build a trainer for Z").
---

# Medical Education Modules

Standards and workflow for building online medical teaching content that learners can actually
follow. The recurring failure of AI-authored medical education is not inaccuracy — it is
*encyclopedism*: correct prose with no spine, no anchors, no deliberately sequenced difficulty, and
assessments that leak their own answers. This skill exists to prevent that.

When the surrounding project defines its own contracts (an evidence registry, leakage tests, copy
lint, frozen content, an ordering registry), those contracts win — this skill supplies the standard
where none exists and the rationale where one does.

## The twelve principles

Apply these to every unit of content. The reference files expand each with examples and
anti-patterns.

1. **Spine first.** Organize the module around one traversable structure — a blood path, a breath
   cycle, an airway tree, a dialysis circuit, a procedure timeline. Introduce every term, signal,
   and control *at its location on the spine*, never as a list. Give the learner a persistent
   "you are here." → `references/pedagogy-patterns.md` (P1)
2. **Normal before broken.** Never teach a failure mode before the learner has seen the normal
   state it deviates from. Sequence: why this therapy exists → walk the system → the normal state →
   the controls → one fault at a time → integration → cases. → `references/module-structure.md`
3. **Analogy → checklist → application.** Every mechanical or physiologic concept gets a concrete
   image first, the precise statement second, a reusable checklist of ≤4 items third, and an
   immediate application fourth. Precision without an anchor does not survive to the bedside.
   → `references/pedagogy-patterns.md` (P2)
4. **Small control panel early.** Explicitly enumerate the few things the learner can actually
   change ("you can only change three things on this circuit") before any troubleshooting.
   Everything else is monitoring. This is the single largest cognitive-load reduction available.
5. **Decouple confusable controls with story-problems.** Wherever two controls are habitually
   confused (blood flow vs sweep, FiO₂ vs PEEP, rate vs tidal volume), author a 60-second scenario
   in which only the correct one works — and one in which the wrong one visibly fails to help.
6. **One diagnostic grammar, stated once, reused everywhere.** Build the module's core decision
   table (signal pattern → location → cause shortlist) as a single named artifact. Every later
   lesson highlights its row; none restates it in different words. → `pedagogy-patterns.md` (P5)
7. **Complexity in named increments.** "VA ECMO is VV plus exactly two new ideas." Count the new
   ideas out loud at every step up; the learner should never wonder how much is new.
8. **Trend over threshold.** Teach direction, pattern, and change-from-this-patient's-baseline.
   Numeric bands appear only with a source and an institution-variation flag. Never invent a
   cutoff to make prose feel authoritative. → `references/clinical-content.md`
9. **Predict → commit → reveal.** Ask for the learner's committed prediction *before* the
   mechanism or answer is visible anywhere — including titles, objectives, step lists, navigation
   labels, and state readouts. Audit for leakage as a distinct pass.
   → `references/assessment-design.md`
10. **Honest boundaries.** State plainly what the simulation, model, or lesson does not represent.
    Recognition or escalation must never masquerade as treatment; a sim must never show clinical
    benefit from an action the copy calls unsafe; scoring must never award mastery through an
    unsafe path. → `references/clinical-content.md`
11. **Retrieval immediately, cases later.** After each mechanism, run 1–2 two-minute micro-cases
    (static signals → one decision). Save rich, multi-step cases for a separate practice layer,
    paired to the lesson by *mechanism*, not by theme.
12. **One door, one map.** A module has exactly one ordered sequence, one primary "continue" entry
    point that resolves to the learner's next incomplete step, counts derived from the content
    registry (never hardcoded), and one term per concept across every surface.
    → `references/module-structure.md`

## Workflow

### Phase 1 — Plan (before writing any learner-facing text)

Produce a short module plan containing: the learner and their assumed prerequisites; the spine;
the control panel (the ≤5 things the learner can change); the diagnostic grammar artifact; the
stage ladder (orientation → foundation → mechanism → application → integration) with one row per
unit; the model boundaries (what will *not* be simulated or claimed); and the source classes
available. If any lesson's prerequisite concept has no earlier row teaching it, fix the ladder
before authoring. Read `references/module-structure.md` for the ladder and sequencing rules.

### Phase 2 — Author each unit against the lesson spec

Every teaching unit — prose section, sim drill, or case — fills this spec before its copy is
written. A field you cannot fill is a design gap, not a field to skip.

```
LESSON SPEC
- Position & prerequisites: what the learner already holds, and which earlier unit taught it
- New concept: exactly one
- Clinical question: the decision this unit enables the learner to make
- Signals available & provenance: measured | derived | authored-for-teaching (label each)
- Prediction (the commit point) and the best reasoning behind the right answer
- Plausible wrong mental models: ≥2, each a documented real-world misconception, each with
  its own rationale-for-why-wrong
- Learner action → system response → patient response (all three, honestly modeled)
- Explanation: postcommit only
- Transfer: a different situation testing the same principle (not the same stem re-nouned)
- Harmful reflex: the tempting wrong move; the sim and the scoring must not reward it
- Model boundary: what is not represented, stated to the learner
- Sources: one per claim class (see clinical-content.md)
- Reused later by: the forward link that justifies this unit's position
```

Write copy per the standards in `references/pedagogy-patterns.md` (voice, analogies, length
budgets) and keep every number/claim within `references/clinical-content.md`.

### Phase 3 — Self-review before shipping

Run the audit in `references/review-rubric.md` as a separate pass with fresh eyes — it is
organized by failure class (causal contradiction, answer leakage, safety-scoring inconsistency,
sequencing mismatch, terminology drift, copy density) with concrete checks and severities. Do not
skip it because the content "was just written carefully"; the rubric exists because careful
authors leak answers through titles and reward unsafe paths through scoring, reliably.

## Hard rules (non-negotiable regardless of context)

- Never invent a numeric threshold, target, or cutoff. If a number is needed, it needs a source
  and an institution-variation note; otherwise teach the trend.
- Never place the diagnosis, mechanism, or best action in any text visible before the learner
  commits a prediction — including headings, objectives, later-step titles, and status labels.
- Never let a simulation show patient improvement from assessment, escalation, or documentation
  alone, and never let scoring award completion or mastery through a path the copy calls unsafe.
- Never teach a failure mode before its normal state, or use a term before its spine location has
  been established.
- Safety-critical procedural choreography (clamp sequences, energy settings, drug dosing, device
  resets) is taught as principle plus "per current IFU and local protocol" — never as an invented
  universal step order.
- One claim, one source class. Distinguish guideline / textbook / institution practice /
  authored-teaching-construct, and label the last two as such to the learner.

## Reference files

| File | Read it when |
|---|---|
| `references/pedagogy-patterns.md` | Writing or rewriting any teaching content; choosing analogies; fixing "hard to follow" feedback |
| `references/module-structure.md` | Planning a module, sequencing units, fixing navigation/entry confusion, naming things |
| `references/assessment-design.md` | Writing predictions, quiz items, distractors, transfer items; auditing for leakage or cueing |
| `references/clinical-content.md` | Any claim, number, term, safety topic, or model-boundary statement |
| `references/review-rubric.md` | The final pass on any unit or module before it ships |
