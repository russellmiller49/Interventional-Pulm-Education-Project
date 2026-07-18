# Baxter CRRT v1 final SME feedback checklist

Purpose: gather concrete feedback on the complete protected v1 before public release. This is a
lightweight review aid, not an approval form, signed attestation, activation record, or competency
decision. The entire module remains runnable during review.

Build version: record the version displayed on `/[locale]/baxter-crrt/review`  
Reviewer perspective (optional): nephrology / critical care / CRRT nursing / device training /
pharmacy / nutrition / education / accessibility / other

## Review prompts

- [ ] The professional-education boundary and lack of institutional configuration claim are clear.
- [ ] Patient, circuit, delivery, and device relationships are clinically coherent for education.
- [ ] Each sampled case has a defensible safe path, accepted alternative, unsafe path, timed
      response, reassessment, and causal debrief.
- [ ] Educational critical-error rules are proportionate and do not punish accepted alternatives.
- [ ] PrisMax navigation, vocabulary, calculations, alarms, interruption, and stop/end framing are
      faithful to the stated AW8035 Rev B manual-reference scope.
- [ ] Prismaflex navigation, four-scale layout, calculation contexts, alarm/help behavior, and
      stop/end framing are faithful to the stated G5036003 scope.
- [ ] Cross-device content teaches translation without implying interchangeability.
- [ ] Wrong-solution and blood-disposition drills stop at verification, escalation, device
      instructions, and local policy.
- [ ] Citrate-calcium content is recognition/checks/reassessment/escalation only, with no actionable
      medication amount, target, or adjustment instruction.
- [ ] Sources and limitations are understandable at the point of use.
- [ ] The module makes no certification or independent competency claim.
- [ ] Keyboard, screen-reader, zoom, reflow, motion, and mobile behavior are usable.

## Feedback format

For each finding, record:

```text
Location or artifact:
Observed issue:
Why it matters:
Suggested correction (if known):
Severity: blocking public release / important / editorial
Source or rationale:
```

After feedback is incorporated, rerun `validation.md`. Changing the release stage to `published`
is a separate explicit user-directed task.
