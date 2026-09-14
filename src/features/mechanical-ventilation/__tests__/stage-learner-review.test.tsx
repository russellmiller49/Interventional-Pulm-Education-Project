import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilatorDeviceProfiles } from '../content/deviceProfiles'
import { ventilationUnitPresentation } from '../content/taskPresentation'
import { parseLabProgress, VENTILATION_LAB_STORAGE_KEY } from '../engine/learningLab'
import { breathStopIds } from '../content/breathSpine'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { ventilationExperimentByUnit } from '../content/learningExperiments'
import { ventilationStageLesson, ventilationStageLessonErrors } from '../content/stageLessons'

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

function mount(unitId: string) {
  render(<VentilationStageHost unitId={unitId} />)
  boot()
  return ventilationStageLesson(unitId)
}
function reachMechanicsAction() {
  mount('mechanics-load-and-pressure')
  fireEvent.click(primary()!)
  expect(document.querySelector('[data-controls-locked-note]')).toHaveTextContent(
    'locked while you decide',
  )
  expect(document.querySelector('[data-reset-patient]')).toBeDisabled()
  fireEvent.click(within(nowCard()).getAllByRole('radio')[0])
  fireEvent.click(primary()!)
  fireEvent.click(primary()!)
}

describe('task presentation replaces pane navigation', () => {
  it.each(ventilationLearningUnits.map((unit) => unit.id))(
    '%s has one task, explicit presentation and stable identities',
    (unitId) => {
      const lesson = mount(unitId)
      expect(ventilationStageLessonErrors(lesson)).toEqual([])
      expect(Object.keys(ventilationUnitPresentation)).toHaveLength(14)
      expect(document.querySelectorAll('[data-now-card]')).toHaveLength(1)
      expect(document.querySelector('[data-pane]')).toBeNull()
      expect(screen.queryByRole('tablist', { name: 'Workspace panel views' })).toBeNull()
      expect(document.querySelector('[data-task-map]')).not.toHaveAttribute('open')
      expect(whereLine()).toContain(lesson.steps[0].presentation.landmark)
      for (const step of lesson.steps) {
        expect(step.presentation.landmark.length).toBeGreaterThan(10)
        expect(step.id).toContain(unitId)
      }
      expect(primary()).toBeEnabled()
      fireEvent.click(document.querySelector('[data-stage-help]')!)
      expect(document.querySelector('[data-stage-help-dialog]')?.textContent).toContain(
        lesson.steps[0].presentation.landmark,
      )
    },
  )

  it('retains a local rollback renderer without changing the patient or curriculum', () => {
    const view = render(<VentilationStageHost unitId="mechanics-load-and-pressure" />)
    boot()
    const stage = stageId()
    const before = localStorage.getItem(VENTILATION_LAB_STORAGE_KEY)
    view.rerender(<VentilationStageHost unitId="mechanics-load-and-pressure" renderer="legacy" />)
    expect(stageId()).toBe(stage)
    expect(document.querySelectorAll('[data-pane]')).toHaveLength(3)
    expect(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY)).toBe(before)
  })

  it('keeps every waveform stop and all linked cursors on the same reference', () => {
    mount('waveform-anatomy')
    for (const stop of breathStopIds) {
      expect(document.querySelector('[data-guided-stop]')).toHaveAttribute('data-guided-stop', stop)
      const cursors = [...document.querySelectorAll('[data-time-cursor]')].map((node) =>
        node.getAttribute('data-time-cursor'),
      )
      expect(cursors).toHaveLength(3)
      expect(new Set(cursors).size).toBe(1)
      fireEvent.click(primary()!)
    }
  })
})

describe('control semantics and read-only review', () => {
  it('makes supported bedside assessment available without replacing required measurements', () => {
    mount('high-peak-pressure-integration')
    fireEvent.click(primary()!)
    fireEvent.click(within(nowCard()).getAllByRole('radio')[0])
    fireEvent.click(primary()!)
    fireEvent.click(primary()!)
    expect(document.querySelector('[data-metric="plateau"] dd')).toHaveTextContent(
      'Acquire a current inspiratory hold',
    )
    expect(document.querySelector('[data-metric="plateau"] small')).toBeNull()
    fireEvent.click(screen.getByText('Console and experiment options'))
    fireEvent.click(screen.getByRole('button', { name: /View full .* console/ }))
    expect(screen.getByText(/plateau pressure has not been acquired/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Return to task controls' }))
    const assess = screen.getByRole('button', { name: 'Assess the patient' })
    expect(assess).toBeEnabled()
    fireEvent.click(assess)
    const saved = parseLabProgress(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY)).units[
      'high-peak-pressure-integration'
    ]!
    expect(saved.events.at(-1)?.action).toEqual({
      type: 'PERFORM_INTERVENTION',
      interventionId: 'assess-patient',
    })
    expect(saved.holds).toEqual([])
    expect(document.querySelectorAll('[data-step-goals] li[data-met="true"]')).toHaveLength(0)
    expect(primary()).toBeNull()
  })

  it('distinguishes patient properties, playback, and an actual acquired hold', () => {
    reachMechanicsAction()
    expect(
      screen.getByText(/Experimental conditions; these are not bedside treatment controls/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Playback controls do not acquire a pressure/)).toBeInTheDocument()
    fireEvent.change(screen.getByRole('slider', { name: /Patient resistance/ }), {
      target: { value: '2' },
    })
    expect(document.querySelectorAll('[data-step-goals] li[data-met="true"]')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /Perform inspiratory hold/ }))
    simulate(6)
    expect(document.querySelectorAll('[data-step-goals] li[data-met="true"]')).toHaveLength(2)
    fireEvent.click(primary()!)
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(screen.getByRole('button', { name: /Advance one breath/ })).toBeDisabled()
    expect(screen.getByRole('slider', { name: /Patient resistance/ })).toBeDisabled()
    expect(document.querySelector('[data-reset-patient]')).toBeDisabled()
    expect(document.querySelector('[data-controls-locked-note]')?.textContent).toMatch(
      /paused while you look back/,
    )
  })

  it('describes reset beside the action and preserves the first prediction in a clean repeat', () => {
    reachMechanicsAction()
    fireEvent.click(screen.getByText('Console and experiment options'))
    const reset = screen.getByRole('button', { name: 'Reset patient' })
    expect(document.getElementById(reset.getAttribute('aria-describedby')!)).toHaveTextContent(
      /first prediction stays/,
    )
    fireEvent.change(screen.getByRole('slider', { name: /Patient resistance/ }), {
      target: { value: '2' },
    })
    const before = parseLabProgress(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY)).units[
      'mechanics-load-and-pressure'
    ]!
    fireEvent.click(reset)
    const after = parseLabProgress(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY)).units[
      'mechanics-load-and-pressure'
    ]!
    expect(after.evidence[0].prediction).toBe(before.evidence[0].prediction)
    expect(after.history!.length).toBeGreaterThan(before.history?.length ?? 0)
    expect(document.querySelectorAll('[data-step-goals] li[data-met="true"]')).toHaveLength(0)
  })

  it.each(ventilatorDeviceProfiles)(
    '$shortName preserves confirmation and pending edits across native view changes',
    (profile) => {
      mount('controls-and-goals')
      fireEvent.click(primary()!)
      fireEvent.click(screen.getByText('Console and experiment options'))
      fireEvent.change(screen.getByRole('combobox', { name: 'Console' }), {
        target: { value: profile.id },
      })
      // Device selection intentionally rebuilds the uncommitted round, returning to prerequisite.
      if (!document.querySelector('[data-prediction-choices]')) fireEvent.click(primary()!)
      fireEvent.click(within(nowCard()).getAllByRole('radio')[0])
      fireEvent.click(primary()!)
      fireEvent.click(primary()!)
      const snapshot = () =>
        parseLabProgress(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY)).units[
          'controls-and-goals'
        ]!
      const events = snapshot().events.length
      const setting = document.getElementById('mv-quick-vtMl')!
      fireEvent.change(setting, { target: { value: '500' } })
      expect(snapshot().events.length).toBe(
        events + (profile.commitBehavior === 'immediate' ? 1 : 0),
      )
      fireEvent.click(screen.getByText('Console and experiment options'))
      fireEvent.click(screen.getByRole('button', { name: /View full .* console/ }))
      expect(document.querySelectorAll('[data-device]')).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: 'Return to task controls' }))
      expect(document.querySelectorAll('#mv-quick-vtMl')).toHaveLength(1)
      expect(document.getElementById('mv-quick-vtMl')).toHaveValue('500')
      if (profile.commitBehavior !== 'immediate')
        fireEvent.click(
          screen.getByRole('button', {
            name: profile.id === 'carefusion-avea' ? 'ACCEPT' : 'Press knob to confirm',
          }),
        )
      expect(snapshot().events.length).toBe(events + 1)
      expect(screen.getByRole('combobox', { name: 'Console' })).toBeDisabled()
    },
  )
})

describe('the card keeps the promise the step makes', () => {
  const unitId = 'mechanics-load-and-pressure'

  it('renders the verdict in full on the Explain step, the explanation and the other answers included', () => {
    const lesson = mount(unitId)
    const first = ventilationExperimentByUnit.get(unitId)!.rounds[0]
    fireEvent.click(primary()!)
    fireEvent.click(within(nowCard()).getByRole('radio', { name: first.choices[first.correct] }))
    fireEvent.click(primary()!)
    fireEvent.click(primary()!)
    fireEvent.change(screen.getByRole('slider', { name: /Patient resistance/ }), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Perform inspiratory hold/ }))
    simulate(6)
    fireEvent.click(primary()!)
    simulate(first.seconds + 1)
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[4].id)
    fireEvent.click(within(nowCard()).getByRole('radio', { name: 'Rose' }))
    fireEvent.click(primary()!)
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[5].id)
    expect(lesson.steps[5].instruction).toMatch(/^Compare the recorded response/)
    const recap = document.querySelector('[data-explain-recap]')
    expect(recap?.textContent).toMatch(/Correct\. That prediction holds/)
    expect(recap?.querySelector('[data-answer-verdict]')).not.toBeNull()
    expect(recap?.querySelector('[data-how-to-distinguish] strong')?.textContent).toBe(
      'The explanation',
    )
    expect(recap?.querySelector('[data-how-to-distinguish]')?.textContent).toContain(
      first.explanation,
    )
    expect(recap?.querySelectorAll('[data-other-answers] li')).toHaveLength(2)
    // Once on the card, not twice.
    expect(screen.getAllByText(first.explanation)).toHaveLength(1)
    expect(document.querySelector('[data-before-after]')).not.toBeNull()
  })

  it('shows the verdict again when the learner looks back at the prediction', () => {
    const lesson = mount(unitId)
    const first = ventilationExperimentByUnit.get(unitId)!.rounds[0]
    fireEvent.click(primary()!)
    fireEvent.click(within(nowCard()).getByRole('radio', { name: first.choices[0] }))
    fireEvent.click(primary()!)
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[2].id)
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(stageId()).toBe(lesson.steps[1].id)
    const verdict = nowCard().querySelector('[data-answer-verdict]')
    expect(verdict?.getAttribute('data-verdict-outcome')).toBe('correct')
    expect(verdict?.querySelector('[data-other-answers]')).not.toBeNull()
  })

  it('frames a prediction as a prediction, and a location read as a read', () => {
    const lesson = mount(unitId)
    const first = ventilationExperimentByUnit.get(unitId)!.rounds[0]
    fireEvent.click(primary()!)
    const wrong = first.choices.find((_, index) => index !== first.correct)!
    fireEvent.click(within(nowCard()).getByRole('radio', { name: wrong }))
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[1].id)
    expect(nowCard().querySelector('[data-answer-verdict] p')?.textContent).toBe(
      'Not correct. That mechanism predicts a different response',
    )
    cleanup()

    mount('triggering-and-cycling')
    fireEvent.click(primary()!)
    const answer = document.querySelector('[data-location-choices]') as HTMLElement
    fireEvent.click(within(answer).getAllByRole('radio')[0])
    fireEvent.click(primary()!)
    expect(nowCard().querySelector('[data-answer-verdict] p')?.textContent).toMatch(
      /^(Correct\. That read holds|Not correct\. That mechanism predicts a different pattern)$/,
    )
    expect(nowCard().querySelector('[data-how-to-distinguish] strong')?.textContent).toBe(
      'How to distinguish it',
    )
  })
})
