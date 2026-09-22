import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * Intentional engagement for an observer camera (EBUS-PRE-REVIEW-03, L3-13).
 *
 * A large 3D surface used to own the wheel outright: OrbitControls zoomed on every wheel event
 * over it (with `preventDefault`), so a page could not be scrolled through the model, and it set
 * `touch-action: none`, so a finger that landed on the canvas could not scroll the page either.
 * The caption meanwhile promised "scroll to zoom", which the walkthrough could not reproduce.
 *
 * Now the wheel and one-finger touch only drive the camera while the view is *engaged* — after a
 * click, tap or keyboard focus on it — and Escape, blur, or a pointer-down anywhere else releases
 * it. While engaged, two-finger gestures orbit and pinch. The
 * explicit buttons and the keyboard work without engaging anything. Mouse drag orbit is unchanged.
 * The browser's own zoom is never intercepted.
 */
export interface ObserverControlsHandle {
  engage(): void
  release(): void
  engaged(): boolean
  /** factor > 1 moves the camera closer. */
  zoom(factor: number): void
  orbit(angle: number): void
  tilt(angle: number): void
  dispose(): void
}
export function attachObserverControls(
  orbit: OrbitControls,
  camera: THREE.PerspectiveCamera,
  element: HTMLCanvasElement,
  hooks: { render: () => void; reset: () => void; onEngagement?: (engaged: boolean) => void },
): ObserverControlsHandle {
  let engaged = false
  element.tabIndex = 0
  orbit.touches.TWO = THREE.TOUCH.DOLLY_ROTATE
  const apply = () => {
    orbit.enableZoom = engaged
    // With no one-finger action the browser keeps vertical page panning; two fingers still orbit.
    orbit.touches.ONE = (engaged ? THREE.TOUCH.ROTATE : null) as unknown as THREE.TOUCH
    element.style.touchAction = engaged ? 'none' : 'pan-y'
    element.dataset.engaged = String(engaged)
    hooks.onEngagement?.(engaged)
  }
  const engage = () => {
    if (engaged) return
    engaged = true
    apply()
  }
  const release = () => {
    if (!engaged) return
    engaged = false
    apply()
  }
  const zoom = (factor: number) => {
    const offset = camera.position.clone().sub(orbit.target)
    const length = Math.min(orbit.maxDistance, Math.max(orbit.minDistance, offset.length() / factor))
    camera.position.copy(orbit.target).add(offset.setLength(length))
    orbit.update()
    hooks.render()
  }
  const orbitBy = (angle: number) => {
    const offset = camera.position.clone().sub(orbit.target).applyAxisAngle(camera.up, angle)
    camera.position.copy(orbit.target).add(offset)
    orbit.update()
    hooks.render()
  }
  const tilt = (angle: number) => {
    const offset = camera.position.clone().sub(orbit.target)
    const axis = new THREE.Vector3().crossVectors(camera.up, offset).normalize()
    if (axis.lengthSq() < 1e-9) return
    const next = offset.clone().applyAxisAngle(axis, angle)
    // Stay off the poles so the view never flips over the up axis.
    const elevation = Math.acos(THREE.MathUtils.clamp(next.clone().normalize().dot(camera.up), -1, 1))
    if (elevation < 0.08 || elevation > Math.PI - 0.08) return
    camera.position.copy(orbit.target).add(next)
    orbit.update()
    hooks.render()
  }
  /*
   * A mouse or pen engages on the click itself. A finger engages only on a tap: a touch that
   * moves is a page scroll (or, with two fingers, an orbit) and must not turn the wheel and
   * one-finger control on for the gesture after it.
   */
  let touchStart: { x: number; y: number } | null = null
  const down = (event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      touchStart = { x: event.clientX, y: event.clientY }
      return
    }
    engage()
  }
  const up = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' || !touchStart) return
    const moved = Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y)
    touchStart = null
    if (moved < 8) engage()
  }
  const cancel = () => {
    touchStart = null
  }
  const focus = () => engage()
  const blur = () => release()
  const outside = (event: PointerEvent) => {
    if (!element.contains(event.target as Node)) release()
  }
  const key = (event: KeyboardEvent) => {
    // Modified shortcuts belong to the browser (including zoom and reset zoom).
    if (event.ctrlKey || event.metaKey || event.altKey) return
    switch (event.key) {
      case 'ArrowLeft':
        orbitBy(-0.15)
        break
      case 'ArrowRight':
        orbitBy(0.15)
        break
      case 'ArrowUp':
        tilt(-0.12)
        break
      case 'ArrowDown':
        tilt(0.12)
        break
      case '+':
      case '=':
        zoom(1.25)
        break
      case '-':
      case '_':
        zoom(0.8)
        break
      case 'Home':
      case '0':
        hooks.reset()
        break
      case 'Escape':
        release()
        return
      default:
        return
    }
    event.preventDefault()
  }
  // OrbitControls prevents every wheel event while zoom is enabled. Let browser
  // zoom/pinch wheel gestures reach their native default before that listener runs.
  const browserWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) event.stopImmediatePropagation()
  }
  element.addEventListener('wheel', browserWheel, { capture: true, passive: true })
  element.addEventListener('pointerdown', down)
  element.addEventListener('pointerup', up)
  element.addEventListener('pointercancel', cancel)
  element.addEventListener('focus', focus)
  element.addEventListener('blur', blur)
  element.addEventListener('keydown', key)
  document.addEventListener('pointerdown', outside, true)
  apply()
  return {
    engage,
    release,
    engaged: () => engaged,
    zoom,
    orbit: orbitBy,
    tilt,
    dispose() {
      element.removeEventListener('wheel', browserWheel, true)
      element.removeEventListener('pointerdown', down)
      element.removeEventListener('pointerup', up)
      element.removeEventListener('pointercancel', cancel)
      element.removeEventListener('focus', focus)
      element.removeEventListener('blur', blur)
      element.removeEventListener('keydown', key)
      document.removeEventListener('pointerdown', outside, true)
    },
  }
}
/** The one caption that is true for every observer view. */
export const OBSERVER_CAPTION =
  'Drag to orbit. Zoom with the buttons, or click or tap the model to turn on wheel and one-finger control — Escape, or a click or tap elsewhere, turns it off so the page scrolls normally. A finger that scrolls does not engage it; while engaged, two fingers orbit and pinch. Keyboard: Tab to the model, arrow keys orbit and tilt, + and − zoom, Home resets. Browser zoom is untouched.'
