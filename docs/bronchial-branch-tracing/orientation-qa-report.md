# CT orientation and paired bronchoscopy QA

September 11, 2026 · content `c4-orientation1-r1` · base `1ea857d8` · unpublished, anonymous direct URL. This is engineering and source-image review, not faculty approval or validation of bronchoscopy competence.

## Delivered learner journey

Each worked example opens with actual before/after CT thumbnails, a marked parent lumen, patient-direction letters and a source-grounded explanation of the applicable reflection or rotation. The interactive CT starts standard. The learner rotates left/right in quarter turns, reflects left–right, or resets. The paired virtual bronchoscopy is always present, with an expanded view for detail. It uses the existing airway surface and renderer from the same CT patient.

In Learn, the learner checks an orientation before marking the lumen. A wrong choice receives feedback after submission and requires manual correction. The first choice survives correction. Three airway marks, a course and an airway–nodule interpretation still precede reference crosses. Transfer starts standard with a new target and requires its own orientation choice and trace. All eight lessons retain their source concepts and nomenclature.

Practice/Assess accept the actual chosen orientation without early correctness feedback. Revising it retains the first choice. Debrief compares the recorded display choice with the textbook convention, and the JSON worksheet exports both. Existing participation storage is retained, with a new version that leaves prior participation as history. Detailed orientation/coordinate responses remain session-only; unfinished work restarts on reload.

## Geometry and clinical interpretation

The same unmodified native CT and nodule patches remain in use. New image-space transforms cover all eight combinations of quarter turns and reflection; patient-space marks remain fixed. Reflection after rotation swaps the current screen's left and right. Tests independently check direction letters, inverse coordinate recovery and noncommuting operations.

`build-paired-routes.mjs` extracts 69 unchanged polylines from the hash-pinned source graph for the 17 routes. The paired camera follows the selected route at the axial plane, approximately 4 mm proximal, looking distally. At a selected checkpoint, a point within the 0.5 mm acquisition slice is eligible, so distinct proximal/distal RB5 positions in slice 307 remain distinct. Other crossings are selected by proximity along the route to the selected checkpoint, not by apparent screen position. A plane outside the route reports the measured separation. Source coordinates and direction vectors are tested for every checkpoint.

The virtual view is a CT segmentation, not recorded mucosa. An axial display transform does not produce an endoscopic projection; both the teaching and viewer explain that branch relationships still require reasoning from the parent. Near a distal route endpoint, the viewer identifies the model limit and explains that a closed surface does not establish an obstruction. Reference camera roll follows the book: project anterior upward for caudal tracing; project patient left upward for RUL, and patient right upward for left upper division, placing the lateral chest wall below during apical viewing. If that reference axis is nearly parallel to a horizontal parent, project superior upward instead. Independent camera-frame tests verify that ideal cranial/caudal viewing projects patient directions onto the same screen axes as the corresponding CT convention. Rotating the learner's CT does not roll this reference camera. The secondary free explorer retains its existing roll controls. These camera poses are geometric teaching comparisons and are not clinically approved scored checkpoints.

The supplied textbook was inspected visually at printed p. 5, Figures 1.5–1.7, together with the prior orientation and nomenclature review. Middle/lingula/lower-lobe caudal tracing uses horizontal reflection, RUL uses 90° counterclockwise, and left upper division uses 90° clockwise. No textbook image is distributed.

## H1–H12

| Rule                    | Result               | Evidence                                                                                                                                                                                                                                    |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1 One curriculum       | PASS                 | Existing registry, Overview/Learn/Practice/Assess, resolver, URLs and secondary free explorer retained.                                                                                                                                     |
| H2 Teach before testing | PASS                 | Rendered before/after CT demonstration, guided orientation, real tracing, feedback and changed-target transfer.                                                                                                                             |
| H3 Shared stage         | PASS                 | Existing StageLayout with Steps/Teaching/Simulator, fractions 0.26/0.29 and floors 300/280/340. Current ventilation host inspected and rendered at the same viewport.                                                                       |
| H4 Current task         | PASS                 | One NowCard; orientation action precedes tracing; visible authored location points to the visual explanation and CT tracing stack.                                                                                                          |
| H5 Visible teaching     | PASS                 | Orientation figures render in the worked phase; pending views show instructions and simultaneous CT/bronchoscopy.                                                                                                                           |
| H6 Real completion      | PASS                 | A display operation and orientation response precede mark placement. Transfer resets orientation and marks. Completion still requires manual Finish.                                                                                        |
| H7 Actual responses     | PASS                 | Wrong Learn choice survives correction; wrong independent choice survives export. Expected convention and reference crosses are withheld in pending independent responses.                                                                  |
| H8 Fidelity             | PASS for engineering | Existing signed-CT images, nodule compositor results, anatomical labels and airway mesh unchanged. Eight display states invert exactly; all paired source points verified. Clinical camera validation remains outside this preview's claim. |
| H9 Progress             | PASS                 | Existing bounded activity store, historical versions retained, no mastery score, unfinished-session restart unchanged.                                                                                                                      |
| H10 Language            | PASS                 | Explicit rotate/reflect instructions and patient directions; segmentation and axial/endoscopic projection distinctions stated.                                                                                                              |
| H11 Scope/release       | PASS                 | Only feature, generator, tests and docs changed. No auth, catalog, database, shared stage, source volume, upload, deployment or merge change.                                                                                               |
| H12 Rendered experience | PASS for engineering | Full lesson/independent workflows, source/model load recovery, real WebGL rendering, same-plane movement, viewport and keyboard checks; see commands below. Native screen-reader and clinical learner validation were not performed.        |

## Verification

The representative RB5 pilot passed real-handler orientation/mark/transfer tests before the same implementation was extended to both independent modes. The expanded RUL and left-upper-division views and reflected middle-lobe view were opened and inspected. Images stay side by side on desktop; narrow panes stack them at readable sizes. Expand both views enlarges the paired panel; smaller fullscreen windows can scroll to the remaining controls. This preserves the shared lesson workspace rather than changing its layout engine.

- [Desktop lesson and visual explanation](review/orientation-lesson.png)
- [Reflected CT with virtual bronchoscopy](review/orientation-mirror-pair.png)
- [RUL counterclockwise comparison](review/orientation-rul-pair.png)
- [Left upper division clockwise comparison](review/orientation-upper-pair.png)
- [Current shared ventilation reference](review/orientation-ventilation-reference.png)

The final camera-roll revision passed:

```sh
npx jest src/features/bronchial-branch-tracing src/features/learning-module src/lib/bronchoscopy-core/core.test.ts src/lib/site-auth/access.test.ts src/lib/draft-modules.test.ts src/lib/airway-anatomy/geometry.test.ts src/lib/airway-anatomy-lesson/airway-graph.test.ts --runInBand
npx eslint src/features/bronchial-branch-tracing e2e/branch-tracing.spec.ts scripts/branch-tracing/build-paired-routes.mjs scripts/branch-tracing/browser-metrics.mjs
npx next build --webpack
npm run prepare:standalone
BRANCH_TRACING_BASE_URL=http://127.0.0.1:3112 npx playwright test --config playwright.branch-tracing.config.ts
BRANCH_TRACING_BASE_URL=http://127.0.0.1:3112 node scripts/branch-tracing/browser-metrics.mjs /tmp/branch-orientation-browser-metrics.json
```

- **24 Jest suites / 222 tests passed.** Includes real lesson handlers, wrong-first-orientation preservation, completion/review controls, all eight transforms, source provenance, every paired checkpoint, camera-frame axes, original CT and nodule pixels, shared stage/progress and draft access regressions.
- **16 Playwright checks passed** on the final packaged runtime (1.1 min). The suite completes all eight lessons and their transfers, the independent four-target set and a selected-segment phone case; it exercises original/nodule viewing, real image coordinates, source/model failures, WebGL context recovery, initial standard display, explicit wrong orientation, delayed feedback and worksheet export. A framebuffer check confirms that the paired canvas rendered airway pixels, beyond merely mounting a canvas.
- **ESLint and production TypeScript/build/standalone packaging passed.** A standalone `tsc --noEmit` also passed during implementation. Existing metadataBase and Mermaid build notices remain outside this feature. The unchanged embedded trainer outputs were repackaged; their engines were not rebuilt or altered for this revision.
- The shared initial-layout audit passed at **1440×900, 1280×720, 1024×768, 900×800 and 390×844**. The browser suite also verified 320 px and equivalent 200% reflow. Screenshot review was performed separately from the structural smoke test, waiting for the virtual airway to render.
- [Final browser measurements](orientation-browser-metrics.json): in a fresh Chromium context at 20 Mbps down/5 Mbps up/40 ms emulated latency, native CT was ready in **1,540 ms** and both views rendered in **2,950 ms**. Transfer at paired readiness was **4,265,639 bytes**, including one existing airway model request. The initial view is now the parent airway, so no nodule patch is needed at that plane. Ten slice actions took **3–280 ms**, including Playwright overhead. No page errors or horizontal overflow in equivalent 200% reflow. These are local measurements, not a device benchmark.

The reviewed version is served locally at `http://127.0.0.1:3112/en/learn/anatomy/branch-tracing`. No public deployment or merge occurred. Geometry-derived camera positions and branch conventions remain subject to clinician review before any scored clinical use.
