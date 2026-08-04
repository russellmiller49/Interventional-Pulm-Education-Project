/*
 * `McsModuleNav` reaches `@/i18n/navigation`, which loads `next-intl/navigation` — ESM that jest
 * does not transform, and which jest.setup.ts does not mock (it mocks `next-intl` and
 * `next-intl/server` only). Nothing here renders, so the mock can be inert.
 */
jest.mock('@/i18n/navigation', () => ({
  Link: () => null,
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/mechanical-circulatory-support',
}))

import { criticalCareConceptById } from '@/features/critical-care/content/concepts'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { criticalCareMeasurementClarificationById } from '@/features/critical-care/content/measurementClarifications'
import { criticalCareSourceConflictById } from '@/features/critical-care/content/sourceConflicts'
import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity'

import {
  MCS_COMPLETION_BOUNDARY,
  MCS_FLOW_ADDITIVITY_WARNING,
  MCS_PRODUCT_FLOW_BOUNDARY,
  MCS_RECOMMENDED_FIRST_SECTION_ID,
  mcsCausalLadder,
  mcsCommonModelQuestions,
  mcsComparisonPathwayCards,
  mcsFirstUseTerms,
  mcsFlowAccount,
  mcsFoundationLessonIds,
  mcsLessons,
  mcsRequiredDistinctions,
  mcsSimulatedPathwayCards,
  mcsSourceById,
  mcsSupportPathwayCardById,
  mcsSupportPathwayCards,
  validateMcsSupportPathways,
  type McsSupportPathwayCard,
} from '../content'
import { mcsModuleNavItems } from '../components/McsModuleNav'
import { MCS_COMPLETABLE_ITEM_COUNT, createDefaultMcsProgress, mcsProgressPercent } from '../engine'
import { mcsCapstoneScenarios, mcsPracticeScenarios } from '../content/scenarios'

const mcsPathway = criticalCareLearningPathway('mechanical-circulatory-support')

describe('MCS foundation section identity (M0/M1)', () => {
  it('keeps the two existing foundation ids and adds no new persistent section', () => {
    expect(mcsFoundationLessonIds).toEqual([
      'mcs-foundations-signals',
      'mcs-foundations-mechanisms',
    ])
    expect(mcsLessons).toHaveLength(9)
    expect(mcsLessons.map((lesson) => lesson.id)).toEqual(
      mcsPathway.sections.map((section) => section.id),
    )
  })

  it('keeps each foundation lesson titled exactly as the locked pathway names it', () => {
    for (const lessonId of mcsFoundationLessonIds) {
      const lesson = mcsLessons.find((candidate) => candidate.id === lessonId)
      const section = mcsPathway.sections.find((candidate) => candidate.id === lessonId)
      expect(lesson?.curriculumStage).toBe('foundation')
      expect(lesson?.device).toBe('shared')
      // Two learner-visible titles for one activity is the drift this module already carries on
      // IABP-03. The rebuilt foundations must not add a third instance of it.
      expect(lesson?.title).toBe(section?.title)
    }
  })

  it('drives every foundation step from an action the guided button can actually dispatch', () => {
    // Only `inspect:*` and `device:select:*` are wired into the workbench's guided-step dispatcher.
    // A foundation step targeting a device-specific control would render with no button.
    for (const lessonId of mcsFoundationLessonIds) {
      const lesson = mcsLessons.find((candidate) => candidate.id === lessonId)
      expect(lesson?.steps.length).toBeGreaterThan(0)
      for (const step of lesson?.steps ?? []) {
        expect(step.targetActionId).toBeDefined()
        expect(step.targetActionId).toMatch(/^(inspect:|device:select:)/)
      }
    }
  })

  it('recommends a first section that exists, without gating any other', () => {
    expect(MCS_RECOMMENDED_FIRST_SECTION_ID).toBe('mcs-foundations-signals')
    expect(mcsPathway.sections[0]?.id).toBe(MCS_RECOMMENDED_FIRST_SECTION_ID)
    expect(mcsLessons.some((lesson) => lesson.id === MCS_RECOMMENDED_FIRST_SECTION_ID)).toBe(true)
  })
})

describe('the common cardiovascular model', () => {
  it('asks seven questions, in order, each answerable from an observation', () => {
    expect(mcsCommonModelQuestions).toHaveLength(7)
    expect(mcsCommonModelQuestions.map((entry) => entry.order)).toEqual([1, 2, 3, 4, 5, 6, 7])
    for (const entry of mcsCommonModelQuestions) {
      expect(entry.question.trim()).not.toHaveLength(0)
      expect(entry.whyItMatters.trim()).not.toHaveLength(0)
      expect(entry.answeredBy.length).toBeGreaterThan(0)
    }
  })

  it('covers the whole model: dominant problem, path, mechanism, unloaded, loaded, limit, success', () => {
    const asked = mcsCommonModelQuestions.map((entry) => entry.question.toLowerCase()).join(' | ')
    expect(asked).toMatch(/dominant problem/)
    expect(asked).toMatch(/where does blood enter/)
    expect(asked).toMatch(/pressure timing/)
    expect(asked).toMatch(/directly pump blood/)
    expect(asked).toMatch(/extracorporeal/)
    expect(asked).toMatch(/which chamber is unloaded/)
    expect(asked).toMatch(/potentially loaded|may be loaded/)
    expect(asked).toMatch(/preload/)
    expect(asked).toMatch(/afterload/)
    expect(asked).toMatch(/rhythm/)
    expect(asked).toMatch(/position/)
    expect(asked).toMatch(/obstruction/)
    expect(asked).toMatch(/gas exchange/)
    expect(asked).toMatch(/success/)
  })

  it('builds the four causal levels in order, each stating what it cannot establish', () => {
    expect(mcsCausalLadder.map((level) => level.label)).toEqual([
      'Pressure',
      'Flow',
      'Oxygen delivery',
      'Organ response',
    ])
    expect(mcsCausalLadder.map((level) => level.order)).toEqual([1, 2, 3, 4])
    for (const level of mcsCausalLadder) {
      expect(level.whatItEstablishes.trim()).not.toHaveLength(0)
      expect(level.whatItCannotEstablish.trim()).not.toHaveLength(0)
      expect(level.liveSignalLabels.length).toBeGreaterThan(0)
    }
  })

  it('separates native, displayed device, and effective systemic delivery as three lines', () => {
    expect(mcsFlowAccount.map((line) => line.id)).toEqual([
      'native',
      'device-displayed',
      'effective-systemic',
    ])
    // The displayed device line is the one a learner reads off a screen, and it is an estimate.
    expect(mcsFlowAccount.find((line) => line.id === 'device-displayed')?.valueType).toBe(
      'estimated',
    )
    // Effective systemic delivery is reasoned to. No console shows it.
    expect(mcsFlowAccount.find((line) => line.id === 'effective-systemic')?.valueType).toBe(
      'inferred',
    )
    for (const line of mcsFlowAccount) {
      expect(line.howItMisleads.trim()).not.toHaveLength(0)
      expect(line.valueTypeStatement.trim()).not.toHaveLength(0)
    }
  })

  it('warns that displayed flows are not automatically additive, with worked pathway cases', () => {
    expect(MCS_FLOW_ADDITIVITY_WARNING.headline).toMatch(/not automatically additive/i)
    expect(MCS_FLOW_ADDITIVITY_WARNING.worked.length).toBeGreaterThanOrEqual(3)
    const worked = MCS_FLOW_ADDITIVITY_WARNING.worked.join(' ').toLowerCase()
    expect(worked).toMatch(/serial/)
    expect(worked).toMatch(/parallel/)
    expect(worked).toMatch(/counted that stream twice|counts that stream twice|twice/)
  })

  it('defines every first-use term with its clinical question and one way it misleads', () => {
    const terms = mcsFirstUseTerms.map((entry) => entry.term.toLowerCase())
    for (const required of [
      'native output',
      'device flow',
      'effective systemic flow',
      'unloading',
      'augmentation',
      'support',
      'estimated versus measured flow',
      'pressure improvement versus perfusion improvement',
    ]) {
      expect(terms).toContain(required)
    }
    for (const entry of mcsFirstUseTerms) {
      expect(entry.definition.trim()).not.toHaveLength(0)
      expect(entry.clinicalQuestion.trim()).not.toHaveLength(0)
      expect(entry.howItMisleads.trim()).not.toHaveLength(0)
    }
  })

  it('states that working through the module does not make anyone ready to run a device', () => {
    expect(MCS_COMPLETION_BOUNDARY.headline).toMatch(/does not establish/i)
    expect(`${MCS_COMPLETION_BOUNDARY.headline} ${MCS_COMPLETION_BOUNDARY.statement}`).toMatch(
      /ready to operate|device-specific training/i,
    )
    // The shared learner-copy lint bans the credentialing vocabulary outright, with no override.
    expect(
      flaggedLearnerCopyTerms(
        `${MCS_COMPLETION_BOUNDARY.headline} ${MCS_COMPLETION_BOUNDARY.statement}`,
      ),
    ).toEqual([])
  })

  it('keeps every learner-facing model string clear of grading and software vocabulary', () => {
    const blocks: readonly (readonly [string, string])[] = [
      ...mcsCommonModelQuestions.map(
        (entry) =>
          [entry.id, [entry.question, entry.whyItMatters, ...entry.answeredBy].join(' ')] as const,
      ),
      ...mcsCausalLadder.map(
        (level) =>
          [
            level.id,
            [
              level.label,
              level.question,
              level.whatItEstablishes,
              level.whatItCannotEstablish,
              ...level.liveSignalLabels,
            ].join(' '),
          ] as const,
      ),
      ...mcsFlowAccount.map(
        (line) =>
          [
            line.id,
            [line.label, line.definition, line.valueTypeStatement, line.howItMisleads].join(' '),
          ] as const,
      ),
      ...mcsFirstUseTerms.map(
        (term) =>
          [
            term.id,
            [term.term, term.definition, term.clinicalQuestion, term.howItMisleads].join(' '),
          ] as const,
      ),
      [
        MCS_FLOW_ADDITIVITY_WARNING.id,
        [
          MCS_FLOW_ADDITIVITY_WARNING.headline,
          MCS_FLOW_ADDITIVITY_WARNING.statement,
          ...MCS_FLOW_ADDITIVITY_WARNING.worked,
        ].join(' '),
      ] as const,
      ...mcsRequiredDistinctions.map(
        (entry) => [entry.id, [entry.claim, entry.confusedWith].join(' ')] as const,
      ),
    ]

    for (const [id, copy] of blocks) {
      expect({ id, flagged: flaggedLearnerCopyTerms(copy) }).toEqual({ id, flagged: [] })
    }
  })

  it('binds every model concept id to a registered critical-care concept', () => {
    const conceptIds = [
      ...mcsCommonModelQuestions.flatMap((entry) => entry.conceptIds),
      ...mcsCausalLadder.flatMap((entry) => entry.conceptIds),
      ...mcsFlowAccount.flatMap((entry) => entry.conceptIds),
      ...mcsFirstUseTerms.flatMap((entry) => entry.conceptIds),
      ...MCS_FLOW_ADDITIVITY_WARNING.conceptIds,
    ]
    expect(conceptIds.length).toBeGreaterThan(0)
    for (const conceptId of conceptIds) {
      expect(criticalCareConceptById.has(conceptId)).toBe(true)
    }
  })
})

// The exact field list a card must answer. Kept here rather than derived from the type so that
// deleting a field from the interface fails this test instead of quietly shrinking the contract.
const REQUIRED_CARD_FIELDS = (card: McsSupportPathwayCard): Record<string, string> => ({
  bloodEntersFrom: card.bloodEntersFrom,
  bloodReturnsTo: card.bloodReturnsTo,
  mechanism: card.mechanism,
  flowPattern: card.flowPattern,
  chamberPrimarilyUnloaded: card.chamberPrimarilyUnloaded,
  chamberOrBedPotentiallyLoaded: card.chamberOrBedPotentiallyLoaded,
  preloadRequirements: card.preloadRequirements,
  'constraints.afterload': card.constraints.afterload,
  'constraints.position': card.constraints.position,
  'constraints.rhythm': card.constraints.rhythm,
  'constraints.obstruction': card.constraints.obstruction,
  'gasExchange.statement': card.gasExchange.statement,
  'displayedFlow.statement': card.displayedFlow.statement,
  'displayedFlow.additivity': card.displayedFlow.additivity,
  'lowFlowDifferential.patient': card.lowFlowDifferential.patient,
  'lowFlowDifferential.position': card.lowFlowDifferential.position,
  'lowFlowDifferential.device': card.lowFlowDifferential.device,
  firstUnsafeReflex: card.firstUnsafeReflex,
  bridgeExitBoundary: card.bridgeExitBoundary,
  productReferenceBoundary: card.productReferenceBoundary,
})

describe('standardized support-pathway cards', () => {
  it('covers every pathway the package names, simulated and comparison alike', () => {
    expect(mcsSupportPathwayCards.map((card) => card.id)).toEqual([
      'iabp-counterpulsation',
      'impella-left-transvalvular',
      'impella-right-caval-to-pa',
      'durable-continuous-flow-lvad',
      'vv-ecmo-comparison',
      'va-ecmo-comparison',
      'ra-to-pa-temporary-rv-support',
      'la-to-arterial-transseptal-support',
    ])
    expect(mcsSimulatedPathwayCards).toHaveLength(4)
    expect(mcsComparisonPathwayCards).toHaveLength(4)
    for (const card of mcsComparisonPathwayCards) {
      expect(card.comparisonNote?.trim()).toBeTruthy()
    }
  })

  it('answers the same fields on every card, with no field left blank anywhere', () => {
    for (const card of mcsSupportPathwayCards) {
      const fields = REQUIRED_CARD_FIELDS(card)
      for (const [name, value] of Object.entries(fields)) {
        expect({ card: card.id, field: name, empty: value.trim().length === 0 }).toEqual({
          card: card.id,
          field: name,
          empty: false,
        })
      }
      expect(typeof card.gasExchange.provides).toBe('boolean')
      expect(['temporary', 'durable']).toContain(card.supportRole)
      expect(card.sourceIds.length).toBeGreaterThan(0)
      for (const sourceId of card.sourceIds) expect(mcsSourceById.has(sourceId)).toBe(true)
    }
  })

  it('holds the venovenous and venoarterial pathways apart', () => {
    const vv = mcsSupportPathwayCardById.get('vv-ecmo-comparison')
    const va = mcsSupportPathwayCardById.get('va-ecmo-comparison')

    expect(vv?.gasExchange.provides).toBe(true)
    expect(va?.gasExchange.provides).toBe(true)

    // Venovenous returns to the venous side and therefore adds no systemic flow.
    expect(vv?.bloodReturnsTo.toLowerCase()).toMatch(/venous/)
    expect(vv?.displayedFlow.additivity.toLowerCase()).toMatch(/adds no systemic flow|not additive/)
    expect(vv?.chamberPrimarilyUnloaded.toLowerCase()).toMatch(/no chamber/)

    // Venoarterial returns to an artery, adds systemic flow, and loads the left ventricle.
    expect(va?.bloodReturnsTo.toLowerCase()).toMatch(/arter/)
    expect(va?.chamberOrBedPotentiallyLoaded.toLowerCase()).toMatch(/left ventricle/)
    expect(va?.displayedFlow.additivity.toLowerCase()).toMatch(/not simply additive/)
  })

  it('makes temporary and durable support explicit and different in kind', () => {
    const roles = new Set(mcsSupportPathwayCards.map((card) => card.supportRole))
    expect(roles).toEqual(new Set(['temporary', 'durable']))
    const durable = mcsSupportPathwayCardById.get('durable-continuous-flow-lvad')
    expect(durable?.supportRole).toBe('durable')
    expect(durable?.bridgeExitBoundary.toLowerCase()).toMatch(
      /different decision from temporary support/,
    )
    expect(mcsSupportPathwayCardById.get('impella-left-transvalvular')?.supportRole).toBe(
      'temporary',
    )
  })

  it('keeps the left-sided and right-sided microaxial pathways distinct', () => {
    const left = mcsSupportPathwayCardById.get('impella-left-transvalvular')
    const right = mcsSupportPathwayCardById.get('impella-right-caval-to-pa')

    expect(left?.bloodEntersFrom).not.toBe(right?.bloodEntersFrom)
    expect(left?.bloodReturnsTo).not.toBe(right?.bloodReturnsTo)
    expect(left?.chamberPrimarilyUnloaded).not.toBe(right?.chamberPrimarilyUnloaded)

    expect(left?.bloodEntersFrom.toLowerCase()).toMatch(/left ventricle/)
    expect(left?.bloodReturnsTo.toLowerCase()).toMatch(/aorta/)
    expect(left?.chamberPrimarilyUnloaded.toLowerCase()).toMatch(/left ventricle/)

    expect(right?.bloodEntersFrom.toLowerCase()).toMatch(/vena cava|right atrium/)
    expect(right?.bloodReturnsTo.toLowerCase()).toMatch(/pulmonary artery/)
    expect(right?.chamberPrimarilyUnloaded.toLowerCase()).toMatch(/right ventricle/)
    expect(right?.gasExchange.provides).toBe(false)
  })

  it('never invites a learner to add serial flows', () => {
    for (const card of mcsSupportPathwayCards) {
      expect(card.displayedFlow.additivity.trim()).not.toHaveLength(0)
    }
    // Every pathway whose output has still to cross the lungs says so explicitly.
    for (const cardId of ['impella-right-caval-to-pa', 'ra-to-pa-temporary-rv-support']) {
      const card = mcsSupportPathwayCardById.get(cardId)
      expect(card?.displayedFlow.additivity.toLowerCase()).toMatch(/never add/)
      expect(card?.displayedFlow.additivity.toLowerCase()).toMatch(/serial|sequence|twice/)
    }
    // Counterpulsation has no stream at all, so there is nothing to add.
    expect(mcsSupportPathwayCardById.get('iabp-counterpulsation')?.displayedFlow.valueType).toBe(
      'no-device-flow-reported',
    )
  })

  it('labels counterpulsation as timing and pressure rather than a chamber-to-artery pump', () => {
    const iabp = mcsSupportPathwayCardById.get('iabp-counterpulsation')
    expect(iabp?.mechanismClass).toBe('timing-and-pressure')
    expect(iabp?.productReferences).toHaveLength(0)
    expect(iabp?.bloodEntersFrom.toLowerCase()).toMatch(/^nothing/)
    expect(iabp?.bloodReturnsTo.toLowerCase()).toMatch(/^nothing/)
    expect(mcsSupportPathwayCardById.get('impella-left-transvalvular')?.mechanismClass).toBe(
      'direct-blood-pump',
    )
    expect(mcsSupportPathwayCardById.get('vv-ecmo-comparison')?.mechanismClass).toBe(
      'extracorporeal-circuit',
    )
  })

  it('places every product flow figure after the reasoning fields and labels it not a target', () => {
    const withFigures = mcsSupportPathwayCards.filter((card) => card.productReferences.length > 0)
    expect(withFigures.map((card) => card.id)).toEqual([
      'impella-left-transvalvular',
      'impella-right-caval-to-pa',
    ])
    for (const card of withFigures) {
      expect(card.productReferenceBoundary).toBe(MCS_PRODUCT_FLOW_BOUNDARY)
      expect(card.productReferenceBoundary.toLowerCase()).toMatch(/not a treatment target/)
      for (const reference of card.productReferences) {
        expect(reference.measurand.trim()).not.toHaveLength(0)
        expect(reference.condition.trim()).not.toHaveLength(0)
        expect(reference.evidenceIds.length).toBeGreaterThan(0)
        for (const evidenceId of reference.evidenceIds) {
          expect(mcsSourceById.has(evidenceId)).toBe(true)
        }
      }
    }
  })

  it('keeps each Impella CP flow figure attached to its own measurand rather than one number', () => {
    const left = mcsSupportPathwayCardById.get('impella-left-transvalvular')
    const cp = left?.productReferences.filter((reference) => reference.productName.includes('CP'))
    expect(cp).toHaveLength(3)
    expect(cp?.map((reference) => reference.measurand)).toEqual([
      'Maximum mean flow',
      'Peak flow rate at systole',
      'Average flow observed during support',
    ])
  })

  it('wires the measurand clarification and the held disagreement to their own records', () => {
    const left = mcsSupportPathwayCardById.get('impella-left-transvalvular')

    // Three manufacturer figures naming three measurands are NOT a disagreement.
    expect(left?.measurementClarificationIds).toEqual([
      'clarification.mcs.impella-cp-flow-measurands',
    ])
    // One textbook contradicting itself IS a disagreement, and the id is the textbook one.
    expect(left?.sourceConflictIds).toEqual(['conflict.mcs.impella-cp-textbook-flow'])

    for (const id of left?.measurementClarificationIds ?? []) {
      expect(criticalCareMeasurementClarificationById.has(id)).toBe(true)
      expect(criticalCareSourceConflictById.has(id)).toBe(false)
    }
    for (const id of left?.sourceConflictIds ?? []) {
      expect(criticalCareSourceConflictById.has(id)).toBe(true)
      expect(criticalCareMeasurementClarificationById.has(id)).toBe(false)
    }
  })

  it('states each required distinction against at least two comparable pathways', () => {
    const claims = mcsRequiredDistinctions.map((entry) => entry.claim.toLowerCase()).join(' | ')
    expect(claims).toMatch(/not a chamber-to-artery pump/)
    expect(claims).toMatch(/different pathways/)
    expect(claims).toMatch(/serial/)
    expect(claims).toMatch(/not simply more temporary support/)
    expect(claims).toMatch(/adds no systemic circulatory flow/)
    expect(claims).toMatch(/eject against/)
    expect(claims).toMatch(/direction blood flows/)

    for (const distinction of mcsRequiredDistinctions) {
      expect(distinction.pathwayIds.length).toBeGreaterThanOrEqual(2)
      for (const pathwayId of distinction.pathwayIds) {
        expect(mcsSupportPathwayCardById.has(pathwayId)).toBe(true)
      }
      for (const conceptId of distinction.conceptIds) {
        expect(criticalCareConceptById.has(conceptId)).toBe(true)
      }
    }
  })

  it('fails the import guard when a card is thinner than the ones it is compared against', () => {
    const complete = mcsSupportPathwayCardById.get('impella-left-transvalvular')!
    const incomplete: McsSupportPathwayCard = {
      ...complete,
      id: 'incomplete-card-under-test',
      chamberOrBedPotentiallyLoaded: '   ',
      constraints: { ...complete.constraints, obstruction: '' },
      lowFlowDifferential: { ...complete.lowFlowDifferential, position: '' },
    }
    const errors = validateMcsSupportPathways([incomplete])
    expect(errors).toEqual(
      expect.arrayContaining([
        'incomplete-card-under-test: missing chamberOrBedPotentiallyLoaded',
        'incomplete-card-under-test: missing constraints.obstruction',
        'incomplete-card-under-test: missing lowFlowDifferential.position',
      ]),
    )
    // And the real set stays clean.
    expect(validateMcsSupportPathways()).toEqual([])
  })

  it('refuses a product flow figure on a pathway that reports no device flow', () => {
    const iabp = mcsSupportPathwayCardById.get('iabp-counterpulsation')!
    const left = mcsSupportPathwayCardById.get('impella-left-transvalvular')!
    const errors = validateMcsSupportPathways([
      { ...iabp, id: 'iabp-with-a-flow-figure', productReferences: left.productReferences },
    ])
    expect(errors).toEqual(
      expect.arrayContaining([
        'iabp-with-a-flow-figure: reports no device flow but publishes a product flow figure',
      ]),
    )
  })

  it('keeps every learner-facing card field clear of grading and software vocabulary', () => {
    for (const card of mcsSupportPathwayCards) {
      const copy = [
        card.displayName,
        ...Object.values(REQUIRED_CARD_FIELDS(card)),
        card.comparisonNote ?? '',
      ].join(' ')
      expect({ card: card.id, flagged: flaggedLearnerCopyTerms(copy) }).toEqual({
        card: card.id,
        flagged: [],
      })
    }
  })
})

describe('the guided-section count is derived, not written down', () => {
  it('reports the same number of guided sections in the nav as the pathway lists', () => {
    const learnItem = mcsModuleNavItems.find((item) => item.title === 'Learn')
    expect(learnItem?.description).toContain(String(mcsLessons.length))
    // The defect this replaced: a hand-written "Eight guided lessons" beside a nine-item rail.
    expect(learnItem?.description).not.toMatch(/eight/i)
    expect(mcsLessons).toHaveLength(mcsPathway.sections.length)

    const practiceItem = mcsModuleNavItems.find((item) => item.title === 'Practice')
    expect(practiceItem?.description).toContain(String(mcsPracticeScenarios.length))
    const challengeItem = mcsModuleNavItems.find((item) => item.title === 'Challenge')
    expect(challengeItem?.description).toContain(String(mcsCapstoneScenarios.length))
  })

  it('counts every completable item once when reporting how far a learner has come', () => {
    expect(MCS_COMPLETABLE_ITEM_COUNT).toBe(
      mcsLessons.length + mcsPracticeScenarios.length + mcsCapstoneScenarios.length,
    )
    expect(MCS_COMPLETABLE_ITEM_COUNT).toBe(21)

    const everythingButOne = {
      ...createDefaultMcsProgress(),
      completedLessonIds: mcsLessons.map((lesson) => lesson.id),
      masteredCaseIds: [
        ...mcsPracticeScenarios.map((scenario) => scenario.id),
        ...mcsCapstoneScenarios.slice(0, -1).map((scenario) => scenario.id),
      ],
    }
    // The old hard-coded denominator of 20 reported this state as finished. It is not.
    expect(mcsProgressPercent(everythingButOne)).toBeLessThan(100)
    expect(mcsProgressPercent(everythingButOne)).toBe(95)

    const everything = {
      ...everythingButOne,
      masteredCaseIds: [
        ...mcsPracticeScenarios.map((scenario) => scenario.id),
        ...mcsCapstoneScenarios.map((scenario) => scenario.id),
      ],
    }
    expect(mcsProgressPercent(everything)).toBe(100)
    expect(mcsProgressPercent(createDefaultMcsProgress())).toBe(0)
  })
})
