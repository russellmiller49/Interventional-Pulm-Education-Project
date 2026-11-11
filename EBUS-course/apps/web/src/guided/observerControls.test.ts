import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { attachObserverControls } from './observerControls'

/*
 * The engaged view owns the wheel across its pane (2026-11-10). These run without a browser: the
 * canvas and its pane are plain event targets with the few fields the controls touch.
 */
class FakeElement extends EventTarget {
  style: Record<string, string> = {}
  dataset: Record<string, string> = {}
  tabIndex = -1
  inside = false
  contains() {
    return this.inside
  }
}
const wheel = (init: { deltaY: number; ctrlKey?: boolean; metaKey?: boolean }) =>
  Object.assign(new Event('wheel', { cancelable: true }), { ctrlKey: false, metaKey: false }, init)

describe('observer controls: the wheel over the view\u2019s own overlay', () => {
  let camera: THREE.PerspectiveCamera
  let canvas: FakeElement
  let surface: FakeElement
  let controls: ReturnType<typeof attachObserverControls>
  const distance = () => camera.position.length()

  beforeEach(() => {
    vi.stubGlobal('document', new EventTarget())
    camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.1, 100)
    camera.position.set(0, 0, 10)
    canvas = new FakeElement()
    surface = new FakeElement()
    const orbit = {
      target: new THREE.Vector3(),
      touches: {},
      enableZoom: false,
      minDistance: 1,
      maxDistance: 50,
      update: () => {},
    } as unknown as OrbitControls
    controls = attachObserverControls(orbit, camera, canvas as unknown as HTMLCanvasElement, {
      render: () => {},
      reset: () => {},
      surface: surface as unknown as HTMLElement,
    })
  })
  afterEach(() => {
    controls.dispose()
    vi.unstubAllGlobals()
  })

  it('leaves the wheel to the page until the view is engaged', () => {
    const event = wheel({ deltaY: 120 })
    surface.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(distance()).toBe(10)
  })

  it('zooms and keeps the page still when engaged and the wheel lands on the overlay', () => {
    controls.engage()
    const out = wheel({ deltaY: 120 })
    surface.dispatchEvent(out)
    expect(out.defaultPrevented).toBe(true)
    expect(distance()).toBeGreaterThan(10)
    const closer = wheel({ deltaY: -120 })
    surface.dispatchEvent(closer)
    expect(closer.defaultPrevented).toBe(true)
    expect(distance()).toBeCloseTo(10, 6)
  })

  it('does not handle a wheel on the canvas itself twice: OrbitControls has it', () => {
    controls.engage()
    canvas.inside = true
    const event = wheel({ deltaY: 120 })
    surface.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(distance()).toBe(10)
  })

  it('never intercepts the browser\u2019s own zoom gesture, and lets go on release', () => {
    controls.engage()
    const pinch = wheel({ deltaY: 120, ctrlKey: true })
    surface.dispatchEvent(pinch)
    expect(pinch.defaultPrevented).toBe(false)
    controls.release()
    const after = wheel({ deltaY: 120 })
    surface.dispatchEvent(after)
    expect(after.defaultPrevented).toBe(false)
    expect(distance()).toBe(10)
  })
})
