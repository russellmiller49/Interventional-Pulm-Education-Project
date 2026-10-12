import {
  defineTeachingNumbers,
  teachingNumberCitationLine,
  teachingNumberErrors,
  unsignedTeachingNumbers,
  type TeachingNumberRow,
} from '../teachingNumbers'

const row = (overrides: Partial<TeachingNumberRow> = {}): TeachingNumberRow => ({
  label: 'Plateau pressure limit',
  value: '≤30 cmH₂O',
  class: 'guideline',
  sources: [{ sourceId: 'S1', year: 2017, grade: 'strong', locator: 'Recommendation 1' }],
  checkedOn: '2026-10-08',
  checkedBy: 'Claude, against the guideline text',
  signedBy: null,
  signedOn: null,
  ...overrides,
})

const SOURCES = new Set(['S1'])

describe('teaching numbers register', () => {
  it('returns the value a row renders and refuses an id it does not hold', () => {
    const register = defineTeachingNumbers('demo', { plateau: row() })
    expect(register.value('plateau')).toBe('≤30 cmH₂O')
    expect(() => register.get('missing' as 'plateau')).toThrow(/no teaching number "missing"/)
  })

  it('accepts a sourced row that the owner has not signed, and lists it for sign-off', () => {
    const register = defineTeachingNumbers('demo', {
      plateau: row(),
      signed: row({ signedBy: 'Russell Miller', signedOn: '2026-10-09' }),
    })
    expect(teachingNumberErrors(register, SOURCES)).toEqual([])
    expect(unsignedTeachingNumbers(register).map((entry) => entry.id)).toEqual(['plateau'])
  })

  it('refuses a guideline number with no source, an unregistered source, or no locator', () => {
    const register = defineTeachingNumbers('demo', {
      bare: row({ sources: [] }),
      unknown: row({ sources: [{ sourceId: 'S9', year: 2017, grade: null, locator: 'p. 4' }] }),
      vague: row({ sources: [{ sourceId: 'S1', year: 2017, grade: null, locator: ' ' }] }),
    })
    const errors = teachingNumberErrors(register, SOURCES).join('\n')
    expect(errors).toMatch(/"bare": a guideline number names its source/)
    expect(errors).toMatch(/"unknown": source "S9" is not in the module's registry/)
    expect(errors).toMatch(/"vague": source "S1" has no locator/)
  })

  it('lets a teaching convention stand without a source when its note says what it is', () => {
    const silent = defineTeachingNumbers('demo', {
      round: row({ class: 'teaching-convention', sources: [] }),
    })
    expect(teachingNumberErrors(silent, SOURCES)).toHaveLength(1)
    const explained = defineTeachingNumbers('demo', {
      round: row({ class: 'teaching-convention', sources: [], note: 'A round figure.' }),
    })
    expect(teachingNumberErrors(explained, SOURCES)).toEqual([])
  })

  it('refuses half a signature', () => {
    const register = defineTeachingNumbers('demo', {
      half: row({ signedBy: 'Russell Miller', signedOn: null }),
    })
    expect(teachingNumberErrors(register, SOURCES).join('\n')).toMatch(/set together/)
  })

  it('prints one citation line per row', () => {
    expect(teachingNumberCitationLine(row(), () => 'ATS/ESICM/SCCM')).toBe(
      'ATS/ESICM/SCCM (2017, strong; Recommendation 1)',
    )
  })
})
