/** @jest-environment node */
import { dolphinLearnerCopyErrors } from '../content/learnerCopy'
import {
  DOLPHIN_SCOPE_COMPARISON_NUMBERS,
  DOLPHIN_SCOPE_FEATURES,
  DOLPHIN_SCOPE_ROWS,
  DOLPHIN_SCOPE_SOURCE_NOTE,
} from '../content/scopeComparison'
import { DOLPHIN_NUMBERS } from '../content/teachingNumbers'

describe('the two scopes side by side', () => {
  const cited = DOLPHIN_SCOPE_COMPARISON_NUMBERS.map(
    (id) => DOLPHIN_NUMBERS.rows.find((row) => row.id === id)?.value ?? '',
  ).join(' ')

  it('states only numbers its register rows give', () => {
    for (const row of DOLPHIN_SCOPE_ROWS) {
      for (const text of [row.bronchoscope, row.gastroscope]) {
        // The slide years name sources, not values.
        const values = (text.match(/\d+(\.\d+)?/g) ?? []).filter((n) => n !== '2024')
        for (const value of values) expect(cited).toContain(value)
      }
    }
  })

  it('passes every line through the learner-copy gate', () => {
    const lines = [
      DOLPHIN_SCOPE_SOURCE_NOTE,
      ...DOLPHIN_SCOPE_FEATURES.flatMap((f) => [f.label, f.bronchoscope, f.gastroscope]),
      ...DOLPHIN_SCOPE_ROWS.flatMap((r) => [r.label, r.bronchoscope, r.gastroscope]),
    ]
    for (const line of lines) expect(dolphinLearnerCopyErrors('scope comparison', line)).toEqual([])
  })
})
