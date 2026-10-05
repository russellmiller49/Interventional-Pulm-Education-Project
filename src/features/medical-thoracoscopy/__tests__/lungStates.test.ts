/** @jest-environment node */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  anatomySurfaces,
  collisionProxies,
  fluidTable,
  GRAVITY_LPS,
  lungStates,
  portRecord,
  zoneSamples,
} from '../content/anatomy'
import { anatomyManifest } from '../content/data/generated/anatomy'
import { PLEURAL_ZONE_IDS } from '../content/pleuralZones'
import { assetLedgerSchema } from '../test-support/registerSchemas'

/**
 * The lung's states, the collision proxies, the zone samples and the fluid table, as the numbers
 * the build measured. The files are not in the repository (rights register,
 * R-ANATOMY-SEGMENTATION); `validate_lung_states.py` checks them against these records in the
 * owner's local data, and `validate_anatomy_blender.py` imports the packaged files in Blender. These
 * tests hold the records to the plan and to each other.
 */
const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path))
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const RECORDS = 'src/features/medical-thoracoscopy/content/data/anatomy'

describe('the lung states', () => {
  const { states, between, collapse } = lungStates

  it('run from the expanded lung to the measured share of the pleural space in equal steps, each smaller', () => {
    expect(states.map((state) => state.step)).toEqual(
      Array.from({ length: collapse.steps + 1 }, (_, k) => k),
    )
    expect(states.map((state) => state.flowTimeFraction)).toEqual(
      states.map((_, k) => Number((k / collapse.steps).toFixed(3))),
    )
    expect(states[0].volumeFraction).toBe(1)
    for (let k = 1; k < states.length; k += 1) {
      expect(states[k].volumeMl).toBeLessThan(states[k - 1].volumeMl)
      expect(states[k].gapAtPortMm).toBeGreaterThan(states[k - 1].gapAtPortMm)
    }
    expect(states[0].gapAtPortMm).toBeLessThan(2)
    // Where the collapse ends is a volume, the share of the drawn space measured beside large
    // effusions (owner decisions, OD-17): the flow stops at the first step at or under it.
    expect(collapse.endLungShareOfSpace).toBe(0.246)
    expect(
      Math.abs(collapse.endVolumeMl - collapse.endLungShareOfSpace * collapse.spaceVolumeMl),
    ).toBeLessThan(0.01)
    const last = states[states.length - 1].volumeMl
    expect(last).toBeLessThanOrEqual(collapse.endVolumeMl)
    expect(last).toBeGreaterThan(0.98 * collapse.endVolumeMl)
  })

  it('are labelled authored, rest on the two claims awaiting clinical review, and measure from the port', () => {
    expect(lungStates.statesLabel).toBe('Authored, illustrative')
    expect(lungStates.claims).toEqual(['MT-C-0001', 'MT-C-0002'])
    expect(collapse.portPleuraPointLps).toEqual(portRecord.pleuraPointLps)
  })

  it('never fold, pass through themselves or through the pleura, and keep off it, at every state and between', () => {
    const floor = lungStates.checks.clearanceFloorMm
    for (const state of states) expect(state.clearanceMm).toBeGreaterThanOrEqual(floor)
    expect(between.map((entry) => [entry.from, entry.to])).toEqual(
      states.slice(1).map((_, k) => [k, k + 1]),
    )
    for (const entry of between) {
      expect(entry.clearanceMm).toBeGreaterThanOrEqual(floor)
      expect(entry.checkedAt).toEqual(lungStates.checks.blendsCheckedAt)
    }
  })

  it('keep one surface of even triangles, three lobes sharing it, quantised to a hundredth of a millimetre', () => {
    expect(lungStates.lung.lobes.map((lobe) => lobe.id)).toEqual(['upper', 'middle', 'lower'])
    expect(lungStates.lung.lobes.reduce((sum, lobe) => sum + lobe.faces, 0)).toBe(
      lungStates.lung.faces,
    )
    expect(lungStates.lung.smallestAngleDeg).toBeGreaterThan(25)
    expect(lungStates.quantisation.largestErrorMm).toBeLessThan(0.01)
  })

  it('start as the lung of the scan, inside the pleural space the survey is drawn on', () => {
    expect(lungStates.lung.voxelVolumeMl).toBeLessThan(anatomySurfaces.pleuralSpace.voxelVolumeMl)
    expect(Math.abs(states[0].volumeMl - lungStates.lung.voxelVolumeMl)).toBeLessThan(
      0.01 * lungStates.lung.voxelVolumeMl,
    )
  })
})

describe('the collision proxies', () => {
  const { method, pleuralSpace, lung } = collisionProxies

  it('stay within the plan’s triangle budget', () => {
    const ledger = assetLedgerSchema.parse(
      JSON.parse(read('docs/medical-thoracoscopy/registers/asset-ledger.json').toString()),
    )
    expect(method.trianglesBudget).toBe(ledger.budgets.collisionProxyTriangles)
    expect(collisionProxies.trianglesInUse).toBe(
      pleuralSpace.faces + Math.max(...lung.states.map((state) => state.faces)),
    )
    expect(collisionProxies.trianglesInUse).toBeLessThanOrEqual(method.trianglesBudget)
  })

  it('keep the pleural space’s proxy inside the drawn surface, offset the plan’s millimetre, clear by the margin', () => {
    expect(method.offsetMm.pleuralSpace).toBe(1)
    expect(pleuralSpace.proxyFromDrawnMm[0]).toBeGreaterThanOrEqual(method.marginMm - 0.001)
    expect(pleuralSpace.drawnFromProxyMm[0]).toBeGreaterThanOrEqual(method.marginMm - 0.001)
    expect(pleuralSpace.proxyFromDrawnMm[2]).toBeLessThanOrEqual(
      method.offsetMm.pleuralSpace + method.settleLimitMm.pleuralSpace,
    )
  })

  it('give the lung one proxy per state, around it on the safe side and clear by the margin', () => {
    expect(lung.states.map((state) => state.step)).toEqual(
      lungStates.states.map((state) => state.step),
    )
    expect(method.offsetMm.lung).toBeGreaterThanOrEqual(method.offsetMm.pleuralSpace)
    for (const state of lung.states) {
      expect(state.proxyFromDrawnMm[0]).toBeGreaterThanOrEqual(method.marginMm - 0.001)
      expect(state.drawnFromProxyMm[0]).toBeGreaterThanOrEqual(method.marginMm - 0.001)
      expect(state.fieldSmoothingMm).toBeLessThanOrEqual(method.lungFieldSmoothingLimitMm)
    }
  })

  it('keep the drawn lung, halfway between two states, inside one of their two proxies', () => {
    expect(lung.halfwayBetweenStates.map((entry) => [entry.from, entry.to])).toEqual(
      lungStates.between.map((entry) => [entry.from, entry.to]),
    )
  })
})

describe('the zone samples', () => {
  it('cover every zone in the zone list’s order, area-weighted, lifted just inside the proxy', () => {
    expect(zoneSamples.zones.map((zone) => zone.id)).toEqual([...PLEURAL_ZONE_IDS])
    expect(zoneSamples.total).toBe(zoneSamples.zones.reduce((sum, zone) => sum + zone.points, 0))
    for (const zone of zoneSamples.zones) {
      const area = anatomySurfaces.pleuralSpace.zones.find((entry) => entry.id === zone.id)?.areaCm2
      const expected = Math.max(
        zoneSamples.method.minimumPerZone,
        Math.round((area ?? 0) * zoneSamples.method.perCm2),
      )
      expect(Math.abs(zone.points - expected)).toBeLessThanOrEqual(1)
      expect(zone.liftMm[0]).toBeLessThanOrEqual(zone.liftMm[1])
    }
  })
})

describe('the fluid table', () => {
  const { heightsMm, spaceMl, states } = fluidTable

  it('measures heights against gravity in the presented position, from the space’s lowest point', () => {
    expect(fluidTable.gravityLps).toEqual(GRAVITY_LPS)
    expect(heightsMm[0]).toBe(0)
    heightsMm.slice(1).forEach((height, k) => {
      expect(height - heightsMm[k]).toBeCloseTo(fluidTable.stepMm, 6)
    })
    expect(fluidTable.label).toBe('Authored, illustrative')
  })

  it('never falls as the level rises, and fills to the space less the lung at each state', () => {
    for (let k = 1; k < spaceMl.length; k += 1)
      expect(spaceMl[k]).toBeGreaterThanOrEqual(spaceMl[k - 1] - 0.01)
    expect(
      Math.abs(spaceMl[spaceMl.length - 1] - anatomySurfaces.pleuralSpace.meshVolumeMl),
    ).toBeLessThan(1)
    expect(states.map((row) => row.step)).toEqual(lungStates.states.map((state) => state.step))
    for (const row of states) {
      expect(row.fluidMl).toHaveLength(heightsMm.length)
      row.fluidMl.forEach((volume, k) => {
        expect(volume).toBeGreaterThanOrEqual(-0.01)
        if (k > 0) expect(volume).toBeGreaterThanOrEqual(row.fluidMl[k - 1] - 0.01)
      })
      const full = anatomySurfaces.pleuralSpace.meshVolumeMl - lungStates.states[row.step].volumeMl
      expect(Math.abs(row.fluidMl[row.fluidMl.length - 1] - full)).toBeLessThan(1)
    }
  })
})

describe('the packaged anatomy', () => {
  const files = anatomyManifest.files

  it('lists every file the builds made, as built', () => {
    expect(files.map((file) => file.id)).toEqual([
      'pleural-space',
      'ribs',
      'context',
      'lung-states',
      'proxy-pleural-space',
      'proxy-lung',
    ])
    const built: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(anatomySurfaces.files).map(([id, entry]) => [id, entry.sha256]),
      ),
      ...Object.fromEntries(
        Object.entries(lungStates.files).map(([id, entry]) => [id, entry.sha256]),
      ),
    }
    for (const file of files) {
      expect(file.rawSha256).toBe(built[file.id])
      expect(file.file).toBe(`${file.id}.${file.sha256.slice(0, 12)}.glb`)
      expect(file.url).toBe(`/models/medical-thoracoscopy/v1/anatomy/${file.file}`)
    }
  })

  it('was packaged from the records as they stand', () => {
    for (const [name, hash] of Object.entries(anatomyManifest.records)) {
      expect(sha256(read(join(RECORDS, name)))).toBe(hash)
    }
  })

  it('compresses the drawn surfaces and leaves the lung states and proxies as built', () => {
    const compressed = files.filter((file) => file.compression === 'Draco').map((file) => file.id)
    expect(compressed).toEqual(['pleural-space', 'ribs', 'context'])
    for (const file of files.filter((entry) => entry.compression === 'none')) {
      expect(file.sha256).toBe(file.rawSha256)
    }
  })

  it('stays within the anatomy budget', () => {
    expect(anatomyManifest.budget.limitBytes).toBe(3 * 1024 * 1024)
    expect(anatomyManifest.budget.anatomyBytes).toBe(
      files.reduce((sum, file) => sum + file.bytes, 0),
    )
    expect(anatomyManifest.budget.anatomyBytes).toBeLessThanOrEqual(
      anatomyManifest.budget.limitBytes,
    )
  })

  it('is in the ledger, held outside the repository and not uploaded', () => {
    const ledger = assetLedgerSchema.parse(
      JSON.parse(read('docs/medical-thoracoscopy/registers/asset-ledger.json').toString()),
    )
    const rows = ledger.assets.filter((asset) =>
      asset.path.startsWith('public/models/medical-thoracoscopy/v1/anatomy/'),
    )
    expect(rows.map((row) => row.id)).toEqual([...files.map((file) => file.id), 'anatomy-manifest'])
    for (const row of rows) {
      expect(row.inRepository).toBe(false)
      expect(row.uploaded).toBe(false)
      // the lung's states also rest on the scans their end volume was measured from (OD-17)
      expect(row.rights).toEqual(
        /states authored/.test(String(row.label))
          ? ['R-ANATOMY-CT', 'R-ANATOMY-SEGMENTATION', 'R-COLLAPSE-VOLUME-CTS']
          : ['R-ANATOMY-CT', 'R-ANATOMY-SEGMENTATION'],
      )
      const file = files.find((entry) => entry.id === row.id)
      if (!file) continue
      expect([row.sha256, row.bytes, row.triangles]).toEqual([
        file.sha256,
        file.bytes,
        file.triangles,
      ])
      expect(row.claims).toEqual(file.claims)
    }
  })
})
