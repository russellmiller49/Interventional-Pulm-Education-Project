import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { AtrialComponentActivity } from '../components/stage/AtrialComponentActivity'
import { WaveformRecognitionDrill } from '../components/WaveformRecognitionDrill'
import {
  componentIdentificationComplete,
  type ComponentSelection,
} from '../content/introductoryTeaching'
import { hemodynamicsStageLesson } from '../content/stageLessons'
import { emptyCommitments, stepWorkDone } from '../components/stage/stageProgress'
import { icuHemodynamicsReducer } from '../engine/reducer'
import {
  cleanState,
  pressureDemonstrationState,
  CURRENT_RESPONSE_RECHECKED,
  stageGoalMet,
} from '../engine/stageRuntime'
import { ICU_HEMODYNAMICS_LEARN_STORAGE_KEY } from '../engine/learnProgress'
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
    /Volume is one cause/,
  )
  clickPrimary()
  expect(
    screen.getByRole('heading', { name: 'A worked measurement classification' }),
  ).toBeInTheDocument()
  expect(document.querySelectorAll('[data-sort-row]')).toHaveLength(0)
  clickPrimary()
  expect(document.querySelectorAll('[data-sort-row]')).toHaveLength(7)
  expect(nowPrimary()).toBeDisabled()
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
  expect(nowPrimary()).toBeNull()
  fireEvent.click(control('flush'))
  expect(document.querySelector('[data-flush-stale]')).toBeNull()
  expect(nowPrimary()).toBeNull()
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

it('freezing and revealing the normal demonstration never complete the selection task', () => {
  const lesson = hemodynamicsStageLesson('waveform-components')
  const index = lesson.steps.findIndex(
    (step) => step.interaction.kind === 'component-identification',
  )
  const frozen = lesson.runtime.initial()
  expect(frozen.frozen).toBe(true)
  expect(stepWorkDone(lesson.steps[index], index, frozen, emptyCommitments())).toBe(false)
  mountSection('waveform-components')
  fireEvent.click(screen.getByRole('button', { name: /^v wave$/ }))
  clickPrimary()
  expect(nowPrimary()).toBeNull()
  expect(screen.getByText(/0 of 5 components identified/)).toBeInTheDocument()
  expect(localStorage.getItem(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY)).not.toMatch(
    /completedSectionIds":\["waveform-components"/,
  )
})

it('retains an incorrect first component selection, marks the retry as assisted, and resets separately', () => {
  let observed: readonly ComponentSelection[] = []
  function Harness() {
    const [selections, setSelections] = useState<readonly ComponentSelection[]>([])
    return (
      <AtrialComponentActivity
        mode="independent"
        enabled
        selections={selections}
        onChange={(next) => {
          observed = next
          setSelections(next)
        }}
      />
    )
  }
  render(<Harness />)
  fireEvent.click(screen.getByRole('radio', { name: /^Region 1/ })) // v, while asked for a
  fireEvent.click(screen.getByRole('button', { name: 'Check component' }))
  expect(observed[0]).toMatchObject({
    firstRegion: 1,
    selectedRegion: 1,
    attempts: 1,
    assisted: false,
  })
  expect(componentIdentificationComplete(observed, 'independent')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Retry with feedback' }))
  fireEvent.click(screen.getByRole('radio', { name: /^Region 2/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Check component' }))
  expect(observed[0]).toMatchObject({
    firstRegion: 1,
    selectedRegion: 2,
    attempts: 2,
    assisted: true,
  })
  expect(
    screen.getByText(/0 correct on first response without feedback; 1 assisted/),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reset this exercise' }))
  expect(observed).toEqual([
    expect.objectContaining({ firstRegion: 1, selectedRegion: null, attempts: 2, assisted: true }),
  ])
  expect(screen.getByText(/0 of 5 components identified/)).toBeInTheDocument()
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

it('keeps five correct cumulative after an error and emits completion only once', () => {
  const dispatch = jest.fn()
  const view = render(<WaveformRecognitionDrill questionSet="places" dispatch={dispatch} />)
  const labels = [
    'Right atrium',
    'Pulmonary artery',
    'Pulmonary capillary wedge',
    'Right atrium',
    'Pulmonary artery',
    'Right ventricle',
  ]
  for (const [index, pattern] of labels.entries()) {
    const options = [...document.querySelectorAll<HTMLLabelElement>('fieldset label')]
    const option = options.find((label) => new RegExp(pattern, 'i').test(label.textContent ?? ''))
    expect(option).toBeDefined()
    expect(attributesText()).not.toMatch(/This is the right ventricle/)
    fireEvent.click(option!.querySelector('input')!)
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(
      screen.getByText(new RegExp(`${Math.max(0, index)} of 5 correct · ${index + 1} attempted`)),
    ).toBeInTheDocument()
    if (index < labels.length - 1)
      fireEvent.click(screen.getByRole('button', { name: 'Next tracing' }))
  }
  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(dispatch).toHaveBeenCalledWith({ type: 'VALIDATE_SIGNAL', check: 'waveform-recognition' })
  view.rerender(<WaveformRecognitionDrill questionSet="places" dispatch={dispatch} />)
  expect(screen.queryByRole('button', { name: 'Next tracing' })).toBeNull()
  expect(dispatch).toHaveBeenCalledTimes(1)
})

it('retains recognition responses through Back and Return and offers no nonexistent monitor control', () => {
  mountSection('waveform-interpretation')
  advanceToPrediction('waveform-interpretation')
  commitChoice(/The right ventricle/)
  clickPrimary()
  expect(screen.queryByRole('button', { name: 'Show me where' })).toBeNull()
  fireEvent.click(screen.getByRole('radio', { name: /^Right ventricle$/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
  expect(screen.getByText(/1 of 5 correct · 1 attempted/)).toBeInTheDocument()
  fireEvent.click(document.querySelector('[data-now-back]')!)
  expect(document.querySelector('[data-now-status]')).toHaveTextContent('current live state')
  clickPrimary()
  expect(screen.getByText(/1 of 5 correct · 1 attempted/)).toBeInTheDocument()
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
