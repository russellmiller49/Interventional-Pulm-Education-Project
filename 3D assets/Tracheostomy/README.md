# Tracheostomy 3D asset workflow

The GLBs in this directory are preserved as the original user-supplied source assets. They are not
loaded directly by the web module.

Repaired, normalized, and compressed derivatives are generated in:

```text
public/tracheostomy/models/
```

Run the reproducible Blender pipeline from the project root:

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --background \
  --python scripts/tracheostomy/repair_meshy_models.py \
  -- "3D assets/Tracheostomy" public/tracheostomy/models
```

## Repairs applied

- Flatten imported transforms and normalize every standalone model around its origin.
- Weld coincident geometry without flattening per-face UV data.
- Remove unreferenced loose vertices and validate mesh data.
- Recalculate face normals and use single-sided rendering for repaired Meshy surfaces.
- Apply conservative per-model triangle budgets.
- Limit embedded textures to 1024 px, remove unused emission/flat-normal inputs where appropriate,
  and encode remaining maps as JPEG.
- Rename anonymous nodes, correct the public `obturator` spelling, and apply Draco compression.
- Preserve attribution and license metadata on the adapted larynx model.

The generated `model-manifest.json` records source hashes, original and optimized triangle counts,
output size, model limitations, repair steps, and learner-facing status.

## Learner-facing boundary

All repaired Meshy exports are retained as review and authoring references. Their fused meshes are
not dimensionally registered and cannot support clinically coherent component animation. The module
therefore uses a new code-native segmented cutaway with independently selectable geometry for the
outer cannula, inner cannula, cuff, flange, connector, obturator, and tethered pilot system.

The larynx is adapted from the University of Dundee School of Medicine Sketchfab model and remains
licensed under CC BY-NC-SA 4.0. Its attribution and license are preserved in the GLB extras, manifest,
and module references page. The derivative is not loaded by the segmented animation.
