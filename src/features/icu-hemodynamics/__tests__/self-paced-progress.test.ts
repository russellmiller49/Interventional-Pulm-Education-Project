import { ICU_HEMODYNAMICS_LEARN_STORAGE_KEY } from '../engine/learnProgress'
import {
  ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
} from '../engine/progress'
import {
  createEmptySelfPacedRecord,
  ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY,
  isSectionReviewed,
  lastSectionId,
  parseSelfPacedRecord,
  readSelfPacedRecord,
  updateSelfPacedRecord,
  withCaseOpened,
  withSectionReviewed,
  withSectionVisited,
  writeSelfPacedRecord,
} from '../engine/selfPacedProgress'

beforeEach(() => localStorage.clear())

/** HD-01: the one record the self-paced module keeps — visits, a location, learner-marked review. */
describe('the self-paced record', () => {
  it('lives under its own key, apart from every legacy record', () => {
    expect(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY).toBe('icu-hemodynamics-self-paced-v1')
    for (const legacy of [
      ICU_HEMODYNAMICS_LEARN_STORAGE_KEY,
      ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
      ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
    ]) {
      expect(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY).not.toBe(legacy)
    }
  })

  it('records visits, a location and a learner-marked review, and undoes the review', () => {
    let record = withSectionVisited(createEmptySelfPacedRecord(), 'why-measure', 't1')
    expect(withSectionVisited(record, 'why-measure', 't2')).toBe(record)
    expect(record.visitedSectionIds).toEqual(['why-measure'])
    expect(lastSectionId(record)).toBe('why-measure')
    record = withSectionReviewed(record, 'why-measure', true, 't3')
    expect(isSectionReviewed(record, 'why-measure')).toBe(true)
    record = withSectionReviewed(record, 'why-measure', false, 't4')
    expect(record.reviewedSectionIds).toEqual([])
    record = withCaseOpened(record, 'HD-07', 'applied', 't5')
    expect(record.location).toEqual({ kind: 'case', caseId: 'HD-07', mode: 'applied' })
    expect(lastSectionId(record)).toBeNull()
    expect(record.visitedSectionIds).toEqual(['why-measure'])
    expect(record.openedCaseIds).toEqual(['HD-07'])
  })

  it('holds no answers, scores, attempts or hints', () => {
    const record = withCaseOpened(
      withSectionReviewed(
        withSectionVisited(createEmptySelfPacedRecord(), 'pressure-system'),
        'pressure-system',
        true,
      ),
      'HD-01',
      'practice',
    )
    expect(Object.keys(record).sort()).toEqual([
      'location',
      'openedCaseIds',
      'reviewedSectionIds',
      'updatedAt',
      'version',
      'visitedSectionIds',
    ])
    expect(JSON.stringify(record)).not.toMatch(/score|attempt|hint|master|correct|choice|answer/i)
  })

  it('round-trips through storage and refuses any other shape', () => {
    const record = withSectionVisited(createEmptySelfPacedRecord(), 'pawp-capture', 't1')
    expect(writeSelfPacedRecord(record)).toBe(true)
    expect(readSelfPacedRecord()).toEqual(record)
    expect(parseSelfPacedRecord('{')).toBeNull()
    expect(parseSelfPacedRecord(JSON.stringify({ ...record, bestScore: 90 }))).toBeNull()
    expect(parseSelfPacedRecord(JSON.stringify({ ...record, version: 2 }))).toBeNull()
  })

  it('leaves an unreadable stored value in place and carries on with an empty record', () => {
    localStorage.setItem(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY, '{corrupt')
    expect(readSelfPacedRecord()).toEqual(createEmptySelfPacedRecord())
    expect(updateSelfPacedRecord((current) => withSectionVisited(current, 'why-measure'))).toBe(
      false,
    )
    expect(localStorage.getItem(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY)).toBe('{corrupt')
  })

  it('never touches a legacy record when it writes', () => {
    localStorage.setItem(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY, 'legacy-learn')
    localStorage.setItem(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY, 'legacy-progress')
    localStorage.setItem(ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY, 'legacy-v1')
    expect(updateSelfPacedRecord((current) => withSectionVisited(current, 'why-measure'))).toBe(
      true,
    )
    expect(localStorage.getItem(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY)).toBe('legacy-learn')
    expect(localStorage.getItem(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY)).toBe('legacy-progress')
    expect(localStorage.getItem(ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY)).toBe('legacy-v1')
  })

  it('reports a refused store without throwing', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    try {
      expect(updateSelfPacedRecord((current) => withSectionVisited(current, 'why-measure'))).toBe(
        false,
      )
    } finally {
      setItem.mockRestore()
    }
  })
})
