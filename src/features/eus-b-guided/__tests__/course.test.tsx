import { render } from '@testing-library/react'
import { teachingNumberErrors } from '@/features/learning-module/numbers/teachingNumbers'
import { betaRollout } from '@/features/module-beta/rollout'
import { EUSB_LABS, eusbLab } from '@/lib/eus-b-guided-contract'
import { REACH_ROWS } from '../components/ReachTable'
import { SurveyRoute } from '../components/SurveyRoute'
import {
  CHAPTERS,
  GUIDED_MINUTES,
  LESSONS,
  SURVEY_STOPS,
  labStepFor,
  lessonById,
  lessonForStop,
  lessonHref,
  lessonNumber,
  nextLesson,
} from '../content/curriculum'
import { SOURCE_IDS } from '../content/sources'
import { EUSB_NUMBERS } from '../content/teachingNumbers'
import type { Question } from '../content/types'

const questions: Question[] = LESSONS.flatMap((lesson) =>
  lesson.steps.flatMap((step) => ('question' in step ? [step.question] : [])),
)
const words = (text: string) => text.trim().split(/\s+/).length

describe('course registry', () => {
  it('derives every list and count from the chapters', () => {
    expect(LESSONS).toEqual(CHAPTERS.flatMap((chapter) => chapter.lessons))
    expect(GUIDED_MINUTES).toBe(LESSONS.reduce((total, lesson) => total + lesson.minutes, 0))
    expect(new Set(LESSONS.map((lesson) => lesson.id)).size).toBe(LESSONS.length)
    LESSONS.forEach((lesson, at) => {
      expect(lessonById(lesson.id)).toBe(lesson)
      expect(lessonNumber(lesson.id)).toBe(at + 1)
      expect(nextLesson(lesson.id)).toBe(LESSONS[at + 1])
      expect(lessonHref(lesson.id)).toBe('/eus-b-guided/learn?section=' + lesson.id)
    })
    expect(lessonById('no-such-lesson')).toBeUndefined()
    expect(lessonById(undefined)).toBeUndefined()
  })

  it('tells the hub the same length the course counts', () => {
    const note = betaRollout['eus-b-guided'].note!
    expect(note.estimate!.minutes).toBe(GUIDED_MINUTES)
    expect(note.estimate!.basis).toContain(`${LESSONS.length} lessons`)
    expect(note.knownLimits.join(' ')).toContain(`${EUSB_NUMBERS.rows.length} sourced numbers`)
  })

  it('cites only registered sources, and every number can be traced', () => {
    for (const lesson of LESSONS) {
      expect(lesson.sources.length).toBeGreaterThan(0)
      for (const id of lesson.sources) expect(SOURCE_IDS.has(id)).toBe(true)
    }
    expect(teachingNumberErrors(EUSB_NUMBERS, SOURCE_IDS)).toEqual([])
  })
})

describe.each(LESSONS)('lesson $id', (lesson) => {
  it('has unique task ids, an honest length and something to take away', () => {
    expect(new Set(lesson.steps.map((step) => step.id)).size).toBe(lesson.steps.length)
    expect(lesson.minutes).toBeGreaterThan(0)
    expect(lesson.objective.length).toBeGreaterThan(20)
    expect(lesson.takeaways.length).toBeGreaterThan(0)
  })

  it('opens on a committed prediction and closes on a check in a different situation', () => {
    expect(lesson.steps[0].kind).toBe('predict')
    expect(lesson.steps.at(-1)!.kind).toBe('check')
  })

  it('names only labs that exist, of the kind the task needs', () => {
    for (const step of lesson.steps) {
      if (step.kind === 'lab') {
        expect(Object.keys(EUSB_LABS)).toContain(step.lab)
        expect(['reach', 'rotate', 'identify', 'survey']).toContain(eusbLab(step.lab).kind)
      }
      if ('view' in step && step.view) {
        expect(Object.keys(EUSB_LABS)).toContain(step.view)
        // An image shown beside text or under a question is a still: nothing to drive.
        expect(eusbLab(step.view).controls).toEqual([])
      }
    }
  })

  it('explains each scope task after it, on the image from that task', () => {
    lesson.steps.forEach((step, at) => {
      if (step.kind !== 'debrief') return
      const lab = labStepFor(lesson, step)
      expect(lab).toBeDefined()
      expect(lesson.steps.indexOf(lab!)).toBeLessThan(at)
    })
    for (const step of lesson.steps)
      if (step.kind === 'lab')
        expect(lesson.steps.some((other) => other.kind === 'debrief' && other.of === step.id)).toBe(
          true,
        )
  })

  it('shows the landmark before asking the learner to find it', () => {
    lesson.steps.forEach((step, at) => {
      if (step.kind !== 'lab') return
      const target = eusbLab(step.lab).target
      const shown = lesson.steps
        .slice(0, at)
        .some(
          (earlier) =>
            earlier.kind === 'brief' &&
            !!earlier.view &&
            eusbLab(earlier.view).start &&
            'view' in eusbLab(earlier.view).start &&
            (eusbLab(earlier.view).start as { view: string }).view === target,
        )
      expect(shown).toBe(true)
    })
  })

  it('keeps text that sits beside the image short enough to read without scrolling', () => {
    for (const step of lesson.steps) {
      if (step.kind === 'brief' && step.view)
        expect(words([...step.body, ...(step.points ?? [])].join(' '))).toBeLessThanOrEqual(150)
      if (step.kind === 'debrief')
        expect(words([...step.body, ...(step.points ?? [])].join(' '))).toBeLessThanOrEqual(110)
      if (step.kind === 'lab') expect(words(step.instruction)).toBeLessThanOrEqual(40)
    }
  })
})

describe('questions', () => {
  it('have unique ids across the course', () => {
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length)
  })

  it.each(questions)('$id has one keyed option and a reason for every option', (question) => {
    expect(question.choices.filter((choice) => choice.correct)).toHaveLength(1)
    expect(question.choices.length).toBeGreaterThanOrEqual(3)
    for (const choice of question.choices) {
      expect(choice.text.length).toBeGreaterThan(2)
      expect(choice.rationale.length).toBeGreaterThan(15)
      // A keyed option is never also marked unsafe.
      expect(choice.correct && choice.unsafe).toBeFalsy()
    }
    expect(question.explanation.length).toBeGreaterThan(15)
    expect(new Set(question.choices.map((choice) => choice.text)).size).toBe(
      question.choices.length,
    )
  })
})

describe('the survey route', () => {
  it('has six stops, three below the diaphragm and three in the mediastinum, in order', () => {
    expect(SURVEY_STOPS.map((entry) => entry.stop)).toEqual([1, 2, 3, 4, 5, 6])
    expect(SURVEY_STOPS.map((entry) => entry.region)).toEqual([
      'abdomen',
      'abdomen',
      'abdomen',
      'mediastinum',
      'mediastinum',
      'mediastinum',
    ])
  })

  it('gives each landmark lesson a stop on the route, used once', () => {
    const stops = LESSONS.filter((lesson) => lesson.stop !== undefined).map(
      (lesson) => lesson.stop!,
    )
    expect(new Set(stops).size).toBe(stops.length)
    for (const stop of stops) {
      expect(SURVEY_STOPS.some((entry) => entry.stop === stop)).toBe(true)
      expect(lessonForStop(stop)!.stop).toBe(stop)
    }
  })

  it('says in words what the drawing shows, stop for stop', () => {
    const { container } = render(<SurveyRoute current={4} />)
    const drawn = Array.from(container.querySelectorAll('[data-route-stop]'))
    const listed = Array.from(container.querySelectorAll('[data-survey-route-list] li'))
    expect(drawn.map((stop) => stop.getAttribute('data-route-stop'))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ])
    expect(listed).toHaveLength(drawn.length)
    drawn.forEach((stop, at) => {
      // The label on the drawing may be shortened; its distinguishing word is in the list item.
      const label = stop.querySelector('text:last-of-type')!.textContent!
      const key =
        label
          .split(/[ ,]+/)
          .filter((word) => word.length > 3)
          .at(-1) ?? label
      expect(listed[at].textContent).toContain(key.replace(/^the /i, ''))
    })
    expect(container.querySelector('[data-route-stop="4"]')).toHaveAttribute('data-current', 'true')
    expect(listed[3]).toHaveAttribute('aria-current', 'step')
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('what each route reaches', () => {
  it('answers both routes for every target', () => {
    expect(REACH_ROWS.length).toBeGreaterThanOrEqual(6)
    for (const row of REACH_ROWS) {
      expect(row.target.length).toBeGreaterThan(5)
      expect(row.airway).toMatch(/^(Yes|No|Not routinely|Often hidden)/)
      expect(row.esophagus).toMatch(/^(Yes|No|Not routinely|Often hidden)/)
    }
  })
})
