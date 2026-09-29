import { z } from 'zod'

import rawPortCandidates from './data/anatomy/port-candidates.json'
import rawPortRecord from './data/anatomy/port-record.json'
import rawRibs from './data/anatomy/ribs.json'
import rawAudit from './data/anatomy/source-audit.json'
import rawSurfaces from './data/anatomy/surfaces.json'
import { PLEURAL_ZONE_IDS } from './pleuralZones'

/**
 * The thorax anatomy, as the numbers the build measured. The surfaces themselves are built in the
 * owner's local data by `scripts/medical-thoracoscopy/build_thorax_surfaces.py` and are not in the
 * repository: the segmentation's terms are not settled (rights register, R-ANATOMY-SEGMENTATION),
 * and the repository is public. What is here is what can be checked and cited without them.
 *
 * Coordinates are LPS millimetres: +x toward the patient's left, +y toward the back, +z toward the
 * head. The anatomy frame never changes; the scene alone applies `PRESENTATION_FROM_LPS`.
 */

type Vec3 = readonly [number, number, number]
type Mat3 = readonly [Vec3, Vec3, Vec3]

/**
 * The presented position: lying on the left side, right side up. Rows map LPS to the scene's axes
 * (three.js): +X toward the head, +Y up (the patient's right), +Z toward the viewer (the patient's
 * front). The Chest view looks at the patient's front with the head to the right of the screen
 * (owner decisions, T7: a default, not a decision).
 */
export const PRESENTATION_FROM_LPS: Mat3 = [
  [0, 0, 1],
  [-1, 0, 0],
  [0, -1, 0],
]

/** Toward the patient's left, which is down in the presented position. */
export const GRAVITY_LPS: Vec3 = [1, 0, 0]

export function presentFromLps(point: Vec3): Vec3 {
  const [a, b, c] = PRESENTATION_FROM_LPS
  const dot = (row: Vec3) => row[0] * point[0] + row[1] * point[1] + row[2] * point[2]
  return [dot(a), dot(b), dot(c)]
}

const vec3 = z.tuple([z.number(), z.number(), z.number()])
const mat3 = z.tuple([vec3, vec3, vec3])
const sha256 = z.string().regex(/^[0-9a-f]{64}$/)

const attributionSchema = z
  .object({
    dataset: z.string().min(1),
    describedIn: z.string().min(1),
    licence: z.string().min(1),
    changes: z.string().min(1),
    identity: z.string().min(1),
  })
  .strict()

const sourceFileSchema = z
  .object({
    file: z.string().min(1),
    sha256,
    bytes: z.number().int().positive(),
    size: z.array(z.number().int().positive()),
    spacing: vec3,
    origin: vec3,
  })
  .passthrough()

export const sourceAuditSchema = z
  .object({
    record: z.literal('medical-thoracoscopy-anatomy-source-audit'),
    version: z.number().int().positive(),
    script: z.string().min(1),
    statement: z.string().min(1),
    frame: z.literal('LPS millimetres'),
    ct: sourceFileSchema,
    segmentation: sourceFileSchema.extend({
      layers: z.number().int().positive(),
      space: z.string(),
    }),
    segmentationSliceOffset: z.number().int(),
    segments: z.array(
      z
        .object({
          key: z.string().min(1),
          layer: z.number().int().nonnegative(),
          value: z.number().int().positive(),
          nameInFile: z.string().min(1),
          contains: z.string().min(1),
          volumeMl: z.number().positive(),
          huMean: z.number(),
          huSd: z.number().nonnegative(),
          lpsMin: vec3,
          lpsMax: vec3,
          pieces: z.number().int().positive(),
          expected: z
            .object({
              volumeMl: z.tuple([z.number(), z.number()]),
              huMean: z.tuple([z.number(), z.number()]),
            })
            .strict(),
          matchesExpected: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict()

const zoneStatSchema = z
  .object({
    id: z.enum(PLEURAL_ZONE_IDS),
    faces: z.number().int().positive(),
    areaCm2: z.number().positive(),
    shareOfSurface: z.number().positive().max(1),
    pieces: z.number().int().positive(),
  })
  .strict()

export const surfacesSchema = z
  .object({
    record: z.literal('medical-thoracoscopy-anatomy-surfaces'),
    version: z.number().int().positive(),
    script: z.string().min(1),
    statement: z.string().min(1),
    label: z.literal('Derived from CT segmentation'),
    frame: z.literal('LPS millimetres'),
    presentationFromLps: mat3,
    gravityLps: vec3,
    attribution: attributionSchema,
    files: z.record(
      z.enum(['pleural-space', 'ribs', 'context']),
      z.object({ file: z.string().min(1), sha256, bytes: z.number().int().positive() }).strict(),
    ),
    pleuralSpace: z
      .object({
        voxelVolumeMl: z.number().positive(),
        meshVolumeMl: z.number().positive(),
        faces: z.number().int().positive(),
        vertices: z.number().int().positive(),
        areaCm2: z.number().positive(),
        watertight: z.boolean(),
        outward: z.boolean(),
        closingMm: z.number().positive(),
        simplifyMm: z.number().positive(),
        boundsLps: z.tuple([vec3, vec3]),
        apexPlaneZ: z.number(),
        zones: z.array(zoneStatSchema),
        facesInExactlyOneZone: z.number().int().positive(),
      })
      .strict(),
    context: z.record(z.string(), z.object({ faces: z.number().int().positive() }).strict()),
    sternum: z
      .object({ faces: z.number().int().positive(), volumeMl: z.number().positive() })
      .strict(),
  })
  .strict()

export const ribsSchema = z
  .object({
    record: z.literal('medical-thoracoscopy-right-ribs'),
    version: z.number().int().positive(),
    script: z.string().min(1),
    method: z.string().min(1),
    status: z.string().min(1),
    ribs: z.array(
      z
        .object({
          number: z.number().int().min(1).max(12),
          spinalEndLps: vec3,
          voxelsBehindCut: z.number().int().positive(),
          volumeMl: z.number().positive(),
          faces: z.number().int().positive(),
          watertight: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict()

const LINES = ['anterior axillary', 'mid-axillary', 'posterior axillary'] as const

const portRowSchema = z.union([
  z
    .object({
      space: z.number().int(),
      line: z.enum(LINES),
      angleDeg: z.number(),
      status: z.literal('a rib does not reach this line in the scan'),
    })
    .strict(),
  z
    .object({
      space: z.number().int(),
      line: z.enum(LINES),
      angleDeg: z.number(),
      status: z.literal('measured'),
      ribGapMm: z.number().positive(),
      upperRibPointLps: vec3,
      lowerRibPointLps: vec3,
      spaceMidpointLps: vec3,
      pleuraPointLps: vec3,
      inwardAxis: vec3,
      skinInScan: z.boolean(),
      wallThicknessMm: z.number().positive().nullable(),
      skinNote: z.string().min(1).nullable(),
      distanceToAirMm: z.number().nonnegative().nullable(),
      distanceOutOfSkinLayerMm: z.number().nonnegative().nullable(),
      depthToLungMm: z.number().nonnegative().nullable(),
      lungNote: z.string().min(1).nullable(),
      distanceToDiaphragmMm: z.number().positive(),
    })
    .strict(),
])

export const portCandidatesSchema = z
  .object({
    record: z.literal('medical-thoracoscopy-port-candidates'),
    version: z.number().int().positive(),
    script: z.string().min(1),
    statement: z.string().min(1),
    lines: z
      .object({
        'anterior axillary': z.number(),
        'mid-axillary': z.number(),
        'posterior axillary': z.number(),
      })
      .strict(),
    wedgeDeg: z.number().positive(),
    airHu: z.number(),
    rows: z.array(portRowSchema),
  })
  .strict()

export const portRecordSchema = z
  .object({
    record: z.literal('medical-thoracoscopy-port-record'),
    version: z.number().int().positive(),
    script: z.string().min(1),
    decision: z.string().min(1),
    space: z.number().int(),
    line: z.enum(LINES),
    side: z.literal('right'),
    pivotLps: vec3,
    pivotIs: z.string().min(1),
    corridorAxis: vec3,
    corridorAxisIs: z.string().min(1),
    pleuraPointLps: vec3,
    ribGapMm: z.number().positive(),
    wallThicknessMm: z.number().positive(),
    sleeveOuterDiameterMm: z.number().positive(),
    clearanceEachSideMm: z.number(),
    wallPatch: z
      .object({ centreLps: vec3, radiusMm: z.number().positive(), is: z.string().min(1) })
      .strict(),
  })
  .strict()

export type SourceAudit = z.infer<typeof sourceAuditSchema>
export type AnatomySurfaces = z.infer<typeof surfacesSchema>
export type RightRibs = z.infer<typeof ribsSchema>
export type PortCandidates = z.infer<typeof portCandidatesSchema>
export type PortRecord = z.infer<typeof portRecordSchema>

export const sourceAudit: SourceAudit = sourceAuditSchema.parse(rawAudit)
export const anatomySurfaces: AnatomySurfaces = surfacesSchema.parse(rawSurfaces)
export const rightRibs: RightRibs = ribsSchema.parse(rawRibs)
export const portCandidates: PortCandidates = portCandidatesSchema.parse(rawPortCandidates)
export const portRecord: PortRecord = portRecordSchema.parse(rawPortRecord)
