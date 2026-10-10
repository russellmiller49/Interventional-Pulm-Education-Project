import type { CtNoduleTarget, CtTrace } from './ct-types'
import { CT_TARGETS, traceById } from '../geometry/native-ct'

/**
 * The simulated lesions a route can end beside, and the route used to reach each.
 *
 * Several routes in the export end at the same lesion (they differ only in where the old module
 * started them). One is named here per lesion so a lesion always opens the same route.
 */
const ROUTE_FOR_TARGET: Readonly<Record<string, string>> = {
  'r-apical-anterior': 'right-upper-apical',
  'r-apical-posterior': 'right-upper-distal',
  'r-anterior-upper': 'upper-oblique-lateral',
  'r-anterior-lower': 'upper-oblique-medial',
  'r-middle-lateral': 'middle-lobe-lateral',
  'r-middle-medial-a': 'middle-lobe-cranial',
  'r-middle-medial-b': 'middle-lobe-caudal',
  'r-anterior-basal': 'right-lower-basal',
  'l-apicoposterior': 'left-upper-division',
  'l-anterior': 'left-upper-anterior',
  'l-inferior-lingula': 'left-lingula',
  'l-superior': 'left-lower-returning',
  'l-lateral-basal': 'left-lower-basal',
}

export interface LobeGroup {
  lobe: string
  targets: CtNoduleTarget[]
}
const LOBES: { lobe: string; segments: string[] }[] = [
  { lobe: 'Right upper lobe', segments: ['RS1', 'RS2', 'RS3'] },
  { lobe: 'Right middle lobe', segments: ['RS4', 'RS5'] },
  { lobe: 'Right lower lobe', segments: ['RS6', 'RS7', 'RS8', 'RS9', 'RS10'] },
  { lobe: 'Left upper lobe', segments: ['LS1+2', 'LS3', 'LS4', 'LS5'] },
  { lobe: 'Left lower lobe', segments: ['LS6', 'LS7+8', 'LS8', 'LS9', 'LS10'] },
]

export const targetById = (id: string) => CT_TARGETS.find((target) => target.id === id)
export function traceForTarget(targetId: string): CtTrace {
  const traceId = ROUTE_FOR_TARGET[targetId]
  if (!traceId) throw new Error(`No route is named for lesion ${targetId}`)
  return traceById(traceId)
}
export const TARGET_IDS = Object.keys(ROUTE_FOR_TARGET)

/** The lesions by lobe, in the order a bronchoscopist counts the lobes. */
export function targetsByLobe(): LobeGroup[] {
  return LOBES.map(({ lobe, segments }) => ({
    lobe,
    targets: CT_TARGETS.filter(
      (target) => segments.includes(target.segment.code) && target.id in ROUTE_FOR_TARGET,
    ),
  })).filter((group) => group.targets.length)
}

/**
 * "RS5 · Right medial segment, by RB5b". Two lesions can share a segment; where they also share a
 * last bronchus (the two in RS3), the slice tells them apart.
 */
export function targetLabel(target: CtNoduleTarget) {
  const base = `${target.segment.code} · ${target.segment.name}, by ${target.approachCode}`
  const twin = CT_TARGETS.some(
    (other) =>
      other.id !== target.id &&
      other.id in ROUTE_FOR_TARGET &&
      other.segment.code === target.segment.code &&
      other.approachCode === target.approachCode,
  )
  return twin ? `${base}, slice ${target.slice}` : base
}

/** Three lesions in three different lobes for the closing set. */
export const ASSESS_TARGET_IDS = ['r-anterior-upper', 'l-inferior-lingula', 'r-anterior-basal']
