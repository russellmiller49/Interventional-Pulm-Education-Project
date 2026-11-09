# Bronchial branch tracing: plan from the lesion, map, navigate

Entry: `/en/learn/anatomy/branch-tracing`. Anonymous direct access, noindex, no catalog, search or sitemap listing. The module is unpublished.

**Rebuilt October 21, 2026** around the simplified bronchial branch tracing of Mortimer and Saghaie, _Lost in navigation: a simplified CT-based airway mapping method for ultrathin navigational bronchoscopy_, J Clin Med 2025;14:8009 ([doi](https://doi.org/10.3390/jcm14228009)). The October 9 rebuild (scope-first: match, identify, choose, drive at every fork) is kept for lessons 1 and 2 and for the drive itself; planning and the nested-arc map are new. Documents listed under [Earlier design records](#earlier-design-records) describe earlier courses.

## What the learner does

A lesion trip has three stages.

1. **Plan, from the lesion back** (`engine/plan-session.ts`).
   - _The airway into the lesion._ The learner clicks the airway that runs into the lesion. It counts within 3 mm of the route's own centreline over the last 20 mm before the lesion, in three dimensions, so an airway that runs along the slice counts all along it (`lesionVerdict`).
   - _Its segment._ The learner names the segmental bronchus from that lobe's segmental bronchi (`segmentChoices`).
   - _Views._ Turning or flipping the CT, and the coronal and sagittal reconstructions, are offered and never checked.
   - Until the segment is named, nothing on screen names it: the title, the route strip and the lesion picker give the lobe and slice only, and the map waits.
2. **Map** (`engine/arc-map.ts`).
   - _The ostium circle._ The learner labels the four rim positions of the view into the segment's ostium with superior, inferior, medial, lateral, anterior or posterior. Any roll of the right arrangement is accepted; a mirror image is refused (`gradeFrame`). A rim position between two directions accepts either word.
   - _The divisions._ At each division from the ostium to the lesion the learner draws each branch as an arc on one of eight sides of the current branch and marks the branch that goes on. A drawn branch counts when it is within 67.5° (the same or a neighbouring side) of where that branch leaves _relative to its siblings_, read in the ostium frame; drawn branches are matched to daughters by the closest overall fit (`gradeArcs`). The next division is drawn inside the marked branch.
   - _Review._ The learner's map beside the model's, with the star on the branch that reaches the lesion.
3. **Navigate** (`engine/nav-session.ts`, the scope-first bench).
   - Every fork is chosen at; no fork asks for its openings to be marked (lessons 1 and 2 still mark them).
   - Turning the CT to match the scope is asked for in lesson 1, and everywhere until the learner has finished lesson 1 or matched three forks on the first check. After that no fork waits for it: the CT stays as the learner left it, with **Check my turn** beside it. Kept on the device (`nav-storage.ts`, `orientation`).
   - Past the segmental ostium the middle pane shows the map beside the scope, zoomed on the current division, with **Turn the map to the scope** (`mapTurnToScope`); the CT is a tab away. The scope's rim reads Med, Lat, Ant, Post, Sup, Inf instead of R, L, A, P, Head, Feet.
   - **A turn that leads away.** Choosing an opening that leads away drives the scope into it, stopping 8 mm short of that branch's own next division (or short of where the model ends), looking at it (`geometry/astray.ts`). The learner backs out along the same path to the fork's exact waiting pose, and that opening is greyed. Wrong turns and back-outs are logged and summarised, in the closing set too.

| Section     | Address                 | What it is                                                                                                                   |
| ----------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Learn       | `/learn?lesson=<id>`    | Nine lessons, about 79 minutes.                                                                                              |
| Practice    | `/practice?lesion=<id>` | Thirteen simulated lesions: plan, map and drive each, help on request.                                                       |
| Closing set | `/assess?lesion=<id>`   | Three lesions in three lobes, no hints: a check says only whether it fits; openings are numbered but not named until chosen. |

Lessons, in order: `carina-orientation` and `two-levels` (reading the CT against the scope), `start-at-the-lesion`, `stand-at-the-ostium`, `nested-arcs` (planning from the lesion), `drive-with-the-map`, `views-that-help` (driving with the map), `turn-back`, `navigate` (the whole method).

## How it is built

All under `src/features/bronchial-branch-tracing/`.

| Layer          | Files                                                                                                                                                      | What it holds                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Route geometry | `geometry/route-stations.ts`, `geometry/paired-scope.ts`, `geometry/astray.ts`                                                                             | Where the scope waits at each fork, how it travels, and the turn into a branch that leads away and back out.        |
| The map        | `engine/arc-map.ts`                                                                                                                                        | The ostium frame, where each branch is drawn, how a circle and arcs are read, the nested layout, the turn to scope. |
| Planning       | `engine/plan-session.ts`, `engine/trip-session.ts`                                                                                                         | The planning reducer; a trip as planning then the drive.                                                            |
| Matching       | `engine/orientation-match.ts`                                                                                                                              | Which CT displays match the scope at a fork, and how a given display differs.                                       |
| Lumen verdict  | `engine/junction-feedback.ts`, `engine/response-planes.ts`, `geometry/answer-plane-air.json`                                                               | Which lumen a click is in, read from the CT's own air (lessons 1 and 2).                                            |
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

The Playwright spec includes the one-screen check: at 1440×900 and 1707×900, for the drive (match, identify, choose, a turn that leads away, drive), the planning bench (circle, divisions, review) and the drive past the ostium with the map beside the scope, every picture and control is inside the viewport, the page does not scroll and the bench reaches the bottom of the window.

## Open for the owner

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
