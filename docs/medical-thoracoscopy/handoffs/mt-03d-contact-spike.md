# Handoff — MT-03d contact spike

| Field               | Value                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Slice               | 13 of the first build round; work package MT-03                                                                        |
| Branch              | `claude/mt-03d-contact-spike`                                                                                          |
| Base                | `origin/main` `4f9329f3ed8fe985283ab1cf81d59040f13e995e` (main has not moved since slice 9)                            |
| Prerequisite slices | `claude/mt-03c-survey-lesson` at `4ba9af2c` (which carries slices A, B and 1 to 12), merged as the first commit        |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-03d-contact-spike.md` |
| Owner decision      | OD-08; the approved first-round plan, sections 4.5 (Contact) and 4.7, and section 5 (row 13)                           |
| Date                | 2026-09-29                                                                                                             |

## Why

The plan's prototype gate asks for proof, before any biopsy lesson exists, that one table of contact
serves both moving about the space and touching a target: the working element reaches the target
while the scope shaft is still refused at the same surface, a pivot that would sweep the tool
through lung is blocked with the part named, and after withdrawal the rules are what they were. This
slice builds that, in the engine and on its own page, with the forceps in the telescope's channel
and one illustrative nodule.

## What changed

| Path                                                                                                                              | Change                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/medical-thoracoscopy/engine/space/toolChannel.ts`                                                                   | New. The forceps as the engine models them: their state (in the channel or out, and how far), their capsules beyond the tip, the authored step and reach                                                                                                    |
| `engine/space/teachingTarget.ts`                                                                                                  | New. The nodule as a closed, outward sphere mesh, and the reader of its record, used only while the record's snapshot is current                                                                                                                            |
| `engine/space/spatial/spatialWorld.ts`                                                                                            | A teaching target in the world; `contact()`: every part against every surface under the table's rule, each pair keeping its own skin; the telescope's own clearance counts the target                                                                       |
| `engine/space/spatial/sweep.ts`                                                                                                   | Moves with the forceps out; one step of the forceps along the channel; drawing the telescope out, or the forceps in, is never refused by a surface; the roll bounded and interpolated                                                                       |
| `engine/space/{contactPolicy,loadSpace,spaceReducer,paneState,crossSection,spaceSnapshot,spaceWords}.ts`, `spatial/visibility.ts` | The table as the collider reads it; the resolver's forceps steps; the forceps in the engine's state; the forceps and the nodule in the pane state and the cut; the nodule in the snapshot's geometry and in what blocks a view; the words for the new stops |
| `src/features/medical-thoracoscopy/components/space/*`                                                                            | Added to the contract only: the forceps command, the forceps in the pane state and the cut; the dock's forceps control; the keys F and B, listed only where the forceps can be used; both 3D views draw the forceps and the nodule                          |
| `components/prototype/ToolContactPrototype.tsx`, `src/app/[locale]/medical-thoracoscopy/prototype/tool-contact/page.tsx`          | New. The spike's page: headed as an engineering prototype, the two places to start from, what to try, the table's rows for the nodule, and the space pane                                                                                                   |
| `components/hub/MedicalThoracoscopyHub.tsx`, `content/routes.ts`                                                                  | While the module is an unlisted preview, the hub links the two engineering prototypes, outside the outline and the one door                                                                                                                                 |
| `scripts/medical-thoracoscopy/build-tool-contact.ts`, `content/data/anatomy/tool-contact.json`, `content/anatomy.ts`              | New. The nodule and the two places, computed by the engine from the proxies and checked by running each demonstration through it; numbers only; the record's schema                                                                                         |
| `docs/medical-thoracoscopy/fidelity-contract.md`                                                                                  | The touch skin in the table of tolerances                                                                                                                                                                                                                   |
| `docs/medical-thoracoscopy/registers/traceability.json`                                                                           | The tool-contact row: written, with its content, claims, assets and tests                                                                                                                                                                                   |
| Tests                                                                                                                             | New: `spaceContact.test.ts`, `toolContactPrototype.test.tsx`, the page's test; the pane and hub tests follow the new control and links; `test-support/spaceScenes.ts` gains the contact scene                                                               |

## How contact works

- **One table.** `contactRule` gives, for every part (sleeve, telescope, forceps' shaft, forceps'
  jaws), every region (the seven survey regions, the lung, a teaching target), every phase of the
  tool and either authorisation, one of two rules. Only the jaws may touch, only a teaching target,
  only with the forceps out and the target authorised. The collider asks the same table
  (`colliderRule`); the wall is every region at once.
- **A skin for every pair.** A pair that must keep clear keeps the clearance skin (0.25 mm); the pair
  allowed to touch keeps the touch skin (0.15 mm), which is inside the touching distance (0.3 mm).
  Every piece of motion is shorter than the least clearance of any pair, so no part is carried
  through anything, however glancing the move. An earlier draft let the touching pair come to zero,
  which left a real hole: at touching distance a piece was sized by the other pairs alone, and the
  jaws could have crossed a sliver of the nodule and come out clear. The fuzz below judges every move
  along its path as well as at its end.
- **Withdrawing is never refused by a surface.** Drawing the telescope out passes only through space
  it already fills, and forceps out with it only through space the telescope or the forceps already
  filled, each part where a part as strict or stricter was; bringing the forceps in is the same. The
  old rule, which accepted a move at the skin only if it opened the room, refused a withdrawal that
  slid a side along a surface without opening it: with its side against the lung, the telescope
  could not be drawn out. That affected the survey lessons too, and is mended for them.
- **In the channel the forceps change nothing.** The telescope then moves by exactly the code it
  moves by with no tool; a test runs the same forty commands with the forceps never out, after an
  excursion, and with no forceps at all, and gets the same poses and stops.
- **The forceps' model.** Their capsules sit on the line through the centre of the channel's exit,
  0.86 mm below the axis (a modelled value), the width and jaw length from the device definitions;
  the step (2 mm) and how far out they may go (40 mm) are authored for the interaction.

## What the anatomy allows: the nodule is on the lung's surface

The plan puts the nodule on the costal pleura. The model cannot reach it there. From every one of
the 6,623 positions in the script's census, the line of the working channel meets the lung before
the wall. (Corrected after the independent review: the census covers tilts within 85 per cent of the
ellipse the port allows, at roll 0, on a 2° by 3 mm grid (`TILT_SHARE = 0.85`), not every position
the port allows. The review extended it to the whole ellipse and found the same: all 9,645 lines, and
38,580 over four rolls, meet the lung first.)
At the port's least depth the lung comes no nearer than 22.4 mm ahead of the tip along any line; in
nine directions probed across the port's range it lay 23 to 37 mm ahead, and the wall 70 to 147 mm.
So the forceps, which leave the channel along the telescope's line, cannot reach any part of the
chest wall. This is the same lung as the survey's finding (MT-C-0002, slice 10).

The script therefore tries the costal pleura first and, finding no line to it, sets the nodule on
the lung's surface, head on to the channel's line; the record says which, and how many lines met the
lung first. The page says so in plain words and says nothing about sampling a nodule there. When the
owner revises the lung's collapse, rerunning the script (about six seconds) puts the nodule on the
chest wall automatically wherever a line reaches it, and the record's snapshot makes the old one
stale until then.

What the script found, and the tests hold, on the real proxies:

| Demonstration                                                                   | Found                                                           |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Facing the nodule: the telescope taken in                                       | Stops at the nodule, kept clear, after seven presses            |
| Out three presses, then the forceps out                                         | The jaws touch the nodule at 7.05 mm out                        |
| The telescope taken in with the jaws touching                                   | Refused, the jaws named; nothing moves                          |
| The forceps back in, the telescope taken in again                               | Stops at the nodule as before                                   |
| Beside the lung: the forceps out until they stop, then the hand toward the head | Refused at the first press, the jaws named, the lung in the way |
| The forceps back in, the same pivot                                             | Moves freely for five presses                                   |

## Claims and assets touched

No claim was added or reworded; every decision stays NOT REVIEWED. The traceability row links the
spike to MT-C-0001, MT-C-0002 and MT-C-0003, the lung falling away, its collapsed distance and the
port, all of which the page shows. The page loads the pleural-space scene's files, already in the
asset ledger; the nodule and the forceps are made in code, and no file was added. Nothing was
uploaded.

## Checks run

| Command or check                                                                                                                                                                                                                                                                                                              | Result                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx jest src/features/medical-thoracoscopy "src/app/[locale]/medical-thoracoscopy"`                                                                                                                                                                                                                                          | 27 suites, 396 tests, all passing: 34 new                                                                                                                                                                                  |
| The contact fuzz (`spaceContact.test.ts`): 120 seeded sequences of 40 commands, the forceps and the scope mixed, half aimed at the nodule, a quarter with it not authorised                                                                                                                                                   | 4,800 moves, each judged at its end (every pair at its own skin) and at four points along its path (nothing crossed), by the brute force that shares no code with the collider: nothing found; the touching pair exercised |
| Seven faults planted, one at a time: an unauthorised target treated as authorised; the touching pair keeping no skin; the forceps' withdrawal swept like any move; the telescope's withdrawal swept like any move; the lung ignoring the forceps; the forceps left behind by the telescope; the telescope ignoring the nodule | All caught; the fourth only after the withdrawal test was changed to put the telescope's side, not its tip, against the lung                                                                                               |
| `npx tsx scripts/medical-thoracoscopy/build-tool-contact.ts`, twice                                                                                                                                                                                                                                                           | The same record, byte for byte                                                                                                                                                                                             |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`; `npx eslint … --max-warnings 0`; `npx prettier --check`; `git diff --check`                                                                                                                                                                                   | Clean                                                                                                                                                                                                                      |

## Real browser observations

On the dev server (`claude-thoracoscopy`, port 3134), the Browser pane hidden, so the page was driven
through the DOM (key events on the pane, clicks on the dock's buttons) and the 3D views drawn one
frame at a time through the development probe:

- **Facing the nodule, by the keys**: W seven times, stopped at the nodule with the telescope named;
  S three times; F four times, the jaws touching it, the table's row for the jaws turned to "May
  touch" and the dock saying so; W refused with the jaws named; B four times, back in the channel; W
  three times, stopped at the nodule again.
- **Beside the lung, by the dock's buttons**: "Forceps out" six times, stopped by the lung with the
  jaws named; "Hand toward the head" refused at once, the scope camera unmoved; "Forceps back in" six
  times; "Hand toward the head" moved the camera.
- **The views**: the Scope view shows the nodule at the centre of the field and the forceps coming
  up from below it (pixels sampled on the real canvas, and a screenshot); the Chest view draws the
  scene; the cut, chosen with "Show the Chest view as a cut", draws the nodule and the forceps.
- **A trap on the way**: the fault-planting script restored each file by renaming a copy over it,
  which the dev server's watcher did not see, so for a while the browser ran planted code (the
  telescope passing through the nodule). The files were written again in place, the served code
  was read back to confirm it, and everything above was observed after that. The script now
  restores by writing in place.
- Every module file loads; the only failed requests are `POST /api/analytics`, the site's analytics
  endpoint on this dev server, not this slice.

## Checks not run

- **The Playwright journeys, touch, reduced motion, the three layouts, 200 % zoom and 320 px reflow
  on this page**: slice 14's evidence.
- **A contact fuzz on the real proxies**: the contact fuzz runs on the analytic contact scene; on the
  real proxies the tests run the recorded demonstrations only.
- **A reader's review of the page's words**: the author's own, checked by the copy gates.

## Unresolved decisions

- **Where the nodule sits.** The plan says the costal pleura; with the lung the model has now, it
  cannot be reached there, and the spike uses the lung's surface. Revising the lung's collapse
  (MT-C-0002; `build_lung_states.py`, `COLLAPSE`) would let the script put it on the chest wall. The
  same finding blocks any biopsy lesson on this lung: `taking-biopsies` stays in preparation.
- **The touch skin**, 0.15 mm, half the touch distance, is a modelling tolerance chosen here and
  recorded in the fidelity contract; it is not a clinical margin.
- **Authorisation.** The spike's nodule is authorised by its scenario. Who or what authorises a target
  in a lesson ("under reviewed rules", fidelity contract) is not decided.
- **The forceps' model**: the channel exit's centre as their axis (modelled), and the authored step
  and reach.
- Everything open after slice 12 stays open.

## What must not happen next

- Do not show an effect on tissue, or call a touch a biopsy; the page is not a lesson.
- Do not let any part but the jaws touch, or the jaws touch anything but an authorised target.
- Do not change the lung's collapse to make the spike reach the chest wall without the owner's
  decision on MT-C-0002.
- Do not use the nodule's record once its snapshot is stale; compute it again.

## Repair after the independent review (2026-09-29): R0, R2, R4, R8, OD-12

**What the spike is (OD-12).** The nodule on the lung's surface is accepted by the owner only as an
interim engineering demonstration: one contact framework tells the forceps' jaws, which may touch,
from the telescope, which may not. It does not meet the plan's costal-pleura criterion, and gate
criterion 10 stays NOT MET as specified until the lung, the port and the envelope are decided (R9).
The nodule and the anatomy were not moved. The census wording above is corrected; that no line
reaches the chest wall is not the collapse's doing alone: the review found the port's tilt envelope
and the rib gap limit it too (the forecast and the gate packet now say so).

**R8, contact region by region.** The collider no longer treats the chest wall as one obstacle that
may be touched only if every region allows it:

- `contactPolicy.ts`: the table gains the jaws' state (closed, open) and authorises region by
  region. The working element may touch only with the forceps out and only a region the scenario
  authorises (`colliderRule(phase, authorisation, regions)`, by default the teaching target alone);
  the lung never; every other part never. The jaws' state changes the working element's shape, not
  its permission. These are engineering permissions: nothing here says a region is safe to touch.
- `spatialWorld.ts`: the wall is split by region once the regions are known (`useWallZones`, from
  `assembleSpace`), and a part is measured region by region, each at its own skin, whenever the rule
  differs between regions; a limit names the region it met.
- `toolChannel.ts`, `sweep.ts`, the reducer: the jaws open and close (a new simulated command,
  `{ kind: 'jaws' }`, not yet on the dock). Opening is refused while they are not wholly out, or
  where the open jaws (an authored, conservative envelope: the half-spread at the published 44°
  opening plus half a jaw's width, 5.37 mm) would come within a pair's skin; closing is never
  refused. The forceps come back only with the jaws closed ("Their jaws are open. Close them before
  bringing them back."), and then withdrawal is never refused by a surface, as before.
- No biopsy lesson, no target site, no tissue acquisition, bleeding or tissue effect was added.

`spaceContactRegions.test.ts` holds it on a room whose far wall is the mediastinum region: the jaws
touch that region when it is authorised and stop clear of it when another region, or none, is; the
telescope is refused at an authorised region; the forceps' shaft keeps the clearance skin where the
jaws may touch; the lung cannot be authorised; the jaws open only when wholly out and only with room;
open jaws must close before withdrawal; and 60 seeded sequences of 50 commands, jaws included, keep
every part at its own skin, region by region.

**R4.** The snapshot gains `tool`: the touching distance and its skin, the forceps' step and reach,
the open jaws' envelope, and a digest of every row of the contact table; `none` for a scenario
without the forceps. `currentToolContact` refuses a record made for other forceps or another table.
`tool-contact.json` was rebuilt (`npx tsx scripts/medical-thoracoscopy/build-tool-contact.ts`, 9 s):
the same nodule, places and demonstrations (the telescope stops after 7 presses; the jaws touch at
7.05 mm); only the identity changed.

**R2, the forceps on the real proxies.** `fuzzForceps` (test-support): 150 seeded sequences at the
lung's last step, the forceps out until stopped, then pivots, depth, rolls, the jaws, the forceps
out and back, every move judged along its path (Lipschitz-certified), the forceps' tip inside the
space and outside the lung by ray parity, and the forceps brought all the way back. 6,314 moves,
58,616 poses on the paths, 6,160 inside checks: nothing wrong. The open jaws fitted only once in
those sequences: the lung is close to every line of the channel.

The hub's prototype links show for any stage but published (slice 4's repair made the stage
`admin-preview`).

This does not change publication status or constitute clinical approval.
