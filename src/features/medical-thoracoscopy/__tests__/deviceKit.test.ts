/** @jest-environment node */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { deviceKitManifest } from '../content/data/generated/deviceKit'
import {
  deviceDefinitions,
  modelledNumber,
  prototypeDevices,
  publishedNumber,
} from '../content/deviceDefinitions'
import { deviceGeometryDigest } from '../content/deviceKitDigest'
import { assetLedgerSchema } from '../test-support/registerSchemas'

/**
 * The device kit as committed: its manifest, its files and the facts it was built from. The models
 * themselves are checked against the definitions by `scripts/medical-thoracoscopy/validate_device_kit.py`
 * and, after compression, in Blender by `validate_device_kit_blender.py`. These tests hold the
 * committed kit to the committed definitions, so a model can never drift from its facts unseen.
 */
const root = process.cwd()
const devicesDir = join(root, 'public/models/medical-thoracoscopy/v1/devices')

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function model(id: string) {
  const entry = deviceKitManifest.models.find((candidate) => candidate.id === id)
  if (!entry) throw new Error(`No model ${id}`)
  return entry
}

function anchor(id: string, name: string) {
  const anchors = model(id).anchors as Record<string, { position: readonly number[] }>
  const found = anchors[name]
  if (!found) throw new Error(`No anchor ${id}.${name}`)
  return found.position
}

describe('device kit', () => {
  it('was built from the device definitions as they are now', () => {
    expect(deviceKitManifest.geometryDigest).toBe(deviceGeometryDigest(deviceDefinitions))
  })

  it('was built by the generator as it is now', () => {
    const generator = readFileSync(join(root, deviceKitManifest.generator))

    expect(deviceKitManifest.generatorSha256).toBe(sha256(generator))
  })

  it('is the manifest served beside the models, copied for page code', () => {
    const served = JSON.parse(readFileSync(join(devicesDir, 'manifest.json'), 'utf8')) as unknown

    expect(served).toEqual(JSON.parse(JSON.stringify(deviceKitManifest)))
  })

  it('serves exactly the files it lists, each named by its content', () => {
    const files = readdirSync(devicesDir).filter((name) => name !== 'manifest.json')

    expect(files.sort()).toEqual(deviceKitManifest.models.map((entry) => entry.file).sort())
    for (const entry of deviceKitManifest.models) {
      const bytes = readFileSync(join(devicesDir, entry.file))

      expect(sha256(bytes)).toBe(entry.sha256)
      expect(bytes.length).toBe(entry.bytes)
      expect(entry.file).toBe(`${entry.id}.${entry.sha256.slice(0, 12)}.glb`)
      expect(entry.url).toBe(`/models/medical-thoracoscopy/v1/devices/${entry.file}`)
    }
  })

  it('models every part the definitions say is modelled, and the three prototype parts in full', () => {
    const modelled = deviceDefinitions.devices.filter((device) => device.modelled)

    for (const device of modelled) expect(() => model(device.id)).not.toThrow()
    expect(
      deviceKitManifest.models.filter((entry) => entry.inPrototype).map((entry) => entry.id),
    ).toEqual(prototypeDevices.map((device) => device.id))
    for (const device of prototypeDevices) expect(model(device.id).standard).toBe('full')
  })

  it('stays within the device budgets', () => {
    for (const entry of deviceKitManifest.models) {
      expect(entry.bytes).toBeLessThanOrEqual(2.5 * 1024 * 1024)
      expect(entry.triangles).toBeLessThanOrEqual(50_000)
    }
    const prototype = deviceKitManifest.models.filter((entry) => entry.inPrototype)
    expect(prototype.reduce((sum, entry) => sum + entry.triangles, 0)).toBeLessThan(50_000)
  })

  it('carries the label and says what it is not', () => {
    expect(deviceKitManifest.label).toBe(deviceDefinitions.labelUntilCad)
    expect(deviceKitManifest.statement).toMatch(/None is manufacturer CAD/)
    expect(deviceKitManifest.statement).toMatch(/R-DEVICE-MODELS/)
    expect(JSON.stringify(deviceKitManifest)).not.toMatch(/wolf|eragon|endocam|endolight|panoview/i)
  })

  it('puts the anchors the space engine uses where the definitions put them', () => {
    const telescope = 'operative-telescope'

    expect(anchor(telescope, 'distalFace')).toEqual([0, 0, 0])
    expect(anchor(telescope, 'opticalOrigin')[1]).toBeCloseTo(
      modelledNumber(telescope, 'opticOffsetOnTip').value,
      4,
    )
    expect(anchor(telescope, 'channelExit')[1]).toBeCloseTo(
      -modelledNumber(telescope, 'channelExitOnTip').value,
      4,
    )
    expect(anchor(telescope, 'channelEntry')[2]).toBeCloseTo(
      modelledNumber(telescope, 'channelLength').value,
      4,
    )
    expect(anchor(telescope, 'workingLengthEnd')[2]).toBe(publishedNumber(telescope, 'shaftLength'))

    const sleeve = 'trocar-sleeve-flexible'
    expect(anchor(sleeve, 'headUnderside')[2]).toBe(publishedNumber(sleeve, 'workingLength'))

    const forceps = 'double-spoon-forceps'
    expect(anchor(forceps, 'handleFront')[2]).toBe(publishedNumber(forceps, 'sheathLength'))
    expect(anchor(forceps, 'jawHinge')[2] - anchor(forceps, 'toolTip')[2]).toBeCloseTo(
      publishedNumber(forceps, 'jawLength'),
      4,
    )
    expect(model(forceps).extras).toMatchObject({
      jawOpeningDeg: modelledNumber(forceps, 'jawOpeningAngle').value,
    })
    expect(model(telescope).extras).toMatchObject({
      fieldOfViewDeg: modelledNumber(telescope, 'fieldOfView').value,
      fieldOfViewCategory: 'authored simulation assumption',
    })
  })

  it('is listed in the asset ledger, not uploaded', () => {
    const ledger = assetLedgerSchema.parse(
      JSON.parse(
        readFileSync(join(root, 'docs/medical-thoracoscopy/registers/asset-ledger.json'), 'utf8'),
      ),
    )
    const rows = ledger.assets.filter((asset) =>
      asset.path.startsWith('public/models/medical-thoracoscopy/v1/devices/'),
    )

    expect(rows.map((row) => row.id).sort()).toEqual(
      [...deviceKitManifest.models.map((entry) => entry.id), 'device-kit-manifest'].sort(),
    )
    for (const row of rows) {
      expect(row.uploaded).toBe(false)
      expect(row.rights).toEqual(['R-DEVICE-MODELS'])
      if (row.kind === 'device') {
        const entry = model(row.id)
        expect(row.sha256).toBe(entry.sha256)
        expect(row.bytes).toBe(entry.bytes)
        expect(row.triangles).toBe(entry.triangles)
      }
    }
    const manifestBytes = readFileSync(join(devicesDir, 'manifest.json'))
    const manifestRow = rows.find((row) => row.kind === 'manifest')
    expect(manifestRow?.sha256).toBe(sha256(manifestBytes))
  })
})
