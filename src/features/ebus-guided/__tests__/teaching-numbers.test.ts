import { teachingNumberErrors } from '@/features/learning-module/numbers/teachingNumbers'

import { LESSONS } from '../content/curriculum'
import { SOURCES } from '../content/sources'
import { EBUS_NUMBERS } from '../content/teachingNumbers'

const lesson = (id: string) => LESSONS.find((entry) => entry.id === id)!
const copy = (id: string) => lesson(id).paragraphs.join(' ')

describe('EBUS Guided teaching numbers', () => {
  it('traces every number to a registered source', () => {
    expect(teachingNumberErrors(EBUS_NUMBERS, new Set(SOURCES.map((source) => source.id)))).toEqual(
      [],
    )
  })

  it('teaches the antiplatelet intervals, the fasting interval and the scope size in preparation', () => {
    const text = copy('preparation')
    for (const id of [
      'aspirin-continue',
      'clopidogrel-accp',
      'clopidogrel-bts',
      'fasting-solids',
      'fasting-clear-fluids',
      'scope-tip-diameter',
    ] as const)
      expect(text).toContain(EBUS_NUMBERS.value(id))
    expect(text).not.toMatch(/avoid a universal hold interval/)
  })

  it('teaches agitations per pass, and passes per station with their grade', () => {
    expect(copy('needle-safety')).toContain(EBUS_NUMBERS.value('agitations-per-pass'))
    expect(copy('adequacy-rose')).toContain(EBUS_NUMBERS.value('passes-per-station'))
    expect(copy('adequacy-rose')).toMatch(/strong recommendation on very low certainty/)
  })

  it('keys bleeding on first moves and gives the complication rate', () => {
    const recovery = lesson('complications-recovery')
    expect(copy('complications-recovery')).toContain(EBUS_NUMBERS.value('complication-rate'))
    const key = recovery.question.choices.find((choice) => choice.correct)!
    expect(key.text).toMatch(/Retract the needle, keep the scope in/)
    expect(key.text).not.toMatch(/team|protocol|escalat/i)
  })

  it('leaves a boundary note only where the model has a real limit', () => {
    const withNote = LESSONS.filter((entry) => entry.boundary).map((entry) => entry.id)
    expect(withNote).toEqual([
      'acoustic-contact',
      'contact-cutaway-model',
      'image-depth',
      'gain-contrast',
      'measurement-phantoms',
      'node-characterization',
      'eus-b-route-model',
      'needle-assembly-model',
    ])
  })
})
