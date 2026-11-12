# Bronchoscopy Foundations scope assets

The part-one assets, build scripts and technical review are implemented. The larynx-to-trachea
junction remains unresolved: the authored exit ring misses the unchanged source surface by up to
2.4168 mm, beyond the brief's 0.5 mm limit. The manifest and tests preserve this pending status.
Clinical review, rights confirmation and publication permission remain pending for every asset.
The production scope pane and the additional handle, distal tip, bench target and generic practice props are now integrated. See [scope-pane.md](scope-pane.md) and [validation.md](validation.md) for the current build.

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

`larynx/larynx-lumen.glb` contains the mucosa the scope sees (`UA_lumen`, `UA_subglottis`, paired
true and false folds) and the laryngeal framework round it, drawn only in the outside view:
`UA_hyoid`, `UA_thyroid`, `UA_cricoid`, `UA_arytenoid_L`/`_R`, `UA_epiglottis`,
`UA_tracheal_rings`, `UA_trachea_wall`, `UA_thyrohyoid_membrane` and `UA_cricothyroid_ligament`,
each with `extras.defaultVisible: false`.

Every mesh is authored by `larynx_framework` and `build_larynx` in the build script. No supplied
model is read. Until 2026-11-11 the cartilages were taken from a third-party model (the University
of Dundee's "Anatomy of the larynx", CC BY-SA 4.0); they were replaced with original geometry so the
asset carries no share-alike terms. That model was looked at for the shapes, and the framework's
overall proportions were checked against the owner's own head-and-neck CT segmentation (thyroid
cartilage about 46 mm wide, hyoid about 41 mm wide); the cricoid is sized to this model's airway.
The CT and its segmentation stay in the local authoring data and are not in this repository.

The mucosal surface was re-authored on 2026-11-11 for a more real picture from the scope, at the
owner's request. The true folds are rounded bands lofted from the anterior commissure to the vocal
process, so the glottis is a triangle with its apex in front; they carry a vertex colour, pearly at
the free edge and the mucosa's pink toward the wall, and their `adduct` target brings the free edge
to the midline. The false folds are thicker rounded bands above and just outside them, melting into
the wall at their ends. The luminal face of `UA_lumen` and `UA_subglottis` carries a moulded relief:
two arytenoid mounds with corniculate tubercles and the interarytenoid notch between them, an
aryepiglottic ridge with a cuneiform tubercle on each side, and an epiglottic tubercle in front.
From the scope the scene hides every framework node, since they lie under that mucosa. Every shape
and size here is a presentation choice for this teaching model, not an anatomical measurement.

The outside view draws the whole model as a shaded 3D model that the learner turns by dragging or
with the Front, Side, Back and Above buttons (`larynxOutsideView.ts`, `OutsideTurnLayer.tsx`). It
has two looks: solid, in tissue colours, and "See inside", with the cartilages and the wall as
glass so the folds and the scope show. In both, the scope is traced pale where something solid
hides it and its tip is marked with the yellow dot.

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

| Files                                                                   | Origin / provenance class                                                    | Rights and review                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| graph.json                                                              | Existing graph derived from case-001; unchanged                              | Owner confirmation and clinical review pending                            |
| lumen.glb                                                               | Reviewed case-001 lumen; source-derived surface with authored distal caps    | Source rights, de-identification confirmation and clinical review pending |
| larynx-lumen.glb, larynx.json                                           | Authored mucosal walls, folds and laryngeal framework; no supplied model     | Owner rights confirmation and clinical review pending                     |
| devices.json, accessories.glb                                           | Authored teaching geometry and dimensions                                    | Owner rights confirmation and clinical review pending                     |
| handle.glb, scope-tip.glb, bench.glb, findings.glb, teaching-props.json | New Blender-authored teaching props; no product or patient reference implied | Owner rights confirmation and clinical review pending                     |
| Review PNGs and JSON                                                    | Generated views and technical measurements of these assets                   | Inherit the underlying assets' pending status                             |

Every file is individually inventoried in `manifest.json` with bytes, SHA-256, provenance, origin,
rights/permission status, de-identification status, reviewer, review date, profile, camera frame and
approved use. Reviewer, date and publication permission are null; clinical review status is pending.
No source rights holder, reviewer identity or publication authorization has been inferred.

| File or group          |         Bytes |            Budget |
| ---------------------- | ------------: | ----------------: |
| graph.json             |        71,449 | Included in total |
| lumen.glb              |       489,888 |         3,000,000 |
| larynx-lumen.glb       |       270,392 |         1,500,000 |
| larynx.json            |        14,694 | Included in total |
| accessories.glb        |        50,464 |           450,000 |
| devices.json           |         3,041 | Included in total |
| handle.glb             |        12,160 |           500,000 |
| scope-tip.glb          |         7,056 |           100,000 |
| bench.glb              |        10,160 |           100,000 |
| findings.glb           |         8,632 |           100,000 |
| teaching-props.json    |           674 | Included in total |
| Review images and JSON |     1,119,302 | Included in total |
| Manifest               |        36,722 | Included in total |
| **All anatomy files**  | **2,311,234** |     **8,000,000** |

The GLBs are self-contained and Draco-compressed with gltf-pipeline 4.3.1 / draco3d 1.5.7,
compression level 10, position quantization 20 bits and normal quantization 12 bits. Geometry units
and axes are written directly, avoiding DCC scene scale or an implicit Y-up conversion.

## Teaching stills

`public/bronchoscopy-foundations/renders/` holds pictures drawn from the course's 3D models for
teaching screens that had none, with `renders.json` beside them (size and checksum of each file).
They are drawings, not photographs: blood, a blocker, a tube and the scope are authored shapes
placed in `lumen.glb` to show where each one is, and every size and position is a presentation
choice.

```sh
node scripts/bronchoscopy-foundations/render-teaching-stills.mjs          # every still
node scripts/bronchoscopy-foundations/render-teaching-stills.mjs <id> ... # only these
```

`render-teaching-stills.browser.mts` holds the stills, one entry each in `STILLS`. Five kinds:

- `renderOutside`: the airway tree as pale glass, airways with blood in them solid red, and any
  device inside. Each wall vertex is given to its nearest centerline, so a still names airways by
  their graph edge ids.
- `renderScope`: the view down the scope, with the course's own wall material (rings, pale wall)
  and blood drawn on the dependent wall. The patient is supine, so that is the posterior wall.
  With `narrow`, the named airways are drawn in toward their own centerlines (bronchospasm): most
  at the membranous back wall, with the movement averaged over neighbouring vertices so the wall
  stays one surface where airways meet.
- `renderCords`: the view from just above the vocal folds in `larynx/larynx-lumen.glb`, with the
  folds' own morph target open (0) or shut (1) and the trachea drawn beyond them.
- `renderChest`: both lungs and the airways from in front, from the peripheral-imaging course's
  CT-derived `public/peripheral-imaging/anatomy/thorax.glb` (its file is x left, y anterior; the
  script turns it into the patient frame the airway uses). `rightLung` draws the right lung in
  toward its hilum by that share and leaves the space it filled as an empty outline; `shiftMm`
  pushes the trachea and the left lung's inner border toward the patient's left. The lung
  surface's wrap round the tracheal air is left out. The ribs in that file are a threshold surface
  with gaps at the costal cartilages and are not drawn: they are not clean enough to count
  interspaces on, so no still marks a decompression site.
- `renderStrips`: monitor traces drawn as lines on one time scale, each under a short label. A
  capnography trace is built breath by breath (`capnogram`); its shape is the one the section's
  text describes, with no values on it.

To add a still: add its entry to `STILLS`, run the script, add its caption and description to
`src/features/bronchoscopy-foundations/content/teachingStills.ts`, and name it in a screen's
`stills` in `content/courseFlow.ts` with `visual: 'stills'`. `teaching-stills.test.ts` holds the
folder, the manifest and the course to each other, file for file. The note under a set of pictures
(`teachingStillsNote`) says what they are drawn from and how they are seen, from each still's
`view`. First used for the four teaching screens of the Bleeding section (2026-11-11), then the
five of When the patient deteriorates (2026-11-11).

## Regeneration and validation

Run from this checkout. Set `BLENDER_EXECUTABLE` to the installed Blender executable.
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
  --part larynx
"$BLENDER_EXECUTABLE" --background --factory-startup --python-exit-code 1 \
  --python scripts/bronchoscopy-foundations/build-scope-assets.py -- --part accessories
node scripts/bronchoscopy-foundations/compress-scope-assets.mjs larynx accessories
npx prettier --write public/bronchoscopy-foundations/anatomy/larynx/larynx.json \
  public/bronchoscopy-foundations/anatomy/devices/devices.json

# Additional generic props (38,008 bytes of compressed geometry).
"$BLENDER_EXECUTABLE" --background --factory-startup --python-exit-code 1 \
  --python scripts/bronchoscopy-foundations/build-teaching-props.py
node scripts/bronchoscopy-foundations/compress-scope-assets.mjs handle tip bench findings

# All part-one review images and review JSON, followed by the final manifest.
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

## Current integration evidence

All seven modes are integrated and the complete survey has been exercised with the loaded lumen and its collider. The updated asset suite decodes every GLB, checks the new movable node names and budgets, and verifies per-file hashes and pending-review fields. The original continuous-junction requirement remains an explicit pending test. See [validation.md](validation.md) for current commands, counts and captures.

The four added GLBs total 38,008 bytes. `teaching-props.json` records the authored movable pivots, scope-tip diameter, target position and interpretation limits. The findings file is generic practice geometry; it is not used to reconstruct an unavailable source image or to assert a clinical diagnosis. Existing finding-description activities still use their authored text and normal reference stills.

The old part-one engine/scene ownership boundary is superseded by the core-module takeover. The original source lumen and teaching graph remain unchanged. Shared stage files and admin rendering primitives remain unchanged by this integration.
