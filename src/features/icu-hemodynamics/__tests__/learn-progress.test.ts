import * as learnProgress from '../engine/learnProgress'
import { ICU_HEMODYNAMICS_LEARN_STORAGE_KEY, parseLearnRecord } from '../engine/learnProgress'
import { ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY } from '../engine/progress'
import { ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY } from '../engine/selfPacedProgress'

beforeEach(() => localStorage.clear())

/**
 * The legacy Learn record, read-only since HD-01. It used to record correctness-gated section
 * completion; the module no longer reads or writes it, and its bytes stay as a device left them.
 */
describe('the legacy Learn record', () => {
  it('keeps its own key, apart from the case ledger and the self-paced record', () => {
    expect(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY).toBe('icu-hemodynamics-learn-v1')
    expect(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY).not.toBe(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY)
    expect(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY).not.toBe(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY)
  })

  it('still recognises a stored record and deduplicates it in memory, without writing', () => {
    const raw = JSON.stringify({
      version: 1,
      completedSectionIds: ['pressure-system', 'pressure-system'],
      lastSectionId: 'pressure-system',
      updatedAt: '2026-09-01T00:00:00.000Z',
    })
    localStorage.setItem(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY, raw)
    expect(
      parseLearnRecord(localStorage.getItem(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY)),
    ).toMatchObject({
      completedSectionIds: ['pressure-system'],
    })
    expect(localStorage.getItem(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY)).toBe(raw)
  })

  it('refuses a malformed record', () => {
    expect(parseLearnRecord('{')).toBeNull()
    expect(parseLearnRecord(JSON.stringify({ version: 2 }))).toBeNull()
    expect(parseLearnRecord(null)).toBeNull()
  })

  it('exposes no reader or writer that touches storage', () => {
    for (const name of [
      'readLearnRecord',
      'writeLearnRecord',
      'withSectionCompleted',
      'withSectionVisited',
    ]) {
      expect(name in learnProgress).toBe(false)
    }
  })
})
