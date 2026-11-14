import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { teachingNumberErrors } from '@/features/learning-module/numbers/teachingNumbers'
import { betaRollout } from '@/features/module-beta/rollout'
import { EUSB_LABS, EUSB_LAB_IDS, eusbLab } from '@/lib/eus-b-guided-contract'
import { StationTable, stationsTaught } from '../components/StationLandmarks'
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
import { structureName } from '../content/names'
import { SOURCE_IDS } from '../content/sources'
import { STATIONS, stationById } from '../content/stations'
import { EUSB_NUMBERS } from '../content/teachingNumbers'
import type { Question } from '../content/types'

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

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
    // The landmark list under the text is read beside the image too, so it counts.
    const listed = (station?: string) =>
      (stationById(station ?? '')?.landmarks ?? []).map(
        (landmark) => landmark.name + ' ' + landmark.where,
      )
    for (const step of lesson.steps) {
      if (step.kind === 'brief' && step.view)
        expect(
          words([...step.body, ...(step.points ?? []), ...listed(step.station)].join(' ')),
        ).toBeLessThanOrEqual(150)
      if (step.kind === 'debrief')
        expect(
          words([...step.body, ...(step.points ?? []), ...listed(step.station)].join(' ')),
        ).toBeLessThanOrEqual(110)
      if (step.kind === 'lab' || step.kind === 'identify')
        expect(words(step.instruction)).toBeLessThanOrEqual(40)
    }
  })

  it('asks for landmarks only on a view it has already shown labeled, with those landmarks listed', () => {
    lesson.steps.forEach((step, at) => {
      if (step.kind !== 'identify') return
      const lab = eusbLab(step.lab)
      expect(lab.kind).toBe('identify')
      expect(lab.controls).toEqual([])
      const taught = lesson.steps.slice(0, at).some((earlier) => {
        if (earlier.kind !== 'brief' || !earlier.view || !earlier.station) return false
        const still = eusbLab(earlier.view)
        return (
          JSON.stringify(still.start) === JSON.stringify(lab.start) &&
          JSON.stringify(still.landmarks) === JSON.stringify(lab.landmarks) &&
          JSON.stringify(stationById(earlier.station)!.landmarks.map((entry) => entry.key)) ===
            JSON.stringify(lab.landmarks)
        )
      })
      expect(taught).toBe(true)
    })
  })

  it('lists a station’s landmarks only beside an image that numbers the same structures', () => {
    for (const step of lesson.steps) {
      if (!('station' in step) || !step.station) continue
      const station = stationById(step.station)
      expect(station).toBeDefined()
      const lab =
        step.kind === 'brief'
          ? step.view
          : step.kind === 'debrief'
            ? labStepFor(lesson, step)?.lab
            : undefined
      expect(lab).toBeDefined()
      expect(eusbLab(lab!).landmarks).toEqual(station!.landmarks.map((entry) => entry.key))
    }
  })
})

describe('the station registry', () => {
  it('lists each station once, taught by a lesson of the course', () => {
    expect(new Set(STATIONS.map((station) => station.id)).size).toBe(STATIONS.length)
    for (const station of STATIONS) {
      expect(lessonById(station.lesson)).toBeDefined()
      expect(station.landmarks.length).toBeGreaterThan(1)
      // Landmarks first, the node last.
      expect(station.landmarks.at(-1)!.key).toBe(station.id.replace('-', '_'))
      expect(new Set(station.landmarks.map((entry) => entry.key)).size).toBe(
        station.landmarks.length,
      )
      for (const text of [station.called, station.scope, station.mistakenFor, station.sampled])
        expect(text.length).toBeGreaterThan(8)
      // The lesson that is said to teach a station lists its landmarks somewhere.
      expect(
        lessonById(station.lesson)!.steps.some(
          (step) => 'station' in step && step.station === station.id,
        ) || !station.view,
      ).toBe(true)
    }
  })

  it.each(STATIONS.filter((station) => station.view))(
    '$id: its landmarks are the ones the lab list numbers on its still, in the same order',
    (station) => {
      const still = eusbLab(station.view!)
      expect(still.kind).toBe('explore')
      expect(still.landmarks).toEqual(station.landmarks.map((entry) => entry.key))
    },
  )

  it('gives every landmark a lab can ask for a name that reads in a sentence', () => {
    for (const id of EUSB_LAB_IDS)
      for (const key of eusbLab(id).landmarks ?? [])
        expect(structureName(key)).not.toMatch(/_|^the [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+$/)
  })

  it('covers every nodal station the lab list has a still for', () => {
    const stills = EUSB_LAB_IDS.filter(
      (id) => eusbLab(id).kind === 'explore' && /^station-/.test(id),
    )
    expect(stills.sort()).toEqual(
      STATIONS.filter((station) => station.view)
        .map((station) => station.view!)
        .sort(),
    )
  })

  it('fills in a station only when it is open, and names its lesson until then', () => {
    const taught = stationsTaught(['station-7'])
    expect([...taught]).toEqual(['station-7'])
    // One lesson teaches several stations: they all open with it.
    expect([...stationsTaught(['station-4l'])].sort()).toEqual([
      'station-4l',
      'station-4r',
      'station-5',
      'station-6',
    ])
    const { container, rerender } = render(<StationTable open={taught} />)
    const row = (id: string) => container.querySelector(`[data-station-row="${id}"]`)!
    expect(container.querySelectorAll('[data-station-row]')).toHaveLength(STATIONS.length)
    for (const station of STATIONS) {
      const open = station.id === 'station-7'
      expect(row(station.id)).toHaveAttribute('data-open', String(open))
      for (const landmark of station.landmarks)
        if (open) expect(row(station.id)).toHaveTextContent(landmark.where)
        else expect(row(station.id)).not.toHaveTextContent(landmark.where)
      if (!open) expect(row(station.id)).not.toHaveTextContent(station.mistakenFor)
    }
    expect(row('station-8')).toHaveTextContent(lessonById('station-8')!.title)
    rerender(<StationTable open="all" />)
    for (const station of STATIONS) {
      expect(row(station.id)).toHaveAttribute('data-open', 'true')
      expect(row(station.id)).toHaveTextContent(station.mistakenFor)
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
