/**
 * @jest-environment node
 */
import { capstoneItemId, imagingCases, validateImagingCases } from '../content/cases'
import { peripheralImagingSectionIds } from '../content/pathway'
import { capstoneStandard, capstoneUnlocked } from '../engine/caseStandard'
import {
  createEmptyImagingRecord,
  withFirstAttempt,
  withSectionCompleted,
  type ImagingRecord,
} from '../engine/learnProgress'
import { QUESTION_BY_ID } from '../data/questions'

function decideAll(except?: string): ImagingRecord {
  let record = createEmptyImagingRecord()
  for (const imagingCase of imagingCases) {
    const question = QUESTION_BY_ID[imagingCase.id]
    const choice =
      imagingCase.id === except
        ? question.choices.find((candidate) => candidate.id !== question.correct)!.id
        : question.correct
    record = withFirstAttempt(record, capstoneItemId(imagingCase.id), choice)
  }
  return record
}

describe('the capstone standard', () => {
  it('validates the eight cases and their titles', () => {
    expect(validateImagingCases()).toEqual([])
    expect(imagingCases.filter((imagingCase) => imagingCase.critical).map((c) => c.id)).toEqual([
      'case-1',
      'case-4',
      'case-6',
      'case-7',
    ])
  })

  it('is met only when every case is decided, seven or more held, and every critical decision held', () => {
    expect(capstoneStandard(createEmptyImagingRecord())).toMatchObject({
      decided: 0,
      complete: false,
      met: false,
    })
    expect(capstoneStandard(decideAll())).toMatchObject({
      decided: 8,
      held: 8,
      criticalHeld: 4,
      met: true,
    })
    expect(capstoneStandard(decideAll('case-2'))).toMatchObject({
      held: 7,
      criticalHeld: 4,
      met: true,
    })
    for (const critical of ['case-1', 'case-4', 'case-6', 'case-7']) {
      expect(capstoneStandard(decideAll(critical))).toMatchObject({ held: 7, met: false })
    }
  })

  it('opens only after every section is worked through', () => {
    let record = createEmptyImagingRecord()
    expect(capstoneUnlocked(record).unlocked).toBe(false)
    for (const sectionId of peripheralImagingSectionIds)
      record = withSectionCompleted(record, sectionId)
    expect(capstoneUnlocked(record)).toEqual({ unlocked: true, remaining: [] })
  })
})
