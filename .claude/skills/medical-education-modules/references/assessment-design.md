# Assessment design

How to write predictions, quiz items, transfer items, and micro-cases that measure reasoning
instead of label-matching — and how to keep the answers from leaking into the scaffolding. The two
reliable failure modes of AI-authored assessment are **leakage** (the answer is visible before the
commit) and **cueing** (position, length, or wording gives it away). Both make success data
meaningless while looking like rigor.

## Item anatomy

- **Stem = a clinical decision, not recall.** "Flow is falling and the inlet pressure is more
  negative — what should happen first?" not "What is the normal venous pressure?" If the stem can
  be answered without the vignette, it's recall wearing a costume.
- **The best choice** encodes the target reasoning, not just the target action ("ease pump demand
  *then* find the cause" — the ordering is the concept).
- **Distractors are documented wrong mental models**, each one a move a real learner makes:
  chase the displayed number (raise RPM for falling flow), use the wrong axis (raise sweep for
  hypoxemia), treat a setpoint as delivery (turn up a disconnected sweep), distrust the sensor
  instead of the physiology, act on one number (exchange a membrane for an isolated gradient).
  Source distractors from instructor experience, sim-lab debriefs, or the module's own recorded
  misconception list — never pad with implausible fillers to reach four options.
- **Every choice gets its own rationale**, written to repair the specific misconception, shown
  only after commitment.
- **The harmful reflex is a first-class field**: name the tempting unsafe move for this scenario.
  It must appear among the choices, its rationale must explain the harm mechanism, and (critical)
  the simulation and scoring must not reward it — see "Scoring honesty."

## Predict → commit → reveal

- The learner commits before any mechanism, verdict, or best-move content is visible. Commitment
  is a state the interface tracks, and postcommit content is gated on it — not merely placed
  lower on the page.
- After reveal: show the live/authored consequence of their chosen action where a sim exists,
  then the verdict, then the rationale set. A wrong prediction followed by correct later actions
  is *remediation*, not mastery of the original decision — never let later actions overwrite the
  committed prediction's credit.

## The leakage contract

Audit every surface visible pre-commit against this deny list. Titles and objectives are the top
offenders; navigation is second.

Pre-commit surfaces may NOT contain:
- The diagnosis or fault name ("drainage collapse," "recirculation") — name the *presentation*
  instead ("falling flow with a juddering line").
- The causal chain or mechanism.
- The best action or its direction ("reduce speed before…").
- The harmful reflex by name ("avoid escalating RPM" states the answer's complement).
- Uniquely identifying state labels (a status chip reading "Gas source: Interrupted" answers the
  question the drill is asking).
- Later-step titles in a step navigator ("Step 4: Correct the recirculation cause"). Unreached
  steps show phase and number only.
- The previous unit's transfer teaser, if it names this unit's mechanism.

Objectives are written as discriminations ("decide whether falling flow is caused upstream or
downstream") — the skill, never the answer. When scaffolding is *intended* to disclose (a worked
example), say so explicitly and exclude that item from mastery credit.

Run the leakage audit as its own pass with the deny list in hand; authors do not catch their own
leaks inline, reliably.

## Anti-cueing mechanics

- **Position**: the correct answer's position varies across the item set (shuffle with stable
  choice ids, or balance deterministically). "Best answer always first" is the most common
  AI-authoring artifact and learners find it within five items.
- **Length**: the best choice must not be systematically the longest. Trim rationale-sounding
  qualifiers out of the correct option or lengthen a distractor with equally specific (wrong)
  reasoning.
- **Grammar/specificity**: all options complete the stem grammatically; distractors are as
  concrete as the key (vague distractors cue by contrast).
- **Convergence**: avoid options that pair into opposites where one is obviously extreme; avoid
  "all/none of the above."

## Transfer items

Transfer = the same principle in a *different situation*, not the same stem with nouns swapped. A
learner who understood the delivery ledger should reach a content problem from a flow problem; a
learner who memorized the first answer should not. Write the transfer's surface features
(setting, device, signal names) deliberately far from the teaching example, and keep the deep
structure identical. If a transfer item can be answered by pattern-matching the teaching example's
wording, rewrite it.

## Micro-cases vs full cases

- **Micro-case** (in Learn, right after a mechanism): 3–5 signal values — ideally the same triad
  every time for that mechanism, so the triad itself is trained — one decision, committed answer,
  two-sentence debrief. Two minutes.
- **Full case** (Practice): multi-step, scored, reassessment loop, paired to its Learn mechanism.
  Opens with an ungated clinical context (history, orders); the leakage rules still apply to the
  fault identity.
- Both inherit anti-cueing mechanics. Full cases add: a reassessment step after every
  intervention (the loop *is* the content), and score weights that make cause-identification
  worth more than knob manipulation.

## Scoring honesty

Scoring is part of the teaching; a scoring rule that contradicts the copy teaches the
contradiction.

- An action the copy calls unsafe (slowing the pump to stretch battery; resetting before
  isolating; skipping a required safety step) maps to a critical error or a mastery block — never
  to silent full credit. Write the negative-path test at the same time as the scenario: drive the
  unsafe path end-to-end and assert it cannot terminate in mastery.
- Safety-critical steps must be *required by the state machine*, not merely by the guided text —
  a learner (or an agent) who finds the ungated path has found a defect, and the guided order is
  not a guard.
- Mastery claims are conservative: completion ≠ mastery; scaffolded completion ≠ unscaffolded
  competence; and a wholly wrong committed plan cannot be laundered into mastery by subsequent
  correct clicking.
- Simulated consequences are truthful in *time* as well as direction: patient physiology changes
  only when simulated time elapses, never as an instantaneous side effect of a UI action, or the
  learner attributes the change to the click.

## Item QA sweep (run per item set)

1. Cover the options; can the stem be answered from pre-commit surfaces alone? → leakage.
2. Answer every item choosing "first option" then "longest option"; score above chance → cueing.
3. For each distractor, name the real misconception it represents; can't → replace it.
4. Drive each scenario's harmful reflex to completion; check the score and the patient response.
5. Read every objective; any that states an action or mechanism gets rewritten as a
   discrimination.
