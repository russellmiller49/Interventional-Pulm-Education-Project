# Brief for Codex (Astra) — Bronchoscopy Foundations scope assets (part 1 of 2)

Extracted 2026-09-11 from the approved rebuild plan (owner: Russell Miller). The authoritative
shapes are `src/features/bronchoscopy-foundations/components/scope/types.ts` (the contract) and the
pane engine in `src/features/bronchoscopy-foundations/engine/scope/`, which loads your files. Where
this text and those files differ, the files win; ask Claude before changing either.

**Scope of this part: the assets only.** Part 2, the 3D scope pane (`components/scope/**` scene,
dock, readouts), follows once Claude commits the pane's seam (`ScopePane`, `ScopeFallback`,
`TreeMap`, `ScopeTestDouble`). Do not start it.

## Implementation note (read this first)

- **The teaching graph already exists** and is Claude's:
  `public/bronchoscopy-foundations/anatomy/adult-teaching-combined-left-basal-v1/graph.json`, built
  from case-001 by `scripts/bronchoscopy-foundations/build-teaching-graph.mts`. Node and edge ids are
  case-001's source ids, in patient LPS millimetres. It carries each edge's label, the three reviewed
  orientation landmarks and the ostial landmarks, so no separate `orientation.json` is needed. Do not
  edit or regenerate it; if the lumen needs a graph change, ask Claude.
- **How the engine uses the lumen.** `engine/scope/scopeCase.ts` loads
  `TEACHING_LUMEN_URL` (`…/adult-teaching-combined-left-basal-v1/lumen.glb`) through an injectable
  `loadCollider`, and the collider is `createLumenCollider` (`src/lib/airway-anatomy/lumen-collider.ts`,
  three-mesh-bvh) swept with the 1.9 mm tip radius (`FLEXIBLE_TIP_RADIUS_MM`, `drive.ts`). The same
  mesh is the display surface (display = collision).
- **Authored engine numbers your geometry must honour** (`engine/scope/scopeScripts.ts`,
  Claude-owned): the model larynx path puts the glottis plane 30 mm from its start and its exit ring
  45 mm from its start, where the trachea (graph node 0) begins; the endotracheal tube lies on the
  trachea's centerline (edge 0) from 35 mm (the scope's start) to 70 mm (the tube's end); the true
  folds take three states — `abducted` (breath in), `narrowing` (breath out), `adducted` (a scripted
  cough). If the anatomy needs different numbers, report them and Claude changes the constants.
- **Not this round:** a CT stack (the orientation section uses the existing `/airway-lesson` CT
  slices), variant profiles such as a tracheal bronchus or separate LB7 (owner decision D4), a tube
  or scope GLB (the scene draws both from numbers), and authored mucosal findings.

### B1. What you are building and why

The assets behind one simulator pane: the teaching lumen the scope drives through, a model larynx
it crosses into the trachea, the device dimensions the scene draws a tube from, and the accessory
tips whose protected and exposed states the learner must see. All are ordinary public static files
(owner decision D2): bundled in the standalone build like `public/peripheral-imaging`, with no access
rule, no Supabase upload, no rewrite and no `remoteAssetPrefixes` entry.

You own `public/bronchoscopy-foundations/anatomy/**` except `graph.json`; new asset-build scripts
under `scripts/bronchoscopy-foundations/` (Claude owns `build-teaching-graph.mts`,
`import-manifest.mts`, `check-*.ts` and `tsconfig.sections.json`);
`src/features/bronchoscopy-foundations/__tests__/scope-assets.test.ts`; and
`docs/bronchoscopy-foundations/scope-assets.md`. Never edit `content/**`, `engine/**`,
`components/scope/types.ts`, `src/features/learning-module/stage/**`,
`src/components/airway-anatomy/AirwayAnatomyModule.tsx`, `src/lib/site-auth/**`, routes or
`next.config.mjs`.

### B2. The asset contract

```
public/bronchoscopy-foundations/anatomy/
  manifest.json          every file below: path, bytes, sha256, provenance, asset record (B2.5)
  adult-teaching-combined-left-basal-v1/
    graph.json           Claude's; list it in the manifest
    lumen.glb            node PatientLpsLumen: one closed mesh, LPS mm, identity transform, Draco
    review/collision-review.json   routes-in-lumen result (B2.1), asserted by jest
  larynx/
    larynx-lumen.glb     UA_lumen, UA_epiglottis, UA_fold_true_L/R (morph target `adduct`),
                         UA_fold_false_L/R, UA_arytenoid_L/R, UA_subglottis, optional UA_skeleton
    larynx.json          the path the tip travels (B2.2)
  devices/
    devices.json         tubes and accessory placements (B2.3)
    accessories.glb      ACC_forceps_closed, ACC_forceps_open, ACC_brush_sheathed,
                         ACC_brush_exposed, ACC_needle_sheathed, ACC_needle_exposed
    handle.glb           optional: HANDLE_body, HANDLE_lever, HANDLE_suction
```

**B2.1 The teaching lumen.**

- Source: the reviewed case-001 lumen `public/airway-anatomy/case-001/lumen-v2.glb` (16 MB; its
  collision review in `docs/bronchoscopy-review/collision-review.json` found 0 of 8,294 centerline
  samples outside), or its source `airway_large.stl` (patient LPS mm, aligned with the CT and the
  centerlines) in the primary checkout's `new_anatomy_module/`. Both read-only.
- Trim: keep every airway in `graph.json`, extend at most three generations past each segmental
  origin (the graph navigates one), and cap every cut so the mesh stays closed. One connected
  component, consistent outward normals — the collider's inside test reads the first-hit face normal.
- Frame: vertices in patient LPS millimetres, the node's transform identity, no scene scale — the
  same coordinates as `graph.json`.
- Budget: ≤ 3 MB after Draco, ≤ 250k triangles, deviation from the source surface ≤ 0.3 mm (report
  the measured maximum and mean).
- Routes in lumen: every point of every edge in `graph.json` inside the lumen (`clearance ≥ 0` by
  `createLumenCollider`), plus the minimum clearance along each labelled airway's first segment; list
  the airways where it is below 1.9 mm, which free drive cannot enter. Follow
  `scripts/airway-anatomy/review-collision.mts` (GLTFLoader → `createLumenCollider` → advance and
  withdraw with `driveScope`, and a lateral step that stops at the wall). Write
  `review/collision-review.json`, including the lumen's sha256.
- Reference views: at graph.json's three orientation landmarks (edge 3 at 10 mm, RUL; edge 9 at
  6 mm, RML; edge 496 at 9 mm, LUL), render through `buildTransportFrames(graph, orientationLandmarks)`
  and compare with `docs/bronchoscopy-review/{rul,rml,lul}.png`: RB1 at the top of the RUL group, RB5
  to the left of RB4, the upper division above the lingula.

**B2.2 The model larynx.** An authored closed lumen from the oropharynx past the epiglottis and the
supraglottis to the glottis and subglottis, built around the cartilage and ligament skeleton in the
primary checkout's `anatomy_assets/Larynx.glb` (`updated full airway.glb` is a visual reference only).
The exit ring coincides with graph node 0 and follows edge 0's first segment, so the two lumens join
without a step (report the gap; ≤ 0.5 mm). The `adduct` morph drives the true folds: the scene uses
weight 0 for `abducted`, 0.5 for `narrowing` and 1 for `adducted`, so 0.5 must still leave a visible
opening and 1 must close it. `larynx.json`: `{ pathLps: [[x,y,z], …] (≤ 1 mm spacing), glottisMm: 30,
exitMm: 45 }`, the last point equal to graph node 0. Budget ≤ 1.5 MB.

**B2.3 Devices.** `devices.json` lists the endotracheal tubes as authored teaching values, not
manufacturer specifications: inner diameters 7.0, 7.5 and 8.0 mm, each with an authored outer
diameter and length. It also gives each accessory's authored tip offset beyond the scope tip for
`at-tip` and `extended` (`in-channel` is not visible). The scope's own diameter is not an asset: the
scene draws `state.inputs.scopeOdMm`, which the views author (3.8 mm by default; 6.0 and 6.2 in the
tube section). `accessories.glb` ≤ 450 KB, one node per accessory state in the contract;
`handle.glb` ≤ 500 KB if you make it.

**B2.4 Draco and tooling.** Compress with the repository's `gltf-pipeline` (4.3.1, draco3d 1.5.7)
or Blender's exporter; the browser decodes with `/fluoroview/draco/`, the decoder the FluoroView GLB
already uses. Blender and Slicer are installed in `/Applications`. No new dependencies, no CDN.

**B2.5 The asset record.** Each manifest entry carries `origin`, `creator_or_rightsholder`,
`license_or_permission`, `deidentification_status`, `clinical_reviewer`, `review_date`,
`anatomy_profile_id`, `camera_orientation_description`, `approved_use`,
`clinical_review_status: 'pending'` and `publication_permitted`. Leave the reviewer, the date and
`publication_permitted` for the owner (null or `'pending'`). Mark authored geometry and device sizes
as authored. No local paths, usernames or real names anywhere in a committed file — JSON, GLB
`extras` or docs.

**Hashing trap.** The commit hook runs prettier on every staged `.json`. Hash JSON after
prettier-formatting it (or compare parsed content), or the manifest will not match the committed
bytes; commit `d3213d4c` fixed the same trap for `graph.json`. The manifest pins `graph.json`'s hash
too, so a regenerated graph fails your test until Claude updates that entry — which is intended.

### B3. Hard rules

- Source data stays read-only in the primary checkout; scripts read it there and write only into
  your worktree. Never modify an open Slicer scene.
- Every number you author is labelled as authored in the record and in `scope-assets.md`.
- Budget for everything under `anatomy/`: ≤ 8 MB.
- Keep Claude's engine tests green: `scope-engine.test.ts` and `scope-walkthroughs.test.ts`.

### B4. Tests you own

`__tests__/scope-assets.test.ts` (node environment): every manifest file exists with its bytes and
sha256; per-file and total budgets; each GLB self-contained (no external `uri`), Draco-compressed
where required, and carrying the required node names; `lumen.glb` a single mesh whose bounding box
contains every `graph.json` node; `collision-review.json` with zero outside samples and the
committed lumen's sha256; `larynx.json` ending at graph node 0 within 0.5 mm, with `glottisMm` and
`exitMm` equal to `LARYNX_GLOTTIS_MM` and `LARYNX_LENGTH_MM` (import them read-only from
`engine/scope/scopeScripts.ts`); `devices.json` covering tubes 7.0, 7.5 and 8.0 and a node for every
`AccessoryState` other than `none`; no committed file containing `/Users/` or another local path.

### B5. Docs

`docs/bronchoscopy-foundations/scope-assets.md`: a provenance table, regeneration commands for each
file, budgets against measured sizes, the decimation deviation, the collision-review summary and the
interpretation limits (authored larynx, authored device sizes, trimmed lumen, pending review).

### B6. Order of work and what to report

1. **Spike (≈1 d): the teaching lumen.** `lumen.glb`, the routes-in-lumen check, the three reference
   views and the measured bytes, Draco decode time and BVH build time in the browser. **Report to
   Claude before continuing** — every drill rests on it.
2. The model larynx and `larynx.json` (≈2 d).
3. `devices.json`, `accessories.glb`, the optional handle (≈1–1.5 d).
4. `manifest.json`, `scope-assets.test.ts`, `scope-assets.md`; lint and type-check (≈0.5–1 d).

Git: a new worktree from the local branch `claude/intro-to-bronch-9-10` at or after the commit that
adds this brief, on branch `codex/bronch-foundations-scope`; small commits per step; PRs against
`claude/intro-to-bronch-9-10` once that branch is on origin (until then, report your commits to the
owner). Never commit to `main`; stage specific reviewed paths only.

---

# Part 2 of 2 — the 3D scope pane (`components/scope/**`)

Added 2026-09-11 after the seam landed on `claude/intro-to-bronch-9-10`. Part 1's assets are merged
into that branch (`dbe42220`); the larynx junction remains an owner decision (see
`scope-assets.md`). Start part 2 from the branch head that carries this section.

## Implementation note (read this first)

- **The seam is in.** `components/scope/types.ts` is the contract (read every comment again: it
  changed since the plan — the pane sends **commands**, `OstiumPin.inView` is the round field
  inscribed in the 4:3 frame, and there are seven modes, not ten). `ScopePane.tsx` routes a view
  to your `ScopeScenePane` when `SCOPE_MODES_READY` has its mode and to `ScopeFallback` otherwise.
  `ScopeScenePane.tsx` is a stub that renders the fallback; **you replace its body and grow
  `SCOPE_MODES_READY` one mode at a time**. Keep its two re-exports (`resolveScopeInputs`,
  `scopeViewErrors` from `engine/scope/`).
- **`ScopeFallback.tsx` is the reference implementation of the DOM contract.** It is DOM-only and
  honours every prop and data attribute; the flow tests mount it (through `ScopeTestDouble`) and
  never mount your scene. Read it before writing a line: the ids the dock's controls carry
  (`scopeControlId(key)`, plus `accessory-move` and `declare-<label>`), the readouts
  (`scopeReadouts`), the inspection record (`inspectionRecords`, `ledgerStatus`,
  `declarationAllowed`, `LEDGER_CAVEAT`), the goals list, the boundary line, the caption strip and
  the tree answer fieldset. Your scene may reuse `LocationCaptionStrip`, `TreeAnswerFieldset` and
  `TreeMap` as they are; it must produce the same attributes where it draws its own.
- **The host reduces; you render.** Every learner action is `onCommand(command, inputMode)`. The
  scene never integrates position, never re-rolls, never mutates `state`. The camera is
  `scopeOpticalFrame(state.pose)` and nothing else; a unit test you own asserts that every
  projected pin equals `projectOptical(ostium.pointLps, frame, OPTICAL_ASPECT, OPTICAL_FOV_DEG)`
  (both constants in `engine/scope/scopeOstia.ts`).
- **Simulated time is a command.** The host holds no clock. While a script animates (the larynx
  breath cycle, the D10 hold), the pane sends `{ type: 'tick', seconds }` at wall-clock rate from
  `useScopePlayback`; with reduced motion, or whenever the view lists `step`, a visible **Step**
  control sends one second per press. Never tick while `controlsEnabled` is false.
- **Reuse the primitives, do not fork them.** `src/components/airway-anatomy/scope-primitives/`
  now exports `AirwaySurface` (pass `dracoDecoderPath="/fluoroview/draco/"` for the teaching
  lumen), `ScopeCamera`/`updateScopeCamera` (pass `fovDeg={OPTICAL_FOV_DEG}`),
  `BronchLabelOverlay`/`projectToViewport` (use `renderPin` to draw a pin as
  `<label htmlFor={treeChoiceInputId(...)}>` or as an align button), `ScopeBody`/`Polyline`,
  `SteeringRing`/`HoldButton`/`useHoldRepeat`, `useElementSize`, `AdaptiveViewportQuality`. The
  pure ostia helpers are in `src/lib/airway-anatomy/ostia.ts`. Changing any of them changes the
  admin module's captures; if you need a change, ask.
- **Where to see it.** `npm run dev:claude` (:3120), then
  `/en/bronchoscopy-foundations/learn?section=five-controls` (bench), `branch-entry` (guided walk),
  `view-loss` (free drive + red-out), `larynx-and-entry`, `scope-in-a-tube`,
  `protected-accessories`. No sign-in: the route is public-unlisted. Until a mode is in
  `SCOPE_MODES_READY` you will see the fallback there.

### B1. What you are building and why

The simulator pane of every Learn section: the airway tree with one explicit normal profile,
driven by five distinguishable controls and read back through an inspection record that never
confuses passing a boundary with inspecting a wall. You own `components/scope/**` **except**
`types.ts`, `ScopePane.tsx`, `ScopeFallback.tsx`, `TreeMap.tsx`, `TreeAnswerFieldset.tsx`,
`LocationCaptionStrip.tsx`, `scope-fallback.module.css`; the Playwright scene harness under
`scripts/bronchoscopy-foundations/` (`scope-harness.html` + a spec, in the shape of
`scripts/peripheral-imaging/suite-harness.html`); your own `__tests__/{sceneDom,scenePins}.test.tsx`;
and `docs/bronchoscopy-foundations/scope-pane.md`. Never edit `content/**`, `engine/**`,
`components/stage/**`, `test-support/**`, `learning-module/stage/**`,
`src/components/airway-anatomy/**`, `src/lib/airway-anatomy/**`, `site-auth/**`, routes or
`next.config.mjs`.

### B2. The contract

`components/scope/types.ts`, verbatim. Additive fields are fine; tell Claude before relying on
one. The DOM contract (`SCOPE_DOM`) is what the flow tests, the e2e suite and the host read:

- `[data-scope-scene][data-scope-mode][data-scope-state=ready|failed|fallback][data-anatomy-profile]`
- the optical canvas host carries `data-three-state="ready"` once it has drawn
- `[data-view-signal=clear|red-out|contaminated|dark]` on the optical view — **name what is seen,
  never why** (the fallback's `VIEW_SEEN_WORDS`): a section's deny patterns forbid the cause
- `[data-airway-map] [data-airway-pin=<label>]`, the current airway `aria-current="location"`;
  pins show the short label and carry no full-name `title` before commit (a full name leaks)
- `[data-tree-answer]` fieldset with `treeChoiceInputId` inputs; rows `[data-off-tree]`;
  `[data-tree-outcome]` after commit
- `[data-readouts] [data-readout=<metricId>]` with `SCOPE_METRIC_LABELS` and `formatScopeMetric`
- `[data-inspection-ledger] [data-ledger-row=<label>][data-ledger-status=<status>]`
- `[data-input-mode]`, `[data-assists-used]`; every control `id={scopeControlId(key)}`;
  `[data-model-boundary]` printing `view.boundary` verbatim (the section authors it; you do not)
- `data-scope-controls` on the dock, disabled when `controlsEnabled` is false, with
  `lockedReason`/`pausedReason` printed in a `role="status"`
- `data-spotlight="true"` on the control whose key equals `spotlightKey`

### B3. Hard rules

- Every frame derives from the engine (camera = `scopeOpticalFrame(state.pose)`); the scene never
  integrates position or re-rolls; pins are projected with the engine's aspect and field of view.
- No new dependencies, no CDN; the Draco decoder is `/fluoroview/draco/`.
- One WebGL context per pane: observer, bench, tube-cutaway and larynx views are drei `<View>`s in
  one `<Canvas>`; the airway map stays SVG (`TreeMap`). `frameloop="demand"`; `"always"` only
  while a drive or script animates; `"never"` when offscreen. `dpr` `[1, 1.5]`.
- Reduced motion → a visible Step button and no autonomous animation.
- Assists reach the engine only as commands (`align-to-branch`, `recenter`, `teleport-to-start`,
  `branch-labels`); the scene never applies one itself.
- Pins that answer are `<label htmlFor>` portaled outside the `role="img"` host; a `role="img"`
  hides its children from assistive technology, so use `role="group"` where live controls sit
  inside the field (the fallback does).
- `WebGLContextGuard` remount on context loss; `data-scope-state="failed"` with a message when the
  lumen cannot load; jest has no WebGL — your RTL tests mock the canvas.
- Every learner-facing string passes the copy gate (`content/learnerCopy.ts`): no score, points,
  grade, percent, %, pass, fail, mastery, exam, test, quiz, assessment, certification, competent,
  correct, incorrect, wrong, route, seed, engine, query, reducer. Say "decision held / did not
  hold", "check", "the airway path".

### B4. Files (under `components/scope/`)

`ScopeScenePane.tsx` (grow `SCOPE_MODES_READY`; keep the re-exports) · `ScopeScene.tsx`
(`next/dynamic`, `ssr: false`, the one `<Canvas>`) · `ScopeOpticalView.tsx` (`AirwaySurface`
`mode="bronch"` on the teaching lumen, `ScopeCamera`, `BronchLabelOverlay` with `renderPin` for
the in-view `state.ostia` pins — only those with `inView`, only labelled when
`state.inputs.branchLabels` — a `LensStateOverlay` for the vignette and aperture (EBUS `optics.ts`),
the red-out tint from `state.signals.view`, the contamination decal from `state.script`) ·
`ObserverView.tsx` (bench, tube cutaway, larynx sagittal cutaway, tree-in-3D for `idle`) ·
`ScopeDock.tsx` + `useScopeKeyboard.ts` (the dock renders one control per key in `view.controls`
with the contract ids; keys: W/S advance/withdraw by `state.inputs.stepMm`, A/D rotate ±5°, ↑/↓
deflect ±5°, Space suction, R recenter, Home teleport-to-start, L labels, C capture, K
acknowledge; every command tagged `'keyboard'`, pointer presses `'pointer'`, touch `'touch'`;
author the map as data in `scopeKeyMap.ts` — `scope-primitives/keyMap.ts` is the admin module's
and stays untouched) · `ScopeReadouts.tsx` (`scopeReadouts`) · `InspectionLedgerPanel.tsx`
(`inspectionRecords`, `ledgerStatus`, `declarationAllowed`, `DECLARATION_MESSAGES`, `LEDGER_CAVEAT`)
· `TubeModel.tsx` (from `devices.json`, along edge 0 from `TUBE_START_MM` to `TUBE_TIP_MM`; the
scope's diameter is `state.inputs.scopeOdMm`) · `AccessoryTip.tsx` (`accessories.glb` nodes, +Z
forward, origin at the distal-most point, offsets from `devices.json`: `at-tip` and `extended`;
`in-channel` hidden) · `LarynxLumen.tsx` (`larynx-lumen.glb`; `adduct` morph weight 0 / 0.5 / 1 for
`abducted` / `narrowing` / `adducted` from `state.inputs.cords`; the tip travels `larynx.json`'s
path by `state.depthMm`; the wall shells are display only — never a collider) · `HandleModel.tsx`
(optional) · pure `scopeSceneModel.ts` · `useScopePlayback.tsx` (Step, reduced motion, the tick
sender, a drive-queue integrator ≤ 24 mm/s that turns a held advance into `advance` commands of
`stepMm`) · `WebGLContextGuard.tsx`.

### B5. Modes (`SCOPE_MODES`)

`idle` (the scope at rest; the map and the caption; no controls) · `controls-isolated` (the bench:
the tip outside the model; hold depth and rotate → the image rolls and the bending plane turns;
hold rotation and deflect → one plane; then advance and withdraw; suction as an indicator) ·
`guided-walk` (centerline-locked, the aim guard refuses an undecided fork; a wrong aim is refused,
not corrected — the engine already does this; you draw where the tip is) · `free-drive` (the tip
against the collider; red-out when the lens is on the wall; the same drills unaided) ·
`larynx-entry` (oropharynx → epiglottis → folds → subglottis; the folds follow the scripted
breath cycle; crossing emits `entered:TR` and hands off to the trachea) · `tube` (the procedural
tube along edge 0 with the annulus readouts, labelled geometric) · `accessory` (a visible target
and the accessory's protected and exposed states; the assistant-misreport script's speech is in
`state.message`, already marked scripted).

### B6. Assets (part 1, merged)

`public/bronchoscopy-foundations/anatomy/manifest.json` inventories everything.
`adult-teaching-combined-left-basal-v1/lumen.glb` (node `PatientLpsLumen`, LPS mm, identity,
Draco; display = collision; the host builds the collider through `createLumenCollider` with the
same geometry `loadAirwayStlGeometry(url, { dracoDecoderPath })` decodes — share that geometry,
do not decode twice). `larynx/larynx-lumen.glb` + `larynx.json` (91 path points, exit at graph
node 0; the unresolved 2.4 mm ring gap is an owner decision — draw it as authored; do not widen
the source). `devices/devices.json`, `devices/accessories.glb` (six `ACC_*` nodes).

### B7. What you do not author

Boundary sentences (each view's `boundary`), the goals, the scripts' words (`SCOPE_MESSAGES`,
`SCRIPT_REPORTS`), the readout labels, the caption, the ledger words: all Claude's, all printed
verbatim. Anything the pane says that is not in the engine or the view spec is a bug.

### B8. Order of work and what to report

1. **Pane shell + `guided-walk`** (≈2.5 d): `ScopeScene` with the teaching lumen, `ScopeOpticalView`,
   the dock, the readouts, the map; `SCOPE_MODES_READY = {'guided-walk'}`; `branch-entry`,
   `right-side`, `left-side` and `systematic-survey` walkable in the browser. Report **S2**:
   screenshots at 1440×900 and 390×844, decode/BVH timings, the pin-projection test green.
2. **`free-drive` + the loss-of-view scripts + D10 hold/drift** (≈2 d) → **S3** (`view-loss`,
   `branch-entry`'s Observe).
3. `controls-isolated` (1.5 d) → `tube` + `accessory` (2 d) → `larynx-entry` (2.5 d), each merged as
   it lands.
4. Harness e2e (`data-scope-state=ready`, pixel signal, rotate → image rotates while pins and the
   record are unchanged, deflect → a pin moves, advance into RUL → `entered:RUL`, red-out → recovery,
   tube readouts, reduced motion + Step, context recovery, one live context across mode
   switches), `scope-pane.md`, lint/type-check/build (1.5 d).

Gates before every commit: `npx tsc --noEmit -p tsconfig.json`; `npx eslint
src/features/bronchoscopy-foundations/components/scope`; `npx jest src/features/bronchoscopy-foundations
--runInBand` (every existing suite stays green — the stage-host and leak suites never mount your
scene, the fallback suite must keep passing on `ScopePane` routing); `npm run build` before a PR.
Git: continue on `codex/bronch-foundations-scope` rebased onto `claude/intro-to-bronch-9-10` at the
commit carrying this section; PRs against that branch once it is on origin; never `main`; stage
reviewed paths only.
