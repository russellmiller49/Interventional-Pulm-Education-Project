# Handoff — MT-03b space scene

| Field               | Value                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Slice               | 11 of the first build round; work package MT-03                                                                             |
| Branch              | `claude/mt-03b-space-scene`                                                                                                 |
| Base                | `origin/main` `4f9329f3ed8fe985283ab1cf81d59040f13e995e` (main has not moved since slice 9)                                 |
| Prerequisite slices | `claude/mt-02e-space-engine` at `80509547` (which carries slices A, B and 1 to 10), merged as the first commit (`eb65ac5e`) |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-03b-space-scene.md`        |
| Owner decision      | OD-08; the approved first-round plan, sections 4.6 and 5 (row 11)                                                           |
| Date                | 2026-09-29                                                                                                                  |

## Why

The survey lesson needs the pleural space drawn: a Chest view of the whole side of the chest and a
Scope view through the telescope. This slice draws them in 3D behind the contract slice 9 wrote and
the engine slice 10 built, hosts the engine in the browser, and shows the result on an engineering
prototype page, so that the same commands can be seen to give the same ledger with the scene and
without it before any lesson depends on it.

## What changed

| Path                                                                                                                                                                      | Change                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/medical-thoracoscopy/components/space/useSpaceEngine.ts`                                                                                                    | New. The engine's host: loads the proxies with a guard against stale results, holds the engine's state, runs its clock on animation frames while the lung moves |
| `src/features/medical-thoracoscopy/components/space/SpacePane.tsx`                                                                                                        | New. The pane: the 3D views where the browser can draw them, the cut otherwise, saying why                                                                      |
| `src/features/medical-thoracoscopy/components/space/SpacePaneShell.tsx`                                                                                                   | New. What every pane shares: keys, refusal, dock, ledger, key help, taken out of the fallback pane                                                              |
| `src/features/medical-thoracoscopy/components/space/SpaceFallbackPane.tsx`                                                                                                | Now the shell with the cut; `SpaceFallbackViews` exported. Its behaviour is unchanged and its 22 tests pass as they were                                        |
| `src/features/medical-thoracoscopy/components/space/scene/{SpaceSceneViews.tsx,anatomyAssets.ts,lungGeometry.ts}`                                                         | New. The canvas and its two views, loaded lazily; the drawn anatomy from the manifest; the lung at each step                                                    |
| `src/features/medical-thoracoscopy/components/space/useSpaceSupport.ts`                                                                                                   | New. WebGL and the motion preference, read without a flash of the wrong pane                                                                                    |
| `src/features/medical-thoracoscopy/components/space/{types.ts,spaceWords.ts,space-pane.module.css}`                                                                       | The pane state gains `lungStep` (added, as the contract allows); words for loading and for the 3D views; the views' styles                                      |
| `src/features/medical-thoracoscopy/engine/space/{spaceReducer.ts,paneState.ts}`                                                                                           | The motion preference is a simulated action; the cut and the ledger are kept between ticks that change neither                                                  |
| `src/features/medical-thoracoscopy/components/prototype/SpacePrototype.tsx`, `src/app/[locale]/medical-thoracoscopy/prototype/space/page.tsx`                             | New. The engineering prototype page                                                                                                                             |
| `src/features/medical-thoracoscopy/__tests__/{spaceScenePane.test.tsx,spaceSceneGeometry.test.ts}`, `src/app/[locale]/medical-thoracoscopy/prototype/space/page.test.tsx` | New; `spaceEngine.test.ts` gains the motion action                                                                                                              |
| `docs/medical-thoracoscopy/README.md`                                                                                                                                     | The "Space pane" section describes the 3D pane and the prototype page                                                                                           |

No section, claim, register or record changed, and no asset was built or moved. No lesson mounts the
pane yet: the lesson host is slice 12.

## How the scene is built

- **One canvas, two views**, the pattern of the bronchoscopy scope scene: the canvas is fixed to the
  viewport and never takes the pointer, the pane clips it, and drei's `View` draws a Chest view and a
  Scope view into their own boxes. Frames are drawn on demand: on every committed state (a held
  control commits one a step), on scroll and on resize; the whole canvas is cleared before the views
  draw, so nothing is left behind where a view has scrolled away. The wheel always scrolls the page.
- **Lazily loaded.** Three.js arrives only when the anatomy is ready and the browser can draw; the
  drawn anatomy comes from the generated manifest through `GLTFLoader` with the local Draco decoder,
  each mesh with its world matrix (the lung's positions are quantised under a node transform).
- **The Chest view** is drawn in the scan's millimetres, its camera's axes the rows of the manifest's
  `presentationFromLps`: the patient's front, the head to the right, the right side up (T7). It shows
  the right ribs faintly, the heart and vessels, the lung at the engine's step, the telescope's sleeve
  and shaft from the engine's geometry, a short cone for the field, and each region of the wall shaded
  by the model's estimate. The ledger beside it is always the text of that estimate.
- **The Scope view** is the engine's optical frame: its origin, forward and up are
  `scopeGeometry(...).camera`, its field the device's 75°, with a light at the tip and the round field
  as a lens over a square view. It draws the pleura and the lung.
- **The lung** is drawn at exactly the engine's step: each step's geometry is resolved once from the
  file's morph targets and its normals worked out again (the file keeps the expanded lung's only).
- **The host** loads the collision proxies, starts the engine at the scenario's start, and turns the
  pane's commands into simulated actions against the state's own snapshot. It drops a load's result
  once a newer load has begun; a failed load offers to try again, and trying again starts the engine
  afresh, so nothing is marked seen by it. The clock runs on animation frames only while the lung has
  a move due, in whole milliseconds; a hidden tab has no frames, so the lung waits.
- **The motion preference** is read after hydration (before it, reduced, the safer) and passed to the
  engine as a simulated action whenever it changes: reduced holds the clock and brings the Step
  control; released, the lung goes on from then.
- **If the scene cannot be drawn** (no WebGL, a renderer that will not start, a file that will not
  load, a drawing error), the pane says so in one line and shows the cut; a lost context remounts the
  canvas and loads again. The engine is untouched either way, so nothing the learner did is lost.

## The prototype page

`/medical-thoracoscopy/prototype/space`, inside the module frame and its access rules (in
development, direct link, never indexed), outside the curriculum and the progress record. It is
headed as an engineering prototype, says it is not a lesson, records nothing and has not been
clinically reviewed. The lung starts part-way fallen (step 4), since the telescope has no room at the
port before air is in; "Let air in" takes it to the last step, labelled as an authored relationship
awaiting clinical review (T2). It never comes back: re-expansion is not modelled. "Start again"
restarts the engine; a toggle shows the Chest view as the cut, for the comparison below.

## Claims and assets touched

None. No claim was added or reworded; the scene draws the packaged anatomy files as they are, from
the dev copy that Git ignores.

## Checks run

| Command or check                                                                                                                                                                                   | Result                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx jest src/features/medical-thoracoscopy "src/app/[locale]/medical-thoracoscopy"`                                                                                                               | 22 suites, 332 tests, all passing, the module's pages included; 14 tests are new: 8 for the pane and its host, 4 for the lung's geometry, 1 for the page, 1 for the motion action |
| The new tests with three faults planted, one at a time: the stale-result guard removed; no note when the scene fails; morph targets always taken as relative                                       | Each caught by one failing test (the first only after the test was rewritten to overtake a load still under way); the files then restored byte for byte                           |
| In the Browser pane, on the dev server (`claude-thoracoscopy`, port 3134): both views drawn on the real canvas, read back from the drawing buffer                                                  | Chest view 81 to 85 % of its pixels drawn; Scope view 99.99 % of its round field drawn at the start, where the lung fills it                                                      |
| The same: the scene's camera against the engine's optical frame at the start pose                                                                                                                  | Position, direction and up equal to the engine's to the last printed digit: the port's inward axis, and the head's direction                                                      |
| The same: "Let air in"                                                                                                                                                                             | The lung steps from 4 to 8, the button disables and the page says the lung has fallen as far as the model takes it                                                                |
| The same: 146 key presses (pivots, depth, roll) after letting air in, once with the scene and once with the cut                                                                                    | The same ledger, the same "in view" words and the same refusal both times; five regions partly seen, the lung stopping the telescope                                              |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`; `npx eslint src/features/medical-thoracoscopy "src/app/[locale]/medical-thoracoscopy"`; `npx prettier --check`; `git diff --check` | Clean                                                                                                                                                                             |

## Real browser observations

- **The Browser pane was often hidden** while these checks ran: the page then has no animation frames,
  so the lung waited (by design) and the canvas kept its last frame after a scroll, which a visible
  page redraws at once. The checks above were read from the page, not from screenshots, and the lung
  was stepped while the pane showed.
- The Scope view at the start is filled by the lung a few millimetres ahead; after the survey sequence
  it shows the lung on one side and the wall beyond it, the telescope stopped against the lung, as the
  refusal says.
- The Chest view's first version showed the whole rib cage and the skin, which hid the pleural space
  and boxed the view; it now shows the right ribs faintly and no skin.

## Checks not run

- **The journeys in a real browser with a visible page throughout** — keyboard-only survey, touch,
  the wheel scrolling the page, reduced motion, WebGL unavailable, a missing asset, a decoder error,
  context loss and retry, the three layouts, 200 % zoom and 320 px reflow: slice 12 in the lesson, and
  the Playwright evidence in slice 14.
- **How fast the scene draws on the owner's machines**: slice 14's measurements.

## Unresolved decisions

- **What the survey can see** (slice 10's finding, MT-C-0002): the scene shows it plainly. The
  collapsed lung fills much of the Scope view from the port.
- **The Chest view's look**: which context structures it shows and how faintly are the author's
  choices, for the owner to change.
- Everything open after slice 10 stays open.

## What must not happen next

- Do not let the scene work out collision, contact or what is in view: it draws the engine's answers.
- Do not drive the engine from the scene's camera; the camera follows the engine.
- Do not draw a lung step the engine has not reached, or animate re-expansion, which is not modelled.
- Do not show the prototype page as a lesson, link it from the curriculum, or record progress on it.

This does not change publication status or constitute clinical approval.
