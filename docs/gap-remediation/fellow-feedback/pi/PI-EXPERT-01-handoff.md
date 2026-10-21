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

---

# Part 2 — what the slides confirmed, and the rest of the round

Implementation: October 20, 2026. Prepared by Claude (AI implementation). **Nothing here is
clinical, source, media or device approval.**

- Branch `claude/pi-expert-slides`, cut from `claude/pi-unstack-and-nudge` at `bf9122f6` (PR #417,
  unmerged), so it stacks on part 1. Worktree `Interventional-Pulm-Education-Worktrees/claude-pi-expert-slides`.
- The owner shared the educators' deck. It was read in place, outside the repository (text, speaker
  notes and every visible slide rendered); no slide text, image, case or name is committed, and every
  angle the course prints is a reading of the course's own CT, not a number from a slide.

## What the slides settled

| Waiting item                                | What the deck shows (summarized)                                                                                                                                                                                                                                           | Course model                                                                                                           | Result                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Nudge direction and reference rib           | A cranial/caudal parallax diagram against a structure lying between the nodule and the image receptor: caudal angulation drops the nodule below it on a head-up image. No "2–3°" and no "move it up → caudal" rule is written anywhere; its cases use larger caudal angles | Caudal raises the nodule against the rib behind it and lowers it against a rib in front (pinned, part 1)               | Agrees. The copy states both directions and asks which rib is meant                    |
| Cranial vs caudal for the second projection | Sagittal CT with both tilts drawn; one worked plan (a low posterior nodule behind the dome: cranial plus RAO). No algorithm                                                                                                                                                | Straight on, caudal trades the heart for the diaphragm (pinned)                                                        | No rule printed. "Read the tilt off the sagittal", with the dome example as an example |
| Three reasons to angle the C-arm            | Contrast; the pleural boundary at the nodule; the tool in profile (no foreshortening); safety follows                                                                                                                                                                      | —                                                                                                                      | Printed in that order                                                                  |
| Obliquity from the axial                    | "Hand on the chest": a hand flat on the chest wall at the nodule, the beam along the palm (tangent to the chest wall). Left anterior or right posterior → RAO; right anterior or left posterior → LAO                                                                      | RAO positive (receptor toward the patient's right); the course nodule is left posterior, and only LAO clears its heart | Agrees; pinned against `beamDirection`                                                 |
| "Equator", dependency levels                | Not in the deck                                                                                                                                                                                                                                                            | Figure draws the line, unnamed                                                                                         | Still unnamed                                                                          |
| Zero of the sweep                           | A wedged patient, an asymmetric sweep, and reconstructed planes drawn parallel to the receptor at the sweep's centre                                                                                                                                                       | Plane square to the beam at the arc's centre; CNR more than doubles at LAO 20° (pinned, part 1)                        | Agrees; taught as "centre the arc on the view that shows the nodule"                   |
| Wedge direction and angles                  | Elevate the nodule side (recruitment, flexibility, soft tissue falls away); a case where rolling the chest reduces the C-arm angle needed                                                                                                                                  | view = orbit − wedge, left side up                                                                                     | Agrees. No wedge angle is printed in the deck; the course keeps 0/15/30°               |
| C-arm sweep limit                           | Not stated                                                                                                                                                                                                                                                                 | —                                                                                                                      | Still unprinted                                                                        |

The deck's workflow has **five** steps, not the transcript's eight: plan, recruit, project,
optimize (magnification, collimation, exposure factors last), align–confirm–biopsy. Section 9 uses
five, with positioning carried by the recruit step as Section 4 already pairs them.

## Implemented

- **`content/angleRules.ts`** holds the rules and the course-CT angles every new sentence prints
  (`ANGLE_EXAMPLES`, `OBLIQUITY_ALONG_CHEST_WALL`, `obliquityName`); lessons, demonstrations, goals
  and pins read the same object.
- **Section 4**: one sentence added to the positioning block (soft tissue falls away from the lifted
  side; rolling the patient widens the reachable views).
- **Section 5**: new reading step **Plan the obliquity and tilt from the CT** with three blocks —
  _Three reasons to angle the C-arm_ (with the Hwang visibility numbers), _Read the obliquity off the
  axial CT_ (hand on the chest; how far: until the line clears heart, mediastinum and spine; LAO 24°
  for this nodule), _Read the cranial or caudal angle off the sagittal CT_ (about 12° cranial straight
  on; caudal brings the diaphragm). Two demonstrations (LAO 24° lung only; 12° cranial). Act goal:
  _Find an obliquity and tilt with only lung over the nodule_ (`lung-only-seen` event). The anatomy
  readout moved second so it stays above the action bar.
- **Section 6**: the line "Rib or heart superimposed: change the projection" became "Heart,
  diaphragm, spine or vessels…". New step **Use the ribs, and nudge with beam tilt**: _Put the ribs to
  work_ and _The nudge_ (both directions; at LAO 20° a posterior rib lies over the nodule and 3°
  cranial takes it off), with two demonstrations. Act goal: nudge the tilt until a rib moves onto or
  off the nodule (`rib-moved-by-tilt`: a tilt-only change, heart off before and after).
- **Section 9**: _A two-axis fluoroscopy technique_ became **The 2D workflow, in order** (five steps,
  each pointing back to its sections); the act's first goal is now _Project the nodule clear of the
  heart_ (`mediastinumOnRay` false).
- **Section 10**: block **Centre the arc on the view that shows the nodule** (planes square to the
  beam at the arc's centre; what lies along that beam blurs into the nodule's plane; LAO 20° centre;
  wedge or an asymmetric arc where the system allows). Observe goal: move the centre until the heart
  and spine are off the nodule (`rayCrossesAtCentre` = Rib; only −20° qualifies at 10° steps).
- **Section 19 (A7)**: the eight-row "where it lives" sort is retired; the section runs on the
  geometry lab with the **wedge as a learner control** (its only surface). New reading step _Plan one
  nodule through the workflow_ (supine vs wedged demonstrations at the same C-arm angle). Act: wedge
  15°, C-arm within 10° (the docked platform's limit in the scenario), lung only, field ≤ 75 % with
  the tool path and landmarks kept, display zoom. Observe: nudge a rib on or off, take the wedge out,
  find the clear view with the C-arm alone. Step id `suite-cases:guided` kept. Readouts trimmed to
  anatomy, projection through the patient, context.
- **A9**: micro-cases `current-anatomy-practice-1` (setup before the first image),
  `projection-practice-1` (a right anterior nodule → LAO), `signal-practice-3` (rib behind and just
  above → caudal), `dts-acquisition-practice-3` (frontal DTS behind the heart → wedge and recentre);
  integrated **case 9**, _Planning the projection before the first image_ (paired to Section 5, its
  `capstoneCaseId`). Keys spread a/b/c = 17/18/18; every keyed option within the length rule.
- **Phase rename**: `fluoroscopy` is now **Create the contrast** (presentation only; order unchanged).
- **Numbers**: `fluoro-visibility-accuracy` (Hwang, Br J Radiol 2018: 89.1 % visible vs 76.7 % not,
  29.6 % not visible; percutaneous CBCT-guided biopsy of nodules ≤ 1 cm), checked against the PubMed
  abstract on 2026-10-20 and registered as a number-only source. No other slide number entered.

## Model claims pinned (part 2, `model-truth.test.ts`)

| Claim                                                                                    | Pin                                                                                      |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Hand on the chest: left anterior/right posterior RAO, right anterior/left posterior LAO  | `beamDirection(±45°)` square to each quadrant's outward normal; the other side is not    |
| The course nodule is left posterior with the heart in front                              | left of the spine; first labelled structure straight anterior is mediastinum             |
| Only LAO clears the heart; LAO 24° leaves lung only                                      | every obliquity 0…75 crosses the heart at 0° tilt; table at −24/0                        |
| Straight on, about 12° cranial clears the heart; caudal only trades it for the diaphragm | lung only at 0/12–14; every caudal tilt −25…−1 crosses heart or diaphragm                |
| At LAO 20° a posterior rib lies over the nodule; 3° cranial takes it off                 | "Rib" at −20/0 and −20/−2; lung only at −20/+2…+4; the rib segment lies on the tube side |
| A 15° wedge and LAO 9° give the LAO 24° view                                             | `viewObliquity(−9, 15) = −24`; within the scenario's 10°                                 |

## Deliberately not printed

The equator name and any dependency levels; "2–3°" and "move it up → caudal" as written rules; any
algorithm for the second projection; "hilum for upper, diaphragm for lower"; the C-arm sweep limit;
the claim that a platform's suggested obliquity serves tool profile; "tomosynthesis works near the
pleura and hilum"; the trial yields and ventilator protocols on the slides; the slides' case images.
Credit to the educators waits for the owner.

## For physician review (E2, part 2)

- The three reasons, and whether the pleural view should rank with seeing the nodule.
- Hand on the chest as the _side_ only; for a juxtacardiac nodule like the course's, the axial CT
  decides how far (24°, not the 45° tangent).
- "A low posterior nodule often needs cranial angulation" generalizes one worked example.
- "A nodule on a rib's even shadow can stand out better than over vessels": expert teaching, not
  modeled; the lab shows where the rib lies, not conspicuity.
- Workflow wording "exposure factors last, where the system allows manual technique"; "an asymmetric
  arc where the system allows".
- Section 4's added sentence (soft tissue falls away; wider reachable views).
- The micro-case rationales, especially RAO for a right anterior nodule running back across the
  mediastinum, and the 10° docked-platform limit (a teaching scenario).
- The Hwang figures are percutaneous, not bronchoscopic.
- New blocks cite `setser`/`tg272` for projection geometry, as the two-axis block did; no published
  source in the course set covers the hand-on-chest rule or the nudge.

## Traps (part 2)

- A fresh worktree needs `node_modules` cloned (`cp -cR`), `.contentlayer` for `tsc`, and
  `navigation_module/web/node_modules` and `EBUS-course/apps/web/node_modules` for the dev wrapper;
  `/api/analytics` returns 500 without a local Supabase env (harmless).
- LAO 24° is "lung only" with 1–2 mm of spine edge under the 3 mm threshold, and 12° cranial leaves
  5–6 mm of heart under the 10 mm threshold; the copy says "about", the pins cover neighbouring angles.
- Lab goals are evaluated together on the current state; anything sequential needs an event.
- A reading step with no `examples` shows every demonstration of its section; the three new steps
  name theirs.
- The DTS lab's arc-centre readout has no wedge input.

## Validation (part 2)

| Check                                                                                                        | Result                                                         |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `npx jest src/features/peripheral-imaging`                                                                   | 52 suites, 598 tests pass (592 at `bf9122f6`)                  |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`                                                    | clean                                                          |
| `eslint` on changed files and the e2e spec                                                                   | clean                                                          |
| Playwright, targeted (expert session parts 1–2, Section 5 and 10 flows, frozen images)                       | pass                                                           |
| Playwright `playwright.peripheral-imaging.config.ts` full run against this worktree's dev server on :3126    | 84 of 84 passed (10.5 min), including the two new part-2 tests |
| Browser at 1440×900: Section 5 angles step; Section 19 run-through driven through every act and observe goal | checked in the pane                                            |

Not covered: the 3D chest roll was too small in the scene to judge by eye; the projection, the
monitor caption ("wedge 15°") and the readouts follow the wedge.
