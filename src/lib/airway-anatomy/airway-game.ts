import { clamp, distance, dot, normalize, subtract } from './geometry'
import { computeViewBasis } from './scope-state'
import type { AirwayGraph, AirwayGraphNode, CenterlineLabels, Vec3 } from './types'

/**
 * "Bronch Quest" — the pure game engine behind the gamified challenge mode of
 * the synchronized bronchoscopy trainer. Everything here is deterministic (an
 * optional rng is injectable) so the scoring, target building, and arrival
 * detection can be unit tested without a renderer.
 */

export type AirwayLobe = 'rul' | 'rml' | 'rll' | 'lul' | 'lingula' | 'lll' | 'central'
export type TargetTier = 'landmark' | 'segment'

export interface GameTarget {
  /** Anatomical abbreviation, e.g. "RB6". Unique per target. */
  abbr: string
  fullLabel: string
  /** Full label trimmed of the lobe prefix, for a compact subtitle. */
  shortName: string
  lobe: AirwayLobe
  tier: TargetTier
  /** Every edge that carries this label — the arrival set. */
  edgeIds: number[]
  /** Root→target corridor of edge ids; leaving it counts as a wrong turn. */
  pathEdgeIds: number[]
  /** A point well inside the segment used for the beacon and proximity meter. */
  anchorLps: Vec3
  /** Distance of the anchor from the tree root (a difficulty proxy). */
  depthMm: number
}

export const LOBE_COLORS: Record<AirwayLobe, string> = {
  rul: '#f97316',
  rml: '#eab308',
  rll: '#ef4444',
  lul: '#22d3ee',
  lingula: '#a855f7',
  lll: '#3b82f6',
  central: '#94a3b8',
}

export const LOBE_LABELS: Record<AirwayLobe, string> = {
  rul: 'Right upper lobe',
  rml: 'Right middle lobe',
  rll: 'Right lower lobe',
  lul: 'Left upper lobe',
  lingula: 'Lingula',
  lll: 'Left lower lobe',
  central: 'Central airway',
}

export function classifyLobe(fullLabel: string): AirwayLobe {
  const label = fullLabel.toLowerCase()
  if (label.includes('lingul')) return 'lingula'
  if (label.includes('right upper')) return 'rul'
  if (label.includes('right middle')) return 'rml'
  if (label.includes('right lower')) return 'rll'
  if (label.includes('left upper')) return 'lul'
  if (label.includes('left lower')) return 'lll'
  return 'central'
}

/** Segmental bronchi (RBn/LBn) are the harder tier; everything else is a landmark. */
export function targetTier(fullLabel: string): TargetTier {
  return /segment$/i.test(fullLabel.trim()) ? 'segment' : 'landmark'
}

/** Strip the "Right Upper Lobe" style prefix so the subtitle reads cleanly. */
export function shortSegmentName(fullLabel: string, abbr: string): string {
  if (/^bronchus intermedius$/i.test(fullLabel)) return 'Bronchus intermedius'
  let label = fullLabel.replace(/\s+Segment$/i, '').replace(/\s+Bronchus$/i, '')
  if (/^[RL]B\d/i.test(abbr)) {
    label = label.replace(/^(Right|Left)\s+(Upper|Middle|Lower)\s+Lobe\s+/i, '')
  }
  return label.trim() || abbr
}

function edgePathToNode(nodeId: number, nodeById: Map<number, AirwayGraphNode>): number[] {
  const reversed: number[] = []
  let current = nodeById.get(nodeId)
  let guard = 0
  while (current?.parentEdgeId != null && guard < nodeById.size + 1) {
    guard += 1
    reversed.push(current.parentEdgeId)
    current = current.parentNodeId == null ? undefined : nodeById.get(current.parentNodeId)
  }
  return reversed.reverse()
}

/**
 * Build one game target per distinct anatomical label. A target owns the full
 * set of edges carrying that label (so arrival is a simple membership test) and
 * a root→destination corridor used to detect wrong turns.
 */
export function buildGameTargets(graph: AirwayGraph, labels: CenterlineLabels): GameTarget[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]))

  const groups = new Map<string, { fullLabel: string; edgeIds: number[] }>()
  for (const [edgeIdStr, info] of Object.entries(labels.edgeLabels)) {
    if (!info) continue
    const edgeId = Number(edgeIdStr)
    if (!edgeById.has(edgeId)) continue
    const group = groups.get(info.abbreviatedLabel) ?? { fullLabel: info.fullLabel, edgeIds: [] }
    group.edgeIds.push(edgeId)
    groups.set(info.abbreviatedLabel, group)
  }

  const targets: GameTarget[] = []
  for (const [abbr, group] of groups) {
    let deepestEdgeId = group.edgeIds[0]
    let deepestDist = Number.NEGATIVE_INFINITY
    for (const edgeId of group.edgeIds) {
      const edge = edgeById.get(edgeId)
      if (!edge) continue
      const endDist = nodeById.get(edge.endNodeId)?.rootDistanceMm ?? 0
      if (endDist > deepestDist) {
        deepestDist = endDist
        deepestEdgeId = edgeId
      }
    }
    const deepEdge = edgeById.get(deepestEdgeId)
    if (!deepEdge) continue
    const anchorLps = deepEdge.pointsLps[deepEdge.pointsLps.length - 1] ?? deepEdge.pointsLps[0]
    const endNode = nodeById.get(deepEdge.endNodeId)
    const pathEdgeIds = endNode ? edgePathToNode(endNode.id, nodeById) : [...group.edgeIds]

    targets.push({
      abbr,
      fullLabel: group.fullLabel,
      shortName: shortSegmentName(group.fullLabel, abbr),
      lobe: classifyLobe(group.fullLabel),
      tier: targetTier(group.fullLabel),
      edgeIds: group.edgeIds,
      pathEdgeIds: pathEdgeIds.length ? pathEdgeIds : [...group.edgeIds],
      anchorLps: anchorLps ?? [0, 0, 0],
      depthMm: Number.isFinite(deepestDist) ? deepestDist : 0,
    })
  }

  return targets.sort((a, b) => targetSortKey(a).localeCompare(targetSortKey(b)))
}

function targetSortKey(target: GameTarget): string {
  const sideRank = target.abbr.startsWith('R') ? '1' : target.abbr.startsWith('L') ? '2' : '0'
  const number = target.abbr.match(/\d+/)?.[0]?.padStart(2, '0') ?? '00'
  return `${sideRank}-${number}-${target.abbr}`
}

/** True when the scope tip currently sits inside the target's labeled span. */
export function isArrived(target: GameTarget, currentEdgeId: number): boolean {
  return target.edgeIds.includes(currentEdgeId)
}

/** True when the current edge is off the corridor toward the target (a wrong turn). */
export function isOffCorridor(target: GameTarget, currentEdgeId: number): boolean {
  return !target.pathEdgeIds.includes(currentEdgeId) && !target.edgeIds.includes(currentEdgeId)
}

export interface Difficulty {
  id: 'landmarks' | 'segments' | 'mixed'
  label: string
  blurb: string
  tiers: TargetTier[]
  durationSec: number
}

export const DIFFICULTIES: Difficulty[] = [
  {
    id: 'landmarks',
    label: 'Landmarks',
    blurb: 'Trachea, mainstems & lobar bronchi',
    tiers: ['landmark'],
    durationSec: 90,
  },
  {
    id: 'segments',
    label: 'Segments',
    blurb: 'Every RB & LB segmental bronchus',
    tiers: ['segment'],
    durationSec: 120,
  },
  {
    id: 'mixed',
    label: 'Full airway',
    blurb: 'Landmarks and segments, mixed',
    tiers: ['landmark', 'segment'],
    durationSec: 120,
  },
]

export function difficultyById(id: string): Difficulty {
  return DIFFICULTIES.find((entry) => entry.id === id) ?? DIFFICULTIES[0]
}

type Rng = () => number

/** Fisher–Yates using an injectable rng (defaults to Math.random). */
export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const output = [...items]
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[output[i], output[j]] = [output[j], output[i]]
  }
  return output
}

/**
 * A shuffled play order for a difficulty. Consecutive entries never repeat the
 * same abbreviation so back-to-back targets always require real navigation.
 */
export function buildTargetQueue(
  targets: GameTarget[],
  difficulty: Difficulty,
  rng: Rng = Math.random,
): GameTarget[] {
  const eligible = targets.filter((target) => difficulty.tiers.includes(target.tier))
  const shuffled = shuffle(eligible, rng)
  for (let i = 1; i < shuffled.length; i += 1) {
    if (shuffled[i].abbr === shuffled[i - 1].abbr) {
      const swapWith = shuffled.findIndex(
        (target, index) => index > i && target.abbr !== shuffled[i - 1].abbr,
      )
      if (swapWith !== -1) {
        ;[shuffled[i], shuffled[swapWith]] = [shuffled[swapWith], shuffled[i]]
      }
    }
  }
  return shuffled
}

const TIER_CONFIG: Record<TargetTier, { base: number; parSec: number }> = {
  landmark: { base: 100, parSec: 16 },
  segment: { base: 150, parSec: 26 },
}

export interface ScoreInput {
  tier: TargetTier
  elapsedSec: number
  wrongTurns: number
  /** Combo streak going into this target (clean hits so far). */
  comboBefore: number
}

export interface ScoreResult {
  points: number
  stars: 1 | 2 | 3
  comboAfter: number
  clean: boolean
  timeBonus: number
  comboMultiplier: number
}

/**
 * Points reward speed and a clean path, scaled by the combo you carried in. A
 * clean hit (no wrong turns) extends the combo; any wrong turn resets it but
 * still scores. Stars grade the individual target independent of combo.
 */
export function scoreTarget({
  tier,
  elapsedSec,
  wrongTurns,
  comboBefore,
}: ScoreInput): ScoreResult {
  const config = TIER_CONFIG[tier]
  const clean = wrongTurns === 0
  const comboMultiplier = 1 + Math.min(Math.max(comboBefore, 0), 6) * 0.15
  const timeBonus = Math.max(0, Math.round((config.parSec - elapsedSec) * 6))
  const wrongPenalty = wrongTurns * 25
  const raw = Math.round((config.base + timeBonus) * comboMultiplier) - wrongPenalty
  const points = Math.max(15, raw)
  const stars: 1 | 2 | 3 =
    clean && elapsedSec <= config.parSec * 0.6
      ? 3
      : wrongTurns <= 1 && elapsedSec <= config.parSec
        ? 2
        : 1
  return {
    points,
    stars,
    comboAfter: clean ? comboBefore + 1 : 0,
    clean,
    timeBonus,
    comboMultiplier,
  }
}

const PROXIMITY_NEAR_MM = 10
const PROXIMITY_FAR_MM = 190

export interface TargetGuide {
  /** 0 (cold / far) → 1 (hot / arrived). */
  proximity: number
  distanceMm: number
  /** True when the anchor projects inside the view frustum. */
  onScreen: boolean
  leftPct: number
  topPct: number
  /** Screen-space bearing to the target in degrees, 0 = up, clockwise. */
  bearingDeg: number
  depthMm: number
}

interface GuidePose {
  tipLps: Vec3
  lookAtLps: Vec3
  tangentLps: Vec3
  yawDeg: number
  pitchDeg: number
  rollDeg: number
}

/**
 * Where a target sits relative to the current scope view: a proximity value for
 * the hot/cold meter, an on-screen reticle position, and a screen bearing for
 * the off-screen "this way" arrow. Mirrors the ScopeCamera basis so overlays
 * land on the rendered anatomy.
 */
export function computeTargetGuide(
  anchorLps: Vec3,
  pose: GuidePose,
  aspect: number,
  fovDeg: number,
): TargetGuide {
  const distanceMm = distance(pose.tipLps, anchorLps)
  const proximity = clamp(
    1 - (distanceMm - PROXIMITY_NEAR_MM) / (PROXIMITY_FAR_MM - PROXIMITY_NEAR_MM),
    0,
    1,
  )

  const base = normalize(subtract(pose.lookAtLps, pose.tipLps), pose.tangentLps)
  const { forward, right, up } = computeViewBasis(base, pose.yawDeg, pose.pitchDeg, pose.rollDeg)
  const offset = subtract(anchorLps, pose.tipLps)
  const depthMm = dot(offset, forward)
  const rightComponent = dot(offset, right)
  const upComponent = dot(offset, up)
  // Screen bearing: 0° points up, increases clockwise (matches CSS rotation).
  const bearingDeg = (Math.atan2(rightComponent, upComponent) * 180) / Math.PI

  let onScreen = false
  let leftPct = 50
  let topPct = 50
  if (depthMm > 1.5) {
    const tanHalfFov = Math.tan((fovDeg * Math.PI) / 360)
    const ndcX = rightComponent / (depthMm * tanHalfFov * Math.max(aspect, 0.1))
    const ndcY = upComponent / (depthMm * tanHalfFov)
    leftPct = (0.5 + ndcX / 2) * 100
    topPct = (0.5 - ndcY / 2) * 100
    onScreen = leftPct >= 4 && leftPct <= 96 && topPct >= 4 && topPct <= 96
  }

  return { proximity, distanceMm, onScreen, leftPct, topPct, bearingDeg, depthMm }
}
