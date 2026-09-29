import { z } from 'zod'

import rawFluidTable from './data/anatomy/fluid-table.json'
import rawLungStates from './data/anatomy/lung-states.json'
import rawPortCandidates from './data/anatomy/port-candidates.json'
import rawPortRecord from './data/anatomy/port-record.json'
import rawProxies from './data/anatomy/proxies.json'
import rawRibs from './data/anatomy/ribs.json'
import rawAudit from './data/anatomy/source-audit.json'
import rawSurfaces from './data/anatomy/surfaces.json'
import rawTourStops from './data/anatomy/tour-stops.json'
import rawZoneReach from './data/anatomy/zone-reach.json'
import rawZoneSamples from './data/anatomy/zone-samples.json'
import { PLEURAL_ZONE_IDS } from './pleuralZones'

/**
 * The thorax anatomy, as the numbers the build measured. The surfaces, the lung's states and the
 * collision proxies are built in the owner's local data by `scripts/medical-thoracoscopy/
 * build_thorax_surfaces.py` and `build_lung_states.py` and are not in the repository: the
 * segmentation's terms are not settled (rights register, R-ANATOMY-SEGMENTATION), and the
 * repository is public. What is here is what can be checked and cited without them.
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
        gapFillMm: z.number().positive(),
        mesh: z
          .object({
            gridMm: z.number().positive(),
            smoothingMm: z.number().positive(),
            edgeMm: z.number().positive(),
            marchingStep: z.number().int().positive(),
            smallestAngleDeg: z.number().positive(),
            edgeMmRange: z.tuple([z.number().positive(), z.number().positive()]),
          })
          .strict(),
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
      upperRibDepthMm: z.number().positive(),
      lowerRibDepthMm: z.number().positive(),
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
    ribDepthMm: z.number().positive(),
    ribDepthIs: z.string().min(1),
    wallThicknessMm: z.number().positive(),
    sleeveOuterDiameterMm: z.number().positive(),
    clearanceEachSideMm: z.number(),
    wallPatch: z
      .object({ centreLps: vec3, radiusMm: z.number().positive(), is: z.string().min(1) })
      .strict(),
  })
  .strict()

const fileEntrySchema = z
  .object({ file: z.string().min(1), sha256, bytes: z.number().int().positive() })
  .strict()
const claimIdSchema = z.string().regex(/^MT-C-\d{4}$/)
const noFaults = {
  foldedFaces: z.literal(0),
  crossingFaces: z.literal(0),
  facesThroughPleura: z.literal(0),
  clearanceMm: z.number(),
}
const recordHeader = {
  version: z.number().int().positive(),
  script: z.string().min(1),
  statement: z.string().min(1),
  frame: z.literal('LPS millimetres'),
}

/** The lung's states: authored (MT-C-0001, MT-C-0002), each checked when it was built. */
export const lungStatesSchema = z
  .object({
    record: z.literal('medical-thoracoscopy-lung-states'),
    ...recordHeader,
    label: z.literal('Derived from CT segmentation'),
    statesLabel: z.literal('Authored, illustrative'),
    claims: z.array(claimIdSchema).min(1),
    files: z.record(z.enum(['lung-states', 'proxy-pleural-space', 'proxy-lung']), fileEntrySchema),
    lung: z
      .object({
        closingMm: z.number().positive(),
        erosionMm: z.number().positive(),
        gridMm: z.number().positive(),
        smoothingMm: z.number().positive(),
        edgeMm: z.number().positive(),
        marchingStep: z.number().int().positive(),
        lobes: z.array(
          z
            .object({
              id: z.enum(['upper', 'middle', 'lower']),
              segment: z.string().min(1),
              faces: z.number().int().positive(),
              areaCm2: z.number().positive(),
            })
            .strict(),
        ),
        voxelVolumeMl: z.number().positive(),
        faces: z.number().int().positive(),
        vertices: z.number().int().positive(),
        watertight: z.literal(true),
        smallestAngleDeg: z.number().positive(),
      })
      .strict(),
    collapse: z
      .object({
        gapAtPortMm: z.number().positive(),
        steps: z.number().int().positive(),
        hilumSearchMm: z.number().positive(),
        targetDepthMm: z.number().positive(),
        gravityDriftMm: z.number().nonnegative(),
        wallClearanceMm: z.number().nonnegative(),
        wallReachMm: z.number().positive(),
        friction: z.number().nonnegative(),
        barrierMm: z.number().positive(),
        barrierSpeed: z.number().nonnegative(),
        fieldCellMm: z.number().positive(),
        fieldSmoothingCells: z.number().positive(),
        timeStep: z.number().positive(),
        tangentialRelaxation: z.number().nonnegative(),
        creaseLimitDeg: z.number().positive(),
        hilarCentroidLps: vec3,
        targetLps: vec3,
        flowTime: z.number().positive(),
        portPleuraPointLps: vec3,
        smoothings: z.number().int().nonnegative(),
        verticesTouched: z.number().int().nonnegative(),
        tangentialDriftMm: z
          .object({ median: z.number().nonnegative(), max: z.number().nonnegative() })
          .strict(),
      })
      .strict(),
    checks: z
      .object({
        clearanceFloorMm: z.number().positive(),
        blendsCheckedAt: z.array(z.number().gt(0).lt(1)).min(1),
        foldedMeans: z.string().min(1),
      })
      .strict(),
    states: z.array(
      z
        .object({
          step: z.number().int().nonnegative(),
          flowTimeFraction: z.number().min(0).max(1),
          volumeMl: z.number().positive(),
          volumeFraction: z.number().positive().max(1),
          gapAtPortMm: z.number().nonnegative(),
          ...noFaults,
        })
        .strict(),
    ),
    between: z.array(
      z
        .object({
          from: z.number().int().nonnegative(),
          to: z.number().int().positive(),
          checkedAt: z.array(z.number().gt(0).lt(1)).min(1),
          ...noFaults,
        })
        .strict(),
    ),
    quantisation: z
      .object({ positionStepMm: z.number().positive(), largestErrorMm: z.number().nonnegative() })
      .strict(),
  })
  .strict()

const deviationSchema = {
  proxyFromDrawnMm: z.tuple([z.number(), z.number(), z.number()]),
  drawnFromProxyMm: z.tuple([z.number(), z.number(), z.number()]),
  facesCrossingDrawn: z.literal(0),
}

/** The collision proxies: the geometry every spatial answer uses (plan, section 4.5). */
export const proxiesSchema = z
  .object({
    record: z.literal('medical-thoracoscopy-collision-proxies'),
    ...recordHeader,
    label: z.literal('Derived from CT segmentation'),
    method: z
      .object({
        pleuralSpaceEdgeMm: z.number().positive(),
        lungEdgeMm: z.number().positive(),
        lungTriangles: z.number().int().positive(),
        lungFieldSmoothingMm: z.number().positive(),
        lungFieldSmoothingLimitMm: z.number().positive(),
        offsetMm: z
          .object({ pleuralSpace: z.number().positive(), lung: z.number().positive() })
          .strict(),
        marginMm: z.number().positive(),
        openingMm: z.number().positive(),
        voxelMm: z.number().positive(),
        settleLimitMm: z
          .object({ pleuralSpace: z.number().positive(), lung: z.number().positive() })
          .strict(),
        refineRounds: z.number().int().positive(),
        trianglesBudget: z.number().int().positive(),
        spaceTrianglesLimit: z.number().int().positive(),
      })
      .strict(),
    pleuralSpace: z
      .object({
        faces: z.number().int().positive(),
        vertices: z.number().int().positive(),
        facesBeforeRefinement: z.number().int().positive(),
        edgesSplit: z.number().int().nonnegative(),
        verticesSmoothed: z.number().int().nonnegative(),
        piecesLeftOut: z.number().int().nonnegative(),
        watertight: z.literal(true),
        outward: z.literal(true),
        crossingFaces: z.literal(0),
        side: z.literal('inside the drawn pleural surface'),
        ...deviationSchema,
      })
      .strict(),
    lung: z
      .object({
        side: z.literal('around the drawn lung'),
        perState: z.string().min(1),
        states: z.array(
          z
            .object({
              step: z.number().int().nonnegative(),
              faces: z.number().int().positive(),
              vertices: z.number().int().positive(),
              edgeMm: z.number().positive(),
              fieldSmoothingMm: z.number().positive(),
              piecesLeftOut: z.number().int().nonnegative(),
              verticesSmoothed: z.number().int().nonnegative(),
              watertight: z.literal(true),
              outward: z.literal(true),
              crossingFaces: z.literal(0),
              ...deviationSchema,
            })
            .strict(),
        ),
        halfwayBetweenStates: z.array(
          z
            .object({
              from: z.number().int().nonnegative(),
              to: z.number().int().positive(),
              verticesOutsideBoth: z.literal(0),
            })
            .strict(),
        ),
      })
      .strict(),
    trianglesInUse: z.number().int().positive(),
  })
  .strict()

/** Points on each survey zone, for the visibility ledger. The zones are an authored construct. */
export const zoneSamplesSchema = z
  .object({
    record: z.literal('medical-thoracoscopy-zone-samples'),
    ...recordHeader,
    label: z.literal('Authored construct'),
    method: z
      .object({
        perCm2: z.number().positive(),
        minimumPerZone: z.number().int().positive(),
        insideProxyMm: z.number().positive(),
        placement: z.string().min(1),
      })
      .strict(),
    file: z.literal('proxy-pleural-space.glb'),
    zones: z.array(
      z
        .object({
          id: z.enum(PLEURAL_ZONE_IDS),
          points: z.number().int().positive(),
          liftMm: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
          placedFromTheSet: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    total: z.number().int().positive(),
  })
  .strict()

/** Fluid volume below a level plane at each height, at each lung state. Authored, illustrative. */
export const fluidTableSchema = z
  .object({
    record: z.literal('medical-thoracoscopy-fluid-table'),
    ...recordHeader,
    label: z.literal('Authored, illustrative'),
    method: z.string().min(1),
    gravityLps: vec3,
    stepMm: z.number().positive(),
    heightsMm: z.array(z.number().nonnegative()).min(2),
    spaceMl: z.array(z.number()).min(2),
    states: z.array(
      z
        .object({ step: z.number().int().nonnegative(), fluidMl: z.array(z.number()).min(2) })
        .strict(),
    ),
  })
  .strict()

/**
 * Which zone samples the port lets the telescope bring into its field, computed by the space engine
 * (`build-zone-reach.ts`) with the snapshot it was computed for; the engine uses it only while that
 * snapshot is current.
 */
export const zoneReachSchema = z
  .object({
    record: z.literal('medical-thoracoscopy-zone-reach'),
    version: z.number().int().positive(),
    script: z.string().min(1),
    statement: z.string().min(1),
    label: z.literal('Authored construct'),
    computedFor: z
      .object({
        anatomy: z.string().min(1),
        device: z.string().min(1),
        optics: z.string().min(1),
        port: z.string().min(1),
        lungAndFluid: z.string().min(1),
        geometry: z.string().min(1),
        rules: z.string().min(1),
      })
      .strict(),
    lungStep: z.number().int().nonnegative(),
    grid: z
      .object({
        tiltStepDeg: z.number().positive(),
        depthStepMm: z.number().positive(),
        rollsDeg: z.array(z.number()).min(1),
        acrossRibsLimitDeg: z.number().positive(),
        alongRibsLimitDeg: z.number().positive(),
      })
      .strict(),
    files: z.object({ 'proxy-pleural-space': sha256, 'proxy-lung': sha256 }).strict(),
    poses: z.number().int().positive(),
    /** One digit a sample: 0 out of the field, 1 in the field only behind something, 2 seeable. */
    reachable: z.string().regex(/^[012]+$/),
    zones: z
      .array(
        z
          .object({
            id: z.enum(PLEURAL_ZONE_IDS),
            samples: z.number().int().positive(),
            reachable: z.number().int().nonnegative(),
            seeable: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .length(PLEURAL_ZONE_IDS.length),
  })
  .strict()

const snapshotPartsSchema = z
  .object({
    anatomy: z.string().min(1),
    device: z.string().min(1),
    optics: z.string().min(1),
    port: z.string().min(1),
    lungAndFluid: z.string().min(1),
    geometry: z.string().min(1),
    rules: z.string().min(1),
  })
  .strict()

/** Where the tour of section 6 stops: a position per region, computed by the space engine. */
export const tourStopsSchema = z
  .object({
    record: z.literal('medical-thoracoscopy-tour-stops'),
    version: z.number().int().positive(),
    script: z.string().min(1),
    statement: z.string().min(1),
    label: z.literal('Authored construct'),
    computedFor: snapshotPartsSchema,
    lungStep: z.number().int().nonnegative(),
    stops: z
      .array(
        z
          .object({
            zone: z.enum(PLEURAL_ZONE_IDS),
            pose: z
              .object({
                tiltAcrossRibsDeg: z.number(),
                tiltAlongRibsDeg: z.number(),
                depthMm: z.number().positive(),
                rollDeg: z.number(),
              })
              .strict()
              .nullable(),
            seenFromThere: z.number().int().nonnegative(),
            samples: z.number().int().positive(),
          })
          .strict(),
      )
      .length(PLEURAL_ZONE_IDS.length),
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

export type LungStates = z.infer<typeof lungStatesSchema>
export type CollisionProxies = z.infer<typeof proxiesSchema>
export type ZoneSamples = z.infer<typeof zoneSamplesSchema>
export type FluidTable = z.infer<typeof fluidTableSchema>
export type ZoneReach = z.infer<typeof zoneReachSchema>
export type TourStops = z.infer<typeof tourStopsSchema>

export const lungStates: LungStates = lungStatesSchema.parse(rawLungStates)
export const collisionProxies: CollisionProxies = proxiesSchema.parse(rawProxies)
export const zoneSamples: ZoneSamples = zoneSamplesSchema.parse(rawZoneSamples)
export const fluidTable: FluidTable = fluidTableSchema.parse(rawFluidTable)
export const zoneReach: ZoneReach = zoneReachSchema.parse(rawZoneReach)
export const tourStops: TourStops = tourStopsSchema.parse(rawTourStops)
