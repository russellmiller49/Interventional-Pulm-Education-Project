import type { Branch, Exercise, Pattern, Phantom } from './types'
import { cameraFrame, dot, subtract, type Vec3 } from '../geometry/coordinates'

export const OPENING_POSITIONS = ['12', '1:30', '3', '4:30', '6', '7:30', '9', '10:30'] as const
export type OpeningPosition = (typeof OPENING_POSITIONS)[number]
export function openingPosition(phantom: Phantom, branch: Branch): OpeningPosition {
  const c = phantom.camera
  const frame = cameraFrame(c.position, c.target, c.up, c.roll)
  const offset = subtract(branch.points[branch.points.length - 1], c.target)
  const degrees = (Math.atan2(dot(offset, frame.right), dot(offset, frame.up)) * 180) / Math.PI
  return OPENING_POSITIONS[Math.round((degrees + 360) / 45) % 8]
}
export function childrenOf(phantom: Phantom) {
  return phantom.branches.filter((b) => b.parentId === phantom.rootId)
}

export function viewConvention(phantom: Phantom) {
  const vertical = phantom.camera.position[2] > 0
  return `Looking ${vertical ? 'caudally' : 'anteriorly'} along the parent. At zero roll, ${vertical ? 'anterior' : 'cranial'} is screen-up. The displayed image is rotated ${phantom.camera.roll}° clockwise from that reference.`
}

/** Original mathematical teaching objects, not segmented lungs or claims about named bronchi. */
export function makePhantom(pattern: Pattern, variant = 0): Phantom {
  const sign = variant % 2 ? -1 : 1
  const vertical = pattern === 'vertical' || pattern === 'variant' || pattern === 'reversal'
  const start: Vec3 = vertical ? [0, 0, 32] : [0, -32, 0]
  let ends: Vec3[]
  if (pattern === 'horizontal-horizontal')
    ends = [
      [-25 * sign, 25, 0],
      [25 * sign, 25, 0],
    ]
  else if (pattern === 'horizontal-vertical')
    ends = [
      [0, 20, 25 * sign],
      [0, 20, -25 * sign],
    ]
  else if (pattern === 'horizontal-oblique')
    ends = [
      [-20 * sign, 24, 20],
      [24 * sign, 24, -16],
    ]
  else
    ends = [
      [-24 * sign, 10, -26],
      [24 * sign, -10, -26],
    ]
  if (pattern === 'variant') ends.push([0, 27, -23])
  const ids = ends.map((_, i) => `branch-${String.fromCharCode(97 + i)}`)
  const base = {
    namedGeneration: null,
    kind: 'standard' as const,
    lumenEvidence: 'visible' as const,
    geometryStatus: 'synthetic' as const,
    labelStatus: 'unnamed' as const,
  }
  const branches: Branch[] = [
    {
      ...base,
      id: 'parent',
      parentId: null,
      childIds: ids,
      points: [start, [0, 0, 0]],
      radius: 6,
      label: 'Parent',
      topologicalDepth: 0,
    },
  ]
  ends.forEach((end, i) => {
    const points: Vec3[] =
      pattern === 'reversal' && i === variant % 2
        ? [
            [0, 0, 0],
            [end[0] * 0.6, end[1] * 0.6, -20],
            [end[0], end[1], 18],
          ]
        : [[0, 0, 0], end]
    branches.push({
      ...base,
      id: ids[i],
      parentId: 'parent',
      childIds: [],
      points,
      radius: 4,
      label: String.fromCharCode(65 + i),
      topologicalDepth: 1,
    })
  })
  return {
    id: `phantom-${pattern}-${variant}`,
    kind: 'synthetic',
    frame: 'RAS-mm',
    rootId: 'parent',
    pattern,
    branches,
    camera: {
      position: vertical ? [0, 0, 20] : [0, -20, 0],
      target: [0, 0, 0],
      up: vertical ? [0, 1, 0] : [0, 0, 1],
      roll: variant >= 4 ? 90 : 0,
      fov: 80,
    },
    sliceRange: [-34, 34],
    initialSlice: vertical ? -12 : 0,
  }
}

export function makeExercise(
  pattern: Pattern,
  variant: number,
  focus: 'direction' | 'roll' | 'uncertainty' = 'direction',
): Exercise {
  const phantom = makePhantom(pattern, variant)
  const children = childrenOf(phantom)
  const selected = children[variant % children.length]
  const end = selected.points[selected.points.length - 1]
  let direction = end[0] > 0 ? 'patient right' : 'patient left'
  if (pattern === 'horizontal-vertical') direction = end[2] > 0 ? 'cranially' : 'caudally'
  if (pattern === 'variant' && selected.id === 'branch-c')
    direction = 'anteriorly between its neighbors'
  if (pattern === 'reversal') direction = 'caudally and then turns cranially'
  const unresolved = focus === 'uncertainty'
  if (unresolved) selected.lumenEvidence = 'partial'
  const targetId = unresolved ? 'unresolved' : selected.id
  return {
    id: `${phantom.id}-${focus}`,
    phantom,
    targetId,
    question: unresolved
      ? 'Beyond the displayed proximal division, the airway is no longer resolved on CT but an accompanying vessel continues. What can you conclude about the distal airway connection?'
      : pattern === 'reversal'
        ? 'Which branch first runs caudally and then turns cranially? Predict its opening in the stated parent view.'
        : `Follow the branch that courses ${direction}. Which daughter is it, and where will its opening appear in the stated parent view?`,
    evidence: unresolved
      ? 'Authored observation for this exercise: distal airway continuity is no longer visible; a vessel is reported farther along the expected course. The phantom shows the proximal division only, not that vessel or the distal destination.'
      : `The complete course of this mathematical airway is represented in the axial stack. View along the parent; reference roll ${phantom.camera.roll}°.`,
    rationale: unresolved
      ? 'The distal airway connection remains unresolved. A vessel can suggest a direction to investigate, but it does not demonstrate continuous bronchial lumen.'
      : pattern === 'reversal'
        ? 'A route can descend and then ascend. Follow the same connected lumen while reversing slice direction; a monotonic slice number is not a route.'
        : `Branch ${selected.label} follows the requested patient-space course. Its opening is at ${openingPosition(phantom, selected)} in this specified schematic view. Reconstruct the view along the parent before assigning an opening.`,
    misconceptions: Object.fromEntries([
      ...children.map((b) => [
        b.id,
        unresolved
          ? 'A visible proximal opening does not establish its unseen distal connection. Keep the inference separate from demonstrated continuity.'
          : `Branch ${b.label} is a different child of this parent. Recheck the course through adjacent slices; a screen position alone does not identify the destination.`,
      ]),
      [
        'unresolved',
        'This phantom supplies connected geometry throughout the requested course. Trace that evidence before deciding the continuation is unresolved.',
      ],
    ]),
    hints: [
      'Identify the parent and follow the same lumen across neighboring planes.',
      'Use the patient-axis letters before applying the displayed camera roll.',
    ],
  }
}
