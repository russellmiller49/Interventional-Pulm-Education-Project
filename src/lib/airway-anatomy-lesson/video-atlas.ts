/**
 * Runtime helpers for the airway "Real bronchoscopy" video atlas.
 *
 * The overlay data (`/airway-lesson/airway-survey-overlays.json`) is generated
 * offline from a CVAT annotation of a normal diagnostic bronchoscopy (see
 * scripts/… extract_overlays.py). It carries, for a set of sampled frames, the
 * outline polygon(s) of every airway structure visible at that frame. This
 * module fetches it, indexes it for fast per-frame lookup, and provides the
 * geometry helpers (nearest-frame, point-in-polygon, centroid) the canvas
 * overlay and the identify-quiz need.
 */
import { AIRWAY_NODES } from '@/data/airway-anatomy-lesson/airway-map'

import type { QuizFramesData } from './airway-quiz'
import type { Lobe } from './types'

/** Public URL of the overlay dataset (served statically, no auth). */
export const OVERLAY_URL = '/airway-lesson/airway-survey-overlays.json'
export const SCOPE_SEGMENT_OVERLAY_URL = '/airway-lesson/airway-scope-segment-overlays.json'

export interface OverlayMeta {
  video: string
  poster: string
  /** Intrinsic overlay coordinate space; learner assets use the cropped scope field. */
  width: number
  height: number
  fps: number
  duration: number
  frameCount: number
  /** Frame sampling stride used when the data was generated. */
  step: number
  /** Which CVAT annotation set produced this manifest. */
  annotationSet?: string
  sourceWidth?: number
  sourceHeight?: number
  crop?: { x: number; y: number; width: number; height: number }
}

export interface OverlayStructure {
  /** CVAT label key, stable id within the dataset. */
  key: string
  /** Full display name, e.g. "RB6 · Superior". */
  name: string
  /** Compact label drawn on the video, e.g. "RB6". */
  short: string
  /** Lesson AirwayNode id for cross-linking to the 3D model / dendrogram. */
  node: string | null
  lobe: Lobe
  /** Region grouping for the structure list. */
  group: string
  shape: 'poly' | 'line'
  /** First / last frame this structure is annotated on. */
  first: number
  last: number
}

/** Raw compact shape: [structureIndex, x0, y0, x1, y1, …]. */
type RawShape = number[]
/** Raw compact frame: [frameNumber, shapes]. */
type RawFrame = [number, RawShape[]]

export interface OverlayData {
  meta: OverlayMeta
  structures: OverlayStructure[]
  frames: RawFrame[]
}

/** A shape resolved for drawing: structure index + flat point list. */
export interface FrameShape {
  s: number
  pts: number[]
}

export interface OverlayIndex {
  meta: OverlayMeta
  structures: OverlayStructure[]
  /** Ascending list of sampled frame numbers. */
  frameNums: number[]
  /** frameNumber → shapes present on that frame. */
  byFrame: Map<number, FrameShape[]>
  /** structureIndex → sorted frame numbers where it is present. */
  framesByStruct: Map<number, number[]>
}

export interface AirwayAtlasEntry {
  nodeId: string
  /** Node id represented by the video/still assets. LB1/LB2 map to LB1+2. */
  representativeNodeId: string
  structureIndex: number | null
  structure: OverlayStructure | null
  bestFrame: number | null
  clipStartFrame: number | null
  clipEndFrame: number | null
  stillUrl: string | null
  hasCt: boolean
  hasVideo: boolean
  quizEligible: boolean
  coverageNote?: string
}

export interface FrameMarker {
  structIndex: number
  structure: OverlayStructure
  x: number
  y: number
  area: number
}

export function isUpperAirwayStructure(structure: OverlayStructure): boolean {
  return structure.group === 'larynx'
}

export function isAtlasTargetStructure(structure: OverlayStructure): boolean {
  return Boolean(structure.node) || isUpperAirwayStructure(structure)
}

export const VIDEO_REPRESENTATIVE_NODE_ID: Record<string, string> = {
  lb1: 'lb1-2',
  lb2: 'lb1-2',
}

export const VIDEO_COVERAGE_NOTES: Record<string, string> = {
  lb1: 'Current bronchoscopy video annotations show LB1 and LB2 together as the LB1+2 apicoposterior segment. Use the CT and 3D model to separate the apical and posterior branches.',
  lb2: 'Current bronchoscopy video annotations show LB1 and LB2 together as the LB1+2 apicoposterior segment. Use the CT and 3D model to separate the apical and posterior branches.',
}

export async function loadOverlayData(signal?: AbortSignal): Promise<OverlayData> {
  const res = await fetch(OVERLAY_URL, { signal, cache: 'no-cache' })
  if (!res.ok) throw new Error(`Failed to load airway overlays: ${res.status}`)
  return (await res.json()) as OverlayData
}

export async function loadScopeSegmentOverlayData(signal?: AbortSignal): Promise<OverlayData> {
  const res = await fetch(SCOPE_SEGMENT_OVERLAY_URL, { signal, cache: 'no-cache' })
  if (!res.ok) throw new Error(`Failed to load airway scope-segment overlays: ${res.status}`)
  return (await res.json()) as OverlayData
}

export function buildIndex(data: OverlayData): OverlayIndex {
  const byFrame = new Map<number, FrameShape[]>()
  const framesByStruct = new Map<number, number[]>()
  const frameNums: number[] = []

  for (const [frame, shapes] of data.frames) {
    frameNums.push(frame)
    const resolved: FrameShape[] = shapes.map((sh) => ({ s: sh[0], pts: sh.slice(1) }))
    byFrame.set(frame, resolved)
    for (const shape of resolved) {
      const list = framesByStruct.get(shape.s)
      if (list) list.push(frame)
      else framesByStruct.set(shape.s, [frame])
    }
  }
  frameNums.sort((a, b) => a - b)
  for (const list of framesByStruct.values()) list.sort((a, b) => a - b)

  return { meta: data.meta, structures: data.structures, frameNums, byFrame, framesByStruct }
}

export function representativeNodeId(nodeId: string): string {
  return VIDEO_REPRESENTATIVE_NODE_ID[nodeId] ?? nodeId
}

export function coverageNoteForNode(nodeId: string): string | undefined {
  return VIDEO_COVERAGE_NOTES[nodeId]
}

/** Frame index for a media time (seconds). */
export function frameForTime(meta: OverlayMeta, seconds: number): number {
  return Math.round(seconds * meta.fps)
}

/** Media time (seconds) to seek to reach a given frame. */
export function timeForFrame(meta: OverlayMeta, frame: number): number {
  return frame / meta.fps
}

/**
 * Nearest sampled frame to `target`, or null if the closest sample is farther
 * than `maxGap` frames away (i.e. nothing was annotated near here).
 */
export function nearestFrame(index: OverlayIndex, target: number, maxGap: number): number | null {
  const f = index.frameNums
  const n = f.length
  if (n === 0) return null
  if (target <= f[0]) return f[0] - target <= maxGap ? f[0] : null
  if (target >= f[n - 1]) return target - f[n - 1] <= maxGap ? f[n - 1] : null

  let lo = 0
  let hi = n - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (f[mid] === target) return f[mid]
    if (f[mid] < target) lo = mid + 1
    else hi = mid - 1
  }
  // hi = last index < target, lo = first index > target
  const before = f[hi]
  const after = f[lo]
  const best = target - before <= after - target ? before : after
  return Math.abs(best - target) <= maxGap ? best : null
}

/** Shapes present at the sampled frame, or an empty array. */
export function shapesAt(index: OverlayIndex, frame: number | null): FrameShape[] {
  if (frame == null) return []
  return index.byFrame.get(frame) ?? []
}

/** Ray-casting point-in-polygon test. `pts` is flat [x,y,…] in overlay space. */
export function pointInPolygon(px: number, py: number, pts: number[]): boolean {
  let inside = false
  const n = pts.length / 2
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2]
    const yi = pts[i * 2 + 1]
    const xj = pts[j * 2]
    const yj = pts[j * 2 + 1]
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Shoelace area (absolute) of a flat polygon point list. */
export function polygonArea(pts: number[]): number {
  let area = 0
  const n = pts.length / 2
  for (let i = 0, j = n - 1; i < n; j = i++) {
    area += (pts[j * 2] + pts[i * 2]) * (pts[j * 2 + 1] - pts[i * 2 + 1])
  }
  return Math.abs(area / 2)
}

/** Vertex-average centroid of a flat point list. */
export function polygonCentroid(pts: number[]): { x: number; y: number } {
  let x = 0
  let y = 0
  const n = pts.length / 2
  for (let i = 0; i < n; i++) {
    x += pts[i * 2]
    y += pts[i * 2 + 1]
  }
  return { x: x / n, y: y / n }
}

export function firstRunForStructure(
  index: OverlayIndex,
  structIdx: number,
): { first: number; last: number } | null {
  const frames = index.framesByStruct.get(structIdx)
  if (!frames || frames.length === 0) return null
  const maxGap = index.meta.step * 6
  let last = frames[0]
  for (let i = 1; i < frames.length; i += 1) {
    if (frames[i] - frames[i - 1] <= maxGap) last = frames[i]
    else break
  }
  return { first: frames[0], last }
}

export function bestFrameForStructure(index: OverlayIndex, structIdx: number): number | null {
  const run = firstRunForStructure(index, structIdx)
  if (!run) return null
  const frames = index.framesByStruct.get(structIdx) ?? []
  let bestFrame = run.first
  let bestArea = -1
  for (const frame of frames) {
    if (frame < run.first || frame > run.last) continue
    const shape = shapesAt(index, frame).find((s) => s.s === structIdx)
    if (!shape) continue
    const area = polygonArea(shape.pts)
    if (area > bestArea) {
      bestArea = area
      bestFrame = frame
    }
  }
  return bestFrame
}

export function markersAtFrame(
  index: OverlayIndex,
  frame: number | null,
  options: { nodeOnly?: boolean; atlasTargetsOnly?: boolean } = {},
): FrameMarker[] {
  return shapesAt(index, frame)
    .map((shape) => {
      const structure = index.structures[shape.s]
      if (!structure) return null
      if (options.nodeOnly && !structure.node) return null
      if (options.atlasTargetsOnly && !isAtlasTargetStructure(structure)) return null
      const centroid = polygonCentroid(shape.pts)
      return {
        structIndex: shape.s,
        structure,
        x: centroid.x,
        y: centroid.y,
        area: structure.shape === 'poly' ? polygonArea(shape.pts) : 0,
      }
    })
    .filter((marker): marker is FrameMarker => marker != null)
}

export function currentScopeSegmentAt(
  index: OverlayIndex | null,
  targetFrame: number | null,
  maxGap?: number,
): FrameMarker | null {
  if (!index || targetFrame == null) return null
  const frame = nearestFrame(index, targetFrame, maxGap ?? index.meta.step + 1)
  const markers = markersAtFrame(index, frame, { nodeOnly: true })
  if (markers.length === 0) return null
  return markers.reduce((best, marker) => (marker.area > best.area ? marker : best), markers[0])
}

export function hitTestMarker(
  index: OverlayIndex,
  frame: number | null,
  x: number,
  y: number,
  radius = 34,
  options: { atlasTargetsOnly?: boolean } = {},
): number | null {
  let best: { structIndex: number; distance: number } | null = null
  for (const marker of markersAtFrame(index, frame, {
    nodeOnly: !options.atlasTargetsOnly,
    atlasTargetsOnly: options.atlasTargetsOnly,
  })) {
    const distance = Math.hypot(marker.x - x, marker.y - y)
    if (distance <= radius && (!best || distance < best.distance)) {
      best = { structIndex: marker.structIndex, distance }
    }
  }
  if (best) return best.structIndex

  // If the learner clicks inside a visible outline instead of exactly on the
  // dot, still treat it as the intended target; smaller polygons win.
  let polygonBest: { structIndex: number; area: number } | null = null
  for (const shape of shapesAt(index, frame)) {
    const structure = index.structures[shape.s]
    if (!structure || structure.shape !== 'poly') continue
    if (options.atlasTargetsOnly ? !isAtlasTargetStructure(structure) : !structure.node) continue
    if (!pointInPolygon(x, y, shape.pts)) continue
    const area = polygonArea(shape.pts)
    if (!polygonBest || area < polygonBest.area) {
      polygonBest = { structIndex: shape.s, area }
    }
  }
  return polygonBest?.structIndex ?? null
}

export function makeStructureChoices(
  structures: OverlayStructure[],
  targetIndex: number,
  count = 4,
  random: () => number = Math.random,
): number[] {
  const target = structures[targetIndex]
  if (!target) return []
  const shuffle = <T>(items: T[]) => {
    const out = items.slice()
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
  const eligible = structures
    .map((structure, index) => ({ structure, index }))
    .filter(({ structure }) => isAtlasTargetStructure(structure))
  const sameGroup = eligible
    .filter(({ structure, index }) => index !== targetIndex && structure.group === target.group)
    .map(({ index }) => index)
  const others = eligible
    .filter(({ structure, index }) => index !== targetIndex && structure.group !== target.group)
    .map(({ index }) => index)
  const distractors = Array.from(new Set([...shuffle(sameGroup), ...shuffle(others)])).slice(
    0,
    Math.max(0, count - 1),
  )
  return shuffle([targetIndex, ...distractors])
}

export function buildAirwayAtlas(
  index: OverlayIndex,
  options: { quizFrames?: QuizFramesData; ctNodeIds?: Set<string> } = {},
): Record<string, AirwayAtlasEntry> {
  const structureByNode = new Map<string, number>()
  index.structures.forEach((structure, structureIndex) => {
    if (structure.node) structureByNode.set(structure.node, structureIndex)
  })

  return Object.fromEntries(
    AIRWAY_NODES.map((node) => {
      const representative = representativeNodeId(node.id)
      const structureIndex = structureByNode.get(representative) ?? null
      const structure = structureIndex != null ? index.structures[structureIndex] : null
      const still = options.quizFrames?.structures[representative]
      const bestFrame =
        still?.frame ??
        (structureIndex != null ? bestFrameForStructure(index, structureIndex) : null)
      const clipStartFrame =
        bestFrame == null ? null : Math.max(0, Math.round(bestFrame - index.meta.fps * 1.2))
      const clipEndFrame =
        bestFrame == null
          ? null
          : Math.min(index.meta.frameCount - 1, Math.round(bestFrame + index.meta.fps * 2.4))
      const hasCt = options.ctNodeIds?.has(node.id) ?? Boolean(still?.hasCt)
      const hasVideo = structureIndex != null
      const isRepresentative = representative === node.id
      const quizEligible = isRepresentative && Boolean(still?.hasCt && still.img)
      const entry: AirwayAtlasEntry = {
        nodeId: node.id,
        representativeNodeId: representative,
        structureIndex,
        structure,
        bestFrame,
        clipStartFrame,
        clipEndFrame,
        stillUrl: still?.img ?? options.quizFrames?.structures[representative]?.img ?? null,
        hasCt,
        hasVideo,
        quizEligible,
        coverageNote: coverageNoteForNode(node.id),
      }
      return [node.id, entry]
    }),
  )
}

export function buildFindFrameCandidates(
  index: OverlayIndex,
): { frame: number; targets: number[] }[] {
  const out: { frame: number; targets: number[] }[] = []
  for (const [frame, shapes] of index.byFrame) {
    const targets = Array.from(
      new Set(
        shapes
          .filter((shape) => {
            const structure = index.structures[shape.s]
            return Boolean(structure?.node && structure.shape === 'poly')
          })
          .map((shape) => shape.s),
      ),
    )
    if (targets.length >= 2 && targets.length <= 8) out.push({ frame, targets })
  }
  return out
}

/** Nearest sampled frame at or after `from` where `structIdx` is present. */
export function firstFrameOf(index: OverlayIndex, structIdx: number): number | null {
  const list = index.framesByStruct.get(structIdx)
  return list && list.length > 0 ? list[0] : null
}

/**
 * A chapter in the guided scope journey. Frames are seek targets chosen to land
 * on a clean, recognizable view of that region.
 */
export interface AtlasChapter {
  id: string
  title: string
  subtitle: string
  frame: number
}

export const ATLAS_CHAPTERS: AtlasChapter[] = [
  {
    id: 'larynx',
    title: 'Larynx & vocal cords',
    subtitle: 'Glottis, cords, arytenoid tubercles',
    frame: 70,
  },
  {
    id: 'trachea',
    title: 'Trachea',
    subtitle: 'Cartilage rings anterior, membranous wall at 6 o’clock',
    frame: 360,
  },
  {
    id: 'carina',
    title: 'Main carina',
    subtitle: 'The sharp spur dividing RMB and LMB',
    frame: 520,
  },
  {
    id: 'rul',
    title: 'Right upper lobe',
    subtitle: 'RB1 apical · RB2 posterior · RB3 anterior',
    frame: 685,
  },
  {
    id: 'bi',
    title: 'Bronchus intermedius',
    subtitle: 'Past the RUL to the secondary carina',
    frame: 730,
  },
  { id: 'rml', title: 'Right middle lobe', subtitle: 'RB4 lateral · RB5 medial', frame: 860 },
  {
    id: 'rll',
    title: 'Right lower lobe',
    subtitle: 'RB6 superior, then the RB7–10 basal pyramid',
    frame: 950,
  },
  {
    id: 'left-main',
    title: 'Across to the left',
    subtitle: 'Withdraw to the carina, advance down the LMB',
    frame: 1235,
  },
  {
    id: 'lul',
    title: 'Left upper lobe',
    subtitle: 'Upper division — LB1+2 apicoposterior · LB3 anterior',
    frame: 1470,
  },
  { id: 'lingula', title: 'Lingula', subtitle: 'LB4 superior · LB5 inferior', frame: 1575 },
  {
    id: 'lll',
    title: 'Left lower lobe',
    subtitle: 'LB6 superior, then LB7+8, LB9, LB10 basals',
    frame: 1700,
  },
  {
    id: 'pullback',
    title: 'Pull-back',
    subtitle: 'Survey complete — withdraw to the trachea',
    frame: 1985,
  },
]
