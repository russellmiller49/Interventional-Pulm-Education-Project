import type { LocalCtExercise } from '../content/ct-types'
import { traceById } from '../geometry/native-ct'
import { edgeCrossings } from './junction-feedback'

/**
 * Model course locators for the demonstration's intermediate planes. Each one is where a source
 * edge of the current division — the parent, or the daughter whose interval the demonstration is
 * in — actually crosses the native plane on screen. They are read from the unchanged airway graph,
 * never from dark pixels or by interpolating between unrelated structures, and they stay
 * model/reference information: a centreline crossing, not a reviewed lumen boundary.
 */
export interface CourseLocator {
  id: string
  edgeId: number
  role: 'parent' | 'daughter' | 'approach'
  code: string
  /** "Daughter A" for a daughter edge; the role word otherwise. */
  roleLabel: string
  pixel: [number, number]
  slice: number
}

/**
 * Which pass of the demonstration a frame belongs to. Pass 0 runs from the parent to the first
 * response plane and demonstrates every daughter marked on that plane; each later pass returns to
 * the parent and follows one remaining daughter. A return trip ends on the parent plane and the
 * next pass starts there, so consecutive parent frames count as one visit.
 */
function passIndexAt(frames: LocalCtExercise['frames'], start: number, frameIndex: number) {
  let visits = 0
  for (let i = 0; i <= frameIndex; i++)
    if (frames[i].slice === start && (i === 0 || frames[i - 1].slice !== start)) visits++
  return visits - 1
}

export function modelCourseLocators(
  exercise: LocalCtExercise,
  frameIndex: number,
): CourseLocator[] {
  const frame = exercise.frames[frameIndex]
  if (!frame) return []
  // A plane that already carries authored locators (the start, a response plane) needs none.
  if (frame.overlays.length) return []
  const checkpoint = exercise.trace.checkpoints[0]
  const decision = checkpoint.decision
  const parentEdge = decision?.parent.sourceEdgeId ?? checkpoint.sourceEdgeId
  const parentCode = decision?.parent.airway.code ?? checkpoint.airway.code
  const start = exercise.trace.anchor.slice
  const end = exercise.answerPoints[0].slice
  const edges: { edgeId: number; role: CourseLocator['role']; code: string; roleLabel: string }[] =
    []
  const pass = passIndexAt(exercise.frames, start, frameIndex)
  if (pass < 0) {
    // Approach frames before the demonstration reaches its parent: the source airway that
    // leads into this parent, where the registry records one.
    const source = traceById(exercise.spec.traceId)
    const entry = source.checkpoints.find((p) =>
      p.decision?.options.some((o) => o.sourceEdgeId === parentEdge),
    )?.decision
    if (entry)
      edges.push({
        edgeId: entry.parent.sourceEdgeId,
        role: 'approach',
        code: entry.parent.airway.code,
        roleLabel: 'Approach',
      })
  }
  edges.push({ edgeId: parentEdge, role: 'parent', code: parentCode, roleLabel: 'Parent' })
  if (decision && pass >= 0) {
    // Daughters marked on the first response plane are demonstrated together in pass 0; each
    // daughter marked elsewhere gets its own later pass, in source order.
    const later = decision.options.map((_, i) => i).filter((i) => decision.options[i].slice !== end)
    const demonstrated =
      pass === 0
        ? decision.options.map((_, i) => i).filter((i) => decision.options[i].slice === end)
        : later[pass - 1] === undefined
          ? []
          : [later[pass - 1]]
    for (const index of demonstrated)
      edges.push({
        edgeId: decision.options[index].sourceEdgeId,
        role: 'daughter',
        code: decision.options[index].airway.code,
        roleLabel: `Daughter ${String.fromCharCode(65 + index)}`,
      })
  }
  const locators: CourseLocator[] = []
  for (const edge of edges)
    for (const pixel of edgeCrossings(edge.edgeId, frame.slice)) {
      if (locators.some((l) => Math.hypot(l.pixel[0] - pixel[0], l.pixel[1] - pixel[1]) < 1))
        continue
      locators.push({
        id: `course-${edge.edgeId}-${locators.length}`,
        edgeId: edge.edgeId,
        role: edge.role,
        code: edge.code,
        roleLabel: edge.roleLabel,
        pixel,
        slice: frame.slice,
      })
    }
  return locators
}

/** One sentence for the demonstration caption, naming what the dotted crosshairs are. */
export function courseLocatorNote(locators: CourseLocator[]): string | null {
  if (!locators.length) return null
  const names = [...new Set(locators.map((l) => `${l.roleLabel} · ${l.code}`))].join(' and ')
  return `Dotted gold crosshair: where the model centreline of ${names} crosses this plane. A model course locator, not a reviewed lumen boundary.`
}
