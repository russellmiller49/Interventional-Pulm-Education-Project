# B5.1 — owner smoke-test findings and corrections

**These are owner findings, not participant findings.** Russell Miller ran a post-merge smoke test
of the B5 vertical slice on 2026-08-06, after [PR #72](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/72)
merged, and reported three observations with annotated screenshots. He is the module author and a
practising interventional pulmonologist, not a novice test participant.

Nothing here belongs in
[`b5-novice-findings-template.md`](./b5-novice-findings-template.md), which stays empty until a
learner has actually used the slice. Human novice validation is still pending.

- Branch: `claude/ecmo-b5-1-owner-smoke-test-corrections-2026-08-06`
- Base: `origin/main` at `efff2267` (the PR #72 merge commit)
- Scope: exactly these three observations. B2.1, the remaining fourteen teaching panels, broader
  CARDIOHELP display fidelity, new scenarios, and Practice/Assess behaviour were all out of scope
  and are unchanged.

---

## Summary

| #   | Observation                                                          | Severity | Status    |
| --- | -------------------------------------------------------------------- | -------- | --------- |
| 1   | A task-only simulation update was presented as a console interaction | High     | Corrected |
| 2   | Drainage chatter described but not visible; wrong default view       | High     | Corrected |
| 3   | Bedside 3D console resting on the wrong face; sweep label on it      | High     | Corrected |

Severity rationale: all three are **high** because each teaches something false. (1) sends the
learner hunting for a control that does not exist, (2) asks them to recognise a sign the interface
does not show, and (3) presents a device in a physically impossible pose with a label that names the
wrong object — on a module whose entire claim is that it is a faithful bounded model.

---

## Finding 1 — a task-only simulation update presented as a console interaction

### What the owner saw

Screenshot of the guided step card at `startup-settle-circuit`:

> "This is confusing. The user just needs to click 'Advance the model' but it makes the user think
> they need to do something on the console."

The card showed:

- kicker **“Recognize focus”** and, on the right, **“⊙ Focus: Device console”**
- title **“Advance the model and let the circuit reach its new state”**
- a primary button with the sliders/controls icon, **“Advance the model and let the circuit settle”**
- a secondary button **“⊙ I need help finding it”**
- Previous step / Next step / Restart lesson

### Reproduced cause

Confirmed by walking the VV startup orientation lesson to step 4 of 17.

The step exists for a real reason: `SET_RPM` moves a setpoint and nothing else, and the scenario
opens paused, so without an explicit advance the learner reached "now that it reports" with the pump
still stopped and every pressure channel showing the unavailable indication. Its two `STEP` actions
are a statement about the **model**, not about the device.

The player had no way to know that. It derived everything from the step's `target` and its action
list:

- `LearnLessonPlayer.tsx` published `activeStep.target` (`'console'`) on every step entry, so the
  console section got `data-guided-focus` and the "Guided focus: device console" flag.
- `resolveGuidedSimulatorTask` bails when `actions.length !== 1`, and has no case for `STEP`
  anyway — so `simulatorTask` was `null` and the UI fell through to the generic manual-action
  branch, which renders **“I need help finding it”**.
- `helpControlId` then fell back to `panelControlIds['console']` = `cardiohelp-console`, so the only
  thing the help button could do was spotlight the entire console `<section>`.

The learner was told to find something on the CARDIOHELP that does not exist there. Both the sliders
icon and the help affordance were, from the learner's side, promises the interface could not keep.

### Correction

A reusable, authored distinction rather than a special case on one step id:
`GuidedWalkthroughStep.interaction: 'simulator' | 'task-pane'` (default `'simulator'`).

Authored, not inferred: `startup-respond` carries one action and _is_ a genuine console task;
`startup-settle-circuit` carries two and is not. No rule over action types separates them.

For `interaction: 'task-pane'` the player now:

- publishes `null` as the focus target (`onTargetChange` widened to `GuidedTarget | null`), so no
  panel is highlighted and no "Guided focus" flag appears;
- renders no help-finding control at all — neither "I need help finding it" nor "Show me where";
- replaces the focus chip with **“🕐 Simulation update — no console action”**;
- uses a play icon on the action button instead of the sliders icon.

Copy, as specified by the owner:

| Slot        | Before                                                           | After                                                                                                 |
| ----------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Title       | Advance the model and let the circuit reach its new state        | Let the circuit respond                                                                               |
| Instruction | Advance the simulation so the circuit responds to the new speed… | No console action is required. Select the button below to update the simulation after the RPM change. |
| Action      | Advance the model and let the circuit settle                     | Let the circuit respond                                                                               |

The two `STEP` actions, the rationale, the expected-response list, and the separate Next step
control are unchanged. The VA clone `va-startup-settle-circuit` inherits the declaration.

Every genuine console, circuit, gas-panel, patient-monitor and trend task keeps its normal focus and
help behaviour — verified both in tests and in the browser (`startup-screen-parameters` still shows
"Do this on the simulator", "Show me where", and highlights `cardiohelp-screen-parameters`).

### Verification

`src/features/cardiohelp-ecmo/__tests__/task-pane-guided-steps.test.tsx` — 10 tests covering: the
authored declaration and its VA clone; no published focus target; `data-guided-focus="false"` on the
console; no help control of any kind; the new copy; both `STEP` actions dispatched; the resulting
running pump, positive flow and four `valid` readouts; and an ordinary console task keeping focus,
help and control highlighting.

Confirmed failing against the defect: removing the authored `interaction` marker fails **7** of the
9 tests that still exist without it — the parametrised task-pane case disappears with the flag.

Rendered-browser confirmation at 1600 × 900 (walked through the real lesson):

| Measure                                   | Before                  | After                                                                    |
| ----------------------------------------- | ----------------------- | ------------------------------------------------------------------------ |
| Focus chip                                | `Focus: Device console` | `Simulation update — no console action`                                  |
| `#cardiohelp-console` `data-guided-focus` | `true`                  | `false`                                                                  |
| Help-finding button                       | present                 | absent                                                                   |
| Action icon                               | sliders                 | play                                                                     |
| After clicking the action                 | —                       | 4.05 L/min at 3200 RPM; pVen −35, pInt 242, pArt 211, Δp 31, all `valid` |

### Status

Corrected.

### Noted, not corrected

Two other steps are task-only by the same reasoning but were not reported and are not touched here:
`startup-return-to-pre-use` (`LOAD_SCENARIO`, target `circuit`) and `startup-reassess` (`STEP`,
target `patient-monitor`). Applying the flag to them would change their focus and help behaviour and
would want copy the owner has not reviewed. The mechanism now exists; the decision is his.

---

## Finding 2 — drainage chatter described but not visible, and the wrong view selected

### What the owner saw

Two screenshots of `preload-drainage-collapse`, one on each circuit tab:

> "We should find a way to either make chattering visible on the 3d circuit or make the
> pressure-zone map the default view when its relevant."

The lesson text, the teaching pane and the predict pane all describe a juddering drainage limb —
"the drainage tubing is visibly juddering with each swing" — while the bedside 3D circuit, which is
the default tab, showed a limb at rest.

### Reproduced cause

Two independent causes, both confirmed:

**a. The 3D cue was gated on a threshold nothing reaches.** `BedsideScene.tsx` drove its wide
suck-down from `state.circuit.readouts.pVen.displayed <= -300`. The engine's own flag is
`drainageChatter` — past drainage capacity **and** `pVen < −75 mmHg` — and the authored preload sweep
bottoms out near **−143 mmHg** (`e5-model-limitations.md`). The only state reaching −350 is a closed
drainage clamp, and in that state the clamp's narrower pinch wins the `collapse > pinch` race in
`FlowTube`, so the wide collapse never rendered either. The bedside branch was dead code in
practice, and the engine's real signal had no 3D representation at all.

**b. No step could ask for a view.** `circuitView` was `useState('bedside')` with exactly one
override: a `guidedControlId`-keyed effect that surfaces the bedside tab when a clamp is
highlighted — and that only fires when the learner actively requests help. Nothing let a
pressure-localization step open on the map.

### Correction

**A — visible chatter in 3D.** The drainage limb is driven from `state.circuit.drainageChatter`
(via `ecmo-circuit/chatter.ts`, one owner for the flag), not from a second threshold of the view's
own. `FlowTube` gains a `chatter` mode that drives the suck-down as a repeating snap-shut-and-
spring-back at 4.5 Hz, written straight to the shader uniform rather than damped toward it (a 9/s
damp against that drive smooths the judder into a hum). Only the drainage limb receives it; the
camera and the scene are not shaken; the blood-flow animation is untouched; no engine or measured
value changes. The `pVen <= -300` trigger is gone.

Visible status cue: a **DRAINAGE CHATTER** chip in the 3D HUD, amber _and_ dashed so it does not
rest on colour.

Reduced motion (`prefers-reduced-motion: reduce`): no oscillation. The limb is held at a deeper
static crimp (0.42 vs the old static 0.35), so a still frame still reads as a drawn-shut limb, and
the word "chatter" is carried by the status cue and the map.

Because the WebGL viewport is `aria-hidden` in its entirety — HUD included — a `role="status"`
paragraph states the chatter in text. It sits on the circuit panel **outside both tabpanels and
outside the launch gate**, which is the second half of this correction and was got wrong the first
time: written inside `EcmoCircuit3D` it inherited the bedside tabpanel's `hidden`, so on the very
lesson that now _opens_ on the map the one line meant to carry the cue to a screen reader was hidden
exactly when it mattered — and it also sat below the gate's desktop minimum and below the WebGL
check. Where it is now it survives the view selection, a browser without WebGL, and a viewport too
small for the bedside scene to load at all.

**B — view preference.** `GuidedWalkthroughStep.preferredCircuitView: 'bedside' | 'diagnostic'`,
published on step entry together with the step id. `CircuitAndMonitors` applies it once per step
entry, keyed on that id, so a learner who then chooses the other tab keeps it for that step; the
next step that declares a preference applies it again. The circuit component still contains no
scenario ids (asserted by test).

Applied to the observe and predict steps of all six pressure-localization lessons —
`preload-drainage-collapse`, `afterload-return-obstruction`, `afterload-oxygenator-resistance` and
their three VA siblings — because each asks the learner to compare pVen, pInt, pArt or Δp, which
only the pressure-zone map lays out side by side. Applied as `'bedside'` to every clamp, de-airing
and resumption step, including the two gas-source transfer variants, because those controls live in
the bedside scene. Clamp-triggered guided help still forces the bedside view, and it wins over the
step preference.

Switching views does not reset simulator, lesson, prediction or scroll state: both tabpanels stay
mounted and are toggled with `hidden`, and the tab is local view state that dispatches nothing
(asserted by test).

**C — diagnostic-map cue.** The drainage limb carries `data-limb="drainage"` and
`data-chattering`, its wall goes to a broken (dashed) outline, and a bordered **DRAINAGE CHATTER**
badge names it in words. Text plus outline, so neither animation nor colour alone carries it — and
the existing reduced-motion rule already switches the map's `chatter` animation off.

### Verification

`src/features/cardiohelp-ecmo/__tests__/drainage-chatter-visibility.test.tsx` — 52 tests: the engine
flag drives both surfaces and both clear when the cause is corrected; the pump-stopped case; the VA
sibling; the removed threshold (comment-stripped source contract); the judder's range across the
cycle and its single held value under reduced motion; only one limb affected; the map's attribute,
dashed limb and badge; the accessible status line and its placement outside `aria-hidden`; the
authored preferences on all twelve pressure steps and every clamp step; opening on the map;
respecting a manual tab choice; re-applying on the next step; clamp help still winning; and no
dispatch or readout change on a view switch.

Confirmed failing against the defect: restoring the `pVen <= -300` rule, removing the map badge and
limb hook, removing the accessible line and removing the view preference fails **9**.

**Answer-leak check.** The cue is a _sign_, not a diagnosis, and the lesson's own observe step asks
the learner to see it ("Visible and text-labeled drainage chatter"). A dedicated test asserts that
before commitment the badge is present while `Preload-limited drainage pattern` is not, and the
schematic still reads "Pattern label withheld until reassessment and reveal".

Rendered-browser confirmation on `preload-drainage-collapse`:

| Measure                                   | Before    | After                                           |
| ----------------------------------------- | --------- | ----------------------------------------------- |
| Tab selected on entering the observe step | bedside   | **diagnostic**                                  |
| `[data-limb="drainage"][data-chattering]` | absent    | `true`                                          |
| Map badge                                 | absent    | `DRAINAGE CHATTER`                              |
| Drainage limb stroke                      | solid     | `9px, 5px` dashed                               |
| 3D HUD chip                               | absent    | `DRAINAGE CHATTER` (`data-state="CHATTER"`)     |
| Accessible status line                    | absent    | present, `role="status"`, outside `aria-hidden` |
| Drainage limb, two consecutive frames     | identical | visibly different mid-limb profile              |

### Status

Corrected.

**Limitation.** The frame-to-frame deformation was confirmed by comparing two consecutive browser
screenshots of the same camera, which show the drainage limb at different crimp depths. A
per-frame numeric readback was not possible: the canvas runs with `preserveDrawingBuffer: false` and
R3F's store is not exposed on the element. The drive function itself (`chatterPinchAmount`) is unit
tested across the whole cycle, and its wiring into the drainage limb is asserted by source contract.

---

## Finding 3 — the bedside 3D console rests on the wrong face, labelled as sweep gas

### What the owner saw

Screenshot of the bedside 3D circuit with two annotations:

> "The cardiohelp console is laying on its top and is labeled as sweep gas"

and, with an arrow to the lower face of the unit:

> "This side should be on the ground"

The `SWEEP GAS` pill sat on the console body. The `CARDIOHELP CONSOLE` pill sat far above the unit,
crowded into the `HLS MODULE` and `FLOW / BUBBLE SENSOR` labels.

### Reproduced cause

**Orientation.** `scripts/cardiohelp-ecmo/polish_runtime_assets.py` normalises assets with
`stand_longest_axis`, which assumes an asset's longest dimension is its height. For this model the
longest dimension (0.950 m) is the **width of the roll frame**, not the height, so the heuristic saw
Y already longest and did nothing. The console therefore rested on its local −Y face — the face
carrying the display panel and the connector row — with the pump-drive side to the sky. The runtime
applied only a yaw (`rotation={[0, -0.35, 0]}`), which cannot tip it back up.

Measured, then rendered. Flat, floor-facing area at each candidate extreme — all six, no cherry
picking:

| Candidate base        | Flat contact area | Contact footprint span |
| --------------------- | ----------------: | ---------------------: |
| local +X              |      **0.146 m²** |                   0.75 |
| local −X              |      **0.133 m²** |                   0.72 |
| local −Z              |          0.089 m² |                   0.85 |
| local −Y (as shipped) |          0.068 m² |                   0.40 |
| local +Y              |          0.061 m² |                   0.61 |
| local +Z              |         0.0007 m² |                   0.04 |

**The measurement narrows it to ±X and does not on its own pick between them** — they are the two
faces of the same slab and score within 10% of each other, which is what you would expect. What it
rules out is the as-shipped −Y (half the contact area of either) and everything else.

The render is what discriminates the pair, which is why reviewing in a rendered browser was a
requirement and not a formality: **+90° about Z** (base on local −X) puts the display panel forward
with the frame rails as feet and the carry handle on top; −90° is the same slab flipped, showing the
blank pump-drive face to the room. Six orientations were rendered in Blender and compared side by
side.

Corroborating: the display is an angled panel with local normal `(0, −0.594, 0.805)`, and only the
+90° roll turns it toward the bedside camera — 0.837 against 0.155 as shipped. A jest test now
measures floor-contact area from the shipped mesh directly, so a placement that stops resting the
asset on a real flat plate fails.

**Grounding.** `GroundedAsset` computed `FLOOR_Y − bounds.min.y * scale` from the **unrotated** GLB
and then applied the rotation to the same group. That is only correct for a yaw; with a roll the
console would have sunk through the floor.

**Labels.** Both defects are arithmetic, and both were confirmed numerically before the fix:

- `CARDIOHELP console` was pinned at a fixed `y = 0.62` while the grounded console's top was at
  `y = 0.230` — a **0.390 m** gap directly over the unit but well clear of it, which is why it
  drifted up into the HLS module's and sensor's labels.
- `SWEEP_SOURCE = (1.26, −0.46, 0.62)` lies **inside** the console's world bounding box. The
  sweep-gas curve started inside the console's own volume, so the pill landed on the console and
  read as naming it. There is no modelled blender or wall outlet anywhere in the scene.

### Correction

**Orientation.** `CONSOLE_PLACEMENT` in `ecmo-circuit/constants.ts` is now the single source of
truth — position, all three Euler angles (`[0, −0.35, π/2]`, three.js `'XYZ'`, so the roll applies
before the yaw) and scale. The runtime scene, the label layout and the offline Blender harness all
read it, so the preview can no longer disagree with the browser.

**Grounding.** New `ecmo-circuit/grounding.ts` transforms all eight corners of the model-local box
and returns both the origin to render at and the world box the asset occupies. No magic Y offset,
and reusable for any asset needing more than a yaw. The Blender harness grounds on transformed
bounds too.

**Labels.**

- `CARDIOHELP console` now hangs just above the transformed console top, offset outboard of the HLS
  module so the pill reads as the console's.
- The sweep-gas line enters on the floor in front of the console and is routed around it rather than
  through it, and its label is **`Sweep-gas line / source connection`** — naming the tubing and its
  connection, because that is what is actually modelled. The console is never labelled as a gas
  source.
- The HLS holder arm ended 0.12 m above the old console and would have ended 0.43 m above the new
  one; it now lands on the console's upper body, taken from the same bounds.

No patient, sensor, clamp or oxygenator asset was altered.

**Harness.** `render_scene_previews.py` now applies the full rotation and scale and draws the scene
labels at their exported anchors, so label placement is verifiable offline for the first time.

### Before / after measurements

| Measure                                                           | Before                                           | After                                |
| ----------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------ |
| Console rotation                                                  | `[0, −0.35, 0]`                                  | `[0, −0.35, π/2]`                    |
| World size (w, h, d)                                              | 0.848 × **0.950** × 0.905 m                      | 1.143 × **0.636** × 1.013 m          |
| Resting face                                                      | local −Y (the display face)                      | local −X (the flat base panel)       |
| Lowest point vs `FLOOR_Y` (−0.72)                                 | on floor                                         | on floor (exactly, to 1e−6)          |
| Display normal · direction to camera                              | **0.155** (edge-on, tipped back)                 | **0.837** (facing the camera)        |
| `CARDIOHELP console` label above model top                        | **+0.390 m** (adrift)                            | **+0.200 m**                         |
| Sweep source inside the console box                               | **yes**                                          | no                                   |
| Sweep curve samples inside the console (oriented box, 96 samples) | not measurable — the curve began inside the unit | **0**                                |
| Sweep label text                                                  | `Sweep gas`                                      | `Sweep-gas line / source connection` |
| Sweep label distance to the curve's source                        | 0.175 m (but the source was inside the console)  | 0.350 m, on open floor               |
| Console ↔ sweep label separation                                  | 0.950 m                                          | 0.763 m                              |
| HLS holder arm end vs console top                                 | **+0.120 m** (mid-air)                           | **−0.060 m** (on the body)           |

The two labels are slightly _closer_ after the fix, because the console is now 0.31 m shorter. That
is not the measure that mattered: before, the sweep anchor was **inside the console's own volume**,
so no separation between the pills could have stopped the pill from naming the console.

Offline renders (Blender, five poses, both tracks) are the visual record: the "before" render
reproduces the owner's screenshot exactly — the unit lying with its roll bars up and the `SWEEP`
label buried in its body — and the "after" render shows it upright with both labels on their own
objects.

### Verification

`src/features/cardiohelp-ecmo/__tests__/bedside-scene-geometry.test.ts` — 24 tests: the grounding
helper measuring rotated and scaled boxes and resting four different rotations exactly on the floor;
`CONSOLE_MODEL_BOUNDS` checked against the shipped GLB's own POSITION accessors (zero-dependency
chunk walk, so drift in the asset fails here); the roll; the floor contact; the standing proportions;
the display facing the camera; and per track — the console label over the console footprint and
within 0.35 m of its top, the sweep label within 0.4 m of the curve's source and outside the console
box, the console never named as a gas source, the two labels ≥ 0.5 m apart, no duplicate label id
and no two anchors within 8 cm, the sweep curve clear of the console's _oriented_ box, and the
holder arm landing on the console body.

Confirmed failing against the defect: restoring the old rotation, sweep source and label anchors
fails **11**.

Rendered-browser confirmation at 1600 × 900 (Learn and Practice, VV and VA): the console stands on
its base with the display face toward the camera, `CARDIOHELP CONSOLE` sits on the console, and
`SWEEP-GAS LINE / SOURCE CONNECTION` sits at the foot of the tubing rising from the floor in front of
it. Labels stay readable after orbiting.

### Reproducing the renders

The offline harness now draws the scene labels at their exported anchors, so both states can be
regenerated without a browser:

```sh
npx esbuild scripts/cardiohelp-ecmo/export-circuit-layout.mts --bundle \
  --platform=node --format=esm --outfile="$TMPDIR/export-circuit-layout.mjs" \
  && node "$TMPDIR/export-circuit-layout.mjs"
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/cardiohelp-ecmo/render_scene_previews.py -- \
  public/models/cardiohelp-ecmo scripts/cardiohelp-ecmo/circuit-layout.vv.json /tmp/ecmo-previews/vv
```

For the "before" state, set `consolePlacement.rotation` to `[0, -0.35, 0]` in the exported JSON and
re-run the Blender step: it reproduces the owner's screenshot — the unit lying with its roll bars up
and the `SWEEP` pill inside its body.

### Status

Corrected.

### Noted, not corrected

The four labels around the patient's groin (`FEMORAL VEIN — DRAINAGE`, `FEMORAL VEIN — RETURN · TIP
TOWARD RIGHT ATRIUM`, `DRAINAGE CLAMP`, `RETURN CLAMP`) overlap one another at the default camera.
This is pre-existing — it is present in the "before" render too — and is not one of the three
reported observations, so it is left alone. It is a candidate for a later label-layout pass.

---

## Viewport review

Rendered browser against the dev server, `preload-drainage-collapse` (Finding 2) and the startup
orientation lesson at `startup-settle-circuit` (Finding 1).

| Viewport   | Task-only step: chip / no help button | Pressure step opens on the map | Chatter cues (map badge + limb + status line) | Horizontal overflow | Duplicate ids |
| ---------- | ------------------------------------- | ------------------------------ | --------------------------------------------- | ------------------- | ------------- |
| 1600 × 900 | ✅ / ✅                               | ✅                             | ✅                                            | 0 px                | none          |
| 1440 × 900 | ✅ / ✅                               | ✅                             | ✅                                            | 0 px                | none          |
| 1280 × 720 | ✅ / ✅                               | ✅                             | ✅                                            | 0 px                | none          |
| 1024 × 768 | ✅ / ✅                               | ✅                             | ✅                                            | 0 px                | none          |

No label overlaps a control, and no new clipping, overflow, duplicate id or stale state appeared.
VV and VA scenes both remain coherent (checked in the offline renders and in the browser).

**Environment note.** The Learn workspace's step auto-completion runs inside
`requestAnimationFrame`; while the browser pane is backgrounded, rAF is suspended and a completed
simulator task appears not to advance. That is an artefact of the preview environment, not the
product — the same paths pass deterministically under jest, and they complete as soon as the pane is
fronted.

---

## Scope retained

Unchanged by this package, and re-checked: engine physiology; A1 readout semantics; A2 recirculation
behaviour; drainage-capacity behaviour; bubble-resumption behaviour; prediction scoring; Practice and
Assess behaviour; routes; persistent ids; progress and storage; publication status; the fourteen
non-pilot panels.
