# Baxter CRRT accessibility requirements

Accessibility is part of the implementation and SME review, not a runtime activation gate.

## Required behavior

- Overview, Learn, Practice, and Assess are semantic links with the current page identified.
- The case player's four tabs have correct tab/tabpanel relationships, roving arrow navigation,
  Home/End behavior, linked IDs, and visible focus.
- Actions use native buttons, links, selects, radios, checkboxes, inputs, or equivalent semantics.
- Touch-oriented controls provide at least 44 CSS pixels of target height.
- Patient, machine, circuit, pressure, trend, fluid, alarm, score, and debrief visuals have text
  equivalents; status changes use appropriate live regions.
- Color and motion are never the sole carriers of meaning, and `prefers-reduced-motion` suppresses
  nonessential animation.
- Content remains usable at 200% zoom, 320 CSS pixels, and tablet widths without document-level
  two-dimensional scrolling.
- Non-English routes show an explicit reviewed-English fallback and exclude clinical/device copy
  from automatic handoff translation.

## Verification checklist

- [ ] Traverse all four routes and complete a Practice case with keyboard only.
- [ ] Verify module navigation, case-tab arrow navigation, focus visibility, and focus return.
- [ ] Inspect accessible names for the role lens, core picker, optional cases, PrisMax controls,
      drills, both labs, assessment gate, and debrief.
- [ ] Read circuit, pressure, trend, fluid, alarm, score, and source summaries with a screen reader.
- [ ] Test 200% browser zoom, 320-pixel reflow, and representative tablet widths.
- [ ] Enable reduced motion and confirm that no information is lost.
- [ ] Confirm safety-relevant and touch targets meet the 44-pixel requirement.

Findings belong in the implementation backlog or final SME feedback. No signature, attestation,
candidate hash, or activation authorization is required.
