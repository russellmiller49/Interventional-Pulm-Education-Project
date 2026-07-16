# Scope Tracker printable parts

Parametric source: `scope_tracker_cad.py` · Ready-to-slice: `stl/` · Renders: `preview/`

**Before printing the big parts, measure your scope** (`cord_od`, `handle_neck_od`) and
your PAT9125 breakout (`sensor_hole_spacing`), edit `PARAMS` in the script, and
regenerate:

```bash
python3 -m venv cadenv
./cadenv/bin/pip install trimesh manifold3d numpy shapely matplotlib
./cadenv/bin/python scope_tracker_cad.py
```

Print order: `bench_jig_base` + `bench_jig_clamp` first (Phase 0 optical de-risking),
then Module B, then Module A. Full instructions, wiring, firmware and calibration:
`../scope_tracker_build_guide_v1.md`.

All parts export in their intended print orientation (the Module B lid is intentionally
upside-down). Material: PETG/ASA, 0.2 mm layers, 4 walls.
