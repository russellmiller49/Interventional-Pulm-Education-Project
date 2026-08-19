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
and the render harness.

Untouched: the engine, every scenario, every route, `progress.ts`, the storage key, the progress
envelope, scoring, mastery, Practice, Assess, publication status, `learningPathways.ts`,
`pathwayResolver.ts`, `circuitSegments.ts`, `localizationCards.ts`, `ecmoValueGuides.ts`,
`evidence.ts`, the six frozen pilot panels, and PR #94.

## 2. Owner decisions, as taken

- **R3-OD-1 (the bounded speed change)** — taken as recommended, option (a). The step widens from
  two hundred rpm to four hundred and the stem's number follows it. §3 records why this was
  blocking rather than cosmetic.
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

Four hundred is the smallest step this console can show the change at: −35 → −36 raising, −35 → −33
backing off, with no fault injected, no alarm, and no critical error charged, because a reference
circuit carries no drainage capacity to exceed. The item keeps its id, its four choices, its key,
every rationale and its explanation.

`foundation-comparisons.test.ts` asserts on `readouts.*.displayed` throughout — a suite written
against the raw model values would have passed the whole time the lesson was contradicting itself —
and pins the two-hundred band explicitly, so shrinking the step back into it fails with a sentence
saying what went wrong.

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

## 7. Verified

- `npx jest src/features/cardiohelp-ecmo src/features/critical-care src/features/learning-module 'src/app/\[locale\]/cardiohelp-ecmo' --runInBand` — 83 suites, 1714 tests, green.
- `npm run type-check`, `npm run lint` (no new warning), `npm run test:a11y` — green.
- `npm run render:ecmo-teaching` — sixty-nine foundation cells, every stop against every state its
  section is rendered on, both tracks. Reviewed on :8099.
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
