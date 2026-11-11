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
  return ['anterior', 'beam', 'target'].includes(view) ? [0, 0, 1] : [0, 1, 0]
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
    // From the patient's left shoulder, a little above the table: the monitor cart stays beside
    // the table rather than in front of it, and the C-arm's stand stays behind.
    suite: [f * 1.55, f * 0.72, f * 2.25],
    room: roomComposition
      ? [f * 2.0, f * 1.05, f * 3.0] // Low enough that floor contours several metres across fill a wide, short pane.
      : [f * 2.5, f * 1.15, f * 2.5],
    anterior: [0, f * 2.5, 0.01],
    side: [f * 2.8, 0, 0.01],
    head: [0, 0.01, f * 2.8],
    target: add(
      focus,
      scale([0.45, 0.4, 0.3], closeupDistance ? closeupDistance / Math.hypot(0.45, 0.4, 0.3) : f),
    ),
    console: add(target, [f * 0.6, f * 0.3, f * 1.2]),
    // Just behind the focal spot: the view the beam has, through the table to the detector. The
    // spot itself stays in front of the camera, so its label is still drawn.
    beam: add(frame.source, scale(frame.normal, -f * 0.03)),
  }
  if (OVERVIEW_VIEWS.includes(view) && fov !== null) {
    // Fit the whole chain, with room for the DOM pin labels, at the actual pane aspect ratio.
    // The holder on the patient's right and the floor under the tube belong in every overview.
    const equipment: Point3[] = [
      add(frame.iso, [
        -(frame.geometry.sid / 2 + f * 0.36),
        frame.geometry.sid / 2 - frame.geometry.sod,
        0,
      ]),
      add(frame.iso, [0, -frame.geometry.sod - f * 0.25, 0]),
      add(frame.detectorCenter, scale(frame.normal, f * 0.22)),
    ]
    // With the image-formation map drawn, every component's pin must be in frame. Without it the
    // picture is of the patient and the C-arm, so the monitor cart may sit at the edge and the
    // subject is drawn larger — the scene is often no wider than a phone in the lesson layout.
    const framed = labelled
      ? Object.values(anchors)
      : [anchors.source, anchors.beam, anchors.patient, anchors.detector]
    const points = [...frame.corners, ...framed, ...equipment, ...overviewBounds].map(
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
    // The fit is conservative: it clears a box round every piece of equipment. The still of the
    // room is composed, not labelled, so it stands closer.
    if (roomComposition) {
      distance *= 0.9
      // The cart stands nearer the camera than the C-arm's stand, so a view aimed at the middle of
      // the room draws it left of centre. Step sideways until the picture is balanced.
      center.addScaledVector(right, 0.15 * distance * tanY * (width / height))
    }
    return {
      target: center.toArray() as Point3,
      position: center.clone().addScaledVector(towardCamera, distance).toArray() as Point3,
      up: upFor(view),
    }
  }
  return {
    target: view === 'beam' ? frame.detectorCenter : target,
    position: positions[view],
    up: (view === 'beam' ? frame.v : upFor(view)) as Point3,
  }
}
