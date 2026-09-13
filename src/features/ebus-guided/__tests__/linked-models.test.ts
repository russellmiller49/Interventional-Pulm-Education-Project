import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  EMPTY_EBUS_OBSERVATION,
  isEbusObservation,
  type EbusObservation,
} from '@/lib/ebus-guided-bridge'
import { LESSONS } from '../content/curriculum'
import { labGoalMet } from '../content/types'

const caseRoot = resolve('EBUS-course/apps/web/public/simulator/case-001')
const output = resolve(caseRoot, 'models/guided-v1')
const json = (file: string) => JSON.parse(readFileSync(resolve(output, file), 'utf8'))
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')
it('ships the exact assets, case dependencies and Slicer round-trip proof used by the browser', () => {
  const manifest = json('asset-manifest.json'),
    proof = json('geometry-validation.json')
  expect(manifest.assets).toHaveLength(4)
  for (const asset of manifest.assets) {
    const raw = readFileSync(resolve(output, asset.path))
    expect(sha(resolve(output, asset.path))).toBe(asset.sha256)
    expect(raw.length).toBe(asset.bytes)
    const gltf = JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)).toString())
    expect(gltf.asset.version).toBe('2.0')
    expect(gltf.nodes.some((n: { extras?: { semanticId: string } }) => n.extras?.semanticId)).toBe(
      true,
    )
    expect(proof.assets.find((a: { path: string }) => a.path === asset.path)?.sha256).toBe(
      asset.sha256,
    )
  }
  expect(sha(resolve(caseRoot, 'models/simplified_sim_model.glb'))).toBe(
    manifest.sourceGeometrySha256,
  )
  expect(sha(resolve(caseRoot, 'geometry/centerlines.json'))).toBe(manifest.centerlineSha256)
  expect(sha(resolve(caseRoot, 'geometry/acoustic-v2.u8.gz'))).toBe(manifest.acousticDataSha256)
  expect(proof.anatomy).toHaveLength(29)
  expect(
    proof.anatomy.every((row: { maxRoundTripErrorMm: number }) => row.maxRoundTripErrorMm < 0.002),
  ).toBe(true)
  expect(proof.tipMaxRoundTripErrorMm).toBeLessThan(0.002)
  expect(proof.clinicalAnatomicalReview).toBe('pending')
})

const scan: EbusObservation = {
  ...EMPTY_EBUS_OBSERVATION,
  ready: true,
  frameReady: true,
  actionCount: 1,
  lastAction: 'roll',
  usedControls: ['roll'],
  contactQuality: 1,
  targetVisible: true,
  linked: {
    assetsReady: true,
    selectedStructure: 'carina',
    modelSectionViewed: true,
    approach: 'lms',
    scannedApproaches: ['rms', 'lms'],
    frameId: 'actual-frame',
  },
}
it('requires the relevant landmark and independently acquired station 7 views', () => {
  const lab = LESSONS.find((l) => l.id === 'station-seven')!.lab!
  expect(labGoalMet(lab, scan)).toBe(true)
  for (const patch of [
    { selectedStructure: 'aorta' },
    { assetsReady: false },
    { scannedApproaches: ['rms'] as const },
    { scannedApproaches: [] },
    { frameId: '' },
  ]) {
    expect(
      labGoalMet(lab, {
        ...scan,
        linked: { ...scan.linked!, ...patch } as EbusObservation['linked'],
      }),
    ).toBe(false)
  }
  expect(labGoalMet(lab, { ...scan, actionCount: 0 })).toBe(false)
  expect(labGoalMet(lab, { ...scan, frameReady: false })).toBe(false)
  expect(labGoalMet(lab, { ...scan, targetVisible: false })).toBe(false)
  expect(labGoalMet(lab, { ...scan, contactQuality: 0.2 })).toBe(false)
})
it('requires section review, device identification and the azygos landmark in their respective lessons', () => {
  const lab = (id: string) => LESSONS.find((l) => l.id === id)!.lab!
  expect(
    labGoalMet(lab('ct-map'), { ...scan, linked: { ...scan.linked!, modelSectionViewed: false } }),
  ).toBe(false)
  expect(labGoalMet(lab('scope-orientation'), scan)).toBe(false)
  expect(
    labGoalMet(lab('scope-orientation'), {
      ...scan,
      linked: { ...scan.linked!, selectedStructure: 'transducer_face' },
    }),
  ).toBe(true)
  expect(labGoalMet(lab('right-paratracheal'), scan)).toBe(false)
  expect(
    labGoalMet(lab('right-paratracheal'), {
      ...scan,
      linked: { ...scan.linked!, selectedStructure: 'azygous' },
    }),
  ).toBe(true)
  expect(
    isEbusObservation({
      ...scan,
      linked: { ...scan.linked, scannedApproaches: ['unsupported-route'] },
    }),
  ).toBe(false)
})
