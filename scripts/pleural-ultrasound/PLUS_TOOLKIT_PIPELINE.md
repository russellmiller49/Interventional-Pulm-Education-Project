# PLUS Toolkit pipeline for pleural ultrasound frames

PLUS is best used here as an offline or sidecar frame generator, not as code that runs directly in the Next.js browser app. The browser module should keep the current interaction model and load cached PLUS-generated images or atlases when they exist.

## Why PLUS

- PLUS includes a native `UsSimulator` device that generates B-mode images from multiple moving surface meshes with acoustic material properties.
- PLUS supports OpenIGTLink transforms, so the same probe pose values used by this module can be replayed into a PlusServer scene.
- PLUS supports RF processing and scan conversion for linear and curvilinear transducers.
- PlusBuild is the practical build path for PlusLib, PlusApp, VTK, ITK, OpenIGTLink, and related dependencies.

## Proposed workflow

1. Export individual Slicer surfaces as STL files:
   - `skin.stl`
   - `muscle.stl`
   - `rib.stl`
   - `lung.stl`
   - `pleural-fluid.stl`
   - `diaphragm.stl`
   - `liver.stl`
   - `spleen.stl`
2. Build/install PLUS with PlusBuild.
3. Start from `plus/PlusDeviceSet_PleuralEffusionSimulator.template.xml`, then adjust acoustic material parameters and paths.
4. Sweep a grid of probe poses matching `PleuralProbeState`.
5. Capture generated frames as PNG/WebP plus a `frames.json` index containing lateral, posterior, cranial/caudal, tilt, rotation, depth, and gain.
6. Add the frame set URL to `case.json`; the browser can then prefer nearest-neighbor/interpolated cached frames and fall back to the current educational ray-march engine when no cached frame is available.

## Notes

The current generated case manifest includes a `plusToolkit` section with the required surface model list and references. This is intentional metadata for the future frame-cache loader and for avoiding another round of hand-tuned browser physics when higher fidelity is needed.
