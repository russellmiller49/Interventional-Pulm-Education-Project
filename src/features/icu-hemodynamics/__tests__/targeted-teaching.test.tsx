import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { AtrialComponentActivity } from '../components/stage/AtrialComponentActivity'
import { WaveformRecognitionDrill } from '../components/WaveformRecognitionDrill'
import type { ComponentSelection } from '../content/introductoryTeaching'
import { hemodynamicsStageLesson } from '../content/stageLessons'
import { emptyCommitments, simulationWorkPerformed } from '../components/stage/stageProgress'
import { icuHemodynamicsReducer } from '../engine/reducer'
import {
  cleanState,
  pressureDemonstrationState,
  CURRENT_RESPONSE_RECHECKED,
  stageGoalMet,
} from '../engine/stageRuntime'
import {
  ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY,
  parseSelfPacedRecord,
} from '../engine/selfPacedProgress'
import {
  advanceToPrediction,
  clickPrimary,
  commitChoice,
  control,
  currentStepId,
  goalStates,
  installDom,
  mountSection,
  nowPrimary,
  setLevel,
  attributesText,
  scannableText,
} from '../test-support/stageHarness'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
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
  installDom()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

it('shows the orientation and worked example before the vignette, then teaches sort categories without counting a row', () => {
  mountSection('why-measure')
  expect(
    screen.getByRole('heading', { name: 'Measurements and their origins' }),
  ).toBeInTheDocument()
  expect(screen.getByText(/thermistor senses temperature/)).toBeInTheDocument()
  expect(document.querySelector('[data-prediction-choices]')).toBeNull()
  expect(document.querySelector('[data-teaching-block="stop"]')).toBeNull()
  clickPrimary()
  expect(document.querySelector('[data-prediction-choices]')).not.toBeNull()
  expect(document.querySelector('[data-current-teaching]')).toBeNull()
  expect(document.querySelector('[data-answer-verdict]')).toBeNull()
  commitChoice(/circulation is under-filled/)
  expect(document.querySelector('[data-answer-verdict]')?.textContent).toMatch(
    /Low circulating volume is one cause/,
  )
  clickPrimary()
  expect(
    screen.getByRole('heading', { name: 'A worked measurement classification' }),
  ).toBeInTheDocument()
  expect(document.querySelectorAll('[data-sort-row]')).toHaveLength(0)
  clickPrimary()
  expect(document.querySelectorAll('[data-sort-row]')).toHaveLength(7)
  expect(nowPrimary()).toHaveTextContent('Continue without sorting')
  expect(document.querySelector('[data-now-card] [data-question-check]')).toBeDisabled()
})

it('starts each pressure demonstration from its stated baseline and keeps level, zero and scale distinct', () => {
  for (const topic of ['level', 'scale', 'response'] as const) {
    const state = pressureDemonstrationState(topic)
    expect(state.measurementSystem).toMatchObject({
      transducerLevelCm: 0,
      zeroed: true,
      dampingRatio: 0.65,
      artifact: 'none',
    })
    expect(state.signalValidationChecks).not.toContain(CURRENT_RESPONSE_RECHECKED)
  }
  const zero = pressureDemonstrationState('zero')
  expect(zero.measurementSystem).toMatchObject({
    transducerLevelCm: 0,
    zeroed: false,
    artifact: 'none',
  })
  const high = icuHemodynamicsReducer(zero, { type: 'SET_TRANSDUCER_LEVEL', levelCm: 10 })
  const zeroedHigh = icuHemodynamicsReducer(high, { type: 'ZERO_TRANSDUCER' })
  expect(zeroedHigh.measurementSystem.transducerLevelCm).toBe(10)
  expect(zeroedHigh.measurements.meanPapMmHg).not.toBe(cleanState(510).measurements.meanPapMmHg)
  const clean = cleanState()
  const scaled = icuHemodynamicsReducer(clean, { type: 'SET_PRESSURE_SCALE', maximum: 240 })
  expect(scaled.measurements).toEqual(clean.measurements)
})

it('requires a new observation after simulated correction and rejects stale classification', () => {
  mountSection('pressure-system')
  advanceToPrediction('pressure-system')
  commitChoice(/off level, not zeroed, and underdamped/)
  clickPrimary()
  setLevel(0)
  fireEvent.click(control('zero'))
  clickPrimary()
  fireEvent.click(control('flush'))
  expect(document.querySelector('[data-flush-classification]')).toBeDisabled()
  act(() => {
    jest.advanceTimersByTime(3500)
  })
  fireEvent.click(document.querySelector('[data-flush-classification] input[value="overdamped"]')!)
  fireEvent.click(screen.getByRole('button', { name: 'Say what it is' }))
  expect(goalStates()).toEqual(['true', 'false', 'false', 'false'])
  fireEvent.click(document.querySelector('[data-flush-classification] input[value="underdamped"]')!)
  fireEvent.click(screen.getByRole('button', { name: 'Say what it is' }))
  fireEvent.click(control('repair'))
  expect(document.querySelector('[data-flush-stale]')).toHaveTextContent('Before correction')
  expect(document.querySelector('[data-flush-classification]')).toBeDisabled()
  expect(goalStates()).toEqual(['true', 'true', 'true', 'false'])
  // The step is not performed until the corrected line is observed again; moving on stays open.
  expect(nowPrimary()).toHaveTextContent('Continue without these actions')
  fireEvent.click(control('flush'))
  expect(document.querySelector('[data-flush-stale]')).toBeNull()
  expect(nowPrimary()).toHaveTextContent('Continue without these actions')
  act(() => {
    jest.advanceTimersByTime(3500)
  })
  fireEvent.click(document.querySelector('[data-flush-classification] input[value="underdamped"]')!)
  fireEvent.click(screen.getByRole('button', { name: 'Say what it is' }))
  expect(goalStates().at(-1)).toBe('false')
  expect(
    document.querySelector('[data-flush-classification] input[value="acceptable"]'),
  ).not.toBeDisabled()
  fireEvent.click(document.querySelector('[data-flush-classification] input[value="acceptable"]')!)
  fireEvent.click(screen.getByRole('button', { name: 'Say what it is' }))
  expect(goalStates()).toEqual(['true', 'true', 'true', 'true'])
  // A new line adjustment invalidates the current observation even if an old generic check remains.
  setLevel(1)
  expect(goalStates().at(-1)).toBe('false')
})

it('enforces the flush safety guard in the reducer, including spontaneous wedge and movement', () => {
  for (const variant of [
    cleanState(510, 'wedge'),
    { ...cleanState(), catheter: { ...cleanState().catheter, balloonInflated: true } },
    { ...cleanState(), catheter: { ...cleanState().catheter, floatBalloonInflated: true } },
    icuHemodynamicsReducer(cleanState(510, 'ra'), { type: 'ADVANCE_CATHETER' }),
  ]) {
    const result = icuHemodynamicsReducer(variant, {
      type: 'FAST_FLUSH',
      lineType: 'pulmonary-artery',
    })
    expect(result.signalValidationChecks).not.toContain('fast-flush')
    expect(result.measurementSystem.fastFlushStartedAt).toBe(
      variant.measurementSystem.fastFlushStartedAt,
    )
    expect(result.responseMessage).toMatch(/blocked/)
    expect(stageGoalMet({ type: 'check', id: CURRENT_RESPONSE_RECHECKED }, result)).toBe(false)
    expect(
      icuHemodynamicsReducer(variant, { type: 'FAST_FLUSH', lineType: 'systemic-arterial' })
        .signalValidationChecks,
    ).toContain('fast-flush')
  }
})

it('viewing the demonstration or showing a component records no selection and performs nothing', () => {
  const lesson = hemodynamicsStageLesson('waveform-components')
  const index = lesson.steps.findIndex(
    (step) => step.interaction.kind === 'component-identification',
  )
  const frozen = lesson.runtime.initial()
  expect(frozen.frozen).toBe(true)
  expect(simulationWorkPerformed(lesson.steps[index], frozen, emptyCommitments(), frozen)).toBe(
    false,
  )
  mountSection('waveform-components')
  fireEvent.click(screen.getByRole('button', { name: /^v wave$/ }))
  clickPrimary()
  expect(nowPrimary()).toHaveTextContent('Continue')
  fireEvent.click(screen.getByRole('button', { name: 'Show this component' }))
  expect(document.querySelector('[data-component-reveal="shown"]')).not.toBeNull()
  clickPrimary()
  const rows = [...document.querySelectorAll('[data-step-list] li')].map((row) =>
    row.getAttribute('data-step-state'),
  )
  expect(rows[index]).toBe('passed')
  expect(
    parseSelfPacedRecord(localStorage.getItem(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY))
      ?.reviewedSectionIds,
  ).toEqual([])
})

it('lets a retry replace the checked region, and counts neither first responses nor retries', () => {
  let observed: readonly ComponentSelection[] = []
  function Harness() {
    const [selections, setSelections] = useState<
      Partial<Record<'guided' | 'independent', readonly ComponentSelection[]>>
    >({})
    return (
      <AtrialComponentActivity
        enabled
        selections={selections}
        onChange={(numbering, next) => {
          observed = next
          setSelections((current) => ({ ...current, [numbering]: next }))
        }}
      />
    )
  }
  render(<Harness />)
  // HD-02: the renumbered practice is a repeat inside the one activity, not a separate step.
  fireEvent.click(screen.getByRole('button', { name: 'Renumbered repeat · model variant' }))
  fireEvent.click(screen.getByRole('radio', { name: /^Region 1/ })) // v, while asked for a
  fireEvent.click(screen.getByRole('button', { name: 'Check component' }))
  expect(observed).toEqual([{ component: 'a', selectedRegion: 1 }])
  expect(screen.getByText('Compare the timing.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  fireEvent.click(screen.getByRole('radio', { name: /^Region 2/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Check component' }))
  expect(observed).toEqual([{ component: 'a', selectedRegion: 2 }])
  expect(screen.getByText('Component identified.')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/first response|assisted|components identified/i)
  fireEvent.click(screen.getByRole('button', { name: 'Next component' }))
  fireEvent.click(screen.getByRole('button', { name: 'Show this component' }))
  expect(observed).toEqual([{ component: 'a', selectedRegion: 2 }])
  expect(screen.getByText('Shown without an answer.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear this exercise' }))
  expect(observed).toEqual([])
})

it('uses the abnormal question trace, protects its solution, and restores identifying feedback after a wrong answer', () => {
  const { lesson } = mountSection('waveform-components')
  advanceToPrediction('waveform-components')
  expect(currentStepId()).toBe(lesson.steps[lesson.predictionStepIndex].id)
  expect(screen.getByText('Right-atrial question trace')).toBeInTheDocument()
  expect(`${scannableText()} ${attributesText()}`).not.toMatch(
    /tricuspid regurgitation|regurgitant/i,
  )
  commitChoice(/Pericardial constraint/)
  expect(document.querySelector('[data-answer-verdict]')).not.toBeNull()
  expect(
    screen.getByText(/tricuspid regurgitation/i, { selector: 'figcaption strong' }),
  ).toBeInTheDocument()
})

// HD-02 replaced "marks practice only on a checked answer": the practice sends nothing to the
// simulation and has no stage goal to mark.
it('moves between tracings freely, never counts answers, and marks nothing', () => {
  render(<WaveformRecognitionDrill />)
  // Move on without answering, then show the labels without answering.
  fireEvent.click(screen.getByRole('button', { name: 'Next tracing' }))
  fireEvent.click(screen.getByRole('button', { name: 'Show the labels and explanation' }))
  expect(document.querySelector('[data-recognition-reveal="shown"]')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Next tracing' }))
  // A wrong answer gets feedback, not a count.
  const wrong = [...document.querySelectorAll<HTMLLabelElement>('fieldset label')].find((label) =>
    /Right atrium/i.test(label.textContent ?? ''),
  )!
  fireEvent.click(wrong.querySelector('input')!)
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
  expect(document.querySelector('[data-recognition-reveal="checked"]')).not.toBeNull()
  expect(document.body.textContent).not.toMatch(/of 5 correct|attempted|five correct/i)
  expect(screen.getByRole('button', { name: 'Next tracing' })).toBeEnabled()
})

it('keeps a checked tracing through Back and Return and offers no nonexistent monitor control', () => {
  mountSection('waveform-interpretation')
  advanceToPrediction('waveform-interpretation')
  commitChoice(/The right ventricle/)
  clickPrimary()
  expect(screen.queryByRole('button', { name: 'Show me where' })).toBeNull()
  fireEvent.click(screen.getByRole('radio', { name: /^Right ventricle$/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
  expect(document.querySelector('[data-recognition-reveal="checked"]')).not.toBeNull()
  fireEvent.click(document.querySelector('[data-now-back]')!)
  expect(document.querySelector('[data-now-status]')).toHaveTextContent('current live state')
  clickPrimary()
  expect(document.querySelector('[data-recognition-reveal="checked"]')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Next tracing' })).toBeEnabled()
})

it.each(['catheter-advancement', 'pawp-capture'])(
  'exposes existing safety teaching before the first decision in %s',
  (sectionId) => {
    mountSection(sectionId)
    expect(
      document.querySelector(
        sectionId === 'catheter-advancement'
          ? '[data-teaching-block="stop-conditions"]'
          : '[data-teaching-block="wedge-sequence"]',
      ),
    ).not.toBeNull()
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
  },
)
