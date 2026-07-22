import {
  ICU_EDUCATIONAL_BOUNDARIES,
  ICU_EVIDENCE_BY_ID,
  ICU_SIMULATION_RELEASE,
  ICU_SIMULATION_RELEASE_STAGE,
  icuScenarios,
  safeParseIcuScenarioDefinition,
} from '../content'
import { icuScenarioFamilies, ICU_SCORE_WEIGHTS } from '../engine'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

describe('ICU simulation content', () => {
  it('ships exactly the six canonical scenario families', () => {
    expect(icuScenarios.map((scenario) => scenario.id)).toEqual(icuScenarioFamilies)
    expect(new Set(icuScenarios.map((scenario) => scenario.family)).size).toBe(6)
    expect(icuScenarios.every((scenario) => scenario.id === scenario.family)).toBe(true)
  })

  it('keeps every scenario strict, source-linked, synthetic, and bounded', () => {
    for (const scenario of icuScenarios) {
      expect(safeParseIcuScenarioDefinition(scenario).success).toBe(true)
      expect(scenario.educationalUseOnly).toBe(true)
      expect(scenario.reviewStatus).toBe('pending')
      expect(scenario.durationHours).toBeLessThanOrEqual(24)
      const evidenceIds = [
        ...scenario.evidenceIds,
        ...scenario.scheduledEvents.flatMap((event) => event.evidenceIds),
        ...scenario.interventions.flatMap((intervention) => intervention.evidenceIds),
        ...scenario.checkpoints.flatMap((checkpoint) => checkpoint.evidenceIds),
        ...scenario.masteryResponse.required.flatMap((predicate) => predicate.evidenceIds),
        ...(scenario.masteryResponse.oneOf ?? []).flatMap((path) =>
          path.predicates.flatMap((predicate) => predicate.evidenceIds),
        ),
      ]
      expect(evidenceIds.every((id) => ICU_EVIDENCE_BY_ID.has(id))).toBe(true)
      expect(scenario.masteryResponse.educationalModelOnly).toBe(true)
      expect(scenario.masteryResponse.reviewStatus).toBe('pending')
    }
    expect(ICU_EDUCATIONAL_BOUNDARIES.noRealPatientData).toBe(true)
    expect(ICU_EDUCATIONAL_BOUNDARIES.noMedicationDoses).toBe(true)
  })

  it('uses the fixed 15/15/20/20/20/10 scoring model', () => {
    expect(ICU_SCORE_WEIGHTS).toEqual({
      assessment: 15,
      prioritization: 15,
      therapy: 20,
      device: 20,
      reassessment: 20,
      safety: 10,
    })
  })

  it('fails closed on unknown properties, duplicates, bad references, and unsupported devices', () => {
    const extra = { ...clone(icuScenarios[0]), unexpectedTruthPatch: true }
    expect(safeParseIcuScenarioDefinition(extra).success).toBe(false)

    const duplicate = clone(icuScenarios[0])
    duplicate.interventions = [duplicate.interventions[0], ...duplicate.interventions]
    expect(safeParseIcuScenarioDefinition(duplicate).success).toBe(false)

    const badCheckpoint = clone(icuScenarios[0])
    badCheckpoint.checkpoints[0].requiredActionIds = ['care:not-authored']
    expect(safeParseIcuScenarioDefinition(badCheckpoint).success).toBe(false)

    const unsupported = clone(icuScenarios[0])
    unsupported.initialDevices = {
      mcs: {
        status: 'ready',
        device: 'left-impella',
        assistRatio: 1,
        performanceLevel: 4,
        inflationOffsetMs: 0,
        deflationOffsetMs: 0,
        position: 'correct',
        purgeState: 'normal',
        deviceFlowLMin: 0,
      },
    }
    expect(safeParseIcuScenarioDefinition(unsupported).success).toBe(false)

    const duplicateResponsePredicate = clone(icuScenarios[0])
    duplicateResponsePredicate.masteryResponse.required = [
      duplicateResponsePredicate.masteryResponse.required[0],
      ...duplicateResponsePredicate.masteryResponse.required,
    ]
    expect(safeParseIcuScenarioDefinition(duplicateResponsePredicate).success).toBe(false)

    const unknownResponseEvidence = clone(icuScenarios[0])
    unknownResponseEvidence.masteryResponse.required[0].evidenceIds = ['ICU-NOT-A-SOURCE']
    expect(safeParseIcuScenarioDefinition(unknownResponseEvidence).success).toBe(false)

    const unknownResponseSubstitution = clone(icuScenarios[1])
    unknownResponseSubstitution.masteryResponse.oneOf![0].substitutesForActionIds = [
      'care:not-scored',
    ]
    expect(safeParseIcuScenarioDefinition(unknownResponseSubstitution).success).toBe(false)

    const ineligibleResponseSubstitution = clone(icuScenarios[1])
    ineligibleResponseSubstitution.masteryResponse.oneOf![0].substitutesForActionIds = [
      'diagnosis:correct',
    ]
    expect(safeParseIcuScenarioDefinition(ineligibleResponseSubstitution).success).toBe(false)

    const duplicateScoringAction = clone(icuScenarios[0])
    duplicateScoringAction.scoring = {
      ...duplicateScoringAction.scoring,
      therapy: [
        duplicateScoringAction.scoring.therapy[0],
        ...duplicateScoringAction.scoring.therapy,
      ],
    }
    expect(safeParseIcuScenarioDefinition(duplicateScoringAction).success).toBe(false)

    const responseExtra = clone(icuScenarios[0]) as (typeof icuScenarios)[number] & {
      masteryResponse: (typeof icuScenarios)[number]['masteryResponse'] & { hiddenTarget?: number }
    }
    responseExtra.masteryResponse.hiddenTarget = 65
    expect(safeParseIcuScenarioDefinition(responseExtra).success).toBe(false)
  })

  it('remains private-development and unlisted', () => {
    expect(ICU_SIMULATION_RELEASE_STAGE).toBe('private-development')
    expect(ICU_SIMULATION_RELEASE).toMatchObject({
      listed: false,
      searchable: false,
      sitemap: false,
      noIndex: true,
      routeGuardRequired: true,
    })
  })
})
