# Mechanical circulatory support — the 2026-09-07 learner-review round

The ECMO module's R5 round — twelve points from an outside learner, generalised into seventeen
findings in [`learner-review-cross-module-brief.md`](./learner-review-cross-module-brief.md) —
applied to this module. Companion to [`mcs-flow-rebuild.md`](./mcs-flow-rebuild.md) and
[`mcs-learn-section-contracts.md`](./mcs-learn-section-contracts.md), which this record amends in
four places (MLR-OD-1, MLR-OD-2, MLR-OD-3, MLR-OD-5). Branch `claude/mcs-learner-review`, cut from
`origin/main` at `c178ee84` (the merged hemodynamics learner-review branch, PR #129). Seven
commits; the shared card first.

## What the brief got wrong about this module, and where the code won

The brief's MCS appendix was read on 2026-09-06 against a surface PR #126 had already replaced,
and its rows are truncated at about three hundred and forty characters in the committed file
itself, mid-sentence. Every file it cites for the layout findings — `McsLearnSection.tsx`, the
three `McsLearn*Pane`s — no longer exists. The Learn surface is
`components/stage/McsStageHost.tsx` on the shared `learning-module/stage` package, and the
hemodynamics round (PR #129) had already given that package its captions, order, width options,
`lookIn`, `NowCard.where` and `compactPane`. So the brief's prompt 0 was done, and this module's
work was everything on top of it.

Five statuses moved when read against the code:

| Finding | Brief | Code                                                                                                                                                                                                                                                        |
| ------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F5      | ○     | Applies on the stage: the guided actions, surface toggles and reveal toggle had a focus ring and nothing else (`mcs-stage.module.css` before this round)                                                                                                    |
| F7      | —     | Applies on the stage: the stop card's checklist had a generic bold label not associated with the list, and no markers under the Tailwind v4 preflight                                                                                                       |
| F9      | —     | Confirmed: the walk's "Stop N of 5" is within one section, identical on both cards, and the map prints no stop numbers                                                                                                                                      |
| F10     | —     | Does not apply as stated, but `mcs-learn-section-contracts.md` claimed the stage showed "why the alternatives do not" through `AnswerVerdict`, and it rendered `ChoiceReasoningFeedback`, which could not — MLR-OD-5                                        |
| X3–X5   | ●/●/● | X3 applies (the before/after labels reached the step and nothing rendered them); X4 does not on the stage (the balloon baseline against the durable-pump baseline is the comparison section 2 asks for); X5 does not (every block is a scoped `StageBlock`) |

Baselines were 28 suites / 661 tests and 37 / 328, not the brief's 21 / 748 and 35 / 309.

## Two things worse than the twelve, found here

1. **The three-dimensional view leaked the mechanism before the commitment.**
   `McsSimulatorPane.tsx` mounted `McsAnatomy3D` with `revealCausality` at its default of true,
   and its text equivalent prints the engine's causal explanation of the state on screen — on the
   timing section, the impedance the learner is about to predict, which is that section's own
   deny pattern. Its pathway summary also prints "Nothing enters it" and "bypassing the right
   ventricle", the second and sixth sections' identifications in the words of their deny
   patterns. The surface was closed behind a disclosure and a launch gate, two clicks away, and
   the rendered leak scan never opened it because the surface is unmounted while closed. MLR-OD-2.
2. **Eight of nine predictions offered a move where the stem asks for a forecast.** The
   validator's rule that every prediction offers an unsafe branch was being met by changing the
   kind of question — "raise the assist ratio instead", "disconnect the power source briefly",
   "whatever happens, raise the speed" — so the odd option out could be picked by its shape
   alone. MLR-OD-3.

## Finding by finding

| Finding | What was there                                                                                                                                  | What shipped                                                                                                                                                                                                                                                                                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1      | No pane order, captions or compact pane passed to the shared stage; region names only in `aria-label` and the compact tab row                   | "Steps panel · what to do", "Teaching panel · what to read", "Simulator panel · the monitor, the map and the controls", sticky at the head of each pane. Steps, Teaching, Simulator, left to right — MLR-OD-1.                                                                                                                                                      |
| F2      | 55 steps, none with a location; the Now card and help dialog printed none                                                                       | Every step authors a location on its section spec beside the step titles (the walk's on the lesson builder); validated at import with the shared rules, this module's copy gate and each section's deny set; printed under the instruction and in the help dialog. The answer pane comes first where an identification is read on the map and answered on the card. |
| F3      | "beneath the model" ×2, "the anatomy pane" ×2, "the highlighted pathway" on a map-answered step, "in the workspace" ×5, "beside the monitor" ×2 | Each names what is on screen: the Circulation map, the alarm band and the displayed pump flow, the pins, the button under the answer, the Controls under the monitor. The Act step opens the map where its instruction is about what the map draws — MLR-OD-6.                                                                                                      |
| F4      | The pump-speed slider dead until a checkbox above it that did not say so                                                                        | The box says it is the key — "tick it to unlock the pump speed below" / "the pump speed below can be changed" — from the flag that disables the slider. The only dead control on the Learn surface; the controls and the three-dimensional view are absent, not disabled, before the commitment.                                                                    |
| F5      | Focus rings only                                                                                                                                | Hover and pressed states on the guided actions, surface toggles, reveal toggle, sort, choices and the Now card's actions, scoped to this module (`mcs-stage.module.css`). The shared `.nowPrimary`/`.nowSecondary` are left as they are, as hemodynamics left them.                                                                                                 |
| F6      | Handled by the stage                                                                                                                            | Nothing: Act's Continue waits for the contract's predicate, the guided actions are the card's body. Observe and Explain Continue are reading steps — below.                                                                                                                                                                                                         |
| F7      | "Check here:" over a markerless list                                                                                                            | A labelled list with markers, "What to check at this stop", `aria-labelledby` on the list; one label for all five stops, because each list is the few things to check at that place.                                                                                                                                                                                |
| F8      | The three-dimensional view's equivalents, above                                                                                                 | MLR-OD-2.                                                                                                                                                                                                                                                                                                                                                           |
| F9      | Does not apply                                                                                                                                  | Nothing.                                                                                                                                                                                                                                                                                                                                                            |
| F10     | No instruction promises the other answers; the record did                                                                                       | MLR-OD-5: the shared card takes the item's choices and folds the others; both verdicts and the stories pass them.                                                                                                                                                                                                                                                   |
| F11     | Key-first authored order (cosmetic); eight move-shaped unsafe options; two partly-correct misreadings; three absolutes                          | MLR-OD-3. The authored order stays key-first with a note at the head of the contracts saying the stage rotates it.                                                                                                                                                                                                                                                  |
| F12     | "The cues support this read" and "the working frame" under nine decision-shaped transfer stems and nine predictions                             | MLR-OD-4.                                                                                                                                                                                                                                                                                                                                                           |
| X1      | Compact opened on the simulator while every answer control but two sat in the steps pane                                                        | Shared `compactPane`, followed not forced; derived from the step's location, overridden to the simulator on the two identifications answered by pointing at the map.                                                                                                                                                                                                |
| X2      | Shared shell                                                                                                                                    | Measured: it does not stick — below.                                                                                                                                                                                                                                                                                                                                |
| X3      | `beforeStateLabels`/`afterStateLabels` validated, carried on the step, never rendered                                                           | Observe prints "What you had before" / "What you have now" above the numeric table.                                                                                                                                                                                                                                                                                 |
| X4, X5  | Do not apply on the stage                                                                                                                       | Nothing.                                                                                                                                                                                                                                                                                                                                                            |

Also from the hemodynamics record's hand-over: `mcs-stage.module.css` read `var(--muted)` thirteen
times inside the shared workspace, which redefines `--muted` as a Tailwind HSL triple, so no kicker,
hint or footnote on this stage was ever the grey it declared. Measured before the fix as the ink
colour, `rgb(234, 244, 244)`; after, `rgb(159, 180, 183)`. It reads `--stage-muted` now.

## MLR-OD-1 — the steps lead, and the simulator keeps the width

**Settled by the owner on 2026-09-07**, after this round: the flip is approved and stands, and all
four adopters of the shared stage are steps-first — ECMO already was, hemodynamics is merged, MV is
flipping, and this is MCS. It is no longer a question for anyone; a later adopter that wants a
different order argues against four records rather than against none.

**This amends `mcs-flow-rebuild.md` §2 and §7.** Neither recorded the order as a decision: §2 says
"three panes that scroll on their own inside a viewport-sized shell" without an order, and §7's
table measured "Internal scrollers · Simulator 650/1101, Steps 650/903" as a fact of the surface.
The workspace label read "simulator, teaching, and steps". It reads "steps, teaching, and
simulator" now. No test pinned the order.

The order is Steps, Teaching, Simulator — the ECMO round's R5-OD-1 and the hemodynamics round's
HLR-OD-1, taken here for the same two reasons: the learner reads the instruction first, and a
compact viewport opens on the first pane, which was the monitor while every answer control but the
two map-answered identifications sat in the pane it could not show. What §7 does record — the map
and the monitor are never scaled — is what the fractions protect: 0.26 / 0.29 / the rest, floors
300 / 280 / 340, the simulator the widest of the three at every measured width.

**This also amends `mcs-learn-section-contracts.md` "Residual limitations"**, which recorded "Below
about 1024 px wide the shared teaching workspace collapses to one full-width pane with a tab row …
The threshold and the default pane belong to `ResizableTeachingWorkspace`, which this package does
not modify." The threshold is unmoved; the default pane follows the step now.

Measured on the dev server (port 3122) at `mcs-foundations-mechanisms`, each width a fresh
navigation (a reload bounces to sign-in):

| Viewport | Steps                                                                                        | Teaching | Simulator | Elements overflowing their pane | Document horizontal scroll |
| -------- | -------------------------------------------------------------------------------------------- | -------- | --------- | ------------------------------- | -------------------------- |
| 1600     | 399                                                                                          | 445      | 691       | 0                               | 0                          |
| 1440     | 358                                                                                          | 399      | 619       | 0                               | 0                          |
| 1280     | 316                                                                                          | 353      | 547       | 0                               | 0                          |
| 1024     | 250                                                                                          | 278      | 432       | 0                               | 0                          |
| 900      | one pane, the Steps tab selected on the walk; the Simulator on a map-answered identification |          |           | —                               | 0                          |

These are the ECMO and hemodynamics records' numbers to the pixel, which is what sharing the
workspace's fractions should produce. The overflow column was **2 before MLR-OD-7** at every
three-pane width: the map's balloon label, which ran off the drawing and was cut at the pane edge.
Also measured at `impella-unloading-placement` (1440 and 1024) and `lvad-parameters-assessment`
(1440): 0 and 0.

## MLR-OD-2 — the three-dimensional view waits for the commitment

**This amends `mcs-flow-rebuild.md` §9**, which recorded "The 3D anatomy view stays behind its
launch gate as the third simulator surface, unmounted while closed; nothing on the stage points into
it." It is still the third surface, still gated and still unmounted while closed — and now absent
before the prediction is committed, for the reason the controls surface already was: its text names
what the sections ask the learner to predict. The rendered leak scan pins that neither surface is
offered on entry or at the prediction and that both appear on the commitment. The map is the one
surface offered before the commitment, and it already withholds its answers while a place is the
question.

## MLR-OD-3 — every prediction's unsafe branch is a forecast, and thirteen reviewed items are draft

**This amends `mcs-flow-rebuild.md` §5**, which said "Every item keeps its `sme-review` status", and
keeps the validator's rule that every prediction offers an unsafe branch. Each unsafe option is
now the belief behind the reflex stated as an expectation — "The displayed flow will come back to
where it was once the speed is raised to chase it" — graded unsafe because acting on it is the
harm; the rationales already said why. The review suite pins that no prediction option opens with
a move and that none says "instead". **Each of these needs the owner's eye:**

| Item                                   | Option                | What changed                                                                                                                                                                                |
| -------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcs-foundations-mechanisms-predict-1` | `more-is-better`      | "is the one this patient should be receiving" → "will also deliver the most to this patient"                                                                                                |
| `mcs-iabp-timing-predict-1`            | `raise-ratio-instead` | "so raise the assist ratio instead of adjusting the timing" → "because the assist ratio rather than the timing decides what the balloon offers"                                             |
| `mcs-iabp-limits-predict-1`            | `retime-again`        | "Whatever happens, re-time inflation and deflation until perfusion improves" → "Perfusion will recover once inflation and deflation are re-timed, since the balloon is the device in place" |
| `mcs-impella-placement-predict-1`      | `escalate-level`      | "so raise the performance level until the displayed number comes back" → "and the displayed number comes back once the performance level is raised"                                         |
| `mcs-impella-bipella-predict-1`        | `raise-left-instead`  | "Raise the left-sided performance level instead…" → "Left-sided flow will rise more if its own level is raised…"                                                                            |
| `mcs-lvad-afterload-predict-1`         | `raise-speed`         | "Whatever happens, raise the speed until…" → "The displayed flow will come back to where it was once the speed is raised to chase it"                                                       |
| `mcs-lvad-high-power-predict-1`        | `disconnect-to-check` | "Disconnect the power source briefly to see whether the alarm clears itself" → "The alarm will clear by itself if the power source is disconnected briefly and reconnected"                 |
| `mcs-integration-predict-1`            | `keep-escalating`     | "Whatever the gain, keep raising the level until…" → "The displayed flow will read as adequate once the level has been raised far enough"                                                   |
| `mcs-iabp-trigger-transfer-1`          | `assume-ecg`          | "always superior to pressure triggering in any rhythm" → "an electrical signal stays reliable when the pressure trace does not"                                                             |
| `mcs-iabp-limits-transfer-1`           | `retime-normal`       | Regraded partly-correct → not correct: it is that section's own `commonMisinterpretation`; the rationale says so                                                                            |
| `mcs-impella-afterload-transfer-1`     | `setting-equals-flow` | "guarantees the same patient flow in every loading condition" → "sets the patient flow, so the display should not have moved"                                                               |
| `mcs-impella-suction-transfer-1`       | `purge-only`          | "Treat every low-flow pattern … until proven otherwise" → "Treat this low-flow pattern as a purge-system problem before looking at filling or position"                                     |
| `mcs-lvad-emergency-transfer-1`        | `controller-only`     | Regraded partly-correct → not correct: deferring examination in a time-critical pattern is the delay that section names as the harm                                                         |

The section-1 prediction's unsafe option ("A device contribution that can be added to the native
contribution to give cardiac output") was already a forecast and is untouched. The registries
test's "pick the first" and "pick the longest" bounds still hold across all four item families.

## MLR-OD-4 — the verdict says which kind of thing it is judging

`ChoiceReasoningFeedback`'s defaults were written for signal-recognition items, and its partly-
correct frame — "One more cue changes the working frame" — is the hemodynamics module's vocabulary.
Every transfer here asks for a response and every prediction asks what the circulation will do, so
the host passes frames by item type: "That is what the circulation does." / "Defensible as far as
it goes, and it leaves the limiting problem unnamed." / "That mechanism would move the readings
differently." / "Stopping here — acting on that expectation could harm a real patient." for
predictions and the stories; "That is the response this pattern calls for." / "Defensible as far as
it goes, and it leaves a step out." / "That response answers a different problem." for transfers.

## MLR-OD-5 — the other answers, on the shared card

**This amends `mcs-learn-section-contracts.md` "The six phases › Predict"**, which said "The shared
`AnswerVerdict` then says whether the read holds and why the alternatives do not — and does not
advance. A separate Continue does." The stage has never rendered `AnswerVerdict`; it renders
`ChoiceReasoningFeedback`, for its concept links and citations, and that card had no disclosure of
the other answers. The brief asked, for the owner, whether the contract should name which
component carries the disclosure or whether `ChoiceReasoningFeedback` should simply carry it too.
This round took the second, as an optional and defaulted `alternatives` prop on the shared card:
a caller that passes the item's choices gets "Why the other answers do not fit" folded under the
verdict; a caller that passes nothing renders byte-for-byte as before. MCS passes it on both
verdicts and the stories.

**Settled by the owner on 2026-09-07:** ECMO's module-local `EcmoOtherAnswers` does retire into
this prop — but not in this round. It is a separate convergence PR, once this branch and the
mechanical-ventilation round have both landed, so the retirement is one reviewable change rather
than a side effect of two. `docs/critical-care/activity-contract.md:44-47` still describes the
disclosure as `AnswerVerdict`'s alone; whether it should now name both cards belongs to that same
convergence.

## MLR-OD-6 — the Act step opens the map where its instruction is about the map

Two Act instructions are about what the map draws — the mechanism's pathway changing as each is
selected on section 2, the second pathway appearing when the right-sided pump starts on section 6 —
and neither step opened the map: `surfacesFor` opened only the controls, or nothing. The section
spec authors `actOpensMap`, the builder opens the map and leads the simulator pane with it on that
step, and the spec validator refuses the flag on a section whose Act location does not name the
map. Not authored on section 5, whose Act instruction now watches the alarm band and the displayed
pump flow, because no surface on the stage draws the inlet's position.

## MLR-OD-7 — the map's pathway labels stay on the drawing

Found by the overflow measurement rather than by the brief: three of the four pathway labels on the
circulation map ran off the drawing and were cut at the pane edge — the balloon's and the
transvalvular pump's anchored to their start thirty units to the right of a line at 850 in a
drawing 1000 wide, the right-sided pump's anchored to its end at 82. The two on the right are
anchored to their end and drawn to the left of the line, as the durable pump's always was; the
right-sided pump's sits above its own top segment, in the band between the lungs and the pulmonary
artery's label; and a label with a mechanism name before a colon is drawn as two `tspan` lines,
its text content unchanged. Overflow 0 on sections 2, 5 and 7 at 1440 and section 5 at 1024.

Also from the browser drive: two clicks on "Next stop" inside one frame pushed the walk index past
the last stop, and the card fell back to the step's title for a render. The index is clamped.

## Left for the next round

Confirmed in the code or measured in the browser, and out of scope here:

- **X2, on the shared shell.** `.now` is `position: sticky` and does not stay: scrolling the Steps
  pane by 600 px moved the card from 30 px to −312 px below the pane's top. Same as hemodynamics
  found; whether a card that can be tall should stick is a shared-shell decision.
- **Observe's and Explain's Continue require nothing.** Two sections' Observe and Explain steps
  carry story problems the instruction does not name; the Continue on both is a plain continue.
  Optional by design in the flow-rebuild record; worth an owner call, as hemodynamics recorded.
- **The shared button classes have no hover state**; this module scopes its own. Four modules' to
  change.
- **Section 2's Observe compares the first mechanism with the last.** Each Select rebuilds the
  baseline, so the table holds the balloon baseline against the durable-pump baseline; the
  transvalvular pump's numbers are not on it. The authored before/after account carries all three
  in words now, which is what the numbers could not.
- **"Section N of 9" prints three times on one screen** — the header kicker, the Sections drawer
  and the teaching column's framing kicker — beside "Step N of M". Each carries its noun; none is
  a counter that spans units.
- **The durable pump's two-line label crosses the left-ventricle box** on the map, as its one-line
  label did before this round. Legible over the halo; not a layout defect.
- **The monitor's "Look here now" line is section-level** and prints identically at all six
  post-commit phases; the Now card carries the phase-level pointer now. Whether the monitor's line
  should go is an owner call.
- **The three-dimensional view's text equivalent is post-commit only now**, so a learner who
  opens it after committing reads the mechanism there; before, it was the leak.
- **This worktree has no Supabase env**, so the dev server's analytics and progress calls return
  500 in the console. Environment, not the page.
- **ECMO's `EcmoOtherAnswers` retires into the shared `alternatives`** (MLR-OD-5), in a convergence
  PR after this branch and the mechanical-ventilation round land. That change carries the
  `activity-contract.md` wording with it.

## Needs the owner

- The thirteen items in MLR-OD-3.
- The wording of the pane captions ("the monitor, the map and the controls"), the verdict frames
  (MLR-OD-4), the checklist label ("What to check at this stop"), and the authorization box's
  clause ("tick it to unlock the pump speed below").
- The walk's instruction now names the Teaching panel for the checklist ("the few things to check
  at that place are in the Teaching panel, under On the loop"); the walk card itself carries
  only what a device does at the stop.

## Verification

- `npx jest src/features/mechanical-circulatory-support` — 28 suites / 661 tests before, 29 / 686
  after.
- `npx jest src/features/learning-module src/features/critical-care` — 37 / 328 before, 37 / 330
  after; the shared card's two new tests.
- `npx tsx scripts/critical-care/review-mcs-section-contracts.ts` — 0 flags after the instruction
  rewrites.
- `npx tsc --noEmit` clean for the modules in play; `eslint` and `prettier` clean on every changed
  file.
- The dev server on :3122 at 1440 × 900, `mcs-foundations-mechanisms` driven from the walk (five
  stops, each lit on the map with its caption) through the identification ("Correct." with its
  feedback), the prediction (the verdict "Correct. That is what the circulation does.", three other
  answers folded, the controls and the three-dimensional view appearing on the commitment), the
  Act step (the map leading the simulator pane, the three Select buttons in the card, Continue
  disabled until the third, the durable pump's label on the map), to Observe (the authored account
  in the muted grey above six rows). The location line on every step reached. The width table
  above. `impella-unloading-placement` and `lvad-parameters-assessment` opened and measured.

## Rubric section 5, on the finished surface

- Every instruction names the surface it means, and the name is on screen: the pane captions and
  the 55 locations, validated together at import.
- Every heading, control or region an instruction names is present at that step: the eight
  rewrites; the map opened where it is named; the Controls named where they are.
- Everything an instruction promises exists where it promises it, open: the other answers on the
  verdict; the before/after account on Observe; the checklist under its label.
- One control group watched across a section: the surfaces change with the step; the teaching
  blocks fold by phase.
- The primary control does the step's work: no Continue on Act until the predicate holds; Commit
  disabled until a choice. The reading steps' Continue is recorded above.
- Every control the step needs looks interactive; the one dead control says what unlocks it.
- No two "N of M" counters without a noun between them.
