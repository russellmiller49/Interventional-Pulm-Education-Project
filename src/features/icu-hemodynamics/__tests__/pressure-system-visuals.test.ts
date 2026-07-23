import {
  classifyDynamicResponse,
  dynamicResponseChallenges,
  FAST_FLUSH_RELEASE_SECONDS,
  FAST_FLUSH_START_SECONDS,
  fastFlushBaselinePressureMmHg,
  fastFlushLineDefinitions,
  fastFlushTracePath,
  formatSignedPressure,
  generateFastFlushWaveform,
  hydrostaticPressureOffsetMmHg,
  type DynamicResponseKind,
  type FastFlushLineType,
} from '../content/pressureSystemVisuals'

const responses: readonly DynamicResponseKind[] = ['acceptable', 'overdamped', 'underdamped']
const lineTypes: readonly FastFlushLineType[] = ['pulmonary-artery', 'systemic-arterial']

function range(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values)
}

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

  it('keeps neutral challenge labels mapped one-to-one with the three responses', () => {
    expect(dynamicResponseChallenges.map((challenge) => challenge.label)).toEqual([
      'Response A',
      'Response B',
      'Response C',
    ])
    expect(new Set(dynamicResponseChallenges.map((challenge) => challenge.response)).size).toBe(3)
  })

  it('generates all six line/response combinations with pulsatile beats before and after flush', () => {
    for (const lineType of lineTypes) {
      for (const response of responses) {
        const waveform = generateFastFlushWaveform(lineType, response)
        const before = waveform.samples
          .filter((sample) => sample.timeSeconds < FAST_FLUSH_START_SECONDS - 0.05)
          .map((sample) => sample.pressureMmHg)
        const after = waveform.samples
          .filter((sample) => sample.timeSeconds > FAST_FLUSH_RELEASE_SECONDS + 1.5)
          .map((sample) => sample.pressureMmHg)
        const minimumExpectedPulse = lineType === 'pulmonary-artery' ? 4 : 12

        expect(range(before)).toBeGreaterThan(minimumExpectedPulse)
        expect(range(after)).toBeGreaterThan(minimumExpectedPulse)
        expect(Math.max(...waveform.samples.map((sample) => sample.pressureMmHg))).toBe(300)
        expect(
          waveform.samples.filter((sample) => sample.segment === 'flush-plateau').length,
        ).toBeGreaterThan(80)
        expect(fastFlushTracePath(response, lineType)).not.toMatch(/NaN|Infinity/)
      }
    }
  })

  it('uses different physiologic source families and fixed pressure scales for PA and arterial lines', () => {
    const pa = fastFlushLineDefinitions['pulmonary-artery']
    const arterial = fastFlushLineDefinitions['systemic-arterial']
    expect([pa.systolicMmHg, pa.diastolicMmHg]).toEqual([25, 10])
    expect([arterial.systolicMmHg, arterial.diastolicMmHg]).toEqual([120, 80])
    expect([pa.scaleMinimumMmHg, pa.scaleMaximumMmHg]).toEqual([0, 40])
    expect([arterial.scaleMinimumMmHg, arterial.scaleMaximumMmHg]).toEqual([40, 160])

    const paBaseline = generateFastFlushWaveform('pulmonary-artery', 'acceptable')
      .samples.filter((sample) => sample.timeSeconds < FAST_FLUSH_START_SECONDS)
      .map((sample) => sample.pressureMmHg)
    const arterialBaseline = generateFastFlushWaveform('systemic-arterial', 'acceptable')
      .samples.filter((sample) => sample.timeSeconds < FAST_FLUSH_START_SECONDS)
      .map((sample) => sample.pressureMmHg)
    expect(Math.max(...arterialBaseline)).toBeGreaterThan(Math.max(...paBaseline) * 4)
  })

  it('makes underdamped release ringing decrease substantially with elapsed time', () => {
    for (const lineType of lineTypes) {
      const waveform = generateFastFlushWaveform(lineType, 'underdamped')
      const residuals = waveform.samples
        .filter((sample) => sample.timeSeconds >= FAST_FLUSH_RELEASE_SECONDS)
        .map((sample) => ({
          elapsed: sample.timeSeconds - FAST_FLUSH_RELEASE_SECONDS,
          residual:
            sample.pressureMmHg -
            fastFlushBaselinePressureMmHg(lineType, 'underdamped', sample.cardiacPhase),
        }))
      const early = residuals
        .filter((sample) => sample.elapsed >= 0.02 && sample.elapsed <= 0.28)
        .map((sample) => Math.abs(sample.residual))
      const late = residuals
        .filter((sample) => sample.elapsed >= 1.0 && sample.elapsed <= 1.3)
        .map((sample) => Math.abs(sample.residual))
      expect(Math.max(...early)).toBeGreaterThan(Math.max(...late) * 3)
      expect(Math.max(...late)).toBeLessThan(lineType === 'pulmonary-artery' ? 3.5 : 7)
    }
  })

  it('gives overdamped release a monotonic rounded tail without prolonged oscillation', () => {
    for (const lineType of lineTypes) {
      const waveform = generateFastFlushWaveform(lineType, 'overdamped')
      const residuals = waveform.samples
        .filter(
          (sample) =>
            sample.timeSeconds >= FAST_FLUSH_RELEASE_SECONDS &&
            sample.timeSeconds <= FAST_FLUSH_RELEASE_SECONDS + 1.2,
        )
        .map(
          (sample) =>
            sample.pressureMmHg -
            fastFlushBaselinePressureMmHg(lineType, 'overdamped', sample.cardiacPhase),
        )
      expect(residuals.every((residual) => residual >= 0)).toBe(true)
      expect(residuals.at(-1)!).toBeLessThan(residuals[0] * 0.03)
      const increases = residuals
        .slice(1)
        .filter((residual, index) => residual > residuals[index] + 1e-6)
      expect(increases).toHaveLength(0)
    }
  })
})
