import { pleuralReferences } from '@/features/pleural-procedures/content/references'
import { canEmbedPleuralAsset } from '@/features/pleural-procedures/content/sourceRegistry'

import { pleuralUltrasoundAssets, publicPleuralUltrasoundAssets } from '../content/assets'
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

  it('maps non-effusion lung views away from pleural drainage teaching', () => {
    expect(patternToManagement.noDrainableEffusion).toBe('noPleuralDrainageTarget')
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

  it('covers effusion patterns plus no-drainable-effusion distractors', () => {
    const representedPatterns = new Set(pleuralUltrasoundAssets.map((asset) => asset.groundTruth))

    expect(representedPatterns).toEqual(
      new Set([
        'simpleAnechoic',
        'complexNonSeptated',
        'septatedLoculated',
        'echogenic',
        'noDrainableEffusion',
      ]),
    )
  })

  it('requires auditable source metadata for every public pattern-lab asset', () => {
    const referenceIds = new Set(pleuralReferences.map((reference) => reference.id))

    for (const asset of pleuralUltrasoundAssets) {
      expect(asset.sourceUrl).toMatch(/^https:\/\//)
      expect(asset.license).toEqual(expect.any(String))
      expect(asset.reusePolicy).toEqual(expect.any(String))
      expect(asset.transformPolicy).toEqual(expect.any(String))
      expect(asset.permissionStatus).toEqual(expect.any(String))
      expect(asset.reviewStatus).toEqual(expect.any(String))
      expect(asset.attributionRequired).toBe(true)
      expect(asset.referenceIds?.length).toBeGreaterThan(0)

      for (const referenceId of asset.referenceIds ?? []) {
        expect(referenceIds.has(referenceId)).toBe(true)
      }
    }
  })

  it('renders only source-policy-approved assets in the public lab list', () => {
    expect(publicPleuralUltrasoundAssets.length).toBe(pleuralUltrasoundAssets.length)

    for (const asset of publicPleuralUltrasoundAssets) {
      expect(canEmbedPleuralAsset(asset)).toBe(true)
    }
  })
})
