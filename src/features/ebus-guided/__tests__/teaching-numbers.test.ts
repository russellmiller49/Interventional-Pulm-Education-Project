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
      expect(text).toMatch(/may not apply to a patient at increased risk of aspiration/)
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
  })

  it('keys bleeding on first moves and gives the complication rate', () => {
    const recovery = lesson('complications-recovery')
    expect(copy('complications-recovery')).toContain(EBUS_NUMBERS.value('complication-rate'))
    const key = recovery.question.choices.find((choice) => choice.correct)!
    expect(key.text).toBe('Stop sampling and retract the needle fully into its sheath')
    expect(key.text).not.toMatch(/team|protocol|escalat/i)
  })

  // The owner's ruling of 2026-11-14 on the bleeding and desaturation first moves.
  describe('bleeding and desaturation after the owner ruling of 2026-11-14', () => {
    const recovery = lesson('complications-recovery')
    const text = copy('complications-recovery')
    const everything = [
      text,
      ...recovery.checklist,
      ...recovery.takeaways,
      recovery.worked.reasoning,
      recovery.sequence!.prompt,
      ...recovery.sequence!.steps.map((step) => step.text),
      recovery.sequence!.explanation,
      ...[recovery.question, recovery.observation, recovery.transfer].flatMap((item) => [
        item.prompt,
        ...item.choices.flatMap((choice) => [choice.text, choice.rationale]),
      ]),
    ].join(' ')

    it('retracts the needle first and never says the needle stays in', () => {
      expect(text).toMatch(/stop sampling and retract the needle completely into its sheath/)
      expect(recovery.sequence!.steps[0].text).toBe(
        'Stop sampling and retract the needle fully into its sheath',
      )
      expect(recovery.checklist[0]).toMatch(/retract the needle fully into its sheath/)
      expect(everything).not.toMatch(/needle in\b/i)
      expect(everything).not.toMatch(/scope stays/i)
    })

    it('keeps the scope at the site conditionally, and limits suction', () => {
      expect(text).toMatch(
        /whether to stay there depends on where the bleeding is, how brisk it is and how well the airway is controlled/,
      )
      expect(text).toMatch(/Suction as much as you need to see .* and no more/)
      expect(text).toMatch(/pulls a forming clot off the site/)
    })

    it('offers the local measures as choices, not as a fixed sequence', () => {
      expect(text).toMatch(/measures to pick from, not steps to work through in order/)
      expect(recovery.sequence!.explanation).toMatch(/Only the first step is fixed/)
      expect(recovery.sequence!.steps.map((step) => step.text).join(' ')).not.toMatch(
        /cold saline|bleeding side down/i,
      )
      // What the evidence is, and where it comes from.
      expect(text).toMatch(/expert practice with one published case behind it/)
      expect(text).toMatch(/Cold saline is widely used and little studied/)
      expect(text).toMatch(/comes from transbronchial lung biopsy/)
    })

    it('does not offer the ultrasound balloon as hemorrhage control', () => {
      expect(text).toMatch(/made for acoustic contact, not for hemostasis/)
      expect(everything).not.toMatch(/or the inflated balloon|scope tip or the balloon/)
      const balloon = recovery.question.choices.find((choice) => /balloon/i.test(choice.text))!
      expect(balloon.correct).toBeFalsy()
    })

    it('calls for help early and protects the lung that is not bleeding', () => {
      expect(text).toMatch(/call for help early, before the local measures have run out/)
      expect(text).toMatch(/Protect the lung that is not bleeding/)
      expect(text).toMatch(/bronchial blocker/)
      expect(text).toMatch(/rigid or therapeutic bronchoscopy/)
    })

    it('keeps desaturation a separate response, with no saturation number to wait for', () => {
      const desaturation = recovery.paragraphs.find((entry) => /A falling saturation/.test(entry))!
      expect(desaturation).toMatch(/a different problem/)
      for (const cause of [
        /airway open/,
        /chest moving/,
        /scope itself obstructing/,
        /sedation slowed the breathing/,
        /blood or secretion/,
      ])
        expect(desaturation).toMatch(cause)
      expect(desaturation).toMatch(/not when the monitor reaches a set number/)
      expect(desaturation).not.toMatch(/\d/)
      expect(desaturation).toMatch(
        /withdraw the scope, unless you need it to clear blood from the airway/,
      )
      expect(desaturation).toMatch(/airway management and assisted ventilation first/)
      expect(everything).not.toMatch(/100% oxygen/)
    })

    it('cites published sources that exist in the registry', () => {
      const registered = new Set<string>(SOURCES.map((source) => source.id))
      for (const id of recovery.sources) expect(registered.has(id)).toBe(true)
      expect(recovery.sources).toEqual(
        expect.arrayContaining([
          'ics2023',
          'aquire2013',
          'asano2013',
          'bernasconi2017',
          'sabath2020',
        ]),
      )
    })
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
