/**
 * Compatibility wrapper: the case pipeline now lives in
 * scripts/thoracic-ultrasound/generate-thoracic-case-assets.mjs. This wrapper
 * keeps the historical CLI and emits the same legacy v1 pleural case.json
 * (the runtime loader accepts both v1 and schemaVersion-2 manifests).
 *
 * Usage: node scripts/pleural-ultrasound/generate-pleural-sim-assets.mjs [sourceDir] [outputDir]
 */
import path from 'node:path'

import { generateCasePackage } from '../thoracic-ultrasound/generate-thoracic-case-assets.mjs'

const repoRoot = process.cwd()
const sourceDir = process.argv[2] ?? path.join(repoRoot, 'Pleural_effusion_simulation')
const outputDir =
  process.argv[3] ??
  path.join(
    repoRoot,
    'public',
    'module-assets',
    'v1',
    'pleural-ultrasound-simulator',
    'pleural-effusion-001',
  )

generateCasePackage({
  sourceDir,
  outputDir,
  caseId: 'pleural-effusion-001',
  baseUrl: '/module-assets/v1/pleural-ultrasound-simulator/pleural-effusion-001/',
  schema: 'pleural-v1',
  segmentationFileName: '19_CT_HR segmentation_final.seg.nrrd',
  meshFileName: 'effusion_model.glb',
  probeFileName: 'ultrasound probe.glb',
  plusToolkit: {
    status: 'planned-offline-frame-generation',
    simulatorDevice: 'UsSimulator',
    recommendedMode: 'offline-frame-cache',
    sourceUrls: [
      'https://pluslib.readthedocs.io/en/latest/devices/DeviceUsSimulatorVideo.html',
      'https://pluslib.readthedocs.io/en/latest/getting-started/build-instructions.html',
      'https://plustoolkit.github.io/features.html',
    ],
    requiredSurfaceModels: [
      'skin.stl',
      'muscle.stl',
      'rib.stl',
      'lung.stl',
      'pleural-fluid.stl',
      'diaphragm.stl',
      'liver.stl',
      'spleen.stl',
      'heart.stl',
      'great-vessels.stl',
    ],
    notes: [
      'PLUS is a native C++/PlusServer workflow, so this browser module should consume cached images or atlases generated offline rather than attempting to run PlusLib in Next.js.',
      'The Plus UsSimulator device models B-mode from surface meshes with acoustic material parameters and scan conversion; export one STL per relevant Slicer segment for that pipeline.',
      'Generated Plus frames can be indexed by the same probe pose fields used by this module and substituted ahead of the educational browser ray marcher.',
    ],
  },
})
