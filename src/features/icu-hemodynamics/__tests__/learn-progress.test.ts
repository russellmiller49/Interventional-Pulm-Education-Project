import {
  createEmptyLearnRecord,
  ICU_HEMODYNAMICS_LEARN_STORAGE_KEY,
  isSectionCompleted,
  parseLearnRecord,
  readLearnRecord,
  withSectionCompleted,
  withSectionVisited,
  writeLearnRecord,
} from '../engine/learnProgress'
import { ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY } from '../engine/progress'

describe('the Learn record', () => {
  beforeEach(() => localStorage.clear())

  it('lives under its own key, beside the case ledger', () => {
    expect(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY).not.toBe(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY)
    writeLearnRecord(withSectionCompleted(createEmptyLearnRecord(), 'why-measure'))
    expect(localStorage.getItem(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY)).toBeNull()
    expect(readLearnRecord().completedSectionIds).toEqual(['why-measure'])
  })

  it('records a completion once and the last section visited', () => {
    let record = createEmptyLearnRecord()
    record = withSectionCompleted(record, 'why-measure', '2026-09-05T00:00:00.000Z')
    record = withSectionCompleted(record, 'why-measure', '2026-09-05T00:01:00.000Z')
    record = withSectionVisited(record, 'pressure-system', '2026-09-05T00:02:00.000Z')
    expect(record.completedSectionIds).toEqual(['why-measure'])
    expect(record.lastSectionId).toBe('pressure-system')
    expect(isSectionCompleted(record, 'why-measure')).toBe(true)
    expect(isSectionCompleted(record, 'pressure-system')).toBe(false)
  })

  it('refuses a malformed record and starts empty', () => {
    expect(parseLearnRecord('not json')).toBeNull()
    expect(parseLearnRecord(JSON.stringify({ version: 2 }))).toBeNull()
    expect(parseLearnRecord(JSON.stringify({ version: 1, completedSectionIds: 'x' }))).toBeNull()
    localStorage.setItem(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY, '{')
    expect(readLearnRecord()).toEqual(createEmptyLearnRecord())
  })

  it('deduplicates a record that was written twice', () => {
    const parsed = parseLearnRecord(
      JSON.stringify({
        version: 1,
        completedSectionIds: ['a', 'a', 'b'],
        lastSectionId: null,
        updatedAt: 'now',
      }),
    )
    expect(parsed?.completedSectionIds).toEqual(['a', 'b'])
  })
})
