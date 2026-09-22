import { Box3, Vector3 } from 'three'
import { LESION_CENTER, type Point3 } from '../../lib/physics'
import { add, chainStopAnchors, scale, type SuiteFrame } from './suiteModel'
import type { SuiteCamera } from './types'

/**
 * The views that show the whole chain, and so must frame every stop and its label whatever shape
 * the pane is. The rest — the beam's eye, the target close-up, the console — are deliberately
 * tight on one thing and are left where they are authored.
 */
export const OVERVIEW_VIEWS: readonly SuiteCamera[] = ['suite', 'room', 'anterior', 'side', 'head']

/** Which way is up on screen for a view. */
export function upFor(view: SuiteCamera): Point3 {
  return ['suite', 'room', 'console', 'head'].includes(view) ? [0, 1, 0] : [0, 0, 1]
}

export interface CameraPose {
  readonly target: Point3
  readonly position: Point3
  readonly up: Point3
}

/**
 * Where a preset puts the camera. Pure, so the pose that draws the scene is also the pose an
 * on-figure label is anchored against: the overview picture's labels (report O5) are checked
 * against this function rather than placed by eye.
 */
export function cameraPose({
  view,
  frame,
  fov,
  width,
  height,
  overviewBounds = [],
  focus = LESION_CENTER,
  closeupDistance,
  labelled = true,
  roomComposition = false,
  monitorOffset,
}: {
  view: SuiteCamera
  frame: SuiteFrame
  /** Vertical field of view in degrees; an overview is fitted only for a perspective camera. */
  fov: number | null
  width: number
  height: number
  overviewBounds?: readonly Point3[]
  focus?: Point3
  closeupDistance?: number
  labelled?: boolean
  roomComposition?: boolean
  monitorOffset?: Point3
}): CameraPose {
  const f = frame.geometry.field
  const anchors = chainStopAnchors(frame, monitorOffset)
  const target: Point3 =
    view === 'target'
      ? focus
      : view === 'console'
        ? scale(add(anchors.reconstruction, anchors.display), 0.5)
        : frame.iso
  const positions: Record<SuiteCamera, Point3> = {
    suite: [f * 2.1, f * 0.3, f * 1.8],
    room: roomComposition ? [f * 1.6, f * 1.45, f * 3.2] : [f * 2.5, f * 1.8, f * 2.5],
    anterior: [0, f * 2.5, 0.01],
    side: [f * 2.8, 0, 0.01],
    head: [0, 0.01, f * 2.8],
    target: add(
      focus,
      scale([0.45, 0.4, 0.3], closeupDistance ? closeupDistance / Math.hypot(0.45, 0.4, 0.3) : f),
    ),
    console: add(target, [f * 0.6, f * 0.3, f * 1.2]),
    beam: add(frame.source, scale(frame.normal, -f * 0.55)),
  }
  if (OVERVIEW_VIEWS.includes(view) && fov !== null) {
    // Fit the whole chain, with room for the DOM pin labels, at the actual pane aspect ratio.
    const points = [...frame.corners, ...Object.values(anchors), ...overviewBounds].map(
      (p) => new Vector3(...p),
    )
    const center = new Box3().setFromPoints(points).getCenter(new Vector3())
    const towardCamera = new Vector3(...positions[view]).normalize()
    // Build the screen axes from this view's own up. Using a fixed world up would collapse to
    // zero for the views that look straight down it, which is why they were left unfitted.
    const upHint = new Vector3(...upFor(view))
    const right = upHint.clone().cross(towardCamera).normalize()
    const up = towardCamera.clone().cross(right).normalize()
    const tanY = Math.tan((fov * Math.PI) / 360)
    const labelMargin = labelled ? (width < 420 ? 110 : 200) : 32
    const usableX = Math.max(0.35, 1 - labelMargin / width)
    const usableY = Math.max(0.5, 1 - 64 / height)
    const tanX = tanY * (width / height) * usableX
    let distance = frame.geometry.sid
    for (const point of points) {
      const delta = point.clone().sub(center)
      distance = Math.max(
        distance,
        delta.dot(towardCamera) + Math.abs(delta.dot(right)) / tanX,
        delta.dot(towardCamera) + Math.abs(delta.dot(up)) / (tanY * usableY),
      )
    }
    return {
      target: center.toArray() as Point3,
      position: center.clone().addScaledVector(towardCamera, distance).toArray() as Point3,
      up: upFor(view),
    }
  }
  return {
    target,
    position: positions[view],
    up: (view === 'beam' ? frame.v : upFor(view)) as Point3,
  }
}
