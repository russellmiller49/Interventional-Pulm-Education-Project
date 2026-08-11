# CARDIOHELP ECMO runtime models

Prepared 2026-07-17, axis/quality rework 2026-07-18, and B7 fidelity rebuild
2026-08-11 (owner-approved at Visual Approval Gate 1, Gate 2, and the
follow-up asset gate). Five of the six runtime GLBs are procedural in-repo
originals; only the sensor connector still derives from a supplied file.

| Runtime file                 | Provenance                                     | Runtime triangles | Size    | Purpose                                                                                  |
| ---------------------------- | ---------------------------------------------- | ----------------: | ------- | ---------------------------------------------------------------------------------------- |
| `cardiohelp-console.glb`     | Procedural (build_fidelity_assets.py)          |            12,164 | ~310 KB | CARDIOHELP console: cage, screen, keypad, rotary knob, connector panel, HLS holder plate |
| `patient-femoral-access.glb` | Procedural (build_fidelity_assets.py)          |            21,860 | ~388 KB | Neutral supine mannequin, fitted drape, 2 groin access windows                           |
| `circuit-clamp.glb`          | Procedural (build_fidelity_assets.py)          |             3,744 | ~93 KB  | Interactive tubing clamp, jaws sized to the 0.08 m tube OD                               |
| `oxygenator.glb`             | Procedural (build_fidelity_assets.py)          |             1,660 | ~62 KB  | HLS Module Advanced: clear diamond housing, fiber bundle, red frame + volute, stopcocks  |
| `sweep-gas-blender.glb`      | Procedural (build_fidelity_assets.py)          |             4,200 | ~123 KB | Pole-mounted air/O2 mixer + flowmeters; the sweep line starts at its outlet              |
| `hls-sensor-connector.glb`   | Supplied `HLS internal sensor connection..glb` |             1,091 | ~20 KB  | Return-line sensor, tangent-aligned axis                                                 |

Total payload ≈ 1.0 MB (budget 6 MB) — no textures in any runtime asset.

## 2026-08-11 B7 fidelity rebuild notes

- **Console.** The supplied console scan (not recognizable as a CARDIOHELP;
  single monochrome material) is retired from the runtime. The procedural
  replacement is authored upright — base at local −Y, operated face on +Z —
  so `CONSOLE_PLACEMENT` is a plain yaw; the legacy `[π, yaw, 0]` flip is
  gone. No manufacturer logos or copied artwork; the screen is deliberately
  blank (display content lives in the 2D console facsimile).
- **Patient.** Skin-modifier skeleton with 7.5-head adult proportions
  (~1.75 m), mitten hands, dorsiflexed feet, featureless face with a
  surgical-cap treatment, fitted chest-to-knees drape with a circular
  left-vein window and a capsule window over the right vein/artery cluster.
  No baked gauze — the runtime draws dressings at the layout anchors. The
  groin anchors in `layout.ts` are re-measured from this asset's raycast
  skin heights (the builder prints them).
- **Clamp.** Jaw span now clears the 0.08 m tube OD (the old 0.048 m jaws
  hovered beside the tube); ratchet rack seated instead of floating chips.
- **HLS module + sweep-gas blender (follow-up gate).** The photogrammetry
  oxygenator scan (2.25 MB, mirrored labels, scan filaments) is replaced by a
  procedural HLS Module Advanced; its yaw is the shared `OXYGENATOR_ROTATION`
  constant (runtime + harness). The new `sweep-gas-blender.glb` models the
  air/O2 mixer with flowmeters; the sweep line begins at `BLENDER_OUTLET_LOCAL`
  transformed by `BLENDER_PLACEMENT`, and both cannulae were re-routed to run
  caudally instead of crossing over the abdomen (owner-approved).
- **Material-slot trap** (this shipped a defect once): applying a boolean
  whose cutter has no material inserts a `None` slot at index 0, orphaning a
  later-appended material, and `material_slot_remove_unused` then deletes it
  at join — the old patient's drape rendered default-white this way. Assign
  materials before boolean cuts; `b7-asset-contracts.test.ts` guards it.

## 2026-07-18 rework notes (still applicable to the supplied assets)

- `bpy.ops.object.transform_apply` silently no-ops on glTF-imported objects
  in Blender 5.1 background mode — scripts transform mesh data directly.
- The oxygenator's orphaned normal-map image was stripped; embedded
  base-color/roughness textures preserved.
- The supplied `Fem_Fem_legs.glb` remains unused (open/cropped geometry).

## Rebuild

```sh
# B7 assets (console, patient, clamp) — no source files needed:
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/cardiohelp-ecmo/build_fidelity_assets.py -- \
  public/models/cardiohelp-ecmo

# Subset:
... build_fidelity_assets.py -- public/models/cardiohelp-ecmo --only patient

# The legacy prepare_assets.py / polish_runtime_assets.py remain only as
# provenance for the supplied-file pipeline (sensor). Do NOT run their
# console/clamp/oxygenator paths — they would overwrite the B7 assets.
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

Only `hls-sensor-connector.glb` still derives from a supplied file without
license metadata — confirm redistribution rights before public release. Every
other runtime asset is an in-repo procedural original.
