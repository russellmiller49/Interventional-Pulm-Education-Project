import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { HemodynamicsStageHost } from '../components/stage/HemodynamicsStageHost'
import { routeStop, routeStopNumber } from '../content/routeSpine'
import { hemodynamicsSectionIds } from '../content/sectionSpecs'
import { hemodynamicsStageLesson } from '../content/stageLessons'
import {
  checkAnswer,
  clickPrimary,
  advanceToPrediction,
  commitChoice,
  currentStepId,
  installDom,
  mountSection,
  nowStatus,
} from '../test-support/stageHarness'

/**
 * What the September 2026 learner-review round changed on this module's stage, pinned.
 *
 * The findings came from a walk of the ECMO Learn pathway by someone who had not built it, and
 * every one of them turned out to be a property of the shape this module shares: panes with names
 * only in `aria-label`, steps that name no pane, a simulator that goes dead without saying so, a
 * promise ("read the reasoning") the step's card does not keep, a short list that reads as prose,
 * and one place carrying two numbers on one screen. The record beside this module's docs says what
 * each became; this suite says it stays.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
    [key: string]: unknown
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
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as never
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

describe('activity-specific presentation replaces permanent panes', () => {
  it('keeps the question, observation and primary action in one task', () => {
    mountSection('pressure-system')
    expect(document.querySelector('[data-lesson-shell]')).toHaveAttribute(
      'data-presentation',
      'signal-lab',
    )
    expect(screen.queryByRole('tablist', { name: 'Workspace panel views' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-now-card] [data-focused-monitor]')).not.toBeNull()
    expect(document.querySelector('[data-now-card] [data-catheter-map]')).not.toBeNull()
    expect(document.querySelectorAll('[data-now-primary]')).toHaveLength(1)
  })

  it('retains authored identities and locations for compatibility without directing learners to retired panes', () => {
    for (const sectionId of hemodynamicsSectionIds) {
      for (const step of hemodynamicsStageLesson(sectionId).steps) {
        expect(step.id).toBe(`${sectionId}-${step.ordinal}-${step.phase}`)
        expect(step.lookIn?.landmark.trim().length).toBeGreaterThan(0)
      }
    }
    mountSection('pressure-system')
    expect(document.querySelector('[data-now-where]')).toBeNull()
    fireEvent.click(document.querySelector('[data-stage-help]')!)
    expect(document.querySelector('[data-stage-help-dialog]')).toHaveTextContent(
      'A line that can be trusted',
    )
    expect(document.querySelector('[data-stage-help-dialog]')).not.toHaveTextContent('Steps panel')
  })

  it('keeps action docks off the question view and preserves the explanation during review', () => {
    mountSection('pressure-system')
    advanceToPrediction('pressure-system')
    expect(document.querySelector('[data-dock]')).toBeNull()
    commitChoice(/off level, not zeroed, and underdamped/)
    clickPrimary()
    expect(document.querySelector('[data-dock="line"]')).not.toBeNull()
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(nowStatus()).toMatch(/Reviewing an earlier step/)
    expect(document.querySelector('[data-dock]')).toBeNull()
    expect(document.querySelector('[data-answer-verdict]')).not.toBeNull()
  })
})

describe('the card keeps the promise the step makes', () => {
  it('shows the verdict again when the learner looks back at the prediction', () => {
    const { lesson } = mountSection('pressure-system')
    advanceToPrediction('pressure-system')
    commitChoice(/off level, not zeroed, and underdamped/)
    clickPrimary()
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(currentStepId()).toBe(lesson.steps[lesson.predictionStepIndex].id)
    const verdict = document.querySelector('[data-now-card] [data-answer-verdict]')
    expect(verdict?.getAttribute('data-verdict-outcome')).toBe('correct')
    expect(verdict?.querySelector('[data-other-answers]')).not.toBeNull()
  })

  it('renders the reasoning on the Explain step, other answers included', () => {
    const { lesson } = mountSection('why-measure')
    clickPrimary()
    commitChoice(/arterial pressure is low at the measurement site/)
    clickPrimary()
    clickPrimary() // worked classification
    // The sort is the Act step; its commitment is exercised elsewhere. Reach Explain the honest way.
    const answers: Record<string, string> = {
      'pa-pressure': 'measured',
      'wedge-pressure': 'measured',
      'cardiac-output': 'measured',
      'vascular-resistance': 'calculated',
      'oxygen-delivery': 'calculated',
      'fluid-responsiveness': 'beyond',
      cause: 'beyond',
    }
    for (const row of document.querySelectorAll('[data-sort-row]')) {
      fireEvent.change(row.querySelector('select')!, {
        target: { value: answers[row.getAttribute('data-sort-row')!] },
      })
    }
    checkAnswer()
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[4].id)
    expect(lesson.steps[4].phase).toBe('explain')
    const recap = document.querySelector('[data-explain-recap]')
    expect(recap?.textContent).toMatch(/^Correct\./)
    expect(recap?.querySelector('[data-answer-verdict]')).not.toBeNull()
    expect(recap?.querySelector('[data-how-to-distinguish]')).not.toBeNull()
    expect(recap?.querySelectorAll('[data-other-answers] li')).toHaveLength(2)
  })
})

describe('the verdict is framed for the kind of item it heads', () => {
  it('frames a management decision as a move, and a signal read as a read', () => {
    mountSection('pac-signal-validation')
    clickPrimary()
    commitChoice(/Repeat the thermodilution series/)
    expect(document.querySelector('[data-now-card] [data-answer-verdict] p')?.textContent).toBe(
      'Partly correct. Defensible, but it leaves a step out',
    )
    cleanup()

    mountSection('pressure-system')
    advanceToPrediction('pressure-system')
    commitChoice(/off level, not zeroed, and underdamped/)
    expect(document.querySelector('[data-now-card] [data-answer-verdict] p')?.textContent).toBe(
      'Correct. That read holds',
    )
  })
})

describe('anatomy follows the procedure', () => {
  it('pairs the heart for advancement and keeps wedge anatomy optional', () => {
    mountSection('catheter-advancement')
    expect(document.querySelector('[data-surface="heart-3d"]')).not.toBeNull()
    expect(document.querySelector('[data-presentation]')).toHaveAttribute(
      'data-presentation',
      'catheter-procedure',
    )
    expect(document.querySelector('[data-surface="heart-3d"]')?.parentElement?.className).toMatch(
      /paired/,
    )
    cleanup()
    mountSection('pawp-capture')
    expect(document.querySelector('[data-surface="heart-3d"]')?.parentElement?.tagName).toBe(
      'DETAILS',
    )
    expect(document.querySelector('[data-surface="heart-3d"]')?.parentElement).not.toHaveAttribute(
      'open',
    )
    cleanup()
    mountSection('thermodilution-series')
    expect(document.querySelector('[data-surface="heart-3d"]')).toBeNull()
  })
})

describe('one place, one number', () => {
  it('numbers the walk card by the map, and says the walk position in words', () => {
    mountSection('pressure-system')
    const card = document.querySelector('[data-walk-stop="line"]')
    expect(card?.querySelector('p')?.textContent).toBe(`Stop ${routeStopNumber('line')} · The line`)
    expect(routeStopNumber('line')).toBe(1)
    const legendRow = [...document.querySelectorAll('[aria-label="The five stops"] li')].find(
      (row) => /The line/.test(row.textContent ?? ''),
    )
    expect(legendRow?.textContent).toBe('1The line')
    expect(nowStatus()).toBe('The only stop in this walk.')
    expect(document.querySelector('[data-catheter-map-caption]')?.textContent).toBe(
      'You are here: the line. The only stop in this walk.',
    )
    expect(document.body.textContent).not.toMatch(/Stop 0\b/)
  })

  it('agrees with the map on every stop of the four-place walk', () => {
    mountSection('waveform-interpretation')
    const stops = ['ra', 'rv', 'pa', 'wedge'] as const
    const positions = ['First', 'Second', 'Third', 'Last']
    stops.forEach((stopId, index) => {
      const card = document.querySelector(`[data-walk-stop="${stopId}"]`)
      expect(card?.querySelector('p')?.textContent).toBe(
        `Stop ${routeStopNumber(stopId)} · ${routeStop(stopId).title}`,
      )
      const legendRow = [...document.querySelectorAll('[aria-label="The five stops"] li')].find(
        (row) => row.textContent?.endsWith(routeStop(stopId).title),
      )
      expect(legendRow?.textContent).toBe(`${routeStopNumber(stopId)}${routeStop(stopId).title}`)
      // The active reference and walk share one task; there is no duplicate stop card.
      expect(document.querySelector('[data-teaching-block="stop"]')).toBeNull()
      expect(nowStatus()).toBe(`${positions[index]} of four stops in this walk.`)
      if (index < stops.length - 1) clickPrimary()
    })
  })
})

describe('the short list says what kind of list it is', () => {
  it('labels the walk checklist and the teaching checklist with the stop’s own label', () => {
    mountSection('pressure-system')
    const label = document.querySelector('[data-walk-checklist-label]')
    expect(label?.textContent).toBe(routeStop('line').checklistLabel)
    const list = document.querySelector('[data-walk-checklist]')
    expect(list?.getAttribute('aria-labelledby')).toBe(label?.id)
    expect(list?.querySelectorAll('li')).toHaveLength(routeStop('line').checklist.length)

    expect(document.querySelectorAll('[data-walk-checklist]')).toHaveLength(1)
  })

  it('labels the increment sentence so a step can point at it', () => {
    mountSection('pawp-capture')
    const sentence = document.querySelector('[data-increment-sentence]')
    expect(sentence?.previousElementSibling?.textContent).toBe('What this section adds')
  })
})

describe('one coherent compact task', () => {
  it('keeps component controls in the current task without workspace tabs', () => {
    render(<HemodynamicsStageHost sectionId="waveform-components" />)
    act(() => {
      jest.advanceTimersByTime(10)
    })
    expect(screen.getByRole('heading', { name: 'Normal atrial components' })).toBeInTheDocument()
    expect(screen.queryByRole('tablist', { name: 'Workspace panel views' })).not.toBeInTheDocument()
    clickPrimary()
    expect(document.querySelector('[data-now-card] [data-component-activity]')).not.toBeNull()
  })
  it('keeps blinded map answers and submission together', () => {
    mountSection('waveform-interpretation')
    advanceToPrediction('waveform-interpretation')
    expect(document.querySelector('[data-now-card] [data-catheter-map-answer]')).not.toBeNull()
    expect(document.querySelector('[data-now-card] [data-question-check]')).toBeDisabled()
    expect(document.querySelector('[data-now-card] [data-now-primary]')).toBeEnabled()
    expect(document.querySelectorAll('[data-now-primary]')).toHaveLength(1)
  })
})
