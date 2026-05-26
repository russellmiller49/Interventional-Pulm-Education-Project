import { patternToManagement, scoreClassification } from '../engine/patterns'

describe('pleural ultrasound pattern engine', () => {
  it('maps simple and complex nonseptated patterns to thoracentesis-reasonable teaching', () => {
    expect(patternToManagement.simpleAnechoic).toBe('thoraReasonable')
    expect(patternToManagement.complexNonSeptated).toBe('thoraReasonable')
  })

  it('maps septated and echogenic patterns to drainage-adjunct teaching', () => {
    expect(patternToManagement.septatedLoculated).toBe('considerTubeAndAdjuncts')
    expect(patternToManagement.echogenic).toBe('considerTubeAndAdjuncts')
  })

  it('scores classifications with the ground-truth teaching point', () => {
    expect(scoreClassification('simpleAnechoic', 'septatedLoculated')).toEqual({
      correct: false,
      teachingPoint: expect.stringContaining('Septations'),
    })
  })
})
