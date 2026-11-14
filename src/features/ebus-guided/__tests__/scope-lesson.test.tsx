import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { LessonHost } from '../components/LessonHost'
import { CHAPTERS, LESSONS, lessonById } from '../content/curriculum'
import { activitiesForLesson } from '../content/stage'
import { EBUS_NUMBERS } from '../content/teachingNumbers'
import { labGoalRequirements } from '../content/types'
import { BF_UC180F_NOMINAL } from '@/lib/bronchoscopy-core/devices'

/*
 * The EBUS scope lesson (added 2026-11-10): the oblique lens, the tip-mounted transducer and the
 * balloon, taught before the learner is asked to rotate, flex or sample anything.
 */
jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
jest.mock('../components/Workbench', () => ({
  Workbench: ({
    lab,
    demonstration,
  }: {
    lab: import('../content/types').Lab
    demonstration?: boolean
  }) => (
    <section
      data-mock-workbench
      data-controls={lab.controls.join(',')}
      data-demonstration={!!demonstration}
    />
  ),
}))
beforeEach(() => {
  localStorage.clear()
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(cleanup)

const lesson = lessonById('ebus-scope')!
const primary = () => document.querySelector('[data-now-primary]') as HTMLButtonElement

describe('the EBUS scope lesson', () => {
  it('opens the scope chapter, before rotation and contact are asked for', () => {
    const chapter = CHAPTERS.find((entry) => entry.id === 'contact')!
    expect(chapter.lessons.map((entry) => entry.id)).toEqual([
      'ebus-scope',
      'scope-orientation',
      'acoustic-contact',
    ])
    expect(LESSONS.indexOf(lesson)).toBe(2)
  })

  it('teaches the view angle the simulated lens actually uses, from the register', () => {
    const text = lesson.paragraphs.join(' ')
    expect(EBUS_NUMBERS.value('scope-view-angle')).toBe(BF_UC180F_NOMINAL.forwardObliquityDeg + '°')
    expect(EBUS_NUMBERS.value('scope-field-of-view')).toBe(BF_UC180F_NOMINAL.fieldOfViewDeg + '°')
    expect(text).toContain(EBUS_NUMBERS.value('scope-view-angle'))
    expect(text).toContain(EBUS_NUMBERS.value('scope-field-of-view'))
    // The figure is tied to its scope model, and the text says other models differ.
    expect(text).toMatch(/Olympus BF-UC180F/)
    expect(text).toMatch(/angle differs between scope models/)
    expect(lesson.sources).toContain('olympus-uc180f')
  })

  it('asks its prediction before any teaching, then shows an ungated live example', () => {
    const flow = activitiesForLesson(lesson)
    expect(flow.map((activity) => activity.kind)).toEqual([
      'prediction',
      'briefing',
      'acquisition',
      'application',
      'transfer',
    ])
    // The briefing's lab is a demonstration; the one acquisition after it is the airway-view task
    // (2026-11-10), on flexion alone.
    expect(flow.filter((activity) => activity.interaction === 'acquire')).toHaveLength(1)
    expect(flow[2]).toMatchObject({
      task: 'airway-view',
      title: 'Look along the airway, then bring back the image',
    })
    expect(lesson.transferLab).toMatchObject({ goal: 'airway-view', controls: ['flexion'] })
    render(<LessonHost lesson={lesson} />)
    expect(screen.getByText(lesson.question.prompt)).toBeVisible()
    expect(screen.queryByText(lesson.paragraphs[0])).not.toBeInTheDocument()
    expect(document.querySelector('[data-mock-workbench]')).toBeNull()
    fireEvent.click(primary())
    const bench = document.querySelector('[data-mock-workbench]') as HTMLElement
    expect(bench.dataset.demonstration).toBe('true')
    // Tip flexion is the control the lesson is about; rotation is there to look around.
    expect(bench.dataset.controls).toBe('flexion,roll')
    expect(document.querySelector('[data-task-instruction]')).toHaveTextContent(
      'move Tip flexion both ways',
    )
    // The lead sits above the lab; the rest of the reading follows it.
    expect(screen.getByText(lesson.paragraphs[0])).toBeVisible()
    expect(document.querySelector('[data-teaching-more]')).toHaveTextContent(
      'keep the anterior commissure in view',
    )
    expect(primary()).toBeEnabled()
  })

  it('matches the four parts of the tip, and marks an unsafe transfer answer', () => {
    expect(lesson.matching!.pairs.map((pair) => pair.cue)).toEqual([
      'The lens, looking obliquely forward',
      'The transducer, at the very tip on one side',
      'The working-channel outlet, just behind the transducer',
      'The balloon over the transducer',
    ])
    expect(lesson.sequence).toBeUndefined()
    expect(lesson.transfer.choices.filter((choice) => choice.unsafe)).toHaveLength(1)
    // The demonstration's lab configuration is never used as a gate, but it is a well-formed lab.
    expect(labGoalRequirements(lesson.lab!, {} as never).length).toBeGreaterThan(0)
  })
})
