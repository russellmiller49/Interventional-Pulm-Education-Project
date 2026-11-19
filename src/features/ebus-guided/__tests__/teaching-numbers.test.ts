import { teachingNumberErrors } from '@/features/learning-module/numbers/teachingNumbers'

import { CONTENT_LESSONS, LESSONS } from '../content/curriculum'
import { FEATURE_TABS } from '../content/node-features'
import { SOURCES } from '../content/sources'
import { activitiesForLesson } from '../content/stage'
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
      expect(text).toMatch(
        /the older CHEST 2016 guideline describes a pass as typically 5 to 15 movements/,
      )
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
      expect(text).toMatch(/call for an individual assessment, not automatically a longer fast/)
      expect(text).toMatch(/and other aspiration risks/)
      expect(text).toMatch(/settle the anesthesia and procedural plan for that patient beforehand/)
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
      expect(text).toMatch(
        /the drug may be continued when the risk is not elevated, and neither stopping it nor a longer fast is automatic/,
      )
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
    expect(key.text).toBe('Stop sampling and retract the needle completely into its sheath')
    expect(key.text).not.toMatch(/team|protocol|escalat/i)
  })

  /*
   * Bleeding and desaturation: the owner's rulings of 2026-11-14 (`ebus-bleeding-sequence-source`)
   * and of 2026-11-15 (`r2-558-approve`, `r2-558-beyond`, `r2-558-split`).
   */
  describe('bleeding and desaturation after the owner rulings of 2026-11-14 and 2026-11-15', () => {
    const bleeding = lesson('complications-recovery')
    const desaturation = lesson('desaturation-response')
    const host = LESSONS.find((entry) => entry.id === 'complications-recovery')!
    const flow = activitiesForLesson(host)
    const said = (unit: typeof bleeding) =>
      [
        ...unit.paragraphs,
        ...unit.checklist,
        ...unit.takeaways,
        unit.worked.context,
        unit.worked.reasoning,
        unit.sequence!.prompt,
        ...unit.sequence!.steps.map((step) => step.text),
        unit.sequence!.explanation,
        ...[unit.question, unit.observation, unit.transfer].flatMap((item) => [
          item.prompt,
          ...item.choices.flatMap((choice) => [choice.text, choice.rationale]),
        ]),
      ].join(' ')
    const text = copy('complications-recovery')
    const breath = copy('desaturation-response')
    const everything = said(bleeding) + ' ' + said(desaturation)
    const keyOf = (item: typeof bleeding.question) => item.choices.find((choice) => choice.correct)!

    it('gives bleeding and desaturation a screen, a task and a decision each (r2-558-split)', () => {
      expect(host.parts?.map((unit) => unit.id)).toEqual([
        'complications-recovery',
        'desaturation-response',
      ])
      expect(
        flow.map((step) => [step.lessonId, step.kind, step.interaction, step.questions]),
      ).toEqual([
        ['complications-recovery', 'prediction', 'questions', ['question']],
        ['complications-recovery', 'briefing', 'read', []],
        ['complications-recovery', 'application', 'sequence', ['observation']],
        ['desaturation-response', 'briefing', 'read', []],
        ['desaturation-response', 'application', 'sequence', ['question']],
        // The closing question is drawn from the unit whose screen holds the after-procedure teaching.
        ['desaturation-response', 'transfer', 'questions', ['transfer']],
      ])
      // The bleeding screen holds no desaturation teaching, and the other way round.
      expect(text).not.toMatch(/A falling saturation/)
      expect(breath).not.toMatch(/puncture site|wedged|cold saline/i)
      // One lesson in the course map, as before: marks and navigation count lessons, not units.
      expect(LESSONS).toHaveLength(23)
    })

    it('retracts the needle first and never says the needle stays in', () => {
      expect(text).toMatch(/stop sampling and retract the needle completely into its sheath/)
      expect(bleeding.sequence!.steps[0].text).toBe(
        'Stop sampling and retract the needle completely into its sheath',
      )
      expect(bleeding.checklist[0]).toMatch(/retract the needle completely into its sheath/)
      expect(keyOf(bleeding.question).text).toBe(
        'Stop sampling and retract the needle completely into its sheath',
      )
      expect(everything).not.toMatch(/needle in[,;]/i)
      expect(everything).not.toMatch(/scope stays/i)
    })

    it('takes the needle assembly out for suction only after complete retraction (r2-558-beyond 1)', () => {
      expect(text).toMatch(
        /take the assembly out, but only after the needle is completely retracted, and handle it as the device instructions require/,
      )
    })

    it('keeps the scope at the site conditionally, and limits suction', () => {
      // Pressing is left to the paragraph that qualifies it (r2-558-approve 1).
      expect(text).not.toMatch(/lets you suction and press on it/)
      expect(text).toMatch(/Stay while you can see the source and the airway is secure/)
      expect(text).toMatch(/the airway comes before the view/)
      expect(text).toMatch(/Suction as much as you need to see .* and no more/)
      expect(text).toMatch(/suction can pull a forming clot off the site/)
    })

    it('offers the local measures as options that depend on the bleeding and the patient (r2-558-approve 4)', () => {
      expect(text).toMatch(
        /depends on the severity and site of the bleeding, the oxygenation and the patient’s condition/,
      )
      expect(text).toMatch(/These are options, not a sequence/)
      expect(bleeding.sequence!.explanation).toMatch(/a choice, not a list to work through/)
      expect(bleeding.sequence!.prompt).toMatch(/The steps overlap/)
      expect(desaturation.sequence!.prompt).toMatch(/The steps overlap/)
      expect(bleeding.sequence!.steps.map((step) => step.text).join(' ')).not.toMatch(
        /cold saline|bleeding side down/i,
      )
      expect(text).toMatch(/comes from transbronchial lung biopsy/)
      expect(text).toMatch(/cannot be wedged/)
    })

    it('separates bronchoscope-tip pressure in the published case from transducer pressure (r2-558-approve 1)', () => {
      expect(text).toMatch(
        /Its published support is a single case, in which the tip of a flexible bronchoscope was held on the site/,
      )
      expect(text).toMatch(
        /Pressing with the EBUS transducer is operator practice, not an evidence-based or guideline-supported maneuver/,
      )
      expect(text).not.toMatch(/tip of the scope, the transducer end/)
      expect(text).toMatch(/made for acoustic contact/)
      expect(text).toMatch(/has not been shown to control bleeding: do not rely on it/)
    })

    it('names vasoconstrictors conditionally, with no drug or dose (r2-558-beyond 3)', () => {
      expect(text).toMatch(
        /A topical vasoconstrictor is sometimes added: the evidence is limited, and the agent and dose follow local protocol, not a universal recommendation/,
      )
      expect(everything).not.toMatch(/epinephrine|adrenaline|\bmg\b|\bmL\b|1:\d/i)
    })

    it('distinguishes a one-sided source from a central one, without an absolute (r2-558-approve 3, r2-558-beyond 2)', () => {
      expect(text).toMatch(/call for help early, before the local measures have run out/)
      expect(text).toMatch(/When the source is peripheral or on one side, protect the other lung/)
      expect(text).toMatch(/bronchial blocker/)
      expect(text).toMatch(
        /Selective lung isolation may not control a central source in the trachea or at the carina/,
      )
      expect(text).toMatch(/escalate early to therapeutic or rigid bronchoscopy/)
      expect(everything).not.toMatch(/no side to isolate/)
      expect(bleeding.sequence!.steps.map((step) => step.text).join(' ')).not.toMatch(/help/i)
      expect(keyOf(bleeding.question).rationale).toMatch(/call for help at the same time/)
    })

    it('asks the post-bleeding question again, as a check of its own (r2-558-beyond 4)', () => {
      expect(bleeding.observation.prompt).toMatch(/What do you do before any more sampling\?/)
      expect(keyOf(bleeding.observation).text).toBe(
        'Inspect the puncture site and both main bronchi',
      )
      // The screen teaches what the check asks.
      expect(text).toMatch(
        /When the bleeding has stopped, inspect the site and both main bronchi for clot before you decide whether more passes are worth taking/,
      )
    })

    it('recognizes desaturation from the patient, and looks for the cause while treating', () => {
      expect(breath).toMatch(/a different problem/)
      expect(breath).toMatch(/Recognize it from the patient as well as the monitor/)
      expect(breath).toMatch(/On supplemental oxygen the saturation falls late/)
      for (const cause of [
        /airway open/,
        /chest moving/,
        /scope itself obstructing/,
        /sedation slowed the breathing/,
        /blood, secretion or bronchospasm/,
      ])
        expect(breath).toMatch(cause)
      expect(breath).toMatch(/Give oxygen and support the airway while you find the cause/)
      expect(breath).toMatch(/not when the monitor reaches a set number/)
    })

    it('withdraws the scope promptly when the fall is significant or worsening (r2-558-approve 2)', () => {
      expect(breath).toMatch(
        /When the fall is significant or getting worse, withdraw the scope promptly if that is what it takes to ventilate the patient; do not sit through a long failed attempt at recovery with the scope in place/,
      )
      expect(breath).toMatch(/The main reason to keep it in is blood that only the scope can clear/)
      expect(breath).toMatch(/Call for help early, not after these measures have failed/)
      // What is published and what is practice (the owner's round-1 request).
      expect(breath).toMatch(/This response is expert practice: ICS\/IAB 2023 says only that/)
      expect(said(desaturation)).not.toMatch(/does not promptly return|Not recovering/)
      expect(said(desaturation)).not.toMatch(/if (it|recovery) (does not recover|is not prompt)/)
      expect(desaturation.checklist[2]).toBe(
        'Significant or worsening: withdraw the scope promptly when ventilation needs it.',
      )
      // No number anywhere in the desaturation response.
      const unitText = [
        ...desaturation.paragraphs.slice(0, 3),
        ...desaturation.checklist,
        desaturation.worked.context,
        desaturation.worked.reasoning,
        ...desaturation.sequence!.steps.map((step) => step.text),
        desaturation.question.prompt,
        ...desaturation.question.choices.flatMap((choice) => [choice.text, choice.rationale]),
      ]
      for (const surface of unitText) expect(surface.replace('ICS/IAB 2023', '')).not.toMatch(/\d/)
      expect(everything).not.toMatch(/100% oxygen/)
    })

    it('keys the desaturation decision on withdrawing the scope, not on waiting', () => {
      expect(desaturation.question.prompt).toMatch(/keeps falling after you stop/)
      expect(keyOf(desaturation.question).text).toBe(
        'Withdraw the scope, open the airway and ventilate with oxygen',
      )
      const wrong = desaturation.question.choices.filter((choice) => !choice.correct)
      expect(wrong.map((choice) => choice.text).join(' ')).toMatch(/set threshold/)
      expect(wrong.map((choice) => choice.text).join(' ')).toMatch(/as you would for bleeding/)
      expect(desaturation.sequence!.steps.map((step) => step.text)).toEqual([
        'Stop sampling, retract the needle and undo what set it off',
        'Give oxygen and support the airway while you find the cause',
        'Significant or worsening: withdraw the scope when ventilation needs it',
        'Escalate airway support until ventilation is restored',
      ])
    })

    it('keeps the after-procedure teaching before the closing question', () => {
      expect(breath).toMatch(/Complications can also present after the procedure/)
      expect(breath).toMatch(/mediastinitis, is uncommon but important/)
      expect(breath).toMatch(/reasons to be seen the same day/)
      expect(flow.at(-1)!.kind).toBe('transfer')
      expect(flow.at(-1)!.lessonId).toBe('desaturation-response')
      expect(desaturation.transfer.prompt).toMatch(/after discharge following EBUS/)
      // Its hint quotes the passage on that screen.
      expect(desaturation.paragraphs.join(' ')).toContain(desaturation.transfer.hint!)
    })

    it('cites published sources that exist in the registry, with exact citations', () => {
      const registered = new Map<string, string>(SOURCES.map((source) => [source.id, source.title]))
      for (const id of [...bleeding.sources, ...desaturation.sources])
        expect(registered.has(id)).toBe(true)
      expect(bleeding.sources).toEqual([
        'ics2023',
        'aquire2013',
        'asano2013',
        'bernasconi2017',
        'sabath2020',
        'davidson2020',
      ])
      expect(registered.get('sabath2020')).toMatch(/^Sabath BF\. /)
      expect(registered.get('ics2023')).toMatch(/Lung India 2023;40:368-400/)
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
