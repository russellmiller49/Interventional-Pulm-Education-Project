# Bronchial branch tracing: scope-first navigation

Entry: `/en/learn/anatomy/branch-tracing`. Anonymous direct access, noindex, no catalog, search or sitemap listing. The module is unpublished.

**Rebuilt October 9, 2026.** The earlier course asked the learner to mark airway lumens on the CT slice by slice, lesson after lesson. The owner asked for the teaching to be turned round: start from the bronchoscopic view, make the learner turn the CT to match it, identify which airway is which on the CT, and use branch tracing to navigate to a lesion. Everything below describes the rebuilt module. Documents listed under [Earlier design records](#earlier-design-records) describe the course it replaced.

## What the learner does

A virtual bronchoscope sits beside the axial CT. At every fork:

1. **Match.** The scope shows where the patient's right, left, front and back are in its view. The learner turns or flips the CT (quarter turns and a left–right flip) until the letters sit on the same sides.
2. **Identify.** The learner finds each numbered opening's lumen on the CT, scrolling to the slice where it leaves the parent, and clicks it. The result says which lumen the click landed in.
3. **Choose.** The learner picks the opening that leads toward the lesion. An opening that leads away is refused at the fork, with the reason.
4. **Drive.** The scope advances to the next fork and the CT follows its tip.

Any step can be shown on request; nothing blocks.

| Section     | Address                 | What it is                                                                                                                                      |
| ----------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Learn       | `/learn?lesson=<id>`    | Eight lessons, about 66 minutes. Each is one or two short trips along a route.                                                                  |
| Practice    | `/practice?lesion=<id>` | Thirteen simulated lesions. Whole routes from the trachea, help on request.                                                                     |
| Closing set | `/assess?lesion=<id>`   | Three lesions in three lobes. Openings are numbered but not named until chosen; a missed mark is told what it landed in, not which way to move. |

Lessons, in order: `carina-orientation`, `two-levels`, `middle-lobe-flat` (horizontal–horizontal), `rb5-up-or-down` (horizontal–vertical), `look-up-rul` (vertical), `oblique` (horizontal–oblique), `turn-back`, `navigate`.

## How it is built

All under `src/features/bronchial-branch-tracing/`.

| Layer          | Files                                                                                                                              | What it holds                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Route geometry | `geometry/route-stations.ts`, `geometry/paired-scope.ts`                                                                           | Where the scope waits at each fork, how it is rolled, how it travels between forks.                         |
| Matching       | `engine/orientation-match.ts`                                                                                                      | Which CT displays match the scope at a fork, and how a given display differs.                               |
| Lumen verdict  | `engine/junction-feedback.ts`, `engine/response-planes.ts`, `geometry/answer-plane-air.json`                                       | Which lumen a click is in, read from the CT's own air.                                                      |
| Fork facts     | `engine/fork-facts.ts`                                                                                                             | Where each opening sits in the scope, which way it runs, which slice it is identified on.                   |
| Session        | `engine/nav-session.ts`, `engine/nav-storage.ts`                                                                                   | The reducer for one trip, and the place kept on the device (`branch-tracing.nav-v1`).                       |
| Content        | `content/nav-lessons.ts`, `content/bench-copy.ts`, `content/junction-feedback.ts`, `content/course-guide.ts`, `content/targets.ts` | Lessons, every sentence the bench says, thirteen written fork explanations, the reference, the lesion list. |
| Bench          | `components/NavigationBench.tsx`, `ScopeView.tsx`, `ScopeCanvas.tsx`, `TracingCtViewer.tsx`                                        | Scope, CT and task on one screen.                                                                           |
| Hosts          | `components/NavLessonHost.tsx`, `NavRouteHost.tsx`, `BranchTracingOverview.tsx`                                                    | Lessons, routes, the hub.                                                                                   |

The source export is unchanged: `geometry/branch-decisions.json` (17 routes, 128 fork decisions over 57 forks), `geometry/paired-routes.json`, the native CT in `public/branch-tracing/native-v1` and the lesions in `public/branch-tracing/targets-v1`.

### Rules the geometry follows

- **Scope roll** (`scopeUp`). Looking down an airway: anterior at the top. Looking along a horizontal bronchus: the head at the top. Looking up an airway inside an upper lobe: the lateral chest wall at the bottom, which is how Kurimoto and Morita display the right upper lobe and the left upper division; looking up anywhere else: anterior at the top.
- **Where the scope waits** (`stationCamera`). 8 mm short of the fork, aimed between the openings. Farther back (to 20 mm) when a wide airway would put the openings at the rim, and nearer when the fork before is closer than 8 mm: it always stays inside the parent airway.
- **What matches** (`matchOrientation`). A patient axis counts when at least half of it lies across the scope's line of sight. A display matches when every such axis points the same way on both pictures. When the scope looks along the slice, one CT axis runs into the picture and either way round is accepted for it. When the scope looks at an angle that lays both CT axes along one edge of its view, no display matches exactly: the bench sets the closest one and says so, and the match is not asked.
- **Where a daughter is identified** (`responsePlane`). On the export's own response plane, except the tracheal bifurcation, which is identified on slice 372 where the carina shows (`RESPONSE_PLANE_OVERRIDES`).
- **What a click is in** (`optionVerdict`). The click's air region is flood-filled to 12 mm; it is in the named airway whose centre that region reaches and is nearest. Four small distal daughters have no air under their centre at the threshold; there the nearest centre within 3 mm decides. A mark the bench places itself goes in the air nearest the daughter's centre (`responseLumen`).
- **What is asked at a fork** (`defaultSteps`, `routePlan`). A fork whose lumens are under 5 mm² on their slices is chosen at, not marked. On whole routes the trachea and main bronchus are chosen, not marked.

## Run and check

```sh
npx next dev --port 3127 --webpack          # or the launch entry `claude-bbt-nav`
npx jest src/features/bronchial-branch-tracing
BRANCH_TRACING_BASE_URL=http://localhost:3127 npx playwright test -c playwright.branch-tracing.config.ts
npx tsx scripts/branch-tracing/orientation-match-report.ts            # the match at every fork
node scripts/branch-tracing/build-answer-plane-air.mjs --report      # lumen size and threshold margin per daughter
node scripts/branch-tracing/build-answer-plane-air.mjs               # regenerate the air masks
```

The Playwright spec includes the one-screen check: at 1440×900 and 1707×900 the scope, the CT, every CT control and the task buttons are inside the viewport in each state, and the page does not scroll.

## Open for the owner

These were decided by the build and are easy to change:

1. The tracheal bifurcation is identified on slice 372 everywhere (lessons, Practice and the closing set).
2. An opening that leads away from the lesion is refused at the fork. The scope does not drive into it and come back: 46 of those branches have no centreline in `paired-routes.json`.
3. The scope's roll follows the three-part rule above. It is a rule for a teaching model, not a recording of how any one operator holds the scope.
4. Thirteen forks have a written slice-by-slice explanation (`content/junction-feedback.ts`). The others show their computed levels and directions only.
5. The "looking up, turn and do not flip" teaching in lesson 1 follows from the geometry and the book's right upper lobe display; it has not been checked line by line against Kurimoto and Morita pp. 4–8.

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
