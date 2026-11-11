import larynx from '../../../../public/bronchoscopy-foundations/anatomy/larynx/larynx.json'
import {
  LARYNX_ORBIT_PRESETS,
  LARYNX_ORBIT_START,
  LARYNX_OUTSIDE_UP,
  larynxOrbitDescription,
  larynxOrbitDirection,
  turnLarynxOrbit,
} from '../components/scope/larynxOutsideView'

const dot = (a: readonly number[], b: readonly number[]) =>
  a.reduce((sum, v, k) => sum + v * b[k], 0)

describe('turning the outside view of the larynx', () => {
  test('looks from the front, the patient’s left, behind and above when asked', () => {
    const { anterior, left } = larynx.frameLps
    const direction = (id: string) =>
      larynxOrbitDirection(LARYNX_ORBIT_PRESETS.find((preset) => preset.id === id)!.orbit)
    expect(dot(direction('front'), anterior)).toBeGreaterThan(0.95)
    expect(dot(direction('side'), left)).toBeGreaterThan(0.95)
    expect(dot(direction('back'), anterior)).toBeLessThan(-0.95)
    expect(dot(direction('above'), LARYNX_OUTSIDE_UP)).toBeGreaterThan(0.9)
    for (const preset of LARYNX_ORBIT_PRESETS)
      expect(Math.hypot(...larynxOrbitDirection(preset.orbit))).toBeCloseTo(1, 6)
  })

  test('opens from the front and the patient’s left, a little above', () => {
    const direction = larynxOrbitDirection(LARYNX_ORBIT_START)
    expect(dot(direction, larynx.frameLps.anterior)).toBeGreaterThan(0.5)
    expect(dot(direction, larynx.frameLps.left)).toBeGreaterThan(0.3)
    expect(dot(direction, LARYNX_OUTSIDE_UP)).toBeGreaterThan(0)
    expect(larynxOrbitDescription(LARYNX_ORBIT_START)).toBe('from the front and the patient’s left')
  })

  test('the model follows the hand, stays upright and comes all the way round', () => {
    // From the front the patient's left is on the right of the picture. Dragging right brings the
    // near side to the right, so the camera goes toward the patient's right.
    const turned = turnLarynxOrbit({ yawDeg: 0, pitchDeg: 0 }, 60, 0)
    expect(turned.yawDeg).toBeLessThan(0)
    expect(dot(larynxOrbitDirection(turned), larynx.frameLps.left)).toBeLessThan(0)
    // Dragging down tips the top toward the viewer: the camera rises.
    expect(turnLarynxOrbit({ yawDeg: 0, pitchDeg: 0 }, 0, 40).pitchDeg).toBeGreaterThan(0)
    // It never goes over the top or far underneath.
    expect(turnLarynxOrbit({ yawDeg: 0, pitchDeg: 0 }, 0, 5000).pitchDeg).toBeLessThan(90)
    expect(turnLarynxOrbit({ yawDeg: 0, pitchDeg: 0 }, 0, -5000).pitchDeg).toBeGreaterThan(-45)
    // A full turn comes back to where it started.
    let orbit = { yawDeg: 0, pitchDeg: 0 }
    for (let i = 0; i < 72; i++) orbit = turnLarynxOrbit(orbit, 10, 0)
    expect(Math.abs(orbit.yawDeg)).toBeCloseTo(0, 6)
  })

  test('says in words where the picture is seen from', () => {
    expect(larynxOrbitDescription({ yawDeg: 0, pitchDeg: 6 })).toBe('from the front')
    expect(larynxOrbitDescription({ yawDeg: 90, pitchDeg: 6 })).toBe('from the patient’s left')
    expect(larynxOrbitDescription({ yawDeg: -90, pitchDeg: 6 })).toBe('from the patient’s right')
    expect(larynxOrbitDescription({ yawDeg: 180, pitchDeg: 10 })).toBe('from behind')
    expect(larynxOrbitDescription({ yawDeg: -135, pitchDeg: 0 })).toBe(
      'from behind and the patient’s right',
    )
    expect(larynxOrbitDescription({ yawDeg: 180, pitchDeg: 72 })).toBe('from above')
  })
})
