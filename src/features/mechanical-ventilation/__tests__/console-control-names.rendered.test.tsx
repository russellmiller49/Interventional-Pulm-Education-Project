/**
 * Task copy names the cycle-off threshold and the rise time in the selected console's own words.
 *
 * The rounds and the generated task titles printed the Hamilton names "ETS" and "P-ramp" on every
 * console. The author's ruling of 2026-11-12 ("Follow the console"): the copy reads the selected
 * console's label after the clinical term, and no console shows another manufacturer's label.
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, render } from '@testing-library/react'

import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { VENTILATION_DEVICE_PREFERENCE_KEY } from '../components/stage/useVentilationLabSession'
import {
  consoleControlLabel,
  consoleControlTerm,
  consoleNamedControls,
  hasConsoleToken,
} from '../content/consoleWording'
import { getVentilatorDeviceProfile } from '../content/deviceProfiles'
import { ventilationExperimentsForDevice } from '../content/learningExperiments'
import { ventilationStageLesson } from '../content/stageLessons'
import { ventilationRoundItem } from '../content/stageItems'
import { ventilatorDeviceIds, type VentilatorDeviceId } from '../engine/types'
import { chooseStep } from '../test-support/stageHost'

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
  useRouter: () => ({ push: jest.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

/** Each console's own labels for the two controls, as its profile defines them. */
const expectedLabels: Record<VentilatorDeviceId, { etsPercent: string; pRampMs: string }> = {
  'hamilton-c6': { etsPercent: 'ETS', pRampMs: 'P-ramp' },
  'drager-evita-v800-v600': { etsPercent: 'Insp term', pRampMs: 'Slope' },
  'puritan-bennett-980': { etsPercent: 'ESENS', pRampMs: 'Rise Time' },
  'carefusion-avea': { etsPercent: 'PSV Cycle', pRampMs: 'Insp Rise' },
}

/*
 * Every other console's label, as a whole word and in its own case. The PB980's "Rise Time" is the
 * clinical term itself, which every console prints in lower case, so it is not a foreign label.
 */
function foreignLabels(deviceId: VentilatorDeviceId): RegExp[] {
  return ventilatorDeviceIds
    .filter((other) => other !== deviceId)
    .flatMap((other) => consoleNamedControls.map((key) => consoleControlLabel(other, key)))
    .filter(
      (label) => label !== 'Rise Time' && label !== consoleControlLabel(deviceId, 'etsPercent'),
    )
    .filter((label) => label !== consoleControlLabel(deviceId, 'pRampMs'))
    .map((label) => new RegExp(`(^|[^A-Za-z-])${label.replace(/[-]/g, '\\-')}($|[^A-Za-z-])`))
}

function allRoundCopy(deviceId: VentilatorDeviceId): string[] {
  return ventilationExperimentsForDevice(deviceId).flatMap((experiment) =>
    experiment.rounds.flatMap((round) => [
      round.title,
      round.introduction,
      round.look,
      round.prompt,
      ...round.choices,
      ...round.rationales,
      round.task,
      round.explanation,
      round.hint,
      round.relation?.note ?? '',
    ]),
  )
}

function allStepCopy(deviceId: VentilatorDeviceId): string[] {
  return ventilationExperimentsForDevice(deviceId).flatMap((experiment) =>
    ventilationStageLesson(experiment.unitId, deviceId).steps.flatMap((step) => [
      step.title,
      step.instruction,
      ...('item' in step.interaction
        ? [
            step.interaction.item.stem,
            ...step.interaction.item.choices.flatMap((choice) => [choice.label, choice.rationale]),
          ]
        : []),
    ]),
  )
}

describe('the console’s own control names', () => {
  it('reads each label from the console profile the console tile prints', () => {
    for (const deviceId of ventilatorDeviceIds) {
      const profile = getVentilatorDeviceProfile(deviceId)
      expect(profile.controlLabels.etsPercent).toBe(expectedLabels[deviceId].etsPercent)
      expect(profile.controlLabels.pRampMs).toBe(expectedLabels[deviceId].pRampMs)
    }
    expect(consoleControlTerm('hamilton-c6', 'etsPercent')).toBe('cycle-off threshold (ETS)')
    expect(consoleControlTerm('drager-evita-v800-v600', 'pRampMs')).toBe('rise time (Slope)')
    // A label that is the clinical term itself is not repeated in brackets.
    expect(consoleControlTerm('puritan-bennett-980', 'pRampMs')).toBe('rise time')
    expect(consoleControlTerm('carefusion-avea', 'etsPercent')).toBe(
      'cycle-off threshold (PSV Cycle)',
    )
  })

  it.each(ventilatorDeviceIds)(
    '%s: every round, step and question resolves its names and shows no other console’s',
    (deviceId) => {
      const copy = [...allRoundCopy(deviceId), ...allStepCopy(deviceId)]
      for (const line of copy) expect(hasConsoleToken(line)).toBe(false)
      const foreign = foreignLabels(deviceId)
      for (const line of copy)
        for (const pattern of foreign)
          expect({ line, found: pattern.test(line) }).toEqual({
            line,
            found: false,
          })
      const text = copy.join('\n')
      expect(text).toContain(consoleControlTerm(deviceId, 'etsPercent'))
      expect(text).toContain(consoleControlTerm(deviceId, 'pRampMs'))
    },
  )

  it('keeps step ids and item ids the same on every console', () => {
    for (const experiment of ventilationExperimentsForDevice('hamilton-c6')) {
      const ids = ventilationStageLesson(experiment.unitId).steps.map((step) => step.id)
      for (const deviceId of ventilatorDeviceIds) {
        expect(ventilationStageLesson(experiment.unitId, deviceId).steps.map((s) => s.id)).toEqual(
          ids,
        )
        expect(ventilationRoundItem(experiment.unitId, 1, deviceId).id).toBe(
          ventilationRoundItem(experiment.unitId, 1).id,
        )
      }
    }
  })
})

/** The Now card and the task list, as printed. */
function surfaceText(): string {
  return [...document.querySelectorAll<HTMLElement>('[data-now-card], [data-task-map]')]
    .map((root) => root.textContent ?? '')
    .join(' ')
}

function mount(unitId: string, deviceId: VentilatorDeviceId) {
  localStorage.setItem(VENTILATION_DEVICE_PREFERENCE_KEY, deviceId)
  render(<VentilationStageHost unitId={unitId} />)
  act(() => jest.advanceTimersByTime(10))
}

describe.each(ventilatorDeviceIds)('rendered on the %s face', (deviceId) => {
  const cycleOff = consoleControlTerm(deviceId, 'etsPercent')
  const riseTime = consoleControlTerm(deviceId, 'pRampMs')

  it('Section 8: the cycle-off task and its title use this console’s name', () => {
    mount('triggering-and-cycling', deviceId)
    const lesson = ventilationStageLesson('triggering-and-cycling', deviceId)
    const act2 = lesson.steps.findIndex(
      (step) => step.interaction.kind === 'simulator-task' && step.interaction.round === 1,
    )
    expect(surfaceText()).toContain(`Set the ${cycleOff} to 15%, and watch`)
    chooseStep(lesson.transferPredictionStepIndex)
    act(() => jest.advanceTimersByTime(50))
    expect(surfaceText()).toContain(`If you lower the ${cycleOff}`)
    chooseStep(act2)
    act(() => jest.advanceTimersByTime(50))
    expect(surfaceText()).toContain(`Lower the ${cycleOff} to 15%`)
    for (const pattern of foreignLabels(deviceId)) expect(surfaceText()).not.toMatch(pattern)
  })

  it('Section 12: the rise-time task uses this console’s name', () => {
    mount('dyssynchrony-mechanisms', deviceId)
    const lesson = ventilationStageLesson('dyssynchrony-mechanisms', deviceId)
    const act1 = lesson.steps.findIndex(
      (step) => step.interaction.kind === 'simulator-task' && step.interaction.round === 0,
    )
    chooseStep(act1)
    act(() => jest.advanceTimersByTime(50))
    expect(surfaceText()).toContain(`Shorten the ${riseTime} to 100 ms`)
    for (const pattern of foreignLabels(deviceId)) expect(surfaceText()).not.toMatch(pattern)
  })

  it('Section 7: Part 2 introduces the cycle-off threshold by this console’s name', () => {
    mount('expiration-and-air-trapping', deviceId)
    const lesson = ventilationStageLesson('expiration-and-air-trapping', deviceId)
    chooseStep(lesson.transferPredictionStepIndex)
    act(() => jest.advanceTimersByTime(50))
    expect(surfaceText()).toContain(`a set percentage of its peak: the ${cycleOff}, also called`)
    for (const pattern of foreignLabels(deviceId)) expect(surfaceText()).not.toMatch(pattern)
  })
})
