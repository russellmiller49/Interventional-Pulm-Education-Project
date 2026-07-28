import { hemodynamicsSourceById, pacGuidedLearningItems, pacGuidedSkillIds } from '../content'

describe('PAC guided clinical-learning items', () => {
  it('provides a distinct, sourced prediction and authored transfer variant for every skill', () => {
    const predictionStems = new Set<string>()
    const transferVariantIds = new Set<string>()

    for (const skillId of pacGuidedSkillIds) {
      const items = pacGuidedLearningItems[skillId]
      expect(items.prediction.activityId).toBe(`hemodynamics:learn:${skillId}`)
      expect(items.prediction.phase).toBe('predict')
      expect(items.transfer.phase).toBe('transfer')
      expect(items.transfer.itemType).toBe('transfer-case')
      expect(items.transfer.transferVariantId).toBeTruthy()
      expect(items.transfer.clinicalContextId).not.toBe(items.prediction.clinicalContextId)
      expect(items.prediction.reviewStatus).toBe('sme-review')
      expect(items.transfer.reviewStatus).toBe('sme-review')

      predictionStems.add(items.prediction.stem)
      transferVariantIds.add(items.transfer.transferVariantId!)

      for (const item of [items.prediction, items.transfer]) {
        expect(item.choices).toHaveLength(3)
        expect(item.choices.every((choice) => choice.rationale.length > 20)).toBe(true)
        expect(item.evidenceIds.every((sourceId) => hemodynamicsSourceById.has(sourceId))).toBe(
          true,
        )
        expect(`${item.stem} ${item.choices.map((choice) => choice.label).join(' ')}`).not.toMatch(
          /reducer|localStorage|state reuse|deterministic attempt|checkpoint payload/i,
        )
      }
    }

    expect(predictionStems.size).toBe(pacGuidedSkillIds.length)
    expect(transferVariantIds.size).toBe(pacGuidedSkillIds.length)
  })

  it('does not use self-attestation as a transfer choice', () => {
    const labels = pacGuidedSkillIds.flatMap((skillId) =>
      pacGuidedLearningItems[skillId].transfer.choices.map((choice) => choice.label.toLowerCase()),
    )
    expect(labels.join(' ')).not.toMatch(/i understand|i confirm|carry forward|mark complete/)
  })
})
