# Bronchoscopy Foundations scope assets

The part-one assets, build scripts and technical review are implemented. The larynx-to-trachea
junction remains unresolved: the authored exit ring misses the unchanged source surface by up to
2.4168 mm, beyond the brief's 0.5 mm limit. The manifest and tests preserve this pending status.
Clinical review, rights confirmation and publication permission remain pending for every asset.
The optional handle and the part-two production scope pane are not included.

## Lumen spike handoff

The teaching lumen is one closed, outward-oriented component in patient LPS millimetres, with an
identity transform on `PatientLpsLumen`. Display and collision use the same decoded geometry.

| Measurement                                           |        Result |       Requirement |
| ----------------------------------------------------- | ------------: | ----------------: |
| Compressed lumen                                      | 489,888 bytes | ≤ 3,000,000 bytes |
| Triangles                                             |       200,262 |         ≤ 250,000 |
| Connected components / non-manifold edges             |         1 / 0 |             1 / 0 |
| Stored graph samples inside                           |     694 / 694 |               All |
| Additional route samples inside, at 0.25 mm intervals | 4,262 / 4,262 |               All |
| Maximum retained-surface displacement bound           |   0.000188 mm |          ≤ 0.3 mm |
| Mean corresponding-vertex displacement                |   0.000099 mm |            Report |
| Wall-stop clearance, 1.9 mm tip radius                |   1.957872 mm |          ≥ 1.9 mm |
| Cold browser Draco decode and GLTF parse              |       69.3 ms |            Report |
| Browser BVH construction                              |       46.2 ms |            Report |

The source contains 673,216 triangles. Trimming retains the original surface through half the
second generation beyond segmental origins; the graph traverses one generation. Source-centerline
ownership limits deletion to distal surfaces, and 68 simple cut rims are closed with authored
triangle fans. No decimation, smoothing, voxel remeshing or airway widening is applied. Stable rim
ordering produces the same GLB hash in repeated builds.

Deviation is measured against the **retained** source surface. The harness matches all 100,133
vertices and verifies every oriented triangle before and after Draco. With unchanged triangulation,
the maximum corresponding-vertex displacement bounds the displacement of every point on each
triangle in either direction. The reported mean is a vertex mean, not an area-weighted surface mean.
The 1,507 authored cap triangles replace removed distal passages; they cannot represent the
original surface. Their centroid distances from that surface have a maximum of 0.800419 mm and a
mean of 0.540704 mm, reported separately and excluded from the retained-surface deviation bound.

`adult-teaching-combined-left-basal-v1/review/collision-review.json` pins the lumen, graph and source
hashes. Its runtime checks use `GLTFLoader`, `/fluoroview/draco/`, `createLumenCollider` and
`driveScope`. They advance 5 mm, withdraw along the recorded path, and sweep a 50 mm lateral command
into the wall. Browser timings are one cold headless Chromium observation, including decoder
initialization and one worker; they are not a cross-device performance guarantee.

The minimum clearance over the first labelled segment falls below 1.9 mm in TR, RUL, RLL, RML,
LB6, RB2, RB1, RB6, RB4, RB5, LB4+5, LUL-UD, RB7, LB4, LB5, LB3, LB1+2, LB9, LB7+8, RB8, RB9,
RB10 and LUL. These complete centerline segments cannot accommodate the default rigid tip sphere
at every point. This does not mean their ostia cannot be approached or identified. The JSON lists
the actual minima for all 29 labels; no airway was enlarged to make a drill pass.

The three committed optical views use `buildTransportFrames(graph, orientationLandmarks)` at edge
3 / 10 mm, edge 9 / 6 mm and edge 496 / 9 mm. They preserve RB1 above RB2/RB3, RB5 left of RB4,
and the upper division above the lingula. The harness asserts these projected relationships and
also renders the original mesh at the same frames into the disposable cache. Visual comparison
with `docs/bronchoscopy-review/{rul,rml,lul}.png` retains those relationships. The review harness's
procedural tissue appearance is an authored rendering aid, not a mucosal finding.

## Larynx and junction

`larynx/larynx-lumen.glb` contains `UA_lumen`, `UA_subglottis`, `UA_epiglottis`, paired true and false
folds, paired arytenoids and the optional `UA_skeleton`. The supplied cartilage/ligament GLB is
read without modification. Its epiglottis and arytenoids are reused with authored registration;
the remaining framework is grouped under `UA_skeleton` with `extras.defaultVisible: false`.

Registration places the source vocal-ligament centroid at the authored 30 mm glottis plane, scales
the cricoid reference to 18 mm lateral by 16 mm anteroposterior, and places the superior epiglottis
edge at path distance 5 mm. These are model choices, not anatomical measurements or patient
registration. The JSON records the source hash, registration, basis and cross-section stations.

The mucosal lining is authored around that framework. `UA_lumen` and `UA_subglottis` are watertight
**wall shells with patent luminal end rings**, rather than air-volume collision meshes capped
across the passage. Their wall thickness is an authored 0.75 mm. The engine scripts laryngeal
passage; do not pass these wall shells to the teaching lumen's inside-volume collider. This
geometry distinction must be retained when the production scene is integrated.

`larynx.json` contains 91 path points at approximately 0.5 mm intervals. The endpoint is exactly
graph node 0; the glottis and exit distances are 30 and 45 mm, checked against the engine constants.
The straight authored path follows the engine's proximal two-millimetre tangent on edge 0, avoiding
the source's rounded 0.01 mm initial samples. Paired true folds have the `adduct` target:

| Scripted state | Weight |               Measured mid-glottic opening |
| -------------- | -----: | -----------------------------------------: |
| Abducted       |      0 |                                  6.0450 mm |
| Narrowing      |    0.5 |                                  3.0225 mm |
| Adducted       |      1 | Closed within 0.001 mm numerical tolerance |

Both the browser and node tests measure the decoded positions and morph deltas. The three review
images show the opening, narrowing and closure. These are authored scripted states; they do not
model respiratory mechanics, phonation, laryngospasm, force, injury or patient tissue motion.

**Unresolved junction:** graph node 0 is about 0.0061 mm inside the source's closed proximal cap.
The existing collider's escape-from-contact rule permits a 5 mm advance from that start; this does
not establish a physical inlet. Although the authored path endpoint gap is zero, the 6.11 mm-radius
exit ring has a maximum surface gap of 2.4168 mm and a mean of 1.2576 mm. A full-size continuous
opening cannot both preserve that cap within 0.3 mm and meet the 0.5 mm junction requirement.
`review/device-review.json` therefore records `continuousOpeningVerified: false`. Resolving this
requires a decision to retain the source and accept a pending junction, or permit an authored inlet
modification excluded from the source-deviation limit. The source graph and engine remain unchanged.

## Authored devices and placement contract

`devices/devices.json` defines teaching dimensions only. It contains no manufacturer dimensions,
working-channel compatibility guarantee or replacement for an IFU.

| Tube ID | Authored OD | Authored rendered length | Edge 0 interval |
| ------- | ----------: | -----------------------: | --------------- |
| 7.0 mm  |      9.4 mm |                    35 mm | 35–70 mm        |
| 7.5 mm  |     10.0 mm |                    35 mm | 35–70 mm        |
| 8.0 mm  |     10.7 mm |                    35 mm | 35–70 mm        |

Length refers to the visible tracheal segment, not the total device length. Tests compare the
interval with `TUBE_START_MM` and `TUBE_TIP_MM`. The scope diameter remains the scene's input.

Each accessory node uses local millimetres with its distal-most point at the origin and **+Z
forward**. The scene rotates +Z along the optical forward axis and places the node origin at the
specified offset beyond the scope tip: an authored 2.5 mm for `at-tip`, or 10 mm for `extended`.
`in-channel` is hidden. These offsets describe a visual state, not a recommended clinical exposure.

| Accessory state | Required node       | Protected |
| --------------- | ------------------- | --------- |
| forceps-closed  | ACC_forceps_closed  | Yes       |
| forceps-open    | ACC_forceps_open    | No        |
| brush-sheathed  | ACC_brush_sheathed  | Yes       |
| brush-exposed   | ACC_brush_exposed   | No        |
| needle-sheathed | ACC_needle_sheathed | Yes       |
| needle-exposed  | ACC_needle_exposed  | No        |

The accessory review image puts forceps, brush and needle in columns, protected states above
exposed states. The geometry includes distinct opened jaws, radial bristles, and an exposed needle
point. All shaft radii, jaw angles, tip lengths, bristle spacing and material settings in the builder
are **authored for simulation**. The same classification applies to larynx dimensions, morph weights,
trimming parameters and camera settings; measured build results are explicitly identified above.

## Provenance and budgets

| Files                         | Origin / provenance class                                                             | Rights and review                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| graph.json                    | Existing graph derived from case-001; unchanged                                       | Owner confirmation and clinical review pending                            |
| lumen.glb                     | Reviewed case-001 lumen; source-derived surface with authored distal caps             | Source rights, de-identification confirmation and clinical review pending |
| larynx-lumen.glb, larynx.json | Supplied cartilage/ligament model plus authored mucosal walls, folds and registration | Source rights and clinical review pending                                 |
| devices.json, accessories.glb | Authored teaching geometry and dimensions                                             | Owner rights confirmation and clinical review pending                     |
| Review PNGs and JSON          | Generated views and technical measurements of these assets                            | Inherit the underlying assets' pending status                             |

Every file is individually inventoried in `manifest.json` with bytes, SHA-256, provenance, origin,
rights/permission status, de-identification status, reviewer, review date, profile, camera frame and
approved use. Reviewer, date and publication permission are null; clinical review status is pending.
No source rights holder, reviewer identity or publication authorization has been inferred.

| File or group          |         Bytes |            Budget |
| ---------------------- | ------------: | ----------------: |
| graph.json             |        71,449 | Included in total |
| lumen.glb              |       489,888 |         3,000,000 |
| larynx-lumen.glb       |       221,064 |         1,500,000 |
| larynx.json            |        14,386 | Included in total |
| accessories.glb        |        50,464 |           450,000 |
| devices.json           |         3,041 | Included in total |
| Review images and JSON |     1,181,798 | Included in total |
| Manifest               |        25,320 | Included in total |
| **All anatomy files**  | **2,057,410** |     **8,000,000** |

The GLBs are self-contained and Draco-compressed with gltf-pipeline 4.3.1 / draco3d 1.5.7,
compression level 10, position quantization 20 bits and normal quantization 12 bits. Geometry units
and axes are written directly, avoiding DCC scene scale or an implicit Y-up conversion.

## Regeneration and validation

Run from this checkout. Set `BLENDER_EXECUTABLE` to the installed Blender executable and
`SCOPE_LARYNX_REFERENCE` to the read-only `anatomy_assets/Larynx.glb` in the primary checkout.
The reviewed source GLB is available in this task's branch at the path shown below. Raw source
assets and any open Slicer scene remain untouched. Intermediates go only to
`artifacts/scope-assets/`; do not commit that cache.

```sh
# Lumen from the reviewed derived source; source graph and source surface are read-only.
"$BLENDER_EXECUTABLE" --background --factory-startup --python-exit-code 1 \
  --python scripts/bronchoscopy-foundations/build-scope-assets.py -- \
  --part lumen --source-lumen public/airway-anatomy/case-001/lumen-v2.glb
node scripts/bronchoscopy-foundations/compress-scope-assets.mjs lumen

# Larynx plus path, then the six accessory states and device JSON.
"$BLENDER_EXECUTABLE" --background --factory-startup --python-exit-code 1 \
  --python scripts/bronchoscopy-foundations/build-scope-assets.py -- \
  --part larynx --source-larynx "$SCOPE_LARYNX_REFERENCE"
"$BLENDER_EXECUTABLE" --background --factory-startup --python-exit-code 1 \
  --python scripts/bronchoscopy-foundations/build-scope-assets.py -- --part accessories
node scripts/bronchoscopy-foundations/compress-scope-assets.mjs larynx accessories
npx prettier --write public/bronchoscopy-foundations/anatomy/larynx/larynx.json \
  public/bronchoscopy-foundations/anatomy/devices/devices.json

# All review images and review JSON, followed by the final manifest.
node scripts/bronchoscopy-foundations/review-scope-assets.mjs
node scripts/bronchoscopy-foundations/build-scope-manifest.mjs

# Runtime contracts and existing engine regressions.
npx jest --runInBand src/features/bronchoscopy-foundations/__tests__/scope-assets.test.ts \
  src/features/bronchoscopy-foundations/__tests__/scope-engine.test.ts \
  src/features/bronchoscopy-foundations/__tests__/scope-walkthroughs.test.ts
npx tsc --noEmit -p scripts/bronchoscopy-foundations/tsconfig.scope-assets.json
npm run build:content
npm run type-check
npm run lint
```

The graph is independently owned: do not regenerate or format it as part of this pipeline. The
manifest pins its current bytes. A changed graph fails the tests until its owner updates the
corresponding review and manifest entry. The manifest itself is excluded from its self-referential
hash list but included in total bytes. Format generated JSON before reviewing and hashing; the
commit hook formats staged JSON too. After a commit, rerun the asset tests to detect any hash drift.

The standalone browser harness serves checkout files only on loopback, uses the bundled decoder
and existing shader/engine code, and captures the actual decoded meshes. It changes no application
routes or shared services. Node tests independently decode Draco, verify the lumen's manifold
edges, winding, component count and bounding box, and measure the true-fold morphs. Passing these
technical tests does not approve the unresolved junction or substitute for clinical review.

This trimmed, rigid teaching anatomy and its authored larynx and devices support educational
recognition and visual comparison. They do not establish patient-specific reach, clinical device
compatibility, procedural safety or hands-on competence. The files are ordinary public assets for
the standalone build; no upload, access rule, rewrite or remote-asset prefix is added.

## Validation and integration handoff

The scoped run passes 61 tests across the asset, scope-engine and scope-walkthrough suites. One
explicit pending test tracks the continuous junction and its 0.5 mm surface-gap requirement;
passing the other tests does not satisfy it. Repository type-checking and the browser-harness
type-check pass. Repository lint completes with zero errors and 15 existing warnings outside this
change; the changed test and scripts lint cleanly. Generated Contentlayer output is required before
the repository-wide type-check on a fresh checkout.

All implementation is confined to the owned asset paths, new asset scripts, this document and the
asset test. No graph, production scope contract, engine, content, stage, auth, route or hosting
configuration is changed. The local base branch for the requested PR is not yet on origin; hand off
the local commits to the stage owner rather than open a PR against a different base.
