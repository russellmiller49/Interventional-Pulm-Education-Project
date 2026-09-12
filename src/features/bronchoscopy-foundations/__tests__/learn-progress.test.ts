import { BRONCH_SECTION_IDS } from '../content/pathway'
import {
  bronchSectionItems,
  capstoneAttemptKey,
  capstoneStageItems,
  sectionAttemptKey,
} from '../content/stageItems'
import {
  BRONCH_STORAGE_KEY,
  createEmptyBronchRecord,
  parseBronchRecord,
  readBronchRecord,
  withCapstoneDebriefViewed,
  withFirstAttempt,
  withSectionCompleted,
  withSectionVisited,
  writeBronchRecord,
} from '../engine/learnProgress'

const NOW = '2026-09-11T12:00:00.000Z'
const LEGACY_KEY = 'ip-intro-bronchoscopy-progress-v1'

/** The first section's prediction item: one keyed choice, and one that is not. */
function firstPrediction() {
  const sectionId = BRONCH_SECTION_IDS[0]
  const item = bronchSectionItems(sectionId).prediction.item
  const keyed = item.correctChoiceIds[0]
  const other = item.choices.find((choice) => choice.id !== keyed)!.id
  return { key: sectionAttemptKey(sectionId, item.id), item, keyed, other }
}

beforeEach(() => localStorage.clear())

describe('the module record', () => {
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

  it('writes a first attempt once and keeps the first decision', () => {
    const { key, keyed, other } = firstPrediction()
    const empty = createEmptyBronchRecord()
    const first = withFirstAttempt(empty, key, other, NOW)
    expect(first.firstAttempts[key]).toEqual({ choiceId: other, correct: false, at: NOW })
    const again = withFirstAttempt(first, key, keyed, NOW)
    expect(again).toBe(first)
    const held = withFirstAttempt(empty, key, keyed, NOW)
    expect(held.firstAttempts[key]).toEqual({ choiceId: keyed, correct: true, at: NOW })
    // Unknown item, unknown choice: nothing is written.
    expect(withFirstAttempt(empty, `${BRONCH_SECTION_IDS[0]}:nope`, 'a', NOW)).toBe(empty)
    expect(withFirstAttempt(empty, key, 'not-a-choice', NOW)).toBe(empty)
  })

  it('records visits, completions and the debrief without duplicates', () => {
    const [first] = BRONCH_SECTION_IDS
    let record = withSectionVisited(createEmptyBronchRecord(), first, NOW)
    expect(record.lastSectionId).toBe(first)
    record = withSectionCompleted(record, first, null, NOW)
    record = withSectionCompleted(record, first, null, NOW)
    expect(record.completedSectionIds).toEqual([first])
    const debriefed = withCapstoneDebriefViewed(record, NOW)
    expect(debriefed.capstoneDebriefViewedAt).toBe(NOW)
    expect(withCapstoneDebriefViewed(debriefed, '2027-01-01T00:00:00.000Z')).toBe(debriefed)
  })

  it('keeps the first performance summary of a section and ignores a later one', () => {
    const [first] = BRONCH_SECTION_IDS
    const assisted = { inputModes: ['keyboard'], assistsUsed: ['centerline'], unaided: false }
    const unaided = { inputModes: ['gamepad'], assistsUsed: [], unaided: true }
    let record = withSectionCompleted(createEmptyBronchRecord(), first, assisted, NOW)
    record = withSectionCompleted(record, first, unaided, NOW)
    expect(record.sectionPerformance[first]).toEqual(assisted)
  })

  it('round-trips through storage and never reads the earlier course’s record', () => {
    // The earlier course's booleans were hand toggles (A20): seeding them leaves this record empty.
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({ completed: Object.fromEntries(BRONCH_SECTION_IDS.map((id) => [id, true])) }),
    )
    expect(readBronchRecord()).toEqual(createEmptyBronchRecord())
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBeNull()

    const { key, other } = firstPrediction()
    const written = withFirstAttempt(
      withSectionCompleted(createEmptyBronchRecord(), BRONCH_SECTION_IDS[0], null, NOW),
      key,
      other,
      NOW,
    )
    expect(writeBronchRecord(written)).toBe(true)
    expect(readBronchRecord()).toEqual(written)
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull()
  })
})
