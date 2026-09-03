# Pre-ship review rubric

Run this as a distinct pass over any unit or module before delivering it — after authoring, with
the checklist in hand, ideally against the *rendered* content rather than the source files.
Authors do not catch their own leaks, cueing, or scoring contradictions inline; that is not a
character flaw, it is why this pass exists.

Severity scale: **P0** active safety or causal contradiction · **P1** answer leakage or inability
to complete the intended task · **P2** sequencing/observability/cognitive-load problem ·
**P3** clarity, density, accessibility, polish.

Report findings with: failure class, location, reproduction (what you looked at or drove), the
educational harm, and the proposed fix. A finding without a location is an opinion.

## 1. Causal and content contradictions (P0)

- [ ] Every stated cause→effect matches what the simulation/engine actually does. Drive it:
      if the copy says flow falls as speed rises past the drainage limit, sweep the speeds and
      confirm the direction. Copy written from intention rather than behavior is the top P0
      source.
- [ ] No simulated improvement from assessment/escalation/documentation alone
      (recognition ≠ treatment).
- [ ] No benefit shown for an action the copy calls unsafe.
- [ ] Patient physiology changes only with elapsed simulated time, never as an instantaneous
      side effect of a UI action.
- [ ] Numbers agree with themselves across surfaces (a threshold described in two places is
      described identically, with both of its conditions).

## 2. Answer leakage (P1)

Work with the deny list from `assessment-design.md`:

- [ ] Cover the choices; attempt each prediction from pre-commit surfaces alone (title,
      objectives, step navigator, status labels, prior unit's transfer teaser). Any success is a
      leak.
- [ ] Objectives name discriminations, not actions or mechanisms.
- [ ] Unreached steps show phase/number only.
- [ ] State labels visible pre-commit do not uniquely identify the fault.
- [ ] Model-boundary text names what is omitted, not the withheld mechanism.

## 3. Assessment cueing and validity (P1)

- [ ] Correct-answer position varies across the item set; "first option" strategy scores ~chance.
- [ ] Best choice is not systematically the longest; "longest option" strategy scores ~chance.
- [ ] Every distractor maps to a nameable real misconception.
- [ ] Transfer items are different situations, not re-nouned stems.

## 4. Scoring and safety honesty (P0–P1)

- [ ] Drive each scenario's harmful reflex end-to-end: it cannot terminate in full credit or
      mastery.
- [ ] Required safety steps are enforced by the state machine, not only by guided text — try to
      skip them.
- [ ] A wrong committed prediction cannot be overwritten into mastery by later actions.
- [ ] Capstone/mastery unlock criteria match what the copy tells the learner they are.

## 5. Sequencing and prerequisite closure (P2)

- [ ] Build the prerequisite graph: every concept a unit uses points to an earlier unit that
      taught it. No forward references, no orphans.
- [ ] One new concept per unit; units carrying two are flagged for a split.
- [ ] Normal state precedes every failure mode; the spine walk precedes the first use of any
      located term.
- [ ] Track-shared foundations are shared, not copied; second-track repeats lead with what is
      different.

## 6. Navigation and counts (P2)

- [ ] One primary entry CTA per surface, all resolving through the same next-incomplete-unit
      function; fresh learner lands on unit 1 of the canonical order.
- [ ] All displayed counts derive from the registry; recompute them and compare.
- [ ] Grouped and linear views flatten to the identical order; every unit appears exactly once.
- [ ] Learn→Practice CTAs resolve to mechanism matches, or their copy says "next case in this
      unit."
- [ ] Vocabulary check: one term per concept across hub, landing, rail, buttons, breadcrumbs.

## 7. Clinical accuracy and register (P0–P2)

- [ ] Every claim has an assignable class and source (`clinical-content.md` table); institution
      practice and authored constructs are labeled as such to the learner.
- [ ] No invented thresholds; every numeric band carries source + variation note; trend skill
      leads.
- [ ] Terminology is current-society-primary with legacy terms retired once; label/anatomy traps
      defused at first use.
- [ ] Source disagreements rendered as disagreements, not averaged away.
- [ ] Safety-critical choreography defers to IFU/local protocol unless source-authorized.

## 8. Copy density and voice (P3)

- [ ] Prose units ≤6 min; paragraphs ≤4 sentences; analogy→checklist→application shape present
      for mechanical concepts.
- [ ] Objectives ≤2 lines; checklists ≤4 items; one vignette max per unit, flagged as
      constructed.
- [ ] Plain-name-first on first use of every label; consistent thereafter.
- [ ] Reading level appropriate to the stated learner; jargon introduced before used.

## 9. Accessibility and rendering (P3, promote to P1 on human-test-ready content)

- [ ] Keyboard-only pass: reach every tab, pane, scroller, and control; focus visible.
- [ ] Smallest supported viewport: zero clipped elements, no fourth nested scroller, simulated-
      values badges visible.
- [ ] No meaning carried by color alone; units on every value, visually and to screen readers.

## Output format

Deliver the review as a table (finding · class · severity · location · reproduction · proposed
fix), followed by a short list of items requiring an owner decision (anything touching frozen
content, scoring contracts, or model versions). Fix-forward what is in scope; do not silently
expand scope to fix what is not.
