/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  anatomySurfaces,
  GRAVITY_LPS,
  portCandidates,
  portRecord,
  PRESENTATION_FROM_LPS,
  presentFromLps,
  rightRibs,
  sourceAudit,
} from '../content/anatomy'
import { deviceDefinitions } from '../content/deviceDefinitions'
import { PLEURAL_ZONE_IDS, pleuralZoneList } from '../content/pleuralZones'

/**
 * The thorax anatomy, as the numbers the build measured. The surfaces are not in the repository
 * (rights register, R-ANATOMY-SEGMENTATION); the Python validator checks the files themselves
 * against these records in the owner's local data. These tests hold the records to the plan and
 * to each other.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('the presented position', () => {
  it('is one rotation, the same in the records as in the code', () => {
    expect(anatomySurfaces.presentationFromLps).toEqual(PRESENTATION_FROM_LPS)
    expect(anatomySurfaces.gravityLps).toEqual(GRAVITY_LPS)
    const [a, b, c] = PRESENTATION_FROM_LPS
    const dot = (u: readonly number[], v: readonly number[]) =>
      u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
    for (const row of [a, b, c]) expect(dot(row, row)).toBe(1)
    expect([dot(a, b), dot(b, c), dot(a, c)]).toEqual([0, 0, 0])
    const det =
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0])
    expect(det).toBe(1)
  })

  it('lays the patient on the left side, right side up, seen from the front with the head to the right', () => {
    expect(presentFromLps(GRAVITY_LPS)).toEqual([0, -1, 0])
    expect(presentFromLps([-1, 0, 0])).toEqual([0, 1, 0])
    expect(presentFromLps([0, 0, 1])).toEqual([1, 0, 0])
    expect(presentFromLps([0, -1, 0])).toEqual([0, 0, 1])
  })
})

describe('the source audit', () => {
  it('pins both files by hash, and the one-slice offset between them', () => {
    expect(sourceAudit.ct.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(sourceAudit.segmentation.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(sourceAudit.segmentationSliceOffset).toBe(1)
    expect(sourceAudit.segmentation.size[2] - sourceAudit.ct.size[2]).toBe(3)
  })

  it('identifies every segment it uses by content, each inside its expected range', () => {
    for (const segment of sourceAudit.segments) {
      expect(segment.matchesExpected).toBe(true)
      expect(segment.volumeMl).toBeGreaterThanOrEqual(segment.expected.volumeMl[0])
      expect(segment.volumeMl).toBeLessThanOrEqual(segment.expected.volumeMl[1])
    }
    const cage = sourceAudit.segments.find((segment) => segment.key === 'rib-cage')
    expect(cage?.nameInFile).toBe('thoracic cavity')
    expect(cage?.contains).toMatch(/rib cage/)
    expect(sourceAudit.segments.map((segment) => segment.nameInFile)).not.toContain('right kidney')
  })
})

describe('the pleural space', () => {
  const space = anatomySurfaces.pleuralSpace

  it('is one closed surface, turned outward, within one per cent of the voxels it was built from', () => {
    expect(space.watertight).toBe(true)
    expect(space.outward).toBe(true)
    expect(Math.abs(space.meshVolumeMl - space.voxelVolumeMl) / space.voxelVolumeMl).toBeLessThan(
      0.01,
    )
    expect(space.voxelVolumeMl).toBeGreaterThan(3300)
    expect(space.voxelVolumeMl).toBeLessThan(3500)
  })

  it('is divided into the seven zones of the zone list, each face in exactly one, each zone one piece', () => {
    expect(space.zones.map((zone) => zone.id)).toEqual([...PLEURAL_ZONE_IDS])
    expect(space.zones.reduce((sum, zone) => sum + zone.faces, 0)).toBe(space.faces)
    expect(space.facesInExactlyOneZone).toBe(space.faces)
    const share = space.zones.reduce((sum, zone) => sum + zone.shareOfSurface, 0)
    expect(Math.abs(share - 1)).toBeLessThan(0.002)
    for (const zone of space.zones) expect(zone.pieces).toBe(1)
  })

  it('puts the apex plane between the spinal ends of the second and third ribs', () => {
    const [, second, third] = rightRibs.ribs
    expect(space.apexPlaneZ).toBeLessThan(second.spinalEndLps[2])
    expect(space.apexPlaneZ).toBeGreaterThan(third.spinalEndLps[2] - 30)
    expect(pleuralZoneList.split.apex.rib).toBe(2)
  })
})

describe('the ribs', () => {
  it('number twelve on the right, from the spinal end down, each closed, awaiting the owner’s check', () => {
    expect(rightRibs.ribs.map((rib) => rib.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    const heights = rightRibs.ribs.map((rib) => rib.spinalEndLps[2])
    expect([...heights].sort((a, b) => b - a)).toEqual(heights)
    for (const rib of rightRibs.ribs) expect(rib.watertight).toBe(true)
    expect(rightRibs.status).toMatch(/awaits the owner/)
  })
})

describe('the port candidates', () => {
  it('cover the fifth to eighth spaces on three lines, measured or said to be unmeasured', () => {
    const cells = portCandidates.rows.map((row) => `${row.space} ${row.line}`)
    expect(cells).toEqual(
      [5, 6, 7, 8].flatMap((space) =>
        ['anterior axillary', 'mid-axillary', 'posterior axillary'].map(
          (line) => `${space} ${line}`,
        ),
      ),
    )
    expect(portCandidates.statement).toMatch(/Not a guide to choosing a port in a patient/)
    for (const row of portCandidates.rows) {
      if (row.status !== 'measured') continue
      expect(row.skinInScan).toBe(row.wallThicknessMm !== null)
      if (!row.skinInScan) expect(row.skinNote).not.toBeNull()
    }
  })
})

describe('the prototype port', () => {
  const row = portCandidates.rows.find(
    (entry) => entry.space === portRecord.space && entry.line === portRecord.line,
  )

  it('is the default the owner has not decided, and never called a recommended site', () => {
    expect([portRecord.space, portRecord.line, portRecord.side]).toEqual([
      7,
      'mid-axillary',
      'right',
    ])
    expect(portRecord.decision).toMatch(/T6: a default, not a decision/)
    expect(portRecord.decision).toMatch(/not a recommended site/)
  })

  it('carries the measured row of the candidate table', () => {
    expect(row?.status).toBe('measured')
    if (row?.status !== 'measured') return
    expect(portRecord.ribGapMm).toBe(row.ribGapMm)
    expect(portRecord.wallThicknessMm).toBe(row.wallThicknessMm)
    expect(portRecord.pleuraPointLps).toEqual(row.pleuraPointLps)
    expect(portRecord.corridorAxis).toEqual(row.inwardAxis)
    expect(portRecord.pivotLps).toEqual(row.spaceMidpointLps)
  })

  it('fits the modelled sleeve between the ribs, and turns the corridor into the chest', () => {
    const sleeve = deviceDefinitions.devices
      .find((device) => device.id === 'trocar-sleeve-flexible')
      ?.facts.find((fact) => fact.key === 'outerDiameter')
    expect(portRecord.sleeveOuterDiameterMm).toBe(sleeve?.value)
    expect(portRecord.clearanceEachSideMm).toBeCloseTo(
      (portRecord.ribGapMm - portRecord.sleeveOuterDiameterMm) / 2,
      2,
    )
    expect(portRecord.clearanceEachSideMm).toBeGreaterThan(0)
    expect(portRecord.wallPatch.radiusMm).toBeCloseTo(portRecord.ribGapMm / 2, 2)
    const [x, y, z] = portRecord.corridorAxis
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 2)
    expect(x).toBeGreaterThan(0.8)
  })
})

describe('what the repository holds', () => {
  it('keeps the surfaces out of it, and says why, with the credit they carry', () => {
    expect(anatomySurfaces.statement).toMatch(/not in the repository/)
    expect(anatomySurfaces.statement).toMatch(/R-ANATOMY-SEGMENTATION/)
    expect(read('.gitignore')).toMatch(/^public\/models\/medical-thoracoscopy\/v1\/anatomy\/$/m)
    expect(anatomySurfaces.attribution.dataset).toMatch(/10\.5281\/zenodo\.10069289/)
    expect(anatomySurfaces.attribution.licence).toMatch(/creativecommons\.org\/licenses\/by\/4\.0/)
    expect(anatomySurfaces.attribution.changes).toMatch(/modified/)
    expect(anatomySurfaces.attribution.identity).toMatch(/not verified/)
  })

  it('keeps the files, before compression, well inside the anatomy budget once compressed', () => {
    const bytes = Object.values(anatomySurfaces.files).reduce((sum, file) => sum + file.bytes, 0)
    expect(bytes).toBeLessThan(8 * 1024 * 1024)
  })
})
