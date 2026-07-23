# Critical-care activity contract

## Navigation grammar

Every migrated module uses:

```text
Overview | Learn | Practice | Assess
```

Every interactive activity presents six semantic phases:

```text
Recognize → Predict → Act → Observe → Explain → Transfer
```

These are presentation semantics. Existing reducer actions and clinical engine state names remain
unchanged.

At every point the learner must be able to answer:

1. Where am I?
2. What am I expected to do?
3. What happens next?

## Activity definition

Each catalog item has a stable ID, module, title, description, kind, supported modes, route/query,
pathways, competencies, prerequisites, estimated effort, difficulty, completion/mastery rules,
assets, review status, and evidence IDs. Released activities require evidence. Assessments require
a mastery rule. Referenced assets and competencies must resolve.

Modes are:

- **Guided:** one objective, prediction before response, scoped controls, structured hints,
  immediate explanation, and transfer variation.
- **Practice:** full appropriate controls, optional hints, history, safe reset/checkpoint, and a
  causal debrief.
- **Challenge:** minimal prompting, masked cues, no automatic hints, and existing mastery/critical
  error rules.

## Explicit completion

An activity is not complete merely because its route was opened. Its named completion rule must be
satisfied. Depending on the activity, this includes prediction submission, required simulator
action, response interpretation, debrief review, and transfer completion.

Normalized statuses are `not-started`, `in-progress`, `completed`, and `mastered`. Legacy adapters
may only infer states supported by the source store; they must not invent phase completion or
mastery.

`Transfer` is earned only by an authored variation, remediation, or next-context action. Revealing
a debrief or displaying transfer-oriented prose does not advance the stepper or emit transfer
completion. A mature legacy workflow whose preserved scoring currently completes at debrief stays
oriented at `Explain`; adding a new transfer gate would require separately reviewed content and
completion-rule changes.

## Simulation workspace

Desktop active simulations use a fixed application workspace:

- persistent orientation header with activity, phase, progress, Save & exit, and Help;
- persistent patient context;
- stable simulation viewport;
- predictable current-task panel and primary action;
- internally scrolling panels instead of document scrolling;
- bottom surfaces for timeline, trends, explanation, reference, and reset/checkpoint.

Controls must not move after interaction. Safety-critical indicators are never hidden. Guided mode
may dim irrelevant controls with an explanation; it may not alter device behavior.

Small screens show a launch gate for desktop-optimized or heavy activities. The gate states the
recommended viewport, approximate bandwidth class, lightweight alternative, Save for later, and a
safe continue option.

## Shared debrief

Debriefs use a consistent sequence:

1. learner clinical model and prediction;
2. clinically meaningful action timeline;
3. action → immediate effect → delayed effect → patient consequence;
4. existing performance domains;
5. small remediation link for each missed competency;
6. one prominent transfer activity;
7. optional deterministic checkpoint/counterfactual replay.

## Accessibility

- All controls and drawers are keyboard reachable with visible focus.
- Status and alarm meaning never relies on color alone.
- Waveform, 3D, circuit, and chart content has a textual equivalent.
- Reduced motion preserves meaning.
- Mobile, tablet, 200% zoom, and 320-pixel reflow remain usable.
- Assessment masking must not remove accessible orientation or safety information.

## Safety and privacy

Visible education-only and model-limit language remains present in every simulation and device
activity. No activity may imply universal device superiority, patient-specific advice, or
institutional protocol fidelity.

Analytics and synchronized progress accept bounded IDs, enums, counts, durations, scores, and
category/no-result events only. They reject free text, PHI, synthetic patient truth, waveform
arrays, detailed settings/commands, and replay payloads.
