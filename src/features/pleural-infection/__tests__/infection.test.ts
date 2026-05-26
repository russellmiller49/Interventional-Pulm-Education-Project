import { evaluateLyticChoice, bleedingRisk } from '../engine/lytics'
import { classifyParapneumonic } from '../engine/staging'

describe('pleural infection engines', () => {
  it('classifies frank pus as empyema', () => {
    expect(
      classifyParapneumonic({
        ph: 7.3,
        glucose: 90,
        ldh: 200,
        gramStain: false,
        frankPus: true,
        usPattern: 'freeFlowing',
      }).stage,
    ).toBe('empyema')
  })

  it('classifies low pH as complicated parapneumonic effusion', () => {
    expect(
      classifyParapneumonic({
        ph: 7.18,
        glucose: 90,
        ldh: 200,
        gramStain: false,
        frankPus: false,
        usPattern: 'freeFlowing',
      }).stage,
    ).toBe('complicated')
  })

  it('teaches combination lytics and anticoagulation bleeding overlay', () => {
    expect(evaluateLyticChoice('alteplase10Dnase5').effect).toContain('Combination')
    expect(bleedingRisk(true).percent).toBeGreaterThan(bleedingRisk(false).percent)
  })
})
