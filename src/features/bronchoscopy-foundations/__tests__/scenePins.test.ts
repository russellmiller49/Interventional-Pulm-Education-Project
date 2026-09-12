/** @jest-environment node */
import { PerspectiveCamera, Vector3 } from 'three'
import { verticalFov } from '@/lib/bronchoscopy-core/frame'
import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'
import { layoutOpticalLabels, projectScenePins } from '../components/scope/scopeSceneModel'
import { treePinLayout } from '../components/scope/treePinLayout'
import { OPTICAL_ASPECT, OPTICAL_FOV_DEG } from '../engine/scope/scopeOstia'
import { ScopeDriver, teachingCase } from '../test-support/teachingCase'
import type { ScopeViewSpec } from '../components/scope/types'
import { createScopeState } from '../engine/scope/scopeReducer'
import larynx from '../../../../public/bronchoscopy-foundations/anatomy/larynx/larynx.json'

const view: ScopeViewSpec = {
  sectionId: 'scene-pins',
  mode: 'guided-walk',
  profile: 'adult-teaching-combined-left-basal-v1',
  start: { kind: 'airway', label: 'TR', at: 'distal' },
  controls: ['advance', 'rotate', 'deflect'],
  assists: {},
  boundary: 'Authored model.',
}

test('in-view pins agree with the Three camera projection for every sampled roll and bend', () => {
  let compared = 0
  for (const roll of [-180, -90, -35, 0, 35, 90, 180])
    for (const bend of [-15, 0, 15]) {
      const driver = new ScopeDriver(view)
      driver.send({ type: 'set-rotation', deg: roll })
      driver.send({ type: 'set-deflection', deg: bend })
      const frame = scopeOpticalFrame(driver.state.pose!)
      const camera = new PerspectiveCamera(
        verticalFov(OPTICAL_FOV_DEG, OPTICAL_ASPECT),
        OPTICAL_ASPECT,
        0.05,
        1400,
      )
      camera.position.set(...frame.position)
      camera.up.set(...frame.up)
      camera.lookAt(new Vector3(...frame.position).add(new Vector3(...frame.forward)))
      camera.updateMatrixWorld()
      for (const pin of projectScenePins(driver.state)) {
        const projected = new Vector3(...pin.pointLps).project(camera)
        expect(pin.leftPct).toBeCloseTo((0.5 + projected.x / 2) * 100, 8)
        expect(pin.topPct).toBeCloseTo((0.5 - projected.y / 2) * 100, 8)
        compared++
      }
      expect(driver.state.location.label).toBe('TR')
    }
  expect(compared).toBeGreaterThan(20)
})

test('obscured fields do not offer visible ostium pins', () => {
  const driver = new ScopeDriver(view)
  expect(projectScenePins(driver.state).length).toBeGreaterThan(0)
  for (const signal of ['red-out', 'contaminated', 'dark'] as const)
    expect(
      projectScenePins({ ...driver.state, signals: { ...driver.state.signals, view: signal } }),
    ).toEqual([])
})

test('narrow optical captions separate while preserving their anatomical attachment points', () => {
  const projected = projectScenePins(new ScopeDriver(view).state)
  expect(projected.length).toBeGreaterThanOrEqual(2)
  for (const width of [230, 300, 490]) {
    const placed = layoutOpticalLabels(projected, width, width / OPTICAL_ASPECT, true)
    for (const [i, a] of placed.entries()) {
      expect(a.leftPct).toBe(projected[i].leftPct)
      expect(a.topPct).toBe(projected[i].topPct)
      for (const b of placed.slice(i + 1))
        expect(
          (Math.abs(a.labelLeftPct - b.labelLeftPct) * width) / 100 >= 48 ||
            (Math.abs(a.labelTopPct - b.labelTopPct) * width) / OPTICAL_ASPECT / 100 >= 29.9,
        ).toBe(true)
    }
  }
})

test('authored larynx pose follows the asset path and uses a right-handed camera basis', () => {
  const driver = new ScopeDriver({
    ...view,
    mode: 'larynx-entry',
    start: { kind: 'larynx' },
    defaults: { cords: 'abducted' },
  })
  expect(driver.state.pose?.tipLps).toEqual(larynx.pathLps[0])
  driver.send({ type: 'advance', mm: 20 })
  expect(driver.state.pose?.tipLps).toEqual(larynx.pathLps[40])
  const frame = scopeOpticalFrame(driver.state.pose!)
  const right = new Vector3(...frame.forward).cross(new Vector3(...frame.up))
  expect(right.distanceTo(new Vector3(...frame.right))).toBeLessThan(1e-6)
})

test('bench rotation changes its optical frame without manufacturing airway entry', () => {
  const driver = new ScopeDriver(
    { ...view, mode: 'controls-isolated', start: { kind: 'bench' } },
    null,
  )
  const initial = createScopeState(driver.view, null)
  driver.send({ type: 'rotate', deg: 90 })
  expect(driver.state.pose?.tipLps).toEqual(initial.pose?.tipLps)
  expect(driver.state.pose?.opticalFrame?.up).not.toEqual(initial.pose?.opticalFrame?.up)
  expect(driver.state.location.label).toBeNull()
  expect(driver.state.events.some((event) => event.startsWith('entered:'))).toBe(false)
})

test('all map labels have distinct legible slots within the drawing', () => {
  const { pins } = treePinLayout(teachingCase().map)
  expect(pins).toHaveLength(29)
  for (const [i, a] of pins.entries()) {
    expect(a.x).toBeGreaterThanOrEqual(30)
    expect(a.x).toBeLessThanOrEqual(330)
    expect(a.y).toBeGreaterThanOrEqual(18)
    expect(a.y).toBeLessThanOrEqual(402)
    for (const b of pins.slice(i + 1))
      expect(Math.abs(a.x - b.x) >= 57 || Math.abs(a.y - b.y) >= 23).toBe(true)
  }
})
