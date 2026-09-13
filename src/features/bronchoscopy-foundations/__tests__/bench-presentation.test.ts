import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'
import { authoredScopePose } from '../engine/scope/scopeAuthoredPose'
import { DEFAULT_SCOPE_INPUTS } from '../engine/scope/scopeInputs'
import {
  BENDING_SECTION_LENGTH,
  bendingSectionSample,
  interpolateBenchMotion,
} from '../components/scope/benchPresentation'

test.each([-180, -90, 0, 90, 180])(
  'the visible tube aims along the optical engine at rotation %s',
  (rotationDeg) => {
    for (const deflectionDeg of [-120, -60, -1, 0, 1, 60, 120]) {
      const optical = scopeOpticalFrame(
        authoredScopePose('bench', 12, {
          ...DEFAULT_SCOPE_INPUTS,
          rotationDeg,
          deflectionDeg,
        }),
      )
      const end = bendingSectionSample(rotationDeg, deflectionDeg, 1)
      const before = bendingSectionSample(rotationDeg, deflectionDeg, 0.99999)
      const delta = end.position.map((value, axis) => value - before.position[axis])
      const length = Math.hypot(...delta)
      optical.forward.forEach((value, axis) => expect(delta[axis] / length).toBeCloseTo(value, 4))
      expect(end.frame.forward).toEqual(optical.forward)
      expect(end.frame.up).toEqual(optical.up)
    }
  },
)

test.each([-120, -60, 0, 60, 120])(
  'the bending section keeps its length and has no gap at %s degrees',
  (bend) => {
    const samples = Array.from(
      { length: 201 },
      (_, i) => bendingSectionSample(45, bend, i / 200).position,
    )
    expect(samples[0]).toEqual([0, 0, 0])
    const length = samples
      .slice(1)
      .reduce((sum, p, i) => sum + Math.hypot(...p.map((v, j) => v - samples[i][j])), 0)
    expect(length).toBeCloseTo(BENDING_SECTION_LENGTH, 3)
  },
)

test('handle motion takes the short path across the wrapped rotation value', () => {
  const from = { depth: 0, rotation: 179, deflection: 0, suction: 0 }
  const to = { depth: 12, rotation: -179, deflection: 60, suction: 1 }
  expect(interpolateBenchMotion(from, to, 0.5)).toEqual({
    depth: 6,
    rotation: 180,
    deflection: 30,
    suction: 0.5,
  })
  expect(interpolateBenchMotion(from, to, 1).rotation).toBe(181)
  expect(
    interpolateBenchMotion({ ...from, rotation: -179 }, { ...to, rotation: 179 }, 1).rotation,
  ).toBe(-181)
})
