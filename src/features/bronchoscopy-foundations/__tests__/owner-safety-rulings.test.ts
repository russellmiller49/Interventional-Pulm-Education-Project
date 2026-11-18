import { CAPSTONE_CASES } from '../content/capstone'
import { COURSE_FLOWS } from '../content/courseFlow'
import { NUMBER_REGISTER, resolveNumbers } from '../content/numbers'
import { BRONCH_SECTIONS } from '../content/sections'
import { section as bleeding } from '../content/sections/bleeding-priorities'
import { section as clinicalQuestion } from '../content/sections/clinical-question'
import { section as deterioration } from '../content/sections/deterioration'
import { section as sedation } from '../content/sections/sedation-and-monitoring'
import type { AuthoredChoice, BronchSectionDefinition } from '../content/types'
import { VIGNETTES } from '../content/vignettes'

/**
 * The owner's safety rulings of 2026-11-13 on Sections 1, 3, 13 and the bleeding card, and on the
 * vignettes and integrated cases that keyed the superseded teaching. Section 15 has its own file
 * (`ventilated-patient-teaching.test.ts`). Each test names the ruling it holds in place.
 */
const block = (section: BronchSectionDefinition, id: string) => {
  const found = section.blocks.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`No block ${id} in ${section.id}`)
  return found
}
const words = (section: BronchSectionDefinition, id: string) => {
  const found = block(section, id)
  return [
    found.body,
    ...(found.points ?? []),
    ...(found.steps ?? []),
    found.callForHelp ?? '',
  ].join(' ')
}
const keyOf = (choices: readonly AuthoredChoice[]) =>
  choices.find((choice) => choice.plausibility === 'best')!
const frames = (section: BronchSectionDefinition, act: 'act' | string) => {
  const found = act === 'act' ? section.act : section.moreActs?.[act]
  if (!found || found.kind !== 'scenario') throw new Error(`No scenario ${act}`)
  return found.scenario.frames
}
const vignette = (id: string) => VIGNETTES.find((entry) => entry.id === `vg-${id}`)!
const integrated = (id: string) => CAPSTONE_CASES.find((entry) => entry.id === id)!

describe('Section 13, the eight first-move cards (bf-s13-deterioration)', () => {
  it('acts on a patient who is clearly worse, without waiting for a number [8]', () => {
    const opening = block(deterioration, 'opening-bundle').body
    expect(opening).toMatch(/Act as soon as the patient is clearly worse/)
    expect(opening).toMatch(/Do not wait for a number/)
    expect(opening).toMatch(/latest point, not the signal/)
  })

  it('keeps propofol, a relaxant and a tube for laryngospasm that persists [1]', () => {
    const card = block(deterioration, 'laryngospasm')
    expect(card.steps?.[0]).toMatch(/Stop stimulating\. Withdraw the scope above the cords/)
    expect(card.steps?.slice(1, 3).join(' ')).toMatch(
      /oxygen with a jaw thrust.*positive pressure by mask/,
    )
    expect(card.steps?.[3]).toMatch(
      /^Persistent or severe: propofol\. Still closed: a muscle relaxant and a tube/,
    )
    expect(card.callForHelp).toMatch(/^early, for anesthesia/)
    expect(words(deterioration, 'laryngospasm')).not.toMatch(/Not breaking: propofol/)
  })

  it('names albuterol first and escalates severe bronchospasm [2]', () => {
    const steps = (block(deterioration, 'bronchospasm').steps ?? []).join(' ')
    expect(steps).toMatch(/Stop instilling and suctioning\. Withdraw to the trachea/)
    expect(steps).toMatch(/Turn the oxygen up/)
    expect(steps).toMatch(/Give albuterol/)
    expect(steps).toMatch(/Severe or not easing: scope out, more albuterol, get help/)
  })

  it('ventilates first and reverses by the drug given, never both by routine [3]', () => {
    const steps = block(deterioration, 'oversedation').steps ?? []
    expect(steps[2]).toMatch(/ventilate by bag and mask/)
    expect(steps[3]).toMatch(
      /Reverse the drug given: naloxone for an opioid, flumazenil for a benzodiazepine/,
    )
    expect(steps[3]).toMatch(/Never both by routine/)
  })

  it('treats hypotension by its cause, not by a fixed fluid-then-vasopressor order [4]', () => {
    const steps = (block(deterioration, 'hypotension').steps ?? []).join(' ')
    expect(steps).toMatch(/Find the cause: sedation, bleeding, tension pneumothorax, arrhythmia/)
    expect(steps).toMatch(/Treat the cause\. Add fluid, a vasopressor or both as it requires/)
    expect(steps).not.toMatch(/Still low: give a vasopressor/)
  })

  it('images a pneumothorax first only when the whole patient allows it [5]', () => {
    const steps = block(deterioration, 'pneumothorax').steps ?? []
    expect(steps[2]).toBe('Talking, pressure holding, not worsening: image now, keep watching.')
    expect(steps[3]).toMatch(
      /Severe distress with a falling pressure or saturation: suspect tension, decompress first/,
    )
    // The decompression site is unchanged: the owner chose it on 2026-11-12.
    expect(steps[4]).toMatch(
      /fifth intercostal space in the mid-axillary line, or second in the midclavicular/,
    )
  })

  it('keeps the toxicity card: stop, help, the checklist [6]', () => {
    const card = block(deterioration, 'anesthetic-toxicity')
    const steps = (card.steps ?? []).join(' ')
    expect(steps).toMatch(/Stop the lidocaine/)
    expect(steps).toMatch(/toxicity kit and checklist/)
    expect(steps).toMatch(/Lipid emulsion, as the checklist directs/)
    expect(card.callForHelp).toMatch(/at the first sign, before a seizure/)
    // Rescue drugs stay named, with no dose (owner decision of 2026-10-10).
    expect(steps).not.toMatch(/\d\s?(mg|mL|mcg)/)
  })

  it('judges methemoglobinemia on co-oximetry and the patient together [7]', () => {
    const steps = block(deterioration, 'methemoglobinemia').steps ?? []
    expect(steps[2]).toMatch(/co-oximetry: the oximeter cannot give the level/)
    expect(steps[3]).toMatch(/^Level and patient decide/)
    expect(steps[3]).toMatch(
      /usually at .* with symptoms, .* without, sooner with heart or lung disease/,
    )
  })

  it('keys imaging first in C08 on the whole patient, not on the pressure alone', () => {
    const c08 = deterioration.practice.find((entry) => entry.id === 'C08')!
    expect(keyOf(c08.item.choices).label).toMatch(/ultrasound or chest radiograph now/)
    expect(keyOf(c08.item.choices).rationale).toMatch(
      /talking and not in distress, with an adequate pressure and saturation/,
    )
    expect(c08.item.explanation).toMatch(/Image first only when the whole patient allows it/)
    expect(c08.item.explanation).toMatch(/A normal pressure alone is not stability/)
  })

  it('keeps the four keyed decisions of the case', () => {
    expect(frames(deterioration, 'act').map((frame) => keyOf(frame.choices).label)).toEqual([
      'Withdraw to the trachea, turn the oxygen up and give albuterol',
      'Scope out, high-flow oxygen, and ultrasound to the right chest',
      'Decompress the right chest now',
      'End the procedure and have a chest drain placed',
    ])
  })
})

describe('Section 3, sedation and topical anesthesia (bf-s03-sedation)', () => {
  it('offers the topical techniques by route, on one running total', () => {
    const topical = block(sedation, 'topical')
    expect(topical.heading).not.toMatch(/three places/)
    const points = (topical.points ?? []).join(' ')
    expect(points).toMatch(/Nasal approach: gel to the nose, and throat spray if needed/)
    expect(points).toMatch(/Oral approach: lidocaine spray to the throat/)
    expect(points).toMatch(/Every site adds to one running total/)
  })

  it('separates toxicity and methemoglobinemia from oversedation', () => {
    const signs = (block(sedation, 'toxicity').points ?? []).join(' ')
    expect(signs).toMatch(/Numb lips, tinnitus, or a metallic taste/)
    expect(signs).toMatch(
      /methemoglobinemia, with gray-blue lips and a low saturation that oxygen does not fix/,
    )
    expect(signs).toMatch(/Oversedation is different again: hard to rouse and breathing slowly/)
  })

  it('individualizes sedation, and sets out what propofol needs', () => {
    const drugs = words(sedation, 'sedation-drugs')
    expect(drugs).toMatch(/Choose drugs for this patient: age, weight, heart and lung disease/)
    expect(drugs).toMatch(/Titrate/)
    expect(drugs).toMatch(
      /Propofol: only with trained staff, full monitoring, and someone free to manage deep sedation and the airway/,
    )
    expect(drugs).toMatch(/the means to ventilate, and someone who can, in the room/)
  })

  it('teaches reversal as selective, with its limits, before the case that needs it', () => {
    const reversal = words(sedation, 'reversal')
    expect(reversal).toMatch(/Give the one that matches the drug, never both by routine/)
    expect(reversal).toMatch(/so sedation can return/)
    expect(reversal).toMatch(/bring back pain and a surge in pulse and pressure/)
    expect(reversal).toMatch(/seizure in a daily benzodiazepine user/)
    expect(reversal).toMatch(/Neither replaces ventilation/)
    // Which agent comes first after both drugs is taught with its source, not assumed.
    expect(reversal).toMatch(/BTS advises flumazenil first, unless the opioid dose was large/)
    const flow = COURSE_FLOWS['sedation-and-monitoring']!.map((chunk) => chunk.id)
    expect(flow.indexOf('reversal')).toBeLessThan(flow.indexOf('sedation-case'))
  })

  it('keys the three-frame case on ventilation first, then the drug that fits', () => {
    const [cough, drifting, notRousing] = frames(sedation, 'drift')
    expect(keyOf(cough.choices).label).toBe('Spray more lidocaine on the cords and give it time')
    expect(keyOf(drifting.choices).label).toBe(
      'Give no more sedative, rouse him and open his airway',
    )
    expect(keyOf(notRousing.choices).label).toBe(
      'Scope out, ventilate by bag and mask, then one reversal agent',
    )
    expect(keyOf(notRousing.choices).rationale).toMatch(/reassess before adding the other/)
    expect(notRousing.choices.map((choice) => choice.label).join(' ')).not.toMatch(
      /reverse both drugs/,
    )
  })
})

describe('fasting, aligned with EBUS Guided (r2-554-bf-fasting, 2026-11-15)', () => {
  const fasting = words(sedation, 'before-and-after')

  it('replaces the unconditional 4 hours with the ASA framework for the elective population', () => {
    expect(NUMBER_REGISTER['fasting-solids'].value).toBe(
      'at least 6 hours after a light meal, and typically 8 hours or more after fried or fatty food or meat',
    )
    expect(NUMBER_REGISTER['fasting-clear-fluids'].value).toBe('2 hours')
    expect(NUMBER_REGISTER['fasting-solids'].sources.map((source) => source.sourceId)).toEqual([
      'U25',
    ])
    // The sentences as the learner reads them, with the register's values in place.
    const read = resolveNumbers(fasting)
    expect(read).toMatch(
      /For a healthy patient having an elective bronchoscopy under sedation or anesthesia, the ASA preoperative fasting guideline allows clear liquids until 2 hours before the procedure\./,
    )
    expect(read).toMatch(
      /Solid food: at least 6 hours after a light meal, and typically 8 hours or more after fried or fatty food or meat\./,
    )
    // No section of the course still teaches the old rule.
    for (const flowSection of BRONCH_SECTIONS) {
      const all = resolveNumbers(JSON.stringify(flowSection))
      expect(all).not.toMatch(/no food for/i)
      expect(all).not.toMatch(
        /\b(4|four) hours\b[^.]*\b(food|fast)|\b(food|fast)[^.]*\b(4|four) hours\b/i,
      )
    }
  })

  it('assesses aspiration risk for each patient, and defers to local policy', () => {
    expect(fasting).toMatch(/Assess aspiration risk in every patient/)
    expect(fasting).toMatch(/settle the anesthesia and procedural plan for that patient beforehand/)
    expect(fasting).toMatch(/a longer fast alone may not remove it/)
    expect(fasting).toMatch(/Your anesthesia and procedural policy sets the fasting interval/)
  })

  it('keeps BTS 2013 as history in the register note, and signs nothing', () => {
    expect(NUMBER_REGISTER['fasting-solids'].note).toMatch(
      /BTS 2013 \(grade D\) and ICS\/NCCP\(I\)\/IAB 2019 \(3A\) gave 4 hours/,
    )
    expect(NUMBER_REGISTER['fasting-solids'].note).toMatch(/neither was re-read/)
    expect(block(sedation, 'before-and-after').sourceRefs.map((ref) => ref.sourceId)).toContain(
      'U25',
    )
    for (const id of ['fasting-solids', 'fasting-clear-fluids'] as const)
      expect(NUMBER_REGISTER[id].signedBy).toBeNull()
  })
})

describe('the bleeding first-move card (bf-bleeding-first-move-card)', () => {
  const card = block(bleeding, 'first-moves')
  const steps = card.steps ?? []

  it('wedges for tamponade and to protect the other airways', () => {
    expect(steps[0]).toMatch(
      /Wedge the tip in the bleeding segment, to tamponade it and keep blood out of other airways/,
    )
  })

  it('suctions the central and non-bleeding airways, and spares the clot', () => {
    expect(steps[1]).toMatch(/Suction at the site only as needed: let the clot form/)
    expect(steps[1]).toMatch(/leave an established clot alone/)
    expect(steps[2]).toBe('Blood past the wedge: clear central and non-bleeding airways.')
  })

  it('keeps oxygen, early help and the further measures, without a rigid order', () => {
    expect(card.body).toMatch(/Stop sampling and give oxygen/)
    expect(card.body).toMatch(/The moves overlap; the bleed decides which you need/)
    expect(card.body).not.toMatch(/work down the card/)
    for (const text of [
      bleeding.objective,
      ...(bleeding.outcomes ?? []).map((outcome) => outcome.text),
    ])
      expect(text).not.toMatch(/in order/)
    expect(card.callForHelp).toMatch(/^early/)
    expect(steps.join(' ')).toMatch(/Cold saline/)
    expect(steps.join(' ')).toMatch(/Bleeding side down, to protect the other lung/)
  })
})

describe('Section 1, indications and referral plans (bf-s01-referral-plans)', () => {
  it('lists unexplained hemoptysis as a conditional indication', () => {
    const reasons = (block(clinicalQuestion, 'indications').points ?? []).join(' ')
    expect(reasons).toMatch(
      /Unexplained hemoptysis, when its severity, recurrence, the imaging or the cancer risk mean a look would change management/,
    )
    expect(reasons).not.toMatch(/Hemoptysis with no source found/)
  })

  it('teaches that aspirin alone never delays a bronchoscopy, biopsy included', () => {
    const plan = (block(clinicalQuestion, 'bleeding-plan').points ?? []).join(' ')
    expect(plan).toMatch(/Aspirin alone: continue, forceps biopsy included\. Not a reason to delay/)
    expect(plan).toMatch(
      /Two antiplatelet drugs, or an unusually high-risk procedure: plan individually/,
    )
    const [foreignBody] = frames(clinicalQuestion, 'act')
    expect(keyOf(foreignBody.choices).rationale).toMatch(
      /Aspirin alone does not delay a bronchoscopy/,
    )
    const hold = foreignBody.choices.find((choice) => /stop his aspirin/.test(choice.label))!
    expect(hold.plausibility).not.toBe('best')
    expect(hold.rationale).toMatch(
      /Aspirin alone continues for bronchoscopy, forceps biopsy included/,
    )
  })

  it('never stops clopidogrel automatically after a recent stent', () => {
    const plan = (block(clinicalQuestion, 'bleeding-plan').points ?? []).join(' ')
    expect(plan).toMatch(/off before a biopsy, once the prescriber agrees/)
    expect(plan).toMatch(/A recent coronary stent: stop nothing yourself/)
    expect(plan).toMatch(/Postpone elective biopsy if you can and ask cardiology/)
    expect(plan).toMatch(/Its reason and age set the risk/)
    const stent = frames(clinicalQuestion, 'act')[1]
    expect(keyOf(stent.choices).label).toBe(
      'Hold the biopsy and agree an antiplatelet plan with her cardiologist',
    )
    expect(keyOf(stent.choices).rationale).toMatch(/Do not stop it yourself/)
  })

  it('teaches the platelet thresholds as usual thresholds, not guarantees', () => {
    const plan = (block(clinicalQuestion, 'bleeding-plan').points ?? []).join(' ')
    expect(plan).toMatch(/are the usual thresholds, not guarantees/)
    const lowPlatelets = frames(clinicalQuestion, 'act')[2]
    expect(keyOf(lowPlatelets.choices).label).toMatch(/^Modify: lavage today, and no biopsy/)
    expect(keyOf(lowPlatelets.choices).rationale).toMatch(/Neither is a guarantee/)
  })
})

describe('the vignettes the owner named (bf-vignette-keys)', () => {
  it('holds forty vignettes with the same ids', () => {
    expect(VIGNETTES).toHaveLength(40)
  })

  it('1. postpones the biopsy after a recent stent, and never stops clopidogrel by rule', () => {
    const entry = vignette('stent-three-weeks')
    expect(keyOf(entry.choices).label).toBe(
      'Postpone the biopsy while the stent still needs clopidogrel',
    )
    expect(entry.explanation).toMatch(/it is never automatic/)
    expect(entry.explanation).toMatch(/Aspirin alone would not have delayed it/)
  })

  it('2. holds flumazenil in a daily benzodiazepine user who is breathing', () => {
    expect(keyOf(vignette('daily-alprazolam').choices).label).toBe(
      'Stimulate him and watch; hold the flumazenil',
    )
  })

  it('3. avoids biopsying both lungs without making it an unconditional rule', () => {
    const entry = vignette('both-lungs-today')
    expect(keyOf(entry.choices).label).toBe('Take all the biopsies from one lung today')
    expect(entry.explanation).toMatch(/unless the question cannot be answered any other way/)
    expect(entry.explanation).not.toMatch(/^Biopsy one lung in a sitting\./)
  })

  it('4. treats pain as a warning of the pleura, not as proof of position', () => {
    const entry = vignette('pain-when-the-forceps-open')
    expect(keyOf(entry.choices).label).toBe('Close the forceps and draw them back before you bite')
    expect(keyOf(entry.choices).rationale).toMatch(/suggests the forceps are at or near the pleura/)
    expect(entry.explanation).toMatch(/It does not prove where they are/)
    expect(entry.explanation).not.toMatch(/means pleura/)
  })

  it('5. defers an elective look in severe ARDS, and says what would change that', () => {
    const entry = vignette('no-reserve')
    expect(keyOf(entry.choices).label).toBe('Defer the bronchoscopy until he needs less support')
    expect(entry.explanation).toMatch(/Urgency changes that/)
  })

  it('6. no longer keys a raised tidal volume for a smaller delivered breath', () => {
    const entry = vignette('smaller-breaths')
    expect(keyOf(entry.choices).label).toBe('Come out, then plan shorter passes')
    const raise = entry.choices.find((choice) => /tidal volume raised/.test(choice.label))!
    expect(raise.plausibility).not.toBe('best')
    expect(raise.rationale).toMatch(/one option, not a reflex/)
    expect(entry.explanation).toMatch(/one option a guideline allows/)
  })

  it('7. offers a second way to secure or isolate the airway in massive hemoptysis', () => {
    expect(keyOf(vignette('which-side-down').choices).label).toBe(
      'Turn him right side down and get help for the airway',
    )
    expect(vignette('drowning-side-unknown').explanation).toMatch(
      /a large tube, or rigid bronchoscopy where the team has it/,
    )
    const bronchus = vignette('which-bronchus')
    expect(keyOf(bronchus.choices).rationale).toMatch(
      /A blocker in the left main bronchus does the same job/,
    )
    expect(bronchus.explanation).toMatch(
      /can cover the upper lobe opening, so check that lobe ventilates/,
    )
  })

  it('8. reads a count below the threshold as less likely, not excluded', () => {
    const entry = vignette('count-below-the-line')
    expect(keyOf(entry.choices).label).toBe('As below the threshold: less likely, not excluded')
    expect(entry.explanation).toMatch(/makes pneumonia less likely and does not exclude it/)
    expect(entry.explanation).toMatch(
      /quality of the sample, antibiotic exposure and the clinical probability/,
    )
  })

  it('never offers both reversal agents together as an option', () => {
    const labels = VIGNETTES.flatMap((entry) => entry.choices.map((choice) => choice.label))
    expect(labels.join(' | ')).not.toMatch(/naloxone and flumazenil/i)
  })
})

describe('the integrated cases the owner named (bf-integrated-case-keys)', () => {
  it('keeps the eight ids, their order and their critical flags', () => {
    expect(CAPSTONE_CASES.map((entry) => [entry.id, entry.critical])).toEqual([
      ['C01', true],
      ['C04', true],
      ['C05', true],
      ['C06', true],
      ['C07', false],
      ['C09', false],
      ['C10', true],
      ['C16', false],
    ])
  })

  it('C04 plans the airway first, without making rigid bronchoscopy or one anesthetic mandatory', () => {
    const c04 = integrated('C04')
    expect(keyOf(c04.item.choices).label).toBe(
      'Stop, and plan her airway first: the right room, team and rescue plan',
    )
    expect(c04.item.explanation).toMatch(
      /Rigid bronchoscopy should be available when the stenosis may need it/,
    )
    expect(c04.item.explanation).toMatch(/The anesthetic is chosen for her, not by rule/)
    expect(c04.item.choices.map((choice) => choice.label).join(' ')).not.toMatch(
      /rigid bronchoscope ready/,
    )
  })

  it('C05 ventilates, then reverses the drug that fits', () => {
    const c05 = integrated('C05')
    expect(c05.item.explanation).not.toMatch(/naloxone and flumazenil/)
    expect(c05.item.explanation).toMatch(
      /Then one reversal agent, chosen from the doses and how he looks/,
    )
  })

  it('C10 reports the obstruction as seen and the airways beyond it as not seen', () => {
    const c10 = integrated('C10')
    expect(keyOf(c10.item.choices).label).toBe(
      'The obstruction seen, RB7 to RB10 and larynx not seen, bleed graded',
    )
    expect(c10.item.choices.map((choice) => choice.label).join(' ')).not.toMatch(/not reachable/)
    expect(c10.item.explanation).toMatch(
      /The airways beyond it were not seen: the scope could not pass/,
    )
    expect(c10.item.explanation).toMatch(
      /Not reachable means an opening you saw and could not enter/,
    )
  })

  it('C16 reads an unwedged sample as a washing, and repeats a lavage only if it changes care', () => {
    const c16 = integrated('C16')
    expect(keyOf(c16.item.choices).label).toBe(
      'Read it as a washing; repeat a lavage only if it would change care',
    )
    expect(c16.item.explanation).toMatch(/A repeat lavage is a decision, not a rule/)
  })
})
