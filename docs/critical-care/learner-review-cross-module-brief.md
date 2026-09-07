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
`StageTeachingScope`, `SectionsDrawer`, `stageModel` and two stylesheets. **Three modules adopt it
as of 2026-09-06** — mechanical-ventilation, mechanical-circulatory-support (PR #126) and
icu-hemodynamics (PR #125), the last two migrated after the audit below was written. ECMO still runs its own copy in `src/features/cardiohelp-ecmo/components/stage/`, and the
learner-review fixes landed **there**, so the two have diverged.

Concretely, `learning-module/stage/StageLayout.tsx` is a near-verbatim copy of ECMO's _pre-fix_
layout: same `PANE_LABELS = { primary: 'Simulator', secondary: 'Teaching', tertiary: 'Steps' }`, same
doc comment, no visible pane captions, no width options, and `NowCard` has no slot for a location
line. **Every one of F1, F2, F3 and F6 is present in the shared package, unfixed.**

That makes the ordering obvious:

1. **Fix the shared stage package first.** One change fixes three modules and every future adopter,
   and it is the same change already worked out and shipped once in ECMO — port it, do not redesign
   it. This is now the single highest-leverage change in this document.
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

## The runnable prompt

One template, four fills. It is written to be pasted whole into a fresh session in the worktree
named at the top, and it reproduces the ECMO round's _format_, not only its fixes: confirm before
changing, one commit per cluster with the suite green at each, decisions recorded where the module
already records them, and an honest list of what was left.

The source material is on `claude/ecmo-learner-feedback`. Every `git show` below works from any
worktree of this repo without switching branches — worktrees share one object store, and the branch
is pushed, so `git fetch origin` also gets it into a fresh clone. Once it merges, drop the
`claude/ecmo-learner-feedback:` prefix and read the paths directly.

```
You are working on <MODULE PATH> in this worktree, applying the ECMO learner-review round to it.

── STEP 0 · READ FIRST, EDIT NOTHING ──────────────────────────────────────────────────────────
The source material is on a local branch that is not on main. Worktrees share refs, so read it from
here without switching branches:

  git show claude/ecmo-learner-feedback:docs/critical-care/learner-review-cross-module-brief.md
  git show claude/ecmo-learner-feedback:docs/cardiohelp-ecmo/redesign/r5-learner-review-record.md
  git log --oneline origin/main..claude/ecmo-learner-feedback
  git show claude/ecmo-learner-feedback -- src/features/cardiohelp-ecmo src/features/learning-module

The brief carries seventeen findings (F1–F12, X1–X5), an audit of THIS module against every one of
them with file:line evidence and an effort estimate, and this module's own section. The five ECMO
`feat(ecmo)`/`fix(ecmo)` commits are the worked example — read the diffs, not just the messages.

Also load the `medical-education-modules` skill. Principle 13 / pattern P9 "Say where" is the rule
these findings are instances of, and the rubric's section 5 is what you finish on.

── STEP 1 · BRANCH ────────────────────────────────────────────────────────────────────────────
  git fetch origin && git switch -c claude/<short-task> origin/main
Run `npm ci` only if node_modules is stale. Record the test baseline before touching anything:
  npx jest <MODULE PATH>
  npx jest src/features/learning-module src/features/critical-care

── STEP 2 · CONFIRM, DO NOT REDO ──────────────────────────────────────────────────────────────
The audit was read on 2026-09-06 and the modules move. Confirm — with file:line — only the findings
you are about to touch, and say where the code has drifted. Where the brief and the code disagree,
the code wins; say so rather than quietly following the brief.

The brief's own appendix names four places its authors got something wrong, including a quoted
on-screen string that does not exist. Treat every quote as a claim to check, not a fact.

Report the confirmation BEFORE editing. If a finding turns out not to apply, say so and drop it —
a shorter honest pass beats a manufactured one.

── STEP 3 · FIX, IN CHUNKS THAT PASS ──────────────────────────────────────────────────────────
One commit per finding cluster, both suites above green at each. Order:
  1. anything shared (`src/features/learning-module/**`) — it reaches four modules, so it lands
     first, with every addition optional and defaulted so existing callers are byte-identical;
  2. this module's own code;
  3. this module's authored content.

Rules the ECMO round was held to, and you are too:
  · A fix that collides with a recorded decision AMENDS that record in the same commit — never
    edits around it. Check `docs/critical-care/` and the module's own docs before assuming nothing
    is recorded. Check also whether a recorded decision's guard still exists; one of them names a
    test that a later rebuild deleted.
  · New learner-facing copy passes this repo's copy lints. There are several, with different
    matching rules, and some registries validate at IMPORT so a bad string throws before any
    assertion runs. Find them before writing copy, not after.
  · Do not renumber, rename or reorder anything a test or a record pins, without saying so.

── STEP 4 · VERIFY ────────────────────────────────────────────────────────────────────────────
Tests are necessary and not sufficient. The critical-care routes are public-unlisted, so a dev
server reaches them: start the worktree's own entry from .claude/launch.json and walk the surface
you changed. A client-side reload bounces to /sign-in — navigate instead.

If you touched layout, re-measure at every width this module has a recorded validation for, and
report the table: elements overflowing their pane (must be 0), document horizontal scroll (0), and
which pane is widest. Measure the computed style rather than assuming a rule applies — one ECMO
declaration turned out to be inert.

Finish on the skill's review rubric, section 5.

── STEP 5 · RECORD ────────────────────────────────────────────────────────────────────────────
Write a record beside this module's existing docs, in the shape of
`docs/cardiohelp-ecmo/redesign/r5-learner-review-record.md`:
  · what was reported or found, and what shipped against each — a table, one row per finding;
  · each decision that changed, numbered, with the quoted prior decision it amends;
  · what you deliberately did NOT fix, with the file:line, so it is a next round's list rather
    than a rediscovery;
  · anything that needs the owner: content they authored verbatim, a scoring or contract change,
    a question you could not settle from the code.

── WHAT TO HAND BACK ──────────────────────────────────────────────────────────────────────────
The commits, the before/after test counts, the width table if layout moved, and a plain list of
what you left undone and why. If you found something worse than the findings you were sent for —
the cross-module audit found three — lead with that.
```

### The four fills

| Worktree                                          | Branch to start from                                 | `<MODULE PATH>`                                                | Read first                                                                                                                    |
| ------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `…-Worktrees/codex-mechanical-ventilation-update` | `origin/main` (its current branch is already merged) | `src/features/mechanical-ventilation`                          | brief §1 + §0 — the shared-stage work now reaches MV, MCS and hemodynamics, so whoever does it coordinates with the other two |
| `…-Worktrees/claude-mec-circ-9-5`                 | `origin/main` (37 behind)                            | `src/features/mechanical-circulatory-support`                  | brief §2 — and fix the key-position defect first, it is one import                                                            |
| `…-Worktrees/claude-hemodynmaics-9-5`             | `origin/main` (1 behind)                             | `src/features/icu-hemodynamics`                                | brief §3 — decide converge-or-patch on its private workspace copy before anything else                                        |
| no worktree yet                                   | `origin/main`                                        | `src/features/baxter-crrt`, then `src/features/icu-simulation` | brief §4 — create a worktree, or run it from the primary checkout                                                             |

Two notes on sequencing. MV should do the shared `learning-module/stage` work as part of its own
round, because it is the only adopter and nobody else can test it. And MCS, hemodynamics and CRRT
each carry an item-quality finding that is worth its own commit ahead of any layout work — those
are the ones that make completion data mean something.

## Per-module prompts

The fuller, module-specific versions the template's "Read first" column points at. Each is written to be pasted whole into a fresh session in the right worktree. The audit has already
been done — the appendix at the end of this file carries each module's status for all seventeen, with
file:line evidence — so a session's job is to confirm the handful it is about to touch, not to redo
the sweep. Where the appendix and the code disagree, the code wins: these were read on
2026-09-06 and the modules move.

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
- MV's pane order is a recorded decision whose guard has been deleted. docs/critical-care/
  mv-d2-standard-laptop-workspace.md:68 states "The conceptual order — live ventilator/waveforms →
  teaching explanation → learner action — is unchanged", and that document's own traceability table
  (:237) names `__tests__/learn-workspace.test.tsx` as what enforces it — a file PR #127 deleted. No
  current MV test reads `data-pane`. So the order is now changeable without breaking anything while
  still being a decision on the record: do not flip it because it is easy to, and if it should
  change, amend D2 in the same commit and give it a guard again. ECMO's R5-OD-1 does NOT transfer
  automatically.

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
- SUPERSEDED as of PR #126: MCS is now ON the shared stage. `McsLearnSection` is retired and
  `components/stage/McsStageHost.tsx` renders `StageLayout`. So the converge-or-patch question is
  already answered, F1/F2/F3 are shared-package work (prompt 0), and the key-position defect the
  audit found is fixed — `McsStageHost.tsx:642` applies `orderChoices`. Re-audit the layout findings
  against the new host before acting on the appendix's MCS rows.
- Still live and still MCS's own: the authored key-first order in `content/sectionLearningContracts.ts`
  (cosmetic now, but misleading to read), and F12.
- It renders ChoiceReasoningFeedback, so F10 (does the card show the other answers' rationales when
  an instruction promises them?) and F12 (pass `frames`) are both live.
```

### 3 · ICU hemodynamics

```
Read docs/critical-care/learner-review-cross-module-brief.md and the ECMO commits it names.

Audit src/features/icu-hemodynamics against F1-F12 and X1-X5, reporting status with file:line
evidence before changing anything.

What is already known:
- PARTLY SUPERSEDED as of PR #125: hemodynamics now has `components/stage/HemodynamicsStageHost.tsx`
  rendering the shared `StageLayout` and applying `orderChoices`. But `ResizablePacWorkspace.tsx` —
  its own copy of the workspace, with its own minimums, its own compact threshold and its own
  compactPane defaulting to 'monitor' — SURVIVES and is still referenced by
  `HemodynamicNativeWorkspace.tsx`. Establish which surface each finding is on before acting: the
  layout findings are prompt 0's work on the stage side and this module's own on the legacy side.
- The converge-or-patch question is therefore narrower than the audit framed it: what is left of
  `ResizablePacWorkspace`, and should it go?
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

## What moved under this brief on 2026-09-06, after the audit ran

`origin/main` advanced twenty-seven commits between the audit reading the code and this branch being
pushed, and two of those merges change what the brief above says. Re-verified against `origin/main`
directly:

- **The shared stage has three adopters now, not one.** PR #126 put MCS's nine sections on it and
  retired `McsLearnSection`; PR #125 did the same for hemodynamics. `learning-module/stage` is now
  imported by mechanical-ventilation, mechanical-circulatory-support and icu-hemodynamics. That makes
  prompt 0 strictly more valuable — one change to `StageLayout`, `NowCard` and `stageModel` now
  reaches three modules — and it stales the layout half of the MCS and hemodynamics entries in the
  appendix, which were read against surfaces that no longer exist.
- **MCS's key-position defect is fixed.** The migration brought `orderChoices` with it:
  `components/stage/McsStageHost.tsx:642` applies it in the one `choiceFieldset` helper every item
  renders through. The authored order is still key-first in 9 of 9 and 9 of 9, which is worth
  correcting for the next person to read the file, but it is no longer what the learner sees and the
  first-option strategy no longer scores. **Struck from the list below.**
- **The other two stand, checked on `origin/main` and not on this branch.** MV's `earlierCycle`
  rationales are still swapped, verbatim. Hemodynamics still has thirteen items and twelve
  partly-correct distractors in `content/pacLearningItems.ts`.

Hemodynamics is now a hybrid: `components/stage/HemodynamicsStageHost.tsx` renders `StageLayout`,
while `ResizablePacWorkspace.tsx` survives and is still referenced by
`HemodynamicNativeWorkspace.tsx`. Establish which surface a finding is on before acting on it.

## The two findings that outrank the twelve

Auditing the five siblings against the learner's twelve turned up three defects that are worse than
anything she reported, in modules she never opened. None is a layout problem and none would have been
found by reading the brief above; all three were found by reading the content while looking for
something else.

**Struck: MCS's key-first defect was fixed by its stage migration** — see the note above. It is left
recorded because the authored order is still key-first in every item, which will read as a defect to
the next person and is worth a comment in the content file.

**MV: a wrong answer is handed the right answer's reasoning, in two units.**
`content/learningExperiments.ts:170-184`, the `earlierCycle` round, used by both
`expiration-and-air-trapping` and `dyssynchrony-mechanisms`. The key is index 1 ("Shorter machine
inspiration"); `rationales[0]` — served to whoever chose "Longer machine inspiration" — is
"An earlier flow-cycle criterion ends support sooner", the key's own mechanism. The learner who is
right gets a generic next-step line instead. The same item's stem also states the direction the key
names, which `docs/critical-care/activity-contract.md:70-73` forbids outright.

**Hemodynamics: twelve of thirteen items carry a partly-correct distractor, and several are false.**
`content/pacLearningItems.ts` has 13 items and 12 `reasonable-but-incomplete` options, which
`AnswerVerdict` renders as "Partly correct." Five option labels carry eliminable absolutes —
"damping **cannot** affect clinical interpretation", "positive pressure **always** reveals the true
filling pressure", "controlled ventilation is the **only** condition that determines PPV validity".
Where a false claim is graded partly correct, the card tells a learner the false claim is defensible.

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

## Appendix — what each module actually has

From a read-only audit of all five, adversarially verified. `●` applies · `○` already handled ·
`—` does not apply. Effort is the auditor's estimate for that module alone.

**Two statuses in this matrix are the verifier's, not the auditor's**, and both were originally
reported the cheap way round — as "no problem here" when there is one.

Hemodynamics `F6` is the clear one: the audit's own prose says "the second half DOES apply" and
supplies a fix, then labels the row already-handled.

MCS `F4` is the interesting one, and neither the auditor nor the verifier had it right. I read it.
The LVAD "Pump speed" slider at `McsControls.tsx:554-564` is indeed `disabled` until
`state.device.speedChangeAuthorized`, which the default device leaves false — so the auditor's
"nothing is dead on the Learn surface" is wrong. But it is not ECMO's silently-dead console either:
the control that enables it is a labelled checkbox **immediately above it**, "Authorized-personnel
order · Simulation authorization only". The defect is milder and more precise than either report —
the gate is present and adjacent, and simply does not say what it gates. Marked `●` on that basis,
and the fix is a clause on the checkbox, not a new disclosure.

Two more scope corrections worth carrying into any session that uses this:

- Hemodynamics `F11` covers more than the thirteen items in `content/pacLearningItems.ts` that the
  entry below counts. Three further authored item sets were never looked at —
  `pacAdvancementReasoning.ts` (28 plausibility entries), `normalWaveformValidityChallenges.ts` (21)
  and `pawpCaptureSequence.ts` (7).
- Hemodynamics `F5` is real but the proposed CSS-module fix cannot reach the module's main
  progression controls: there are 31 `bg-primary` Tailwind buttons across its components and zero
  `hover:` utilities. The focus half needs nothing — `src/app/globals.css:34-36` already rings every
  focusable element globally.

And one caution about provenance: the MV entry's `F9` quoted two on-screen strings ("Section 2 of
17") that **do not exist** — MV has fourteen units and the template reads `of ${lesson.total}`. The
status was still right. Check a quote before you act on it.

| Finding | MV  | MCS | Hemo | CRRT | ICU sim |
| ------- | --- | --- | ---- | ---- | ------- |
| `F1`    | ●   | ●   | ●    | ●    | ●       |
| `F2`    | ●   | ●   | ●    | ●    | —       |
| `F3`    | ●   | ●   | ●    | ●    | ●       |
| `F4`    | ○   | ●   | —    | —    | ●       |
| `F5`    | ●   | ○   | ●    | ●    | ○       |
| `F6`    | —   | ○   | ●    | —    | ●       |
| `F7`    | ●   | —   | ●    | ●    | ●       |
| `F8`    | ●   | ●   | ●    | ○    | ●       |
| `F9`    | —   | —   | ●    | ●    | —       |
| `F10`   | ○   | —   | ●    | ●    | ●       |
| `F11`   | ●   | ●   | ●    | ●    | —       |
| `F12`   | —   | ●   | ●    | ●    | ●       |
| `X1`    | ●   | ●   | ●    | —    | —       |
| `X2`    | ●   | —   | —    | ●    | —       |
| `X3`    | ●   | ●   | —    | ●    | ●       |
| `X4`    | ●   | —   | ●    | ●    | —       |
| `X5`    | —   | ●   | ●    | ●    | —       |

### mechanical-ventilation

**Shape.** Three panes via the SHARED stage package. `components/stage/VentilationStageHost.tsx:1111` renders `StageLayout` from `@/features/learning-module/stage/StageLayout`, which hard-codes `PANE_LABELS = { primary: 'Simulator', secondary: 'Teaching', tertiary: 'Steps' }` (StageLayout.tsx:9-13) and passes them to `ResizableTeachingWorkspace` — left to right Simulator | Teaching | Steps, confirmed by `teaching-workspace.module.css:14-19` (primary is column 1). StageLayout passes NONE of the three new optional props (`defaultWidthFractions`, `paneMinimums`, `preferredCompactPane`), so MV runs at 43/29/rest with floors 340/280/300 (compact below ~1008px of workspace width). Panes carry `data-pane="simulator|teaching|task"` (StageLayout.tsx:63/68/73) and nothing in MV reads them — pane order is pinned by no test. Step model: `VentilationStageStep extends StageStepBase` (content/stageLessons.ts:101-108) adding `stops`, `teaching: 'framing'|'stop'|'task'|'reveal'|'transfer'`, and an optional `guide: VentilationStepGuide { maneuver, look, watch, note }`. There is NO `lookIn`/location field. Eight steps per lesson (nine in `controls-and-goals`), all GENERATED in `buildVentilationStageLesson` from `sectionSpecs.ts` + `learningExperiments.ts` — no per-step authoring hook exists today. 14 units. Verdict card: `AnswerVerdict` only (`VentilationStageHost.tsx:8`, call sites 713 and 736, both `outcome="stated"` `timing="immediate-after-commit"`); `ChoiceReasoningFeedback` is not rendered anywhere in this module. Device surface: `components/stage/VentilationSimulatorPane.tsx` (transport toolbar, console facsimile, watch readings, per-step "Quick controls for this step", breath map, bedside disclosure). Teaching pane: `VentilationTeachingColumn.tsx`, blocks wrapped in `StageBlock` with per-focus visibility.

**Baseline.** 26 suites / 565 tests, all passing (`npx jest src/features/mechanical-ventilation`, 75.7 s). NOTE: the files named in my task brief (`components/MechanicalVentilationLearnWorkspace.tsx`, `content/lessonLearningItems.ts`, `__tests__/learn-workspace.test.tsx`) no longer exist — PR #127 deleted them. The real entry is `components/stage/VentilationStageHost.tsx`.

**Applies:**

- **F1** (small) — src/features/learning-module/stage/StageLayout.tsx:9-13 `const PANE_LABELS = { primary: 'Simulator', secondary: 'Teaching', tertiary: 'Steps' }` — reaching the DOM only as `aria-label={`${paneLabels.primary} panel`}` on the region (ResizableTeachingWorkspace.tsx:444/479/514) and inside the tab row that renders only `{c
<br>_Fix:_ In the SHARED `learning-module/stage/StageLayout.tsx`, render a visible caption inside each of the three wrapper divs it already owns (`styles.simulatorPane`/`.teachingColumn`/`.taskColumn`, lines 63/68/73) — MV's own vocabulary: 'Ventilator panel · the live patient', 'Teaching panel · why it happens', 'Steps panel
  <br>_Collides:_ None for adding names. docs/critical-care/mv-d2-standard-laptop-workspace.md §2 and §7 DO pin the pane ORDER (ventilator → teaching → action) and §3 pins the 1280×720 and 1024×768 three-pane budget; any caption must cost
- **F2** (medium) — Instructions are generated, not authored per phase (content/stageLessons.ts:252-379). The Recognize instructions in sectionSpecs.ts DO name landmarks inside the Simulator pane ('Find the five settings on the console…' :121; 'choose the stop on the breath map' :230/:308/:326; 'Open the patient and circuit findings under
  <br>_Fix:_ Two lines, no new authoring layer. (1) Add an optional `lookIn { pane, landmark }` to `StageStepBase` in the shared `stageModel.ts` and a slot under the instruction in `NowCard`; (2) in `buildVentilationStageLesson` set it per step KIND from data already present — walk/locate → `{ pane: 'Ventilator panel', landmark: 't
<br>_Collides:_ None. mv-flow-rebuild.md §6c already records the opposite direction — generic step names were replaced by `roundActionTitle` because 'Make the change' told the learner nothing — so naming the surface continues that decis
- **F3** (trivial) — Two instructions name a place the learner cannot see, and both point at the WRONG pane. (1) sectionSpecs.ts:79, the FIRST instruction in the whole pathway (`breathing-with-support`): 'Read the four short paragraphs on the right, then watch the console for a few breaths.' The four paragraphs are `spec.orientation` (sect
  <br>_Fix:_ Edit two strings, no code. sectionSpecs.ts:79 → 'Read the four short paragraphs under "Why a ventilator exists" in the Teaching panel, then watch the console for a few breaths.' stageLessons.ts:317-318 → replace 'then the explanation on the right' with 'then read what it means, below.' (the round explanation is in the
  <br>_Collides:_ None — mv-flow-rebuild.md:43 is a description, not a decision, and it is itself wrong about which side the Teaching pane is on.
- **F5** (trivial) — Narrower than ECMO's, but real. MV's action controls are `.toolButton` (holds, interventions, transport) at components/stage/ventilation-stage.module.css:48-63: they DO have `min-height: 2.25rem`, a filled `background: rgba(16, 46, 52, 0.72)`, `font-weight: 700`, `cursor: pointer`, a `:disabled` rule (65-69) and `:focu
<br>_Fix:_ Add `.toolButton:not(:disabled):hover { border-color: var(--cyan-bright, #71e1e5); }`and`.toolButton:not(:disabled):active { transform: translateY(1px); }`to components/stage/ventilation-stage.module.css beside the existing`:focus-visible` block at line 71 — reusing the accent token the spotlight and focus ring alr
  <br>_Collides:_ None found.
- **F7** (trivial) — `stop.checklist` renders as a bare, unlabelled `<ul>` in TWO places: VentilationStageHost.tsx:702-706 (inside the walk card, immediately after a `<dl>` whose two entries ARE labelled 'Find it on the console' and 'Try this' — the checklist is the only unlabelled block in the card) and VentilationTeachingColumn.tsx:140-1
  <br>_Fix:_ MV needs the OPPOSITE of ECMO's R5-OD-2: one shared label, not an authored-per-instance one. All 11 checklist items across the four stops are questions ('Who started this breath: the patient or the timer?', 'How fast is gas moving? (flow)', 'What ended the push: time, flow, or the patient?', 'Did expiratory flow reach
  <br>_Collides:_ None. breathSpine.ts:14 ('The checklists are the bedside residue … and are held to four items each') supports a single label rather than contradicting it.
- **F8** (trivial) — MV has the visible-text-equivalent defect, and here the VISIBLE surface is the one missing the information. Three surfaces carry the plateau in one render: (a) the trace readout, `WaveformStrip.tsx:190-198`, prints the number plus `{readout.unreliable ? <em aria-hidden="true">?</em> : null}` — a bare `?` glyph, inside
  <br>_Fix:_ One expression at MechanicalVentilatorConsole.tsx:1550: after the plateau value append `{plateauUnreliable ? ` — ${plateauWithheldNote(plateauValidity)}` : ''}`. Both bindings are already in scope (776/777, import at 32) and the note function already produces the exact string the figcaption uses, so the two surfaces ca
  <br>_Collides:_ None — it restores what mechanical-ventilation.module.css's own comment block (MechanicalVentilatorConsole.tsx:1553-1557) and docs/critical-care/mv-d2-standard-laptop-workspace.md §5a ('what each level _is_ is stated her
- **F11** (medium) — The class ECMO had is structurally IMPOSSIBLE here — `stageItems.ts:43` derives `plausibility: index === round.correct ? 'best' : 'incorrect-mechanism'`, so no MV distractor can be graded 'reasonable-but-incomplete' and no false claim can be called defensible. But six other item defects are live in content/learningExpe
  <br>_Fix:_ All six are edits to content/learningExperiments.ts, no code. (1) Swap `earlierCycle.rationales[0]` and `[1]` (:180-183) and rewrite the new [0] to negate 'Longer' explicitly. (2) Rewrite the `earlierCycle` stem so it does not contain the key: 'A higher cycling threshold is reached earlier on the decaying inspiratory f
  <br>_Collides:_ learningExperiments.ts carries no owner-verbatim marker, unlike ECMO's R4-OD-9 stem. But mv-flow-rebuild.md:111 records 'The full experiment copy still carries reviewStatus: draft through the items derived from it' (stag
- **X1** (small) — `StageLayout` passes no `preferredCompactPane` (grep for it across StageLayout.tsx and components/stage/\*.tsx returns nothing), so `ResizableTeachingWorkspace` opens compact on `primary` = Simulator and stays there (ResizableTeachingWorkspace.tsx:179). Compact fires below `340 + 280 + 300 + 40 = 960px` of usable width
  <br>_Fix:_ Thread `preferredCompactPane` through `StageLayout` (one optional prop, defaulted to undefined so ECMO/other adopters are untouched) and derive it in `VentilationStageHost` from the interaction kind, which the host already switches on: `interaction.kind === 'locate' || interaction.kind === 'simulator-task' || interacti
  <br>_Collides:_ docs/critical-care/mv-d2-standard-laptop-workspace.md §5 deliberately keeps 1024×768 on the three-pane side ('The Learn viewport's side gutter is dropped at laptop density specifically so this width sits decisively on th
- **X2** (small) — `.now { position: sticky; top: 0; }` (learning-module/stage/lesson-shell.module.css:374-386) inside `.taskColumn { display: grid; align-content: start; }` (lesson-stage.module.css:71-80) — a content-sized grid item, so the sticky box has zero travel and the Now card has never stuck. MV makes it strictly worse than ECMO
  <br>_Fix:_ Two edits, both required for MV: give the Now card's own wrapper the sticky (move `position: sticky; top: 0` onto a rule for `[data-now-focus]` in components/stage/ventilation-stage.module.css, or drop the wrapper and put the ref on the `<section>`), and make the pane a scroll container the sticky can resolve against —
  <br>_Collides:_ None; NowCard.tsx:42 states the intent ('Sticky at the top of the task column'), which the CSS silently fails to deliver.
- **X3** (trivial) — Dead per-step payload, exactly the shape ECMO had. `VentilationStageInteraction`'s observe variant declares `readonly watch: readonly LabMetric[]` (content/stageLessons.ts:69-74) and `buildVentilationStageLesson` populates it (`watch: roundManeuver(first) === 'pause' ? [] : first.watch`, :302-306). `grep -rn 'interacti
<br>_Fix:_ Delete the `watch`field from the`observe` variant at content/stageLessons.ts:73 and the line that fills it at :305 — or, if it should be authoritative, make VentilationStageHost.tsx:354-358 read it. Do not keep both.
  <br>_Collides:_ None.
- **X4** (small) — Present, and worse than ECMO's shrinking list. The always-visible, unqualified 'Reset patient' button (VentilationSimulatorPane.tsx:201-209, `data-reset-patient`) dispatches `{ type: 'RESET' }`, and the reducer (engine/learningLab.ts:301-317) sets `events: []`, `observedHolds: []`, `readySince: null` and rebuilds the r
  <br>_Fix:_ Cheapest honest fix in this module's own idiom: give the Reset button the same self-explaining treatment its neighbour already has — a `title` (and a visible line when the current step has met goals) saying 'Resets the patient to this round's starting point. Your prediction is kept; a hold, an intervention or a timed o
  <br>_Collides:_ engine/learningLab.ts:272 documents RESTART as 'Start the section again from nothing' but RESET carries no such note, so nothing records that erasing performed holds and interventions was intended.

**Found in this module and not in ECMO:**

- STALE TEST GUARD (X3-class, in the test dimension): src/features/mechanical-ventilation/**tests**/layout-regression.test.ts:45 and :49 assert `learnViewportContractViolations` / `learnWorkspaceFrameContractViolations` against `components/mechanical-ventilation-v2.module.css`, but `.learnViewport` (t
- REPEAT ITEMS PRESENTED AS NEW (F11-class, MV-only because MV derives items from shared round objects): `content/learningExperiments.ts:292-297` gives `breathing-with-support` round 2 the `flow` round with its options manually rotated (`choices: [flow.choices[1], flow.choices[2], flow.choices[0]]`),
- AnswerVerdict.tsx:176 and :44-48 are stale doc comments after PR #127: the first claims 'the ECMO stage is the only caller passing `stated` today' while MV passes `outcome="stated"` at VentilationStageHost.tsx:716 and :739; the second describes 'Mechanical Ventilation Learn's own copy' as a migrated
- docs/critical-care/mv-flow-rebuild.md:43 records the Teaching pane as 'on the right'. It is the middle pane (teaching-workspace.module.css:14-19). This is the source of the F3 copy defect at stageLessons.ts:317-318 and should be corrected in the same change so the next session does not re-derive the
- BreathMap.tsx:139 and :306 render the SAME `description` string twice — once as `<desc id={descriptionId}>` referenced by the svg's `aria-describedby` (:137), and once as a `.equivalent` paragraph that is sr-only (breath-map.module.css:297-305, `clip: rect(0 0 0 0)`). A screen reader reads the whole

### mechanical-circulatory-support

**Shape.** Three panes, six phases, one section at a time. `components/McsLearnSection.tsx:122` calls the SHARED `ResizableTeachingWorkspace` directly (not the `learning-module/stage` package, which MCS has never adopted), passing `paneLabels { primary: 'Live anatomy' | 'Live monitor' (per contract.primarySurface), secondary: 'Teaching', tertiary: 'Your turn' }` and no `defaultWidthFractions`, `paneMinimums` or `preferredCompactPane` — so it runs on the shared defaults (43/29/rest, floors 340/280/300, compact below ~960 px of usable width, compact opening on `primary`). The three pane bodies are `McsLearnPrimaryPane` (live monitor or 3D anatomy + context strip), `McsLearnTeachingPane` (authored prose + one bespoke live panel per section, disclosed in five stages by `mcsRevealStage(phase, predictionCommitted)`), and `McsLearnActionPane` (everything the learner does). There is no "step" model: the unit is `McsLearnPhase` = recognize → predict → act → observe → explain → transfer, and each phase's single instruction is one authored string on the section's `McsSectionLearningContract` (`recognizePrompt` / `predictionPrompt` / `actionInstruction` / `observationFocus` / `reassessmentPrompt` / `transferPrompt`) — 54 strings across 9 sections, in `content/sectionLearningContracts.ts`, validated at import by `validateContracts()` (:1739-1889). Controls a phase may point at are a separate registry, `content/learnControls.ts`, each carrying a `location` ('guided-actions' | 'patient-conditions' | 'device-settings'). The primary surface's highlighted region is authored in `content/primarySurfaces.ts` with a `label` and a `textEquivalent`, printed on the primary pane itself as "Look here now: …". Phase state lives in `McsLearnSection`; the workbench (`McsWorkbench.tsx`) owns the phase, the section rail and completion.

**Baseline.** 21 suites / 748 tests, all passing (`npx jest src/features/mechanical-circulatory-support`, 25 s). Shared surfaces a change here would reach: `npx jest src/features/learning-module src/features/critical-care` = 35 suites / 309 tests, all passing.

**Applies:**

- **F1** (small) — `McsLearnSection.tsx:124-128` passes `paneLabels={{ primary: contract.primarySurface === 'anatomy' ? 'Live anatomy' : 'Live monitor', secondary: 'Teaching', tertiary: 'Your turn' }}`. Those three strings reach the screen only as `aria-label={`${paneLabels.primary} panel`}` (`ResizableTeachingWorkspace.tsx:444, 479, 514
<br>_Fix:_ One `McsLearnPaneCaption`in`components/`, rendered as the first child of each of the three `<section>`s in `McsLearnPrimaryPane`/`McsLearnTeachingPane`/`McsLearnActionPane`, printing the same word `McsLearnSection.tsx:124-128`passes as that slot's`paneLabels`value plus a purpose clause — "Teaching panel · what
<br>_Collides:_ None for captions. Pane ORDER is pinned as a decision by`**tests**/m2-m3-requirements.test.tsx:769-786`("orders the panes primary surface → teaching → learner action, in the DOM") and again by`**tests**/components.tes
- **F2** (large) — 51 of the 54 authored instruction strings name no pane. Examples: `sectionLearningContracts.ts:203` 'Identify, in the highlighted flow account, which of the three flow lines this pathway leaves at zero.'; `:294` 'Hold the mean pressure beside the effective systemic delivery and the mixed venous saturation…'; `:767` 'Lo
  <br>_Fix:_ Add `readonly lookIn: McsPhaseLocation` to a new per-phase record on `AuthoredSectionContract` — one entry per phase, 54 authored, `{ pane: 'primary' | 'teaching' | 'your-turn'; landmark: string }` where `landmark` is a heading, control group or device surface actually on screen at that phase (for `act`, `mcsLearnContr
<br>_Collides:_ `docs/critical-care/mcs-learn-section-contracts.md:16-19`— the contract is 'the authority for everything the learner reads' and the panes 'render it; none of them decides anything about it'. Authoring`lookIn` on the co
- **F3** (small) — Three instances. (1) `sectionLearningContracts.ts:450` — 'Select each mechanism in turn … and watch the pathway summary beneath the model change with each one.' The pathway summary is `McsAnatomy3D.tsx:388`, i.e. INSIDE the `SimulationLaunchGate` at `McsLearnPrimaryPane.tsx:80-92`. That gate withholds all of its childr
  <br>_Fix:_ (1) Move `McsAnatomyPathwaySummary` out of `McsAnatomy3D` and render it as a sibling of the gate in `McsLearnPrimaryPane.tsx:79-92`, so the authored summary — which carries no WebGL — survives the gate the canvas needs. (2) Move the `alarmExplanations` block (`McsMonitor.tsx:492-500`) to sit directly under `alarmBar` (
  <br>_Collides:_ `release-boundary.test.ts:41-59` reads `McsAnatomy3D.tsx` as source and asserts the ordering of the viewport block relative to `className={styles.anatomyTextEquivalent}`; moving the pathway summary out changes that file
- **F8** (small) — The M4 primitive is right — `shared.tsx:82-89` `TextEquivalent` takes `children`, so every call authors its own text, and the rule at :33-34 is 'the same numbers as the figure, not a description of the picture'. The defect is in the older 3D surface, which uses the same words for something else. `McsAnatomy3D.tsx:389-3
<br>_Fix:_ Thread the reveal stage into the primary pane: `McsLearnSection.tsx:129-131`already computes`reveal`at :89 — pass it to`McsLearnPrimaryPane`, and have that component pass `revealCausality={mcsMechanismDisclosed(reveal)}`to both`McsAnatomy3D`(:88) and`McsMonitor`(:94). Both components already take the prop and 
<br>_Collides:_`docs/critical-care/mcs-component-test-matrix.md:89`records the monitor's causal callout as 'withheld and restored' — but only under the Challenge route rules.`docs/critical-care/mcs-live-teaching-panels.md:36-38` reco
- **F11** (large) — Systematic, and worse than ECMO's single item. Across all 27 authored items — 9 `recognizeOptions`, 9 `predictionItem`s, 9 transfer `item`s — THE KEY IS AT INDEX 0 IN 27 OF 27, and MCS renders authored order with no rotation (`McsLearnActionPane.tsx:288`, `:330`, `:487` map `choices` directly; `grep orderChoices src/`
  <br>_Fix:_ Three changes, smallest first. (1) Import the existing `orderChoices(itemId, choices)` from `@/features/learning-module/stage/choiceOrder` — a pure function with no stage dependency — and wrap the three `.map` calls at `McsLearnActionPane.tsx:288`, `:330` and `:487`. That alone kills the 27/27 position cue and costs fo
  <br>_Collides:_ `sectionLearningContracts.ts:1784-1786` requires every prediction to offer an unsafe branch — rewriting them as predictions must keep one. `docs/critical-care/mcs-learn-section-contracts.md:45-48` records Predict's shape
- **F12** (trivial) — `McsLearnActionPane.tsx:545-550` renders `ChoiceReasoningFeedback` with no `frames` and no `outcome`, so a learner committing a transfer answer reads the defaults at `ChoiceReasoningFeedback.tsx:49-56`: 'The cues support this read.' for `best`, and for `reasonable-but-incomplete` 'That is a defensible read as far as it
  <br>_Fix:_ An `MCS_VERDICT_FRAMES` const beside `McsLearnActionPane`, passed as `frames={MCS_VERDICT_FRAMES}` at :545, in this module's own vocabulary — the transfer asks for a response, so 'That is the response this pattern calls for.' / 'Defensible as far as it goes, and it leaves the limiting problem unnamed.' / 'That mechanis
  <br>_Collides:_ `AnswerVerdict.tsx:60-70` and `ChoiceReasoningFeedback.tsx:16-21` both record that the outcome label is deliberately opt-in because the finding came from one owner about one module — so taking it for MCS is an owner deci
- **X1** (trivial) — `McsLearnSection.tsx:122-128` passes no `preferredCompactPane`, so `ResizableTeachingWorkspace.tsx:179` initializes `compactPane` to `'primary'` and never moves it. Compact engages below `compactThreshold(minimums)` = 340 + 280 + 300 + 40 = 960 px of usable width (`:94-96`, `:358`). At that width the pane on screen is
  <br>_Fix:_ Pass `preferredCompactPane` from `McsLearnSection.tsx:122`, derived from the phase: `'tertiary'` for recognize / predict / act / transfer (the phases whose work is a control in the Your-turn pane) and `'primary'` for observe / explain, or better, from the `lookIn.pane` F2 authors. It is followed, not forced (`Resizable
<br>_Collides:_ `docs/critical-care/mcs-learn-section-contracts.md:110-113`records this exact behaviour as a residual limitation and defers it: 'The threshold and the default pane belong to`ResizableTeachingWorkspace`, which this pack
- **X3** (small) — Four authored, import-validated contract fields are never read by any renderer. `beforeStateLabels` and `afterStateLabels` (`sectionLearningContracts.ts:129-130`; e.g. section 1 at :304-313 — 'One undifferentiated impression: "the pressure looks acceptable"' … 'A device line sitting at zero, because this pathway report
  <br>_Fix:_ Render `beforeStateLabels` / `afterStateLabels` in the Observe body of `McsLearnActionPane.tsx:422-449`, above the numeric `BeforeAfterTable`, as 'What you had before' / 'What you have now' — they are the authored prose the numbers are supposed to be read against, and on section 2 they are the three-mechanism account F
  <br>_Collides:_ None — nothing in docs/ or in a code comment says these are authoring-only. `docs/critical-care/mcs-learn-section-contracts.md:16-19` implies the opposite: the contract is 'the authority for everything the learner reads'
- **X5** (trivial) — `McsLearnTeachingPane.tsx:159-164` renders `foundationMaterial` in a `<details open>` with no phase or reveal scoping at all — it is outside every `disclosed` / `explaining` guard above it (:89, :107, :129). On the two foundation sections the payload is the entire common model plus, on section 2, the eight standardized
  <br>_Fix:_ Give the `<details>` at `McsLearnTeachingPane.tsx:160` a phase-derived `open`: `open={reveal === 'orientation'}` (recognize and uncommitted predict, where a learner is orienting) using the `reveal` prop the component already receives at :42. Do not remove it from the DOM — the disclosure is what lets a learner go back
  <br>_Collides:_ YES, and it is explicit. `McsLearnTeachingPane.tsx:153-158`: 'The foundation material is long … It stays complete and open by default, inside a disclosure so a learner who has read it can fold it away and keep the sectio

**Found in this module and not in ECMO:**

- ANSWER LEAK ON THE PRIMARY PANE — the largest finding in this module, and the same class as F11 (an item a learner can answer without reasoning). `McsLearnPrimaryPane.tsx:88-95` renders `McsAnatomy3D` and `McsMonitor` without `revealCausality`, which defaults to `true` (`McsAnatomy3D.tsx:151`, `McsM
- "THE WORKSPACE" IS TWO DIFFERENT THINGS — the same name collision R5-OD-3 left open for ECMO's 'Circuit walk'. Five transfer instructions say 'in the workspace' meaning the `McsControls` card (`sectionLearningContracts.ts:497, 655, 812, 1143, 1458`; e.g. ':655' 'Decide how to evaluate a trigger chan
- TWO PHASE NAMES ON ONE SCREEN, IN TWO PANES — `McsLearnPrimaryPane.tsx:48-50` prints the phase in the device pane's kicker ('LIVE BEDSIDE MONITOR · Recognize') while `McsLearnActionPane.tsx:237-239` prints it as the Your-turn pane's h2 ('Recognize — step 1 of 6') and again as the current item of the
- THE ONLY POINTER THE MODULE HAS IS SECTION-LEVEL, NOT PHASE-LEVEL — `McsMonitor.tsx:281-283` and `McsAnatomyPathwaySummary.tsx:111-114` print '**Look here now:** {label}. {textEquivalent}' from `content/primarySurfaces.ts`, identically at all six phases. At Explain, a learner is still being told to
- THE TRANSFER CARD IS A DARK-THEME CARD IN A LIGHT PANE — `ChoiceReasoningFeedback.tsx:84-85` hard-codes `bg-sky-950/15` with `text-white` (:101), `text-slate-100` (:111), `text-slate-200` (:117) and `text-slate-300` (:135), with no `theme` prop. `McsLearnActionPane.tsx:545` renders it inside `.learn
- SECTION 2's OBSERVE ASKS FOR A COMPARISON ITS OWN ACT PHASE DESTROYS — each guided mechanism button dispatches `SELECT_DEVICE`, which rebuilds the state from `createInitialMcsState` (`reducer.ts:126`), so after clicking counterpulsation → transvalvular → durable, the only surviving numbers are the l

### icu-hemodynamics

**Shape.** Three panes, named Monitor / Anatomy / Activity, but NOT the ECMO stage shape — there is no `StageLayout`, no `NowCard`, no `StageStep`, and the instruction column is not one of the panes.

Shell: `ActivityShell layout="guided-lab"` (learning-module/components/ActivityShell.tsx:79) → `ActivityChrome` (header, `ActivityStepper` printing visible ordinals 1–6 for Recognize…Transfer, bottom bar) → `GuidedLabFrame.tsx:14-23`, which is a two-column grid: `<section aria-label="Simulation viewport">` and `<aside aria-label="Current task">`. The instruction lives in that aside, in the shared `TaskPanel` (visible `<h2>Current task</h2>`, `Objective`, `Required action`, `Targets`, `Hint`). Inside the viewport: `PacLearningPathwayViewport` (the rail, "Section n of 7") wrapping the module's private `ResizablePacWorkspace` = Monitor | Anatomy | Activity.

Step/instruction model: there isn't one per step. Six `skillSpecs` records in `PacGuidedSkillActivity.tsx:142-220` carry `{title, objective, requiredAction, explanation[], transfer}` per SECTION; each section then runs the six shared `CriticalCareActivityPhase`s, and the same `requiredAction` string prints unchanged at five of them (`:1146-1152`), with `spec.transfer` substituted at Transfer. So the module has 6 instruction strings for 36 steps, not 60 for 60.

Three surfaces mount the workspace: `PacGuidedSkillActivity.tsx:1028` (Learn, 6 stations), `HemodynamicCaseActivity.tsx:765` → `HemodynamicNativeWorkspace.tsx:40` (Practice cases), and `IcuHemodynamicsLab.tsx:337` (the standalone lab, the only place `.labShell` is applied). The seventh Learn section, `PacSignalValidationActivity`, is its own capstone shell.

Convergence recommendation — DO NOT migrate onto the shared `ResizableTeachingWorkspace` in this round; fix the private copy, and schedule convergence as its own piece of work. The shared component is strictly ahead behaviourally: it takes `paneLabels`/`workspaceLabel`, the three new options, publishes the caller's fractions as CSS custom properties before the first measurement, and implements the WAI-ARIA tablist keyboard model (`ResizableTeachingWorkspace.tsx:355-380`) that the private copy still lacks. The private copy has no behaviour the shared one lacks. What blocks the swap is not behaviour, it is the palette: `.resizablePacWorkspace` DECLARES the module's colour tokens (`icu-hemodynamics.module.css:372-382` `--ink/--muted/--line/--paper/--navy/--teal/--amber/--red`) plus `color-scheme: light`, and there are 189 `var(--…)` reads of those tokens across the stylesheet with only four declaration sites (`.labShell`:2, `.resizablePacWorkspace`:372, `.pawpPanel/.paneLockedNotice/.normalReference`:981, `.skillsLab`:1671). On the guided Learn route there is no `.labShell` ancestor, so the workspace element is the palette root for the monitor, the anatomy panel, the action dock, the formula drawer and the cardiac-output model. Also keyed to the private class names: `.liveWorkspace > .resizablePacWorkspace` height clamp (:367), `.resizablePacPane > .pacActionDock { position: static }` (:469), `[data-pac-resize-handle]` (:93/:305), and three media-query blocks (:3396, :3578). Convergence therefore means re-rooting the palette first — a separate, testable change. The cheap half of the benefit (the tablist key handler and `preferredCompactPane`) can be ported into the private copy in ~40 lines today.

**Baseline.** 22 suites / 276 tests, all passing (`npx jest src/features/icu-hemodynamics`, 4.6 s). Adjacent suites that import the module are also green and should be re-run with any change: `npx jest 'src/app/[locale]/icu-hemodynamics' src/features/critical-care` → 27 suites / 213 tests. The module-wide copy guard that will see any new component string is `src/features/critical-care/__tests__/learner-copy.test.ts`.

**Applies:**

- **F1** (small) — src/features/icu-hemodynamics/components/ResizablePacWorkspace.tsx:45-49 — `const paneLabels: Readonly<Record<PacWorkspacePane, string>> = { monitor: 'Monitor', physiology: 'Anatomy', controls: 'Activity' }`, rendered ONLY inside the compact tab row at :255 (`{compact && activePane === undefined ? ...}`). At full width
  <br>_Fix:_ In ResizablePacWorkspace.tsx, add one visible caption element at the head of each of the three `styles.resizablePacPane` divs, driven by a single widened `paneLabels` record (`{name, purpose}`) that also feeds the compact tabs and the `aria-label`, so the two vocabularies cannot diverge again. Style it as a `.pacPaneCa
  <br>_Collides:_ None. No docs/critical-care record names these panes. docs/critical-care/activity-contract.md:96-101 lists the workspace parts ('stable simulation viewport', 'predictable current-task panel') without naming panes, so a c
- **F2** (medium) — None of the six instruction strings names a pane: PacGuidedSkillActivity.tsx:146-147, :158, :170-171, :182-183, :195-196, :210-211. The two learner strings that do reach for location point at all three panes at once — :134 `<dd>Use the visual workspace to test that interpretation against the live signal.</dd>` and :948
  <br>_Fix:_ Turn `skillSpecs[id].requiredAction: string` into a per-phase record (`Record<CriticalCareActivityPhase, { action: string; lookIn: { pane: PacWorkspacePane; landmark: string } }>`) in PacGuidedSkillActivity.tsx:142-220, and print `lookIn` through the slot TaskPanel already renders visibly: `targets` (TaskPanel.tsx:41-5
  <br>_Collides:_ None. No test reads `targets` or any `requiredAction` string. Note the import-time copy guard: any new string is scanned by src/features/critical-care/**tests**/learner-copy.test.ts:65-77 against `forbiddenStaticUiTerms`
- **F3** (trivial) — Two instructions name surfaces that carry different names on screen, and one names a surface that is not mounted at the step where it first appears. (a) PacGuidedSkillActivity.tsx:211 — 'Review the dependency teaching, then open **the formula panel** and inspect the explicit not-interpretable states.' The only formula
  <br>_Fix:_ Change the two strings to the visible wording rather than renaming the components: at :211 write 'open Derived hemodynamics and interpretation limits' and 'Interpret the dependency chain'; at :171 write 'Name the tracing'. Renaming the FormulaDrawer summary instead would break two tests (below). Pair (a) with `open` on
  <br>_Collides:_ None found.
- **F5** (trivial) — The 6,000-line module stylesheet contains exactly TWO `:hover` rules — icu-hemodynamics.module.css:512 `.pacResizeHandle:hover::before` and :619 `.pacPathwayNav button:hover`. Not one action button has a hover state. `:focus-visible` is declared at :26-31 for `.labShell button/select/input/summary/a`, :460 `.resizableP
<br>_Fix:_ Extend the selector list at icu-hemodynamics.module.css:6012-6021 to `.pacActionDock`, `.skillsLab`, `.monitor`and`.formulaDrawer`descendants, and add`:hover`and`:active`to`.pacDockActionGrid button`(:1246),`.pacDockConfirmButton`(:1214),`.fastFlushButton`and`.checkResponseButton` (:2083). Min-heights are
  <br>_Collides:_ None — it satisfies one. docs/critical-care/activity-contract.md:123 states 'All controls and drawers are keyboard reachable with visible focus', which the guided pathway currently does not meet.
- **F7** (trivial) — WaveformRecognitionDrill.tsx:159-171 — after a commitment the card renders `<strong>…</strong>`, `<p>{answer.summary}</p>`, then `<ul>{answer.recognitionCues.map((cue) => <li key={cue}>{cue}</li>)}</ul>` with NO label. `recognitionCues` is 4–6 sentence-length lines (waveformAtlas.ts:225-231 is six; :294-299 and :355-36
  <br>_Fix:_ Reuse the module's own label in the drill: wrap WaveformRecognitionDrill.tsx:165-169 in `<h4>What identifies it</h4>` (matching WaveformAtlasPanel.tsx:98) and give `.drillFeedback ul` a real `list-style-type: disc`. Give the outstanding list one authored label — 'Still open in this section' — above :952; unlike ECMO's
  <br>_Collides:_ None. Tests that touch `recognitionCues` assert on the content array, not the render — waveform-teaching.test.tsx:64, h2-h3-reference-and-pac-safety.test.tsx:189,766,823.
- **F8** (small) — The module has THREE incompatible treatments of the same thing, and the sighted learner gets the equivalent for the anatomy figure but not for the curve the instruction tells them to read. (1) Visible labelled paragraph: PhysiologyPanel.tsx:141-147, `<strong>Visual text equivalent:</strong> {summary} …`. It disagrees w
  <br>_Fix:_ Pick one treatment and one label. Smallest: convert the three `sr-only` paragraphs to `<details>` with the same summary the other two use, and settle 'Read this state as text' vs 'Read this display as text' on one string across NormalWaveformReference.tsx:257 and NormalWaveformValidityChallenges.tsx:151. Separately, ad
  <br>_Collides:_ docs/critical-care/hemodynamics-h4-cardiac-output-methods.md:65 records that `cardiacOutputMethodTextEquivalent` 'assembles the text alternative from the same fields the panel' shows — that is the assembly rule and is un
- **F9** (small) — No counter here spans two sections, so ECMO's exact case does not recur. The generalized form does, twice. (a) Two numbered 1..N sequences on one screen with only one of them captioned in visible text: the phase stepper prints bare ordinals 1–6 beside Recognize…Transfer (ActivityStepper.tsx:40 `data-step={index + 1}`,
  <br>_Fix:_ (a) Pass a visible caption for the phase row rather than only `stepperAriaLabel` — the cheapest is a `<span>` in the ActivityChrome header saying the phases are the steps within this section, so the two number runs read as different units. (b) In PacAdvancementReasoningPanel.tsx, give the five `ordinal={4}` rows one sh
  <br>_Collides:_ None found; no comment or doc explains the repeated ordinal 4.
- **F10** (small) — The ECMO instance is already handled: every hemodynamics verdict goes through `AnswerVerdict`, which renders the `<details>` 'Why the other answers do not fit' (AnswerVerdict.tsx:263-276) whenever `showFullReasoning` is true (:208), and all seven call sites pass `timing="immediate-after-commit"` (PacGuidedSkillActivity
  <br>_Fix:_ (a) At PacGuidedSkillActivity.tsx:806, render `PacSectionCompletionActions` BESIDE the transfer `ChoiceReasoningFeedback` rather than instead of it (keep the `:941-946` block mounted when `completed`), or relabel the button at :969 to what it does. (b) Print the count in `.drillScore` (WaveformRecognitionDrill.tsx:105-
  <br>_Collides:_ None. pac-guided-skill-verdict.test.tsx:96-107's comment ('beside the objective rather than in place of it') argues FOR keeping the feedback mounted, not against.
- **F11** (medium) — All 13 authored items live in src/features/icu-hemodynamics/content/pacLearningItems.ts and every one has exactly three options. The specific ECMO defects recur, most of them module-wide. • A distractor asserting a FALSE claim, graded `reasonable-but-incomplete`, which AnswerVerdict.tsx:91-96 renders as 'Partly correct
  <br>_Fix:_ In pacLearningItems.ts: regrade the six false-claim distractors from `reasonable-but-incomplete` to `incorrect-mechanism` (and `mean-anywhere-deflate` :344-351 to `unsafe`, which the module already uses at :354 and :393); strip the absolutes at :114, :381-386, :550-556; replace `mitral-regurgitation` :270-276 with a ri
  <br>_Collides:_ All 13 items carry `reviewStatus: 'sme-review'`, which pac-learning-items.test.ts:16-17 pins. Regrading a plausibility and rewriting an SME-reviewed stem is a clinical-copy change and needs the owner's eye, exactly as R5
- **F12** (small) — The `frames` prop is unreachable here: icu-hemodynamics never imports the shared `ChoiceReasoningFeedback`. PacGuidedSkillActivity.tsx:111-140 defines a LOCAL function of the same name that wraps `AnswerVerdict`, and the module's other six verdicts call `AnswerVerdict` directly. So the stated fix does not apply — but t
  <br>_Fix:_ Replace the two fixed sentences at PacGuidedSkillActivity.tsx:88-97 and :134 with per-section framing keyed off `skillId`, or delete `likelyFrameByPlausibility` and let `AnswerVerdict`'s own titles carry it (what ECMO did). Define 'working frame' once, in one clause, at CaseWorkflow.tsx:79-80 where the learner first me
  <br>_Collides:_ Turning on `outcome="stated"` would take an explicitly opt-in decision that AnswerVerdict.tsx:60-71 and :167-177 record as per-module and owner-taken ('the finding came from one owner reviewing one module… Each lab's own
- **X1** (small) — ResizablePacWorkspace.tsx:113 `const [compactPane, setCompactPane] = useState<PacWorkspacePane>('monitor')` — there is no `preferredCompactPane`, so the one-pane view always opens on Monitor, while every section's objective control lives in the Activity pane (`SkillSurface`, PacGuidedSkillActivity.tsx:1034-1044; the ob
  <br>_Fix:_ Add an optional `preferredCompactPane?: PacWorkspacePane` to ResizablePacWorkspace.tsx (followed, not forced — mirror ResizableTeachingWorkspace.tsx:68-78, never `activePane`, which would remove the switcher), and derive it in PacGuidedSkillActivity.tsx:1028 from the phase: 'controls' for Predict/Act/Observe, and 'phys
  <br>_Collides:_ None found.
- **X4** (small) — `commitPrediction` (PacGuidedSkillActivity.tsx:743) and forward moves in `selectPhase` (:684-690) call `setState(actionSkillState(skillId))`, replacing the WHOLE simulation state — `signalValidationChecks` included — and `ResizablePacWorkspace` and `SkillSurface` are keyed `${skillId}-${phase}` (:1029, :1036) so every
  <br>_Fix:_ Either preserve `signalValidationChecks` across the Predict→Act reset (merge them into the fresh state in `actionSkillState`'s callers), or say it: `commitPrediction` already calls `setMessage` at :742, so append the sentence `reset()` already uses at :708 ('Activity reset to its authored setup') for the sections whose
  <br>_Collides:_ The three-state design (`actionSkillState` / `predictionSkillState` / `transferSkillState`) is deliberate and documented for thermodilution only (:301-308, H4 §9/§10). Nothing records a decision to erase Predict work on
- **X5** (small) — There is not one `<details>` in PacMeasurementTeaching.tsx, CardiacOutputMethodModel.tsx, PressureSystemValidityPanel.tsx or PacSkillsLab.tsx, and `learningPane` (PacGuidedSkillActivity.tsx:974-1007) branches on `skillId` with a phase branch only for `waveform-interpretation`. So every teaching panel is fully expanded
  <br>_Fix:_ Scope the two uncommented panels to the phases their content belongs to, in PacGuidedSkillActivity.tsx:974-1007 — the same one-line phase branch already used for `waveform-interpretation` at :977-983. Leave `CardiacOutputMethodModel` alone.
  <br>_Collides:_ Scoping `CardiacOutputMethodModel` would undo the recorded H4 §6 decision at PacGuidedSkillActivity.tsx:995-998, backed by docs/critical-care/hemodynamics-h4-cardiac-output-methods.md. Do not touch that one.

**Found in this module and not in ECMO:**

- src/features/icu-hemodynamics/components/PacGuidedSkillActivity.tsx:1031 — the guided pathway passes `onOpenCardiacOutput={showHint}`, so the bedside monitor's button labelled 'Cardiac output' (BedsideMonitor.tsx:470-472) reveals `spec.explanation[0]` as a hint in the Current task pane instead. In t
- src/features/icu-hemodynamics/components/ResizablePacWorkspace.tsx:262-276 — the compact pane tablist has roving `tabIndex` (:271) and no `onKeyDown`, so below 960 px of usable width a keyboard-only learner can reach only whichever pane is selected and can never get to the other two. The shared comp
- src/features/icu-hemodynamics/components/PacAdvancementReasoningPanel.tsx:136,143,149,155,161 — five consecutive `ObservationRow ordinal={4}`, so the reasoning chain reads 1, 2, 3, 4, 4, 4, 4, 4, 5, then a second `<ol start={6}>` (:210) with hard-coded 6/7/8 spans. Two numbering mechanisms that can
- src/features/icu-hemodynamics/components/ResizablePacWorkspace.tsx:45-49 vs :284/:319/:354 — two vocabularies for the same three panes. The compact tabs say Monitor / Anatomy / Activity; the regions say 'Monitor panel' / 'Anatomy and pressure-reference panel' / 'PAC controls and waveform-teaching pa
- Verdict theme split within one pathway: PressureSystemValidityPanel.tsx:133-138 passes `theme="light"` while NormalWaveformValidityChallenges.tsx:126-131, PacAdvancementReasoningPanel.tsx:204-209, PawpSafetySequencePanel.tsx:105,287 and the local wrapper at PacGuidedSkillActivity.tsx:121-125 all pas
- Every list in the module is markerless. Tailwind 3.4.19 preflight zeroes `list-style` on `ul`/`ol`; icu-hemodynamics.module.css declares `list-style: none` in 11 further places (:189, :593, :1168, :1691, :2642, :2891, :4347, :4842, :5312, :5636, :5907) and never restores a `list-style-type` anywhere
- src/features/icu-hemodynamics/components/HemodynamicNativeWorkspace.tsx:67-72 — `FormulaDrawer` is itself a `<details>` (FormulaDrawer.tsx:84) and is wrapped here in a SECOND `<details>` with no `open`, while its two siblings at :51 and :62 are `<details open>`. Two clicks to reach the derived-revie
- src/features/icu-hemodynamics/components/PacGuidedSkillActivity.tsx:1153 — `targets={completed && nextSection ? [nextSection.title] : [spec.title]}` fills TaskPanel's visible 'Targets' list with the section title, which is already the page `<h1>` at :1088. A visible, already-styled slot printing not

### baxter-crrt

**Shape.** NOT a ResizableTeachingWorkspace caller, and NOT single-column. CRRT Learn is the ONLY caller anywhere in the repo of the shared `ActivityShell layout="didactic-lesson"` (`src/features/baxter-crrt/components/BaxterCrrtLearn.tsx:372`; `grep -rn didactic src` returns no other caller), so `src/features/learning-module/components/DidacticLessonFrame.tsx` and the `.didactic*` CSS block are effectively CRRT-private while living in the shared directory.

TWO PANES plus a strip. `DidacticLessonFrame` is a two-column grid — `learning-module-v2.module.css:577-584`, `grid-template-columns: minmax(0,1fr) minmax(18rem,24rem); align-items: start` — collapsing to one column at `max-width:1199px` or `max-height:699px` (:850-895):
• Row 1 full width: `ClinicalContextStrip` — `<section aria-label="Clinical context">`, horizontally scrolling, `max-height:8.5rem`, holds `PatientContextBar` + `ResumeBanner`.
• Row 2 col 1 (wide): `<section aria-label="Simulation viewport">` (`DidacticLessonFrame.tsx:23`) — holds NO simulation. It holds the whole lesson document: `PathwayNav` + `<article>` (header, "Clinical anchor", 2 paragraphs, a bullet `<ul>`, up to two embedded labs, the "Clinical application" item, an advanced `<details>`, an evidence footer). `BaxterCrrtLearn.tsx:496-648`.
• Row 2 col 2 (narrow, sticky and actually sticking): `<aside aria-label="Current task">` (`DidacticLessonFrame.tsx:20`) holding `TaskPanel` (visible `<h2>Current task</h2>`, `TaskPanel.tsx:32`) and, only once evidence is met, `PathwaySectionCompletion`.

NO STEP MODEL. `lessonPhase` (`BaxterCrrtLearn.tsx:192`) reaches only `ActivityShell phase=` (:384) and analytics (:261) — it gates nothing on screen. The authoring unit is the LESSON: 8 ids in `content/learnerRegistry.ts:31-40`, each with one `BaxterCrrtLessonClinicalAnchor` (`content/lessonClinicalAnchors.ts:8-17`: `immediateGoal`, optional `labEvidenceLabel`, one `applicationItem`). The shared six-phase ribbon Recognize→Transfer sits above everything and CRRT Learn never reaches `transfer` (`advanceLessonPhase`, :265-271, tops out at `explain`).

The pane also scrolls the DOCUMENT, not itself: `.activityShell[data-layout='didactic-lesson']{height:auto;overflow:visible}` (:607-611) and `.didacticViewport{overflow:visible}` (:596), while CRRT's own `.activityViewport{height:100%;overflow:auto}` (baxter-crrt.module.css:35-40) sits in an `align-items:start` grid item and so never gets a bounded height. CRRT is the one activity that does not honour `docs/critical-care/activity-contract.md:101` "internally scrolling panels instead of document scrolling" — which is why F3 bites harder here than in ECMO.

**Baseline.** `npx jest src/features/baxter-crrt` → 49 suites / 561 tests, ALL PASSING (~4.6 s). CRRT-touching suites outside the feature dir: `npx jest 'src/app/\[locale\]/baxter-crrt' src/app/sitemap.baxter-crrt src/lib/site-search.baxter-crrt src/lib/draft-modules.baxter-crrt src/features/learning-module` → 17 suites / 125 tests, all passing. `npx jest src/features/critical-care/__tests__` → 13 suites / 132 tests, all passing on a clean run; NOTE a load-dependent flake — the first full-directory run failed 1 test at `src/features/critical-care/__tests__/accessibility.test.tsx:114` (declared at :109), which then passed both when that file was run alone (18/18) and on a repeat of the full directory. Treat 49/561 + 17/125 + 13/132 as the number a later session compares against.

**Applies:**

- **F1** (small) — src/features/learning-module/components/DidacticLessonFrame.tsx:23 — `<section className={styles.didacticViewport} aria-label="Simulation viewport">`, the pane that holds CRRT's entire lesson article. It has NO visible caption; its only accessible name calls a reading pane a simulator. Same at src/features/learning-mod
  <br>_Fix:_ Give the wide pane a name in CRRT's own vocabulary. Add an optional `viewportLabel` prop to DidacticLessonFrame (defaulted to 'Simulation viewport' so nothing else moves) and have BaxterCrrtLearn.tsx:372 pass 'Lesson panel'; then render one visible caption line inside `styles.lessonDocument` above the PathwayNav at Bax
  <br>_Collides:_ docs/critical-care/activity-contract.md:96-101 names the workspace parts as 'stable simulation viewport' and 'predictable current-task panel'. Renaming the didactic viewport departs from that vocabulary — but that list i
- **F2** (medium) — There is no per-step `requiredAction` in CRRT at all — there are 8 `immediateGoal` strings, 2 `labEvidenceLabel` strings and one hard-coded fallback, and not one names a pane, a heading or a control. src/features/baxter-crrt/components/BaxterCrrtLearn.tsx:431-435: `requiredAction` is `'Answer the patient application ch
<br>_Fix:_ Add `lookIn?: { pane: 'Lesson panel' | 'Current task'; landmark: string }`to`BaxterCrrtLessonClinicalAnchor` (lessonClinicalAnchors.ts:8-17), authored per lesson with the on-screen heading verbatim ('Apply the lesson to this patient', 'Staged Prescription Builder', 'Pressure Localization Lab', 'Live pressure profile'
  <br>_Collides:_ None. docs/critical-care/activity-contract.md:20-24 ('Where am I? / What am I expected to do? / What happens next?') argues for the change.
- **F3** (small) — src/features/baxter-crrt/components/BaxterCrrtLearn.tsx:434 says "Answer the patient application check." The section it means is headed `<span>Clinical application</span>` + `<h3 id="crrt-application-heading">Apply the lesson to this patient</h3>` (BaxterCrrtLearn.tsx:116-117). The phrase 'patient application check' ap
  <br>_Fix:_ Change the two literals at BaxterCrrtLearn.tsx:433-434 to name the heading verbatim — '… then answer "Apply the lesson to this patient", at the end of the lesson panel'. Give `BaxterCrrtLessonClinicalAnchor` its own `hint` field instead of reusing `paragraphs[0]` at :437. Replace `targets` with an authored per-anchor l
  <br>_Collides:_ None.
- **F5** (trivial) — src/features/baxter-crrt/components/CrrtLivePressureDevice.tsx:242-270 renders six `<button className={styles.signalCard}>` — the controls that change what the whole profile AND the linked circuit show. src/features/baxter-crrt/components/crrt-live-pressure-device.module.css:168-202 gives them `cursor: pointer`, `min-h
<br>_Fix:_ In crrt-live-pressure-device.module.css add `.signalCard:hover`and`.signalCard:active`beside the existing`[data-selected='true']` rule at :194-198 (a background/border-weight shift, matching the module's no-colour-alone rule). Promote the group's aria-label at CrrtLivePressureDevice.tsx:237-241 to a visible line ab
  <br>_Collides:_ docs/baxter-crrt/novice-think-aloud-c0-c1.md:31 instructs the facilitator to 'Give the participant control of the view buttons and say nothing about what they do', and :103 anticipates 'Task 2 may need one prompt to disc
- **F7** (small) — EXACT match, verified in CSS. src/features/baxter-crrt/components/BaxterCrrtLearn.tsx:542-548 renders `selectedLesson.bullets` as a bare `<ul><li>`. Tailwind 3.4.19 preflight (node*modules/tailwindcss/lib/css/preflight.css:304-310) sets `ol, ul, menu { list-style: none; margin: 0; padding: 0 }`; src/features/baxter-crr
  <br>\_Fix:* Add `list-style: disc; padding-left: 1.25rem` to baxter-crrt.module.css:786. Add an authored per-lesson label to `BaxterCrrtLearnLesson` (learnLessons.ts:7-13, e.g. `bulletsLabel: string`), rendered as a small heading above the `<ul>` at BaxterCrrtLearn.tsx:542 and passed through in place of TaskPanel's hardcoded 'Targ
  <br>_Collides:_ None. Nothing in docs/baxter-crrt or in the CSS comments defends the markerless list.
- **F9** (trivial) — No counter spans two lessons, so F9 as stated does not occur — but the collision it caused in ECMO is present here and worse. On `crrt-anticoagulation` one screen carries FIVE counters: the six-step phase ribbon Recognize…Transfer (ActivityStepper.tsx:33-56), whose sixth step CRRT Learn never reaches; 'Section 6 of 8'
  <br>_Fix:_ Three small edits: (a) change 'Seven' to 'Eight' at BaxterCrrtModuleNav.tsx:16, BaxterCrrtHub.tsx:100 and docs/baxter-crrt/README.md:8; (b) delete the duplicate section counter at BaxterCrrtLearn.tsx:512-516 and let PathwayNav be the only 'Section N of 8'; (c) name the citrate walk's counter for what it counts at CrrtC
  <br>_Collides:_ src/features/critical-care/content/learningPathways.ts:97-108 records deliberately why the pathway is eight sections carrying nine progression steps. The 'Seven' strings predate or ignore that; correcting them undoes not
- **F10** (small) — Here it is a CONTRACT violation, not only a broken instruction. docs/critical-care/activity-contract.md:44-47 states the learner-facing verdict 'offers a disclosure covering why the other answers do not fit', and :51 sets Guided (Learn) as 'commit → verdict immediately → separate Continue' — exactly CRRT Learn. src/fea
  <br>_Fix:_ A `CrrtOtherAnswers` sibling of ECMO's `EcmoOtherAnswers`: a `<details>` rendered inside `styles.applicationFeedback` at BaxterCrrtLearn.tsx:136, summary 'Why the other answers do not fit', listing `item.choices.filter(c => c.id !== submittedChoiceId)` as label — rationale. ~20 lines plus one `.otherAnswers` block in b
  <br>_Collides:_ docs/critical-care/activity-contract.md:70-74 forbids printing the debrief's causal chain BEFORE commitment; a folded post-commitment disclosure satisfies that. Nothing to undo — the change brings CRRT into the contract
- **F11** (medium) — Six of the eight items, across three defect classes; two of ECMO's sub-defects are genuinely absent. (a) KEY RESTATES THE ON-SCREEN OBJECTIVE — a contract violation. docs/critical-care/activity-contract.md:70-73: a prediction step 'may not name the expected goal, control or direction in its title, instruction, rational
  <br>_Fix:_ All in content/lessonClinicalAnchors.ts. (1) Move each long key's trailing clause into its own `rationale`, where three of them already half live — the ECMO fix applied verbatim. (2) Flip the two mis-graded `plausibility` values to `incorrect-mechanism` (the enum already carries it and each item already has one, so not
  <br>_Collides:_ learnLessons.test.ts:49-51 records 'Three competing frames is the module's floor; the integration capstone carries four, one per circuit location the pressure profile has to discriminate between' — so ECMO's 'add a fourt
- **F12** (small) — CRRT is the module the shared strings fit worst. src/features/baxter-crrt/components/BaxterCrrtLearn.tsx:137-142 calls `ChoiceReasoningFeedback` with `choice`, `explanation`, `evidenceIds`, `conceptIds` — no `outcome`, no `frames` — so it takes every default: 'The cues support this read.' (ChoiceReasoningFeedback.tsx:5
  <br>_Fix:_ At BaxterCrrtLearn.tsx:137 pass `outcome="stated"` and a CRRT `frames` object with four sentences written for prose vignettes (no 'cues', no 'pattern shown here', no 'working frame'). At :136 set `data-correct={submittedChoice.plausibility === 'best'}` so the green rule that already exists finally fires. Optionally ren
  <br>_Collides:_ ChoiceReasoningFeedback.tsx:35-48 is the doc comment written to make `frames` opt-in per caller, and :13-22 records that the outcome label was added on an owner review 'about one module' and is opt-in for the same reason
- **X2** (trivial) — On the context strip, not the task panel — the opposite of what a quick look suggests. src/features/learning-module/components/learning-module-v2.module.css:586-591 `.didacticLessonFrame > .contextStrip { position: sticky; z-index: 5; top: 0; grid-column: 1 / -1 }`. It is the ONLY item in grid row 1 of an auto-sized ro
  <br>_Fix:_ Since CRRT is the only caller of this layout, the smallest true change is to delete `position: sticky` and `top: 0` from learning-module-v2.module.css:587-588 so the strip's behaviour matches its declaration. If it is meant to stick, it has to leave the grid — move the strip out of `.didacticLessonFrame` in DidacticLes
  <br>_Collides:_ ClinicalContextStrip.tsx:7-34 documents the strip at length (tab stop, arrow-key scrolling, why the role and name stay) and says nothing about stickiness, so the sticky is undefended.
- **X3** (trivial) — Four authored-and-never-read payloads. (1) `.applicationFeedback[data-correct='true']` at src/features/baxter-crrt/components/baxter-crrt.module.css:1040 — nothing in the module sets `data-correct`, so the correct-answer palette never renders (see F12). (2) `visualAssetIds: ['crrt-circuit-path', 'crrt-pressure-pattern'
<br>_Fix:_ (1) and (4) are fixed by the F12 and F10 changes respectively. (2) either render the two named circuit visuals beside the pressure item or drop the field from lessonClinicalAnchors.ts:104 — the schema makes it optional. (3) leave it: it is the authored key of record and the shared schema cross-checks it against `plausi
  <br>_Collides:_ None.
- **X4** (small) — Two instances. (1) src/features/baxter-crrt/components/CrrtPressureLocalizationLab.tsx:208-211 `changeSite` and :195-206 `changeFault` both call `clearCommit()` (:188-193), which resets ALL SIX direction predictions to null via `emptyPrediction()`. The prediction fieldset is only `disabled` after commitment (:352), so
  <br>_Fix:_ (1) In CrrtPressureLocalizationLab, keep the six predictions across a fault/site change — `clearCommit` only needs to clear `committedPrediction` and `revealed`; pass the current `prediction` through instead of `emptyPrediction()` at :188. If clearing is deliberate, say so in the `role="status"` region and render that
  <br>_Collides:_ None. `clearCommit`'s default argument (`nextPrediction: DraftPrediction = emptyPrediction()`) reads as a convenience rather than a decision, and carries no comment.
- **X5** (medium) — Maximal form: NOTHING in the CRRT lesson document is scoped to a phase. `lessonPhase` (src/features/baxter-crrt/components/BaxterCrrtLearn.tsx:192) is referenced in exactly three places — `useCriticalCareActivityAnalytics` (:261), `ActivityShell phase=` (:384), and its own declaration — so every block renders fully at
  <br>_Fix:_ Do NOT retro-fit phase gating — that is the ECMO stage rebuild, not a small change. The smallest honest change is to stop the ribbon implying otherwise: make the jump handler (:388-397) actually reveal/scroll to the block each phase belongs to (see F2), and stop offering a jump to `transfer`, which CRRT Learn never rea
  <br>_Collides:_ docs/critical-care/activity-contract.md:11-17 mandates the six-phase presentation for 'every interactive activity' and :86-90 forbids earning Transfer without an authored variation — so the six-step ribbon and the unreac

**Found in this module and not in ECMO:**

- src/features/baxter-crrt/components/BaxterCrrtLearn.tsx:388-397 — the phase ribbon's jump handler sends Act, Explain AND Transfer to `crrt-learn-viewport`, the top of the page. Act is the one phase that names a doable interaction, and it scrolls the learner away from the labs; the four lab heading i
- src/features/baxter-crrt/components/BaxterCrrtLearn.tsx:415-423 — the ResumeBanner guard `validLessonId(initialLessonId)` is a tautology: `BaxterCrrtLearn` (:129-136) only renders the workbench when that is already true. So EVERY visit, including a first one, is told "Lesson selection restored" / "<
- src/features/learning-module/components/learning-module-v2.module.css:476-479 — `.contextStrip > .resumeBanner { min-width: min(32rem, 70vw) }` adds 32rem to a strip that ClinicalContextStrip.tsx:10-14 documents as already overflowing by four figures, so that banner and its solid-accent 'Resume acti
- src/features/baxter-crrt/components/BaxterCrrtLearn.tsx:436-437 — the right pane's 'Targets' list and its 'Show hint' payload are both verbatim copies of text already visible in the left pane (`bullets.slice(0,4)` duplicating the `<ul>` at :542-548; `paragraphs[0]` duplicating :539-541). `showHelp`
- src/features/baxter-crrt/components/BaxterCrrtModuleNav.tsx:16 (`description: 'Seven didactic lessons'`) and src/features/baxter-crrt/components/BaxterCrrtHub.tsx:100 ('Seven real didactic lessons with a prescription lab and pressure-localization lab.') — the pathway has EIGHT sections (content/lear
- src/features/learning-module/components/ActivityChrome.tsx:65 — `aria-label={`${activityTitle} simulation workspace`}` names CRRT's reading route a simulation workspace, compounding DidacticLessonFrame.tsx:23's 'Simulation viewport'. Shared file, but CRRT is the only didactic-lesson caller. Same cla
- src/features/baxter-crrt/components/CrrtStagedPrescriptionBuilder.tsx:596-598 and :634-636 vs CrrtCitrateDifferential.tsx:178-180 and :229-231 vs PathwayNav.tsx:35-37 vs BaxterCrrtLearn.tsx:512-516 — four independent 'N of M' counters plus the six-step ribbon, two of them ('Section 6 of 8') identica
- docs/baxter-crrt/novice-think-aloud-c0-c1.md:3 — "**Status: no novice testing has yet occurred.** This document is the protocol, not a report." ECMO's twelve findings came from one learner walk. CRRT has never had one, so every APPLIES above is a code reading rather than learner evidence, and every

### icu-simulation

**Shape.** Not a lesson stage and not an authored step player — a bedside workbench. `IcuSimulatorLab.tsx` (1197 lines) renders one `ActivityChrome layout="native-workbench"` around `.workspace`, a CSS-grid of FOUR surfaces (icu-simulation.module.css:1399-1429): `monitor` top-left, `course` top-right, `clinical` bottom-left, `devices` bottom-right (2×2 above 1100px, single column 1100-821px, one-at-a-time below 820px). It does NOT use `ResizableTeachingWorkspace`; it has no pane splitter, no `defaultWidthFractions`, and no `StageLayout`. There is no per-step instruction model at all: the only "step" surface is the shared six-phase `ActivityStepper` (Recognize/Predict/Act/Observe/Explain/Transfer) whose phase is DERIVED from state (IcuSimulatorLab.tsx:285-296), never authored, and which carries no instruction text. The learner-facing guidance is `IcuCaseGuide` (IcuClinicalPanels.tsx:395-763) in the `course` surface: opening narrative, a 6-option "Working shock mechanism" commit, learning objectives, a 2-item "Course checkpoints" list, and a debrief. Four modes (learn/practice/assess/sandbox) share the same lab; `learn` additionally has one didactic single-column page, `IcuWorkspaceOrientation.tsx` (94 lines, `/icu-simulation/learn?activity=workspace-orientation`), and a `PathwayLanding`. No MCQ items, no distractor rationales, no `ChoiceReasoningFeedback`/`AnswerVerdict` anywhere in the feature (grep: 0 hits).

**Baseline.** 11 suites / 104 tests, all passing — module suites `npx jest src/features/icu-simulation` = 7 suites / 77 tests (capstone-entry, components, content, engine, persistence-scoring-worker, public-scenario-manifest, response-scoring); plus 4 suites / 27 tests that own this module elsewhere (`src/app/[locale]/icu-simulation/routes.test.tsx`, `.../layout.test.tsx`, `src/lib/draft-modules.icu-simulation.test.ts`, `src/lib/icu-simulation-analytics.test.ts`). Also gating, not counted: `src/features/critical-care/__tests__/learner-copy.test.ts` (4 tests, 34 s) scans every .tsx under `src/features/icu-simulation/components` for the banned static-UI words (engine, reducer, seed, localstorage, score, grade, mastery, exam, quiz, assessment, competency, certification) — any new visible copy or aria-label added there must clear it.

**Applies:**

- **F1** (small) — src/features/icu-simulation/components/IcuSimulatorLab.tsx:1110-1160 — the four grid surfaces are named only by `aria-label`: `aria-label="Patient monitor and bedside overview"` (:1116), `aria-label="Diagnostic and care actions"` (:1127), `aria-label="Device controls"` (:1141), `aria-label="Course guide and trends"` (:
  <br>_Fix:_ Render `surfaceCopy[surface].label` + `.detail` as a visible caption at the top of each `.workspaceSurface` (one `<p className={styles.surfaceCaption}>` per section, four call sites at IcuSimulatorLab.tsx:1112/1123/1137/1147), and swap each section's hardcoded `aria-label` for `aria-labelledby` pointing at that caption
  <br>_Collides:_ None found. docs/icu-simulation/{README,engine,review-checklist,risk}.md say nothing about surfaces, panes, or labelling; the only nearby code comment is IcuSimulatorLab.tsx:808 '{/\* The pathway rail stays visible while
- **F3** (trivial) — src/features/icu-simulation/components/IcuSimulatorLab.tsx:903 — the Help panel's first line is `<strong>Use the native Course surface for the current task.</strong>`. At every width above 820px nothing on screen is called 'Course': the `course` surface's only visible heading is the scenario title (IcuClinicalPanels.ts
  <br>_Fix:_ Two words, one line: change :903 to name what the learner can see, e.g. `Use the Course guide — the panel headed with the patient's course title — for the current task.` Cheaper and better after F1 lands: with the caption rendered, the existing sentence becomes true as written once 'native' is dropped.
  <br>_Collides:_ None.
- **F4** (small) — Half already handled, one live gap. Handled: the device fieldset is disabled by status and says so on the device — `IcuDevicePanels.tsx:147` `<fieldset disabled={status === 'off'} className={styles.deviceControls}>` beside :137-140 `'Complete the supervised readiness workflow before changing support.'`, and an out-of-s
  <br>_Fix:_ `IcuDiagnosticsPanel`, `IcuCarePanel` and `IcuDevicePanels` all already receive `state`. Derive `const courseClosed = state.phase === 'debrief'` in each, wrap `.orderGrid` / `.careGrid` / the reassess button in the fieldset idiom the module already uses (`<fieldset disabled={courseClosed}>`), and print one line in the
  <br>_Collides:_ None. docs/icu-simulation/engine.md:57-61 discusses debrief-time credit rules but never says the controls stay live after completion; commands.ts:163 carries no comment.
- **F6** (trivial) — Reduced form, and the reverse of ECMO's: the skip control does not out-shout the work control, it MATCHES it. `IcuClinicalPanels.tsx:753-760` renders `<button className={styles.completeButton}>Complete course and open debrief</button>` as the last thing in the Course guide whenever the phase is not yet debrief, styled
  <br>_Fix:_ Give the exit control the module's existing secondary weight and one line of consequence: add `data-secondary="true"` to the button at IcuClinicalPanels.tsx:754 and a matching `.completeButton[data-secondary='true']` rule mirroring `css:1049` (`.resumeActions button[data-secondary='true']`), plus a `<small>` under it s
  <br>_Collides:_ None documented. docs/icu-simulation/README.md:29-31 describes the mastery gate but says nothing about when completion may be offered.
- **F7** (trivial) — One instance, in the orientation. `src/features/icu-simulation/components/IcuWorkspaceOrientation.tsx:52-61` renders `section.bullets` as an unlabelled `<ul className="mt-4 grid …">` of `<li className="rounded-xl border bg-card px-4 py-3">` with no heading and no marker (Tailwind preflight strips list markers). The two
  <br>_Fix:_ Add `readonly bulletsLabel?: string` beside `bullets` on `IcuOrientationSection` (content/workspaceOrientation.ts:22-27), author one label per list ('What this means in practice' / 'How to run the loop'), and render it as a `<p className="mt-4 text-sm font-semibold">` immediately above the `<ul>` at IcuWorkspaceOrienta
  <br>_Collides:_ None. `IcuWorkspaceOrientation` has no rendering test — src/app/[locale]/icu-simulation/routes.test.tsx:27 mocks it out as `<div data-testid="icu-workspace-orientation" />` — and content.test.ts never touches workspaceOr
- **F8** (small) — Same class, different mechanism: this module has no visible text-equivalent paragraph that could disagree with a visual label, but the four surfaces carry FOUR competing vocabularies for the same four regions, only one of which is ever visible and only below 821px. Accessible names: 'Patient monitor and bedside overvie
  <br>_Fix:_ Same single edit as F1 — make `surfaceCopy` the one source: caption from it, `aria-labelledby` from the caption, and the Help sentence at :903 quoting the same label. Then the accessible name cannot drift from the visible one, because there is only one string.
  <br>_Collides:_ None.
- **F10** (small) — Not the multiple-choice card — the commitment trace. `IcuClinicalPanels.tsx:475-476` promises, in Challenge mode, 'Your first commitment stays in the decision trace; later reclassification shows how your frame changed.' The debrief's Classification review then prints only three rows (:623-643): 'Latest commitment', 'Ex
  <br>_Fix:_ In the 'Serial commitments' block at IcuClinicalPanels.tsx:638-642, keep the count and render the list beneath it: `state.diagnosis.commitments.map(c => `${formatTime(c.committedAtSeconds)} — ${classificationCopy[c.classification]}`)`. Both helpers (`formatTime`, `classificationCopy`) are already in this file. One `<ul
  <br>_Collides:_ Nothing forbids it, but the neighbouring copy sets the tone the addition must keep: IcuClinicalPanels.tsx:566-570 'This review highlights the explanations and refreshers most closely related to that sequence; it does not
- **F12** (trivial) — The second half of F12 only — undefined borrowed vocabulary, no shared verdict card. `IcuClinicalPanels.tsx:475-477`: Challenge mode says 'later reclassification shows how your frame changed', Learn/Practice say 'You may revise the working frame as the patient response evolves.' 'Frame' appears nowhere else in the feat
  <br>_Fix:_ Two words at IcuClinicalPanels.tsx:476-477: 'how your classification changed' and 'You may revise the working classification as the patient response evolves.' — the term the heading, the select label ('Classification'), the debrief section ('Classification review') and the orientation all already use. No prop, no share
  <br>_Collides:_ None; these strings carry no comment and no docs reference.
- **X3** (trivial) — Same class — authored per-scenario data validated and then not read by the renderer — with a duplicate hardcoded map in its place. `content/schema.ts:384` requires `expectedClassification` and all six scenarios author it (content/scenarios.ts:228, 523, 849, 1203, 1441, 1681); the engine reads it (`engine/simulation.ts:
<br>_Fix:_ `IcuCaseGuide`already takes`scenario`. Replace :423 with `const expectedClassification = scenario.expectedClassification`and delete the map at :197-206 (and the now-unused`IcuScenarioFamily` import if nothing else uses it).
  <br>_Collides:_ None; the map has no comment explaining why it duplicates the content.

**Found in this module and not in ECMO:**

- src/features/icu-simulation/components/IcuClinicalPanels.tsx:944-961 + src/features/icu-simulation/engine/simulation.ts:749-754 — F4 class, in reverse: pressing 'Reassess all domains' before the model has had a post-intervention minute (`hasPostInterventionInterval`, simulation.ts:649-659) still fil
- src/features/icu-simulation/components/IcuSimulatorLab.tsx:1075-1079 — the pre-debrief dead-clock case has an explanation ('Authored course window reached · complete the course to open the debrief') but the post-debrief one does not: the same three transport buttons are also disabled by `state.phase
- src/features/icu-simulation/components/IcuSimulatorLab.tsx:903 — 'Use the native Course surface for the current task.' leaks build vocabulary into learner copy: 'native' here is the `layout="native-workbench"` prop name (:787), not anything the learner can see. It clears the learner-copy gate only b
- src/features/icu-simulation/components/icu-simulation.module.css:934-960 — `.modeNav` (24 lines, including the `position: sticky` X2 would have been about) has no consumer anywhere in the feature; the module nav renders `.icuModuleNav` (IcuSimulatorModuleNav.tsx:31). Dead CSS.
- src/features/icu-simulation/components/IcuSimulatorLab.tsx:1116/1127/1141/1151 vs :164-167 — the same four regions carry two different name sets (long aria-label vs short visible label) with no shared source; noted under F8 and fixed by the same edit as F1.
