# Novice think-aloud — superseded by the B5 validation packet

**This file is no longer the protocol.** It was written alongside the B3/B4 vertical slice as a
first draft of a think-aloud script. B5 replaced it with a full packet, and the packet is
authoritative. Run sessions from those files, not from this one.

**Status of human validation: not started.** No think-aloud session has been run against this
slice, by this script or by the packet that replaced it.

## Where the protocol lives now

| Document                                                                                                           | Use it for                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`validation/b5-novice-think-aloud-facilitator-guide.md`](./validation/b5-novice-think-aloud-facilitator-guide.md) | Setup, recruitment, standardized introduction, prompting rules, the no-coaching boundary, expected observations, stopping criteria, debrief. **Facilitator only.** |
| [`validation/b5-novice-participant-tasks.md`](./validation/b5-novice-participant-tasks.md)                         | The six tasks, as the participant sees them. Contains no answers.                                                                                                  |
| [`validation/b5-novice-observation-form.md`](./validation/b5-novice-observation-form.md)                           | One per participant.                                                                                                                                               |
| [`validation/b5-novice-scoring-rubric.md`](./validation/b5-novice-scoring-rubric.md)                               | Outcome codes, failure classes, severity.                                                                                                                          |
| [`validation/b5-novice-findings-template.md`](./validation/b5-novice-findings-template.md)                         | Where human findings are recorded. Currently empty.                                                                                                                |
| [`validation/b5-vertical-slice-validation-matrix.md`](./validation/b5-vertical-slice-validation-matrix.md)         | What the automated and browser preflight covered.                                                                                                                  |
| [`validation/b5-vertical-slice-validation-summary.md`](./validation/b5-vertical-slice-validation-summary.md)       | What that preflight found and what was fixed.                                                                                                                      |

## What was being tested (unchanged)

The guided ECMO drill **Learn** route as three panes — live simulator · teaching · current task —
and six of the twenty drills given a live teaching panel: `startup-sensor-orientation`,
`preload-drainage-collapse`, `vv-recirculation`, `gas-source-interruption`, `arterial-bubble-stop`,
`va-differential-hypoxemia`.

Out of scope then and now: Practice, Assess, the foundation lesson panels, and the fourteen drills
that have no panel yet.

## Two corrections this draft carried

Recorded here because they were wrong in this file and are right in the packet:

1. **Sign-in is not required.** This draft told the facilitator to have the participant's account
   ready. The module is reachable by direct link as unlisted tester access and keeps lesson history
   in the participant's own browser. Setting up an account — or signing in as the facilitator —
   would attach the participant's exploration to someone's record for no reason.

2. **Precommit leakage was not "structurally impossible".** This draft told the facilitator that a
   participant reading the mechanism before committing was a bug report rather than a finding. The
   drill panel's mechanism, fitting response and harmful reflex are gated on the engine's commitment
   flag — but the lesson objectives, the titles of later steps, the previous step's rationale, and
   some of the panel model boundaries were not gated, and three of them stated the authored answer.
   B5 fixed those and widened the guard; the packet no longer tells a facilitator to discount what
   they see.
