'use client'
import { useEffect, useMemo } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Box3, PerspectiveCamera, Vector3 } from 'three'
import { LESION_CENTER, type Point3 } from '../../lib/physics'
import { add, chainStopAnchors, scale, type SuiteFrame } from './suiteModel'
import type { SuiteCamera } from './types'

/**
 * The views that show the whole chain, and so must frame every stop and its label whatever shape
 * the pane is. The rest — the beam's eye, the target close-up, the console — are deliberately
 * tight on one thing and are left where they are authored.
 */
const NO_BOUNDS: readonly Point3[] = []
const OVERVIEW_VIEWS: readonly SuiteCamera[] = ['suite', 'room', 'anterior', 'side', 'head']

/** Which way is up on screen for a view. */
function upFor(view: SuiteCamera): Point3 {
  return ['suite', 'room', 'console', 'head'].includes(view) ? [0, 1, 0] : [0, 0, 1]
}

export function CameraRig({
  view,
  frame,
  enabled,
  overviewBounds = NO_BOUNDS,
  focus = LESION_CENTER,
  closeupDistance,
  labelled = true,
}: {
  view: SuiteCamera
  frame: SuiteFrame
  enabled: boolean
  overviewBounds?: readonly Point3[]
  focus?: Point3
  closeupDistance?: number
  labelled?: boolean
}) {
  const { camera, invalidate, size } = useThree()
  const config = useMemo(() => {
    const f = frame.geometry.field
    const anchors = chainStopAnchors(frame)
    const target: Point3 =
      view === 'target'
        ? focus
        : view === 'console'
          ? scale(add(anchors.reconstruction, anchors.display), 0.5)
          : frame.iso
    const positions: Record<SuiteCamera, Point3> = {
      suite: [f * 2.1, f * 0.3, f * 1.8],
      room: [f * 2.5, f * 1.8, f * 2.5],
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
    if (OVERVIEW_VIEWS.includes(view) && camera instanceof PerspectiveCamera) {
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
      const tanY = Math.tan((camera.fov * Math.PI) / 360)
      const labelMargin = labelled ? (size.width < 420 ? 110 : 200) : 32
      const usableX = Math.max(0.35, 1 - labelMargin / size.width)
      const usableY = Math.max(0.5, 1 - 64 / size.height)
      const tanX = tanY * (size.width / size.height) * usableX
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
  }, [
    view,
    frame,
    camera,
    size.width,
    size.height,
    overviewBounds,
    focus,
    closeupDistance,
    labelled,
  ])
  useEffect(() => {
    camera.position.set(...config.position)
    camera.up.set(...config.up)
    camera.lookAt(...config.target)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, config])
  return (
    <OrbitControls
      target={config.target}
      enabled={enabled}
      enablePan={false}
      enableDamping={false}
      minDistance={
        view === 'target' && closeupDistance ? closeupDistance * 0.35 : frame.geometry.field * 0.15
      }
      maxDistance={Math.max(
        frame.geometry.sid * 4,
        Math.hypot(...config.position.map((n, i) => n - config.target[i])) * 2,
      )}
    />
  )
}
