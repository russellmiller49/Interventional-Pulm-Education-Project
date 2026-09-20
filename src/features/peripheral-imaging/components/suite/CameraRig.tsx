'use client'
import { useEffect, useMemo, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { PerspectiveCamera } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { LESION_CENTER, type Point3 } from '../../lib/physics'
import { cameraPose } from './cameraPose'
import type { SuiteFrame } from './suiteModel'
import type { SuiteCamera } from './types'

const NO_BOUNDS: readonly Point3[] = []

/** The explicit camera moves the toolbar offers. `nonce` makes a repeated move a new command. */
export interface CameraCommand {
  readonly kind: 'rotate-left' | 'rotate-right' | 'zoom-in' | 'zoom-out' | 'reset'
  readonly nonce: number
}

/** One press turns the view this far about its vertical axis. */
export const CAMERA_ROTATE_STEP = Math.PI / 12
/** One press moves the camera this much nearer or further. */
export const CAMERA_ZOOM_STEP = 1.25

/**
 * Report 2.2 (fellow walkthrough, PDF p.16). The scene took the mouse wheel for its own zoom
 * whenever the pointer was over it, and in the component walk the scene spans the page, so an
 * ordinary scroll stopped dead until the pointer left the figure.
 *
 * The wheel now always belongs to the page: `enableZoom` is off, which is also what stops the
 * controls calling `preventDefault` on it, so Ctrl/Cmd + wheel reaches the browser's own zoom too.
 * Zoom and rotation are explicit toolbar buttons instead — reachable by keyboard, which the
 * pointer-only controls never were — and there is no camera mode to enter or to be left in.
 * Dragging with a mouse or pen still rotates. On a touch screen a vertical swipe scrolls the page
 * and a pinch is the browser's; a sideways drag turns the view. That last part is a stylesheet rule
 * (`.canvasHost canvas`), because the controls write `touch-action: none` inline whenever they
 * connect and an effect here cannot reliably run after every reconnect.
 */
export function CameraRig({
  view,
  frame,
  enabled,
  overviewBounds = NO_BOUNDS,
  focus = LESION_CENTER,
  closeupDistance,
  labelled = true,
  roomComposition = false,
  monitorOffset,
  command,
}: {
  view: SuiteCamera
  frame: SuiteFrame
  enabled: boolean
  overviewBounds?: readonly Point3[]
  focus?: Point3
  closeupDistance?: number
  labelled?: boolean
  roomComposition?: boolean
  monitorOffset?: Point3
  command?: CameraCommand | null
}) {
  const { camera, invalidate, size } = useThree()
  const controls = useRef<OrbitControlsImpl>(null)
  const config = useMemo(
    () =>
      cameraPose({
        view,
        frame,
        fov: camera instanceof PerspectiveCamera ? camera.fov : null,
        width: size.width,
        height: size.height,
        overviewBounds,
        focus,
        closeupDistance,
        labelled,
        roomComposition,
        monitorOffset,
      }),
    [
      view,
      frame,
      camera,
      size.width,
      size.height,
      overviewBounds,
      focus,
      closeupDistance,
      labelled,
      roomComposition,
      monitorOffset,
    ],
  )
  const resetNonce = command?.kind === 'reset' ? command.nonce : 0
  useEffect(() => {
    camera.position.set(...config.position)
    camera.up.set(...config.up)
    camera.lookAt(...config.target)
    camera.updateProjectionMatrix()
    controls.current?.update()
    invalidate()
  }, [camera, invalidate, config, resetNonce])
  useEffect(() => {
    const orbit = controls.current
    if (!orbit || !command || command.kind === 'reset') return
    if (command.kind === 'zoom-in') orbit.dollyOut(CAMERA_ZOOM_STEP)
    else if (command.kind === 'zoom-out') orbit.dollyIn(CAMERA_ZOOM_STEP)
    else
      orbit.setAzimuthalAngle(
        orbit.getAzimuthalAngle() +
          (command.kind === 'rotate-left' ? -CAMERA_ROTATE_STEP : CAMERA_ROTATE_STEP),
      )
    invalidate()
    // A command is identified by its nonce; the controls are a stable ref.
  }, [command, invalidate])
  return (
    <OrbitControls
      ref={controls}
      target={config.target}
      enabled={enabled}
      enablePan={false}
      enableZoom={false}
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
