# EBUS-PRE-REVIEW-03 — model landmarks, camera control and sweep feedback: handoff

**Batch scope:** lane 03 of the EBUS fellow-walkthrough package — whether a learner can read the
model's landmark markers, control the observer camera without the model trapping the page, and see
what the rotation sweep is genuinely waiting for. **This is model presentation and interaction-state
truth.** No anatomy was recalibrated, no sweep threshold or rotation changed, no Doppler behaviour
added, no patient image annotated, no measurement calibrated, and no question, key or clinical claim
rewritten. Lanes 04 (teaching clarity) and 05 (clinical and media drafts) are untouched. Prompt 01
(#249) and Prompt 02 (#251) behaviour was re-driven, not revisited.

The walkthrough this batch repairs is Claude in a first-year-fellow persona, not a fellow and not a
faculty reviewer. Nothing here is evidence that the module teaches what it intends to. **No merge,
deployment, clinical approval, media decision or usability session is claimed or performed.**

## Repository reconciliation

| Field                   | Recorded value                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smoke-tested main       | `f01e43e2410e96f8f77a0db6814a4853749add24` (POST-MERGE MAIN SMOKE: PASS WITH DOCUMENTED BASELINE FAILURE)                                                                                                                                                                                                                                                                                                  |
| Implementation baseline | `2124cd0f3483db6534ab65bf6dd3730b59fee463` = `origin/main` when this batch started (2026-09-21)                                                                                                                                                                                                                                                                                                            |
| Relationship            | the smoke SHA is an ancestor of the baseline; four commits separate them (#255 ECMO-FELLOW-01, #257 CRRT-FELLOW-01, #256 MCS-9-21 and its docs follow-up). None touches EBUS; they were integrated by starting from current main, not by resetting to the smoke SHA.                                                                                                                                       |
| Checkout                | `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/claude-ebus-2-9-21`, a fresh worktree at the baseline, clean at start                                                                                                                                                                                                                                                               |
| Branch                  | `claude/ebus-anatomy-sweep-9-21` (renamed from the harness's `claude/ebus-2-9-21`, unpushed, clean, at the baseline; the suggested name was free)                                                                                                                                                                                                                                                          |
| Final head              | `b3a16dd31b23c3a107f056feb5b077719c80885c` (`b3a16dd3`), the last implementation/test commit; the handoff and status commit follows it and is the PR head. The production build was run at `4fdf76ee`, which differs from this head only by a type annotation in `e2e/ebus-anatomy-sweep.spec.ts` (no runtime or built file).                                                                              |
| Ports and profiles      | dev 3131 and production standalone 3132 in this worktree (added to `.claude/launch.json`), a detached throwaway baseline checkout at the implementation SHA on 3133 (`/private/tmp/ebus03-baseline`, removed after use), disposable Playwright contexts and synthetic learner state only; no owner profile or progress touched                                                                             |
| Instructions read       | root `AGENTS.md` and `CLAUDE.md`; `EBUS_MODULE_HANDOFF_2026-09-21.md` (precedence on execution status); package `03_EBUS_ANATOMY_AND_SWEEP_USABILITY.md`, `00_START_HERE.md`, `OWNER_DECISIONS.md`, `PI_EBUS_COORDINATION.md`, `SOURCE_CONTEXT.md`, lane-03 rows of `FEEDBACK_LEDGER.json`; the original walkthrough DOCX (lessons 3, 4, 5, 11, 12, 13, 19 and figures 13, 14, 17); the 01 and 02 handoffs |

## Where the state actually lives (traced, not inferred)

- **Renderer and canonical IDs.** The linked lessons (3, 4, 11, 12, 13) render in
  `EBUS-course/apps/web/src/guided/LinkedModelView.tsx` from three glTF groups loaded by
  `linkedModels.ts` and integrity-checked against the acoustic volume's `sourceGeometrySha256`:
  `mediastinum-teaching.glb` (23 meshes, `userData.semanticId` = mesh name, e.g. `carina`,
  `superior_vena_cava`, `azygous`), `ebus-scope-teaching.glb` (`transducer_face`, `optical_lens`,
  `channel_outlet`, `legacy_distal_body`, …) and `node-examples.glb` (`node_station_7`, `node_station_4r`, …).
  Landmark answers are `LINKED_LANDMARKS` in `src/lib/ebus-linked-contract.ts`. Letters are the index
  of each candidate in glTF traversal order — the same order the selector, the picker and the
  markers already shared. **No ID, mapping, mesh or order changed.**
- **Transforms.** The scope sits at `teachingScopeMatrix(pose)` (scope view: at the origin in the pose
  basis; anatomy view: at `pose.position`) and the fan at the pose's depth and cephalic axes; the
  same pose feeds the acoustic renderer. The model frame is web `[x, y, z]` = patient `[L, S, −P]`
  (`src/lib/bronchoscopy-core/devices.ts`), so +x is the patient's left, +y superior, +z anterior.
- **Sweep events.** `ContinuousSectorView` reports each rendered frame (`targetVisible` = the target
  label appears in the rendered frame's structures; `frameId` = hash of the pixels, pose and
  controls). `SimulatorPage` samples the sweep once per roll action, only when the frame for the
  current pose is ready, through `sampleLinkedSweep` in the contract. The host gate is
  `labGoalMet`/`labGoalRequirements` in `src/features/ebus-guided/content/types.ts`. The bridge
  (`src/lib/ebus-guided-bridge.ts`) validates origin, source window, session, task and
  `observationRequest`; the host drops demonstration observations and anything without its session.
- **Route model.** `ModelViewport.tsx` draws the lesson-19 arrow from the contract's locator to
  its target (`model-contract.json`, `routes[].airway|esophageal → target`).

## Baseline reproductions (implementation baseline `2124cd0f`, 1246×1021)

Headless Chromium (SwiftShader) through the real host and embedded app; bridge events read from the
host window; the report's viewport. Geometry in css px of the 3D canvas.

| Report item                                  | Reproduced | Measured                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fig. 13 / L3-3 leader crowding               | yes        | canvas 399×300; the four leader endpoints lie in a 17×43 px box; closest pair 6.9 px (B–D). Whole-scope view: a 4×9 px cluster, closest 1.5 px (L3-2's "tiny fan and dot")                                                                                                                                                                                                                                       |
| L3-3 letters swap sides with rotation        | yes        | at roll +85 A,B right / C,D left; at +40, 0, −40, −85 A,B left / C,D right                                                                                                                                                                                                                                                                                                                                       |
| L3-3 hovering a letter highlights nothing    | yes        | no class, no tooltip, no leader change on hover or focus                                                                                                                                                                                                                                                                                                                                                         |
| L3-4 gold means arrow and selection          | yes        | selection text "highlighted in gold"; gold emissive on the selected part                                                                                                                                                                                                                                                                                                                                         |
| L3-5 success never names the parts           | yes        | "Landmarks identified. Acquire the required ultrasound sweep."; a wrong check says only "Try another structure."                                                                                                                                                                                                                                                                                                 |
| L3-13 wheel over the canvas                  | partly     | on the first run the wheel over the canvas did **not** scroll the page (the model captured it); on the second run, with the canvas mid-viewport, the first wheel scrolled the page and the wheel after a click did not. Both are the same trap: the canvas owned the wheel whenever OrbitControls had it, with `touch-action: none` and no keyboard focus (`tabIndex` −1). The caption promised "scroll to zoom" |
| L4-4 letters with no landmark task           | yes        | four letter markers rendered in the lesson-4 acquisition                                                                                                                                                                                                                                                                                                                                                         |
| Fig. 14 / L11-3, L13-3                       | yes        | eight letters; closest endpoints 11.3 px (C–E, the walkthrough's "~11 px"); endpoint spread 120×123 px; the world-anchored "S" sprite clipped at the top edge; lessons 11 and 13 identical layouts (L12-3)                                                                                                                                                                                                       |
| L11-4 demonstration                          | yes        | opens on the Anatomy tab (title names the model section) with an isolated carina of 590 triangles, about 30 px across                                                                                                                                                                                                                                                                                            |
| L12-4 start inside the target                | yes        | left main bronchus, roll +85: `targetVisible` true from the first frame; twelve paused steps +85 → −40 all `find-edge`, samples 0, status "Find a plane just beyond the target" throughout; the pass only begins after leaving at −65 and returning                                                                                                                                                              |
| L12-5 scope/fan not seen in the anatomy view | yes        | drawn at the pose, but at the whole-model camera the tip and 40 mm fan are a few pixels                                                                                                                                                                                                                                                                                                                          |
| L19-1 arrows                                 | yes        | caption "Arrows show viewing direction"; the arrow exists but the camera stood 3.3–10.9° off its axis, so it projected to 4.5 px (7 airway), 11.8 (7 esophagus), 16.8 (4L airway), 17.9 (4L esophagus) on a 473×355 canvas; no structure labels                                                                                                                                                                  |
| L3-6 sweep status                            | yes        | three generic headings, no target name, no in-plane state, no reset reason, thresholds unstated                                                                                                                                                                                                                                                                                                                  |

**The model's in-plane windows, measured in the browser on the baseline (1° steps):** right main
bronchus preset −71° … +49°; left main bronchus −60° … +89°, out only at the +90° stop (the
walkthrough's "recorded only at the +90° end stop"). Offline with the same renderer at 1° for every
guided setup: RMS −71…49, LMS −60…90, LMS changed −54…77, 4R −32…57, 4R changed −29…53
(`scratchpad` measurement, 80 beams / 100 samples; the browser worker uses up to 160 / 256, hence the
one-degree difference at the LMS stop). **These are model observations, not clinical benchmarks, and
were not changed.** → owner queue (L3-7, L11-6, L12-4 window).

## What changed, by source ID

"Fixed" means observed on the baseline and observed gone on the production build of this branch.

### A. Readable structure references

| ID               | Status               | What was done                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L3-2**         | Fixed                | The scope view frames the actual bounds of the distal parts (transducer, lens, outlet, body, bending section, balloon) from the same direction as before; "Show whole scope" frames the whole device's bounds. Sphere fit (`fitSphereDistance`), so the frame holds from any direction.                                                                                                 |
| **L3-3**         | Fixed                | Endpoint separation 6.9 → 12.7 px (closest pair), spread 17×43 → 34×77 px at the default camera; a marker keeps its column until its anchor is clearly across the midline (`assignColumns`, 16 % hysteresis) — constant `A,B right / C,D left` from +85 to −85; hovering or focusing a marker highlights its structure (teal) and its leader; hovering the model highlights its marker. |
| **L3-4**         | Fixed                | Selection is violet everywhere (marker fill with square corners, leader, endpoint, mesh emissive, section cross); hover is a teal ring; gold is the optical arrow only; the cyan fan is unchanged.                                                                                                                                                                                      |
| **L3-5**         | Fixed                | A wrong check names what was chosen: "Structure B is the distal body, not the transducer surface. …"; success names each landmark with its letter; "Show structure names" turns the markers into named pills at any time (stated as allowed and unscored).                                                                                                                              |
| **L3-9**         | Fixed (presentation) | The model section now uses the 3D colour code from the volume's own label kinds and keys — veins blue, arteries red, heart chambers mauve, esophagus tan, nodes yellow — with a kind legend, and the selected-position cross is violet. Names on the section still come only from the existing discovery layer, which the course withholds during acquisition by design.                |
| **L3-11**        | Fixed                | Canvas 300 → 360 px tall; the anatomy view frames the landmark region (candidate anchors + example node + scope tip) with "Show whole model" one control away; the fan is drawn after the nodes; a screen-space compass replaces the three world-anchored letters (nothing clips). Translucency values are unchanged (hover raises a structure to 0.82).                                |
| **L4-3**         | Fixed                | The tip-and-wall close-ups label air, airway wall and tissue at the centroids of the sampled model labels, plus the transducer mark; the legend says what the bands are.                                                                                                                                                                                                                |
| **L4-4**         | Fixed                | Markers appear only while a landmark task is open, or on request; the lesson-4 acquisition shows none.                                                                                                                                                                                                                                                                                  |
| **L11-3, L13-3** | Fixed                | Closest endpoints 11.3 → 17.6 px (lesson 11) and 18.5 px (lesson 13); spread 120×123 → 165×175 / 173×179 px; 0 leader crossings, 0 overlapping markers, 0 outside the canvas; markers 34 px (a generic 42 px button minimum had been inflating them). Zoom in / out buttons and keyboard camera.                                                                                        |
| **L11-4**        | Fixed                | The ct-map demonstration opens on **Model section**, the view its title names; when the isolated structure is shown, the camera frames that structure instead of the whole model.                                                                                                                                                                                                       |
| **L12-3**        | Adapted, as directed | Letters stay stable across lessons and within a task (no shuffle); the named reference is optional.                                                                                                                                                                                                                                                                                     |
| **L12-5**        | Addressed            | The scope tip and fan were already drawn at the pose in the anatomy view (their registration is the shared geometry hash); the regional framing now makes them visible and the caption says so. No new linkage was invented.                                                                                                                                                            |

### B. Genuine sweep state

| ID              | Status                        | What was done                                                                                                                                                                                                                                                                                                        |
| --------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L3-6**        | Fixed                         | The panel names the model target, says whether the current frame has it in plane, what the pass is waiting for, how many paused frames and degrees this pass has (labelled transient model samples — not a score), why the last pass reset, and the authored tolerances in a disclosure ("not clinical thresholds"). |
| **L12-4**       | Fixed (status), held (window) | From the left main bronchus the panel now says the target is already in plane and that a pass must begin from a plane without it. **The start pose was not changed**, so the model's geometry and the authored `initialRoll` are untouched; the window itself is an owner decision.                                  |
| **L3-7, L11-6** | Held → owner queue            | Measured windows above.                                                                                                                                                                                                                                                                                              |

**Sampler.** `sampleLinkedSweep` is byte-for-byte the same decision path; `stepLinkedSweep` is that
path with its branch named (`inside`, `outside`, `started`, `sample`, `complete`, `entered-too-fast`,
`reset-reversed`, `reset-step`, `reset-contact`, `reset-early-exit`, `already-complete`,
`unchanged`), and `LINKED_SWEEP_TOLERANCES` names the numbers it always used (0.45, 12°, 5, 20°). A
Jest test runs a verbatim copy of the old sampler beside the new one over the seven journeys and
holds them equal; another holds the constants to those values. **No event-accounting defect was
found**: every "never counted" observation in the walkthrough is the sampler doing what it is
authored to do (a pass begins on the first paused frame _after_ a frame without the target). One
behaviour worth knowing: the sampler sees frames only after a roll action, so a learner whose first
action is a large jump into the target reads "already in this plane" rather than "came into view
too quickly" — both tell the learner the same thing to do. Nothing was seeded to change that.

**Event sequences, production build (bridge events, roll → visible → sampler → panel):**

- J1 outside → cross → exit (RMS): +85 … +55 `outside`; +45 `started` (crossing 1/0°); … −65
  (crossing 12/110°); −75 `complete` — panel "Sweep recorded"; host requirement `linked-sweep` met.
- J2 start inside (LMS): +85 (in plane, no sample yet) → +80 … −40 all `inside`, samples 0 — panel
  "The target is already in this plane"; requirement unmet.
- J2b leave then return (LMS): −65 `outside`; −60 `started`; … −20 crossing 9/40° — panel
  "Crossing the target", progress "9 of 5 paused frames, 40° of 20°" plus the far-side condition.
- J3 reverse partway (RMS): crossing 4/25° at +20; +30 `reset-reversed` — panel "The last pass
  was reset because the rotation direction reversed while crossing the target."
- J4 jump too fast (RMS): +80 `outside`; +30 `entered-too-fast` — panel "The target came into
  view too quickly … the step between the last two paused frames was larger than 12°".
- J5 reset → change position → repeat: Reset acquisition reboots the iframe: new session id,
  `actionCount` 0, `sweeps` {}; then LMS, +90 `outside`, +85 `started`, … +60 crossing 6/25°.
- J6 demonstration then real attempt: the demonstration iframe's observations carry `ready:false`,
  `actionCount` 0, `sweeps` {} and the host never forwards them (Jest proves the host drops them
  even with the issued session id, and forwards a real one); the demonstration shows no sweep
  panel; the first real observation has `actionCount` 0 and `sweeps` {}.
- J7 continue without an acquisition: the next step shows `held-missing` — "No acquisition is held
  in this session".

Before the change the same sequences produced the same sampler states with three generic
headings and no reason (baseline reports `baseline` and `baseline-v2`).

### C. Camera, scrolling and captions

| ID        | Status                                    | What was done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L3-13** | Fixed                                     | The wheel and one-finger touch drive the camera only while the view is engaged — a click, a tap (a finger that scrolls does not engage), or keyboard focus — and Escape, blur or a pointer elsewhere releases it; `touch-action` is `pan-y` while released. Explicit Zoom in / out, Orbit and Reset buttons; keyboard on the focusable canvas (arrows orbit and tilt, + / − zoom, Home resets, Escape releases). Browser zoom is never intercepted. The caption states exactly this; "scroll to zoom" is gone from both views.                                                                        |
| **L3-12** | Implemented from scene state              | The Bronchoscopy tab caption reports the lens's calibrated optics (35° oblique, 80° field), the distance along the optical axis to the first airway-wall hit from the same channel mesh and pose the view renders from, and the contact index; when that distance is within the calibrated contact clearance it says the centre of the view is wall rather than lumen. It never asserts that a pink field is contact.                                                                                                                                                                                 |
| **L5-3**  | Fixed                                     | The echo schematic carries a condition-specific caption and on-image labels at the modelled origin of the dark band (air gap at the face; focal air interface for the bubble; modelled reflector for the shadow; the two coupled states). No mechanism is asserted and no recorded image is interpreted; the concealed 3D part names are untouched.                                                                                                                                                                                                                                                   |
| **L19-1** | Fixed (arrows, labels), corrected (claim) | The camera now looks at the same fixed target from 62° off the approach vector, so the contract arrow projects to 46.6–68.3 px instead of 4.5–17.9; the arrow is a solid shaft-and-head mesh drawn over the translucent meshes; the model's own labelled structures (trachea, carina, main bronchi, esophagus, aorta, pulmonary artery, azygos, the locator, the node as "Example node") are named on the canvas with a toggle; the caption now says what the arrow is. Locator and target coordinates are the contract's, unchanged. The developer phrasing in the route's `source` line is lane 04. |

## Colours, shapes and what they mean

| Meaning                      | Before                      | After                                                                                              |
| ---------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------- |
| Optical direction            | gold arrow                  | gold arrow (unchanged)                                                                             |
| Ultrasound plane             | cyan fan                    | cyan fan (unchanged, now drawn over the nodes)                                                     |
| Selected structure           | gold emissive + gold marker | violet fill, square-cornered marker, violet leader/endpoint, violet emissive, violet section cross |
| Hovered or focused structure | nothing                     | teal ring on the marker, teal leader/endpoint, teal emissive                                       |
| Route arrow                  | 1 px line, blue/teal        | solid mesh, light blue (airway) / teal (esophagus)                                                 |

## Camera behaviour before / after

| View                   | Before                                              | After                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope, default         | fixed focus 12,10,0 at 82 mm                        | distal-part bounds, same direction, sphere-fit; endpoints 17×43 → 34×77 px                                                                                                        |
| Scope, whole           | fixed focus 99,−1,0 at 415 mm                       | whole-device bounds; the four tip endpoints stay a 5×13 px cluster (closest 2 px) because the tip is small against the device — a reference view, with the framed tip the default |
| Anatomy, default       | whole model (target −10,1222,161; eye 135,1275,340) | landmark region (anchors + node + tip), same direction; "Show whole model" restores the historic view exactly                                                                     |
| Anatomy, isolated demo | whole model                                         | the isolated structure's bounds                                                                                                                                                   |
| ct-map demo            | Anatomy tab                                         | Model section (the titled view)                                                                                                                                                   |
| Routes                 | on the arrow axis, 125 mm out                       | 62° off the approach about an axis perpendicular to it, 125 mm out, 22 mm up; Reset returns to the framed route                                                                   |
| Wheel / touch          | always captured; `touch-action: none`               | only while engaged; `pan-y` released; two fingers always orbit/pinch                                                                                                              |
| Keyboard               | none                                                | focusable canvas; arrows, + −, Home, Escape                                                                                                                                       |

Camera framing is excluded from every frame id, so no acquisition identity moved.

## Label / collision measurements (production build, 1246×1021)

| View                   | Before: closest endpoints | After                      | Before: spread | After   | Overlapping markers after | Markers outside canvas after |
| ---------------------- | ------------------------- | -------------------------- | -------------- | ------- | ------------------------- | ---------------------------- |
| Lesson 3 scope default | 6.9 px                    | 12.7 px                    | 17×43          | 34×77   | 0                         | 0                            |
| Lesson 3 whole scope   | 1.5 px                    | 2.0 px (cluster by nature) | 4×9            | 5×13    | 0                         | 0                            |
| Lesson 11 anatomy      | 11.3 px                   | 17.6 px                    | 120×123        | 165×175 | 0                         | 0                            |
| Lesson 13 anatomy      | 11.3 px                   | 18.5 px                    | 120×123        | 173×179 | 0                         | 0                            |
| Lesson 11 whole model  | —                         | 13.6 px                    | —              | 141×148 | 0                         | 0                            |

Leader crossings: 0 before and after in every view (the layout never crossed leaders; the defect
was crowding, not crossing). Lesson-3 columns across +85 … −85: constant, closest pair 11.4–17.1 px.

## Condition matrix (production build)

Each condition is what its label says and nothing more. **Native browser zoom and a physical
device were not tested.**

| Condition                | Kind                                       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1246×1021                | viewport emulation (the report's)          | canvas 399×360; 8 markers, 0 overlaps, 0 outside; closest 17.6 px; compass inside; no horizontal overflow; lesson-19 arrow 66.9 px                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1440×900                 | viewport emulation                         | canvas 468×360; closest 17.6 px; arrow 79.1 px                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 1024×768                 | viewport emulation                         | canvas 450×360; closest 17.6 px; arrow 77.6 px                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 390×844, 320×740         | viewport emulation with touch              | the host shows its existing "Desktop or tablet lab" fallback below 768 px (unchanged behaviour); no overflow                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 1246×1021 at 2×          | device-pixel-ratio emulation               | canvas backing store 674×608 for 399×360 css (the renderer's 1.7× cap); geometry as at 1×                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1440×900, html 200 %     | root-font enlargement (not zoom)           | host reflows; the embedded workbench keeps its own 12–15 px text (pre-existing, recorded in 02); markers unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1246×1021, body zoom 1.5 | CSS zoom stress (not zoom)                 | canvas 435×375 css; closest 12.2 css px (18 screen px); arrow 36.2 css px; nothing clipped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| light / dark             | site theme class                           | identical inside the workbench (its own palette, pre-existing)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 768×1024 with touch      | viewport emulation with emulated CDP touch | a one-finger drag on the released canvas scrolls the page and does not engage it; a tap engages (`touch-action` → none); a stationary tap on the canvas engages it (`touch-action` → none) and the next one-finger drag orbits without scrolling (page scroll 693 → 878 released, 878 → 878 engaged). Two earlier probe runs missed because the emulated tap landed on the host's sticky lesson chrome, which is about 300 px tall at this width, and because a tap during a scroll fling is swallowed by Chromium; both are recorded as emulation findings, not product defects |

## Bridge, gate and holds

- **Protocol:** unchanged. No message, field or validator changed; `sweepReport` is embedded-only
  React state. Old payloads validate exactly as before (Jest).
- **Thresholds and geometry:** unchanged and asserted (`LINKED_SWEEP_TOLERANCES` test; the
  embedded `acquisitionWindows` test still completes each preset; `MODEL_STEPS`, `modelFrameId`,
  `linkedSetup`, `initialRoll`, meshes and contract JSON untouched).
- **Self-paced contract:** no score, mastery, first-attempt, gate or persistence added. The frame
  count is labelled transient and never leaves the workbench; "Show structure names" is not
  reported to the host (no assistance tracking).
- **Prompt 01 / 02 preserved:** re-driven on the production build — comparison heading, case exit,
  evidence identities (live / held / held-missing / demonstration / supplied), the measured
  recorded-frame region, last-control readiness, latest-intent decoding, terminal-error clearing,
  `contactMode` on held contact frames, reload-to-briefing. The 01 and 02 Jest files pass unchanged.
- **L5-1:** the data contract is preserved (contact mode still carried from live model state);
  lesson 5 check 2's reflector question versus the held image remains the 04/05 content hold.
  Nothing was relabelled, substituted or reconstructed, and reload still clears held evidence.
- **Clinical / media / model holds encountered, not adjudicated:** in-plane window realism (L3-7,
  L11-6, L12-4); model zero and per-image orientation conventions (L3-14, L3-15) — the compass
  names the model frame only; 4R disc, 4L identity, Doppler, borders/calipers, pixel-to-mm, staging,
  sequencing, rights. An ultrasound-image outline of the target during the sweep was **not** added:
  it would undo the course's deliberate withholding of image interpretation during acquisition
  (`canDiscoverImage`), so it is queued for 04/05 rather than decided here.

## Files changed

| File                                                                                 | Change                                                                                                                                                                         |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/ebus-linked-contract.ts`                                                    | `LINKED_SWEEP_TOLERANCES`, `LinkedSweepEvent`, `stepLinkedSweep`; `sampleLinkedSweep` delegates (same behaviour)                                                               |
| `EBUS-course/apps/web/src/guided/observerCamera.ts` (new)                            | model-frame axes, sphere/box fit, compass projection, column hysteresis, column spreading, route observer placement                                                            |
| `EBUS-course/apps/web/src/guided/observerControls.ts` (new)                          | engagement, zoom/orbit/tilt, keyboard, touch tap rule, the one truthful caption                                                                                                |
| `EBUS-course/apps/web/src/guided/sweepStatus.ts` (new)                               | status derivation and the tolerance note                                                                                                                                       |
| `EBUS-course/apps/web/src/guided/structureCallouts.ts`                               | stable columns, hover/focus, names, hide-invisible, surface anchor helper, geometry export                                                                                     |
| `EBUS-course/apps/web/src/guided/LinkedModelView.tsx`                                | framed cameras, compass, hover ↔ marker, selection colours, names reference, named check feedback, sweep panel, captions, fan order                                            |
| `EBUS-course/apps/web/src/guided/ModelSection.tsx`                                   | 3D colour code and legend, violet cross                                                                                                                                        |
| `EBUS-course/apps/web/src/guided/ContactComparison.tsx`                              | element labels from sampled labels                                                                                                                                             |
| `EBUS-course/apps/web/src/guided/models/ModelViewport.tsx`                           | route camera, solid arrow, canvas labels, observer controls, `data-arrow-px`                                                                                                   |
| `EBUS-course/apps/web/src/guided/models/ModelImage.tsx`                              | contact captions and origin labels; route caption                                                                                                                              |
| `EBUS-course/apps/web/src/guided/guided.css`, `models/models.css`                    | marker states, compass, sweep panel, sizes, observer buttons                                                                                                                   |
| `EBUS-course/apps/web/src/features/simulator/SimulatorPage.tsx` (guided branch only) | sweep event report, target/in-plane props, optical wall-distance caption                                                                                                       |
| Tests                                                                                | `src/features/ebus-guided/__tests__/pre-review-03.test.tsx`; `EBUS-course/apps/web/src/guided/observerCamera.test.ts`, `sweepStatus.test.ts`; `e2e/ebus-anatomy-sweep.spec.ts` |
| Scripts                                                                              | `scripts/ebus-guided/browser-anatomy-sweep.ts`, `browser-anatomy-matrix.ts`                                                                                                    |
| `.claude/launch.json`                                                                | dev 3131 / prod 3132 entries                                                                                                                                                   |

Not touched: PI, BBT, platform wrapper, auth, CI, shared learning-module files, `AnswerVerdict`,
the standalone simulator's own views (`AnatomyScene`, `BronchoscopyView`, `SectorView`), any
content file, any GLB or contract JSON.

## Verification

| Check                                                                                        | Command                                                                                                                                           | Result                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| This batch's host tests                                                                      | `npx jest src/features/ebus-guided/__tests__/pre-review-03.test.tsx`                                                                              | 12 passed                                                                                                                                                                                                                                                                   |
| EBUS host                                                                                    | `npx jest src/features/ebus-guided`                                                                                                               | 13 suites, 167 tests passed                                                                                                                                                                                                                                                 |
| EBUS host + shared verdict consumers                                                         | `npx jest src/features/ebus-guided src/features/learning-module`                                                                                  | 28 suites, 305 tests passed                                                                                                                                                                                                                                                 |
| Embedded app (Vitest), including the new helper tests and the unchanged `acquisitionWindows` | `npm --prefix EBUS-course/apps/web test`                                                                                                          | 38 files, 276 tests passed                                                                                                                                                                                                                                                  |
| Embedded types                                                                               | `npm --prefix EBUS-course/apps/web run typecheck`                                                                                                 | clean                                                                                                                                                                                                                                                                       |
| Root types                                                                                   | `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`                                                                                         | exit 0 (after `next build` generated `contentlayer/generated`)                                                                                                                                                                                                              |
| Lint                                                                                         | `npx eslint src/features/ebus-guided src/lib/ebus-linked-contract.ts scripts/ebus-guided/browser-anatomy-sweep.ts e2e/ebus-anatomy-sweep.spec.ts` | exit 0 (the embedded app has no ESLint config; Prettier only)                                                                                                                                                                                                               |
| Formatting / diff                                                                            | `npx prettier --check` on the changed paths; `git diff --check`                                                                                   | clean                                                                                                                                                                                                                                                                       |
| Production build                                                                             | `npm run build`                                                                                                                                   | exit 0; the standalone tree serves ``SimulatorPage-DVXMz9I1.js` and `guided-D1YybrBv.js` (built at `4fdf76ee`)`, which contain this batch's strings ("Show structure names", "How this exercise counts a sweep", "Release wheel control", "shadow starts at the interface") |
| Browser regressions (production standalone, 3132)                                            | `EBUS_E2E_BASE_URL=http://127.0.0.1:3132 npx playwright test --config <no-webServer config>` on `e2e/ebus-anatomy-sweep.spec.ts`                  | 6 passed                                                                                                                                                                                                                                                                    |
| Evidence journeys                                                                            | `scripts/ebus-guided/browser-anatomy-sweep.ts` on baseline (3131, 3133) and production (3132)                                                     | reports `baseline`, `baseline-v2`, `after-dev`, `after-prod`, `after-final` (final build: same numbers as the tables above)                                                                                                                                                 |
| Condition matrix                                                                             | `scripts/ebus-guided/browser-anatomy-matrix.ts` on 3132                                                                                           | eleven conditions above                                                                                                                                                                                                                                                     |

Unique test counts: 12 new host tests, 11 new embedded tests, 6 new browser tests. Repeated runs
are not added together. The whole host suite was **not** run in this batch beyond the EBUS and
learning-module scopes; the nine documented baseline failures from 01/02 are unrelated and were
not re-examined.

**Server identity before evidence.** Baseline: `next-server` pid 44503, cwd this worktree, HEAD
`2124cd0f`, port 3131, bundle `guided-B6rHZ2vK.js`; and the detached checkout pid 80101, cwd
`/private/tmp/ebus03-baseline`, HEAD `2124cd0f`, port 3133, same bundle. Production: `next-server`
from `.next/standalone`, port 3132, HEAD `2124cd0f` plus this branch's working tree, bundle
`SimulatorPage-CSVUR7kQ.js` / `guided-CSV_79QK.js` for the `after-prod` run and
`SimulatorPage-DVXMz9I1.js` / `guided-D1YybrBv.js` (pid 59341, cwd `.next/standalone`) for the final `after-final`, spec and matrix runs. Port 3131 was taken by another session's dev server (`claude-bf-1-9-19`) after this batch's dev evidence was complete; it was not touched. No familiar-port server was reused.

## Evidence paths (outside Git)

`/private/tmp/claude-501/…/scratchpad/evidence/{baseline,baseline-v2,after-dev,after-prod,after-final}/report.json`
with PNG captures per lesson, `evidence/matrix/matrix.json` with per-condition PNGs, and
`e2e-results/` traces on failure. Real-GPU captures of lessons 3, 11 and 19 were viewed in the desktop
app's browser pane at 1246×1021 (device pixel ratio 2) and matched the headless captures; they are
not stored.

## Not run / limitations

- Native browser zoom (⌘+ / ⌘−) and any physical phone, tablet, Safari or Firefox.
- Any human usability session, clinical, source or media review.
- The whole host Jest suite and the whole Playwright suite.
- Phone widths render the host's existing desktop/tablet fallback for these labs (unchanged);
  "universal phone functionality" is not claimed.
- The embedded workbench still keeps its own palette and text size under the site theme and root
  text enlargement (pre-existing, recorded in 02).
- The whole-scope view's four tip endpoints remain a tight cluster by geometry; the framed tip is
  the default and the names legend separates the markers.
- Hidden or background tabs still suspend `requestAnimationFrame` (recorded in 02); every capture
  here was of a painted page.

## What a reviewer should look at first

1. The sweep panel's wording from the left main bronchus start — it says a pass must begin outside
   the target; it does not change where the scope starts.
2. The violet / teal / gold split and whether the section legend reads as a kind legend, not names.
3. The Bronchoscopy caption's numbers; they are scene geometry and say so.
4. The lesson-19 arrow and labels, and whether "Example node" should stay unnamed outside the
   worked example (it follows the existing reveal rule).
5. The engagement model: whether "click or tap the model to turn on wheel control" is the right
   trade for never trapping the page.
