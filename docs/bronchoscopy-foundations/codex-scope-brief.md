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
