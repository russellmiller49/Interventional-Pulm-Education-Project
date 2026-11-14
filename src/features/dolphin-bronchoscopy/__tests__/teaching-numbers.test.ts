import { unsignedTeachingNumbers } from '@/features/learning-module/numbers/teachingNumbers'

import { DOLPHIN_NUMBERS, dolphinNumberErrors } from '../content/teachingNumbers'

describe('the numbers register', () => {
  it('names a class, a source, a year and a locator for every row', () => {
    expect(dolphinNumberErrors()).toEqual([])
    expect(DOLPHIN_NUMBERS.moduleId).toBe('dolphin-bronchoscopy')
  })

  it('is listed for the owner’s sign-off and never claims a signature', () => {
    expect(unsignedTeachingNumbers(DOLPHIN_NUMBERS)).toHaveLength(DOLPHIN_NUMBERS.rows.length)
  })

  it('carries the NMMP lidocaine example and the corrected Tsang width', () => {
    expect(DOLPHIN_NUMBERS.value('lidocaine-max')).toBe('4 mg/kg')
    expect(DOLPHIN_NUMBERS.get('lidocaine-max').note).toMatch(
      /724 mg.*72\.4 mL of 1%.*36\.2 mL of 2%/,
    )
    expect(DOLPHIN_NUMBERS.value('nasopharynx-width')).toBe('4–5 cm across')
  })

  it('shows sources that differ side by side', () => {
    expect(DOLPHIN_NUMBERS.get('bal-volume-nmmp').note).toMatch(/Tsang/)
    expect(DOLPHIN_NUMBERS.get('bal-volume-tsang').note).toMatch(/NMMP/)
    expect(DOLPHIN_NUMBERS.get('midazolam-im-tsang').note).toMatch(/NMMP/)
  })
})
