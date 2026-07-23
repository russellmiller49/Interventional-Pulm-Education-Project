import {
  classifyDynamicResponse,
  dynamicResponseChallenges,
  fastFlushTracePath,
  formatSignedPressure,
  hydrostaticPressureOffsetMmHg,
} from '../content/pressureSystemVisuals'

describe('pressure-system teaching visual model', () => {
  it('matches the engine hydrostatic convention and keeps the sign explicit', () => {
    expect(hydrostaticPressureOffsetMmHg(10)).toBeCloseTo(-7.4, 5)
    expect(hydrostaticPressureOffsetMmHg(-10)).toBeCloseTo(7.4, 5)
    expect(hydrostaticPressureOffsetMmHg(0)).toBe(0)
    expect(formatSignedPressure(-7.4)).toBe('-7.4 mmHg')
    expect(formatSignedPressure(7.4)).toBe('+7.4 mmHg')
    expect(formatSignedPressure(0)).toBe('0.0 mmHg')
  })

  it('uses the same qualitative damping thresholds as the preserved reducer', () => {
    expect(classifyDynamicResponse({ artifact: 'none', dampingRatio: 0.65 })).toBe('acceptable')
    expect(classifyDynamicResponse({ artifact: 'overdamped', dampingRatio: 0.65 })).toBe(
      'overdamped',
    )
    expect(classifyDynamicResponse({ artifact: 'none', dampingRatio: 1.1 })).toBe('overdamped')
    expect(classifyDynamicResponse({ artifact: 'underdamped', dampingRatio: 0.65 })).toBe(
      'underdamped',
    )
    expect(classifyDynamicResponse({ artifact: 'none', dampingRatio: 0.3 })).toBe('underdamped')
  })

  it('provides distinct finite schematic traces behind neutral challenge labels', () => {
    expect(dynamicResponseChallenges.map((challenge) => challenge.label)).toEqual([
      'Response A',
      'Response B',
      'Response C',
    ])
    expect(new Set(dynamicResponseChallenges.map((challenge) => challenge.response)).size).toBe(3)

    const paths = ['acceptable', 'overdamped', 'underdamped'].map((response) =>
      fastFlushTracePath(response as 'acceptable' | 'overdamped' | 'underdamped'),
    )
    expect(new Set(paths).size).toBe(3)
    for (const path of paths) {
      expect(path).toMatch(/^M 0 68 L 38 68 L 38 18 L 126 18/)
      expect(path).not.toMatch(/NaN|Infinity/)
    }
  })
})
