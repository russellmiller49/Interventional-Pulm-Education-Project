import { getAncestry, getNode } from '../airway-anatomy-lesson/airway-graph'
import type {
  AirwayNode,
  EndoscopicOpening,
  PatientDirection,
} from '../airway-anatomy-lesson/types'
import {
  CT_AXIAL_VIEW,
  CT_CORONAL_VIEW,
  clockDistance,
  clockOf,
} from '../airway-anatomy-lesson/view-orientation'
import type { GameTarget } from './airway-game'
import { resolveOstiaForChild } from './ostia'
import type { AirwayGraphIndex } from './scope-state'
import type { AirwayAnatomyCaseManifest, CenterlineLabels } from './types'

/**
 * What Bronch Quest tells the learner after a turn off the route to the target: the branch they
 * entered, the branch the route takes at that fork, the scope landmark that separates the two and,
 * where both carry a direction, where each runs on the linked CT.
 *
 * Nothing here is new anatomy. The landmark is the Airway Anatomy lesson's endoscopic view of the
 * fork (`AIRWAY_NODES[].endoscopicView`): its reference, each opening's clock and patient direction,
 * and its wall features. The CT line projects those same directions through the lesson's
 * `CT_AXIAL_VIEW` / `CT_CORONAL_VIEW`, which match the linked CT's axes (patient's right on the
 * image left). A pair with no authored direction on one side, or whose directions both fall on
 * one plane's line of sight, gets no CT line.
 */
export interface BranchDebrief {
  /** The branch the learner entered, as the module names it ("RML", "the RLL basal trunk"). */
  picked: string
  /** The branch the route to the target takes at the same fork. */
  intended: string
  /** The target the learner was sent to; equals `intended` at the target's own fork. */
  target: string
  /** The scope landmark that separates the two branches, or null when the lesson has none. */
  scope: string | null
  /** Where each branch runs on axial or coronal CT, or null when no plane separates them. */
  ct: string | null
}

type OstialLandmarks = AirwayAnatomyCaseManifest['ostialLandmarks']

/**
 * Case labels (and the manifest's reviewed ostium names) → the lesson node that carries the same
 * bronchus. The case splits the RUL into an unlabeled RB1/RB2 stem and RB3; the lesson's three
 * openings cover both.
 */
const LESSON_NODE_BY_LABEL: Record<string, string> = {
  TR: 'trachea',
  RMSB: 'rmb',
  LMSB: 'lmb',
  RUL: 'rul',
  BI: 'bronchus-intermedius',
  RML: 'rml',
  RLL: 'rll',
  LUL: 'lul',
  'Upper division': 'lul-upper',
  'LB4+5': 'lingula',
  LLL: 'lll',
  RB1: 'rb1',
  RB2: 'rb2',
  RB3: 'rb3',
  RB4: 'rb4',
  RB5: 'rb5',
  RB6: 'rb6',
  RB7: 'rb7',
  RB8: 'rb8',
  RB9: 'rb9',
  RB10: 'rb10',
  'LB1+2': 'lb1-2',
  LB3: 'lb3',
  LB4: 'lb4',
  LB5: 'lb5',
  LB6: 'lb6',
  'LB7+8': 'lb7-8',
  LB9: 'lb9',
  LB10: 'lb10',
}

const LABEL_BY_LESSON_NODE: Record<string, string> = Object.fromEntries(
  Object.entries(LESSON_NODE_BY_LABEL).map(([label, nodeId]) => [nodeId, label]),
)

/**
 * A lower-lobe edge that keeps the lobar label past a segmental takeoff is the basal trunk, the
 * lesson's name for it ("RLL basal trunk" at the bronchus intermedius; "the basal trunk" in the LLL).
 */
const CONTINUATION_NAME: Record<string, string> = {
  rll: 'the RLL basal trunk',
  lll: 'the LLL basal trunk',
}

const CODE_LABEL = /^[A-Z]{2,}[0-9+]*$|^[RL]B\d/

function displayLabel(label: string): string {
  return CODE_LABEL.test(label) ? label : `the ${label.toLowerCase()}`
}

function nameOfNode(nodeId: string): string {
  if (nodeId === 'trachea') return 'the trachea'
  const label = LABEL_BY_LESSON_NODE[nodeId]
  return label ? displayLabel(label) : (getNode(nodeId)?.shortLabel ?? nodeId)
}

/** The bare name inside a sentence that already supplies its article ("Looking down the BI"). */
function placeOfNode(nodeId: string): string {
  return nameOfNode(nodeId).replace(/^the /, '')
}

/**
 * The off-route edge just below the route: walking up from where the scope is now to the first
 * edge whose parent lies on the target's corridor. A free-drive jump deep into a branch still
 * reports the fork where the route was left.
 */
export function missedBranchEdgeId(
  target: GameTarget,
  edgeId: number,
  index: AirwayGraphIndex,
): number {
  const onRoute = (id: number) => target.pathEdgeIds.includes(id) || target.edgeIds.includes(id)
  let current = edgeId
  for (let guard = 0; guard < index.edgesById.size; guard += 1) {
    const edge = index.edgesById.get(current)
    const parentEdgeId = edge ? index.nodesById.get(edge.startNodeId)?.parentEdgeId : null
    if (parentEdgeId == null || onRoute(parentEdgeId)) return current
    current = parentEdgeId
  }
  return current
}

/** The module's names for the branch(es) behind an edge, looking through a short connector. */
function pickedLabels(
  index: AirwayGraphIndex,
  labels: CenterlineLabels,
  edgeId: number,
  landmarks: OstialLandmarks,
): string[] {
  const names: string[] = []
  for (const resolved of resolveOstiaForChild(index, labels, edgeId)) {
    const reviewed = landmarks?.find((landmark) => landmark.edgeId === resolved.steerEdgeId)
    const name = reviewed?.label ?? resolved.info?.abbreviatedLabel
    if (name && !names.includes(name)) names.push(name)
  }
  return names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

function sideOf(parent: AirwayNode): 'right' | 'left' | null {
  const chain = getAncestry(parent.id).map((node) => node.id)
  if (chain.includes('rmb')) return 'right'
  if (chain.includes('lmb')) return 'left'
  return null
}

const COMBINING: Partial<Record<string, string>> = { anterior: 'antero', posterior: 'postero' }

/** Patient directions in the words a bronchoscopist uses: right and left become lateral or medial. */
function directionWords(
  toward: PatientDirection | readonly PatientDirection[],
  side: 'right' | 'left' | null,
): string {
  const parts = (typeof toward === 'string' ? [toward] : [...toward]).map((part) =>
    side && (part === 'right' || part === 'left') ? (part === side ? 'lateral' : 'medial') : part,
  )
  if (parts.length === 2) {
    const front = parts.find((part) => COMBINING[part])
    const flank = parts.find((part) => part === 'medial' || part === 'lateral')
    if (front && flank) return `${COMBINING[front]}${flank}`
  }
  return parts.join(' and ')
}

const CT_PLANES = [
  { name: 'Axial', view: CT_AXIAL_VIEW },
  { name: 'Coronal', view: CT_CORONAL_VIEW },
] as const

const IMAGE_SIDES = [
  'top',
  'upper right',
  'right',
  'lower right',
  'bottom',
  'lower left',
  'left',
  'upper left',
]

interface DebriefOpening {
  name: string
  opening: EndoscopicOpening
}

function scopeLine(parent: AirwayNode, openings: DebriefOpening[], continuation: string | null) {
  const view = parent.endoscopicView
  if (!view) return null
  const side = sideOf(parent)
  const along = view.reference.looking === 'inferior' ? 'Looking down' : 'Looking into'
  const top = view.reference.top === 'superior' ? 'head' : view.reference.top
  const wall = view.wallFeatures?.find((feature) => feature.toward === 'posterior')
  const reference = `${along} the ${placeOfNode(parent.id)}, ${top} at 12${
    wall ? `, ${wall.label.toLowerCase()} at ${wall.clock}` : ''
  }`
  const parts = openings.map(({ name, opening }) => {
    if (!opening.toward) return `${name} at ${opening.clock} o'clock`
    if (clockOf(view.reference, opening.toward) === null) return `${name} straight ahead`
    return `${name} ${directionWords(opening.toward, side)}, ${opening.clock} o'clock`
  })
  if (continuation) parts.push(`${continuation.replace(/^the /, '')} continues ahead`)
  return `${reference}: ${parts.join(' · ')}`
}

function ctLine(openings: DebriefOpening[]) {
  if (openings.length < 2 || openings.some(({ opening }) => !opening.toward)) return null
  for (const plane of CT_PLANES) {
    const clocks = openings.map(({ opening }) => clockOf(plane.view, opening.toward!))
    if (clocks.some((clock) => clock === null)) continue
    const hours = clocks as number[]
    const separated = hours.some((hour) => hours.some((other) => clockDistance(hour, other) >= 1))
    if (!separated) continue
    const parts = openings.map(({ name }, i) => {
      const sector = Math.round((hours[i] % 12) / 1.5) % IMAGE_SIDES.length
      return `${name} toward the image ${IMAGE_SIDES[sector]}`
    })
    return `${plane.name}: ${parts.join(' · ')}`
  }
  return null
}

/**
 * The debrief for a turn into `pickedEdgeId` while the learner was sent to `target`, or null when
 * the entered branch has no name in the case.
 */
export function buildBranchDebrief({
  index,
  labels,
  ostialLandmarks,
  target,
  pickedEdgeId,
}: {
  index: AirwayGraphIndex
  labels: CenterlineLabels
  ostialLandmarks?: OstialLandmarks
  target: GameTarget
  pickedEdgeId: number
}): BranchDebrief | null {
  const names = pickedLabels(index, labels, pickedEdgeId, ostialLandmarks)
  if (!names.length) return null
  const targetName = displayLabel(target.abbr)
  const fallback: BranchDebrief = {
    picked: names.length > 1 ? `the ${names.join(' / ')} stem` : displayLabel(names[0]),
    intended: targetName,
    target: targetName,
    scope: null,
    ct: null,
  }

  const targetNode = LESSON_NODE_BY_LABEL[target.abbr]
  const pickedNodes = names.map((name) => LESSON_NODE_BY_LABEL[name])
  if (!targetNode || pickedNodes.some((node) => !node)) return fallback

  // The fork is the deepest lesson node shared by the target and the entered branch.
  const targetChain = getAncestry(targetNode).map((node) => node.id)
  const pickedChains = pickedNodes.map((node) => getAncestry(node).map((entry) => entry.id))
  const shared = targetChain.filter((id) => pickedChains.every((chain) => chain.includes(id)))
  const forkId = shared[shared.length - 1]
  const fork = forkId ? getNode(forkId) : undefined
  const intendedId = targetChain[targetChain.indexOf(forkId) + 1]
  if (!fork || !intendedId) return fallback

  // An edge that keeps the fork's own label (the basal trunk past RB6) continues the fork itself.
  const continuation = pickedNodes.includes(forkId) ? (CONTINUATION_NAME[forkId] ?? null) : null
  const pickedIds = pickedChains
    .map((chain) => chain[chain.indexOf(forkId) + 1])
    .filter((id): id is string => Boolean(id))
  const openingFor = (id: string) =>
    fork.endoscopicView?.openings.find((opening) => opening.childId === id)

  const debrief: BranchDebrief = {
    ...fallback,
    picked: continuation ?? fallback.picked,
    intended: nameOfNode(intendedId),
  }
  const openings: DebriefOpening[] = []
  for (const id of [intendedId, ...pickedIds]) {
    const opening = openingFor(id)
    if (!opening) return debrief
    openings.push({ name: placeOfNode(id), opening })
  }
  return {
    ...debrief,
    scope: scopeLine(fork, openings, continuation),
    ct: continuation ? null : ctLine(openings),
  }
}
