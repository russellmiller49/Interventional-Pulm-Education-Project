import { betaRollout } from '@/features/module-beta/rollout'
import { REACH_ROWS } from '../components/ReachTable'
import { COURSE_OBJECTIVES, LESSONS, SURVEY_STOPS } from '../content/curriculum'
import { EUSB_NUMBERS } from '../content/teachingNumbers'

/** Everything a learner reads that is written in the content files. */
const authored: { where: string; text: string }[] = [
  ...COURSE_OBJECTIVES.map((text) => ({ where: 'course objective', text })),
  ...SURVEY_STOPS.map((stop) => ({ where: 'survey stop', text: stop.name })),
  ...REACH_ROWS.flatMap((row) => [
    { where: 'reach table', text: row.target },
    { where: 'reach table', text: row.airway },
    { where: 'reach table', text: row.esophagus },
  ]),
  ...LESSONS.flatMap((lesson) => [
    { where: lesson.id, text: lesson.title },
    { where: lesson.id, text: lesson.objective },
    ...lesson.takeaways.map((text) => ({ where: lesson.id + ' takeaway', text })),
    ...lesson.steps.flatMap((step) => {
      const where = lesson.id + ':' + step.id
      const texts = [step.title]
      if ('stem' in step && step.stem) texts.push(step.stem)
      if ('body' in step) texts.push(...step.body, ...(step.points ?? []))
      if (step.kind === 'lab') texts.push(step.instruction)
      if ('question' in step)
        texts.push(
          step.question.prompt,
          step.question.explanation,
          ...step.question.choices.flatMap((choice) => [choice.text, choice.rationale]),
        )
      return texts.map((text) => ({ where, text }))
    }),
  ]),
]

describe('learner-facing wording', () => {
  it('covers the course', () => {
    expect(authored.length).toBeGreaterThan(80)
  })

  it('uses no words about how the course was built', () => {
    const builder =
      /\b(authored|preset|modell?ed|calibrated|synthetic|placeholder|schematic|conceptual|reference view|simulator|renderer|segment(ed|ation)|draft|not reviewed)\b/i
    for (const { where, text } of authored)
      expect({ where, hit: builder.exec(text)?.[0] }).toEqual({ where })
  })

  it('never says in a stem, option or reason whether an answer is right', () => {
    for (const { where, text } of authored)
      expect({ where, hit: /\b(correct|incorrect|wrong)\b/i.exec(text)?.[0] }).toEqual({ where })
  })

  it('defers nothing to local policy in place of teaching it', () => {
    for (const { where, text } of authored)
      expect({
        where,
        hit: /local (policy|protocol)|institutional protocol|escalate/i.exec(text)?.[0],
      }).toEqual({
        where,
      })
  })

  it('takes every percentage and decimal figure from the numbers register', () => {
    const registered = EUSB_NUMBERS.rows.map((row) => row.value)
    for (const { where, text } of authored)
      for (const figure of text.match(/\d+(?:\.\d+)?\s?%|\d+\.\d+/g) ?? [])
        expect({
          where,
          figure,
          registered: registered.some((value) => value.includes(figure)),
        }).toEqual({ where, figure, registered: true })
  })

  it('does not name a task after its answer', () => {
    for (const lesson of LESSONS)
      for (const step of lesson.steps) {
        if (!('question' in step)) continue
        const keyed = step.question.choices.find((choice) => choice.correct)!.text.toLowerCase()
        // The distinguishing words of the keyed option must not all sit in the task's title.
        const distinctive = keyed.split(/[^a-z0-9]+/).filter((word) => word.length > 5)
        const title = step.title.toLowerCase()
        if (distinctive.length > 0)
          expect({
            step: step.id,
            leaked: distinctive.every((word) => title.includes(word)),
          }).toEqual({
            step: step.id,
            leaked: false,
          })
      }
  })

  it('keeps the tester note in the same plain register', () => {
    const note = betaRollout['eus-b-guided'].note!
    for (const text of [note.audience, note.summary, ...note.lookFor, ...note.knownLimits])
      expect(text).not.toMatch(/\b(authored|preset|calibrated|synthetic)\b/i)
  })
})
