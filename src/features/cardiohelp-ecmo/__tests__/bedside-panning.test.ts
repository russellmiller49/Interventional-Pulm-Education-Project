import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import * as THREE from 'three'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import {
  BLENDER_PLACEMENT,
  CAMERA_POSITION,
  CAMERA_TARGET,
  CONSOLE_PLACEMENT,
  PATIENT_POSITION,
} from '../components/ecmo-circuit/constants'
import { buildCircuitLayout } from '../components/ecmo-circuit/layout'
import {
  applyBedsidePanFrameRules,
  clampPanTarget,
  DEFAULT_CAMERA_DISTANCE,
  DEFAULT_TARGET,
  lockBedsidePanOnNewInstance,
  PAN_TARGET_BOUNDS,
  PAN_UNLOCK_DISTANCE,
  panEnabledAtDistance,
  retargetTowardDefault,
} from '../components/ecmo-circuit/panning'

/**
 * Pan rules for the bedside scene: locked at the default framing, unlocked
 * zoomed in, fenced to the scene, and self-restoring on zoom-out.
 */

describe('pan unlock', () => {
  it('keeps the default framing pan-locked but unlocks within the zoom range', () => {
    // The default camera must NOT pan (guided lessons reference that framing)…
    expect(panEnabledAtDistance(DEFAULT_CAMERA_DISTANCE)).toBe(false)
    // …but the threshold must be reachable inside the allowed zoom range
    // (minDistance 4.1), or the feature could never activate.
    expect(PAN_UNLOCK_DISTANCE).toBeGreaterThan(4.1)
    expect(PAN_UNLOCK_DISTANCE).toBeLessThan(DEFAULT_CAMERA_DISTANCE)
    expect(panEnabledAtDistance(4.1)).toBe(true)
  })
})

describe('pan target fence', () => {
  it('contains the default target and every labeled object in both tracks', () => {
    expect(PAN_TARGET_BOUNDS.containsPoint(new THREE.Vector3(...CAMERA_TARGET))).toBe(true)
    expect(
      PAN_TARGET_BOUNDS.containsPoint(
        new THREE.Vector3(CONSOLE_PLACEMENT.x, 0, CONSOLE_PLACEMENT.z),
      ),
    ).toBe(true)
    expect(
      PAN_TARGET_BOUNDS.containsPoint(
        new THREE.Vector3(BLENDER_PLACEMENT.x, 0, BLENDER_PLACEMENT.z),
      ),
    ).toBe(true)
    expect(PAN_TARGET_BOUNDS.containsPoint(new THREE.Vector3(...PATIENT_POSITION))).toBe(true)
    for (const mode of ['vv', 'va'] as const) {
      for (const label of buildCircuitLayout(mode).labels) {
        expect(PAN_TARGET_BOUNDS.containsPoint(label.position)).toBe(true)
      }
    }
  })

  it('returns no translation for a target already inside the box', () => {
    const inside = new THREE.Vector3(0.5, 0, 0.5)
    const before = inside.clone()
    expect(clampPanTarget(inside)).toBeNull()
    expect(inside.equals(before)).toBe(true)
  })

  it.each([
    ['+x', new THREE.Vector3(1, 0, 0)],
    ['-x', new THREE.Vector3(-1, 0, 0)],
    ['+y', new THREE.Vector3(0, 1, 0)],
    ['-y', new THREE.Vector3(0, -1, 0)],
    ['+z', new THREE.Vector3(0, 0, 1)],
    ['-z', new THREE.Vector3(0, 0, -1)],
  ])('returns a target pushed past the %s face and reports the translation', (_face, axis) => {
    const center = PAN_TARGET_BOUNDS.getCenter(new THREE.Vector3())
    const half = PAN_TARGET_BOUNDS.getSize(new THREE.Vector3()).multiplyScalar(0.5)
    const target = center.clone().add(axis.clone().multiply(half).multiplyScalar(1.5))
    const before = target.clone()
    const shift = clampPanTarget(target)
    expect(shift).not.toBeNull()
    expect(PAN_TARGET_BOUNDS.containsPoint(target)).toBe(true)
    // The reported translation is exactly what moved the target.
    expect(before.add(shift!).equals(target)).toBe(true)
  })

  it('keeps the rig a translation at the fence: camera-target distance is preserved', () => {
    // OrbitControls pans camera and target together; the fence must undo the
    // overshoot on BOTH, or every drag against the boundary changes the zoom
    // and orientation. This is the invariant the glide-home already holds.
    const target = new THREE.Vector3(PAN_TARGET_BOUNDS.max.x + 0.6, 0.1, 0.4)
    const camera = target.clone().add(new THREE.Vector3(3.2, 2.4, 3.6))
    const distanceBefore = camera.distanceTo(target)
    const shift = clampPanTarget(target)
    if (shift) camera.add(shift)
    expect(camera.distanceTo(target)).toBeCloseTo(distanceBefore, 6)
    // Preserved distance means clamping alone can never flip pan eligibility.
    expect(panEnabledAtDistance(camera.distanceTo(target))).toBe(
      panEnabledAtDistance(distanceBefore),
    )
  })

  it('repeated drags against the boundary cannot walk the camera away', () => {
    // Each frame: OrbitControls translates the rig outward (a pan), then the
    // fence corrects it. The camera may keep only the in-bounds component of
    // each drag; once the target is pinned on every dragged axis, further
    // drags must move NOTHING — under target-only clamping the camera kept
    // leaking outward by the full drag vector every frame.
    const outward = new THREE.Vector3(0.5, 0, 0.2)
    const target = new THREE.Vector3(PAN_TARGET_BOUNDS.max.x - 0.05, 0, 1.0)
    const camera = target.clone().add(new THREE.Vector3(3.2, 2.4, 3.6))
    const distanceBefore = camera.distanceTo(target)

    const drag = () => {
      target.add(outward)
      camera.add(outward)
      const shift = clampPanTarget(target)
      if (shift) camera.add(shift)
    }
    for (let attempt = 0; attempt < 25; attempt += 1) drag()
    expect(PAN_TARGET_BOUNDS.containsPoint(target)).toBe(true)
    expect(camera.distanceTo(target)).toBeCloseTo(distanceBefore, 6)

    const pinnedCamera = camera.clone()
    const pinnedTarget = target.clone()
    for (let attempt = 0; attempt < 25; attempt += 1) drag()
    expect(camera.equals(pinnedCamera)).toBe(true)
    expect(target.equals(pinnedTarget)).toBe(true)
  })
})

describe('return to the canonical framing', () => {
  it('glides a panned rig home, preserving the camera-target distance', () => {
    const pan = new THREE.Vector3(1.2, 0.2, -0.6)
    const target = new THREE.Vector3(...CAMERA_TARGET).add(pan)
    const camera = new THREE.Vector3(4.15, 2.6, 5.0).add(pan)
    const initialDistance = camera.distanceTo(target)
    let ticks = 0
    for (let step = 0; step < 600 && !target.equals(DEFAULT_TARGET); step += 1) {
      const shift = retargetTowardDefault(target, 1 / 60, false)
      if (!shift) break
      camera.add(shift)
      ticks += 1
    }
    expect(ticks).toBeGreaterThan(1)
    expect(target.equals(DEFAULT_TARGET)).toBe(true)
    // A pan is a rig translation; undoing it must not change the zoom. The
    // first implementation moved only the target, so the distance drifted,
    // re-crossed the unlock threshold, and the glide stalled partway.
    expect(camera.distanceTo(target)).toBeCloseTo(initialDistance, 6)
    // Settled: no further motion once home.
    expect(retargetTowardDefault(target, 1 / 60, false)).toBeNull()
  })

  it('snaps home in one step under reduced motion', () => {
    const pan = new THREE.Vector3(1.2, 0.2, -0.6)
    const target = new THREE.Vector3(...CAMERA_TARGET).add(pan)
    const shift = retargetTowardDefault(target, 1 / 60, true)
    expect(shift).not.toBeNull()
    expect(shift!.equals(pan.clone().negate())).toBe(true)
    expect(target.equals(DEFAULT_TARGET)).toBe(true)
  })
})

/* ------------------------------------------------------------------ *
 * Integration: real controls, real pointer events, one owner
 * ------------------------------------------------------------------ */

/**
 * The independent review asked for a regression above the helper level: the scene used to pass
 * `enablePan={false}` in JSX while the frame loop mutated the instance — two authorities over one
 * field. The pure helpers above cannot see who wins, so this block drives a real three-stdlib
 * OrbitControls connected to a real DOM element, applies the extracted frame rule the scene's
 * `useFrame` runs, and dispatches actual right-button pointer events. The pan either moves the
 * target or it does not; a stale declarative `false` winning shows up here as a dead drag.
 */
describe('the frame rule owns enablePan on a live OrbitControls', () => {
  function createRig() {
    const element = document.createElement('div')
    // OrbitControls divides drag deltas by clientHeight when panning a perspective camera; jsdom
    // has no layout, so the canvas height is stubbed the way the workspace suites stub geometry.
    Object.defineProperty(element, 'clientHeight', { value: 608 })
    Object.defineProperty(element, 'clientWidth', { value: 552 })
    // jsdom's pointer-capture stubs throw for synthetic pointer ids; the browser path releases a
    // real capture. Neither is what this test is about.
    element.setPointerCapture = () => {}
    element.releasePointerCapture = () => {}
    document.body.appendChild(element)

    const camera = new THREE.PerspectiveCamera(50, 552 / 608, 0.1, 100)
    camera.position.set(...CAMERA_POSITION)
    const controls = new OrbitControlsImpl(camera, element)
    controls.target.copy(DEFAULT_TARGET)
    // The scene's ref callback locks the instance before the first frame.
    controls.enablePan = false
    controls.update()
    return { element, camera, controls }
  }

  function pointer(type: string, options: PointerEventInit & { button?: number }): Event {
    // jsdom has no PointerEvent constructor; OrbitControls only reads MouseEvent fields plus
    // pointerType/pointerId, so a MouseEvent with those defined drives it exactly.
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...options })
    Object.defineProperty(event, 'pointerType', { value: 'mouse' })
    Object.defineProperty(event, 'pointerId', { value: 7 })
    return event
  }

  function rightDrag(element: HTMLElement, dx: number, dy: number) {
    element.dispatchEvent(
      pointer('pointerdown', { button: 2, buttons: 2, clientX: 276, clientY: 304 }),
    )
    for (let step = 1; step <= 4; step += 1) {
      element.ownerDocument.dispatchEvent(
        pointer('pointermove', {
          buttons: 2,
          clientX: 276 + (dx * step) / 4,
          clientY: 304 + (dy * step) / 4,
        }),
      )
    }
    element.ownerDocument.dispatchEvent(
      pointer('pointerup', { button: 2, buttons: 0, clientX: 276 + dx, clientY: 304 + dy }),
    )
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps a right-drag dead at the default framing', () => {
    const { element, controls } = createRig()
    applyBedsidePanFrameRules(controls, 1 / 60, false, false)
    expect(controls.enablePan).toBe(false)

    const before = controls.target.clone()
    rightDrag(element, 80, 40)
    applyBedsidePanFrameRules(controls, 1 / 60, false, false)

    expect(controls.target.equals(before)).toBe(true)
    controls.dispose()
  })

  it('pans the rig on a right-drag once zoomed past the unlock distance', () => {
    const { element, camera, controls } = createRig()
    // Zoom in the way the wheel does: move the camera toward the target inside the allowed range.
    const toTarget = controls.target.clone().sub(camera.position).normalize()
    camera.position.copy(controls.target.clone().sub(toTarget.multiplyScalar(4.5)))
    controls.update()

    // One frame of the rule flips the single authority; nothing else is touched.
    applyBedsidePanFrameRules(controls, 1 / 60, false, false)
    expect(controls.enablePan).toBe(true)

    const targetBefore = controls.target.clone()
    const cameraBefore = camera.position.clone()
    rightDrag(element, 80, 40)

    // The drag panned the rig: target and camera moved together, distance preserved.
    expect(controls.target.equals(targetBefore)).toBe(false)
    expect(controls.target.distanceTo(targetBefore)).toBeGreaterThan(0.05)
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(
      cameraBefore.distanceTo(targetBefore),
      3,
    )
    controls.dispose()
  })

  it('overrides a stale declarative write on the next frame, in both directions', () => {
    const { camera, controls } = createRig()

    // Something re-asserts the old constant (the way a re-applied JSX prop would): the next frame
    // wins while zoomed in…
    const toTarget = controls.target.clone().sub(camera.position).normalize()
    camera.position.copy(controls.target.clone().sub(toTarget.multiplyScalar(4.5)))
    controls.update()
    controls.enablePan = false
    applyBedsidePanFrameRules(controls, 1 / 60, false, false)
    expect(controls.enablePan).toBe(true)

    // …and re-locks at the default framing even if something forced it open.
    camera.position.set(...CAMERA_POSITION)
    controls.target.copy(DEFAULT_TARGET)
    controls.update()
    controls.enablePan = true
    applyBedsidePanFrameRules(controls, 1 / 60, false, false)
    expect(controls.enablePan).toBe(false)
    controls.dispose()
  })

  it('keeps the pan unlocked when the ref re-attaches the same instance mid-session', () => {
    /*
     * The first version of the ownership fix locked unconditionally in the ref callback — which
     * re-runs on every commit whose identity changed, and this scene re-renders every simulation
     * tick, so pan was re-locked between frames. Caught by re-running the production pan probe
     * against the rebuilt page: zoomed in, right-drag entered no state. The lock is now keyed to
     * the instance, and this is the regression for it.
     */
    const { camera, controls } = createRig()
    const lastLocked: { current: typeof controls | null } = { current: null }

    lockBedsidePanOnNewInstance(lastLocked, controls)
    expect(controls.enablePan).toBe(false)

    const toTarget = controls.target.clone().sub(camera.position).normalize()
    camera.position.copy(controls.target.clone().sub(toTarget.multiplyScalar(4.5)))
    controls.update()
    applyBedsidePanFrameRules(controls, 1 / 60, false, false)
    expect(controls.enablePan).toBe(true)

    // A clock-tick re-render re-attaches the same instance: nothing may change.
    lockBedsidePanOnNewInstance(lastLocked, controls)
    expect(controls.enablePan).toBe(true)

    // A genuinely new instance starts locked before its first frame.
    const fresh = new OrbitControlsImpl(camera, document.createElement('div'))
    lockBedsidePanOnNewInstance(lastLocked, fresh)
    expect(fresh.enablePan).toBe(false)
    fresh.dispose()
    controls.dispose()
  })

  it('leaves no second authority in the scene: no enablePan prop, no inline write', () => {
    // The ownership pin. The behaviour above proves the rule works on a live instance; this
    // proves the component has exactly one writer — the instance-keyed lock plus the frame rule,
    // both in panning.ts — so the conflict the review flagged cannot quietly return as a constant
    // prop or as a per-render write in the ref.
    const source = readFileSync(
      join(process.cwd(), 'src/features/cardiohelp-ecmo/components/ecmo-circuit/BedsideScene.tsx'),
      'utf8',
    )
    // Comments are stripped first: the file *explains* the retired patterns by name, and a pin
    // that fired on the explanation would be deleted rather than obeyed.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/enablePan=\{/)
    expect(code).not.toMatch(/\.enablePan\s*=/)
    expect(code).toContain('lockBedsidePanOnNewInstance(lockedControls, instance)')
    expect(code).toContain('applyBedsidePanFrameRules(instance, delta, reduceMotion,')
  })
})
