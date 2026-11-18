import { teachingNumberErrors } from '@/features/learning-module/numbers/teachingNumbers'

import { CONTENT_LESSONS } from '../content/curriculum'
import { FEATURE_TABS } from '../content/node-features'
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
      // The atlas panel for size carries the same point beside the images.
      const sizeTab = FEATURE_TABS.find((tab) => tab.id === 'size-shape')!
      expect(sizeTab.meaning).toMatch(/does not decide whether a node is sampled/)
      expect(sizeTab.meaning).toMatch(/a small node can still contain metastasis/)
    })

    it('puts the CHEST recommendation and the AABIP minimum standard side by side', () => {
      const text = copy('adequacy-rose')
      expect(text).toMatch(/2024 CHEST guideline recommends at least 4 needle passes/)
      expect(text).toMatch(/2025 AABIP guideline sets at least three passes, or ROSE/)
      expect(text).toMatch(/in practice this means at least three, and often four or more/)
      expect(text).toMatch(/minimum standard for systematic staging/)
      // CHEST 2016 is history, and a diagnostic count is not a molecular one.
      expect(text).toMatch(
        /CHEST 2016 guideline suggested at least three passes when ROSE was not available/,
      )
      expect(text).toMatch(/not always enough for molecular testing/)
      // The needle-gauge sentence that follows names its guideline, now that three are in play.
      expect(text).toMatch(/2024 CHEST guideline also suggests a 21G or 22G/)
      expect(text).not.toMatch(/The same guideline/)
      expect(lesson('adequacy-rose').sources).toEqual(
        expect.arrayContaining(['chest2024', 'aabip2025', 'chest2016']),
      )
    })

    // Owner ruling r2-554-approve (2026-11-15): keep ICS/IAB's at least 10, as technique.
    it('teaches at least 10 needle movements as a practice point, not as proof of adequacy', () => {
      const text = copy('needle-safety')
      expect(text).toMatch(
        /move the needle back and forth at least 10 times on each pass, which ICS\/IAB 2023 recommends as a usual practice point/,
      )
      expect(text).toMatch(/CHEST 2016 describes a pass as typically 5 to 15 movements/)
      expect(text).toMatch(/a recommendation about technique, not proof of an adequate specimen/)
      expect(text).toMatch(
        /Adequacy depends on the material you obtain and on what the sample is for/,
      )
      expect(text).not.toMatch(/several times on each pass/)
      expect(row('agitations-per-pass').note).toMatch(/recommends at least 10 agitations per pass/)
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
      // The takeaway no longer asks the fellow to memorise an interval.
      const takeaways = lesson('preparation').takeaways.join(' ')
      expect(takeaways).toMatch(/not from a fixed interval/)
      expect(takeaways).not.toMatch(/Know the antiplatelet intervals/)
    })

    it('gives the registry rates as rates of the whole procedure', () => {
      const text = copy('complications-recovery')
      expect(text).toContain(EBUS_NUMBERS.value('complication-rate'))
      expect(text).toContain(EBUS_NUMBERS.value('pneumothorax-rate'))
      expect(text).toMatch(/1,317 patients at six hospitals/)
      expect(text).toMatch(/not for the needle aspiration alone/)
      expect(text).toMatch(/Transbronchial lung biopsy was the only risk factor/)
      for (const id of ['complication-rate', 'pneumothorax-rate'] as const)
        expect(row(id).appliesTo).toMatch(/1,317 patients at 6 hospitals/)
    })

    it('takes the fasting intervals from anesthesia guidance, with the patients they are written for', () => {
      const text = copy('preparation')
      expect(EBUS_NUMBERS.value('fasting-solids')).toBe(
        'at least 6 hours after a light meal, and typically 8 hours or more after fried or fatty food or meat',
      )
      expect(EBUS_NUMBERS.value('fasting-clear-fluids')).toBe('2 hours')
      expect(cites('fasting-solids')).toEqual(['asa2017'])
      expect(cites('fasting-clear-fluids')).toContain('asa2017')
      expect(row('fasting-solids').appliesTo).toMatch(
        /^Healthy patients having an elective procedure/,
      )
      expect(text).toMatch(/healthy patients having an elective procedure/)
      // Owner ruling r2-554-fasting (2026-11-15): individual assessment, not an automatic longer fast.
      expect(text).toMatch(/significant uncontrolled gastroesophageal reflux/)
      expect(text).not.toMatch(/gastric emptying, reflux,/)
      expect(text).toMatch(/reasons to look closer, not automatic reasons for a longer fast/)
      expect(text).toMatch(/needs an anesthesia and procedural plan made for them/)
      expect(text).toMatch(/a longer fast alone may not remove the risk/)
      // BTS 2013's 4 hours is no longer the default taught for EBUS.
      expect(text).not.toMatch(/4 hours/)
      expect(lesson('preparation').sources).toContain('asa2017')
    })

    // Owner ruling r2-554-glp1 (2026-11-15): add, with a source, and never as a blanket rule.
    it('asks about GLP-1 receptor agonists, with the multisociety guidance as its source', () => {
      const text = copy('preparation')
      expect(text).toMatch(/Ask about GLP-1 receptor agonists, which can delay gastric emptying/)
      expect(text).toMatch(
        /A recent dose increase, or nausea, vomiting or abdominal symptoms, raises the risk/,
      )
      expect(text).toMatch(/may change the diet beforehand or the anesthesia plan/)
      expect(text).toMatch(/many continue the drug, and a longer fast is not automatic/)
      expect(text).not.toMatch(/stop (the|every|all) GLP-1|must (stop|hold)/i)
      expect(lesson('preparation').sources).toContain('glp1-multisociety2024')
      const source = SOURCES.find((entry) => entry.id === 'glp1-multisociety2024')!
      expect(source.title).toMatch(/Kindel TL, Wang AY, Wadhwa A/)
      expect(source.url).toBe('https://doi.org/10.1007/s00464-024-11263-2')
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
