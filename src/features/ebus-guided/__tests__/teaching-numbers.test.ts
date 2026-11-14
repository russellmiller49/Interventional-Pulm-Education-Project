import { teachingNumberErrors } from '@/features/learning-module/numbers/teachingNumbers'

import { CONTENT_LESSONS } from '../content/curriculum'
import { SOURCES } from '../content/sources'
import { EBUS_NUMBERS } from '../content/teachingNumbers'

// Numbers and boundary notes belong to content units; five units now sit inside another lesson.
const lesson = (id: string) => CONTENT_LESSONS.find((entry) => entry.id === id)!
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

  // The owner's review of 2026-11-12: seven rows corrected or clarified, one replaced.
  describe('after the owner review of 2026-11-12', () => {
    const row = (id: Parameters<typeof EBUS_NUMBERS.get>[0]) => EBUS_NUMBERS.get(id)
    const cites = (id: Parameters<typeof EBUS_NUMBERS.get>[0]) =>
      row(id).sources.map((citation) => citation.sourceId)

    it('holds 26 rows and signs none of them', () => {
      expect(EBUS_NUMBERS.rows).toHaveLength(26)
      for (const entry of EBUS_NUMBERS.rows) {
        expect(entry.signedBy).toBeNull()
        expect(entry.signedOn).toBeNull()
      }
    })

    it('teaches node size as one feature, never as the size at which sampling starts', () => {
      const text = copy('node-characterization')
      expect(text).toContain(EBUS_NUMBERS.value('node-short-axis'))
      expect(text).toMatch(/not a size below which a node can be left unsampled/)
      expect(text).toMatch(/independently predicted metastasis; size did not/)
      expect(text).toMatch(/a small node can still contain metastasis/)
    })

    it('puts the CHEST recommendation and the AABIP minimum standard side by side', () => {
      const text = copy('adequacy-rose')
      expect(text).toMatch(/2024 CHEST guideline recommends at least 4 needle passes/)
      expect(text).toMatch(/2025 AABIP guideline sets at least three passes, or ROSE/)
      expect(text).toMatch(/minimum standard for systematic staging/)
      // CHEST 2016 is history, and a diagnostic count is not a molecular one.
      expect(text).toMatch(
        /CHEST 2016 guideline suggested at least three passes when ROSE was not available/,
      )
      expect(text).toMatch(/not always enough for molecular testing/)
      expect(lesson('adequacy-rose').sources).toEqual(
        expect.arrayContaining(['chest2024', 'aabip2025', 'chest2016']),
      )
    })

    it('teaches needle movements as a description and a practice point, not a required count', () => {
      const text = copy('needle-safety')
      expect(text).toMatch(/CHEST 2016 describes a pass as typically 5 to 15 movements/)
      expect(text).toMatch(/ICS\/IAB 2023 advises at least 10/)
      expect(text).toMatch(/neither sets a count you must reach/)
      expect(text).not.toMatch(/back and forth 5 to 15 times/)
    })

    it('ties each clopidogrel interval to its own procedure, and neither to EBUS-TBNA', () => {
      const text = copy('preparation')
      expect(text).toMatch(/no interval is a rule for EBUS-TBNA/)
      expect(text).toMatch(/stop 5 days before elective noncardiac surgery/)
      expect(text).toMatch(/stop 7 days before an endobronchial or transbronchial lung biopsy/)
      expect(text).toMatch(/risk of thrombosis outweighs the risk of bleeding/)
      expect(text).not.toMatch(/stop 5 days before a procedure|stop 7 days before a biopsy/)
      expect(row('clopidogrel-accp').appliesTo).toMatch(/Elective noncardiac surgery/)
      expect(row('clopidogrel-bts').appliesTo).toMatch(/Not a requirement for EBUS-TBNA/)
    })

    it('gives the registry rates as rates of the whole procedure', () => {
      const text = copy('complications-recovery')
      expect(text).toContain(EBUS_NUMBERS.value('complication-rate'))
      expect(text).toContain(EBUS_NUMBERS.value('pneumothorax-rate'))
      expect(text).toMatch(/1,317 patients at six hospitals/)
      expect(text).toMatch(/not for the needle aspiration alone/)
      expect(text).toMatch(/transbronchial lung biopsy was the only risk factor/)
      for (const id of ['complication-rate', 'pneumothorax-rate'] as const)
        expect(row(id).appliesTo).toMatch(/1,317 patients at 6 hospitals/)
    })

    it('takes the fasting intervals from anesthesia guidance, with the patients they are written for', () => {
      const text = copy('preparation')
      expect(EBUS_NUMBERS.value('fasting-solids')).toBe(
        'at least 6 hours after a light meal, and 8 hours or more after fried or fatty food or meat',
      )
      expect(EBUS_NUMBERS.value('fasting-clear-fluids')).toBe('2 hours')
      expect(cites('fasting-solids')).toEqual(['asa2017'])
      expect(cites('fasting-clear-fluids')).toContain('asa2017')
      expect(row('fasting-solids').appliesTo).toMatch(
        /^Healthy patients having an elective procedure/,
      )
      expect(text).toMatch(/healthy patients having an elective procedure/)
      expect(text).toMatch(/not written for a patient at increased risk of aspiration/)
      // BTS 2013's 4 hours is no longer the default taught for EBUS.
      expect(text).not.toMatch(/4 hours/)
      expect(lesson('preparation').sources).toContain('asa2017')
    })

    it('links the manufacturer page behind every scope figure, for both scope models', () => {
      for (const id of ['olympus-uc180f', 'olympus-uc190f'])
        expect(SOURCES.find((source) => source.id === id)!.url).toMatch(
          /^https:\/\/medical\.olympusamerica\.com\/products\//,
        )
      expect(EBUS_NUMBERS.get('scope-view-angle').appliesTo).toMatch(/BF-UC180F/)
      expect(EBUS_NUMBERS.get('scope-view-angle').note).toMatch(/BF-UC190F looks 20°/)
      for (const id of ['scope-tip-diameter', 'scope-insertion-tube', 'scope-channel'] as const)
        expect(row(id).appliesTo).toMatch(/BF-UC190F/)
    })

    it('says what was read for every row, and when', () => {
      for (const entry of EBUS_NUMBERS.rows) {
        expect(entry.checkedOn).toBe('2026-11-14')
        expect(entry.checkedBy).toMatch(/read|only/)
      }
    })
  })

  it('keys bleeding on first moves and gives the complication rate', () => {
    const recovery = lesson('complications-recovery')
    expect(copy('complications-recovery')).toContain(EBUS_NUMBERS.value('complication-rate'))
    const key = recovery.question.choices.find((choice) => choice.correct)!
    expect(key.text).toMatch(/Retract the needle, keep the scope in/)
    expect(key.text).not.toMatch(/team|protocol|escalat/i)
  })

  it('leaves a boundary note only where the model has a real limit', () => {
    const withNote = CONTENT_LESSONS.filter((entry) => entry.boundary).map((entry) => entry.id)
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
