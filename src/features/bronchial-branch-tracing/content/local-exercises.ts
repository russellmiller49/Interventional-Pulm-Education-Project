import type { LocalCtExercise, LocalExerciseSpec, CtTeachingFrame, CtCheckpoint } from './ct-types'
import { NATIVE_CT, sliceZ, traceById } from '../geometry/native-ct'
import routes from '../geometry/paired-routes.json'

export const ANNOTATION_VERSION = 'local-ct-model-locators-v1'
export const MODEL_REFERENCE_LABEL = 'Model reference — not yet faculty reviewed'

/** A model locator on a native plane. This is not an inferred lumen boundary. */
function modelPoint(edgeId: number, slice: number): [number, number] {
  const edge = routes.edges.find((e) => e.id === edgeId)!
  const z = sliceZ(slice)
  for (let i = 1; i < edge.points.length; i++) {
    const a = edge.points[i - 1],
      b = edge.points[i]
    if ((z - a[2]) * (z - b[2]) <= 0 && a[2] !== b[2]) {
      const f = (z - a[2]) / (b[2] - a[2])
      return [0, 1].map(
        (axis) =>
          (a[axis] + f * (b[axis] - a[axis]) - NATIVE_CT.origin[axis]) / NATIVE_CT.spacing[axis],
      ) as [number, number]
    }
  }
  throw new Error(`No model point on edge ${edgeId}, slice ${slice}`)
}

export function localExercise(spec: LocalExerciseSpec): LocalCtExercise {
  const source = traceById(spec.traceId)
  const checkpoint = source.checkpoints.find((p) => p.id === spec.checkpointId)
  if (!checkpoint?.decision) throw new Error(`Missing local bifurcation: ${spec.checkpointId}`)
  const parent = checkpoint.decision.parent
  const sameLumen = spec.kind === 'same-lumen'
  // The introductory interval stays proximal to the authored parent point.
  const start = sameLumen ? parent.slice + 8 : parent.slice
  const answerPoints = sameLumen
    ? [
        {
          label: parent.airway.code,
          slice: parent.slice + 4,
          pixel: modelPoint(parent.sourceEdgeId, parent.slice + 4),
        },
      ]
    : checkpoint.decision.options.map((o, i) => ({
        label: `${String.fromCharCode(65 + i)} · ${o.airway.code}`,
        slice: o.slice,
        pixel: o.pixel,
      }))
  const anchorPixel = sameLumen ? modelPoint(parent.sourceEdgeId, start) : parent.pixel
  const end = answerPoints[0].slice
  const frames: CtTeachingFrame[] = []
  const appendInterval = (from: number, to: number) => {
    const direction = to >= from ? 1 : -1
    for (let slice = from; ; slice += direction) {
      const overlays = answerPoints
        .filter((p) => p.slice === slice)
        .map((p) => ({ label: p.label, pixel: p.pixel }))
      if (slice === start)
        overlays.unshift({ label: `Parent · ${parent.airway.code}`, pixel: anchorPixel })
      frames.push({
        slice,
        caption:
          slice === start
            ? `Start at ${parent.airway.code}. The ring is a model locator. Inspect the air-filled lumen and its bounding walls on CT.`
            : sameLumen
              ? 'Keep the same air-filled lumen in view across the neighboring slices. If its identity becomes uncertain, return to the last definite lumen.'
              : overlays.length
                ? 'Compare these model daughter locations with the visible lumens. Return through the intervening slices to check each connection to the parent.'
                : 'Follow the parent lumen through this interval. Look for a division and the separating carina where visible; a change in wall appearance alone does not prove a branch origin.',
        overlays,
      })
      if (slice === to) break
    }
  }
  if (start === end) appendInterval(start + 2, end - 2)
  else appendInterval(start, end)
  for (const point of answerPoints.slice(1)) {
    if (point.slice !== end) {
      appendInterval(end, start)
      appendInterval(start, point.slice)
    }
  }
  const levels = [...frames.map((f) => f.slice), ...answerPoints.map((p) => p.slice)]
  const id = `${spec.traceId}.${spec.checkpointId}.${spec.kind}`
  const localCheckpoint: CtCheckpoint = sameLumen
    ? {
        ...checkpoint,
        decision: undefined,
        slice: end,
        pixel: answerPoints[0].pixel,
        airway: parent.airway,
        landmark: 'Same lumen on a neighboring slice',
      }
    : checkpoint
  const trace = {
    ...source,
    id: `local.${id}`,
    region: `${parent.airway.code} · local CT interval`,
    anchor: { ...parent, slice: start, pixel: anchorPixel },
    checkpoints: [localCheckpoint],
    range: [
      Math.max(source.range[0], Math.min(...levels) - 3),
      Math.min(source.range[1], Math.max(...levels) + 3),
    ] as [number, number],
    cropCenter: checkpoint.cropCenter ?? source.cropCenter,
    cropSize: checkpoint.cropSize ?? source.cropSize,
    airwayPath: [parent.airway, ...checkpoint.decision.options.map((o) => o.airway)],
  }
  // The same-lumen interval can lie above the original route's regional range.
  trace.range = [Math.min(trace.range[0], ...levels), Math.max(trace.range[1], ...levels)]
  return {
    id,
    spec,
    trace,
    frames,
    answerPoints,
    review: {
      status: 'provisional',
      reason:
        'Locations come from the existing airway model. Wall contours, continuous CT correspondence and parent-view openings await faculty review.',
    },
    task: sameLumen
      ? `Follow ${parent.airway.code} to the nearby answer slice and mark the same lumen, or record uncertainty.`
      : `Follow ${parent.airway.code} through this division. Mark each daughter on its answer slice, or record uncertainty.${spec.kind === 'integration' ? ' Then choose the branch you would follow toward the target segment.' : spec.kind === 'pattern' ? ' Describe its course in patient coordinates.' : ''}`,
    explanation: sameLumen
      ? 'Compare the marked air column with the starting lumen by replaying the short interval. A model point is only a location aid: a valid lumen mark need not sit on it. Keep uncertainty if you cannot maintain airway identity.'
      : `Return to ${parent.airway.code}, then follow each candidate through the intervening CT slices. Proximity or a matching branch name cannot establish continuity. Model daughter points support comparison; they do not validate your marks.`,
    hints: [
      `Inspect the cropped region around ${parent.airway.code}; keep its air-filled lumen and walls in view.`,
      `Return to the parent on slice ${start}. Step one slice at a time toward slice ${end}; backtrack whenever the connection becomes uncertain.`,
      'Replay the captioned CT interval and compare the model locators with the image. These provisional points are not reviewed wall contours or an answer key.',
    ],
  }
}
