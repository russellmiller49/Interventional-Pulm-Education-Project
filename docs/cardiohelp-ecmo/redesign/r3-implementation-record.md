# R3 — the guided circuit walk

What shipped, what it is allowed to say, and which decisions it took. The approved plan is the
package's scope statement; this records the parts that changed on contact with the code, so a
reviewer reading the diff does not have to reconstruct why.

Base: `origin/main` at `1261cf1d` (R0 = PR #108, R1 = PR #109, R2 = PR #115, all ancestors).

---

## 1. What R3 adds

One content module, one teaching component and its navigation hook, plus the integration into the
two foundation sections the package was scoped to.

| File                                        | What it is                                                         |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `content/circuitWalk.ts`                    | Six stops, authored against the R2 registries, validated at import |
| `components/teaching/EcmoCircuitWalk.tsx`   | The stop card: analogy, checklist, map, live signals, Back / Next  |
| `components/teaching/useEcmoCircuitWalk.ts` | Where the position lives, controlled or not                        |
| `__tests__/circuit-walk.test.ts`            | The registry contract                                              |
| `__tests__/foundation-comparisons.test.ts`  | Both experiments, asserted against the engine                      |

Changed: `circuitPresentation.ts` (a fourth presentation kind), `EcmoCircuitMinimap.tsx` (the
current-stop vocabulary, both geometries), `circuitSceneAnchors.ts` (the scene's label text moves
here), `ecmo-circuit/layout.ts` and `SceneLabels.tsx` (read the text back; emphasise by id),
`CircuitAndMonitors.tsx` and `EcmoCircuit3D.tsx` and `BedsideScene.tsx` (one pass-through prop),
`cardiohelp-ecmo.module.css` (the emphasis states), `CircuitFlowPathPanel.tsx` and
`PumpPressureZonesPanel.tsx` (the walk replaces the static list and the section-level map),
`EcmoFoundationTeachingPanel.tsx` (one optional prop), `EcmoFoundationLessonActivity.tsx` (owns the
position), `foundationLessonRuntime.ts` (two states, two appended actions, a wider speed step),
`foundationLearningItems.ts` (one number in one stem), `teaching/shared.tsx` (a comparison phrase),
`localizationCards.ts` (one qualifier, §6b), and the render harness.

Twenty-nine files in all. (The first version of this record said twenty-eight; the independent
review counted the diff and found twenty-nine — finding H of the BLOCKED verdict in §10. After the
correction pass recorded there, the branch touches thirty-seven after the re-review pass — see §10c.)

Untouched: the engine, every scenario, every route, `progress.ts`, the storage key, the progress
envelope, scoring, mastery, Practice, Assess, publication status, `learningPathways.ts`,
`pathwayResolver.ts`, `circuitSegments.ts`, `ecmoValueGuides.ts`, `evidence.ts`, the six frozen
pilot panels, and PR #94.

`localizationCards.ts` is the one R2 registry this package edits, and it edits one sentence: the
`return-path-resistance` signature gains the flow-matching qualifier the card's own footer and the
registered gradient guide have always carried. No row id, structure, source, boundary or cause list
changed, and no number entered. The reason is in §6b — R3 is what made a state exist that falsified
the sentence without it.

## 2. Owner decisions, as taken

- **R3-OD-1 (the bounded speed change)** — taken as recommended, option (a). The step widened from
  two hundred rpm to four hundred and the stem's number followed it. §3 records why this was
  blocking rather than cosmetic — and §10 records the correction: the account that four hundred was
  the smallest visible step was false, and the step is now three hundred, the smallest magnitude
  the console shows in both directions.
- **R3-OD-2 (`?stop=` in the URL)** — declined, as recommended. The stop is local state; a reload
  returns to the section's first stop. `?phase=` earned its place by solving a clean-state problem
  that stops do not have.
- **R3-OD-3 (previewing a later drill from a foundation section)** — taken. The return-obstruction
  case loads as a non-scored mechanism preview, on the exact precedent of
  `oxygenatorResistancePreviewVariant`, which has previewed a later drill from a foundation section
  since R0.
- **R3-OD-4 (separate scene anchors for the pump and the membrane)** — deferred, as recommended.
  Three stops light `hls-module` because on this device the pump and the membrane are one
  integrated disposable. The stop says so; a test pins it; adding anchors remains available under
  the scene's own separation contract.
- **R3-OD-5 (the pre-existing localization-scaffold leak)** — left out of scope and recorded in §6.
- **R3-OD-6 (a new Learn-only action)** — not needed. Every interaction the walk runs is an existing
  `restore-and-apply` over existing `SET_RPM` and existing variants.

## 3. The defect the package was blocked on

`ecmo.foundation.pump.prediction` keys a pairing: flow rises, **and** the drainage side is pulled
harder to produce it. The learner commits to that, the `act` phase tells them to run the bounded
speed change, and the console showed **pVen −35 before and −35 after**.

`calculatePressures` rounds pressures to whole millimetres and two hundred rpm moves the drainage
pressure by six tenths of one, so the model moved and the display did not. What a learner saw was
the distractor `flow-up-drainage-unchanged`, whose own rationale tells them the drainage side does
not stay unchanged.

The step was widened to four hundred with the claim that it was the smallest the console could show
the change at. **That claim was false**, and the independent review caught it (§10): the rounding
to whole millimetres is not symmetric about the reference, so the smallest visible increase is
+300, the smallest visible decrease is already −100, and ±300 is the smallest magnitude visible in
both directions. The step is now three hundred — the sweep is tabulated in §10 — with no fault, no
alarm, and no critical error charged anywhere in ±400, because a reference circuit carries no
drainage capacity to exceed. The item keeps its id, its four choices, its key, every rationale and
its explanation; only the stem's number moved with the step.

`foundation-comparisons.test.ts` asserts on `readouts.*.displayed` throughout — a suite written
against the raw model values would have passed the whole time the lesson was contradicting itself —
and now runs the full displayed-readout sweep on every run, deriving the smallest visible increase,
the smallest visible decrease and the smallest symmetric magnitude from the engine rather than
pinning one number's story, which is how the first pin preserved a false account.

## 4. Decisions taken during implementation

**Stops are not phases, and are counted once.** A phase is a task and there are six per section
already, in the pane next door. Stops are places, numbered one to six across both sections, so
arriving at the pump section reads as "stop five of six" rather than as a second counter starting.
They live in different panes with different vocabulary for the same reason.

**Each panel keeps exactly one map.** The walk's map replaced the section's rather than joining it:
a per-stop map is the same drawing plus where you are. `path-order` and `pressure-zones` are left in
the scaffold-emphasis union with a note, on the reasoning R2 recorded for the localization rows no
pilot drill consumes yet — the vocabulary is authored once and consumed by reference, and deleting
a name the moment its last caller moves is how a registry gets re-derived by the next package.

**"You are here" is not "the problem lives here".** The walk marks segments, and so does an
implicated drill row, but the two are different claims and the drills' leak test asserts the
_absence_ of the implicated attribute. The walk therefore gets its own attribute, its own caption in
its own words, and a ring where an implicated segment gets a filled diamond — a different shape
rather than a different colour, because this drawing is read by people who cannot tell two teals
apart.

**The scene's label text moved to the seam.** The walk has to name in words what it has lit, because
the bedside scene hides its labels entirely on a compact viewport and lets anyone switch them off at
any width. The first draft printed label _ids_. Writing the names out again in the walk would have
been two copies of one vocabulary, so the words moved to `circuitSceneAnchors.ts` and `layout.ts`
reads them back: it keeps every position and owns no prose.

**Nothing in the scene moves.** No camera nudge, no return-to-framing, no material or geometry
change. A learner who has already orbited or panned should not have the view they chose taken away
from them in order to be shown where something is. The emphasis is a heavier border, a ring, and
everything else receded — and it is reinforcement, not the carrier.

**A beat names a guided action, not a variant.** The runtime's `restore-and-apply` already expresses
which state to rebuild, what to do to it, and how long to settle, in one transition. Pointing at
that keeps the walk from becoming a second place where states are selected.

**The matched-flow beat slows the healthy circuit.** The obvious way to compare gradients at equal
flow is to drive the obstructed circuit harder — which restores flow to 4.05 and the gradient to its
reference value, i.e. this engine would show the reflex `return-path-resistance` names as the one to
avoid actually working. Slowing the reference to 2240 rpm reaches the same reading with nothing to
unlearn, and a test forbids any beat from raising the speed at all.

## 5. Two defects found by looking rather than by reasoning

**The terminus lights both ends.** `patient` resolves to _both_ femoral access sites, because the
loop opens and closes there. Naming it as a secondary place on the drainage and return stops reads
as obviously right, and lit the return cannula at the stop about drainage. Caught in the render
harness; neither stop names it now, and a test says so.

**The reference comparison was not a sentence.** The pump panel printed "about the samethan this
circuit's reference state" in the state it opens in — two defects at once. `directionWord`'s flat
case is "about the same" and this panel appended "than" to it; and the JSX transform drops the
leading space of a text node following an expression, so even the grammatical cases rendered as
"higherthan". Direction and preposition now travel together in `comparisonPhrase`, and the
separators are explicit. Caught by driving the route in a browser.

## 6. What the tests pin

New: `circuit-walk.test.ts` (six stops; ordinals; section split; every id resolves through R2; no
second anatomy registry; no React, three.js or engine value in the content module; blood-path
coverage and direction; scene anchors including the VA catheter; no digit in learner copy; every
beat resolves to an action the section offers), `foundation-comparisons.test.ts` (both experiments
against the engine, on displayed values).

Extended: `circuit-minimap.test.tsx` (the walk marks exactly its own segments in both geometries;
the two marking vocabularies stay disjoint in both directions), `foundation-lesson.test.tsx` (the
blood-path order assertion becomes a statement about the walk; one map per pane),
`foundation-activity.test.tsx` (forward and back; disabled at the boundaries; focus to the stop
heading; no focus theft on arrival; the status region announces the stop and no live value; the
whole-walk count; both tracks open at their own first stop; the sensor-name gate; beats run through
the section's own actions; a stop change does not touch the loaded state),
`foundation-session.test.ts` (the speed the bounded action reaches).

## 6b. What an independent review found, and what changed

Five read-only lenses were run over the finished diff, then a completeness critic over their
reports. Six findings survived and all six are fixed. They are recorded because four of them are
the kind that a package reviewing itself does not find.

**The walk answered the question beside it.** `pump-and-pressure-zones` opens on stop five, whose
conclusion — flow follows speed, and it is bought with suction — is both halves of that section's
keyed prediction, rendered ungated in the pane next to the question. Four lenses found it
independently, and the package's own plan had predicted it in a deny list that was then not
implemented. The takeaway is now gated per stop, the analogy names the two dials without the
coupling, and there is a test that checks the _claim_ rather than the words.

**The accessible copy was the surface leaking.** The card's text equivalent printed
"Reported here: pre-membrane pressure (pInt)…" unconditionally while the two blocks beside it were
correctly withheld — so the affordance built for the learner who cannot read the picture was the one
answering "where does the circuit report pInt?". Gated, along with the map's sensor labels: ringing
exactly the channel a prediction asks a learner to place is a sharper pointer than the seven that
map flagged in every phase before the walk existed.

**The row contradicted the state the walk now loads beneath it.** `return-path-resistance` said the
gradient "changes little". It was authored when nothing in this section could load a resisted
return; R3 gave it one, and at unchanged speed the engine drops flow by a third and the gradient
with it — so the panel's own comparison line said "the gradient is lower" three hundred pixels above
a row saying it does not move. A learner holding the row as the rule would have ruled out the
correct answer. The row now reads "read at similar blood flow, the gradient across the membrane
changes little", which is the qualification the card's footer and the registered gradient guide have
always carried.

**Stop six called a three-millimetre move quiet**, in a section that had just widened its own speed
step so a one-millimetre drainage change would be countable. It now states the direction instead.

**The beats bypassed a deliberate gate.** The activity hides its bounded actions in `recognize` and
`predict`; the beat buttons load states through those same actions and rendered regardless.

**The harness could not render the state the package added.** The walk matrix multiplied stops
across three hand-built profile states, so the comparative stop was reviewed only against circuits
with nothing wrong with them. It now reads each walk section's own authored variants, so a variant
added to a lesson gets cells without this file being edited a second time.

Two smaller things the critic was right about and which are also fixed: the rendered comparison
sentence had no render-level pin, so reverting the whitespace fix left the whole suite green; and
the walk had removed the last renderer of `EcmoCircuitSegment.detail`, leaving registry prose that
tests still asserted and nothing displayed. The stop card now renders it, and the stop's own sources.

`EcmoSensorSite.stopLabel` remains unrendered. Its consumer was the static list the walk replaced,
and the card's `plain name (device label)` phrasing reads better than "ΔP spans this" in a sentence.
Recorded rather than deleted, on the same reasoning as the unused scaffold emphases.

## 7. Verified

- `npx jest src/features/cardiohelp-ecmo src/features/critical-care src/features/learning-module 'src/app/\[locale\]/cardiohelp-ecmo' --runInBand` — 83 suites, green.
- `npm run type-check`, `npm run lint` (no new warning), `npm run test:a11y` — green.
- `npm run render:ecmo-teaching` — every stop against every state its own section declares, both
  tracks, including the resisted return the comparative stop is about. Reviewed on :8099: the cell
  for stop six against that state shows pVen −32, pInt 335, pArt 313, ΔP 22, the panel's line "the
  gradient is lower than this circuit's reference state", and the row's qualified signature, on one
  screen and no longer contradicting each other.
- **In the running application**, at `/cardiohelp-ecmo/learn`, on the `claude-worktree` dev server.
  The ECMO routes are public-unlisted in `src/lib/site-auth/access.ts`, not behind login — the R2
  record says otherwise and is out of date, and commit `d7c3c743` had already corrected three other
  handoff documents on exactly this point.

What the in-application pass covered: 1600×900, 1440×900, 1280×720 and 1024×768; pane widths on
fresh load at each; zero clipped children inside the stop card and no horizontal document scroll at
any of them; the compact tab arrangement at 1024, where the map holds 14.57px labels — above the
12px floor R2 set; forty-four-pixel Back and Next; and the three comparison beats driven in order,
which produced 4.05 / 2.83 / 2.84 L/min with gradients 31 / 22 / 23 mmHg and post-pump pressures
242+211 / 335+313 / 214+191. That is the lesson: at matched flow the gradient is the same and only
the load has moved.

## 7b. Copy budget, measured

The plan set roughly a hundred and twenty learner-facing words per stop, excluding text equivalents
and boundary and source disclosures. Measured: 60, 48, 72, 60, 75 and 77 words of stop copy. Stop
six carries a further 78 words across its three comparison-beat labels and their one-line reading
instructions, which take it to 155 in total — over the budget if beats count as stop copy, and the
choice taken is that they do not: they are three buttons a learner reads one at a time as they work
through the comparison, the same way the bounded-action labels beside them are not counted.

## 7c. The 3D visual gate — run in a production build, and it found a defect

The seam was type- and identifier-verified but not pixel-verified when the record was first written,
because the bedside scene stayed inside its Suspense boundary on the development server. A
production build (`npm run build`, then the standalone server on an unused port, against the same
public-unlisted routes) resolves that: the scene mounts, all eight labels render, and the emphasis
can be inspected.

**It failed on the first run, and the failure was real.** The `data-emphasis` attributes were
correct at every stop, and the browser painted the previous stop's opacities anyway — the emphasised
object rendered dimmed at 0.34 while stop one's labels stayed lit at 1. Cause: these labels are drei
`<Html>` portals, and their opacity transitions were observed with `playState: "running"` and
`currentTime: 0`, permanently at time zero, so each element held its start value and never reached
its target. The transition is inherited from the base label rule, written for the orbit dim — a
transient drag state where nothing depends on the end value, so a frozen transition was invisible
there. Marking one label per stop is what turned it into a correctness problem.

Diagnosed by injecting `transition: none` into the running production page, watching every label
snap to the correct value, and removing it again to reproduce the freeze. Fixed in the stylesheet,
rebuilt, and re-verified. `circuit-walk.test.ts` now asserts the stylesheet directly, because no DOM
test can see this.

### What the gate checked, per stop, in the rebuilt production application

Measured through computed style in the running page, at every one of the six stops, both sections
and both tracks:

| Check                                    | Result                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scene leaves the Suspense boundary       | Yes — canvas plus eight labels at every stop                                                                                                                                                                                                                                                               |
| Emphasised object recognisable           | Opacity 1, 2px border, and a ring; the rest at 0.34 with a 1px border                                                                                                                                                                                                                                      |
| Map and scene name the same segment      | Yes — every emphasised label appears in the card's own scene line, and the map marks the stop's segments                                                                                                                                                                                                   |
| Distinguishable without colour           | Yes — emphasised and receded resolve to the _same_ colour; weight, ring and recession carry it                                                                                                                                                                                                             |
| Unrelated objects still readable         | 0.34, one value across every receded label, never hidden                                                                                                                                                                                                                                                   |
| Labels usable                            | Unchanged size and position; the orbit dim still takes precedence                                                                                                                                                                                                                                          |
| Orbit, zoom, bounded pan                 | Untouched — no camera or controls code changed                                                                                                                                                                                                                                                             |
| Stop change removes the old emphasis     | Yes — exactly the new stop's labels are emphasised                                                                                                                                                                                                                                                         |
| Back restores the prior emphasis         | Yes — verified stop four → back → stop three                                                                                                                                                                                                                                                               |
| Section switch leaves no stale highlight | Yes — the pump section opens on stop five with its own emphasis                                                                                                                                                                                                                                            |
| Reduced motion preserves meaning         | Nothing in the walk card animates or transitions at all — measured, zero nodes with a non-zero duration — and the emphasis states now carry `transition: none` explicitly                                                                                                                                  |
| Scene absent, lesson still completable   | Yes — at 1024×768 the scene sits in another tab with no scene label in the document, and the card still carries heading, analogy, four-item checklist, map with its "you are here" caption, the scene line, live signal, place detail, takeaway, sources, text equivalent, Back/Next and the status region |

Per-stop emphasis, as measured: stop 1 femoral drainage + drainage clamp · stop 2 HLS module ·
stop 3 HLS module · stop 4 femoral return + return clamp + flow and bubble sensor · stop 5 HLS
module + femoral drainage + drainage clamp · stop 6 flow and bubble sensor + HLS module + femoral
return + return clamp. Loading the resisted-return state at stop six leaves the emphasis unchanged.

### Viewports

| Viewport   | Result                                                                                                                                                                                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1600 × 900 | Three panes; card 320px; zero clipped children; no horizontal document scroll; emphasis 1 / 0.34                                                                                                                                                                                                    |
| 1440 × 900 | As above                                                                                                                                                                                                                                                                                            |
| 1280 × 720 | As above; panes 474 / 320 / 309 on fresh load                                                                                                                                                                                                                                                       |
| 1024 × 768 | Compact tab arrangement; walk in the Teaching tab at 883px; zero clipping; map compact geometry with a smallest label of 14.57px, above R2's twelve-pixel floor; **scene labels hidden, which is the permitted compact behaviour** — the map and the teaching copy remain complete and synchronised |

### What was captured, and what was not

One screenshot records the scene with stop one's emphasis visible — the two drainage labels bright
against six receded ones. Further per-stop captures were not obtained: this harness does not
reliably photograph a WebGL canvas, and the two workarounds that place the canvas in the viewport
(scrolling, or a taller window) each defeat the screenshot path. **The remaining stops are recorded
by computed-style measurement in the running production application, not by image**, and that
distinction is stated rather than papered over.

## 8. Limitations still true

- **The 3D emphasis was not verified in pixels.** The bedside scene's assets serve, the canvas
  mounts and WebGL is available, but the scene stays inside its Suspense boundary on the development
  server, so no scene label rendered to inspect. The seam is verified by types and by the ids the
  walk resolves; the emphasis CSS is verified by reading it. The lesson does not depend on it: the
  scene hides its labels on a compact viewport anyway, which is why the correspondence is carried by
  the map and by visible text.
- **No screen-reader pass was performed**, and none is claimed. The status region, the focus move
  and the text equivalents are asserted in the DOM, which is not the same thing as hearing them.
- **The minimap chooses its compact geometry at every default viewport** in this workspace, because
  the teaching pane lands near 408px rather than the 450–670px R2 measured. That is inside the
  compact geometry's design range and its labels measure well above the floor, but it means the
  landscape drawing is now rarely seen in the foundation sections.
- **Resizing a loaded page collapses the activity pane** — at 1280×720 reached by resizing rather
  than loading, the third pane fell to 90px. This is `ResizableTeachingWorkspace` keeping its stored
  preferred widths and letting the last pane absorb the loss; it predates this package and is not
  reachable by a learner who simply opens the page at that size.

## 9. Still open

- The pre-existing leak in `pump-and-pressure-zones`: the localization scaffold renders in every
  phase, and the drainage row's signature is the answer to that section's own transfer item. R3 did
  not add a second copy and did not fix it; it belongs to the copy pass or to a commitment gate.
- The fourteen held drill panels on PR #94 remain held. Nothing here was taken from that branch.
- `pre-membrane`, `pump` and `membrane` still share one bedside-scene anchor (R3-OD-4).
- The Three Knobs, the story problems, the Watershed Explorer, the Act-I copy trims, and everything
  else the plan listed as out of scope remain out of scope.

## 10. The independent correction pass (BLOCKED → corrected)

An independent review of PR #117 at `6bd7b5a6` returned **BLOCKED — CORRECTION REQUIRED**, with
eight findings, every one reproduced on this branch before any edit was made. The six-stop
architecture, the R2 registry reuse, the shared VV/VA behaviour, the downstream comparison and the
3D emphasis design were accepted; nothing outside the findings was redesigned. Five commits carry
the corrections: `b64fc6d0`, `8e83f6ba`, `e5464908`, `77980c9a`, and the docs commit carrying this
section.

**A — the composed teaching pane leaked the keyed answer.** Reproduced: in recognize and predict,
uncommitted, `CircuitFlowPathPanel`'s text equivalent said "pInt between pump and membrane" — the
keyed prediction verbatim — and the pInt value guide (titled "pre-membrane", reading "after the
pump and before the membrane lung") said it again, both in the pane beside the question while the
walk card above them withheld correctly. Corrected: both surfaces gate on the commitment; the
precommit text equivalent describes the same schematic without placing any pressure channel and
says when the placements arrive; the three pressure guides wait together so the keyed one's absence
is not itself a pointer; the pArt safety boundary keeps its claim at both depths and defers only
its placement clause. A composed-DOM leak test mounts the whole activity and scans visible, hidden
and aria text sentence-by-sentence for semantic equivalents of the answer (not one wording), with
no negation exception, and was verified by mutation to fail against the pre-fix panel.

**B — phase clicks and phase URLs bypassed the commitment.** Reproduced: clicking `act`, or
mounting at `?phase=act`, exposed `Reported here:` with nothing committed, because the reveal
predicate was `phase !== 'recognize' && phase !== 'predict'`. Corrected: one authority,
`predictionCommitted`, derived from the committed choice id and nothing else, consumed by every
answer-bearing surface. Later phase buttons disable until commitment and the transition itself
refuses gated phases; a URL into a gated phase clamps to `predict` at the mount boundary, with a
note naming the phase that is waiting — no commitment is reconstructed from URL state or stored
traversal. Back-navigation preserves the session's commitment; a remount starts uncommitted. The
transfer→preview variant mappings remain authored and validated but are not honoured at an
uncommitted mount; the learner reaches those states through the transfer phase's own instruction.

**C — the compact workspace tabs were a keyboard trap.** Reproduced on the shared
`ResizableTeachingWorkspace`: inactive tabs at `tabIndex="-1"`, and ArrowLeft/Right/Up/Down, Home
and End all dead, so keyboard-only access to two of the three panes was impossible at compact
widths in every consuming module. Corrected with the WAI-ARIA tabs pattern (selection follows
focus, wrapping both ways, Home/End, Up/Down mirroring, one tab in the Tab order), pointer
activation and mounted-while-hidden panes unchanged. Shared-component tests added; consumers
characterized by running the mechanical-ventilation, mechanical-circulatory-support,
learning-module and cardiohelp-ecmo suites against the change.

**D — the RPM observability claim was false.** Reproduced, matching the review's numbers exactly.
The displayed-readout sweep from the settled reference (both tracks identical; baseline 3200 rpm,
flow 4.05, pVen −35; guided-action path: SET_RPM then six settle seconds):

| Δrpm | flow | pVen | pInt | pArt | ΔP  | faults / alarms / critical |
| ---- | ---- | ---- | ---- | ---- | --- | -------------------------- |
| +100 | 4.18 | −35  | 245  | 213  | 32  | none                       |
| +200 | 4.30 | −35  | 248  | 215  | 33  | none                       |
| +300 | 4.43 | −36  | 251  | 217  | 34  | none                       |
| +400 | 4.56 | −36  | 255  | 219  | 36  | none                       |
| −100 | 3.92 | −34  | 239  | 209  | 30  | none                       |
| −200 | 3.80 | −34  | 236  | 207  | 29  | none                       |
| −300 | 3.67 | −34  | 233  | 205  | 28  | none                       |
| −400 | 3.54 | −33  | 230  | 203  | 27  | none                       |

Smallest visible increase +300; smallest visible decrease −100; smallest symmetric magnitude 300.
Corrected: stem and both bounded actions use 300; +300 moves displayed pVen −35 → −36 and −300
moves it −35 → −34; every channel stays valid and nothing is charged. The pinned "two-hundred band"
test is replaced by the sweep, which distinguishes the three quantities on every run.

**E — the pan.** The defect did not reproduce: in the production build, right-drag at the default
framing enters no drag state, and past the unlock distance a right-drag pans the rig with the world
labels moving with it (verified in the running production page). The review's suspected mechanism
is disconfirmed — R3F v9 re-applies only props whose JSX value changed, so the constant
`enablePan={false}` was applied once at construction and the per-frame mutation owned the field
thereafter — and the code was byte-identical to the merge base, so the conflict was inherited, not
introduced. What was real is the split ownership, now resolved: the JSX prop is gone, the instance
locks in the ref callback before the first frame, and `applyBedsidePanFrameRules` in `panning.ts`
is the single writer, driven unchanged by the scene's `useFrame`. An integration regression runs a
real three-stdlib OrbitControls under real pointer events — dead drag at default framing, genuine
rig pan when zoomed, stale writes overridden in both directions — plus a comment-stripped source
pin that keeps a second authority from returning.

**F — the render harness was vacuous.** Reproduced: it passed `sensorNamesVisible`, a prop no
component declares; the committed content rendered only because the hook defaults to committed for
hostless callers, and forcing the hook to uncommitted left the harness exiting zero with zero
`Reported here:` cells on the page. Corrected: the harness passes the real `pastPrediction`
contract with both values, renders all six stops of both sections at both depths (65 foundation
states), hands the comparative stop a beat handler, and asserts every walk cell at render time —
requested stop actually rendered, no precommit reveal, committed reveal present, beats gated, the
two depths never identical. The same mutation now fails the harness with exit 1.

**G — two semantic gaps, both reproduced as green-suite mutations, both now killed.** Removing the
similar-flow qualifier from the `return-path-resistance` signature left all 49 suites green;
`gradientComparisonBasis` now declares the rule on the row (the check surfaced that
`membrane-resistance` states the same rule and now declares it too), and the import-time validator
couples declaration and sentence both ways, so the mutation dies at import in both tracks while
rewordings that keep the rule pass. Remapping `post-membrane` to the valid-but-wrong `hls-module`
also left every suite green; the resolved emphasis sets of the return and downstream-load stops are
now pinned in both tracks (DPC in VA only, never a drainage anchor), a geometric check ties the
post-membrane anchor to the object sitting on the post-membrane tubing, and the rendered
"Highlighted in the bedside scene" line is asserted — the same mutation now fails seven tests.

**H — this record undercounted its own diff** (twenty-eight for twenty-nine); corrected in §1.

**Two defects the correction pass's own verification found, both fixed.** First: the compact map's
type measured **11.36px at the review's 280px teaching-pane floor** — under the 12px floor, and
present since the walk shipped, because R3 nested the map's bordered card inside the walk's
bordered stop card and squeezed the drawing from the 246px R2's guarantee was authored against to
212px. The prior R3 pass never measured the floor (its panes were 320px and up). The map now takes
a `frame` prop — standalone consumers keep R2's card, the walk embeds it flush — restoring the
guaranteed width with the same geometry and type; re-measured at the exact floor in the rebuilt
production page. Second: the first version of the pan-ownership fix locked `enablePan` in the ref
callback unconditionally; callback refs re-run per commit and the scene re-renders every
simulation tick, so pan was re-locked between frames — the split-authority defect again, from the
other side, caught by re-running the production pan probe against the rebuilt page. The lock is
now keyed to the controls instance (`lockBedsidePanOnNewInstance`), with the exact regression in
the integration suite.

Verification of the correction pass: the review's focused command
(`npx jest src/features/cardiohelp-ecmo src/features/critical-care src/features/learning-module
'src/app/\[locale\]/cardiohelp-ecmo' --runInBand`) — **85 suites, 1767 tests, green**; consumer
characterization (mechanical-ventilation + mechanical-circulatory-support + learning-module) —
1397 tests green; `npm run build:content`, `npm run type-check`, `npm run lint` (0 errors, the 19
pre-existing warnings all in files this pass never touched), `npm run test:a11y` (16 green),
`npm run render:ecmo-teaching` (assertions on, exit 0), `npm run build`, `git diff --check` —
clean. Production-browser results are recorded in §10b.

## 10b. Production-browser verification of the correction pass

Run against the corrected build on the standalone production server, on the public-unlisted routes.
Where the harness's hidden pane suspends `requestAnimationFrame`, interaction state was read
synchronously off the OrbitControls event pipeline and label movement confirmed across forced
paints; the method and its one artifact (synthetic pointer capture) are noted so the measurements
can be re-taken.

| Check                                                                              | Result                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Precommit answer leak (visible + accessible DOM, recognize and predict, VV and VA) | None — sentence-level scan of the composed page, prediction item excluded, zero hits                                                                                                                                                 |
| Act click without commitment                                                       | No-op: button disabled, phase stays `recognize`, nothing revealed                                                                                                                                                                    |
| Direct `?phase=act` deep link                                                      | Fails closed: opens at `predict`, clamped note names the waiting phase, no reveal, no bounded actions                                                                                                                                |
| Commitment reveal                                                                  | "Reported here: drainage pressure (pVen)." appears on commit; committed text equivalent and pInt guide return; later phases enable; back-navigation preserves it                                                                     |
| Compact tabs, keyboard only (1024×768 and 390×844)                                 | Fully operable: arrows walk and wrap both ways, Home/End jump, Up/Down mirror; selection, focus, roving tabIndex and the visible pane move together; Teaching genuinely reachable                                                    |
| Map label floor                                                                    | 13.48px at 1280, 15.43px at 1024, 13.11px at 390; at the exact 280px pane floor, after the flush fix: 246px drawing, **13.18px segment and 12.45px site type** — above the 12px floor                                                |
| Pan                                                                                | Locked at default framing (right-drag enters no state); past the unlock distance a right-drag pans the rig and both world labels move with the drag (depth-dependent magnitudes)                                                     |
| Six 3D emphasis states                                                             | Stop 1 drainage site + clamp · 2 HLS · 3 HLS · 4 sensor + return site + return clamp · 5 HLS + drainage site + clamp · 6 sensor + HLS + return site + return clamp **+ DPC under VA**; never a drainage anchor at a return-side stop |
| Layout                                                                             | No horizontal document scroll at 1600×900, 1440×900, 1280×720/800, 1024×768, 390×844, or the 280px floor; exactly three `data-scroll-pane` scrollers; Back and Next visible throughout                                               |
| WebGL fallback                                                                     | Unchanged code path; covered by the existing jsdom fallback tests — not re-triggered in the browser                                                                                                                                  |

## 10c. The correction re-review: one remaining P1, corrected

The independent re-review accepted every corrected area and returned **BLOCKED** on one remaining
finding: the composed leak had a third instance, in the one component the correction pass's own
leak test had mocked away. `CircuitAndMonitors` — the primary pane's real circuit surface — placed
the keyed answer on its diagnostic pressure-zone map three ways at once: a visible `pInt` sensor
flag on the pump-outflow path between the pump and the membrane, the Δp bracket naming
`pInt − pArt` across the membrane, and an SVG `<desc>` that walks every channel along the blood
path ("Pump outflow passes pInt, a pre-oxygenator access point, and the membrane oxygenator").
All of it was mounted in the DOM before commitment — the tabpanel is `hidden`, not absent — and
one click on the Pressure-zone map tab put it on screen.

Reproduced failing-first at the re-reviewed head by rewriting the leak suite to mock only
`EcmoCircuit3D` (the WebGL leaf jsdom cannot render) and scanning the real composed activity: ten
of thirteen cases caught the `<desc>` sentence verbatim, in recognize, predict, the `?phase=act`
deep link, and after the tab click, in both tracks.

Corrected with an explicit disclosure contract on the component:
`CircuitLocationDisclosure = 'full' | 'withheld'`. Withheld keeps the drawing's topology — limbs,
pump, membrane, access point, arrows, the chatter cues — and the readout grid's channel names and
live values, and holds back exactly the placements: the four sensor flags, the Δp bracket, the
sensor legend row, and the description's channel walk, replaced by a truthful account (in the
`<desc>` and in a visible note) of when the placements arrive. The foundation activity derives the
value from `predictionCommitted`, the same single authority as every other answer-bearing surface;
every other consumer defaults to `full`, so the drills and the console tour — whose teaching the
locations are — render exactly as before. The scan itself now works per text node and per prose
sentence (SVG labels are period-less, and whole-page concatenation would let unrelated labels form
false adjacencies), covers SVG `<title>`/`<desc>`, hidden tabpanels, sr-only text and aria-labels,
and carries the re-review's added semantic patterns (pInt near pre-oxygenator, pump outflow, or
access point; pInt before the membrane or oxygenator). The gate was mutation-checked by forcing it
open — eight cases fail.

The temporary `claude-ecmo-prod` entry this pass had added to `.claude/launch.json` for
production-browser verification is removed again after the re-verification below; the branch
leaves the file as `main` has it.

Re-review verification: the leak suite reproduced failing-first (10 of 13), then 13/13 after the
fix, with the gate mutation-checked (forced open → 8 fail). Review's focused command — **85
suites, 1772 tests, green**; full `cardiohelp-ecmo` 1415 green; `build:content`, `type-check`,
`lint` (0 errors, the same 19 pre-existing warnings), `test:a11y` 16 green,
`render:ecmo-teaching` exit 0, `npm run build`, `git diff --check` — clean. Production browser,
corrected build: precommit the diagnostic panel reports `data-location-disclosure="withheld"`,
zero sensor flags, no Δp bracket, a `<desc>` free of every channel name that says when the
placements arrive, and the visible withheld note — identical after selecting the Pressure-zone
map tab; on commitment the panel flips to `full` with all four flags, the bracket, and the full
channel-walking description; a Practice-lane drill (`preload-drainage-collapse`) renders `full`
with all placements untouched. A pixel capture of the withheld map was again defeated by the
module's two-scroll-region screenshot limitation (§7c states the same for the 3D gate); the
layered DOM reads above are the evidence. With the launcher entry removed, the branch touches
**thirty-seven files**; §1's count note is superseded to that figure.
