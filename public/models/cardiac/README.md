# Cardiac teaching assets

## CT-derived runtime heart (`heart-ct-animated-v1.glb`)

The mechanical-circulatory-support and ICU-hemodynamics modules use this shared anatomical
surface. It is rebuilt from the project-supplied Slicer export
`3D assets/Slicer Cardiac_model/Heart_final.gltf`:

The application loads the versioned `-v1` URL so a previously cached model cannot replace this CT
revision. `heart-ct-animated.glb` is retained as a byte-identical compatibility alias only. Bump
the filename version, manifest URL, and shared rig together when shipping a visibly changed model.

- **117,802 triangles**, 1.56 MB, Draco-compressed GLB.
- Separate CT-derived chamber, myocardial, aortic, caval, pulmonary-artery, pulmonary-vein,
  LVOT, and aortic-valve meshes with stable `CT_*` node names.
- Separate right-coronary, non-coronary, and left-coronary cusp surfaces are extracted from
  `extraction/Heart_final.seg.nrrd`; each has a coordinated, attachment-weighted `ValveOpen` morph
  target. The static cusp morphology is segmented; the opening deformation is illustrative rather
  than measured 4D valve motion.
- One looping **`CardiacCycle`** clip (2 s at 24 fps) coordinates structure-specific ventricular,
  atrial, and great-vessel morph targets. This is an educational motion field applied to static
  anatomy, not a patient-specific 4D CT reconstruction.
- LPS millimetres are baked into the web frame as `[L, S, -P]`, using the same transform as the
  generated device trajectories in `cardiac-ct-rig.json`.
- The irrelevant 95k-triangle tracheobronchial segmentation and unusable tiny left
  brachiocephalic-vein artifact are excluded from the teaching surface.

Only the aortic valve has complete segmented morphology. The supplied mitral, tricuspid, and
pulmonic segments mark general locations rather than true leaflet morphology, so those three
surfaces are excluded. Reviewed tricuspid and pulmonic interface/orifice gates are retained as
named spline-validation anchors; no mitral morphology or anchor is shipped. Mitral leaflet or
chordal clearance cannot be assessed in this model.

## CT-derived device trajectories

`scripts/cardiac-assets/build-ct-centerlines.mjs` reads the Slicer LPS `.mrk.json` curves,
stitches separate structures through segmentation-interface gates, resamples by arc length, and
writes `src/features/cardiac-anatomy/content/cardiac-ct-rig.json`.

- PAC: SVC → RA → tricuspid-location gate → RV → RVOT/pulmonic-location gate → main/right PA,
  with a separate transient balloon-occlusion state at the final PA location.
- Impella CP: the learner-visible femoral/retrograde course enters at the distal-aortic CT boundary,
  then follows the CT-derived aorta → arch → aortic root → fully segmented aortic valve → LVOT →
  reviewed LV inlet landmark. Femoral and iliac anatomy are outside this CT.
- Impella 5.5: an explicitly authored axillary-graft access boundary joins the CT-derived aorta,
  then follows the aortic root → fully segmented aortic valve → LVOT → reviewed LV inlet landmark.
  No axillary, subclavian, or surgical-graft centerline was supplied.
- Impella RP: CT-derived IVC → RA → tricuspid-location gate → RV → RVOT →
  pulmonic-location gate → PA. The correct outlet is calibrated on the rendered open centripetal
  Catmull–Rom route at exactly 205 mm from the preserved IVC inlet and projects within 0.14 mm of
  the supplied main-PA (`Pulmonary Artery (0)`) centerline between source points 26→27. The
  unsmoothed 205 mm source-polyline reference (points 16→17) is retained separately in the rig's
  provenance. The too-proximal state is staged at 190 mm, and the too-distal state continues
  through the remaining PA0, PA1, and PA4 points. The tricuspid and pulmonic gates constrain the
  route but do not imply segmented leaflet morphology.
- VV ECMO: femoral/IVC drainage plus jugular/SVC return.
- Peripheral VA ECMO: femoral/IVC-to-SVC/RA drainage plus an explicitly schematic inferior
  arterial boundary extension; retrograde aortic **flow** is stored and rendered separately.

The supplied extraction has no LV centerline, iliac/femoral centerlines, axillary centerline, or
surgical-graft centerline. The CP and 5.5 valve-to-LV segments therefore use reviewed authored LPS
landmarks placed against the supplied aortic-valve, LVOT, and LV segmentation surfaces. The 5.5
access segment is an authored boundary rather than CT-derived vasculature. Centerline-to-chamber
joins likewise use explicit reviewed authored interface landmarks stored in the generator.
Peripheral ECMO access outside the CT field is represented only by a labeled schematic boundary
extension. These provenance boundaries are machine-readable in the generated rig.

Rebuild and validate:

```sh
npm run cardiac:ct-assets
npm run validate:cardiac-assets
```

All geometry and paths are educational anatomy. They are not catheter-depth, cannula-size,
implantation, positioning, access, or patient-specific planning guidance.

## Legacy realistic cutaway (`heart-realistic.glb`)

The prior 7.2 MB supplied cutaway remains for provenance and visual comparison but is no longer
the shared runtime heart.

## Original project-authored model (`heart_animated.glb`)

Clean, web-optimized beating heart built for procedural teaching modules
(PA-catheter float, Impella placement, systole/diastole timing).

- **~35.8k triangles**, ~1 MB GLB.
- **Animation:** one looping clip **`CardiacCycle`** (~2 s @ 24 fps) driving morph
  targets: ventricular contraction + atrial kick + physiologic valve open/close.
- **Orientation:** baked in-situ anatomical tilt (apex antero-inferior-left) via the
  `HRT_root` node. Re-orient by rotating that node if you prefer upright.
- **Color convention:** deoxygenated = blue (RA, RV, SVC/IVC, pulmonary arteries),
  oxygenated = red (LA, LV, aorta + arch branches, pulmonary veins).

## CT runtime loading (three.js / R3F)

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
const gltf = await new GLTFLoader().loadAsync('/models/cardiac/heart-ct-animated-v1.glb')
scene.add(gltf.scene)
const mixer = new THREE.AnimationMixer(gltf.scene)
const clip = THREE.AnimationClip.findByName(gltf.animations, 'CardiacCycle')
mixer.clipAction(clip).play()
// in your render loop: mixer.update(delta)
```

Scrub a specific phase instead of playing:

```js
const action = mixer.clipAction(gltf.animations[0])
action.play()
action.paused = true
action.time = phase01 * gltf.animations[0].duration // phase01 in [0,1]
mixer.update(0)
```

## Original-model node map (legacy; not present in the CT runtime GLB)

| Group          | Nodes                                                                                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chambers       | `HRT_LV` `HRT_RV` `HRT_RA` `HRT_LA`                                                                                                                                                                                                           |
| Valve leaflets | `HRT_LEAF_TV` `HRT_LEAF_MV` `HRT_LEAF_AoV` `HRT_LEAF_PV`                                                                                                                                                                                      |
| Valve annuli   | `HRT_ANN_TV` `HRT_ANN_MV` `HRT_ANN_AoV` `HRT_ANN_PV`                                                                                                                                                                                          |
| Great vessels  | `HRT_VES_SVC` `HRT_VES_IVC` `HRT_VES_Aorta` `HRT_VES_Brachioceph` `HRT_VES_LCarotid` `HRT_VES_LSubclav` `HRT_VES_PAtrunk` `HRT_VES_RPA` `HRT_VES_LPA` `HRT_VES_RUPV` `HRT_VES_RLPV` `HRT_VES_LUPV` `HRT_VES_LLPV` · `HRT_RVOT` (infundibulum) |
| PA / Swan-Ganz | `HRT_DEV_PACatheter` `HRT_DEV_PABalloon`                                                                                                                                                                                                      |
| Impella        | `HRT_DEV_ImpellaShaft` `HRT_DEV_ImpellaPump` `HRT_DEV_ImpellaCannula` `HRT_DEV_ImpellaPigtail`                                                                                                                                                |

In the original project-authored model, hide all devices with
`obj.visible = !obj.name.startsWith('HRT_DEV_')`. Its embedded device paths are: PA catheter runs
SVC→RA→tricuspid→RV→RVOT→pulmonic→PA(wedge);
Impella runs descending aorta→arch→ascending→aortic valve→LV (pigtail in apex).

## Original-model source

`3D assets/Cardiac/animated_heart.blend` — fully parametric; all chamber/valve/vessel/device
coordinates live in the `HRT_params` text datablock inside the file. Re-run the generator
scripts to regenerate and re-export.

## Original-model known simplifications (v1)

- Valve leaflets are stylized curved cusps (correct count + coaptation), not fully
  anatomical (no chordae/papillary detail).
- Myocardial walls contract as a volume; wall-thickening is implied, not explicitly modeled.
- Coronary arteries not included.
