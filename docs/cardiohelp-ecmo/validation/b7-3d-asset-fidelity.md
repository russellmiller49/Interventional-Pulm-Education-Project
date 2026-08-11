# B7 — CARDIOHELP and patient 3D asset fidelity

Asset and presentation package for the bedside 3D circuit scene. Improves the
CARDIOHELP console and the patient mannequin from recognizable placeholders to
clinically credible educational models, with the scene corrections needed for
them to read properly. **Not** a curriculum, physiology, Practice, Assess,
scoring, or publication package; the B6 draft panels and PR #94 are untouched.

- Branch: `claude/ecmo-b7-3d-asset-fidelity-2026-08-11`
- Base: `origin/main` at `99ad5991`
- Owner visual gates: Gate 1 (asset candidates) **approved 2026-08-11**;
  Gate 2 (integrated scene) recorded below.

---

## Owner screenshots and observations

The owner supplied official Getinge product photography of the original
CARDIOHELP System and HLS Module Advanced 7.0, clinical VA/VV cannulation
illustrations, and screenshots of the current app scene. The current-scene
screenshots showed:

1. a mannequin-like patient with balloon limbs, no hands or feet, and a
   sphere head;
2. the console reading as a dark unrecognizable box in a cage;
3. label pills piling up and overlapping near the console (`CARDIOHELP
CONSOLE` / `HLS MODULE` / `FLOW / BUBBLE SENSOR` / `SWEEP-GAS LINE`) and
   near the groin (both femoral labels plus both clamp labels).

## Baseline asset audit (before)

SHA-256 of the replaced baseline GLBs:

| File                              | SHA-256             |     Size | Triangles | Materials                   |
| --------------------------------- | ------------------- | -------: | --------: | --------------------------- |
| `cardiohelp-console.glb`          | `f777503f…2e037d1`  |   476 KB |    15,999 | 1 (monochrome, no textures) |
| `patient-femoral-access.glb`      | `56f96a2b…3dfffb01` |   316 KB |    17,726 | 5 slots, **one null**       |
| `circuit-clamp.glb`               | `bb6c91df…5ba32`    |    89 KB |     3,556 | 2                           |
| `oxygenator.glb` (kept)           | `8625a8a1…50258`    | 2,250 KB |    61,437 | 1 + 3×1024² textures        |
| `hls-sensor-connector.glb` (kept) | `b72669e3…0771f`    |    21 KB |     1,091 | 1                           |

Total baseline payload 3.08 MB of the 6 MB budget.

Baseline defects, confirmed by 40 isolated turntable renders, composed VV/VA
harness renders at every camera pose, live-browser review at 1600×900,
1440×900, 1280×720 and 1024×768, and four independent read-only review agents
(reference/asset audit, console fidelity, patient/scene, performance +
accessibility):

- **Console**: the supplied scan is not a CARDIOHELP — it reads as an
  industrial generator slung between roll hoops, with torn geometry on top,
  one dark slate material, no screen, keypad, knob, crank, or holder plate.
  Proportions ~2.1× the real 255 × 455 × 427 mm unit (Getinge product page).
- **Patient**: metaball construction — balloon-segment limbs, no hands or
  feet, featureless ovoid head engulfed by a 0.27 m hair sphere, armpit gaps,
  pillow detached from the head, body hovering 4–6 cm above the mattress.
  The sterile drape's material slot exported as **null**, so the authored
  surgical teal rendered as default white. Groin gauze floated in mid-air.
- **Anchors**: `layout.ts` authored the groin access anchors at patient-local
  y 0.258–0.265 while the actual skin surface sat at ~0.19–0.23 — cannula
  tips, dressing rings, film discs and the VA DPC all floated.
- **Clamp**: 0.048 m jaw span vs the 0.08 m tube OD it clamps — the
  instrument hovered beside the tube; ratchet teeth floated unattached.
- **Labels**: 4 (VV) to 6 (VA) pills piled text-on-text over the groin at the
  default camera; `HLS MODULE` and `FLOW / BUBBLE SENSOR` overlapped; the
  patient rendered ~40 % smaller than the console and inside the fog band.
- **Accessibility**: the "Reload 3D view" button was focusable inside an
  `aria-hidden` container.

## Reference hierarchy

1. Owner-supplied official product photography (authoritative for component
   placement and color).
2. https://www.getinge.com/us/products/cardiohelp-system/ — confirmed hard
   numbers: 255 × 315 × 427 mm closed / 255 × 455 × 427 mm with safety bar
   open, ≈12 kg, HLS Set Advanced 5.0/7.0, 0–5,000 RPM.
   (The `/us/` HLS Set page 404s; https://www.getinge.com/int/products/hls-set-advanced/
   works and adds coating/duration details.)
3. Owner clinical illustrations for cannulation topology.

References were used for visual and component placement only. No imagery was
scraped into textures, no proprietary artwork copied, no manufacturer logos
added, and no functionality invented beyond what the runtime models.

## Candidate comparison (Gate 1)

Two procedural candidates per asset, each presented as an 8-view contact
sheet plus composed VV/VA scene renders:

| Candidate                             | Triangles |   Size | Materials | Notes                                                                                                                         |
| ------------------------------------- | --------: | -----: | --------: | ----------------------------------------------------------------------------------------------------------------------------- |
| Console A — high-fidelity faithful    |    12,164 | 310 KB |         7 | cage, housing, inclined face, screen, 4-key column, rotary knob, connector panel, holder plate + sockets, crank, vents, hatch |
| Console B — optimized educational     |     5,648 | 151 KB |         7 | same reading, secondary details omitted                                                                                       |
| Patient A — anatomically proportioned |    21,860 | 388 KB |         4 | subsurf-2 skin-modifier body, corrective smooth, mitten hands + thumb, dorsiflexed feet                                       |
| Patient B — stylized lower-detail     |    15,926 | 284 KB |         4 | subsurf-1, simpler extremities                                                                                                |

**Owner selected Console A and Patient A (2026-08-11).** Recommended and
chosen: Console A is still 24 % fewer triangles than the shipped console;
Patient A is +23 % over the shipped patient, well under the 2× ceiling.

## Selected assets and provenance

All three rebuilt GLBs are generated end-to-end by one tracked script — no
supplied source files, no manual `.blend` edits, no third-party meshes:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/cardiohelp-ecmo/build_fidelity_assets.py -- \
  public/models/cardiohelp-ecmo
```

Blender 5.1.0. The script prints a report including the raycast-measured
skin-surface heights the layout anchors are re-measured from. The oxygenator
and sensor connector keep their existing provenance (supplied files, license
unconfirmed — see the licensing gate below); the console rebuild **retires**
the unknown-license supplied console scan from the runtime.

## Contract changes (all documented in-code and regression-tested)

- `CONSOLE_MODEL_BOUNDS` re-measured from the new GLB
  (±0.334, ±0.4725, ±0.3928).
- `CONSOLE_PLACEMENT.rotation` `[π, −0.35, 0]` → `[0, −0.35, 0]`: the B7
  console is authored upright, retiring the legacy base-up flip. The B5.1
  discipline stands — orientation is settled by render, and the transformed-
  bounds grounding (`groundAsset`) is unchanged.
- Groin anchors re-measured to the mannequin's skin surface (left vein
  y 0.102, right vein 0.103, right artery 0.068, DPC entry 0.075 at its new
  on-thigh entry (0.165, 0.125)); the DPC path now lies on the drape over the
  thigh.
- HLS module moved from (0.9, −0.05, 0.3) to (0.98, −0.02, 0.36) — within
  holder-arm reach of the console's module-facing plate instead of floating
  0.65 m away; pump inlet / oxygenator outlet / sweep cap moved with it.
- Label anchors fanned out to stop the groin and module pile-ups; default
  camera re-weighted toward the patient; fog opened 5.8 → 6.6 so the patient
  is not dimmed.
- `aria-hidden` on the 3D viewport now applies only while the canvas is live,
  so the WebGL-unavailable and context-lost fallbacks (text + reload button)
  are perceivable.
- Clamp rebuilt with jaws that straddle the tube OD.

## Before / after

| Measure                      | Before                                                 | After                                                                  |
| ---------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Console                      | 15,999 tris / 476 KB / 1 material, unrecognizable scan | 12,164 tris / 310 KB / 7 materials, recognizable CARDIOHELP silhouette |
| Patient                      | 17,726 tris / 316 KB / null-slot drape, balloon limbs  | 21,860 tris / 388 KB / 4 named materials, proportioned mannequin       |
| Clamp                        | 3,556 tris / 89 KB / jaws 0.048 m                      | 3,744 tris / 93 KB / jaws clear 0.08 m tube                            |
| Total payload                | 3.08 MB                                                | **3.15 MB** (budget 6 MB)                                              |
| Draw calls (est. default VV) | ~52                                                    | ~58 (console 1→7 primitives, patient 5→4)                              |
| Groin anchor vs skin         | +0.16 m (floating)                                     | on-skin (mesh-verified by test)                                        |

## Automated validation

- `bedside-scene-geometry.test.ts` — updated: authored-base-down under the
  new upright placement; height-is-longest-model-axis measured on the model
  box (the yawed world AABB inflates depth and says nothing about
  orientation); all label/sweep/holder contracts retained.
- `b7-asset-contracts.test.ts` (new, 16 tests) — GLB structural validity and
  finite bounds for all five runtime assets; stable node names; 6 MB budget;
  textures only in the oxygenator; the patient's full material set with no
  null slot (drape regression); supine orientation and mattress settle;
  access anchors verified **against the decoded GLB vertex positions** for
  VV and VA; DPC-over-thigh corridor; console material set; clamp jaw span
  vs tube OD.
- Full `cardiohelp-ecmo` suite green (35 suites / 1,038 tests before the new
  file; 36 / 1,054 after).

Visual correctness was judged from renders at every step; the bounding-box
metrics above are contracts, not proof of appearance.

## Rendering results

Offline harness (Blender EEVEE, both tracks, five poses each) re-rendered at
baseline, per candidate, and integrated (plus the clamped state). Adversarial
render review caught and fixed one integration defect: the 0.105 m dressing
film disc clipped through the drape window's raised rim (now 0.078 m, inside
the window, mirrored in the harness).

## Browser results (Gate 2 evidence)

Real-browser review of the integrated scene on the dev server, VV and VA
tracks, labels on and off. Label-pill overlap measured numerically —
`getBoundingClientRect` pairwise intersection over every rendered pill:

| Viewport   | VV pills / overlaps              | VA pills / overlaps |
| ---------- | -------------------------------- | ------------------- |
| 1600 × 900 | 8 / **0**                        | 9 / **0**           |
| 1440 × 900 | 8 / **0**                        | —                   |
| 1280 × 720 | 8 / **0**                        | —                   |
| 1024 × 768 | 8 / 2 corner touches (≤11×28 px) | —                   |

The baseline stacked 4–6 pills text-on-text at every size. The labels toggle
hides all pills; `aria-hidden` on the viewport verified `"true"` while the
canvas is live. The 500-error console entries during review are this
worktree's missing Supabase env (pre-existing, unrelated to the module). The
in-pane screenshots confirm the console reads as a CARDIOHELP and the patient
as a draped supine mannequin at every size, matching the harness renders.

## Known limitations

- The console carries no manufacturer branding or text (deliberate: no
  Getinge/Maquet marks), and its screen is a blank dark surface — the 3D
  scene does not model display content; the interactive console facsimile
  lives in the 2D panel.
- The console keeps the scene's ~2× display scale for legibility at laptop
  sizes (documented in `constants.ts`); the real unit is 255 × 455 × 427 mm.
- Hands are mittens with a thumb wedge; the face is deliberately featureless
  with a surgical-cap treatment (non-identifiable by design).
- The two cannulae still cross over the abdomen en route to their hubs —
  pre-existing topology kept to preserve the circuit-reading layout.
- The oxygenator scan is kept as-is: illegible/mirrored label textures,
  scan filaments near the bracket, opaque red flanks, ~2× scale, 71 % of the
  payload. A procedural HLS module rebuild is a candidate follow-up package.
- The sensor connector remains a generic fitting standing in for the flow /
  bubble sensor.
- EEVEE harness lighting approximates but does not replicate the R3F rig
  (PMREM room environment, shadow setup); browser captures are the authority
  for the shipped look.

## Owner visual approvals

- Gate 1 (candidates): **approved** — console A + patient A, 2026-08-11.
- Gate 2 (integrated scene): pending; recorded when given.

## Redistribution / licensing gate

The supplied source files (console scan, oxygenator, sensor, `Fem_Fem_legs`)
carried no license metadata. This package removes the supplied console scan
from the runtime; the oxygenator and sensor connector still derive from
supplied files, so the README's pre-release licensing confirmation gate
remains in force for those two. The console, patient and clamp are now
in-repo procedural originals with no third-party content.
