import { acquired } from '../testing/linked-fixture'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isEbusObservation, type EbusObservation } from '@/lib/ebus-guided-bridge'
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

const scan = acquired('station-seven')
it('requires the relevant landmark and independently acquired station 7 views', () => {
  const lab = LESSONS.find((l) => l.id === 'station-seven')!.lab!
  expect(labGoalMet(lab, scan)).toBe(true)
  for (const patch of [
    { identifiedStructures: ['aorta'] },
    { assetsReady: false },
    { sweeps: { rms: scan.linked!.sweeps!.rms } },
    { sweeps: {} },
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
it('requires the actual task identity, checked landmarks and baseline where applicable', () => {
  const lab = (id: string) => LESSONS.find((l) => l.id === id)!.lab!
  expect(
    labGoalMet(lab('ct-map'), {
      ...acquired('ct-map'),
      linked: { ...acquired('ct-map').linked!, modelSectionViewed: false },
    }),
  ).toBe(false)
  for (const id of [
    'ct-map',
    'scope-orientation',
    'right-paratracheal',
    'acoustic-contact',
  ] as const) {
    const state = acquired(id)
    expect(labGoalMet(lab(id), state)).toBe(true)
    expect(labGoalMet(lab(id), scan)).toBe(false)
    expect(labGoalMet(lab(id), { ...state, linked: { ...state.linked!, source: undefined } })).toBe(
      false,
    )
  }
  expect(
    labGoalMet(lab('right-paratracheal'), {
      ...acquired('right-paratracheal'),
      linked: { ...acquired('right-paratracheal').linked!, identifiedStructures: ['azygous'] },
    }),
  ).toBe(false)
  expect(
    isEbusObservation({
      ...scan,
      linked: { ...scan.linked, scannedApproaches: ['unsupported-route'] },
    }),
  ).toBe(false)
  expect(
    isEbusObservation({
      ...scan,
      linked: { ...scan.linked, source: { ...scan.linked!.source, taskVersion: 1 } },
    }),
  ).toBe(false)
  expect(labGoalMet(lab('station-seven'), { ...scan, roll: 10 })).toBe(false)
  const transfer = LESSONS.find((l) => l.id === 'station-seven')!.transferLab!
  expect(labGoalMet(transfer, scan)).toBe(false)
  expect(labGoalMet(transfer, acquired('station-seven', 'changed-window'))).toBe(true)
})
