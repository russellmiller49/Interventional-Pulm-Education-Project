import { NEEDLE_LAB } from '@/lib/ebus-model-contract'
import { BF_UC180F_NOMINAL } from '@/lib/bronchoscopy-core/devices'
import { CAPSTONE_CONCLUSION, CAPSTONE_STATIONS, capstoneLessons } from '../content/capstone'
import { CHAPTER_REVIEWS } from '../content/chapter-reviews'
import { CONTENT_LESSONS, lessonById } from '../content/curriculum'
import { FEATURE_TABS } from '../content/node-features'
import { BF_UC190F_VIEW_ANGLE, EBUS_NUMBERS } from '../content/teachingNumbers'
import type { Lesson, Question } from '../content/types'

/*
 * The owner's rulings of 2026-11-14 on the scope lesson, the capstone, four chapter-review stems
 * and the needle lab (`ebus-scope-lesson-points`, `ebus-capstone-scenario`, `ebus-review-stems`,
 * `ebus-needle-lab-model`). Each test holds one thing he asked for. None of these is signed.
 */
const everything = (lesson: Lesson) =>
  [
    lesson.objective,
    lesson.recall,
    lesson.concept,
    ...lesson.paragraphs,
    ...lesson.checklist,
    lesson.worked.context,
    lesson.worked.reasoning,
    ...lesson.takeaways,
    ...[lesson.question, lesson.observation, lesson.transfer].flatMap((item) => [
      item.prompt,
      ...item.choices.flatMap((choice) => [choice.text, choice.rationale]),
    ]),
  ].join(' ')
const keyed = (item: Question) => item.choices.find((choice) => choice.correct)!

describe('the scope lesson (ebus-scope-lesson-points)', () => {
  const lesson = lessonById('ebus-scope')!
  const text = lesson.paragraphs.join(' ')

  it('names both scope models with their own direction of view and the shared field', () => {
    expect(EBUS_NUMBERS.value('scope-view-angle')).toBe(BF_UC180F_NOMINAL.forwardObliquityDeg + '°')
    expect(BF_UC190F_VIEW_ANGLE).toBe('20°')
    expect(text).toMatch(/BF-UC180F the direction of view is 35° forward oblique/)
    expect(text).toMatch(/BF-UC190F it is 20°/)
    expect(text).toMatch(/both have an 80° field of view/)
    expect(EBUS_NUMBERS.get('scope-view-angle').note).toContain('BF-UC190F looks 20°')
    expect(lesson.sources).toEqual(expect.arrayContaining(['olympus-uc180f', 'olympus-uc190f']))
  })

  it('says which model the simulated lens is', () => {
    expect(text).toMatch(/views in this lesson use the BF-UC180F figures/)
    expect(text).not.toMatch(/\bsimulation\b/i)
  })

  it('keeps the anterior commissure, and ties no single screen position to every scope', () => {
    expect(text).toMatch(/Find the anterior commissure/)
    expect(text).toMatch(/posterior to whatever is centred in the image/)
    expect(text).toMatch(/depend on the scope model and on how the scope is rotated/)
    expect(text).toMatch(/no single screen position holds for every scope/)
    expect(everything(lesson)).not.toMatch(/let the tip pass through the posterior glottis/)
  })

  it('does not teach a red view as harmless by default', () => {
    expect(text).toMatch(/red alone does not tell you that all is well/)
    expect(text).toMatch(/where the tip is, whether the ultrasound image shows the contact/)
    const key = keyed(lesson.observation)
    expect(key.text).toMatch(
      /to be checked against tip position, the ultrasound image and the patient/,
    )
    expect(everything(lesson)).not.toMatch(/as expected once the transducer is in contact/)
  })

  it('makes the balloon depend on the equipment and the case', () => {
    expect(text).toMatch(
      /Whether one is used depends on the equipment and the clinical circumstances/,
    )
    expect(text).toMatch(/When it is used, clear the air from it before the procedure/)
  })

  it('keeps the larger, more rigid tip without giving every model the same bending', () => {
    expect(text).toMatch(/larger and more rigid than the tip of a diagnostic bronchoscope/)
    expect(text).toMatch(/How far the tip bends differs between scope models/)
    expect(everything(lesson)).not.toMatch(/it bends less/)
  })
})

describe('the capstone (ebus-capstone-scenario)', () => {
  const all = capstoneLessons.map(everything).join(' ')
  const unit = (id: string) => capstoneLessons.find((lesson) => lesson.id === id)!

  it('keeps the scenario: order, on-site pattern and provisional N2a', () => {
    expect(CAPSTONE_STATIONS.map((entry) => entry.station)).toEqual(['4L', '7', '4R', '11Ri'])
    expect(CAPSTONE_STATIONS.map((entry) => entry.category)).toEqual(['N3', 'N2', 'N2', 'N1'])
    expect(CAPSTONE_CONCLUSION).toMatch(/^On today’s on-site findings: N2a, provisional/)
    expect(CAPSTONE_CONCLUSION).toMatch(/Station 7 is the only N2 station with malignant cells/)
  })

  it('says a negative on-site result at 4L or 4R does not exclude malignancy', () => {
    expect(CAPSTONE_CONCLUSION).toMatch(/does not exclude malignancy at those stations/)
    expect(CAPSTONE_CONCLUSION).toMatch(
      /Final cytopathology, with its assessment of adequacy, and the overall staging evaluation/,
    )
    expect(unit('staging-examination').paragraphs.join(' ')).toMatch(
      /a negative on-site result does not exclude malignancy at that station/,
    )
    expect(keyed(unit('staging-exam-4l').question).rationale).toMatch(/does not exclude malignancy/)
  })

  it('calls the blood-only first aspirate nondiagnostic, and judges the later sample on its own', () => {
    const fourR = CAPSTONE_STATIONS.find((entry) => entry.station === '4R')!
    expect(fourR.finding).toMatch(/^First aspirate blood only: nondiagnostic\./)
    expect(CAPSTONE_CONCLUSION).toMatch(/nondiagnostic, and not counted as a negative sample/)
    const key = keyed(unit('staging-exam-4r').question)
    expect(key.text).toMatch(/nondiagnostic/)
    expect(key.rationale).toMatch(/That later sample is assessed on its own/)
    expect(all).not.toMatch(/nonrepresentative/)
  })

  it('keeps the station 7 key: go on to 4R, because a second N2 station would make N2b', () => {
    const key = keyed(unit('staging-exam-7').question)
    expect(key.text).toBe('Go on to 4R: a second involved N2 station would change N2a to N2b')
    expect(key.rationale).toMatch(
      /In the ninth edition, single-station N2 \(N2a\) and multiple-station N2 \(N2b\)/,
    )
  })

  it('counts involved N2 stations on the on-site findings, not as settled fact', () => {
    const count = unit('staging-exam-4r').transfer
    expect(count.prompt).toMatch(
      /^On site, station 7 shows malignant cells and the later 4R sample does not/,
    )
    expect(keyed(count).rationale).toMatch(/If final pathology finds tumor at 4R, it becomes N2b/)
  })
})

describe('the four review stems (ebus-review-stems)', () => {
  const items = CHAPTER_REVIEWS.flatMap((review) => review.items)
  const byId = (id: string) => items.find((item) => item.question.id === id)!.question

  it('10R: keeps the azygos boundary, and says what the still shows and what is given', () => {
    const item = byId('review-plan-10r')
    expect(item.prompt).toMatch(
      /The scope is in the right main bronchus\. Outline 3 is the azygos vein/,
    )
    expect(item.prompt).toMatch(
      /Outline 2 lies wholly on the side of the vein away from the orientation dot, and outline 1 almost wholly/,
    )
    expect(keyed(item).text).toBe('10R')
    expect(keyed(item).rationale).toMatch(/That border is the lower limit of 4R/)
    expect(keyed(item).rationale).toMatch(/It cannot tell you which bronchus the scope is in/)
  })

  it('2L: keeps the upper margin of the arch, and says where the left side comes from', () => {
    const item = byId('review-report-2l')
    expect(item.prompt).toMatch(/transducer turned toward the patient’s left/)
    expect(keyed(item).text).toBe('2L')
    expect(keyed(item).rationale).toMatch(
      /upper margin of the arch is the lower border of station 2L/,
    )
    expect(keyed(item).rationale).toMatch(/It cannot tell you they are on the left/)
  })

  it('necrosis: tells the supposed Doppler finding from the still, and does not call the sign diagnostic', () => {
    const item = byId('review-sample-necrosis')
    expect(item.prompt).toMatch(/^A grayscale still/)
    expect(item.prompt).toMatch(/No Doppler is shown on this frame/)
    expect(keyed(item).text).toMatch(
      /associated with malignancy, and not a substitute for a sample/,
    )
    expect(keyed(item).rationale).toMatch(
      /Doppler was not on, so the absent flow is an assumption here/,
    )
    expect(keyed(item).rationale).toContain(EBUS_NUMBERS.value('cns-specificity'))
    const tab = FEATURE_TABS.find((entry) => entry.id === 'cns')!
    expect(tab.meaning).toMatch(/^Associated with malignancy/)
    expect(tab.meaning).toMatch(/It is not diagnostic/)
    const copy = [item.prompt, ...item.choices.flatMap((c) => [c.text, c.rationale]), tab.meaning]
    expect(copy.join(' ')).not.toMatch(/most specific/)
  })

  it('Doppler: keeps a path that avoids the vessel, and says why this vessel is in the way', () => {
    const item = byId('review-plan-path')
    expect(keyed(item).text).toBe('The needle path: choose a line into the node that avoids it')
    expect(keyed(item).rationale).toMatch(/enters the image from the side of the dot/)
  })
})

describe('the needle lab (ebus-needle-lab-model)', () => {
  const unit = CONTENT_LESSONS.find((lesson) => lesson.id === 'needle-assembly-model')!
  const text = unit.paragraphs.join(' ')

  it('states the three safety objectives', () => {
    expect(text).toMatch(/keep the needle tip in view/)
    expect(text).toMatch(/keep its movement within the node you mean to sample/)
    expect(text).toMatch(/do not let it travel beyond the node into what lies next to it/)
  })

  it('labels the stop tolerance as this exercise’s, not a clinical threshold', () => {
    expect(NEEDLE_LAB.stopShortMm).toBe(3)
    expect(text).toMatch(/accepts a stop up to 3 mm short of the far side of its drawn node/)
    expect(text).toMatch(/not a clinical safety threshold/)
    expect(text).toMatch(/Set it from the size of the node and from the vessels near it/)
  })

  it('labels five movements as the exercise minimum, not as adequate sampling', () => {
    expect(unit.lab!.needleMovements).toBe(5)
    expect(text).toMatch(/asks for 5 movements within the node/)
    expect(text).toMatch(/fewer than the at least 10 on each pass taught earlier in this lesson/)
    expect(text).toMatch(/no count of movements makes a sample adequate/)
  })

  it('presents no needle angle as required', () => {
    expect(text).toMatch(/no single angle is required/)
  })

  it('acknowledges the stylet without implying it can be skipped', () => {
    expect(text).toMatch(/The lab does not model the stylet/)
    expect(text).toMatch(/handling the stylet is part of the pass/)
    expect(text).toMatch(/whether it is in place as the needle enters/)
    expect(text).not.toMatch(/a step you can skip/)
    expect(text).toMatch(/follow the instructions for the needle you are using/)
    expect(unit.boundary).toMatch(/The stylet is not modelled/)
  })
})
