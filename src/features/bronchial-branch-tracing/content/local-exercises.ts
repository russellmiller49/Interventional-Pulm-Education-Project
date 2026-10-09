import type { LocalCtExercise, LocalExerciseSpec, CtTeachingFrame, CtCheckpoint } from './ct-types'
import { NATIVE_CT, sliceZ, traceById } from '../geometry/native-ct'
import routes from '../geometry/paired-routes.json'
import manifest from '../../../../public/branch-tracing/native-v1/manifest.json'
import { localTeaching } from './local-teaching'

export const ANNOTATION_VERSION = 'local-ct-model-locators-v1'
export const MODEL_REFERENCE_LABEL = 'Gold crosshairs mark the airway model'

/**
 * A local example may be marked on a different plane from the route's own response plane.
 *
 * The route export puts both main-bronchus response points 5 mm below the tracheal node, on slice
 * 387, where the two bronchi still share one air column. They are separate lumens from slice 375
 * down, so Lesson 3's first example is marked on slice 372, where the carina stands between them
 * and the two centrelines are 30.5 mm apart. Only this local example moves: the routes that open
 * on this junction keep the exported plane.
 */
export const LOCAL_RESPONSE_SLICE: Record<string, number> = {
  'central-right.junction-1.bifurcation': 372,
}

/** The checkpoint with its daughter response points moved along their own centrelines. */
function atResponseSlice(checkpoint: CtCheckpoint, slice: number | undefined): CtCheckpoint {
  if (slice === undefined || !checkpoint.decision) return checkpoint
  return {
    ...checkpoint,
    decision: {
      ...checkpoint.decision,
      options: checkpoint.decision.options.map((option) => {
        const pixel = modelPoint(option.sourceEdgeId, slice, option.lps)
        return {
          ...option,
          slice,
          pixel,
          lps: [
            NATIVE_CT.origin[0] + pixel[0] * NATIVE_CT.spacing[0],
            NATIVE_CT.origin[1] + pixel[1] * NATIVE_CT.spacing[1],
            sliceZ(slice),
          ] as [number, number, number],
        }
      }),
    },
  }
}

/** A model locator on a native plane. This is not an inferred lumen boundary. */
export function modelPoint(
  edgeId: number,
  slice: number,
  near: readonly number[],
): [number, number] {
  const edge = routes.edges.find((e) => e.id === edgeId)!
  const z = sliceZ(slice)
  const candidates: { pixel: [number, number]; distance: number }[] = []
  for (let i = 1; i < edge.points.length; i++) {
    const a = edge.points[i - 1],
      b = edge.points[i]
    if ((z - a[2]) * (z - b[2]) <= 0 && a[2] !== b[2]) {
      const f = (z - a[2]) / (b[2] - a[2])
      const pixel = [0, 1].map(
        (axis) =>
          (a[axis] + f * (b[axis] - a[axis]) - NATIVE_CT.origin[axis]) / NATIVE_CT.spacing[axis],
      ) as [number, number]
      const world = a.map((v, axis) => v + f * (b[axis] - v))
      candidates.push({ pixel, distance: Math.hypot(...world.map((v, axis) => v - near[axis])) })
    }
  }
  if (candidates.length) return candidates.sort((a, b) => a.distance - b.distance)[0].pixel
  throw new Error(`No model point on edge ${edgeId}, slice ${slice}`)
}

export function localExercise(spec: LocalExerciseSpec): LocalCtExercise {
  const source = traceById(spec.traceId)
  const exported = source.checkpoints.find((p) => p.id === spec.checkpointId)
  if (!exported?.decision) throw new Error(`Missing local bifurcation: ${spec.checkpointId}`)
  const checkpoint = atResponseSlice(
    exported,
    LOCAL_RESPONSE_SLICE[`${spec.traceId}.${spec.checkpointId}.${spec.kind}`],
  )
  if (!checkpoint.decision) throw new Error(`Missing local bifurcation: ${spec.checkpointId}`)
  const parent = checkpoint.decision.parent
  const sameLumen = ['same-lumen', 'viewpoint'].includes(spec.kind)
  // The introductory interval stays proximal to the authored parent point.
  const start = sameLumen ? parent.slice + 8 : parent.slice
  const answerPoints = sameLumen
    ? [
        {
          label: parent.airway.code,
          slice: parent.slice + 4,
          pixel: modelPoint(parent.sourceEdgeId, parent.slice + 4, parent.lps),
        },
      ]
    : checkpoint.decision.options.map((o, i) => ({
        label: `${String.fromCharCode(65 + i)} · ${o.airway.code}`,
        slice: o.slice,
        pixel: o.pixel,
      }))
  const anchorPixel = sameLumen ? modelPoint(parent.sourceEdgeId, start, parent.lps) : parent.pixel
  const end = answerPoints[0].slice
  const teaching = localTeaching(spec, checkpoint)
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
            ? `Start at ${parent.airway.code}, slice ${slice}. ${teaching.finding} The ring marks the lumen's centre, not its wall.`
            : sameLumen
              ? `Slice ${slice}: ${slice === end ? 'This is the same lumen you started in. Compare its position and size with the starting slice.' : 'Keep the same dark lumen and its wall in view on this neighboring plane.'} Lost it? Go back to slice ${start}.`
              : overlays.length
                ? `Slice ${slice}: ${overlays.map((o) => o.label).join(' and ')} are marked here. ${teaching.comparison}`
                : `Slice ${slice}, ${sliceZ(slice) > sliceZ(start) ? 'cranial' : 'caudal'} to the parent slice: keep the lumen in view and watch for a wall appearing inside it. ${teaching.interval}`,
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
  // The three mapped LB6 divisions are cranially directed. Show the preceding
  // caudal LLL approach as a declared, unscored lead-in rather than inventing a
  // reversal within the segmental interval or crediting a skipped proximal fork.
  if (spec.kind === 'integration' && spec.checkpointId === 'junction-11') {
    const entry = source.checkpoints.find((p) => p.id === 'junction-6')!.decision!
    const originSlice = Math.round(
      (entry.junctionLps[2] - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2],
    )
    const leadIn: CtTeachingFrame[] = []
    for (let slice = entry.parent.slice; slice >= originSlice; slice--)
      leadIn.push({
        slice,
        overlays:
          slice === entry.parent.slice
            ? [{ label: 'LLL · approach context', pixel: entry.parent.pixel }]
            : [],
        caption: `Approach context, slice ${slice}: the source LLL course descends toward the LB6 origin. This proximal division is demonstrated; the recorded map begins at LB6.`,
      })
    for (let slice = originSlice + 1; slice < start; slice++)
      leadIn.push({
        slice,
        overlays: [],
        caption: `LB6 entry, slice ${slice}: distal travel now moves toward more cranial CT levels. Re-establish this same source airway before its first mapped division.`,
      })
    frames.unshift(...leadIn)
  }
  const levels = [...frames.map((f) => f.slice), ...answerPoints.map((p) => p.slice)]
  const id = `${spec.traceId}.${spec.checkpointId}.${spec.kind}`
  const localCheckpoint: CtCheckpoint = sameLumen
    ? {
        ...checkpoint,
        decision: undefined,
        // This new local plane has no source-HU sample; do not inherit the fork's value.
        sourceHu: undefined,
        sourceEdgeId: parent.sourceEdgeId,
        lps: [
          NATIVE_CT.origin[0] + answerPoints[0].pixel[0] * NATIVE_CT.spacing[0],
          NATIVE_CT.origin[1] + answerPoints[0].pixel[1] * NATIVE_CT.spacing[1],
          sliceZ(end),
        ],
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
    teaching: {
      ...teaching,
      sourceCase: 'case-001 / native-v1 axial',
      sourceSha256: manifest.sourceSha256,
      graphSha256: manifest.sourceGraphSha256,
      parentEdge: parent.sourceEdgeId,
      daughterEdges: sameLumen ? [] : checkpoint.decision.options.map((o) => o.sourceEdgeId),
      responseReason:
        'Each answer slice is where that daughter is marked. You can browse the whole interval; a mark is a point inside the lumen, not an outline of its wall.',
      overlayKind: 'model-locator',
      referenceFrame:
        'Native axial LPS; parent schematic uses the independently declared parent camera basis.',
    },
    review: {
      status: 'provisional',
      reason:
        'Locations come from the existing airway model. Wall contours, continuous CT correspondence and parent-view openings await faculty review.',
    },
    task: sameLumen
      ? `Follow ${parent.airway.code} to the nearby answer slice and mark the same lumen. If you lose it, go back to the last slice you were sure of and step again.`
      : `Follow ${parent.airway.code} through this division and mark each daughter on its answer slice. If the two lumens are not yet separate where you are looking, keep scrolling until a wall stands between them, then mark.${spec.kind === 'integration' ? ' Then choose the branch you would follow toward the target segment.' : spec.kind === 'pattern' ? ' Describe its course in patient coordinates.' : ''}`,
    explanation: sameLumen
      ? 'Replay the short interval and compare your marked lumen with the starting lumen: same place, same size, wall unbroken on every slice between. The ring marks the centre of the lumen; a mark anywhere inside that lumen is in the right place.'
      : `Go back to ${parent.airway.code} and follow each daughter through every slice between the parent and its answer slice. The lumen you can follow without a break is the daughter; a dark spot that is merely close by is not. The gold crosshairs show the centre of each lumen in the airway model.`,
    hints: [
      `Look at the cropped region around ${parent.airway.code}; keep its dark lumen and its wall in view.`,
      `Go back to the parent on slice ${start}. Step one slice at a time toward slice ${end}. When you lose the lumen, step back to the last slice you were sure of.`,
      'Replay the captioned CT interval and compare the gold crosshairs with the image. Each crosshair is the centre of that lumen in the airway model.',
    ],
  }
}
