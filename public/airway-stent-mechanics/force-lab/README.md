# Archived Airway Stent Force Lab

A retained, self-contained teaching prototype (Learn → Practice → Assess) on airway-stent
**architecture, deformation, and foreshortening**, built for the interventional-pulmonology
education platform. A persistent three.js canvas generates six stent architectures
procedurally in-browser and deforms them live; a six-section stepper wraps the interactive
force lab in teaching narrative and a self-check.

The deployed routes below now redirect through the normal module authentication boundary to the
current explorer's Architecture & lumen station:

```
/airway-stent-mechanics?station=architecture-lumen
```

## Sections

1. **Orientation** — the stent as a mechanical compromise; learning objectives.
2. **Architecture families** — inspect the six stents; structure, material, signature property, strengths/tradeoffs.
3. **The Force Lab** (centerpiece) — apply radial load, bending, ovalization, breathing, cough; live readouts.
4. **Tissue interaction** — six ways force becomes injury; anchoring ≠ radial force (GINA/Dumon bench data).
5. **Case self-check** — four case scenarios with rationale.
6. **References & boundaries** — force taxonomy, bench-testing checklist, citations, disclaimer.

## The six stents (all procedural, no downloads)

| Stent                  | Family                      | Foreshortening | Radial stiffness | Deformation           |
| ---------------------- | --------------------------- | -------------- | ---------------- | --------------------- |
| Cross-type braided     | Multiwire nitinol braid     | ~38%           | 62               | continuum             |
| Hook-and-cross braided | Captured-cell braid         | ~26%           | 74               | continuum             |
| Zigzag laser-cut       | Segmented nitinol lattice   | ≈0%            | 92               | continuum (+ kink)    |
| Smooth silicone        | Solid-wall silicone         | 0%             | 34               | continuum             |
| Dumon studded silicone | Solid-wall silicone + studs | 0%             | 40               | continuum             |
| Silicone Y-stent       | Bifurcated silicone         | 0%             | 42               | seating (radial only) |

## Physics grounding

- **Stiffness coupling** — under the same applied load, compression `d = 1 − load·(0.62/stiffness)`,
  so stiff laser-cut resists and compliant silicone squashes. Architecture governs deformation.
- **Foreshortening** — constant-wire-length braid kinematics `lengthFactor = √(1−d²sin²θ₀)/cosθ₀`;
  deployment foreshortening = `1 − 1/lengthFactor` (ceiling `1−cosθ₀`). Silicone and laser-cut use
  `θ₀ ≈ 0` → ≈0% (Jeong 2016 shortening ratio ≈ 0 for laser-cut).
- **Apparent wall stress** — two regimes, shown as whichever dominates (never summed, so dynamic
  peaks stay within cited values): focal contact stress under static load (wire/strut = high peak,
  broad silicone wall = low peak → laser-cut > braided > silicone), and physiologic airway wall
  stress cycling with breathing (3.3 / 5.25 kPa) and cough (peak 7.25 kPa). All from Ratnovsky 2015.
- **Balloon-expandable mode** — a cough leaves a permanent residual set (Ratnovsky crush risk);
  self-expanding recovers by shape memory.
- **Symmetric C-bend** — the stent bends into an arc centred on the origin (ends at ±φ/2), staying
  framed; stiff laser-cut struts add a local lumen pinch (kink) above ~40°.

Geometry is stylized and **not** dimensionally registered to any product. All stiffness, anchoring,
and bench figures are relative educational calibrations, not device specifications. Content mirrors
`src/features/airway-stent-mechanics/content/*` (curriculum, profiles, references) — keep them in sync.

## Sources

- Jeong S. _Basic Knowledge about Metal Stent Development._ Clin Endosc 2016;49:108–112.
- Ratnovsky A, et al. _Mechanical properties of different airway stents._ Med Eng Phys 2015;37:408–415.
- Jung HS, et al. _GINA silicone airway stent._ Sci Rep 2021;11:7958 (anchoring vs radial force).

## Implementation notes

- `index.html` — single file; three.js r0.180 from `./vendor/` via import map
  (`three.module.js` needs `three.core.js` alongside it, plus `OrbitControls.js`).
- **No `mergeGeometries`** in the vendored build — every stent is one `BufferGeometry` assembled
  from flat `pos[]`/`idx[]`. Primitives: `pushTube` (round wire), `sweepWall` (hollow silicone wall),
  `pushStud` (Dumon studs). A gradient environment is generated with `PMREMGenerator` (in-core) so
  metals read as polished nitinol without an external HDR.
- **`window.__lab`** verification hook: `.setType(id)`, `.setForces({rad,bend,oval,breathing,coughT,residual})`,
  `.section(i)`, `.step(frames, now)`, `.readout()`, `.bbox()` (world + projected NDC + `inView`).
  Drive frames with explicit `now` timestamps — breathing is wall-clock based, and the tab's rAF
  throttles when backgrounded.
