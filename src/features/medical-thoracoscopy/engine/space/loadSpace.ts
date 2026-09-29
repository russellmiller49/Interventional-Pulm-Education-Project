import type { ScopePose, SpaceCommand } from '../../components/space/types'
import { portRecord } from '../../content/anatomy'
import { PLEURAL_ZONE_IDS, type PleuralZoneId } from '../../content/pleuralZones'
import { modelledNumber } from '../../content/deviceDefinitions'
import { scopeGeometry, type ScopeGeometry } from './fulcrum'
import { capsuleClearance, type Capsule, type MeshIndex } from './spatial/capsuleQuery'
import { instrument, type Instrument } from './instrument'
import { portFrame, type PortFrame } from './portDefinition'
import { readProxyGlb, type TriangleMesh } from './spatial/proxyGlb'
import { CLEARANCE_SKIN_MM, createSpatialWorld, type SpatialWorld } from './spatial/spatialWorld'
import { depthRange, takeStep, type StepResult } from './spatial/sweep'
import { viewSamples, zoneSamplesFrom, type ZoneSamples } from './spatial/visibility'

/**
 * The space as the engine uses it: the port, the instrument, the proxies indexed once, and the zone
 * samples, built from the two proxy files (bytes, so the same in Node and the browser); and the
 * resolver the reducer asks its questions of. Nothing here is state.
 */
export interface LoadedSpace {
  readonly port: PortFrame
  readonly device: Instrument
  readonly world: SpatialWorld
  readonly samples: ZoneSamples
  readonly depthLimits: readonly [number, number]
  /** Each triangle of the space proxy's zone: the zone of the sample nearest its centre. */
  readonly triangleZones: readonly PleuralZoneId[]
}

/** The space from the two packaged proxy files, with the port and the instrument of the records. */
export function loadSpace(
  spaceProxy: ArrayBuffer | Uint8Array,
  lungProxy: ArrayBuffer | Uint8Array,
): LoadedSpace {
  const spaceFile = readProxyGlb(spaceProxy)
  const lungFile = readProxyGlb(lungProxy)
  const space = spaceFile.nodes.find((node) => node.name === 'proxy:pleural-space')?.mesh
  if (!space) throw new Error('The space proxy file has no proxy')
  const lungSteps = lungFile.nodes.map((node, step) => {
    if (node.name !== `proxy:lung:step ${step}` || !node.mesh)
      throw new Error(`The lung proxy for step ${step} is missing`)
    return node.mesh as TriangleMesh
  })
  const port = portFrame()
  const device = instrument()
  const world = createSpatialWorld({ space, lungSteps, port })
  const sleeveHead = modelledNumber('trocar-sleeve-flexible', 'headLength').value
  return assembleSpace({
    port,
    device,
    world,
    samples: zoneSamplesFrom(spaceFile, world),
    depthLimits: depthRange(port, device, portRecord.wallThicknessMm, sleeveHead),
  })
}

/** A space from its parts: the one the records describe, or an analytic scene for the tests. */
export function assembleSpace(parts: Omit<LoadedSpace, 'triangleZones'>): LoadedSpace {
  const empty = PLEURAL_ZONE_IDS.filter((zone) => !parts.samples.zones.includes(zone))
  if (empty.length > 0)
    throw new Error(`No samples for ${empty.join(', ')}: a region could never be seen`)
  return { ...parts, triangleZones: nearestZones(parts.world.space, parts.samples) }
}

/** The questions the reducer asks, answered synchronously from the loaded space. */
export interface SpaceResolver {
  readonly sampleCount: number
  readonly lungStepCount: number
  readonly samples: ZoneSamples
  geometry(pose: ScopePose): ScopeGeometry
  step(pose: ScopePose, command: SpaceCommand, lungStep: number): StepResult
  view(pose: ScopePose, lungStep: number): Uint8Array
  /** The instrument's clearance from the lung at a step, for accepting a move of the lung. */
  lungClearance(pose: ScopePose, lungStep: number): number
  /** The instrument's least clearance from anything. */
  clearance(pose: ScopePose, lungStep: number): number
  /**
   * Why the instrument cannot start at a pose, or null: it must be clear by the clearance skin, and
   * its tip inside the space and outside the lung, by winding number. After that, never coming
   * within the skin of a surface means never crossing to its other side.
   */
  startProblem(pose: ScopePose, lungStep: number): string | null
}

export function createResolver(space: LoadedSpace): SpaceResolver {
  const { port, device, world, samples, depthLimits } = space
  const geometry = (pose: ScopePose) => scopeGeometry(pose, port, device)
  return {
    sampleCount: samples.zones.length,
    lungStepCount: world.lungStepCount,
    samples,
    geometry,
    step: (pose, command, lungStep) =>
      takeStep(world, port, device, pose, command, lungStep, depthLimits),
    view: (pose, lungStep) => viewSamples(world, samples, geometry(pose).camera, device, lungStep),
    lungClearance(pose, lungStep) {
      const g = geometry(pose)
      const parts = g.shaft ? [g.sleeve, g.shaft] : [g.sleeve]
      const index = world.lungIndex(lungStep)
      return Math.min(...parts.map((capsule) => capsuleClearanceOf(index, capsule)))
    },
    clearance: (pose, lungStep) => world.clearance(geometry(pose), lungStep).clearance,
    startProblem(pose, lungStep) {
      const clearance = world.clearance(geometry(pose), lungStep).clearance
      if (clearance < CLEARANCE_SKIN_MM - 1e-9)
        return `it is not clear of the space (${clearance.toFixed(3)} mm)`
      if (!world.isFree(geometry(pose).tip, lungStep))
        return 'its tip is not inside the space and outside the lung'
      return null
    },
  }
}

function nearestZones(space: TriangleMesh, samples: ZoneSamples): PleuralZoneId[] {
  const { positions, indices } = space
  const zones: PleuralZoneId[] = []
  for (let f = 0; f < indices.length; f += 3) {
    let cx = 0
    let cy = 0
    let cz = 0
    for (let k = 0; k < 3; k += 1) {
      cx += positions[indices[f + k] * 3] / 3
      cy += positions[indices[f + k] * 3 + 1] / 3
      cz += positions[indices[f + k] * 3 + 2] / 3
    }
    let best = Infinity
    let zone = samples.zones[0]
    for (let s = 0; s < samples.zones.length; s += 1) {
      const dx = samples.points[s * 3] - cx
      const dy = samples.points[s * 3 + 1] - cy
      const dz = samples.points[s * 3 + 2] - cz
      const d = dx * dx + dy * dy + dz * dz
      if (d < best) {
        best = d
        zone = samples.zones[s]
      }
    }
    zones.push(zone)
  }
  return zones
}

function capsuleClearanceOf(index: MeshIndex, capsule: Capsule): number {
  return capsuleClearance(index, capsule).clearance
}
