# Cardiac teaching assets

## Realistic supplied cutaway (`heart-realistic.glb`)

The mechanical-circulatory-support and ICU-hemodynamics modules use this asset as their
shared anatomical surface. It was derived from the project-supplied
`3D assets/Heart _model.glb` without changing its geometry, skin, or animation:

- **34.4k triangles**, one skinned mesh, one looping animation (`test`).
- An anterior cutaway exposes chambers, atrioventricular valves, chordae, semilunar-valve
  region, and proximal great vessels.
- Embedded 2048 px textures were resized to 1024 px for browser delivery, reducing the GLB
  from about 17 MB to about 7.2 MB.
- The surface is a single mesh. PAC, pressure-transducer, IABP, transvalvular-pump, and LVAD
  paths are therefore project-authored overlays in a shared coordinate system rather than
  mesh-level labels from the source asset.

The overlays are educational anatomical landmarks and require clinical content review; they
are not catheter-depth, implantation, positioning, or patient-specific planning guidance.

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

## three.js / R3F

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
const gltf = await new GLTFLoader().loadAsync('/models/cardiac/heart_animated.glb')
scene.add(gltf.scene)
const mixer = new THREE.AnimationMixer(gltf.scene)
mixer.clipAction(gltf.animations[0]).play() // 'CardiacCycle', loops
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

## Node map (toggle `.visible` by name)

| Group          | Nodes                                                                                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chambers       | `HRT_LV` `HRT_RV` `HRT_RA` `HRT_LA`                                                                                                                                                                                                           |
| Valve leaflets | `HRT_LEAF_TV` `HRT_LEAF_MV` `HRT_LEAF_AoV` `HRT_LEAF_PV`                                                                                                                                                                                      |
| Valve annuli   | `HRT_ANN_TV` `HRT_ANN_MV` `HRT_ANN_AoV` `HRT_ANN_PV`                                                                                                                                                                                          |
| Great vessels  | `HRT_VES_SVC` `HRT_VES_IVC` `HRT_VES_Aorta` `HRT_VES_Brachioceph` `HRT_VES_LCarotid` `HRT_VES_LSubclav` `HRT_VES_PAtrunk` `HRT_VES_RPA` `HRT_VES_LPA` `HRT_VES_RUPV` `HRT_VES_RLPV` `HRT_VES_LUPV` `HRT_VES_LLPV` · `HRT_RVOT` (infundibulum) |
| PA / Swan-Ganz | `HRT_DEV_PACatheter` `HRT_DEV_PABalloon`                                                                                                                                                                                                      |
| Impella        | `HRT_DEV_ImpellaShaft` `HRT_DEV_ImpellaPump` `HRT_DEV_ImpellaCannula` `HRT_DEV_ImpellaPigtail`                                                                                                                                                |

Hide all devices: `obj.visible = !obj.name.startsWith('HRT_DEV_')`.
Device paths: PA catheter runs SVC→RA→tricuspid→RV→RVOT→pulmonic→PA(wedge);
Impella runs descending aorta→arch→ascending→aortic valve→LV (pigtail in apex).

## Source

`3D assets/Cardiac/animated_heart.blend` — fully parametric; all chamber/valve/vessel/device
coordinates live in the `HRT_params` text datablock inside the file. Re-run the generator
scripts to regenerate and re-export.

## Known simplifications (v1)

- Valve leaflets are stylized curved cusps (correct count + coaptation), not fully
  anatomical (no chordae/papillary detail).
- Myocardial walls contract as a volume; wall-thickening is implied, not explicitly modeled.
- Coronary arteries not included.
