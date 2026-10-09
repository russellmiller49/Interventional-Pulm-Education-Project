# Teaching-first rules for learner-facing modules

Owner direction, 2026-10-08 (Russell Miller), after the beta learner-experience audit.

These modules teach supervised fellows. They are not guidelines, order sets or instructions for
use. Between August and October 2026 the review and release rules made withholding the default:
numbers were removed, answers deferred to "local policy", and a boundary note was added to almost
every screen. This page replaces those rules. Where an older handoff, checklist, decision packet or
skill says otherwise, this page wins.

It applies to every agent that writes, edits or reviews learner-facing content in this repository,
and its charter goes into every review or acceptance prompt for such a module.

## Reviewer charter

1. This module teaches supervised fellows. It is not a guideline, order set or IFU. Review it as a
   fellowship educator would.
2. Report two lists with equal weight:
   - (A) Is it wrong? A factual error, a simulator and copy contradiction, an unsafe action rewarded.
   - (B) Is it taught? A missing concept, number, sequence, image or feedback.

   A P1 teaching gap blocks like a P1 error.

3. A withheld guideline-, consensus- or IFU-class number that a decision depends on is a (B)
   defect. Fix it by stating the number with source, year and grade. Where sources differ, show
   both. "Check local protocol" may follow a number, never replace it.
4. Prefer making the copy or the model true over deleting the claim. Every remove or qualify fix
   names what the learner no longer learns and proposes the replacement teaching.
5. One boundary statement per module, on the hub and the closing screen. A model-limit note only
   where a learner could mistake a simulated value for a real one.
6. Review status (NOT REVIEWED, draft, hold, authored, synthetic) is project metadata. Track it in
   packets; never render it to learners.
7. Caveat budget: each added caveat, hold or deferral names the wrong action a fellow would
   otherwise take. More than three per review needs owner sign-off. Also list caveats that can now
   be deleted.
8. Copy checks are lint, not verdicts. Never rewrite clinical content to pass a vocabulary, digit
   or % check. Report the false positive.
9. Escalate a simplification to a safety finding only if a fellow following it under supervision
   could harm a patient.
10. End every review with "Top 3 teaching improvements". A review with no (B) findings is
    incomplete.
11. Recorded owner decisions win. Report conflicts as notes, not blockers.

## Authoring rules

**Numbers.** Where a guideline, consensus statement or the device's instructions give a number that
a decision depends on, teach the number. An agent may add one without waiting for a reviewer when
it records, in the module's numbers register (`src/features/learning-module/numbers`):

- the value and what it applies to;
- its class: guideline, consensus, expert-reference, device, physiology or teaching-convention;
- the source, its year, and the source's own grade where it prints one;
- where in the source it was found, and the date it was checked.

The number then renders as ordinary teaching. It is never labelled to the learner as pending,
draft or unreviewed. The owner clears the sign-off list weekly: `npm run numbers:signoff` prints
every row that is not yet signed. A row the owner rejects is corrected or removed in that pass.

**Sources that differ.** Show both values and say which source gives which.

**Local practice.** "Your unit may set this differently" may follow a number once per topic. It
never replaces the number.

**First moves.** A question about a deteriorating patient is keyed on the first thing the fellow
does with their hands, in order. "Call for help" belongs in the sequence; it is not the answer on
its own.

**Boundaries.** One statement per module that it is a teaching simulator, on the hub and the
closing screen. A note about a model limit only where a learner could take a simulated value for a
real one. When the model is wrong, fix the model before explaining the error in the copy.

**Project metadata.** Review status, packet identifiers, authoring notes and the words
"synthetic", "authored" and "NOT REVIEWED" stay in packets and the tester note.

**Decision packets.** Draft each option with its teaching consequence. Do not mark the most
conservative option as the applied default. Where a sourced number exists, the recommended option
is to teach it.

## What the code checks now

| Check                                    | Before                                              | Now                                                                                                |
| ---------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Shared vocabulary gate                   | Refused `%`, "percent", "test", "assessment"        | Those four are allowed. Scoring words ("score", "points", "grade", "pass", "mastery") stay refused |
| MCS, ECMO, ICU Hemodynamics learner copy | Refused any digit and any "keep … below N" phrasing | Digits allowed. The module's register is validated instead: every row carries a source             |
| Tests that required hedge wording        | Failed if the hedge was removed                     | Replaced by tests that the module's numbers carry a class, source and check date                   |

Answer-leak checks are unchanged: an authored stem, option or rationale still may not say
"correct", "incorrect" or "wrong".

## Release gate

Gate 3 of `docs/gap-remediation/beta-finish-line.md` now reads: the tester note lists every
remaining hold; a label inside the module is required only where a learner could take a wrong
clinical action because of the hold.
