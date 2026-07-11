# Airway stent model pipeline

This pipeline converts the authoring GLBs in `3D assets/Stents` into protected, web-ready lesson
assets. It never overwrites the source files.

## Generate derivatives

Run from the repository root with Blender 5.1 or newer:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/airway-stent-mechanics/prepare-model-assets.py -- \
  "3D assets/Stents" public/airway-stent-mechanics/models/v1
```

The command flattens transforms, normalizes orientation and origin, cleans mesh data, applies the
per-model triangle budgets, replaces unstable source texture inputs with audited neutral PBR
materials, adds prescribed educational morph targets, exports Draco-compressed GLBs, and writes
`model-manifest.json` with source/output hashes.

## Visual audit

Render orthographic basis views with the repository's shared Blender audit tool:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/tracheostomy/render_model_audit.py -- \
  public/airway-stent-mechanics/models/v1 /tmp/airway-stent-model-audit
```

Compare thin wires, open lumen rims, the open-face tracheal cut, and Y-stent branch openings against
the authoring models before accepting a regenerated derivative. Do not automatically fill model
boundaries: most are intentional airway or stent openings.

## Production delivery

The module and its models are draft/admin-gated. Keep browser requests on the raw same-origin
`/airway-stent-mechanics/models/v1/` prefix; do not pass these URLs through
`resolveModuleAssetPath`.

Upload only this protected prefix after regeneration:

```bash
npm run upload:module-assets -- --upsert --only=airway-stent-mechanics
```

Model labels currently follow the user-supplied filenames. The source folder contains no embedded
license, copyright, or manufacturer-validation metadata, so production publication rights and exact
product provenance must be confirmed before this draft module is released publicly.
