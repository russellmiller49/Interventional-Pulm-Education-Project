'use client'
import { useEffect, useMemo, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { PerspectiveCamera } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { LESION_CENTER, type Point3 } from '../../lib/physics'
import { cameraPose, OVERVIEW_VIEWS } from './cameraPose'
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
  rollDeg = 0,
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
  /**
   * The patient rolled about the long axis (a wedge). The scene's patient-side objects are drawn in
   * a group rolled by this angle, so the camera rolls with them: the beam view stays behind the
   * physical tube, and the overview views keep the room's up so the patient, not the room, tilts.
   */
  rollDeg?: number
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
  const rolled = useMemo(() => {
    if (rollDeg === 0) return config
    const a = (rollDeg * Math.PI) / 180
    const roll = ([x, y, z]: readonly number[]): Point3 => [
      x * Math.cos(a) - y * Math.sin(a),
      x * Math.sin(a) + y * Math.cos(a),
      z,
    ]
    return {
      ...config,
      position: roll(config.position),
      target: roll(config.target),
      up: (OVERVIEW_VIEWS as readonly SuiteCamera[]).includes(view) ? config.up : roll(config.up),
    }
  }, [config, rollDeg, view])
  const resetNonce = command?.kind === 'reset' ? command.nonce : 0
  useEffect(() => {
    camera.position.set(...rolled.position)
    camera.up.set(...rolled.up)
    camera.lookAt(...rolled.target)
    camera.updateProjectionMatrix()
    controls.current?.update()
    invalidate()
  }, [camera, invalidate, rolled, resetNonce])
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
      target={rolled.target}
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
