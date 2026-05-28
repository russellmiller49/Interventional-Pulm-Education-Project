import { evaluateAccp, evaluateBothFrameworks, evaluateBts } from '../engine/frameworks'
import { pneumothoraxCases } from '../scenarios/pneumothoraxCases'

const getCase = (id: string) => {
  const clinicalCase = pneumothoraxCases.find((item) => item.id === id)

  if (!clinicalCase) {
    throw new Error(`Missing pneumothorax case ${id}`)
  }

  return clinicalCase
}

describe('pneumothorax pathway engine', () => {
  it('routes unstable physiology to emergency management in both frameworks', () => {
    const result = evaluateBothFrameworks(getCase('unstable-tension'))

    expect(result.accp.disposition).toBe('emergency')
    expect(result.bts.disposition).toBe('emergency')
    expect(result.agreement).toBe(true)
  })

  it('shows the size-versus-symptom divergence for stable large primary pneumothorax', () => {
    const result = evaluateBothFrameworks(getCase('stable-minimal-psp'))

    expect(result.accp.disposition).toBe('aspiration')
    expect(result.bts.disposition).toBe('observation')
    expect(result.agreement).toBe(false)
    expect(result.comparisonNote).toContain('size')
  })

  it('escalates persistent air leak earlier in ACCP than BTS', () => {
    const dayFour = { ...getCase('persistent-air-leak'), persistentAirLeakDays: 4 }

    expect(evaluateAccp(dayFour).disposition).toBe('escalate')
    expect(evaluateBts(dayFour).disposition).toBe('chest-drain')
  })
})
