/**
 * Regenerate the pleural-effusion-001 labelmap so the acoustic B-mode model
 * carries the FULL segmented anatomy (abdominal organs, mediastinum, great
 * vessels, airway, spine, bilateral effusions) instead of only the original
 * pleural subset.
 *
 * The source `19_CT_HR segmentation_final.seg.nrrd` is a 5-layer Slicer export
 * whose leaf segment names are terse and reused across layers ("right" is a
 * kidney in layer 0 and a pleural effusion in layer 3), so a name-only mapping
 * cannot disambiguate them. This script supplies an explicit per-(layer,
 * labelValue) resolver derived from the segmentation header cross-referenced
 * with the fully-named GLB meshes (aorta, inferior vena cava, upper lobe of
 * right lung, portal vein and splenic vein, ...).
 *
 * It regenerates only the derived labelmap + label bookkeeping and merges them
 * into the existing case.json IN PLACE, preserving the curated probe defaults,
 * frame atlas, objectives, and geometry. Raw CT/segmentation stay local.
 *
 *   node scripts/thoracic-ultrasound/regenerate-pleural-full-anatomy.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { generateCasePackage } from './generate-thoracic-case-assets.mjs'
import { pleuralEffusion001CardiacModel } from './pleural-effusion-001-cardiac-model.mjs'

const repoRoot = process.cwd()
const sourceDir = path.join(repoRoot, 'Pleural_effusion_simulation')
const caseDir = path.join(
  repoRoot,
  'public/module-assets/v1/pleural-ultrasound-simulator/pleural-effusion-001',
)
const caseId = 'pleural-effusion-001'

// Codes 0-12 stay exactly as the original pleural case (7 = pleuralFluid is
// asserted by tests and referenced by the frame atlas); new anatomy takes the
// next free codes.
const labelCodes = {
  background: 0,
  skin: 1,
  subcutaneousTissue: 2,
  intercostalMuscle: 3,
  rib: 4,
  lung: 5,
  atelectaticLung: 6,
  pleuralFluid: 7,
  septation: 8,
  debris: 9,
  diaphragm: 10,
  liver: 11,
  spleen: 12,
  kidney: 13,
  pancreas: 14,
  gallbladder: 15,
  stomach: 16,
  esophagus: 17,
  thyroid: 18,
  heart: 19,
  airway: 20,
  aorta: 21,
  venaCava: 22,
  pulmonaryVessel: 23,
  portalVein: 24,
  spine: 25,
  thoracicCavity: 26,
  muscle: 27,
}

// Higher priority wins when overlapping layers cover the same downsampled
// voxel. Bone dominates (shadow); the thoracic-cavity container is lowest so
// every specific structure shows through it; the diaphragm curtain edges out
// the effusion where they abut; the portal vein wins over surrounding liver.
const priorityByLabelName = {
  thoracicCavity: 3,
  subcutaneousTissue: 5,
  muscle: 10,
  skin: 15,
  lung: 30,
  heart: 42,
  stomach: 44,
  esophagus: 44,
  liver: 46,
  spleen: 46,
  kidney: 46,
  pancreas: 46,
  gallbladder: 48,
  thyroid: 48,
  airway: 50,
  pulmonaryVessel: 58,
  aorta: 60,
  venaCava: 60,
  portalVein: 62,
  pleuralFluid: 65,
  diaphragm: 68,
  rib: 90,
  spine: 90,
}
const labelPriority = { [labelCodes.background]: 0 }
for (const [name, priority] of Object.entries(priorityByLabelName)) {
  labelPriority[labelCodes[name]] = priority
}

// Explicit segment map: "<layer>:<labelValue>" -> canonical label name.
// Derived from the .seg.nrrd Segment*_Layer / Segment*_LabelValue header
// fields, disambiguated against the named GLB meshes.
const segmentLabelByLayerValue = {
  // layer 0 - abdomen / neck / vessels / skeleton
  '0:1': 'spleen',
  '0:2': 'kidney', // right kidney
  '0:3': 'kidney', // left kidney
  '0:4': 'gallbladder',
  '0:5': 'rib', // "bone" (whole skeleton surface)
  '0:6': 'muscle',
  '0:71': 'stomach',
  '0:73': 'esophagus',
  '0:74': 'thyroid',
  '0:75': 'pancreas',
  '0:76': 'lung', // upper lobe
  '0:78': 'lung', // upper lobe
  '0:79': 'lung', // middle lobe
  '0:82': 'spine',
  '0:83': 'aorta',
  '0:84': 'venaCava', // superior vena cava
  '0:86': 'portalVein', // portal + splenic vein
  '0:87': 'venaCava', // inferior vena cava
  // layer 1 - liver / airway / cavity / heart
  '1:1': 'liver',
  '1:2': 'airway', // trachea + bronchus
  '1:3': 'thoracicCavity',
  '1:4': 'heart',
  // layer 2 - lower lobes / skin
  '2:1': 'lung', // lower lobe
  '2:2': 'lung', // lower lobe
  '2:3': 'skin',
  // layer 3 - pulmonary arteries / bilateral effusions
  '3:1': 'pulmonaryVessel',
  '3:2': 'pleuralFluid', // left pleural effusion
  '3:3': 'pleuralFluid', // right pleural effusion
  // layer 4 - pulmonary veins / diaphragm
  '4:1': 'pulmonaryVessel',
  '4:2': 'diaphragm',
}

function resolveSegmentLabel(segment) {
  const key = `${segment.layer}:${segment.labelValue}`
  return segmentLabelByLayerValue[key] ?? null
}

function main() {
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pleural-full-anatomy-'))

  const { manifest: staged } = generateCasePackage({
    sourceDir,
    outputDir: stagingDir,
    caseId,
    baseUrl: `/module-assets/v1/pleural-ultrasound-simulator/${caseId}/`,
    schema: 'pleural-v1',
    segmentationFileName: '19_CT_HR segmentation_final.seg.nrrd',
    meshFileName: 'effusion_model.glb',
    probeFileName: 'ultrasound probe.glb',
    labelCodes,
    labelPriority,
    resolveSegmentLabel,
  })

  const nameByCode = Object.fromEntries(
    Object.entries(labelCodes).map(([name, code]) => [code, name]),
  )

  // Keep only codes that actually received voxels (plus background) so the
  // scene's structure list has no dead toggles.
  const populatedCodes = Object.entries(staged.labelCounts)
    .filter(([code, count]) => Number(code) === 0 || count > 0)
    .map(([code]) => Number(code))
    .sort((a, b) => a - b)

  const labels = {}
  const labelCounts = {}
  for (const code of populatedCodes) {
    labels[code] = nameByCode[code]
    labelCounts[code] = staged.labelCounts[code]
  }

  const caseJsonPath = path.join(caseDir, 'case.json')
  const live = JSON.parse(fs.readFileSync(caseJsonPath, 'utf8'))

  live.labels = labels
  live.labelCounts = labelCounts
  live.labelBoundsLpsMm = staged.labelBoundsLpsMm
  live.cardiacModel = pleuralEffusion001CardiacModel
  live.description =
    'Derived educational case from a de-identified chest-CT Slicer segmentation: ' +
    'chest wall, ribs and spine, both lungs, bilateral pleural effusions, diaphragm, ' +
    'liver, spleen, both kidneys, pancreas, gallbladder, stomach, adrenal-level vessels ' +
    '(aorta, SVC/IVC, pulmonary and portal/splenic veins), heart, esophagus, trachea, and thyroid.'

  fs.writeFileSync(caseJsonPath, `${JSON.stringify(live, null, 2)}\n`)

  // Swap the labelmap binary into the live case directory.
  fs.copyFileSync(
    path.join(stagingDir, `${caseId}.labelmap.uint8.bin`),
    path.join(caseDir, `${caseId}.labelmap.uint8.bin`),
  )

  fs.rmSync(stagingDir, { recursive: true, force: true })

  console.log('Regenerated', path.join(caseDir, `${caseId}.labelmap.uint8.bin`))
  console.log('Updated', caseJsonPath)
  console.log('\nPopulated structures (code -> label : voxels):')
  for (const code of populatedCodes) {
    if (code === 0) continue
    const box = staged.labelBoundsLpsMm[nameByCode[code]]
    const center = box
      ? `center L≈${((box.min[0] + box.max[0]) / 2).toFixed(0)} P≈${(
          (box.min[1] + box.max[1]) / 2
        ).toFixed(0)} S≈${((box.min[2] + box.max[2]) / 2).toFixed(0)}`
      : ''
    console.log(
      `  ${String(code).padStart(2)} -> ${nameByCode[code].padEnd(18)} ${String(
        labelCounts[code],
      ).padStart(8)}  ${center}`,
    )
  }
}

main()
