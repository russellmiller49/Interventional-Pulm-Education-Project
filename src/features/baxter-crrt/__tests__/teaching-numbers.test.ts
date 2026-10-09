import { teachingNumberErrors } from '../../learning-module/numbers/teachingNumbers'
import { crrtSimulatedAlertLabel } from '../content/alertLabels'
import { crrtPressureSignalDetails } from '../content/circuitModel'
import { baxterCrrtLearnLessonById } from '../content/learnLessons'
import { baxterCrrtLearnerFacingSourceById } from '../content/learnerSourceMap'
import { CRRT_NUMBER_ONLY_SOURCES, CRRT_NUMBERS } from '../content/teachingNumbers'

/**
 * docs/teaching-first-rules.md: a number a decision depends on is taught, and the module's
 * register records its class, source and check date. These replace the tests that required a
 * hedge in its place.
 */
describe('CRRT teaching numbers', () => {
  it('gives every registered number a class, a resolvable source and a check date', () => {
    const ids = new Set<string>([
      ...baxterCrrtLearnerFacingSourceById.keys(),
      ...CRRT_NUMBER_ONLY_SOURCES.map((source) => source.id),
    ])
    expect(teachingNumberErrors(CRRT_NUMBERS, ids)).toEqual([])
  })

  it('states the citrate targets in the anticoagulation lesson', () => {
    const lesson = baxterCrrtLearnLessonById.get('crrt-anticoagulation')!
    const paragraphs = (lesson.paragraphs ?? []).join(' ')
    expect(paragraphs).toContain(CRRT_NUMBERS.value('postfilter-ica'))
    expect(paragraphs).toContain(CRRT_NUMBERS.value('calcium-ratio'))
  })

  it('gives every pressure signal concrete first moves', () => {
    expect(crrtPressureSignalDetails.length).toBeGreaterThan(0)
    for (const detail of crrtPressureSignalDetails) {
      expect({ signal: detail.id, text: detail.firstInspectionBoundary }).not.toEqual({
        signal: detail.id,
        text: expect.stringMatching(/hand the decision|responsible clinical team/i),
      })
      expect(detail.firstInspectionBoundary.length).toBeGreaterThanOrEqual(80)
    }
  })

  it('names the access-obstruction alert as the PrisMax alarm', () => {
    expect(crrtSimulatedAlertLabel('ACCESS_OBSTRUCTION')).toBe('Access Extremely Negative alarm')
  })

  it('registers the rows the teaching-first case copy quotes', () => {
    const ids = CRRT_NUMBERS.rows.map((row) => row.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(
      expect.arrayContaining([
        'postfilter-ica-ceiling',
        'systemic-ica',
        'citrate-monitoring',
        'blood-flow-range',
        'liberation-urine-output',
        'gain-loss-window',
        'blood-leak-normalization-floor',
      ]),
    )
    for (const row of CRRT_NUMBERS.rows) {
      expect({ id: row.id, value: row.value.trim().length > 0 }).toEqual({
        id: row.id,
        value: true,
      })
      expect({ id: row.id, digit: /\d/.test(row.value) }).toEqual({ id: row.id, digit: true })
      expect({ id: row.id, checkedOn: row.checkedOn }).toEqual({
        id: row.id,
        checkedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      })
      expect({ id: row.id, checkedBy: row.checkedBy.length > 0 }).toEqual({
        id: row.id,
        checkedBy: true,
      })
      // A signature and its date arrive together; an unsigned row carries neither.
      expect({ id: row.id, signed: row.signedBy === null }).toEqual({
        id: row.id,
        signed: row.signedOn === null,
      })
      // The value a surface interpolates is the row's own value, never a restatement.
      expect(CRRT_NUMBERS.value(row.id)).toBe(row.value)
    }
  })

  it('classes the new rows by where the number comes from', () => {
    const classOf = (id: (typeof CRRT_NUMBERS.rows)[number]['id']) => CRRT_NUMBERS.get(id).class
    for (const id of ['gain-loss-window', 'blood-leak-normalization-floor'] as const) {
      expect(classOf(id)).toBe('device')
      // Device rows cite the PrisMax operator's manual records already in the source map.
      for (const citation of CRRT_NUMBERS.get(id).sources) {
        expect(baxterCrrtLearnerFacingSourceById.has(citation.sourceId)).toBe(true)
        expect(citation.year).toBe(2019)
      }
    }
    for (const id of [
      'postfilter-ica-ceiling',
      'systemic-ica',
      'citrate-monitoring',
      'blood-flow-range',
      'liberation-urine-output',
    ] as const) {
      expect(classOf(id)).toBe('expert-reference')
    }
  })

  it('lists exactly the number-only sources the rows cite, each outside the source map', () => {
    expect(CRRT_NUMBER_ONLY_SOURCES.map((source) => source.id)).toEqual([
      'TEXT-ACUTE-NEPHROLOGY-2015',
      'TEXT-CLINICAL-HANDBOOK-NEPHROLOGY-2024',
      'TEXT-BRENNER-RECTOR-12E-CH64',
    ])
    const cited = new Set(
      CRRT_NUMBERS.rows.flatMap((row) => row.sources.map((citation) => citation.sourceId)),
    )
    for (const source of CRRT_NUMBER_ONLY_SOURCES) {
      // No orphan entry, no duplicate of a record the source map already holds, and a full title.
      expect({ id: source.id, cited: cited.has(source.id) }).toEqual({ id: source.id, cited: true })
      expect(baxterCrrtLearnerFacingSourceById.has(source.id)).toBe(false)
      expect(source.title).toMatch(/\b(19|20)\d{2}\b/)
    }
    const citedBy = (sourceId: string) =>
      CRRT_NUMBERS.rows
        .filter((row) => row.sources.some((citation) => citation.sourceId === sourceId))
        .map((row) => row.id)
    expect(citedBy('TEXT-BRENNER-RECTOR-12E-CH64')).toEqual(['postfilter-ica-ceiling'])
    expect(citedBy('TEXT-CLINICAL-HANDBOOK-NEPHROLOGY-2024')).toEqual([
      'systemic-ica',
      'citrate-monitoring',
      'blood-flow-range',
    ])
    // A citation's year is the year its number-only source was published.
    for (const row of CRRT_NUMBERS.rows) {
      for (const citation of row.sources) {
        const source = CRRT_NUMBER_ONLY_SOURCES.find(({ id }) => id === citation.sourceId)
        if (source) expect(source.title).toContain(String(citation.year))
      }
    }
  })

  it('keeps both post-filter calcium targets, since the two texts differ', () => {
    const band = CRRT_NUMBERS.get('postfilter-ica')
    const ceiling = CRRT_NUMBERS.get('postfilter-ica-ceiling')
    expect(band.value).not.toBe(ceiling.value)
    expect(band.sources[0].sourceId).not.toBe(ceiling.sources[0].sourceId)
    expect(ceiling.note).toContain(band.value)
  })
})
