import { evaluatePneumothoraxPathway } from '../engine/frameworks'
import { pneumothoraxCases } from '../scenarios/pneumothoraxCases'

const getCase = (id: string) => {
  const clinicalCase = pneumothoraxCases.find((item) => item.id === id)

  if (!clinicalCase) {
    throw new Error(`Missing pneumothorax case ${id}`)
  }

  return clinicalCase
}

describe('pneumothorax pathway engine', () => {
  it('routes unstable physiology to emergency management', () => {
    expect(evaluatePneumothoraxPathway(getCase('unstable-tension')).disposition).toBe('emergency')
  })

  it('allows stable minimally symptomatic PSP to be conservative', () => {
    expect(evaluatePneumothoraxPathway(getCase('stable-minimal-psp')).disposition).toBe(
      'conservative',
    )
  })

  it('escalates persistent air leak at day 5', () => {
    expect(evaluatePneumothoraxPathway(getCase('persistent-air-leak')).disposition).toBe('escalate')
  })
})
