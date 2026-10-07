/** @jest-environment node */
import { betaModules } from './catalog'
import { betaRollout } from './rollout'

describe('hub readiness record', () => {
  it('has exactly one entry for every hub module', () => {
    expect(Object.keys(betaRollout).sort()).toEqual(betaModules.map((entry) => entry.id).sort())
  })

  it('gives every module marked ready a complete tester note', () => {
    for (const entry of betaModules) {
      const stage = betaRollout[entry.id]
      if (stage.stage !== 'ready') continue
      expect(stage.note.summary.trim()).not.toBe('')
      expect(stage.note.minutes).toBeGreaterThan(0)
      expect(stage.note.lookFor.length).toBeGreaterThan(0)
      // A module with nothing still under review says so in words rather than leaving this empty.
      expect(stage.note.knownLimits.length).toBeGreaterThan(0)
    }
  })
})
