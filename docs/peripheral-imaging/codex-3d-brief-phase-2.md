# Codex brief — the imaging suite, phase 2: the remaining ten views

Written 2026-09-09, after phase 1 merged to `main`. Read alongside
[`codex-3d-brief.md`](codex-3d-brief.md), which is still the reference for the per-view intent
(§B5), the hard rules (§B3) and the model-boundary sentences (§B7). This document says what has
landed, **what changed underneath you since that brief was written**, and what phase 2 is.

## Where this fits

Phase 1 is merged. In `components/suite/` you already have: the contract (`types.ts`),
`suiteModel.ts` with the projection helpers, `drrTextureSource.ts`, `SuiteScene`, `Anatomy`,
`Room`, `ParametricCarm`, `CameraRig`, `ChainPins`, `DetectorImage`, `Monitor`,
`ProjectionOverlays`, `LabDock`, `WebGLContextGuard`, `suiteViewSpec.ts`, and two views:
`views/ProjectionView3D.tsx` and `views/SignalView.tsx`.

`SUITE_MODES_READY` holds `projection` and `signal`. **Twelve of the nineteen sections still render
Claude's 2D fallback.** Phase 2 is the other ten modes.

## What changed underneath you since the phase-1 brief

These will bite if you miss them.

1. **The route moved.** The course is at `/peripheral-imaging`, not `/fluoroview`. The original
   FluoroView simulator keeps `/fluoroview` and is a separate module; the course no longer replaces
   it. Asset paths did not move: the course's own assets are still `/peripheral-imaging/**` and the
   Draco decoder is still `/fluoroview/draco/`.
2. **No sign-in.** The course is an in-development module reachable by direct link, so browser
   checks no longer need `LOCAL_DEV_AUTH_TOKEN` or the local-dev-auth round trip. Just open
   `http://localhost:<port>/en/peripheral-imaging/learn?section=<id>`.
3. **The pane is a layout container, and the displays are pinned.** In `suite-scene.module.css`:
   - `.pane` declares `container: suite / inline-size`. Layout responds to the **pane**, never the
     window — at a 1180px window the simulator pane is barely 500px. Use `@container suite (...)`.
   - `.displays` declares `--suite-display-height` and is `position: sticky; top: 0` when the pane
     is wide enough and the window tall enough. The 3D viewport's height and the monitor square
     both take that variable, so the two displays stay level.
   - **The invariant: the displays block must stay shorter than the pane.** It is pinned, so if it
     grows taller than its scrollport it covers the control dock instead of revealing it. If a view
     adds chrome inside `.displays`, it comes out of that budget. Anything a view adds _below_ the
     displays scrolls normally and is free.
4. **The camera fits the pane.** `CameraRig` now auto-fits the whole chain and its pin labels to
   the pane's actual aspect ratio for every overview view — `suite`, `room`, `anterior`, `side`,
   `head` — building the screen axes from each view's own up vector. `beam`, `target` and `console`
   stay authored close-ups. If you add a camera preset, decide which bucket it is in; an overview
   preset that does not fit will clip a chain stop as soon as the pane is narrow.
5. **Contrast.** `.pane` inherits the module shell's `--ink`, which is near-white because the shell
   is dark. Any panel you add on its own light surface must state its own dark ink (`#183542`), or
   its text lands at about 1:1. Text sitting directly on the dark pane uses `var(--muted)`.
6. **Test plumbing.** Jest now ignores `scripts/peripheral-imaging/*.spec.ts`, so your scene spec
   no longer breaks the whole-repository run. Playwright reports a `<fieldset disabled>` as
   _enabled_ — assert on a control inside the dock, not the fieldset.
7. **Six e2e scenarios must keep passing** (`e2e/peripheral-imaging.spec.ts`): the one door into a
   sorted section; a lab section's lock, goal flip and reload; the capstone standard; the image
   staying on screen while a control is used (including a contrast floor of 4.5:1 on the control
   label, its value and the readout); every overview view framing the whole chain with no clipped
   stop; and the compact one-pane layout.

## What phase 2 is

Ten modes, covering twelve sections. Every section's view spec, camera, layers, animation and
readouts are **already authored** in `content/suiteViews.ts` — you are implementing against data
that exists, not inventing it. `suiteViewErrors` validates it at import.

| #   | Mode         | Sections                                    | Lab            | Controls bound                                                                                       | Camera       | Notable layers / animation                                                                                                           |
| --- | ------------ | ------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `field`      | field                                       | `field`        | field, crop, zoom                                                                                    | suite        | blades narrow the frustum; crop changes the image, not the cone; zoom the monitor only                                               |
| 2   | `time`       | time                                        | `temporal`     | rate, width, speed                                                                                   | suite        | `pulse` — focal spot pulses, tool moves, frames land as discrete samples                                                             |
| 3   | `cbct`       | cbct-acquisition, fixed-suite, mobile-suite | `acquisition`  | kind, acquisitionOrbit, offsetX, offsetDepth, center, target, clearance, state, protection, captured | suite / room | `fov`, `orbit` animation; readouts `centered`, `ready`, `captured`; `fixed` and `mobile` gantry variants with a drawn swept envelope |
| 4   | `dts`        | dts-acquisition                             | `dts`          | sweep, plane, planeTool, planeLesion, planeDeeper                                                    | suite        | the sweep arc, the 13 atlas thumbnails, a sliding focal plane, smear bars, the missing wedge                                         |
| 5   | `dts-prior`  | dts-interpretation                          | `dts`          | same                                                                                                 | console      | the prior layer coloured apart from measured pixels                                                                                  |
| 6   | `sampling`   | tool-confirmation                           | `mpr`          | tipX, tipY, tipZ, slab, slicesTarget, axial, coronal, sagittal, revealed                             | target       | `planes`; readouts `windowLabel`, `windowIntersects`, `tipInside`                                                                    |
| 7   | `navigation` | current-anatomy                             | `registration` | shift, overlay, showCurrent, capture                                                                 | suite        | `fieldGenerator`; the sensor on the registered map while the live lung has moved                                                     |
| 8   | `augmented`  | changing-anatomy                            | `registration` | same                                                                                                 | beam         | the stored contour projected onto the live image; readouts `storedShiftMm`, `currentShiftMm`, `contourStale`                         |
| 9   | `staff`      | staff-protection                            | `safety`       | distance, orbit, shield                                                                              | room         | `staff`, `barrier`, `isodose`; readout `inverseSquareRatio`; **the orientation slider is inert today — make it move the gantry**     |
| 10  | `dose`       | dose-reporting                              | `dose`         | kerma, area, presetInitial, presetSmaller                                                            | suite        | `planes`; readouts `kapGyCm2`, `kapMicroGyM2`                                                                                        |

Not in this phase: `rebus` (needs the `radial-ebus` section and its labelmap and route assets,
phase 3) and `room` (the hub hero, which needs a seam with Claude).

### The pure model helpers still missing

`suiteModel.ts` currently carries only the projection set. Phase 2 needs, per the phase-1 brief §B4:
`temporal`, `dtsArc`, `dtsPlaneQuad`, `smearWidth`, `missingWedge`, `cbctOrbitSamples`,
`fovCylinder`, `sweptEnvelope`, `GANTRY_VARIANTS`, `samplingPlanes`, `registration`, `staff`,
`dosePlanes`. Keep them pure — no three, no React — and unit-test them, as you did for the
projection helpers.

## Order of work

`field` → `time` → `cbct` (three sections, the largest single piece) → `dts` + `dts-prior` →
`sampling` → `navigation` + `augmented` → `staff` → `dose`.

Merge each mode as it lands rather than batching: a mode is either in `SUITE_MODES_READY` and
complete, or it is absent and the section keeps the 2D fallback, which is a working state. That
also keeps each PR reviewable.

## Definition of done, per mode

- Honours every prop and data attribute in `types.ts`, including `controlsEnabled` and its reason,
  the goal list, the chain caption, `chainAnswer` when the step asks for one, and
  `[data-model-boundary]`. The boundary sentence is authored in `content/sectionSpecs.ts`
  (`modelBoundary`) — print it, do not write a new one.
- `resolveSuiteInputs` bindings resolve from the lab's control values; `suiteViewErrors` passes.
- The readouts the spec declares actually render. Goals are computed by the engine from lab values,
  so the view only has to drive `onLabChange` honestly.
- A reduced-motion path: no tweens, completed state, and a visible "Step" control that advances one
  pulse, projection or degree. That button is also how the scene is driven deterministically in
  tests, since a backgrounded tab throttles rAF.
- The displays block still fits the pane (see invariant 3), and no overview camera clips a stop.
- Scene coverage in `scripts/peripheral-imaging/suite-scene.spec.ts`, run under
  `scripts/peripheral-imaging/playwright.suite.config.ts` against the static harness.
- Added to `SUITE_MODES_READY` in the same commit that makes it true.

## Verify

```sh
npx jest src/features/peripheral-imaging --runInBand
npx tsc --noEmit -p tsconfig.json
npx eslint src/features/peripheral-imaging scripts/peripheral-imaging e2e/peripheral-imaging.spec.ts
npx playwright test -c scripts/peripheral-imaging/playwright.suite.config.ts
PERIPHERAL_IMAGING_BASE_URL=http://localhost:<port> npx playwright test -c playwright.peripheral-imaging.config.ts
```

Run a dev server from your own worktree on your own port and open
`/en/peripheral-imaging/learn?section=<id>` — no sign-in. Section ids are in
`content/pathway.ts`; the ones you want this phase are `field`, `time`, `dts-acquisition`,
`dts-interpretation`, `cbct-acquisition`, `fixed-suite`, `mobile-suite`, `tool-confirmation`,
`current-anatomy`, `changing-anatomy`, `staff-protection`, `dose-reporting`. Each section reaches
its lab at the Act step: continue past Recognize, commit the prediction, continue.

## Still yours, still not

You own `components/suite/**` except `types.ts`, `SuiteFallback.tsx`, `ChainAnswerFieldset.tsx` and
`ChainCaptionStrip.tsx`; `lib/{radialEbus,scatter,rayProfile}.ts`; `public/peripheral-imaging/**`
and `scripts/peripheral-imaging/**`; the asset docs. Do not edit
`src/features/learning-module/stage/**`, `content/**`, `engine/**`, `components/stage/**`, the
routes, or `data/*.ts` — ask Claude. `suite-scene.module.css` is yours, but the layout invariants
above are load-bearing for the stage; say so in the PR if you need to change them.

Branch from `main`, small commits, PR to `main`, never commit to `main` directly.
