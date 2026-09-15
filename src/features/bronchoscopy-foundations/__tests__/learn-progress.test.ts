import { BRONCH_SECTION_IDS } from '../content/pathway'
import {
  bronchSectionItems,
  capstoneAttemptKey,
  capstoneStageItems,
  sectionAttemptKey,
} from '../content/stageItems'
import * as legacyModule from '../engine/learnProgress'
import {
  BRONCH_STORAGE_KEY,
  createEmptyBronchRecord,
  isSectionCompleted,
  parseBronchRecord,
  readBronchRecord,
} from '../engine/learnProgress'

const NOW = '2026-09-11T12:00:00.000Z'
const EARLIER_COURSE_KEY = 'ip-intro-bronchoscopy-progress-v1'

/** The first section's prediction item: one keyed choice, and one that is not. */
function firstPrediction() {
  const sectionId = BRONCH_SECTION_IDS[0]
  const item = bronchSectionItems(sectionId).prediction.item
  const keyed = item.correctChoiceIds[0]
  const other = item.choices.find((choice) => choice.id !== keyed)!.id
  return { key: sectionAttemptKey(sectionId, item.id), item, keyed, other }
}

beforeEach(() => localStorage.clear())

/**
 * BF-01 made this record read-only: the contract is now that it parses exactly as it was written,
 * is never rewritten, and has no writer at all. The self-paced record is tested in
 * `self-paced-progress.test.ts`.
 */
describe('the earlier module record, read-only', () => {
  it('refuses malformed storage, an unknown version and an extra key', () => {
    expect(parseBronchRecord('{')).toBeNull()
    expect(parseBronchRecord(null)).toBeNull()
    expect(parseBronchRecord(JSON.stringify({ version: 1 }))).toBeNull()
    const sound = createEmptyBronchRecord()
    expect(parseBronchRecord(JSON.stringify(sound))).toEqual(sound)
    expect(parseBronchRecord(JSON.stringify({ ...sound, version: 2 }))).toBeNull()
    expect(parseBronchRecord(JSON.stringify({ ...sound, extra: true }))).toBeNull()
  })

  it('recomputes correctness from the item bank and drops attempts on unknown items or choices', () => {
    const { key, other } = firstPrediction()
    const capstone = capstoneStageItems[0].item
    const parsed = parseBronchRecord(
      JSON.stringify({
        ...createEmptyBronchRecord(),
        completedSectionIds: [BRONCH_SECTION_IDS[0], BRONCH_SECTION_IDS[0]],
        firstAttempts: {
          // A tampered `correct: true` on a distractor parses back to false.
          [key]: { choiceId: other, correct: true, at: NOW },
          [sectionAttemptKey(BRONCH_SECTION_IDS[0], 'no-such-item')]: {
            choiceId: 'a',
            correct: true,
            at: NOW,
          },
          [capstoneAttemptKey(capstone.id)]: { choiceId: 'zz', correct: true, at: NOW },
        },
        updatedAt: NOW,
      }),
    )
    expect(parsed?.completedSectionIds).toEqual([BRONCH_SECTION_IDS[0]])
    expect(parsed?.firstAttempts[key]).toEqual({ choiceId: other, correct: false, at: NOW })
    expect(parsed?.firstAttempts[sectionAttemptKey(BRONCH_SECTION_IDS[0], 'no-such-item')]).toBe(
      undefined,
    )
    expect(parsed?.firstAttempts[capstoneAttemptKey(capstone.id)]).toBeUndefined()
  })

  it('reads a stored record without rewriting its bytes, and never reads the earlier course’s record', () => {
    // The earlier course's booleans were hand toggles (A20): seeding them leaves this record empty.
    localStorage.setItem(
      EARLIER_COURSE_KEY,
      JSON.stringify({ completed: Object.fromEntries(BRONCH_SECTION_IDS.map((id) => [id, true])) }),
    )
    expect(readBronchRecord()).toEqual(createEmptyBronchRecord())
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBeNull()

    const { key, other } = firstPrediction()
    const stored = JSON.stringify({
      ...createEmptyBronchRecord(),
      completedSectionIds: [BRONCH_SECTION_IDS[0]],
      firstAttempts: {
        [key]: { choiceId: other, correct: true, at: NOW, support: 'reviewed-teaching' },
      },
      updatedAt: NOW,
    })
    localStorage.setItem(BRONCH_STORAGE_KEY, stored)
    expect(readBronchRecord().firstAttempts[key]).toEqual({
      choiceId: other,
      correct: false,
      at: NOW,
      support: 'reviewed-teaching',
    })
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBe(stored)
    expect(localStorage.getItem(EARLIER_COURSE_KEY)).not.toBeNull()
  })

  it('keeps the lesson-version meaning of an earlier completion', () => {
    const unversioned = { ...createEmptyBronchRecord(), completedSectionIds: ['five-controls'] }
    expect(isSectionCompleted(unversioned, 'five-controls')).toBe(false)
    expect(
      isSectionCompleted(
        { ...unversioned, sectionVersions: { 'five-controls': 2 } },
        'five-controls',
      ),
    ).toBe(true)
    expect(
      isSectionCompleted(
        { ...createEmptyBronchRecord(), completedSectionIds: ['pre-use-check'] },
        'pre-use-check',
      ),
    ).toBe(true)
  })

  it('exports no writer of any kind', () => {
    expect(
      Object.keys(legacyModule).filter((name) => /^(with|write|save|record)/i.test(name)),
    ).toEqual([])
  })
})
