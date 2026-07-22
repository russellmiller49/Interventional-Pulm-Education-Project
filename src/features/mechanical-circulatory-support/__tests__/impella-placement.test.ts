import { IMPELLA_RP_ADVANCEMENT_PROGRESS } from '@/features/cardiac-anatomy/content/paths'

import { impellaRpEndpointProgress } from '../components/three/impellaPlacement'

describe('Impella RP endpoint placement', () => {
  it('separates an RA-biased inlet fault from distal PA outlet advancement', () => {
    const correct = impellaRpEndpointProgress('correct')
    const inletTooHigh = impellaRpEndpointProgress('inlet-too-high')
    const tooDistal = impellaRpEndpointProgress('too-distal')

    expect(correct.head).toBe(IMPELLA_RP_ADVANCEMENT_PROGRESS.correct)
    expect(correct.inlet).toBeCloseTo(IMPELLA_RP_ADVANCEMENT_PROGRESS.ivcInlet, 5)

    expect(inletTooHigh.head).toBe(IMPELLA_RP_ADVANCEMENT_PROGRESS.correct)
    expect(inletTooHigh.inlet).toBeGreaterThan(IMPELLA_RP_ADVANCEMENT_PROGRESS.ivcInlet)
    expect(inletTooHigh.inlet).toBeLessThan(IMPELLA_RP_ADVANCEMENT_PROGRESS.tricuspidGate)

    expect(tooDistal.head).toBe(IMPELLA_RP_ADVANCEMENT_PROGRESS.tooDistal)
    expect(tooDistal.head).toBeGreaterThan(inletTooHigh.head)
    expect(tooDistal).not.toEqual(inletTooHigh)
  })
})
