import { pleuralUltrasoundAssets } from '../content/assets'
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

  it('keeps learner-facing image prompts neutral until reveal', () => {
    for (const asset of pleuralUltrasoundAssets) {
      expect(asset.neutralVignette).toEqual(expect.any(String))
      expect(asset.revealCaption).toEqual(expect.any(String))
      expect(asset).not.toHaveProperty('clinicalLabel')
      expect(asset.alt.toLowerCase()).not.toContain('septated')
      expect(asset.alt.toLowerCase()).not.toContain('echogenic')
      expect(asset.alt.toLowerCase()).not.toContain('anechoic')
      expect(asset.alt.toLowerCase()).not.toContain('complex')
    }
  })
})
