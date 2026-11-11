# Bronchial branch tracing: plan from the lesion, map, navigate

Entry: `/en/learn/anatomy/branch-tracing`. Anonymous direct access, noindex, no catalog, search or sitemap listing. The module is unpublished.

**Rebuilt October 21, 2026** around the simplified bronchial branch tracing of Mortimer and Saghaie, _Lost in navigation: a simplified CT-based airway mapping method for ultrathin navigational bronchoscopy_, J Clin Med 2025;14:8009 ([doi](https://doi.org/10.3390/jcm14228009)). The October 9 rebuild (scope-first: match, identify, choose, drive at every fork) is kept for the two refresher lessons and for the drive itself; planning and the nested-arc map are new. Documents listed under [Earlier design records](#earlier-design-records) describe earlier courses.

## What the learner does

A lesion trip has three stages.

1. **Plan, from the lesion back** (`engine/plan-session.ts`).
   - _The airway into the lesion._ The learner clicks the airway that runs into the lesion. It counts within 3 mm of the route's own centreline over the last 20 mm before the lesion, in three dimensions, so an airway that runs along the slice counts all along it (`lesionVerdict`).
   - _The CT while tracing._ Until the map is on the bench the CT has both picture columns (`data-plan-wide`), and a coronal or sagittal reconstruction opens beside it on request. The picture is dragged to move it (a press that drags marks nothing; **Recentre** puts it back), and once the airway into the lesion is found a click drops the learner's own pin where they have followed it to. Pins show dimmed three slices either side, are checked by nothing and are not saved.
   - _Its segment._ The learner names the segmental bronchus from that lobe's segmental bronchi (`segmentChoices`).
   - _Views._ Turning or flipping the CT, and the coronal and sagittal reconstructions, are offered and never checked. In the lessons that teach them this is a step of its own. In Practice and the closing set it is not a step (`ROUTE_PLAN_PARTS`): the paper's pairing for the segment and the two open-view links sit beside the ostium circle. A place saved on the old step opens on the circle (`settlePlan`).
   - Until the segment is named, nothing on screen names it: the title, the route strip and the lesion picker give the lobe and slice only, and the map waits. A trip that does not ask for the circle draws none, so `start-at-the-lesion` never shows the circle `stand-at-the-ostium` asks for, and the lesion pictured on the hub is named by its lobe. In Learn, a lesson that asks for the segment names only the lobe in its title, objective, concept, trip titles and intro (`__tests__/nav-lessons.test.ts`).
2. **Map** (`engine/arc-map.ts`).
   - _The ostium circle._ The learner labels the four rim positions of the view into the segment's ostium with superior, inferior, medial, lateral, anterior or posterior. Any roll of the right arrangement is accepted; a mirror image is refused (`gradeFrame`). A rim position between two directions accepts either word.
   - _The divisions._ At each division from the ostium to the lesion the learner draws each branch as an arc on one of eight sides of the current branch and marks the branch that goes on. A drawn branch counts when it is within 67.5° (the same or a neighbouring side) of where that branch leaves _relative to its siblings_, read in the ostium frame; drawn branches are matched to daughters by the closest overall fit (`gradeArcs`). The next division is drawn inside the marked branch.
   - _Review._ One map: the learner's, with the model's arcs laid over it as dashed lines (`withGhost`, `ghost` on a map level), and a choice of Both, Yours or The model's. The star is on the branch that reaches the lesion.
   - _On the map itself._ The four directions are chosen in controls that sit on the circle (`rimSlot` on `ArcMap`). After a check of a division that does not fit, each drawn branch is marked where it stands, kept or not where a branch leaves, by a mark and a line style; without hints the check says only whether the division fits.
3. **Navigate** (`engine/nav-session.ts`, the scope-first bench).
   - **The central airways are flown through** (`cruise` on a station, `cruiseCount` in `content/nav-lessons.ts`, `flyingThrough` in `engine/nav-session.ts`). On a drive that follows a map, every fork above the one that gives off the lesion's segmental bronchus is passed without stopping: nothing is asked there and nothing is logged as asked, so first-try counts cover only the forks chosen at. The card names what is passing and offers **Stop at the next fork**, which makes that fork an ordinary one. A lesson stops earlier at any fork it has something to say at (lesson 6, the left main bronchus). The drive waits for the scope's picture before it sets off. **Choose at every fork from the trachea** on the hub and the lesion lists turns the fly-through off (`engine/prefs-storage.ts`, key `branch-tracing.prefs-v1`).
   - Every fork stopped at is chosen at, by its button or by a click on its number in the scope; no fork asks for its openings to be marked (the two refreshers still mark them). On a drive that follows a map an opening is named once the learner has chosen: the first fork stopped at gives off the bronchus the learner named in planning, so its name on an opening would be the answer.
   - Turning the CT to match the scope is asked for in the orientation check and the first refresher (`carina-orientation`), and in the second (`two-levels`) until the learner has finished the first or matched three forks on the first check (kept on the device: `nav-storage.ts`, `orientation`). A drive that follows a map never waits for it, in the lessons, Practice and the closing set: the CT stays as the learner left it, with **Check my turn** beside it. The note about the CT's turn shows only while the CT is the middle pane.
   - **Where the lesion lies from the fork** (segment, slices, distance, bearing) is said on the choose card only above the segmental ostium and only where hints are on. Past the ostium, and at every fork of the closing set, the card says where the lesion is (segment and slice) and nothing of which way: there the way is the map's to give (`lesionPlaceSentence`). A refusal after a branch that led away gives the bearing only where hints are on (`chooseDeclined`).
   - Past the segmental ostium the middle pane shows the map beside the scope, zoomed on the current division, with **Turn the map to the scope** (`mapTurnToScope`); the CT is a tab away. The scope's rim reads Med, Lat, Ant, Post, Sup, Inf instead of R, L, A, P, Head, Feet.
   - **A turn that leads away.** Choosing an opening that leads away drives the scope into it, stopping 8 mm short of that branch's own next division (or short of where the model ends), looking at it (`geometry/astray.ts`). The learner backs out along the same path to the fork's exact waiting pose, and that opening is greyed. Wrong turns and back-outs are logged and summarised, in the closing set too.

| Section     | Address                 | What it is                                                                                                                   |
| ----------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Learn       | `/learn?lesson=<id>`    | Seven lessons, about 61 minutes; an optional orientation check before them and two refreshers after.                         |
| Practice    | `/practice?lesion=<id>` | Thirteen simulated lesions: plan, map and drive each, help on request.                                                       |
| Closing set | `/assess?lesion=<id>`   | Three lesions in three lobes, no hints: a check says only whether it fits; openings are numbered but not named until chosen. |

The course, in order (`NAV_LESSONS`): `start-at-the-lesion`, `stand-at-the-ostium`, `nested-arcs` (planning from the lesion), `drive-with-the-map`, `views-that-help` (driving with the map), `turn-back`, `navigate` (the whole method). The course is for bronchoscopists who know the airways down to the segments, so it opens on planning.

- **Orientation check** (`orientation-check`, optional, hints off): three forks that ask only for the CT to be turned to the scope. The carina is a flip, RB1 a quarter turn left, the left upper division a quarter turn right. All three matched at the first check lead on to lesson 1; otherwise the closing card offers the first refresher. Nothing waits on it.
- **Refreshers** (`REFRESHER_LESSONS`): `carina-orientation` and `two-levels`, the two lessons that used to open the course. They keep their addresses, their marking of openings and their saved places.
- **Lesson 4 (`drive-with-the-map`) opens with its map drawn** (`prefilled` on the plan): the RB1 map of lesson 3, as the airway model has it, at the review. **Draw it myself** clears it. A map the bench drew is left out of the summary.
- The hub's first-visit button is the orientation check, with "Skip to planning: lesson 1" beside it.

## How it is built

All under `src/features/bronchial-branch-tracing/`.

| Layer          | Files                                                                                                                                                      | What it holds                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Route geometry | `geometry/route-stations.ts`, `geometry/paired-scope.ts`, `geometry/astray.ts`                                                                             | Where the scope waits at each fork, how it travels, and the turn into a branch that leads away and back out.        |
| The map        | `engine/arc-map.ts`                                                                                                                                        | The ostium frame, where each branch is drawn, how a circle and arcs are read, the nested layout, the turn to scope. |
| Planning       | `engine/plan-session.ts`, `engine/trip-session.ts`                                                                                                         | The planning reducer; a trip as planning then the drive.                                                            |
| Matching       | `engine/orientation-match.ts`                                                                                                                              | Which CT displays match the scope at a fork, and how a given display differs.                                       |
| Lumen verdict  | `engine/junction-feedback.ts`, `engine/response-planes.ts`, `geometry/answer-plane-air.json`                                                               | Which lumen a click is in, read from the CT's own air (the refreshers).                                             |
| Session        | `engine/nav-session.ts`, `engine/nav-storage.ts`                                                                                                           | The drive reducer; the place kept on the device (`branch-tracing.nav-v2`).                                          |
| Content        | `content/nav-lessons.ts`, `content/bench-copy.ts`, `content/plan-copy.ts`, `content/junction-feedback.ts`, `content/course-guide.ts`, `content/targets.ts` | Lessons, every computed sentence, the fork explanations, the method's steps and tips, the lesion list.              |
| Benches        | `components/TripBench.tsx`, `PlanBench.tsx`, `NavigationBench.tsx`, `ArcMap.tsx`, `ScopeView.tsx`, `TracingCtViewer.tsx`                                   | Planning and the drive, each on one screen.                                                                         |
| Hosts          | `components/NavLessonHost.tsx`, `NavRouteHost.tsx`, `BranchTracingOverview.tsx`                                                                            | Lessons, lesions, the hub.                                                                                          |

The source export is unchanged: `geometry/branch-decisions.json` (17 routes, 128 fork decisions over 57 forks), the native CT in `public/branch-tracing/native-v1` and the lesions in `public/branch-tracing/targets-v1`. `geometry/paired-routes.json` holds the centreline of every airway a fork names (116). `geometry/off-route-children.json` holds one generation past each of the 115 fork daughters (the first 15 mm of each child; 23 daughters end in the model) and the source graph's airway radii. It is kept out of `paired-routes.json` on purpose: the lumen verdict reads every edge there as a named airway. Both are written by `scripts/branch-tracing/build-paired-routes.mjs`.

### Rules the geometry follows

- **Scope roll** (`scopeUp`). Looking down an airway: anterior at the top. Looking along a horizontal bronchus: the head at the top. Looking up an airway inside an upper lobe: the lateral chest wall at the bottom, which is how Kurimoto and Morita display the right upper lobe and the left upper division; looking up anywhere else: anterior at the top.
- **Where the scope waits** (`stationCamera`). 8 mm short of the fork, aimed between the openings. Farther back (to 20 mm) when a wide airway would put the openings at the rim, and nearer when the fork before is closer than 8 mm: it always stays inside the parent airway.
- **The ostium frame** (`ostiumFrame`). The station camera at the segment's first division, its up, right, down and left named by the nearest anatomical direction; a second direction within 0.15 makes the position a combination. At RB1 this is medial up, posterior right, lateral down, anterior left: Mortimer and Saghaie's Figure 1E–F. The frames of all ten segments the lesions use are pinned in `__tests__/arc-map.test.ts` and were read before any text was written about them.
- **Where a branch is drawn** (`branchBearings`). Each daughter's direction 6 mm along its centreline, minus the mean of its siblings, laid across the ostium frame. No mapped division has a branch whose separation lies mostly along the view (the smallest in-view share is 0.44, at `junction-71`).
- **What matches** (`matchOrientation`). A patient axis counts when at least half of it lies across the scope's line of sight. A display matches when every such axis points the same way on both pictures.
- **Where a daughter is identified** (`responsePlane`, lessons 1–2). On the export's own response plane, except the tracheal bifurcation, identified on slice 372 (`RESPONSE_PLANE_OVERRIDES`).
- **What a click is in** (`optionVerdict`, lessons 1–2). The click's air region is flood-filled to 12 mm; it is in the named airway whose centre that region reaches and is nearest.
- **What is asked at a fork.** Lessons 1 and 2 mark openings where their lumens are 5 mm² or more and not in `THIN_LUMEN_FORKS`. Every other drive is choose-only (`MAP_STEPS`).

## Written fork explanations

`content/junction-feedback.ts` holds one explanation per fork, keyed by the fork's checkpoint id: 35 of the 57 forks. Thirteen were written on October 8, 2026, ten on October 9 and twelve on October 10. Every fork where a learner is asked to mark the openings has one: 27 forks across the lessons and routes. Eight more explained forks are only chosen at. `__tests__/junction-feedback.test.ts` fails if a lesson or route ever asks for marks at a fork with no explanation.

| Fork                        | Divides into      | Fork                         | Divides into          |
| --------------------------- | ----------------- | ---------------------------- | --------------------- |
| `junction-1` trachea        | RMSB, LMSB        | `junction-2` RMSB            | RUL, BI               |
| `junction-3` LMSB           | LUL, LLL          | `junction-4` RUL             | RB1/B2 trunk, RB3     |
| `junction-6` LLL            | LB6, basal trunk  | `junction-5` BI              | RLL, RML              |
| `junction-14` RB1           | RB1b, RB1a        | `junction-7` RB1/B2 trunk    | RB2, RB1              |
| `junction-9` RLL            | basal trunk, RB6  | `junction-8` RB3             | RB3, RB3a             |
| `junction-10` RML           | RB4, RB5          | `junction-21` LUL            | LB4+5, upper division |
| `junction-19` RB4           | RB4, RB4a         | `junction-22` LB4+5          | LB4, LB5              |
| `junction-20` RB5           | RB5a, RB5b        | `junction-12` left basal     | LB7+8/B9 trunk, LB10  |
| `junction-16` RB3a          | two RB3a branches | `junction-17` right basal    | basal trunk, RB7      |
| `junction-23` LUL div.      | LB3, LB1+2        | `junction-26` LB7+8/B9 trunk | LB9, LB7+8            |
| `junction-11`, `-25`, `-52` | branches of LB6   |                              |                       |

The twelve added on October 10 are subsegmental forks. At eleven of them the daughters carry the parent's name, so the text tells them apart by opening number.

| Fork                            | Divides into       | Fork                | Divides into                       |
| ------------------------------- | ------------------ | ------------------- | ---------------------------------- |
| `junction-36` right basal trunk | RB8, basal trunk   | `junction-43` RB5b  | two RB5b branches                  |
| `junction-73` RB8               | two RB8 branches   | `junction-46` LB3   | two LB3 branches                   |
| `junction-138` RB8              | three RB8 branches | `junction-94` LB3   | two LB3 branches                   |
| `junction-42` RB5a              | two RB5a branches  | `junction-47` LB1+2 | two LB1+2 branches                 |
| `junction-86` RB5a              | two RB5a branches  | `junction-53` LB9   | a side branch and the continuation |
| `junction-161` RB5a             | two RB5a branches  | `junction-91` LB5   | two LB5 branches                   |

**Daughters that share a name.** The explanation calls them "Daughter A", "Daughter B" and "Daughter C", in the fork's own order, and the bench shows those as its opening numbers (`packetProse` in `content/bench-copy.ts`): "Opening 1 turns outward". No subsegment letter is given for these twelve: the source graph does not assign one.

What the learner sees of an explanation, and when:

- **Before marking** (`entryLimitation`). A note on the fork card while the openings are being identified, at a fork that is marked and where a lumen is not a separate ring on its own slice: for example the right upper lobe bronchus on slice 374 is the outer end of one dark channel.
- **After a mark in the other airway** (`whenNearer`). What tells the two lumens apart on that slice.
- **Once the openings are named** ("More about this fork on the CT"). Where the fork is and which way each daughter leaves (`divergence`), what stays connected from slice to slice (`continuity`), the slice ranges worth stepping through (`revisit`), the measurements (`known`) and the names (`naming`).

None of it is shown in the closing set, or on a trip that withholds names. `uncertain` and `naming.uncertainty` are project record and are never shown.

Each statement comes from one of three places: the airway model (fork level, courses, distances), the shipped CT images read at the lumen verdict's air threshold (whether two lumens are one air column or separate on a slice), or the nomenclature record. `__tests__/fork-explanations-evidence.test.ts` recomputes the model and image statements for the 22 explanations written on October 9 and 10 and fails if a quoted slice, distance, width, course or "one air column" claim stops being true. The shapes described (channel, ring, limb, teardrop, slot) were read off the images by the author and are not machine-checked. The explanations have not been reviewed by a second reader.

**Thin lumens.** At five of the October 10 forks one or both openings are about 2 mm wide and show as a thin dark line, not a ring: both openings of `junction-161`, and opening 1 of `junction-42`, `junction-86`, `junction-138` and `junction-53`. The owner decided on October 10, 2026 that these five are chosen at, not marked. The 5 mm² rule does not catch them, because lung beside them has pixels below the air threshold and the measured area comes out larger than the lumen, so they are listed by name (`THIN_LUMEN_FORKS` in `content/nav-lessons.ts`). Their explanations say where each opening is seen and ask for Zoom; they have no note about marking and no advice for a mark.

## Run and check

```sh
npm run dev:claude                          # port 3120; the launch entry `claude-worktree`
npx jest src/features/bronchial-branch-tracing
BRANCH_TRACING_BASE_URL=http://localhost:3120 npx playwright test -c playwright.branch-tracing.config.ts
npx tsx scripts/branch-tracing/orientation-match-report.ts            # the match at every fork
node scripts/branch-tracing/build-answer-plane-air.mjs --report      # lumen size and threshold margin per daughter
node scripts/branch-tracing/build-paired-routes.mjs                  # recopy the 116 centrelines and the next division of every fork daughter
node scripts/branch-tracing/build-answer-plane-air.mjs               # regenerate the air masks (after the centrelines)
```

The Playwright spec includes the one-screen check: at 1440×900, 1600×905 (the beta reviewers' window), 1600×852 (what the beta frame leaves the module in that window) and 1707×900, for the drive (match, identify, choose, a turn that leads away, drive), the planning bench (circle, divisions, review) and the drive past the ostium with the map beside the scope, every picture and control is inside the viewport, the page does not scroll and the bench reaches the bottom of the window. While a bench is open the site menu and the section tabs are hidden in the fixed workspace (1024×700 and up; `data-site-header="hidden"` on the module frame, the rule in `src/styles/globals.css`), so the bench has the whole window; its own bar leads back to the course overview or the lesion list.

## Open for the owner

Lesson numbers in the dated notes below are those of the day. Before round 1 (November 10, 2026) the course had nine lessons; the two that are now refreshers were lessons 1 and 2, so every later lesson's number has since moved down by two.

Decided on October 21, 2026: rebuild around the simplified method; wrong turns go one generation, everywhere, and are counted in the closing set; the map is graded on relative direction with the model map shown after; turning the CT becomes optional after lesson 1 or three first-try matches.

Decided by the build and easy to change:

1. **Tolerance.** A drawn branch counts within 67.5° of its relative bearing (the same or a neighbouring of eight sides). `ARC_TOLERANCE_DEG` in `engine/arc-map.ts`.
2. **The circle's roll.** Any roll of the right arrangement is accepted, because how the scope is held is the operator's choice; the map is then drawn on the learner's circle and turned to the scope on request. A mirror image is refused.
3. **No marking on whole routes.** Practice and the closing set no longer ask for openings to be marked at any fork: the CT is read in planning. Lessons 1 and 2 still mark.
4. **The airway into the lesion** counts within 3 mm of the route centreline, not by the air flood fill: near most lesions the lumen is 1–3 mm² at the air threshold and the lesion patch covers about 28 slices, so no clean air mask exists there.
5. **The segment naming step** offers the lobe's segmental bronchi. The lesion picker and titles name only the lobe and slice until the segment is named, so the step is not given away by the lesion's own S-code.
6. **The model map** does not yet draw a generation inside the branches the route does not take (the paper's tip for recognising a wrong turn). `off-route-children.json` has the geometry for it.
7. **Coronal and sagittal views** (`public/branch-tracing/mpr-v1`, `components/ReferenceCtView.tsx`, built by `scripts/branch-tracing/build-reference-planes.mjs`): 276 coronal and 363 sagittal planes rebuilt losslessly from the shipped axial PNGs, 34.17 MB. In planning they are tabs beside the axial CT and follow the lesion, then the division being drawn; the views step gives Mortimer and Saghaie's Figure 2 pairing for the segment (`content/reference-views.ts`). While driving they are tabs in the middle pane and follow the scope tip. A click on either moves the axial CT to that point. None of it is checked.
8. The tracheal bifurcation is identified on slice 372 everywhere it is marked; five thin-lumen forks are a named list, not a measured rule; lesson 1's "looking up, turn and do not flip" is not checked line by line against Kurimoto and Morita pp. 4–8.
9. **Wording changed on November 9, 2026, for your read.** The segmental bronchus is defined as the largest airway on the way back from the lesion that still supplies the segment alone (lesson 3 and the hint after a wrong segment); the earlier "the bronchus that leaves the lobar bronchus" did not hold for RB1, which leaves the RB1/B2 trunk in this CT, or for the basal segments. Lesson 7 now says a coronal reconstruction _cuts across_ a segment that runs forward or back, as the Figure 2 reasons say, not that it shows it in profile. The primer's "seldom more than four or five" divisions past the segment is now this CT's own count: no route has more than five (pinned in `nav-lessons.test.ts`).

### Changed on November 10, 2026 (round 0 of the learner-experience plan), for your read

The plan came from a review of the module for third-year fellows and attendings, who know the airways down to the segments and need the periphery. It has eight rounds; round 0 is small fixes:

1. **Turning the CT is never demanded on a drive that follows a map.** This reverses the October 21 rule (required until shown) for lessons 6, 8 and 9, Practice and the closing set. Lesson 1 still asks for it, and lesson 2 until it has been shown.
2. **The lesion's bearing from the fork** is no longer on the choose card past the segmental ostium, or anywhere in the closing set, and a closing-set refusal no longer gives it.
3. **Lesson 3 draws no circle**, and the hub's pictured lesion is "A lesion in the right middle lobe", not RS5.
4. **Views are not a step in Practice or the closing set**; they are offered beside the circle.
5. **A bench has the whole window**: no site menu or section tabs above it.
6. The closing card's way on is pinned in view; the zoomed map is a round lens; what a check found carries an icon as well as a colour; focus goes to the task heading when a step's button went with the step; the scope's light narrows to a cone about its line of sight (`HEADLIGHT_CONE` in `components/ScopeCanvas.tsx`), and the scene lights that did nothing are gone.

### Changed on November 10, 2026 (round 1), for your read

1. **The fly-through.** The first choice on every drive is now the fork that gives off the lesion's segmental bronchus. Lesson 6 (`turn-back`, the old lesson 8) stops at the left main bronchus because it teaches there. About 20 mm/s; three central forks pass in about three seconds.
2. **Opening names wait for the choice on every drive that follows a map**, not only in the closing set and the second trip of lesson 7 (`navigate`). Above the ostium the choose card still says which way the lesion lies where hints are on.
3. **The course is seven lessons, 61 minutes.** Lesson numbers moved down by two; the beta hub card (`src/features/module-beta/rollout.ts`) says so. Lesson 4 is counted at 6 minutes, down from 9, because its map is already drawn.
4. **The orientation check** routes to the refresher only when a fork did not match at the first check on that visit; a reload in the middle of it counts the earlier forks as not matched.
5. **The primer** (hub and the "What are we doing?" dialog) now describes the fly-through and the check.

### Changed on November 10, 2026 (round 2), for your read

1. **The text column is on the left** in both benches, first in the page and in the tab order.
2. **How to work a step out sits in the task card**, open when the step comes, in place of the notes that sat under the card and below the fold. Where the card also holds choices or drawing controls it keeps to a few lines and scrolls, and it folds after a check of a division that did not fit, so what the check found is in view.
3. **The CT has both picture columns while the airway is traced**, about 675 px square at 1600×905 against 565. The two "the map starts at…" sentences that filled the empty map pane are gone.
4. **Drag to move the CT, click to pin.** A mark is now placed when the pointer is released without dragging, not when it is pressed.
5. **The four directions are chosen on the circle**; the four dropdowns left the task card.
6. **A division that does not fit is marked on the map**, branch by branch, where hints are on.
7. **The review is one map** with the model's arcs over the learner's. The two small maps side by side, and their colliding labels, are gone.

Not done in this round: the cut of about a third of the task-column text. It changes what every lesson says, so it is left for a pass of its own that you can read sentence by sentence.

### Changed on November 10, 2026 (round 3), for your read

1. **The same opening is lit wherever it shows.** The pointer (or the keyboard, on a choice button) on an opening's number in the scope, its marker on the CT, its button or its row in the fork's table lights all of them. The map's arcs are left out on purpose: which arc is which opening is the question being answered.
2. **The map's turn and zoom are movements.** The map keeps one frame; inside it the map is moved to the current branch, enlarged and turned about that branch (`arcStage` in `ArcMap`), so the zoom into the next division and the turn to the scope are seen happening. The turn carries on by the shorter way round. Before this the zoomed map was centred on the branch's unturned place, so with the map turned it showed the wrong part.
3. **Turn the map to the scope is a switch** under the map, with what it does beside it. On, the map follows the scope's own roll as it drives (`mapTurnToScope` on the live pose). It still starts off: the turn in the head is the skill.
4. **A flip or a quarter turn of the CT is a movement** (0.45 s), and "Show me" at a match plays its turns one at a time. While the picture turns, its overlays and edge letters are out of sight and a click places nothing. A reset is drawn at once.
5. **Where the scope is, on the whole tree** (`components/AirwayTreeInset.tsx`, `geometry/airway-tree.ts`): a small frontal picture in the corner of the scope pane, drawn from the 116 centrelines, with the route covered so far and the tip. The patient's right is on the left. It never draws the route ahead, the lesion or a name.
6. With reduced motion every one of these is drawn at once.

Not done in this round: taking the drive's clock out of the bench's state and splitting `NavigationBench` into panes. Nothing above needed it. It is a refactor with no change the learner sees, so it is left for the round that builds the rolled-scope drill, which is what needs the panes apart.

### Changed on November 10, 2026 (the text cut), for your read

The task column says less: 17% fewer words over fifteen screens, 25% to 33% fewer where the scope is driven with the map. Every changed sentence is in [the clinical-language report](../clinical-language/bronchial-branch-tracing.md), before and after, with five further cuts that would remove content and are left for your ruling. Two cuts are in what is shown: the fork's CT table shows only while the CT is the middle pane, and "turning the CT is your choice" is said once a trip.

### Changed on November 10, 2026 (round 4, the scope picture), for your read

1. **The scope picture has its own material** (`components/scope-material.ts`). It is the shared mucosa shader with four of its lines replaced; the shared file (`src/lib/bronchoscopy-core/mucosa.ts`) is not edited, because the navigation trainer and the EBUS course draw with it. `__tests__/scope-material.test.ts` holds each of the four lines to one place in the shared shader and pins the shared shader's hash: a change there fails here until someone has looked at this picture again.
2. **The light reaches as far as the airway is wide** (`geometry/airway-radius.ts`). The shared shader lets the light carry 23 mm, right for the trachea; in a 2 mm airway that lit everything to one tone. The reach is now 3.8 times the airway's radius from the source graph, between 5 and 23 mm, averaged over a short stretch so it eases as the scope passes from one airway into the next. The trachea and main bronchi look as they did; past the segment the lumen ahead is dark and the wall beside the lens is lit. In a branch off the route the reach is a little shorter than the route's at that depth.
3. **Fine vessels in the wall.** Thin darker lines fixed in the wall, so something moves past as the scope advances. They are a drawn pattern, not this patient's vessels, and not a finding. `SCOPE_VESSELS` (0.5) sets how strongly they show; 0 removes them.
4. **The rim of the picture is a little darker**, as a lens's is (CSS over the picture, under the letters and numbers).
5. **At the end of the airway a dashed ring says where the lesion lies beyond the wall**, in the lesion's colour, labelled "Lesion, beyond the wall", and the caption says it is not seen from the airway. It is drawn only at arrival. The ring is an overlay, never part of the airway's picture.

Not built: cartilage rings and the folds of the posterior wall. They need the direction of the airway at every point of the wall, which the surface does not carry (about 700,000 points, to be worked out from the nearest centreline when the picture loads), and a single direction for the whole view would make the rings jump at each fork. The shared shader also records an earlier choice against repeating bands. Say whether you want them after seeing this round's picture.

### Changed on November 10, 2026 (round 5: demonstration, read-back, lesion list), for your read

1. **The method is demonstrated before it is asked for** (`engine/demo-script.ts`, `components/DemoPlayer.tsx`). "Watch the method" plays one lesion from the lesion to the lesion on the real bench: 14 steps, each a caption and the bench's own "Show me" actions, so it cannot drift from what the bench does. It plays by itself with Pause, Back and Next; with reduced motion it waits to be stepped. The caption takes the task column, the pictures cannot be worked, and nothing is saved. It opens from the hub (a link beside Start, and a poster under the CT whose map draws itself division by division) and from a link at the top of the primer. Its address is `/learn?lesson=watch-the-method`; it is not one of the lessons.
   - The lesion is the Practice lesion in LB3 (`l-anterior`): it is in no lesson and not in the closing set. Its whole answer is now shown to anyone who watches, and it is still on the Practice list.
   - The primer still opens by itself the first time a bench is used; the demonstration is its first line, not its replacement. Say if you want the primer's own opening dropped.
2. **The drive is read back at arrival** (`engine/route-replay.ts`, `components/RouteReplay.tsx`). Under the map: the whole route on the airway tree, a dashed stub for each branch that led away and was driven into, and one line for each fork where an opening was chosen (first choice; another opening first; shown). The same mark sits beside each division's number on the map. To draw the stub the fork's record now keeps which opening was entered (`StationLog.away`; older saved places read without it).
3. **The lesion list says what has been done** (`components/LesionPicker.tsx`, `engine/results-storage.ts`). Each lesion is a card: the airway tree with the way to its lobar bronchus lit, how many divisions its map has, and, once reached, how much of the last run landed at its first check. The record is kept on this device under its own key (`branch-tracing.results-v1`), apart from the place record, which drops its oldest entry past 24. A reload on the closing screen does not count a second run.
   - The list still names no segment. The tree picture stops at the end of the lobar bronchus, and a test holds every lesion in a lobe to the same line, so the picture says no more than the lobe's heading.
   - The number of divisions is shown before the lesion is opened. Say if you would rather it were not.
4. **The closing set has a summary** on its list once one of its lesions is reached: a row for each of the three, with planning steps, divisions drawn and openings chosen at the first check, and branches that led away.

### Changed on November 10, 2026 (round 6: the scope has rolled), for your read

1. **A drill after the lessons: "The scope has rolled"** (`engine/roll-drill.ts`, `components/RollDrillBench.tsx`, `content/roll-copy.ts`). It drives two routes from the lessons (the RB1 lesion of lessons 3 and 4, and the RB5 lesion of lesson 7), five stops in all. Each route opens at its segmental ostium, where the picture carries the map's directions. From there the scope drives to each division with a fixed roll applied (a quarter turn, a half turn, 135° and 45°, both ways round), stops with a rim that says nothing, and the learner turns the map in 45° steps until it sits as the picture does, checks it, and takes the opening the map marks.
   - **The check** accepts the map within 45° of the picture. A half turn out and a quarter turn out are named. A half turn out is the one a carina cannot settle: two openings on a line look the same either way up.
   - **The drive in is the cue.** The roll is applied during the drive, so the picture is seen turning, and "Watch the drive in again" replays it. Replays are counted, not held against the learner.
   - Along a route the map stays as the learner left it; a new route starts with its map as drawn.
   - The closing card gives two counts (map turned at the first check, opening taken at the first choice) and leads to Practice. Nothing is saved but that the drill was opened and reached.
2. **Where it sits.** The hub lists it after the lessons; the last lesson's closing card leads to it; its address is `/learn?lesson=the-scope-has-rolled`. It is not one of the seven numbered lessons, so the course's count and minutes are unchanged.
3. **Shared pieces.** `rollPose` in `geometry/route-stations.ts` turns the picture about the line of sight and nothing else. `components/useDriveClock.ts` is the drill's drive clock. `geometry/opening-anchors.ts` is where an opening's number is anchored; the navigation bench now uses it too. `ScopeView` takes `plainRim` to leave the rim's directions off.

Not built in this round, and why:

- **The rolled scope as an option on Practice lesions.** The navigation bench says where each opening sits in the view ("upper left"), which way the scope is looking, and what lies toward the lesion, all worked out for the unrolled picture. Under a roll every one of those sentences would be false until it is recomputed, and the "Turn the map to the scope" switch would give the turn away. That is a pass over the bench's sentences of its own, not an option to switch on.
- **Turning the map by dragging.** The map is turned with the two buttons or the arrow keys.
- **Taking the drive clock out of the navigation bench and splitting it into panes** (carried from round 3). The drill has its own small bench and clock, so nothing here needed it. It remains a refactor with no change the learner sees.

## Earlier design records

These describe the course this one replaced and are kept as history: [flow redesign](flow-redesign.md), [its validation](flow-redesign-validation.md), [instructional update](instructional-update.md), [module brief](module-brief.md), [QA report](qa-report.md), [orientation QA](orientation-qa-report.md), [branch-decisions QA](branch-decisions-qa-report.md), [architecture decision](architecture-decision.md), and the screenshots under [review/](review/). The data records still apply: [source and coordinate audit](audit.md), [nomenclature](nomenclature-review.md), [nodule targets](nodule-target-review.md), [clinical review boundary](clinical-review.md), [Slicer export evidence](native-export-review.json).

## Reproduce native CT assets

`export-native-slicer.py` verifies the original NRRD and graph hashes, loads the CT in an isolated Slicer process, and writes only the feature's windowed PNGs, manifest and export review. It does not save a scene or modify the source CT. The author's existing Slicer process is left alone.

```sh
BRANCH_TRACING_ROOT="$PWD" \
BRANCH_TRACING_CT_SOURCE='/Users/russellmiller/Projects/navigation_module/data/target/target_clean_ct.nrrd' \
/Applications/Slicer.app/Contents/MacOS/Slicer \
  --no-main-window --no-splash --disable-settings --ignore-slicerrc \
  --disable-cli-modules --python-script "$PWD/scripts/branch-tracing/export-native-slicer.py"
```

Trace specifications are in `scripts/branch-tracing/authoring/ct-traces.json`. Native assets are in `public/branch-tracing/native-v1`: 236 acquisition planes, levels 240–475, fixed window −1000 to 400 HU, 48,335,710 PNG bytes. The browser loads the current plane and three neighbours each way, not the full stack. Original NRRD, the full source label spreadsheet, textbook pages and personal metadata are not distributed. Selected anatomical names are included as derived teaching annotations. The airway surface the scope view draws (`public/branch-tracing/preview-v1/airway.glb`) is reproducible with `python3 scripts/branch-tracing/build-preview.py`; its hash is pinned in `components/ScopeCanvas.tsx`.

## Reproduce anatomical names

`python3 scripts/branch-tracing/label_native_traces.py` updates only manifest annotations. It verifies the original and labeled graphs, checks every selected complete polyline and node connection, and assigns checkpoints to their source edges within 0.0001 mm numerical tolerance. `authoring/airway-nomenclature.json` records normalized names and the explicit textbook/topology basis for each assignment. The Slicer exporter also invokes this same annotator. Slice PNGs, coordinates and progress IDs remain unchanged.

## Reproduce nodule targets

The exporter imports `residualHuAt` from the same shared core used by the navigation trainer. It reads the original signed-HU volume and existing `lung_nodule_1` residual/alpha data, then computes compact composited patches before applying the lung window. It does not edit the CT or the trainer.

```sh
BRANCH_TRACING_CT_SOURCE='/Users/russellmiller/Projects/navigation_module/data/target/target_clean_ct.nrrd' \
npx tsx scripts/branch-tracing/build-targets.ts
```

`authoring/nodule-targets.json` defines the segment, distal edge and donor scale. `public/branch-tracing/targets-v1` holds the derived manifest, 373 patch images and four additional native planes (239, 476–478), totaling 1,101,884 PNG bytes. Previous generated assets are pruned only when listed in this exporter's preceding manifest. Original `native-v1` images and annotations are unchanged. The browser turns patches and base CT together.
