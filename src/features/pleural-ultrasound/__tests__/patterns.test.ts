import { pleuralReferences } from '@/features/pleural-procedures/content/references'
import { canEmbedPleuralAsset } from '@/features/pleural-procedures/content/sourceRegistry'

import { pleuralUltrasoundAssets, publicPleuralUltrasoundAssets } from '../content/assets'
import {
  dynamicSignOptions,
  pleuralUltrasoundVideoAssets,
  publicPleuralUltrasoundVideoAssets,
} from '../content/videoAssets'
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

  it('keeps learner-facing video prompts neutral until reveal', () => {
    const hiddenTerms = [
      'a-line',
      'a line',
      'b-line',
      'b line',
      'consolidation',
      'effusion',
      'curtain',
    ]

    for (const asset of pleuralUltrasoundVideoAssets) {
      expect(asset.neutralVignette).toEqual(expect.any(String))
      expect(asset.revealCaption).toEqual(expect.any(String))
      expect(asset.alt.toLowerCase()).not.toContain('a-line')
      expect(asset.alt.toLowerCase()).not.toContain('b-line')
      expect(asset.alt.toLowerCase()).not.toContain('consolidation')
      expect(asset.alt.toLowerCase()).not.toContain('effusion')
      expect(asset.alt.toLowerCase()).not.toContain('curtain')

      for (const hiddenTerm of hiddenTerms) {
        expect(asset.neutralVignette.toLowerCase()).not.toContain(hiddenTerm)
      }
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

  it('covers the dynamic-sign video practice choices', () => {
    const representedSigns = new Set(pleuralUltrasoundVideoAssets.map((asset) => asset.groundTruth))

    expect(representedSigns).toEqual(new Set(dynamicSignOptions.map((option) => option.id)))
  })

  it('requires auditable source metadata for every public dynamic-sign clip', () => {
    const referenceIds = new Set(pleuralReferences.map((reference) => reference.id))

    for (const asset of publicPleuralUltrasoundVideoAssets) {
      expect(asset.kind).toBe('clip')
      expect(asset.localPath).toMatch(/^\/module-assets\/v1\/pleural-ultrasound\/video\/.+\.mp4$/)
      expect(asset.sourceUrl).toMatch(/^https:\/\/github\.com\/jannisborn\/covid19_ultrasound/)
      expect(asset.sourceRepositoryUrl).toBe('https://github.com/jannisborn/covid19_ultrasound')
      expect(asset.sourceMetadataUrl).toMatch(/dataset_metadata\.csv$/)
      expect(asset.sourceFilename).toEqual(expect.any(String))
      expect(asset.licenseUrl).toMatch(/^https:\/\//)
      expect(asset.license).toMatch(/^CC BY/)
      expect(asset.convertedToMp4).toBe(true)
      expect(asset.reusePolicy).toBe('embeddable')
      expect(asset.transformPolicy).toBe('derivatives-allowed')
      expect(asset.permissionStatus).toBe('granted-by-license')
      expect(asset.reviewStatus).toBe('reviewed')
      expect(asset.attributionRequired).toBe(true)

      for (const referenceId of asset.referenceIds ?? []) {
        expect(referenceIds.has(referenceId)).toBe(true)
      }

      expect(canEmbedPleuralAsset(asset)).toBe(true)
    }
  })
})
