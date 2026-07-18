# Baxter CRRT v1 accessibility requirements

Accessibility is part of the v1 implementation and private validation, not a staged activation
gate.

## Required behavior

- All actions are native buttons, links, selects, radios, checkboxes, inputs, or equivalent semantic
  controls with visible focus.
- Learning-experience tabs and mobile surface tabs use correct tab/tabpanel relationships, roving
  arrow-key navigation, Home/End behavior, and focus restoration.
- Stop/end dialogs move focus in and return it to the invoking control.
- Targets are at least 44 by 44 CSS pixels where the control is safety-relevant or touch-oriented.
- Patient, machine, circuit, pressure, trend, fluid, and alarm visuals have text equivalents.
- Global alarm state remains available when another mobile panel is active.
- Status changes use appropriate live regions without repeated or competing announcements.
- Color, motion, and sound are never the only carriers of meaning.
- `prefers-reduced-motion` suppresses nonessential animation.
- Content remains usable at 200% zoom, 320 CSS pixels, and tablet widths without two-dimensional
  page scrolling; intentionally scrollable tables are labeled and keyboard reachable.
- Reviewed-English fallback is explicit on non-English routes and clinical/device copy is excluded
  from automatic handoff translation.

## Verification checklist

- [ ] Complete both protected routes with keyboard only.
- [ ] Verify tab order, arrow navigation, focus visibility, and dialog focus return.
- [ ] Inspect accessible names/descriptions for case, device, drill, tool, and citrate controls.
- [ ] Read alarm, circuit, pressure, trend, fluid, score, and debrief summaries with a screen reader.
- [ ] Confirm no hidden active alarm when switching the five mobile tabs.
- [ ] Test 200% browser zoom and 320-pixel reflow.
- [ ] Test representative tablet portrait and landscape widths.
- [ ] Enable reduced motion and confirm no information is lost.
- [ ] Confirm all critical/touch targets meet 44-pixel sizing.
- [ ] Confirm preview mode remains fully operable while writing no progress or telemetry.

Findings belong in the ordinary implementation backlog or final SME feedback. No signature,
attestation, candidate hash, or activation authorization is required.
