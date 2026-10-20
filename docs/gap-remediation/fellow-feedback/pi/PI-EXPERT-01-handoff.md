# PI-EXPERT-01 — Peripheral Imaging: create the contrast (expert-session round, part 1)

Implementation: October 19, 2026. Prepared by Claude (AI implementation).

The owner attended an AABIP session with an industry imaging educator and his radiographer
colleague, who reviewed this course and teach a fluoroscopy workflow built on one idea: whether
the nodule can be seen is decided before the first frame. The owner asked for a plan from the
session and approved it. This batch is the part the session itself settled; the rest waits for the
educators' slides (see "Waits for the slides"). **Nothing here is clinical, source, media or device
approval.** No transcript text, slide content or speaker attribution is committed.

## Scope and baseline

- Branch `claude/pi-unstack-and-nudge`, cut from `origin/main` at `b8799f5b` (after PR #414).
- Worktree `Interventional-Pulm-Education-Worktrees/claude-peripheral-imaging-feedback-10-11`
  (its previous branch, PR #395, was merged).
- The plan's five PRs were folded into this one branch, as separate commits, because the
  slide-dependent copy left each of them too small to stand alone.

## Implemented

### What lies over the nodule (commit 1)

- `lib/rayStructures.ts` labels the course CT voxel by voxel: lung −970 to −450 HU (this CT's lung
  peaks near −925 and outside air near −1000, so the display band's −950 would lose a sixth of the
  lung); heart and mediastinum as the lung-bounded run across the midline in each axial row
  anterior to the vertebral bodies (≤ 240 mm, closed by lung that is itself closed by chest wall);
  the diaphragm as the top of the bottom-connected mass with lung above it, measured behind the
  heart and never higher in front of it than that reference (the cardiac apex sits on the left dome
  with lung only above it); bone in the vertebral column as spine, any other bone as rib. Along this
  nodule's projections that bone is posterior and anterior ribs (checked).
- `data/rayCrossings.json`, baked by `scripts/peripheral-imaging/build-ray-crossings.ts`, holds one
  hex digit per whole-degree view obliquity (−105 to +105) and tilt (−25 to +25). The geometry lab
  reads it synchronously as **Anatomy over the nodule** (projection, signal and 2D workflow
  sections), with booleans for later goals.
- The signal view draws the path through the nodule coloured by named anatomy (labels built once
  in the browser, about 0.1 s); its millimetre density table is gone. The conspicuity figure and
  the two-axis worked example name anatomy instead of printing soft-tissue millimetres.
- **Wedge mechanics** (patient roll, left side up): a geometry-lab control that no section exposes
  yet; the scene rolls the chest in one group while gantry and table stay, the camera and monitor
  caption follow, and every projection is computed through the patient at `orbit − wedge`.

### Set up before the first image (commit 2)

- Section 4 gains the step **Set up ventilation and position before the first image**: prevent
  atelectasis (routine recruitment with anesthesia, before the first image and after inspection;
  individualize for severe emphysema or instability) and position the lesion side up (wedge or
  lateral; prone costs far more setup; settle position before registration).
- Figure `current-anatomy:wedge-dependency`: the same axial level supine and wedged 30°, drawn as
  the patient lies, with a line level with the front of the vertebral body. Supine the check's
  nodule lies in the dependent opacity; wedged, the right lung is lowest and the nodule rises clear.
  Rolled levels use a soft round field of view; the supine image is byte-identical to main.
- Section 7 keeps the owner's 2026-10-11 spine-collimation teaching; each mechanism now shows in
  one sentence, with the full physics in the block's collapsed panel, and the magnification block
  pairs acquisition magnification with tighter collimation.

### Tomosynthesis said plainly (commit 3)

- Section 10's definition is now the shadow-adding version; missing wedge, anisotropy and
  projection-count physics moved to the collapsed panel (glosses intact). The DTS panel gives a
  plain "At this depth" reading of which object is in focus before the spread numbers. "Thirteen
  projections" left the captions and the reconstruction card.

### The centre of the DTS arc (commit 4)

- `scripts/peripheral-imaging/build-dts-grid.py` (run with Slicer's `PythonSlicer`) bakes the same
  projections at every 5/6° from −60° to +60° into `dts-grid.png` (2.7 MB, loaded only when the
  centre moves). Its tiles equal all 65 existing projections pixel for pixel;
  `dts-projections.png` is untouched.
- `reconstructOffCentrePlane` tilts the plane square to the beam at the arc's centre; at 0° it
  equals `reconstructTeachingPlane` exactly.
- **Centre of the DTS arc** (−30° to +30°) appears on Section 10's compare step only, with
  **Anatomy over the nodule at the arc's centre**. Arc, missing wedge, focal plane, spread bars,
  tool-tip depth and the in-focus reading follow the centre; the position overlay is offered for a
  frontal arc only.

## Model claims pinned (`model-truth.test.ts`, `tomosynthesis.test.ts`, `physics.test.ts`)

| Claim                                                                                       | Pin                                                  |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Every table entry equals the live labels                                                    | 0 of 10,761 differ; table hash = atlas hash          |
| Frontally the path through the nodule crosses the heart; the −20° example clears it         | table                                                |
| 3° caudal takes a posterior rib off the frontal path                                        | table                                                |
| Caudal steep enough to clear the heart brings the diaphragm over the nodule (−6°)           | table                                                |
| Caudal moves the nodule up against the rib behind it and down against a rib in front of it  | > 8 mm and < −5 mm on the detector for 3°, both ways |
| Rolling the patient by w projects exactly as obliquity −w                                   | identity, 9 decimals                                 |
| The vertebral-body line, the supine and wedged nodule, the opacity moving to the lower lung | opacity model                                        |
| The nodule's contrast-to-noise in its DTS plane more than doubles at a −20° centre          | about 3.1 versus 1.0                                 |

The nudge rule is therefore stated against the rib behind the nodule; against an anterior rib it
reverses. That is how later copy should phrase it unless the slides use another frame.

## Waits for the slides (not built)

- Any sentence stating the educators' rules: the nudge direction, the cranial-versus-caudal choice
  for the second projection, the three reasons to angle the arm, "hilum for upper, diaphragm for
  lower", and the zero-of-the-sweep teaching (Sections 5, 6, 9, 10 copy; plan items A2, A3, A5,
  A6 part 2).
- The "equator" name and any dependency levels (the figure draws the line but does not name it).
- The arc-centre goal and task copy; exposing the wedge in any lab; the C-arm angle limit.
- Section 19's full-case run-through and the new practice and integrated cases (A7, A9), the phase
  rename, and every number from the session that is not already in `teachingNumbers.ts`.
- Figures that mirror the educators' case images, and any credit, only with their agreement.

## For physician review (E2)

- The routine-recruitment recommendation and its exceptions (expert practice; VESPA tested a
  bundle). "Hard to predict in an individual patient" is unsourced in the course's set.
- Positioning: wedge or lateral versus prone, and "settle the position before registration".
- Acquisition magnification "often at a higher dose rate" and collimation keeping area, scatter and
  KAP down.
- Whether Section 16 should keep its VESPA block now that Section 4 cites it too (both kept).

## Deliberately left

- "Tube load at fixed 20 mA" (temporal section): a standard term used consistently on seven
  surfaces; renaming one would split it.
- Per-section model-boundary sentences stay internal; nothing reachable prints them.

## Traps

- Lab readouts are synchronous and volume-free; anything CT-derived must be baked (the crossing
  table) and pinned against the atlas.
- The cardiac apex defeats any per-column dome rule; measure the dome behind the heart.
- Skin-edge partial volume looks like lung; require real lung runs closed by chest wall.
- The jsdom figure tests use a synthetic chest with no vertebral body; pin CT-dependent marks in
  model-truth, not in rendered tests.
- `python3 -I` hides the user-installed numpy used for offline prototypes; the bakes use
  `PythonSlicer`.
- The browser preview tool is pinned to the primary checkout; run this worktree's dev server on
  3126 with Bash and navigate the pane to it.

## Validation

| Check                                                                                                                                       | Result                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx jest src/features/peripheral-imaging`                                                                                                  | 52 suites, 592 tests pass (580 on the baseline; model-truth about 2.5 min)                                                                                   |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`                                                                                   | clean                                                                                                                                                        |
| `eslint` on changed files                                                                                                                   | clean                                                                                                                                                        |
| Playwright `playwright.peripheral-imaging.config.ts` against this worktree's dev server on :3126                                            | 80 of 82 passed in the full run (27 min); the two 320 px / 200 % text readiness-aid tests timed out late in the run and pass on a rerun alone (3 s and 16 s) |
| New e2e: projection readout at 0/0, 0/−3 and −20/0; signal path legend; Section 4 figure with two vertebral-body lines; DTS arc centre −20° | pass                                                                                                                                                         |
| Browser (Section 4 setup step, Section 7 text, Section 10 compare step at −20°)                                                             | checked in the pane; the rolled image's field edge was smoothed after the first look                                                                         |
| Supine dependent-opacity images versus main                                                                                                 | byte-identical                                                                                                                                               |
| Grid atlas versus the 65 existing projections                                                                                               | pixel-identical                                                                                                                                              |

Not covered: the wedge has no learner-visible surface yet, so its scene roll was checked by the
projection identity and types only, not in the browser.
