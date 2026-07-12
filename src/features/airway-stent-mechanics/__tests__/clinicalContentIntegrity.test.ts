import { isDraftModulePath } from '@/lib/draft-modules'

import { architectureRegistry } from '../content/architectureRegistry'
import {
  clinicalCaseRegistry,
  getCasesForLesson,
  getRequiredCaseIdsForLesson,
} from '../content/clinicalCaseRegistry'
import { clinicalAssessmentItems, clinicalModuleCopy } from '../content/clinicalModuleCopy'
import { complicationRegistry } from '../content/complicationRegistry'
import { findMissingEvidenceRefs } from '../content/evidenceRegistry'
import { physicsLensRegistry } from '../content/physicsLensRegistry'
import { mechanismScenarioRegistry } from '../content/mechanismScenarioRegistry'
import {
  STENT_LESSON_IDS,
  type ClinicalDecisionOption,
  type PhysicsLensPreset,
} from '../engine/learningLabTypes'

const EXPECTED_PHYSICS_LENS_PRESETS = [
  'residual-extrinsic-load',
  'curve-end-loading',
  'eccentric-ovalization',
  'bifurcation-mismatch',
  'cough-micromotion',
  'coverage-interface',
] as const satisfies readonly PhysicsLensPreset[]

function getCorrectClinicalChoices(): ClinicalDecisionOption[] {
  return clinicalCaseRegistry.flatMap((clinicalCase) =>
    clinicalCase.decisions.map((decision) => {
      const correctChoice = decision.options.find(
        (option) => option.id === decision.correctChoiceId,
      )

      if (!correctChoice) {
        throw new Error(`Missing correct choice for ${clinicalCase.id}/${decision.id}`)
      }

      return correctChoice
    }),
  )
}

function getCorrectAssessmentChoices(): Array<{ label: string; rationale: string }> {
  return clinicalAssessmentItems.map((item) => {
    const correctChoice = item.choices.find((choice) => choice.id === item.correctChoiceId)

    if (!correctChoice) {
      throw new Error(`Missing correct choice for ${item.id}`)
    }

    return correctChoice
  })
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

describe('airway stent clinical-content integrity', () => {
  it('drives route release state from the clinical review status', () => {
    expect(isDraftModulePath('/airway-stent-mechanics')).toBe(
      clinicalModuleCopy.clinicalReviewStatus !== 'reviewed',
    )
  })

  it('gives every required lesson at least one clinical case', () => {
    expect(STENT_LESSON_IDS).toHaveLength(6)
    expect(clinicalModuleCopy.lessons.map((lesson) => lesson.id)).toEqual(STENT_LESSON_IDS)

    for (const lessonId of STENT_LESSON_IDS) {
      expect(getCasesForLesson(lessonId).length).toBeGreaterThan(0)
    }
  })

  it('requires paired indication and fit cases while keeping dynamic collapse optional', () => {
    expect(getRequiredCaseIdsForLesson('indication')).toEqual([
      'post-debulking-no-stent',
      'mixed-residual-extrinsic-compression',
    ])
    expect(getRequiredCaseIdsForLesson('clinical-job')).toEqual(['aerodigestive-fistula-sealing'])
    expect(getRequiredCaseIdsForLesson('fit-behavior')).toEqual([
      'main-carinal-whole-y-fit',
      'curved-mainstem-fit-failure',
    ])
    expect(getRequiredCaseIdsForLesson('complications-surveillance')).toEqual([
      'proximal-granulation-multifactorial',
    ])
    expect(getRequiredCaseIdsForLesson('assessment')).toEqual([])
    expect(clinicalAssessmentItems).toHaveLength(6)

    const dynamicCollapse = clinicalCaseRegistry.find(
      (clinicalCase) => clinicalCase.id === 'selected-dynamic-collapse-trial',
    )
    expect(dynamicCollapse?.requiredForLesson).toBe(false)
  })

  it('resolves every case, decision, lens, and complication-pathway evidence reference', () => {
    for (const clinicalCase of clinicalCaseRegistry) {
      expect(clinicalCase.evidenceRefs.length).toBeGreaterThan(0)
      expect(findMissingEvidenceRefs(clinicalCase.evidenceRefs)).toEqual([])

      for (const decision of clinicalCase.decisions) {
        expect(decision.evidenceRefs.length).toBeGreaterThan(0)
        expect(findMissingEvidenceRefs(decision.evidenceRefs)).toEqual([])
      }

      if ('physicsLens' in clinicalCase && clinicalCase.physicsLens) {
        expect(clinicalCase.physicsLens.evidenceRefs.length).toBeGreaterThan(0)
        expect(findMissingEvidenceRefs(clinicalCase.physicsLens.evidenceRefs)).toEqual([])
      }
    }

    for (const pathway of complicationRegistry) {
      expect(pathway.evidenceRefs.length).toBeGreaterThan(0)
      expect(findMissingEvidenceRefs(pathway.evidenceRefs)).toEqual([])
    }
  })

  it('includes a defensible correct no-stent decision', () => {
    const correctNoStentChoices = getCorrectClinicalChoices().filter((choice) =>
      /\b(?:no stent|do not (?:place|insert) (?:a )?stent)\b/i.test(`${choice.id} ${choice.label}`),
    )

    expect(correctNoStentChoices.length).toBeGreaterThan(0)
    expect(
      correctNoStentChoices.some((choice) =>
        /no residual|without a defined structural target|no ongoing mechanical job/i.test(
          choice.rationale,
        ),
      ),
    ).toBe(true)
  })

  it('keeps force values and patient-specific pressure or risk outputs out of the required path', () => {
    const requiredClinicalCopy = JSON.stringify({
      module: clinicalModuleCopy,
      cases: clinicalCaseRegistry,
      complications: complicationRegistry,
      assessment: clinicalAssessmentItems,
    })

    expect(requiredClinicalCopy).not.toMatch(/\b\d+(?:\.\d+)?\s*(?:mN|N(?:\/mm)?|kPa|Pa)\b/)
    expect(requiredClinicalCopy).not.toMatch(
      /\b(?:tissue|mucosal|airway)\s+pressure\s*(?:is|=|:)\s*\d/i,
    )
    expect(requiredClinicalCopy).not.toMatch(
      /\b(?:granulation|complication)\s+(?:risk|probability)\s*(?:is|=|:)\s*\d/i,
    )
    expect(requiredClinicalCopy).not.toMatch(
      /\b(?:estimated|predicted|calculated)\s+(?:(?:tissue|mucosal|airway)\s+pressure|(?:granulation|complication)\s+(?:risk|probability))\b/i,
    )
  })

  it('keeps branded examples and product-ranking claims out of sole correct answers', () => {
    const brandNames = architectureRegistry
      .flatMap((profile) => (profile.brandedExample ? [profile.brandedExample] : []))
      .map((example) => example.split(/\s+/)[0].replace(/-style$/i, ''))
    const brandedProductPattern = new RegExp(
      `\\b(?:${brandNames.map(escapeRegex).join('|')})\\b`,
      'i',
    )
    const productRankingPattern =
      /\b(?:best|safest|superior(?:ity)?|winner|outperform(?:s|ed|ing)?)\b/i
    const correctAnswerCopy = [...getCorrectClinicalChoices(), ...getCorrectAssessmentChoices()]
      .map((choice) => `${choice.label} ${choice.rationale}`)
      .join(' ')

    expect(brandNames.length).toBeGreaterThan(0)
    expect(correctAnswerCopy).not.toMatch(brandedProductPattern)
    expect(correctAnswerCopy).not.toMatch(productRankingPattern)
    expect(clinicalModuleCopy.disclaimer).toMatch(/does not provide[\s\S]*product rankings/i)
  })

  it('models granulation across mechanical, infectious-secretory, and biologic-time domains', () => {
    const granulation = complicationRegistry.find((pathway) => pathway.id === 'granulation')

    expect(granulation).toBeDefined()
    expect(granulation?.contributorDomains).toEqual(
      expect.arrayContaining(['mechanical', 'infectious-secretory', 'biologic-time']),
    )

    const contributors = granulation?.plausibleContributors.join(' ') ?? ''
    expect(contributors).toMatch(/fit|contact|motion/i)
    expect(contributors).toMatch(/secretions|infection|biofilm|colonization/i)
    expect(contributors).toMatch(/dwell time|host biology|wound-healing|foreign-body/i)
  })

  it('does not encode cough as a deterministic cause of granulation', () => {
    const authoredClinicalCopy = JSON.stringify({
      module: clinicalModuleCopy,
      cases: clinicalCaseRegistry,
      complications: complicationRegistry,
      lenses: physicsLensRegistry,
      scenarios: mechanismScenarioRegistry,
    })

    expect(authoredClinicalCopy).not.toMatch(
      /\bcough(?:ing)?\b[^.!?]{0,120}\b(?:causes?|produces?|guarantees?|results? in|leads? to)\b[^.!?]{0,80}\bgranulation\b/i,
    )
    expect(authoredClinicalCopy).not.toMatch(
      /\bgranulation\b[^.!?]{0,120}\b(?:is caused by|results? from|is produced by)\b[^.!?]{0,80}\bcough(?:ing)?\b/i,
    )
  })

  it('keeps fistula device strategy conditional before selecting airway architecture', () => {
    const fistulaCase = clinicalCaseRegistry.find(
      (clinicalCase) => clinicalCase.id === 'aerodigestive-fistula-sealing',
    )
    const strategyDecision = fistulaCase?.decisions[0]
    const correctChoice = strategyDecision?.options.find(
      (option) => option.id === strategyDecision.correctChoiceId,
    )

    expect(strategyDecision?.id).toBe('fistula-coordinated-strategy')
    expect(`${correctChoice?.label} ${correctChoice?.rationale}`).toMatch(
      /airway-only[\s\S]*esophageal-only[\s\S]*combined[\s\S]*no-airway-stent/i,
    )
    expect(`${correctChoice?.label} ${correctChoice?.rationale}`).toMatch(
      /anatomy|defect|landing zones/i,
    )
  })

  it('does not turn sizing observations into universal cutoffs', () => {
    const authoredClinicalCopy = JSON.stringify({
      module: clinicalModuleCopy,
      cases: clinicalCaseRegistry,
      complications: complicationRegistry,
      assessment: clinicalAssessmentItems,
    })

    expect(authoredClinicalCopy).not.toMatch(
      /\b(?:always|universally|in every patient)\b[^.!?]{0,100}\b(?:oversiz|diameter|length|millimeters?|mm|percent|%)\b/i,
    )
    expect(authoredClinicalCopy).not.toMatch(
      /\b(?:oversize|size)\b[^.!?]{0,80}\b(?:exactly|at least|no more than)\s*\d+(?:\.\d+)?\s*(?:%|mm|millimeters?)\b/i,
    )
  })

  it('requires a granulation response beyond tissue removal alone', () => {
    const granulation = complicationRegistry.find((pathway) => pathway.id === 'granulation')
    const response = granulation?.responseDomains.join(' ') ?? ''

    expect(granulation?.responseDomains.length).toBeGreaterThanOrEqual(4)
    expect(response).toMatch(/restore airway patency/i)
    expect(response).toMatch(/secretion|infectious|infection/i)
    expect(response).toMatch(/fit|position|architecture/i)
    expect(response).toMatch(/ongoing indication|exit plan|follow-up/i)
    expect(response).not.toMatch(/^\s*(?:debridement|debride|ablation)\s*(?:alone)?[.!]?\s*$/i)

    const granulationCase = clinicalCaseRegistry.find(
      (clinicalCase) => clinicalCase.id === 'proximal-granulation-multifactorial',
    )
    const responseDecision = granulationCase?.decisions.find(
      (decision) => decision.id === 'granulation-response',
    )
    const correctResponse = responseDecision?.options.find(
      (option) => option.id === responseDecision.correctChoiceId,
    )

    expect(correctResponse?.id).toBe('restore-and-correct')
    expect(`${correctResponse?.label} ${correctResponse?.rationale}`).toMatch(
      /restore patency[\s\S]*(?:secretions|infection)[\s\S]*(?:fit|position|architecture)/i,
    )
  })

  it('provides all six authored physics lenses with explicit evidence boundaries', () => {
    expect(Object.keys(physicsLensRegistry)).toHaveLength(EXPECTED_PHYSICS_LENS_PRESETS.length)
    expect(Object.keys(physicsLensRegistry)).toEqual(
      expect.arrayContaining(EXPECTED_PHYSICS_LENS_PRESETS),
    )

    for (const preset of EXPECTED_PHYSICS_LENS_PRESETS) {
      const lens = physicsLensRegistry[preset]

      expect(lens.preset).toBe(preset)
      expect(lens.clinicalQuestion.length).toBeGreaterThan(20)
      expect(lens.observationPrompts.length).toBeGreaterThanOrEqual(2)
      expect(lens.observationPrompts.length).toBeLessThanOrEqual(4)
      expect(lens.evidenceBoundary.length).toBeGreaterThan(40)
      expect(lens.evidenceBoundary).toMatch(/\b(?:not|does not|cannot)\b/i)
      expect(lens.evidenceRefs.length).toBeGreaterThan(0)
      expect(findMissingEvidenceRefs(lens.evidenceRefs)).toEqual([])
    }
  })
})
