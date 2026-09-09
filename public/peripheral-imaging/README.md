# Peripheral imaging teaching models

Original procedural geometry authored for this course on 2026-09-08. No patient data,
manufacturer CAD, stock models, textures, video frames, or external media are included.

- `thorax-airways.glb`: schematic thorax, branching airways, ribs, lungs, and adjacent structures.
- `fixed-cbct-suite.glb`: the thorax, table, C-arm, source, detector, and fixed support.
- `mobile-cbct-suite.glb`: the same teaching anatomy and imaging geometry with a mobile base.
- `sampling-window.glb`: an 18 mm spherical target and fictional needle sampling region.

These are educational abstractions. Anatomy, equipment dimensions, colors, and camera
positions are authored examples. They do not represent a specific scanner, patient, or needle.
They cannot determine clearance, dose, procedure safety, or diagnostic yield.

The runtime creates the meshes from `src/features/peripheral-imaging/lib/models.ts`.
The geometry and arithmetic contract is in `lib/physics.ts` in that feature directory.
World axes are x = patient left, y = anterior, z = superior. Runtime coordinates use mm;
the exported root applies a 0.001 scale to conform to glTF meter units. The sampling
region is an 8 mm cylinder, 1.3 mm in diameter, 6–14 mm behind the tip. A white sphere
marks the tip; it is an annotation, not another sampling region.

Regenerate from the repository root:

```sh
npx tsx scripts/peripheral-imaging/export-models.ts
```

Each binary glTF embeds its geometry and materials and needs no remote resources.
Repository licensing applies.
