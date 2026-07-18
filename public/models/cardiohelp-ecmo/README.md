# CARDIOHELP ECMO runtime models

These GLBs were prepared for the browser runtime on 2026-07-17. Supplied source files are not
modified by the preparation script; the patient model is generated locally as described below.

| Runtime file                 | Supplied source                       | Runtime triangles | Purpose                                 |
| ---------------------------- | ------------------------------------- | ----------------: | --------------------------------------- |
| `patient-femoral-access.glb` | Procedurally generated replacement    |             5,952 | Draped supine patient and groin windows |
| `cardiohelp-console.glb`     | `cardiohelp_console.glb`              |            21,384 | Bedside console silhouette              |
| `oxygenator.glb`             | `oxygenator.glb`                      |            61,476 | Textured membrane oxygenator            |
| `circuit-clamp.glb`          | `Clamp.glb`                           |            11,679 | Interactive drainage and return clamps  |
| `hls-sensor-connector.glb`   | `HLS internal sensor connection..glb` |             1,091 | Return-line sensor connector            |

The supplied `Fem_Fem_legs.glb` was inspected but is no longer used in the learner-facing scene.
Its open waist, cropped anatomy, and baked-in disconnected tubing made reliable circuit attachment
impractical. The preparation script now generates a privacy-preserving, full supine patient with a
clinical drape and bilateral groin windows. Cannulae, dressings, hubs, and circuit tubes are created
at runtime from shared anchor coordinates so their connections remain continuous.

Preparation centers the remaining supplied models at the origin, applies transforms, normalizes
them to a consistent meter-based scene scale, adds a PBR material where the source had none, and
reduces geometry for browser delivery. The oxygenator textures are reduced from 2048 px to 1024 px
and its unused emissive map is removed. Assets remain uncompressed GLB so the runtime does not
require a Draco decoder.

Rebuild with Blender:

```sh
blender --background --python scripts/cardiohelp-ecmo/prepare_assets.py -- \
  /path/to/source-assets public/models/cardiohelp-ecmo
```

The supplied files did not include license or provenance metadata. Confirm redistribution rights
before public release.
