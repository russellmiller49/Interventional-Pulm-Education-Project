# Bringing the ECMO learner-review fixes to the other critical-care modules

On 2026-09-06 an MD/PhD candidate who had not built the module walked the ECMO Learn pathway and
sent twelve numbered points. Six of them turned out to be one defect wearing different clothes, and
several of the rest are shape defects the sibling modules share because they share the shape.

This brief is the transferable half. The ECMO half is
[`../cardiohelp-ecmo/redesign/r5-learner-review-record.md`](../cardiohelp-ecmo/redesign/r5-learner-review-record.md);
the generalized teaching guidance went into the `medical-education-modules` skill (principle 13 /
pattern P9 "Say where", plus new item-writing rules and a new rubric section).

Read this before starting on a module, then use that module's prompt below.

## Read this first: there are now two stages, and one of them is shared

The mechanical-ventilation flow rebuild (PR #127, merged 2026-09-06) generalized ECMO's lesson stage
into **`src/features/learning-module/stage/`** — `StageLayout`, `NowCard`, `StepList`, `StageBlock`,
`StageTeachingScope`, `SectionsDrawer`, `stageModel` and two stylesheets. MV is its only adopter
today. ECMO still runs its own copy in `src/features/cardiohelp-ecmo/components/stage/`, and the
learner-review fixes landed **there**, so the two have diverged.

Concretely, `learning-module/stage/StageLayout.tsx` is a near-verbatim copy of ECMO's _pre-fix_
layout: same `PANE_LABELS = { primary: 'Simulator', secondary: 'Teaching', tertiary: 'Steps' }`, same
doc comment, no visible pane captions, no width options, and `NowCard` has no slot for a location
line. **Every one of F1, F2, F3 and F6 is present in the shared package, unfixed.**

That makes the ordering obvious:

1. **Fix the shared stage package first.** One change fixes MV and every future adopter, and it is
   the same change already worked out and shipped once in ECMO — port it, do not redesign it.
2. **Then the module-local work** each module needs on top (its own copy, its own items, its own
   device surface).
3. **Then decide about ECMO.** Converging ECMO onto the shared package is the right end state and is
   its own piece of work; it is out of scope for a session doing F1–F12 on a sibling. Until it
   happens, a fix made in one has to be made in the other, and this brief is the record of which
   fixes those are.

## What is already built, and must not be rebuilt

Some of the machinery landed with the ECMO round, below the stage packages, and is shared by both.
A session working on MV, MCS or hemodynamics should use it rather than reinventing it.

`src/features/learning-module/curriculum/ResizableTeachingWorkspace.tsx` (shared by ECMO, MV, MCS —
**not** hemodynamics, which has its own private `ResizablePacWorkspace.tsx`) now takes three optional
props, every one defaulted to the behaviour callers had before:

| Prop                    | What it is for                               | Default                                           |
| ----------------------- | -------------------------------------------- | ------------------------------------------------- |
| `defaultWidthFractions` | opening split, as fractions of usable width  | `{ primary: 0.43, secondary: 0.29 }`              |
| `paneMinimums`          | drag floors in px                            | `{ primary: 340, secondary: 280, tertiary: 300 }` |
| `preferredCompactPane`  | which pane the one-pane compact view follows | none (opens on `primary`, stays put)              |

Two things to know about them:

- The fractions are also emitted as CSS custom properties on the very first render, before the
  measurement lands, so a caller that opens at a non-default split does not paint one frame at 43/29
  and jump. Anything that measures its own pane during that window — a scale-to-fit device
  facsimile — depends on this.
- `preferredCompactPane` is _followed_, not forced. It moves the learner when the step's work moves
  and leaves them wherever they put themselves in between. Do not reach for `activePane`, which
  removes the pane switcher entirely.

`src/features/learning-module/components/ChoiceReasoningFeedback.tsx` now takes an optional `frames`
prop: per-caller replacements for the sentence after the outcome label ("The cues support this
read."), defaulted so every existing caller is untouched.

Which module renders which verdict card decides how much of F10 and F12 it has. `AnswerVerdict`
already carries a "why the other answers do not fit" disclosure; `ChoiceReasoningFeedback` does not:

| Module       | Renders                                | Consequence                                              |
| ------------ | -------------------------------------- | -------------------------------------------------------- |
| MV           | `AnswerVerdict` only                   | F10 already handled; F12 is the frame wording only       |
| MCS          | **both**                               | has ECMO's exact two-vocabularies-in-one-pathway problem |
| Hemodynamics | `AnswerVerdict` only (five call sites) | F10 already handled                                      |
| CRRT         | `ChoiceReasoningFeedback` only         | F10 and F12 both live                                    |
| ICU sim      | neither — it authors no items          | F10/F11/F12 do not apply as stated                       |

## The findings, stated so they transfer

Work through these in order. F1–F3 are one job and should land as one change; doing either half
alone is worse than doing neither, because it creates a name that points at nothing.

**F1 · The panes have no visible names.** Region names that exist only in `aria-label` (plus a tab
row that renders only below the compact threshold) are names no sighted learner can match to an
instruction. Give each region a visible caption saying what it is and what it is for.

**F2 · No step names the pane its work is in.** Author the location as data on the step — region
plus the heading, control group or device surface inside it — and print it under the instruction.
Author it, do not derive it: a derivation is a guess about content, and it will be wrong on the step
that matters. Validate at import that every step has one and that a region's own name is never used
as a landmark inside that region.

**F3 · An instruction names a heading the learner cannot see.** "Review the lesson narrative" while
the heading is ten blocks down an independently scrolling pane. Either bring it to the top at the
step that asks for it, or say where to scroll.

**F4 · A dead device surface does not say it is dead.** A console rendered with its controls
disabled, and nothing saying so, reads as a bug. Put one line on the device itself, driven by the
same flag that disables it so the two cannot drift. Keep it true: check for controls that are _not_
gated on that flag before writing "none of this works".

**F5 · Action controls have no affordance.** Buttons that change the model styled identically to the
radio rows above them, with no hover, focus-visible, active state or min-height.

**F6 · The only control that looks like a control is the one that skips the work.** Where the step's
work is done by buttons and the card offers a bright "Continue" that advances regardless, move the
buttons into the card as its interaction body. Then check the disclosure state on _every_ step whose
instruction refers to them.

**F7 · An unlabelled, markerless short list reads as prose.** Give it a visible label and real
bullets — and author the label per list, not once for the pattern, because a set of lists is rarely
all the same kind of thing.

**F8 · The accessible text equivalent disagrees with the visual.** Where an alternative description
exists it is part of the content: if the visible list gains a heading, the description gains the same
heading. Check whether the equivalent is actually screen-reader-only before assuming nobody sees it.

**F9 · A counter that spans units does not say so.** Two "N of M" readouts on one screen will be
read as one. Say in words that the sequence began earlier and carries on, in the visible copy and in
the live region; do not renumber.

**F10 · The card does not keep the promise the instruction makes.** "Commit, then read why the other
answers do not fit" against a card that shows only the chosen option's rationale. Grep the
instruction copy for promises and check each against what the surface renders.

**F11 · Item-quality defects.** Run the full item sweep in the skill's `assessment-design.md`, and
in particular: a distractor may be wrong but may not be _false_, and its plausibility grade must not
endorse a false clinical claim; every option must be a member of the category the stem names; one
proposition per option; the key must not be the only option that agrees with the vignette.

**F12 · Verdict framing written for a different item type.** Shared feedback wording carries the
vocabulary of whichever module built it. Pass `frames`.

### Two contract questions this raised, for the owner rather than a session

**The "other answers" disclosure is specified for one component and three surfaces use the other.**
`docs/critical-care/activity-contract.md:44-47` says the verdict "offers a disclosure covering why
the other answers do not fit" — written about `AnswerVerdict`, which has it. `:66-68` names
`ChoiceReasoningFeedback` as a separate component with an additive purpose (concept links and
citations), and ECMO foundation, the MCS workbench and CRRT Learn all render _that_ one, which does
not have the disclosure. ECMO fixed it module-side. The question is whether the contract should name
which component carries it, or whether `ChoiceReasoningFeedback` should simply carry it too — at
which point ECMO's module-local version should be retired into it.

**The prediction-answerability clause is being violated in at least two modules.**
`activity-contract.md:70-73`: a prediction step "may not name the expected goal, control or
direction in its title, instruction, rationale, expected response, help text, highlighted control or
button label". Two live instances found by this audit, both airtight:

- MV, `content/learningExperiments.ts:176-179` — the stem is "If a higher cycling threshold ends
  machine inspiration **earlier**, which immediate change should you look for?" and the key is
  "Shorter machine inspiration". The direction is in the stem.
- ICU simulation — the scenario title prints directly above the "Working shock mechanism" select
  (`IcuClinicalPanels.tsx:463`, and again in the always-visible context bar at
  `IcuSimulatorLab.tsx:846`), which is the module's only committed item.

Neither is a layout defect and neither is what the learner reported; both were found by auditing
against the contract while looking for something else. They are worth their own pass.

### Also worth checking, found in ECMO and not fixed there

`X1` a compact width whose default pane hides the step's own answer control · `X2`
`position: sticky` on a card that is a content-sized grid item, so it never sticks · `X3` a per-step
payload the renderer never reads, so every step shows the same full action list · `X4` an action
that resets the record of previously-run actions · `X5` a teaching block not scoped to a phase, so
it stays expanded on every step.

## How to work

1. **Do not start from this brief alone.** Open the ECMO commits first —
   `git log --oneline` for `feat(ecmo): the steps lead…` and the four that follow — and read the
   diffs. They are the worked example.
2. **Audit before changing.** Produce the status of each finding for the module, with file:line
   evidence, before editing anything. Several will not apply; saying so is the right answer.
3. **Respect the recorded decisions.** Each module has records under `docs/critical-care/`. If a fix
   collides with one, amend the record explicitly in the same change rather than editing around it —
   that is what R5-OD-1 did to R4-OD-10.
4. **Land it in chunks that pass.** One commit per finding cluster, full module suite green at each.
5. **Verify in the browser, not only in jest.** The critical-care routes are public-unlisted, so a
   dev server reaches them. A client-side reload may bounce to sign-in; navigate instead.
6. **Re-measure the widths** if you touch the layout. Any module with a recorded width validation
   has to be re-checked at each validated viewport: zero elements overflowing their pane, zero
   document horizontal scroll, and the device pane still the widest if a decision says it should be.
7. **Finish with the rubric**, section 5 in particular — instruction/surface coherence, which this
   round added.

## Per-module prompts

Each is written to be pasted whole into a fresh session in the right worktree. Each begins with an
audit because several findings will not apply and inventing applicability is the failure mode.

### 0 · The shared stage package (do this one first)

```
Read docs/critical-care/learner-review-cross-module-brief.md, then read the five ECMO commits it
names (git log --oneline; the first is "feat(ecmo): the steps lead, and every step says which panel
it is worked in").

Port findings F1, F2, F3 and F6 from ECMO's module-local stage
(src/features/cardiohelp-ecmo/components/stage/) into the SHARED stage package at
src/features/learning-module/stage/, which mechanical-ventilation is the only adopter of today:

- StageLayout.tsx: visible pane captions, and the pane order and width options ECMO settled on.
  Both are decisions, not defaults — do NOT reorder MV's panes without checking
  docs/critical-care/mv-d2-standard-laptop-workspace.md and MV's own pane-order test first, and
  bring the question back with what you find rather than deciding it yourself.
- stageModel.ts StageStep: an optional authored location (region + landmark).
- NowCard.tsx: a slot that renders it under the instruction.
- A shared component to render the location line, and the compact-pane derivation.

Keep every addition optional and defaulted so a caller that passes nothing behaves exactly as it
does now. Land it with tests. Then report what MV would still need on top, without doing it.
```

### 1 · Mechanical ventilation (highest value — it adopted the stage two days ago)

```
Read docs/critical-care/learner-review-cross-module-brief.md and the ECMO commits it names, then
docs/critical-care/mv-flow-rebuild.md and mv-d2-standard-laptop-workspace.md for this module's own
recorded decisions — D2 is about laptop widths and constrains anything you do to the layout.

Audit src/features/mechanical-ventilation against findings F1-F12 and X1-X5 in the brief. Report the
status of each with file:line evidence BEFORE changing anything; several will not apply.

What is already known about this module's shape:
- It renders the shared stage: components/stage/VentilationStageHost.tsx imports StageLayout from
  @/features/learning-module/stage/StageLayout. So F1/F2/F3/F6 are fixed in the shared package
  (see prompt 0) and this module supplies the authored content on top.
- Step instructions are built in content/stageLessons.ts from experiment specs
  (recognizeInstruction, introduction, look, task) rather than authored per phase, so F2's
  "author the location as data on the step" means adding it where those steps are built, and
  auditing each generated sentence for whether it names a surface.
- Nothing pins MV's pane order any more. The rebuild deleted the old learn-workspace test that
  asserted "the live, teaching, action pane order", and no current test reads `data-pane` in this
  module — the only trace of the order is the workspaceLabel string at
  components/stage/VentilationStageHost.tsx:1115 and the shared StageLayout's own markup. So the
  order is changeable without breaking anything, which means it is your judgement to make and to
  record, not a test's.

Then fix, one commit per finding cluster, MV's full suite green at each, and re-measure the widths
D2 validated. Amend the D2 record in the same change if you move any of them.
```

### 2 · Mechanical circulatory support

```
Read docs/critical-care/learner-review-cross-module-brief.md and the ECMO commits it names, then
docs/critical-care/mcs-learn-section-contracts.md and mcs-live-teaching-panels.md.

Audit src/features/mechanical-circulatory-support against F1-F12 and X1-X5, reporting status with
file:line evidence before changing anything.

What is already known:
- components/McsLearnSection.tsx calls ResizableTeachingWorkspace directly (not the shared stage
  package), with paneLabels { primary: 'Live anatomy' | 'Live monitor', secondary: 'Teaching',
  tertiary: <action pane> } — the same three-pane shape ECMO had, so F1 and F2 apply as stated and
  the panes have no visible names.
- Its Learn was taken from the MV branch, so it is worth checking whether adopting the shared stage
  package is cheaper than fixing McsLearnSection in place. Report which, with the reasoning; do not
  start a migration without bringing that back first.
- It renders ChoiceReasoningFeedback, so F10 (does the card show the other answers' rationales when
  an instruction promises them?) and F12 (pass `frames`) are both live.
```

### 3 · ICU hemodynamics

```
Read docs/critical-care/learner-review-cross-module-brief.md and the ECMO commits it names.

Audit src/features/icu-hemodynamics against F1-F12 and X1-X5, reporting status with file:line
evidence before changing anything.

What is already known:
- It does NOT use the shared workspace. components/ResizablePacWorkspace.tsx is its own copy — the
  one the shared ResizableTeachingWorkspace was generalized FROM — with its own preferredMinimums,
  its own COMPACT_WORKSPACE_THRESHOLD_PX, its own compactPane state defaulting to 'monitor', and
  panes named Monitor / Anatomy / Activity. So F1 and the compact-width findings have to be fixed
  in its copy, and the three optional props the shared component now has do not exist here.
- The first question to answer is therefore whether to converge it onto the shared component
  instead of fixing the copy. Weigh what its copy does that the shared one does not (read both in
  full) and report the recommendation with evidence; do not migrate without bringing it back.
- components/CaseWorkflow.tsx defines "working frame", the term F12 says leaks into other modules'
  feedback. Check whether this module's own copy is consistent with it.
```

### 4 · Baxter CRRT and ICU simulation

```
Read docs/critical-care/learner-review-cross-module-brief.md and the ECMO commits it names.

Audit src/features/baxter-crrt (and separately src/features/icu-simulation) against F1-F12 and
X1-X5. Establish the shape of each module's learn surface FIRST — neither calls
ResizableTeachingWorkspace, and CRRT's activity surface is components/CrrtActivityWorkspace.tsx —
before deciding which findings apply.

If a surface is single-column, say so plainly and mark F1/F2 does-not-apply-as-stated, then say what
the equivalent defect is for that shape: an instruction naming a section the learner has to scroll
to find, a promise the surface does not keep, an action control with no affordance. A short honest
audit is the right answer for a module that does not have the three-pane shape; do not manufacture
applicability.

CRRT renders ChoiceReasoningFeedback, so F10 and F12 are live regardless of its layout.
```

## Verifying, in every module

- `npx jest src/features/<module>` before you start, so you know what you broke.
- Also `npx jest src/features/learning-module src/features/critical-care` — the shared copy lints
  and the cross-module contracts live there, and a change to a shared component reaches four modules.
- The critical-care routes are public-unlisted, so `npm run dev:claude` (port 3120) reaches them. A
  client-side reload bounces to `/sign-in`; navigate instead.
- Re-measure at every width the module has a recorded validation for: zero elements overflowing
  their pane, zero document horizontal scroll, and the device pane still widest where a decision
  says it should be.
- Finish on the skill's rubric, section 5.
