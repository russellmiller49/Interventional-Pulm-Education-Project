import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { STAGE_PANE_NAMES } from '@/features/learning-module/stage/stageModel'

import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { ventilationExperimentByUnit } from '../content/learningExperiments'
import { ventilationStageLesson, ventilationStageLessonErrors } from '../content/stageLessons'

/**
 * What the September 2026 learner-review round changed on this module's stage, pinned.
 *
 * The findings came from a walk of the ECMO Learn pathway by someone who had not built it, and the
 * ones that transfer are properties of the shape this module shares: panes with names only in
 * `aria-label`, steps that name no pane, a surface a step points at that carries no printed name.
 * The record beside this module's docs says what each became; this suite says it stays. It also
 * re-pins the pane order D2 recorded, whose previous guard was retired with the flow rebuild.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  Element.prototype.scrollIntoView = jest.fn()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

const boot = () => act(() => jest.advanceTimersByTime(10))
const simulate = (seconds: number) => act(() => jest.advanceTimersByTime(seconds * 1000))
const nowCard = () => document.querySelector('[data-now-card]') as HTMLElement
const primary = () => document.querySelector('[data-now-primary]') as HTMLButtonElement | null
const stageId = () => document.querySelector('[data-stage]')?.getAttribute('data-stage')
const whereLine = () => document.querySelector('[data-now-card] [data-now-where]')?.textContent

function paneOrder(): readonly string[] {
  return [...document.querySelectorAll('[data-pane]')].map(
    (pane) => pane.getAttribute('data-pane') ?? '',
  )
}

function captions(): readonly string[] {
  return [...document.querySelectorAll('[data-pane-label]')].map((label) => label.textContent ?? '')
}

function mount(unitId: string) {
  render(<VentilationStageHost unitId={unitId} />)
  boot()
  return ventilationStageLesson(unitId)
}

describe('the panes say what they are', () => {
  it('keeps the recorded order — ventilator, teaching, steps — and prints a name on each', () => {
    mount('mechanics-load-and-pressure')
    // D2 §2: live ventilator → teaching → learner action. Its old guard was retired with the
    // flow rebuild; this is the guard again.
    expect(paneOrder()).toEqual(['simulator', 'teaching', 'task'])
    expect(captions()).toEqual([
      'Simulator panel · the live ventilator, the quick controls and the breath map',
      'Teaching panel · what to read',
      'Steps panel · what to do',
    ])
    for (const name of Object.values(STAGE_PANE_NAMES)) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
  })
})

describe('every step says where it is worked', () => {
  it('authors a location on every step of every section, and the builder would refuse one without', () => {
    for (const unit of ventilationLearningUnits) {
      const lesson = ventilationStageLesson(unit.id)
      expect(ventilationStageLessonErrors(lesson)).toEqual([])
      for (const step of lesson.steps) {
        expect(`${unit.id} ${step.id}: ${step.lookIn.pane}`).toMatch(
          /: (steps|teaching|simulator)$/,
        )
        expect(step.lookIn.landmark.trim().length).toBeGreaterThan(0)
      }
    }
    const lesson = ventilationStageLesson('waveform-anatomy')
    const broken = {
      ...lesson,
      steps: lesson.steps.map((step, index) =>
        index === 0 ? { ...step, lookIn: { pane: 'teaching', landmark: 'Teaching panel' } } : step,
      ),
    } as typeof lesson
    expect(ventilationStageLessonErrors(broken)).toEqual([
      'waveform-anatomy step 1 uses a pane name as a landmark inside that pane.',
    ])
  })

  it('prints the location under the instruction, naming a pane whose caption says the same word', () => {
    const lesson = mount('breathing-with-support')
    expect(whereLine()).toBe(
      'Where to look: Teaching panel — Why a ventilator exists, and Simulator panel — the live console.',
    )
    // The heading it names is on the teaching pane at this step, open.
    expect(
      within(
        document.querySelector('[data-teaching-block="orientation"]') as HTMLElement,
      ).getByRole('heading', { name: 'Why a ventilator exists' }),
    ).toBeInTheDocument()
    const printed = captions()
    for (const named of nowCard().querySelectorAll('[data-now-where] strong')) {
      expect(printed.some((caption) => caption.startsWith(named.textContent ?? '∅'))).toBe(true)
    }
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[1].id)
    expect(whereLine()).toBe(
      'Where to look: Steps panel — the answer choices below, and Simulator panel — the live console.',
    )
  })

  it('repeats the location in the help dialog', () => {
    mount('breathing-with-support')
    fireEvent.click(document.querySelector('[data-stage-help]')!)
    expect(document.querySelector('[data-stage-help-dialog]')?.textContent).toMatch(
      /Where to look: Teaching panel — Why a ventilator exists/,
    )
  })

  it('points a location question at the map, the walk at the stop card, and the reveal at the picture and the checklist', () => {
    const locate = ventilationStageLesson('triggering-and-cycling').steps[0]
    expect(locate.lookIn).toEqual({
      pane: 'simulator',
      landmark: 'the numbered stops on the breath map',
      alsoPane: 'steps',
      alsoLandmark: 'Commit my answer, on this card',
    })
    const walk = ventilationStageLesson('waveform-anatomy').steps[0]
    expect(walk.lookIn.pane).toBe('steps')
    expect(walk.lookIn.alsoPane).toBe('simulator')
    const explain = ventilationStageLesson('mechanics-load-and-pressure').steps[4]
    expect(explain.phase).toBe('explain')
    expect(explain.lookIn).toEqual({
      pane: 'steps',
      landmark: 'the verdict and what changed, below',
      alsoPane: 'teaching',
      alsoLandmark: 'The picture and the checklist',
    })
    const bedside = ventilationStageLesson('safety-reassessment-and-human-factors').steps[0]
    expect(bedside.lookIn.landmark).toBe('Patient and circuit findings, below the breath map')
  })

  it('names the surfaces the act and observe steps are worked on, in the words they carry', () => {
    const unitId = 'mechanics-load-and-pressure'
    const lesson = mount(unitId)
    const first = ventilationExperimentByUnit.get(unitId)!.rounds[0]
    fireEvent.click(primary()!)
    fireEvent.click(within(nowCard()).getByRole('radio', { name: first.choices[first.correct] }))
    fireEvent.click(primary()!)
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[2].id)
    expect(whereLine()).toBe(
      'Where to look: Simulator panel — Quick controls for this step, under the console.',
    )
    expect(screen.getByRole('region', { name: 'Quick controls for this step' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('slider', { name: /Patient resistance/ }), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Perform inspiratory hold/ }))
    simulate(6)
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[3].id)
    expect(whereLine()).toBe(
      'Where to look: Simulator panel — Readings to watch, under the console.',
    )
    // The label the step names is printed on the readings, not only in an accessible name.
    const readings = document.querySelector('[data-live-readings]') as HTMLElement
    expect(within(readings).getByText('Readings to watch')).toBeInTheDocument()
    expect(readings.getAttribute('aria-labelledby')).toBeTruthy()
    simulate(first.seconds + 1)
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[4].id)
    expect(whereLine()).toBe(
      'Where to look: Steps panel — the verdict and what changed, below, and Teaching panel — The picture and the checklist.',
    )
    expect(
      within(document.querySelector('[data-teaching-block="method"]') as HTMLElement).getByRole(
        'heading',
        { name: 'The picture and the checklist' },
      ),
    ).toBeInTheDocument()
  })
})
