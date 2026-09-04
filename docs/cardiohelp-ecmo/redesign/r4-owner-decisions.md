# R4 — owner decisions

The four decisions the owner took on 2026-09-03 before the R4 flow rebuild started, what each one
changed about the protected contracts of `r0-redesign-baseline-decision.md`, and the smaller
decisions the implementation took under them. The approved plan is the package's scope statement;
this file is the record of authority.

Base: `origin/main` at `42dcea42` (R3 = PR #117, R0–R2 ancestors). Branch `claude/ecmo-9-3`.

---

## The four owner decisions, as taken

### R4-OD-1 — Engine and scoring: fix everything, including the model

**D-4 of the baseline decision is lifted** for exactly these recorded defects and nothing else:
B6-001, B6-002, B6-003, B6-004, B6-005, B6-006, B6-007, B6-012 and B6-015. For every other
contract D-4 names — routes and query names, identifiers, the progress key and envelope, publication
status, evidence and threshold policy — D-4 stands unchanged. What each lifted item became is in
[`r4-scoring-honesty-record.md`](./r4-scoring-honesty-record.md).

Consequence accepted with the decision: the engine's response behaviour changed in ways a learner
can see (the membrane's outlet saturation now falls with a stopped sweep; a recognised state no
longer heals itself; the patient no longer moves at an unchanged clock), so the next human round
declares a new baseline under D-5 rather than comparing against `2f26cb76`.

### R4-OD-2 — Drill teaching: data-driven Explain for all twenty drills

Every drill's Explain step is rendered from its scenario debrief, its prediction item's rationales,
its localization-grammar row and its control-panel knob strip (`content/drillSpecs.ts`). The six
bespoke pilot panels remain as deeper content behind the same step. Draft PR #94 stays held; B6
owner decision OD-01 is unchanged.

### R4-OD-3 — Shell: an ECMO-specific lean shell

Built inside the ECMO feature (`components/shell/`, `components/stage/`,
`components/practice/`). The shared critical-care `ActivityShell` family and the other labs are
untouched; the stage reuses the frame's `data-critical-care-activity-shell` sizing attribute rather
than editing `ModuleFrameV2`. The patient-context bar of the shared activity contract is replaced on
this module by the context strip, the monitor surface and the footer line — a recorded deviation
from that contract, taken for this module only.

### R4-OD-4 — New content: the core set

The three-controls moment on `blood-flow-versus-sweep`, a blood-flow-versus-sweep story-problem
pair, presentation-named titles with discrimination objectives across the ladder and the cases, and
rationales for every reassessment option. Two-minute micro-cases after each mechanism are deferred
to a later package, along with Practice cases for the three VA drills whose unit has none.

---

## Decisions taken during implementation, under the four above

- **Recognize, not Orient.** The stage's first phase is named `Recognize` on every lab; the ECMO
  module does not keep a private vocabulary for the same act.
- **Drills opened at `?phase=predict` or later clamp to the prediction step** and show the
  restoration note. Only `recognize` and `predict` are honoured on mount; commitment is never
  persisted.
- **Foundation steps are Continue-gated forward, review-only backward, and `act` requires no
  interaction.** Completed rows re-expand as read-only recaps; "Restart section" remounts.
- **The gas panel shows set versus delivered sweep before commitment** and the word
  "interrupted" appears only inside the revealed localization row. This resolves the OD-02 reviewer
  disagreement in favour of the deny list, and the console alarm text follows it.
- **Transfer steps keep the next-scenario chain under one constant title** ("Transfer: carry the
  reasoning to a new circuit") with a presentation-only instruction; the chains whose instruction
  cannot avoid naming the fix are labelled as scaffolded worked examples. Learn is never scored,
  so nothing is laundered.
- **The capstone stays open.** No gating was added; prerequisites are listed by name where the
  Challenge is shown (OD-13 remainder resolved).
- **Practice's Manage stage completes when the case's required work is done** — the corrective
  fault resolved and, for a clinical case, every required intervention applied and support running
  when the case starts ECMO — not at the first corrected fault. An initiation case's readiness
  check no longer ends a stage the learner is still working in.
- **The Challenge teaching-notes checkbox is retired.** Challenge defers routine notes to the
  debrief without a toggle; the coaching toggle lives under Case options in Practice only.
- **Presentation titles apply everywhere before the debrief**, including the picker, the saved-work
  link, the hub and landing accordion, the Next links and the Learn completion card. The scenario
  title — the diagnosis — returns in the debrief.
- **Case objectives render only in the debrief** until their discrimination rewrite is reviewed;
  they were rewritten in I5 and stay post-reveal.
- **Two operable control labels remain disclosed by design** and are owner decisions left open:
  the circuit panel's "Perform tip-to-tip circuit and sensor check" (a bedside control's bedside
  name, pinned by `orientation-startup-state.test.tsx`) and the gas panel's "Restore verified gas
  source" (appears only while the source is down; the transfer into that drill is already a
  labelled worked example). The rendered leak scan lists both explicitly and fails if either stops
  firing, so a future decision cannot be forgotten.
- **All new and reworded items carry `reviewStatus: 'draft'`** for subject-matter review before
  the next human round. Nothing here is credit-eligible.

## Not re-litigated

Decisions recorded in R0–R3 (the canonical seventeen-section order, the index-six console rule, the
one-integration-last rule, the 4/3/3 shared/VV/VA split, the walk's six stops and its bounded
speed step) were consumed, not reopened.

---

# The 2026-09-04 owner review round

Five findings from the owner's own walk through the rebuilt first foundation section
(`why-extracorporeal-support`), taken as decisions. What shipped against each is in
[`r4-owner-review-record.md`](./r4-owner-review-record.md); the vocabulary table is in
[`r4-language-record.md`](./r4-language-record.md).

## R4-OD-5 — A verdict says whether the answer was right

Quoted: "When a user gets question right or wrong it should more explicitly say if it was correct or
not."

**This relaxes a publication guard, and the relaxation is bounded.** `learnerCopyReviewTerms` in
`learning-module/activity/clinicalLearningItem.ts` banned "correct", "incorrect" and "wrong"
alongside the examination vocabulary, and `mechanical-ventilation/__tests__/lesson-answer-verdict.test.tsx`
existed to stop a shared verdict from saying "Correct". That test was right to exist and was not
edited to accept the new copy. The rule was split instead:

- **`gradingTerms` stays banned everywhere** — score, points, grade, percent, pass, fail, mastery,
  exam, quiz, assessment, certification, competency. This module is `draft`, unlisted and not
  credit-eligible, and a card that talks about a score asserts something the module is in no
  position to assert. `flaggedGradingCopyTerms()` is the helper both verdict components are now
  held to, so the exemption cannot widen.
- **`correctnessTerms` stays banned in authored items** — any stem, choice label, rationale or
  explanation. There it is answer leakage.
- **`correctnessTerms` is permitted in a post-commitment verdict.** After a learner has committed,
  naming the outcome is the feedback; withholding it left them inferring from a border colour,
  which is what the owner saw.

`learnerCopyReviewTerms` still composes all three lists in its original order, so every authored-item
check is byte-identical to before.

## R4-OD-6 — An Act step that asks for an action must offer one

Quoted: "This one says 'ACT' and to select the terms but there isn't anything to select… Shouldn't
it allow the user to move the different slide bars?"

Both halves are accepted. The step gains a real answer surface (`content/deliveryAttribution.ts`,
four proposed bedside changes attributed to the component each acts on, committed as a set) and a
real instrument (`OxygenDeliveryExplorer`, three live controls). The section's `requiredAction` now
describes what the learner does rather than what the framework calls it.

The explorer shows no target delivery, no adequacy verdict and no coloured zone, and no point on
any scale is marked. That is the no-invented-threshold rule, not a limitation of the build.

## R4-OD-7 — A step that shows the same thing is not a step

Quoted: "We have had four steps but nothing has changed… it basically is just saying to read the
same thing four times."

Teaching blocks now declare the steps they are the focus of and fold to their heading elsewhere.
Nothing already read becomes unreachable, and outside a stage every block renders, so the offline
render harness and the panel tests still see all 16 panels and 83 states.

## R4-OD-8 — Back, without restarting

Quoted: "We should allow the user to go back to previous steps without having to restart from the
beginning."

Granted with one constraint the implementation discovered and the audit confirmed independently.
Entering a step loads the state that step's copy is written against, so making the progress rows
navigate would silently discard an evolved case on the sections whose later steps carry a variant —
the restore-then-act defect class the whole foundation-session suite exists to prevent, arriving
through a new door. Back is therefore its own control on the Now card, and the rows stay
review-in-place.

## R4-OD-9 — The framework's vocabulary is not the learner's

Quoted: "The language… runs through the entire module." The owner's verbatim rewrites were applied
as given. The audit that followed found 182 further instances across 40 files and one shared
registry; 167 were applied, 11 were overruled on claim grounds, and 2 were left as owner decisions.
See [`r4-language-record.md`](./r4-language-record.md).

## Physiology-audit decisions taken under R4-OD-1

An independent physiology pass on the new arithmetic surfaces raised two items that are decisions
rather than fixes:

- **The engine adds native cardiac output to recirculation-adjusted circuit flow in VA** to get the
  systemic flow its oxygen balance uses (`engine/simulation.ts`), which is the exact addition
  `content/ecmoValueGuides.ts` twice tells the learner never to make. The explorer does **not**
  resolve this by adopting the sum: it uses the patient's own cardiac output, names it as such, and
  its model boundary says the two are not added here. Reconciling the engine with its own value
  guide is a new defect for the next round, not a silent change now.
- **`bounded-educational-model` gained a `supports` entry** for the oxygen content and delivery
  arithmetic. No record in this registry states an oxygen-content equation, so citing the model's
  own record for its own arithmetic was resolvable-but-not-supporting until the entry existed.
