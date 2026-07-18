# CARDIOHELP ECMO runtime models

These GLBs were prepared for the browser runtime on 2026-07-17 and reworked on
2026-07-18 (axis correction + quality pass). Supplied source files are not
modified; the patient and clamp are generated locally.

| Runtime file                 | Provenance                                 | Runtime triangles | Size    | Purpose                                  |
| ---------------------------- | ------------------------------------------ | ----------------: | ------- | ---------------------------------------- |
| `patient-femoral-access.glb` | Procedurally generated (prepare_assets.py) |           ~17,700 | ~316 KB | Draped supine patient, 3 groin windows   |
| `cardiohelp-console.glb`     | `cardiohelp_console.glb` + polish pass     |            15,999 | ~476 KB | Bedside console, standing orientation    |
| `oxygenator.glb`             | `oxygenator.glb` (textures preserved)      |            61,444 | ~2.2 MB | Textured membrane oxygenator             |
| `circuit-clamp.glb`          | Procedurally generated (polish script)     |            ~5,900 | ~88 KB  | Interactive tubing clamp (jaws/ratchet)  |
| `hls-sensor-connector.glb`   | `HLS internal sensor connection..glb`      |             1,091 | ~20 KB  | Return-line sensor, tangent-aligned axis |

Total payload ≈ 3.1 MB (budget 6 MB).

## 2026-07-18 rework notes

- **Axis correction.** The original export skipped the Z-up → Y-up conversion,
  so the patient rendered standing upright and the console lay on its back in
  the browser. Orientation is now normalized: patient supine along Z, console
  and sensor heights along Y. (`bpy.ops.object.transform_apply` silently
  no-ops on glTF-imported objects in Blender 5.1 background mode — both
  scripts transform mesh data directly.)
- **Patient quality.** Higher metaball resolution, shoulder/knee/ankle
  volumes, a shrinkwrapped drape with boolean-cut windows, and recessed
  three-site groin dressings (bilateral vein + right artery for VA) with gauze.
- **Clamp.** The supplied flat 8 mm plate was replaced by a procedural tubing
  clamp (jaws, hinge, ratchet, finger loops) authored for the runtime's
  alignment convention (length along X, jaw opening along Y).
- The supplied `Fem_Fem_legs.glb` remains unused (open/cropped geometry).

## Rebuild

```sh
# Full rebuild from supplied sources (not in repo):
blender --background --python scripts/cardiohelp-ecmo/prepare_assets.py -- \
  /path/to/source-assets public/models/cardiohelp-ecmo

# Patient only (no sources needed):
blender --background --python scripts/cardiohelp-ecmo/prepare_assets.py -- \
  --patient-only public/models/cardiohelp-ecmo

# Polish/reorient the runtime GLBs in place (no sources needed):
blender --background --python scripts/cardiohelp-ecmo/polish_runtime_assets.py -- \
  public/models/cardiohelp-ecmo public/models/cardiohelp-ecmo
```

## Visual verification (offline harness)

The scene layout lives in `src/features/cardiohelp-ecmo/components/ecmo-circuit/layout.ts`.
Export it and render composed-scene previews (both tracks, five camera poses):

```sh
npx esbuild scripts/cardiohelp-ecmo/export-circuit-layout.mts --bundle \
  --platform=node --format=esm --outfile="$TMPDIR/export-circuit-layout.mjs" \
  && node "$TMPDIR/export-circuit-layout.mjs"
blender --background --python scripts/cardiohelp-ecmo/render_scene_previews.py -- \
  public/models/cardiohelp-ecmo scripts/cardiohelp-ecmo/circuit-layout.vv.json /tmp/ecmo-previews/vv
```

The supplied files did not include license or provenance metadata. Confirm
redistribution rights before public release.
