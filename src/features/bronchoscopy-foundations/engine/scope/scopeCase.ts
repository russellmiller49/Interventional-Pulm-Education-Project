import type { LumenCollider } from '@/lib/bronchoscopy-core/frame'
import {
  createGraphIndex,
  sampleEdgePose,
  type AirwayGraphIndex,
} from '@/lib/airway-anatomy/scope-state'
import { buildTransportFrames, type TransportFrames } from '@/lib/airway-anatomy/transport-frames'
import type { AirwayGraph, OrientationLandmark, Vec3 } from '@/lib/airway-anatomy/types'

import {
  AIRWAY_LABELS,
  isAirwayLabel,
  type AirwayLabel,
  type AirwayMapGeometry,
  type AnatomyProfileId,
} from '../../components/scope/types'
import { buildAirwayMap } from './treeLayout'

/**
 * One loaded anatomy profile: the teaching graph and everything the engine derives from it once.
 *
 * The graph is the course's pruned copy of the reviewed case-001 centerlines
 * (`scripts/bronchoscopy-foundations/build-teaching-graph.mts`), in patient LPS millimetres, with
 * a teaching label on each labelled edge. The lumen collider is optional: until the reviewed
 * teaching lumen is loaded (or where WebGL-free code runs, as in tests and the 2D fallback), the
 * engine travels the graph alone and says so in the view's boundary.
 */

export const TEACHING_PROFILE_BASE =
  '/bronchoscopy-foundations/anatomy/adult-teaching-combined-left-basal-v1'
export const TEACHING_GRAPH_URL = `${TEACHING_PROFILE_BASE}/graph.json`
/** The reviewed teaching lumen (Draco GLB, patient LPS millimetres), built by the asset pipeline. */
export const TEACHING_LUMEN_URL = `${TEACHING_PROFILE_BASE}/lumen.glb`

export interface TeachingGraphFile {
  readonly schema: string
  readonly profileId: string
  readonly graph: AirwayGraph
  readonly edgeLabels: Readonly<
    Record<string, { readonly abbreviatedLabel: string; readonly fullLabel: string } | undefined>
  >
  readonly interaction: {
    readonly rootNodeId: number
    readonly carinaNodeId: number
    readonly defaultEdgeId: number
    readonly initialDistanceMm: number
    readonly stepMm: number
    readonly lookAheadMm: number
    readonly trailMaxPoints: number
  }
  readonly orientationLandmarks: readonly OrientationLandmark[]
  readonly ostialLandmarks: readonly {
    readonly edgeId: number
    readonly pointLps: Vec3
    readonly label: string
    readonly description: string
  }[]
}

export interface ScopeCase {
  readonly profile: AnatomyProfileId
  readonly graph: AirwayGraph
  readonly index: AirwayGraphIndex
  /** The label an edge carries, or its nearest labelled ancestor's (unlabelled connectors inherit). */
  readonly labelAt: (edgeId: number) => AirwayLabel | null
  /** Edges that carry a label themselves. */
  readonly ownLabel: ReadonlyMap<number, AirwayLabel>
  /** Each airway's most proximal edge — where it begins. */
  readonly originEdge: ReadonlyMap<AirwayLabel, number>
  /** Path distance from the start of the trachea to the start of each edge. */
  readonly edgeStartDepthMm: ReadonlyMap<number, number>
  /** Transport with the reviewed reference roll at the RUL, RML and LUL (an assist). */
  readonly framesReference: TransportFrames
  /** The same transport without those roll corrections. */
  readonly framesPlain: TransportFrames
  /** Where each airway's opening is: the reviewed ostial landmark, or just inside its first segment. */
  readonly ostiumPoint: ReadonlyMap<AirwayLabel, Vec3>
  readonly collider: LumenCollider | null
  readonly map: AirwayMapGeometry
  readonly interaction: TeachingGraphFile['interaction']
}

/** How far inside an airway's first segment its opening is placed when no landmark is reviewed. */
const OSTIUM_INSET_MM = 2

export function createScopeCase(
  file: TeachingGraphFile,
  options: { readonly collider?: LumenCollider | null } = {},
): ScopeCase {
  if (file.profileId !== 'adult-teaching-combined-left-basal-v1')
    throw new Error(`Unknown anatomy profile ${file.profileId}`)
  const graph = file.graph
  const index = createGraphIndex(graph)

  const ownLabel = new Map<number, AirwayLabel>()
  for (const edge of graph.edges) {
    const label = file.edgeLabels[String(edge.id)]?.abbreviatedLabel
    if (label && isAirwayLabel(label)) ownLabel.set(edge.id, label)
  }

  const parentEdgeOf = (edgeId: number): number | null => {
    const edge = index.edgesById.get(edgeId)
    if (!edge) return null
    return index.nodesById.get(edge.startNodeId)?.parentEdgeId ?? null
  }

  const inherited = new Map<number, AirwayLabel | null>()
  const labelAt = (edgeId: number): AirwayLabel | null => {
    if (inherited.has(edgeId)) return inherited.get(edgeId) ?? null
    let current: number | null = edgeId
    let found: AirwayLabel | null = null
    let guard = 0
    while (current != null && guard < graph.edges.length + 1) {
      guard += 1
      const own = ownLabel.get(current)
      if (own) {
        found = own
        break
      }
      current = parentEdgeOf(current)
    }
    inherited.set(edgeId, found)
    return found
  }

  const edgeStartDepthMm = new Map<number, number>()
  for (const edge of graph.edges) {
    edgeStartDepthMm.set(edge.id, index.nodesById.get(edge.startNodeId)?.rootDistanceMm ?? 0)
  }

  const originEdge = new Map<AirwayLabel, number>()
  for (const [edgeId, label] of ownLabel) {
    const parent = parentEdgeOf(edgeId)
    if (parent != null && labelAt(parent) === label) continue
    const existing = originEdge.get(label)
    if (
      existing === undefined ||
      (edgeStartDepthMm.get(edgeId) ?? 0) < (edgeStartDepthMm.get(existing) ?? 0)
    )
      originEdge.set(label, edgeId)
  }
  const missing = AIRWAY_LABELS.filter((label) => !originEdge.has(label))
  if (missing.length > 0) throw new Error(`The teaching graph does not carry ${missing.join(', ')}`)

  const landmarkPoints = new Map(file.ostialLandmarks.map((mark) => [mark.edgeId, mark.pointLps]))
  const ostiumPoint = new Map<AirwayLabel, Vec3>()
  for (const [label, edgeId] of originEdge) {
    const edge = index.edgesById.get(edgeId)!
    ostiumPoint.set(
      label,
      landmarkPoints.get(edgeId) ??
        sampleEdgePose(edge, Math.min(OSTIUM_INSET_MM, edge.lengthMm * 0.25)).point,
    )
  }

  return {
    profile: 'adult-teaching-combined-left-basal-v1',
    graph,
    index,
    labelAt,
    ownLabel,
    originEdge,
    edgeStartDepthMm,
    framesReference: buildTransportFrames(graph, [...file.orientationLandmarks]),
    framesPlain: buildTransportFrames(graph, []),
    ostiumPoint,
    collider: options.collider ?? null,
    map: buildAirwayMap(graph, labelAt, originEdge),
    interaction: file.interaction,
  }
}

export interface ScopeCaseLoaders {
  readonly fetchJson?: (url: string) => Promise<unknown>
  /**
   * Builds the lumen collider from the teaching lumen. Omitted, or failing, and the engine travels
   * the graph alone (the 2D fallback and the tests always do).
   */
  readonly loadCollider?: (url: string) => Promise<LumenCollider | null>
}

async function fetchJsonDefault(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`)
  return response.json()
}

const cache = new Map<string, Promise<ScopeCase>>()

/** Load a profile once per page; a custom loader bypasses the cache (tests, the asset harness). */
export function loadScopeCase(
  profile: AnatomyProfileId,
  loaders: ScopeCaseLoaders = {},
): Promise<ScopeCase> {
  const custom = loaders.fetchJson !== undefined || loaders.loadCollider !== undefined
  if (!custom) {
    const cached = cache.get(profile)
    if (cached) return cached
  }
  const promise = (async () => {
    const file = (await (loaders.fetchJson ?? fetchJsonDefault)(
      TEACHING_GRAPH_URL,
    )) as TeachingGraphFile
    if (file.profileId !== profile)
      throw new Error(`Expected the ${profile} profile, found ${file.profileId}`)
    let collider: LumenCollider | null = null
    if (loaders.loadCollider) {
      try {
        collider = await loaders.loadCollider(TEACHING_LUMEN_URL)
      } catch {
        collider = null
      }
    }
    return createScopeCase(file, { collider })
  })()
  if (!custom) {
    cache.set(profile, promise)
    promise.catch(() => cache.delete(profile))
  }
  return promise
}
