# Bronchoscopy Foundations scope assets

## Lumen spike handoff

The teaching lumen is ready for technical integration review. Clinical review and publication
permission remain pending. No graph, scope contract, engine, lesson content or route was changed.

- Patient LPS millimetres; identity node `PatientLpsLumen`; one closed, outward-oriented component.
- 200,262 triangles; 489,944 bytes with Draco (limits: 250,000 triangles and 3,000,000 bytes).
- Retains the reviewed source triangles through half the second generation beyond segmental
  origins. The teaching graph traverses one generation. There are 68 authored distal caps.
- No decimation. Exhaustive corresponding-vertex and oriented-triangle checks bound every retained
  source triangle's displacement after compression by 0.000188 mm; mean vertex displacement
  0.000099 mm. The caps replace removed distal passages: their centroid distance from the original
  surface reaches 0.800419 mm. Caps are excluded from the retained-surface deviation bound.
- All 694 stored graph points and 4,262 interpolated route samples are inside the decoded mesh.
  Advance/withdraw and a 50 mm lateral wall-stop request pass using the production collider and
  1.9 mm tip radius. The stopped position has 1.957872 mm clearance.
- One cold headless Chromium run: 67.2 ms Draco decode/GLTF parse, 44.8 ms BVH construction; this is a
  local engineering observation, not a cross-device performance guarantee.
- RUL, RML and LUL reference images preserve the source view relationships through
  `buildTransportFrames`: RB1 superior, RB5 left of RB4, upper division superior to lingula.
  Compare the committed review images with `docs/bronchoscopy-review/{rul,rml,lul}.png`.

`review/collision-review.json` pins the exact lumen, graph and source hashes and lists the minimum
clearance on every labelled first segment. Twenty-three first segments contain a sample below
1.9 mm. That means the complete segment is not traversable along that centerline by the default
rigid tip sphere; it does not assert that its ostium cannot be approached or identified. No airway
has been enlarged to make a drill pass.

### Junction issue requiring a geometry/engine decision

Graph node 0 is about 0.0061 mm inside the source's closed proximal cap. The collider's existing
escape-from-contact rule allows a 5 mm advance from this start. That behavior does not establish a
full-size physical opening or a continuous larynx junction. A full-size inlet at this point cannot
both retain the source cap within 0.3 mm and join a patent larynx opening. Source preservation is
currently authoritative; the junction is pending a decision. The graph and engine remain read-only.

## Regeneration

Run from this checkout. Inputs are read-only, and the disposable intermediates are written to
`artifacts/scope-assets/`.

```sh
"$BLENDER_EXECUTABLE" --background --factory-startup \
  --python scripts/bronchoscopy-foundations/build-scope-assets.py -- --part lumen
node scripts/bronchoscopy-foundations/compress-scope-assets.mjs lumen
node scripts/bronchoscopy-foundations/review-scope-assets.mjs
```

Set `BLENDER_EXECUTABLE` to the installed Blender executable. The build uses Blender's bundled
Python and the repository's existing gltf-pipeline 4.3.1 / draco3d 1.5.7. The browser harness serves
only checkout files on loopback and uses `/fluoroview/draco/`; it does not change an application
route or start a shared data service.

All trimming distances, generation limits, compression settings and harness camera settings are
authored engineering values, not patient measurements or clinical recommendations. The retained
source anatomy is derived from the existing case-001 teaching asset. This model is for educational
recognition and device-size comparison; it does not establish patient-specific reach, procedural
safety, device compatibility or hands-on competence.
