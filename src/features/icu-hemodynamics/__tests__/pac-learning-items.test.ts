import { hemodynamicsSourceById, pacGuidedLearningItems, pacGuidedSkillIds } from '../content'

/**
 * Items the September 2026 learner-review round edited, and so no longer carry the subject-matter
 * review they had: a distractor regraded from partly-correct to what it is, an absolute removed,
 * a false claim rewritten as a wrong reading of a true situation. Each is listed in the module's
 * learner-review record for the owner's eye; until that review, they are `draft`.
 */
const editedInLearnerReview = new Set([
  'pac-pressure-predict-1',
  'pac-pressure-transfer-1',
  'pac-pawp-predict-1',
  'pac-pawp-transfer-1',
  'pac-td-predict-1',
  'pac-td-transfer-1',
  'pac-derived-predict-1',
  'pac-derived-transfer-1',
])

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
      for (const item of [items.prediction, items.transfer]) {
        expect(`${item.id}: ${item.reviewStatus}`).toBe(
          `${item.id}: ${editedInLearnerReview.has(item.id) ? 'draft' : 'sme-review'}`,
        )
      }

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

  it('grades no false claim and no absolute as partly correct', () => {
    for (const skillId of pacGuidedSkillIds) {
      const items = pacGuidedLearningItems[skillId]
      for (const item of [items.prediction, items.transfer]) {
        for (const choice of item.choices) {
          if (choice.plausibility !== 'reasonable-but-incomplete') continue
          expect(`${item.id}/${choice.id}: ${choice.label}`).not.toMatch(
            /\b(always|never|only|cannot|automatically|whenever|any curve shape|every tracing problem)\b/i,
          )
        }
      }
    }
  })

  it('does not use self-attestation as a transfer choice', () => {
    const labels = pacGuidedSkillIds.flatMap((skillId) =>
      pacGuidedLearningItems[skillId].transfer.choices.map((choice) => choice.label.toLowerCase()),
    )
    expect(labels.join(' ')).not.toMatch(/i understand|i confirm|carry forward|mark complete/)
  })
})
