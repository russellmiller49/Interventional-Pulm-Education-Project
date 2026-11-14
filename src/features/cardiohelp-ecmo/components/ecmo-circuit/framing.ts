import * as THREE from 'three'

import type { SupportMode } from '../../engine/types'
import { CAMERA_FOV, CAMERA_POSITION, CAMERA_TARGET } from './constants'
import { blenderPlacement, buildCircuitLayout, consolePlacement } from './layout'

// Pure framing math for the bedside scene. No react and no @react-three imports: jest and node
// scripts load this file directly.

/**
 * The bed and the patient on it, as one world box.
 *
 * The bed frame and mattress are drawn from these same numbers in `BedsideScene`; the top is the
 * mannequin's chest, a little above the groin anchors (`layout.ts`, y ≈ −0.31).
 */
export const BED_AND_PATIENT_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-1.96, -0.73, -1.34),
  new THREE.Vector3(-0.74, -0.18, 0.74),
)

/** The integrated HLS module on its holder, around its pump head. */
const HLS_HALF_EXTENT = new THREE.Vector3(0.2, 0.34, 0.2)

function corners(box: THREE.Box3): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z))
    }
  }
  return points
}

/**
 * Every world point the overview has to hold: bed and patient, console, sweep-gas blender on its
 * pole, the HLS module, the three lines and the objects the labels name.
 */
export function bedsideContentPoints(supportMode: SupportMode): THREE.Vector3[] {
  const layout = buildCircuitLayout(supportMode)
  const hls = new THREE.Box3(
    layout.hlsModulePosition.clone().sub(HLS_HALF_EXTENT),
    layout.hlsModulePosition.clone().add(HLS_HALF_EXTENT),
  )
  return [
    ...corners(BED_AND_PATIENT_BOUNDS),
    ...corners(consolePlacement.worldBounds),
    ...corners(blenderPlacement.worldBounds),
    ...corners(hls),
    ...layout.drainageLine.getPoints(24),
    ...layout.returnLine.getPoints(24),
    ...layout.sweepLine.getPoints(16),
    ...layout.labels.map((label) => label.target),
  ]
}

export interface BedsideViewExtent {
  /** Tangents of the half-angles the content subtends, left/right and down/up of the view axis. */
  readonly left: number
  readonly right: number
  readonly down: number
  readonly up: number
}

/** How much of the default view, in tangent space, the content takes on each side of the axis. */
export function bedsideViewExtent(
  points: readonly THREE.Vector3[],
  position: readonly [number, number, number] = CAMERA_POSITION,
  target: readonly [number, number, number] = CAMERA_TARGET,
): BedsideViewExtent {
  const eye = new THREE.Vector3(...position)
  const forward = new THREE.Vector3(...target).sub(eye).normalize()
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
  const up = new THREE.Vector3().crossVectors(right, forward)
  const extent = { left: 0, right: 0, down: 0, up: 0 }
  const offset = new THREE.Vector3()
  for (const point of points) {
    offset.copy(point).sub(eye)
    const depth = offset.dot(forward)
    if (depth <= 0) continue
    const x = offset.dot(right) / depth
    const y = offset.dot(up) / depth
    extent.left = Math.max(extent.left, -x)
    extent.right = Math.max(extent.right, x)
    extent.down = Math.max(extent.down, -y)
    extent.up = Math.max(extent.up, y)
  }
  return extent
}

/** The larger of the two tracks' extents: VA adds the distal perfusion line. */
function widestExtent(): BedsideViewExtent {
  const vv = bedsideViewExtent(bedsideContentPoints('vv'))
  const va = bedsideViewExtent(bedsideContentPoints('va'))
  return {
    left: Math.max(vv.left, va.left),
    right: Math.max(vv.right, va.right),
    down: Math.max(vv.down, va.down),
    up: Math.max(vv.up, va.up),
  }
}

export const BEDSIDE_VIEW_EXTENT: BedsideViewExtent = widestExtent()

/**
 * Canvas pixels kept clear above and below the model for the label rails: the tallest pill (three
 * lines, 53 px) with its gap from the canvas edge.
 */
export const BEDSIDE_LABEL_RAIL_PX = 62
/** Canvas pixels kept clear at each side, so nothing is drawn against the frame. */
export const BEDSIDE_SIDE_MARGIN_PX = 20
/** How far the fit may enlarge or reduce the authored view. */
export const BEDSIDE_ZOOM_RANGE = { min: 0.7, max: 2.4 } as const

export interface BedsideViewWindow {
  /** How much larger than the authored view the scene is drawn. */
  readonly zoom: number
  /** `PerspectiveCamera.setViewOffset(fullWidth, fullHeight, x, y, width, height)`. */
  readonly fullWidth: number
  readonly fullHeight: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * The window of the authored view in which the whole bedside scene fills a canvas of this size.
 *
 * At the authored framing the scene took the middle 45 % of a 690 px pane, low and to the right,
 * and the upper third was empty floor; a learner review called it small. This fits the picture
 * without touching the rig: the camera's place, its target, its 36° lens and its zoom limits are
 * exactly as authored, so orbit, the pan fence and the glide home behave as they did. What changes
 * is which part of that view the canvas shows, as a larger virtual frame and an offset into it
 * (a lens shift): centred on the content, and enlarged until the content reaches the side margins
 * or the label rails, whichever comes first.
 */
export function bedsideViewWindow(
  width: number,
  height: number,
  extent: BedsideViewExtent = BEDSIDE_VIEW_EXTENT,
): BedsideViewWindow {
  const authored = { zoom: 1, fullWidth: width, fullHeight: height, x: 0, y: 0, width, height }
  if (!(width > 0) || !(height > 0)) return authored
  const usableHeight = Math.max(height - 2 * BEDSIDE_LABEL_RAIL_PX, height * 0.5)
  const usableWidth = Math.max(width - 2 * BEDSIDE_SIDE_MARGIN_PX, width * 0.5)
  // Canvas pixels per unit of tangent at the authored lens, then the scale that fits the content.
  const authoredScale = height / (2 * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2))
  const fitScale = Math.min(
    usableWidth / (extent.left + extent.right),
    usableHeight / (extent.up + extent.down),
  )
  const zoom = THREE.MathUtils.clamp(
    fitScale / authoredScale,
    BEDSIDE_ZOOM_RANGE.min,
    BEDSIDE_ZOOM_RANGE.max,
  )
  const scale = authoredScale * zoom
  const fullWidth = width * zoom
  const fullHeight = height * zoom
  // Where the middle of the content falls in the enlarged frame; the canvas is centred on it.
  const centreX = fullWidth / 2 + ((extent.right - extent.left) / 2) * scale
  const centreY = fullHeight / 2 - ((extent.up - extent.down) / 2) * scale
  return {
    zoom,
    fullWidth,
    fullHeight,
    x: centreX - width / 2,
    y: centreY - height / 2,
    width,
    height,
  }
}
