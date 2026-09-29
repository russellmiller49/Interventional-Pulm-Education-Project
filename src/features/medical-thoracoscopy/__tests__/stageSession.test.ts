/** @jest-environment node */
import { lessonParts } from '../content/lessonParts'
import { WRITTEN_SECTIONS } from '../content/sections'
import {
  lessonReducer,
  partDone,
  startLesson,
  type LessonAction,
  type LessonSession,
} from '../engine/stageSession'

/**
 * The lesson session (slice 12): navigation, answers and activity kept apart; nothing counts as done
 * but the learner's own answers and activity; every order of the parts follows the section's rule.
 */

const survey = WRITTEN_SECTIONS.find((spec) => spec.id === 'systematic-survey')!
const pivot = WRITTEN_SECTIONS.find((spec) => spec.id === 'four-controls')!
const tour = WRITTEN_SECTIONS.find((spec) => spec.id === 'normal-pleural-space')!

const run = (session: LessonSession, ...actions: LessonAction[]) =>
  actions.reduce(lessonReducer, session)

describe('the parts of a lesson', () => {
  it.each(WRITTEN_SECTIONS.map((spec) => [spec.id, spec] as const))(
    'come in the order %s’s question sets, orientation first and transfer last, each block once',
    (_, spec) => {
      const parts = lessonParts(spec)
      expect(parts[0]).toBe('orientation')
      expect(parts.at(-1)).toBe('transfer')
      expect(new Set(parts).size).toBe(parts.length)
      for (const block of spec.blocks) expect(parts).toContain(`block:${block.id}`)
      const question = parts.indexOf('question')
      if (spec.question.kind === 'prediction') {
        // the blocks placed before the question come before it, the concept after it
        for (const block of spec.blocks.filter((entry) => entry.when === 'before-question'))
          expect(parts.indexOf(`block:${block.id}`)).toBeLessThan(question)
        expect(parts.indexOf('concept')).toBeGreaterThan(question)
      } else {
        expect(question).toBe(parts.length - 2)
      }
      if (spec.teachingExample) expect(parts[1]).toBe('teaching-example')
    },
  )
})

describe('the lesson session', () => {
  it('moves by navigation alone, and no navigation does any part’s work', () => {
    const parts = lessonParts(pivot)
    let session = startLesson(parts)
    for (let n = 0; n < parts.length + 3; n += 1)
      session = lessonReducer(session, { type: 'continue' })
    expect(session.current).toBe(parts.length - 1)
    expect(session.furthest).toBe(parts.length - 1)
    session = run(session, { type: 'back' }, { type: 'back' })
    expect(session.current).toBe(parts.length - 3)
    expect(session.furthest).toBe(parts.length - 1)
    for (const part of parts) expect(partDone(session, part, pivot.activity)).toBe(false)
  })

  it('opens a part ahead without moving the furthest, and remembers it was opened out of order', () => {
    const parts = lessonParts(survey)
    const session = run(startLesson(parts), { type: 'open', part: 'transfer' })
    expect(session.current).toBe(parts.length - 1)
    expect(session.furthest).toBe(0)
    expect(session.openedAhead).toEqual(['transfer'])
    expect(run(session, { type: 'open', part: 'not-a-part' as never })).toEqual(session)
  })

  it('records moving past a part without doing it, and never as done', () => {
    const parts = lessonParts(survey)
    const at = parts.indexOf('activity')
    let session = run(startLesson(parts), { type: 'open', part: 'activity' })
    expect(session.current).toBe(at)
    session = lessonReducer(session, { type: 'move-past' })
    expect(session.movedPast).toEqual(['activity'])
    expect(partDone(session, 'activity', survey.activity)).toBe(false)
  })

  it('lets an answer be read about first, chosen, checked and changed; a new choice waits to be checked', () => {
    let session = startLesson(lessonParts(pivot))
    session = run(session, { type: 'check', question: 'question' })
    expect(session.answers.question.checked).toBe(false)
    session = run(session, { type: 'explain', question: 'question' })
    expect(session.answers.question).toEqual({
      chosen: null,
      checked: false,
      explanationOpen: true,
    })
    session = run(
      session,
      { type: 'choose', question: 'question', choice: 'a' },
      { type: 'check', question: 'question' },
    )
    expect(partDone(session, 'question', pivot.activity)).toBe(true)
    session = run(session, { type: 'choose', question: 'question', choice: 'b' })
    expect(session.answers.question).toMatchObject({ chosen: 'b', checked: false })
    expect(partDone(session, 'question', pivot.activity)).toBe(false)
  })

  it('counts the tour done once every stop is named or asked about', () => {
    if (tour.activity.kind !== 'tour') throw new Error('section six is a tour')
    let session = startLesson(lessonParts(tour))
    tour.activity.stops.forEach((stop, index) => {
      expect(partDone(session, 'activity', tour.activity)).toBe(false)
      session =
        index % 2 === 0
          ? run(session, { type: 'tour-ask', stop: index })
          : run(session, { type: 'tour-name', stop: index, zone: stop.zone })
    })
    expect(partDone(session, 'activity', tour.activity)).toBe(true)
    // asking after naming changes nothing
    expect(run(session, { type: 'tour-ask', stop: 1 }).tour.named[1]).toBe(
      tour.activity.stops[1].zone,
    )
  })

  it('counts the pivot done only when every target has been reached, once each', () => {
    if (pivot.activity.kind !== 'pivot') throw new Error('section seven is a pivot')
    let session = startLesson(lessonParts(pivot))
    for (let target = 0; target < pivot.activity.targets.length; target += 1) {
      session = run(session, { type: 'pivot-reached', target }, { type: 'pivot-reached', target })
    }
    expect(session.pivot.reached).toEqual(pivot.activity.targets.map((_, index) => index))
    expect(partDone(session, 'activity', pivot.activity)).toBe(true)
  })

  it('counts the survey done once every region is noted and the note compared, never before', () => {
    if (survey.activity.kind !== 'survey') throw new Error('section eleven is a survey')
    let session = startLesson(lessonParts(survey))
    session = run(session, {
      type: 'survey-note',
      zone: 'apex',
      row: { seen: 'partly-seen', reason: 'hidden' },
    })
    expect(session.survey.note.apex).toEqual({ seen: 'partly-seen', reason: 'hidden' })
    // compared too soon: not done
    expect(partDone(run(session, { type: 'survey-compare' }), 'activity', survey.activity)).toBe(
      false,
    )
    for (const zone of survey.activity.order) {
      session = run(session, { type: 'survey-note', zone, row: { seen: 'not-seen', reason: null } })
    }
    // a region not fully seen needs its reason
    expect(partDone(run(session, { type: 'survey-compare' }), 'activity', survey.activity)).toBe(
      false,
    )
    for (const zone of survey.activity.order) {
      session = run(session, { type: 'survey-note', zone, row: { seen: 'seen', reason: null } })
    }
    expect(partDone(session, 'activity', survey.activity)).toBe(false)
    expect(partDone(run(session, { type: 'survey-compare' }), 'activity', survey.activity)).toBe(
      true,
    )
  })

  it('is plain data', () => {
    const session = run(
      startLesson(lessonParts(survey)),
      { type: 'continue' },
      { type: 'tour-stop', stop: 2 },
    )
    expect(JSON.parse(JSON.stringify(session))).toEqual(session)
  })
})
