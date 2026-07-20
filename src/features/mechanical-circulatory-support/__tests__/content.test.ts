import {
  allMcsScenarios,
  mcsCapstoneScenarios,
  mcsDeviceProfiles,
  mcsLessons,
  mcsPracticeScenarios,
  isMcsPublicationReady,
  mcsReleaseGates,
  mcsSourceById,
  mcsSources,
} from '../content'

describe('MCS curriculum and evidence registry', () => {
  it('contains the planned lessons, practice cases, capstones, and three device profiles', () => {
    expect(mcsLessons).toHaveLength(8)
    expect(mcsPracticeScenarios).toHaveLength(9)
    expect(mcsCapstoneScenarios).toHaveLength(3)
    expect(allMcsScenarios).toHaveLength(12)
    expect(mcsDeviceProfiles.map((profile) => profile.kind)).toEqual(['iabp', 'impella', 'lvad'])
  })

  it('keeps every clinical definition versioned and connected to registered sources', () => {
    for (const lesson of mcsLessons) {
      expect(lesson.version).toMatch(/^1\./)
      expect(lesson.sourceIds.length).toBeGreaterThan(0)
      for (const sourceId of lesson.sourceIds) expect(mcsSourceById.has(sourceId)).toBe(true)
    }
    for (const scenario of allMcsScenarios) {
      expect(scenario.version).toMatch(/^1\./)
      expect(scenario.requiredActionIds.length).toBeGreaterThan(0)
      expect(scenario.successCriteria.length).toBeGreaterThan(0)
      expect(scenario.hiddenFaultIds.length).toBeGreaterThan(0)
      expect(scenario.permittedActionIds.length).toBeGreaterThan(0)
      expect(scenario.criticalErrorIds.length).toBeGreaterThan(0)
      expect(scenario.evidenceSourceIds).toEqual(expect.arrayContaining([...scenario.sourceIds]))
      for (const sourceId of scenario.sourceIds) expect(mcsSourceById.has(sourceId)).toBe(true)
    }
    for (const profile of mcsDeviceProfiles) {
      expect(profile.educationalModelVersion).toMatch(/^1\./)
      expect(profile.controlBounds.length).toBeGreaterThan(0)
      expect(profile.alarmDefinitions.length).toBeGreaterThan(0)
      for (const sourceId of profile.sourceIds) expect(mcsSourceById.has(sourceId)).toBe(true)
    }
  })

  it('keeps publication blocked until every multidisciplinary release gate has evidence', () => {
    expect(mcsReleaseGates.some((gate) => !gate.complete)).toBe(true)
    expect(isMcsPublicationReady()).toBe(false)
    expect(
      isMcsPublicationReady(
        mcsReleaseGates.map((gate) => ({
          ...gate,
          complete: true,
          evidence: gate.evidence ?? 'signed review',
        })),
      ),
    ).toBe(true)
  })

  it('records current FDA safety notices without treating the recall sweep as complete', () => {
    const notices = mcsSources.filter((source) => source.sourceType === 'fda-safety-notice')
    expect(notices).toHaveLength(4)
    expect(notices.some((source) => source.id === 'fda-impella-cp-2026-recall')).toBe(true)
    expect(notices.some((source) => source.id === 'fda-heartmate-mpu-2025-recall')).toBe(true)
    expect(mcsReleaseGates.find((gate) => gate.id === 'recall-check-content-freeze')).toMatchObject(
      {
        complete: false,
      },
    )
  })

  it('uses distinct capstone presentations and hidden faults rather than recycling practice cases', () => {
    for (const capstone of mcsCapstoneScenarios) {
      expect(
        mcsPracticeScenarios.some((practice) => practice.presentation === capstone.presentation),
      ).toBe(false)
      expect(capstone.title).toMatch(/Unseen/i)
    }
  })
})
