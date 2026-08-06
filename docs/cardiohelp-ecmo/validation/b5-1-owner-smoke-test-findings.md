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

| #   | Observation                                                          | Severity | Status                  |
| --- | -------------------------------------------------------------------- | -------- | ----------------------- |
| 1   | A task-only simulation update was presented as a console interaction | High     | Corrected               |
| 2   | Drainage chatter described but not visible; wrong default view       | High     | Corrected               |
| 3   | Bedside 3D console resting on the wrong face; sweep label on it      | High     | Corrected (2nd attempt) |
| 4   | Teaching pane rendered white text on a near-white surface            | High     | Corrected               |

Finding 4 arrived after the first three were pushed and is corrected on the same branch.

Severity rationale: the first three are **high** because each teaches something false. (1) sends the
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

### Reproduced cause, and a correction that took two attempts

**Orientation.** `scripts/cardiohelp-ecmo/polish_runtime_assets.py` normalises assets with
`stand_longest_axis`, which assumes an asset's longest dimension is its height. For this model the
longest dimension (0.950 m) already lay along Y, so the heuristic did nothing — and it has no way to
tell a height from a height that is upside down. The console therefore rested on local **−Y**, which
is its top: the pump drive and connectors faced the sky. The runtime applied only a yaw
(`rotation={[0, -0.35, 0]}`), which cannot turn it over.

**The first fix was wrong, and the way it was chosen is the lesson.** It leaned on measured
geometry — flat contact area at each candidate extreme, support-footprint span, mass distribution —
and rolled the console 90° about Z onto local −X. The owner's second smoke test: _"ITS STILL ON ITS
SIDE."_

Those metrics could not have produced the right answer. The asset is a body inside a tubular roll
cage, and the cage dominates every one of them:

| Candidate base         | Flat contact area | Support-span fraction |
| ---------------------- | ----------------: | --------------------: |
| local +X               |          0.146 m² |                  0.75 |
| local −X (1st attempt) |          0.133 m² |                  0.72 |
| local −Z               |          0.089 m² |                  0.85 |
| local −Y (as shipped)  |          0.068 m² |                  0.40 |
| **local +Y (correct)** |      **0.061 m²** |              **0.70** |
| local +Z               |         0.0007 m² |                  0.04 |

The correct base scores **lowest of all six on flat contact area** — it is a curved tube rail, not a
plate — and its support span is indistinguishable from the as-shipped orientation's. Any metric that
appeared to select a face was selecting noise. A second-order error followed from the same
confidence: a panel with a large recessed rectangle and a control knob was identified as the display
and used to corroborate the choice, and it is not the display.

**What actually settles it is the owner's own first sentence:** _"The cardiohelp console is laying on
its top."_ If the face it rests on is the top, the base is the opposite face — a **180° flip about
X**, not a roll. Rendering all six candidates from the app camera side by side confirms it: only the
flip stands the unit on the lower loop of its frame with the body upright and the carry handle on
top. Every other candidate rests on a cage edge, a corner, or the machine's own top.

The lasting change is not the angle. It is that `constants.ts` now says in terms that the render
decides this, the geometry suite says the same in its header, and the two tests that dressed up
non-discriminating metrics as evidence are gone rather than retuned until they agreed.

### Correction

**Orientation.** `CONSOLE_PLACEMENT` in `ecmo-circuit/constants.ts` is now the single source of
truth — position, all three Euler angles (`[π, −0.35, 0]`, three.js `'XYZ'`) and scale. The runtime
scene, the label layout and the offline Blender harness all read it, so the preview can no longer
disagree with the browser. Its doc comment says plainly that the render decides this and that the
geometry metrics do not.

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

| Measure                                     | Before                         | After                                |
| ------------------------------------------- | ------------------------------ | ------------------------------------ |
| Console rotation                            | `[0, −0.35, 0]`                | `[π, −0.35, 0]`                      |
| Face on the floor                           | local −Y (the unit's **top**)  | local +Y (its base)                  |
| World size (w, h, d)                        | 0.848 × 0.950 × 0.905 m        | 0.848 × 0.950 × 0.905 m              |
| Reads as                                    | lying on its top, cage legs up | upright on its foot rail, handle up  |
| Lowest point vs `FLOOR_Y` (−0.72)           | on floor                       | on floor (exactly, to 1e−6)          |
| `CARDIOHELP console` label above model top  | **+0.390 m** (adrift)          | **+0.200 m**                         |
| Sweep source inside the console box         | **yes**                        | no                                   |
| Sweep curve samples inside the oriented box | began inside the unit          | **0** of 96                          |
| Sweep label text                            | `Sweep gas`                    | `Sweep-gas line / source connection` |
| HLS holder arm end vs console top           | **+0.120 m** (mid-air)         | **−0.060 m** (on the body)           |

The bounding box is unchanged, because the correction is a flip rather than a roll — which is
exactly why no box-derived measurement could have caught it, and why the render is the evidence.

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

Corrected on the second attempt, and confirmed in a rendered scene rather than by measurement. The
first attempt is left in the git history rather than tidied away: it is the clearest record this
package has of a measurement that looked authoritative and was not.

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

---

## Finding 4 — the teaching pane was white text on a near-white surface

### What the owner saw

> "in the think aloud session view the text is white on white background so you cant read it."

Screenshot of the VV Learn workspace on `startup-sensor-orientation`. The middle pane's cards were
light: the "Why this step matters" wash had gone cream with its text barely visible, and the drill
panel's "WHAT IS BEING DECIDED" and "THE STATE ON SCREEN RIGHT NOW" sections were white boxes with
no readable body at all. The console pane and the lesson pane beside them were still dark.

### Reproduced cause

Not a colour choice and not a theme toggle — the module ignores both the app's light/dark switch and
the OS `prefers-color-scheme`, and both were checked. It is a **specificity tie whose winner is
decided by stylesheet order**.

`.workspace` in `src/features/learning-module/curriculum/teaching-workspace.module.css` paints a
light shell:

```css
color: var(--tw-ink); /* #15323a */
color-scheme: light;
background: #eaf1ef;
```

`.deviceWorkspace` in `EcmoLearnWorkspace.module.css` inverts all three for the ECMO subtree. Both
are **single-class selectors in different stylesheets**, so with equal specificity the cascade falls
back to source order — a build and route-chunking detail, not something either file controls.

`color` had already been doubled to `.deviceWorkspace.deviceWorkspace` for exactly this reason, with
a comment saying so. `background` and `color-scheme` had not. So the inversion could lose _half_ of
itself: the shell's light surface won, the module's near-white text won, and the two met.

Everything in that pane then failed at once, because none of those cards paints an opaque
background of its own:

| Element                | Background                                 | On the dark shell | On the light shell |
| ---------------------- | ------------------------------------------ | ----------------- | ------------------ |
| `.guidedWhy`           | `rgba(90, 59, 13, 0.18)` — 18% opaque      | dark amber wash   | cream              |
| Drill panel `section`  | Tailwind `border` only — **no background** | dark              | white              |
| `.guidedSnapshot span` | `rgba(5, 24, 28, 0.62)` — 62% opaque       | dark tile         | muddy grey         |

Confirmed by simulation: appending a same-specificity rule for the shared shell after the module's
reproduces the owner's screenshot exactly, card for card.

### Correction

`background` and `color-scheme` move onto `.deviceWorkspace.deviceWorkspace`, alongside the `color`
that was already there. The design tokens stay on the single class — the shell declares none of
them, so nothing contests them and doubling would only add noise.

The foundation workspace's `.readableWorkspace` was checked and left alone: it _agrees_ with the
shared shell rather than inverting it (same `color-scheme: light`, no competing background), so
losing the tie changes nothing. Only an inverting workspace needs the doubled selector.

### Verification

`src/features/cardiohelp-ecmo/__tests__/workspace-surface-contrast.test.ts` — 12 tests: that the
shell still declares all three properties; that all three are on the doubled selector; that none is
left on the single class; that the inversion is still an inversion; that the tokens stay where
nothing contests them; and that the foundation workspace does not need the same treatment.

Confirmed failing against the defect: restoring the pre-fix shape fails **5 of 12**.

Rendered-browser confirmation: with a same-specificity shell rule appended last — the exact
condition that produced the screenshot — the workspace stays `rgb(6, 21, 25)` and the pane is
readable. Before the fix the same simulation turned it `rgb(234, 241, 239)`.

### Status

Corrected.

### Why this was invisible to the test suite

jsdom does not resolve a cascade across CSS-module files, so no rendered assertion in this repo
could have caught it, and no amount of axe running against the component tree would either. The
contract is written against the stylesheets themselves because that is where the defect lives.

## Scope retained

Unchanged by this package, and re-checked: engine physiology; A1 readout semantics; A2 recirculation
behaviour; drainage-capacity behaviour; bubble-resumption behaviour; prediction scoring; Practice and
Assess behaviour; routes; persistent ids; progress and storage; publication status; the fourteen
non-pilot panels.
