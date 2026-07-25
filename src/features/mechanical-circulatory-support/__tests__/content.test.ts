import { clinicalLearningItemSchema } from '@/features/learning-module/activity'

import {
  allMcsScenarios,
  mcsCapstoneScenarios,
  mcsDeviceProfiles,
  mcsLessons,
  mcsLessonTransfers,
  mcsPracticeScenarios,
  impellaAnatomyVariants,
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
      expect(profile.educationalModelVersion).toMatch(/^\d+\.\d+\.\d+(?:-[\w.]+)?$/)
      expect(profile.controlBounds.length).toBeGreaterThan(0)
      expect(profile.alarmDefinitions.length).toBeGreaterThan(0)
      for (const sourceId of profile.sourceIds) expect(mcsSourceById.has(sourceId)).toBe(true)
    }
    for (const variant of impellaAnatomyVariants) {
      expect(variant.sourceIds.length).toBeGreaterThan(0)
      for (const sourceId of variant.sourceIds) expect(mcsSourceById.has(sourceId)).toBe(true)
    }
  })

  it('provides one reviewed, distinct, simulator-backed transfer variant per lesson', () => {
    expect(mcsLessonTransfers).toHaveLength(mcsLessons.length)
    expect(new Set(mcsLessonTransfers.map((transfer) => transfer.lessonId))).toEqual(
      new Set(mcsLessons.map((lesson) => lesson.id)),
    )
    expect(
      new Set(mcsLessonTransfers.map((transfer) => transfer.item.transferVariantId)).size,
    ).toBe(mcsLessons.length)

    for (const transfer of mcsLessonTransfers) {
      expect(clinicalLearningItemSchema.safeParse(transfer.item).success).toBe(true)
      expect(transfer.item.phase).toBe('transfer')
      expect(transfer.item.itemType).toBe('transfer-case')
      expect(transfer.contextItems.length).toBeGreaterThanOrEqual(4)
      expect(transfer.setupActions.length).toBeGreaterThan(0)
      expect(transfer.requiredActionIds.length).toBeGreaterThan(0)
      expect(transfer.requiredActionLabel).toBeTruthy()
      for (const evidenceId of transfer.item.evidenceIds) {
        expect(mcsSourceById.has(evidenceId)).toBe(true)
      }
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
    expect(notices.length).toBeGreaterThanOrEqual(5)
    expect(notices.some((source) => source.id === 'fda-impella-cp-2026-recall')).toBe(true)
    expect(notices.some((source) => source.id === 'fda-impella-rp-2026-recall')).toBe(true)
    expect(notices.some((source) => source.id === 'fda-heartmate-mpu-2025-recall')).toBe(true)
    expect(mcsReleaseGates.find((gate) => gate.id === 'recall-check-content-freeze')).toMatchObject(
      {
        complete: false,
      },
    )
  })

  it('uses distinct, openly named capstone presentations rather than recycling practice cases', () => {
    for (const capstone of mcsCapstoneScenarios) {
      expect(
        mcsPracticeScenarios.some((practice) => practice.presentation === capstone.presentation),
      ).toBe(false)
      expect(capstone.title).toMatch(/challenge/i)
      expect(capstone.title).not.toMatch(/masked/i)
    }
  })

  it('teaches CP versus 5.5 and RP/BiPella with variant-specific evidence', () => {
    const leftVariantLesson = mcsLessons.find(
      (lesson) => lesson.id === 'impella-unloading-placement',
    )
    const rightSupportLesson = mcsLessons.find((lesson) => lesson.id === 'impella-suction-purge-rv')

    expect(leftVariantLesson?.steps.some((step) => step.id === 'impella-left-variant')).toBe(true)
    expect(leftVariantLesson?.sourceIds).toEqual(
      expect.arrayContaining(['fda-impella-55-labeling', 'jnj-impella-55-current']),
    )
    expect(rightSupportLesson?.steps.some((step) => step.id === 'impella-rp-bipella')).toBe(true)
    expect(rightSupportLesson?.sourceIds).toEqual(
      expect.arrayContaining([
        'fda-impella-55-labeling',
        'jnj-impella-55-current',
        'fda-impella-rp-labeling',
        'jnj-impella-rp-current',
      ]),
    )

    const rpVariant = impellaAnatomyVariants.find((variant) => variant.id === 'rp')
    expect(rpVariant?.productFlowFraming).toMatch(/up to 4\.0 L\/min/i)
    expect(rpVariant?.productFlowFraming).not.toMatch(/above|>\s*4\.0/i)
  })
})
