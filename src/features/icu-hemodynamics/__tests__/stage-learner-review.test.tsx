import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { HemodynamicsStageHost } from '../components/stage/HemodynamicsStageHost'
import { routeStop, routeStopNumber } from '../content/routeSpine'
import { hemodynamicsSectionIds } from '../content/sectionSpecs'
import { hemodynamicsStageLesson } from '../content/stageLessons'
import {
  clickPrimary,
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

function paneOrder(): readonly string[] {
  return [...document.querySelectorAll('[data-pane]')].map(
    (pane) => pane.getAttribute('data-pane') ?? '',
  )
}

describe('the panes say what they are', () => {
  it('lead with the steps, and each pane prints its name and what it is for', () => {
    mountSection('pressure-system')
    expect(paneOrder()).toEqual(['task', 'teaching', 'simulator'])
    expect(
      [...document.querySelectorAll('[data-pane-label]')].map((label) => label.textContent),
    ).toEqual([
      'Steps panel · what to do',
      'Teaching panel · what to read',
      'Simulator panel · the monitor, the controls and the catheter map',
    ])
    for (const name of ['Steps panel', 'Teaching panel', 'Simulator panel']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
  })
})

describe('every step says where it is worked', () => {
  it('authors a location on every step of every section, in words the panes carry', () => {
    for (const sectionId of hemodynamicsSectionIds) {
      for (const step of hemodynamicsStageLesson(sectionId).steps) {
        expect(`${sectionId} ${step.id}: ${step.lookIn?.pane ?? 'none'}`).toMatch(
          /: (steps|teaching|simulator)$/,
        )
        expect(step.lookIn?.landmark.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('prints the location under the instruction, naming a pane whose caption says the same word', () => {
    const { lesson } = mountSection('pressure-system')
    const where = document.querySelector('[data-now-card] [data-now-where]')
    expect(where?.textContent).toBe(
      'Where to look: Steps panel — the walk card below, and Simulator panel — The line, the dock under the monitor.',
    )
    const captions = [...document.querySelectorAll('[data-pane-label]')].map(
      (label) => label.textContent ?? '',
    )
    for (const named of where?.querySelectorAll('strong') ?? []) {
      expect(captions.some((caption) => caption.startsWith(named.textContent ?? '∅'))).toBe(true)
    }
    clickPrimary()
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[1].id)
    expect(document.querySelector('[data-now-card] [data-now-where]')?.textContent).toBe(
      'Where to look: Steps panel — the answer choices below.',
    )
  })

  it('repeats the location in the help dialog', () => {
    mountSection('pressure-system')
    fireEvent.click(document.querySelector('[data-stage-help]')!)
    expect(document.querySelector('[data-stage-help-dialog]')?.textContent).toMatch(
      /Where to look: Steps panel — the walk card below/,
    )
  })
})

describe('the simulator says when it cannot be operated', () => {
  it('names the lock while the learner decides, and the pause while they look back', () => {
    const { lesson } = mountSection('pressure-system')
    clickPrimary()
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[1].id)
    expect(document.querySelector('[data-controls-locked]')?.textContent).toMatch(
      /while you decide/,
    )
    expect(document.querySelector('[data-controls-paused]')).toBeNull()
    commitChoice(/off level, not zeroed, and underdamped/)
    expect(document.querySelector('[data-controls-locked]')).toBeNull()
    clickPrimary()

    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(nowStatus()).toMatch(/looking back/)
    expect(document.querySelector<HTMLFieldSetElement>('[data-dock="line"]')?.disabled).toBe(true)
    expect(document.querySelector('[data-controls-locked]')).toBeNull()
    expect(document.querySelector('[data-controls-paused]')?.textContent).toMatch(/look back/)
  })
})

describe('the card keeps the promise the step makes', () => {
  it('shows the verdict again when the learner looks back at the prediction', () => {
    const { lesson } = mountSection('pressure-system')
    clickPrimary()
    clickPrimary()
    commitChoice(/off level, not zeroed, and underdamped/)
    clickPrimary()
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(currentStepId()).toBe(lesson.steps[1].id)
    const verdict = document.querySelector('[data-now-card] [data-answer-verdict]')
    expect(verdict?.getAttribute('data-verdict-outcome')).toBe('correct')
    expect(verdict?.querySelector('[data-other-answers]')).not.toBeNull()
  })

  it('renders the reasoning on the Explain step, other answers included', () => {
    const { lesson } = mountSection('why-measure')
    clickPrimary()
    commitChoice(/push behind the blood/)
    clickPrimary()
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
    clickPrimary()
    clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[3].id)
    expect(lesson.steps[3].phase).toBe('explain')
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
    clickPrimary()
    clickPrimary()
    commitChoice(/off level, not zeroed, and underdamped/)
    expect(document.querySelector('[data-now-card] [data-answer-verdict] p')?.textContent).toBe(
      'Correct. That read holds',
    )
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
      const teachingCard = document.querySelector(
        `[data-teaching-block="stop"][data-stop="${stopId}"]`,
      )
      expect(teachingCard?.querySelector('p')?.textContent).toBe(
        `Stop ${routeStopNumber(stopId)} · ${routeStop(stopId).title}`,
      )
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

    const teachingCard = document.querySelector('[data-teaching-block="stop"][data-stop="line"]')
    const teachingList = teachingCard?.querySelector('ul')
    const teachingLabel = teachingCard?.querySelector(
      `#${CSS.escape(teachingList?.getAttribute('aria-labelledby') ?? '')}`,
    )
    expect(teachingLabel?.textContent).toBe(routeStop('line').checklistLabel)
  })

  it('labels the increment sentence so a step can point at it', () => {
    mountSection('pawp-capture')
    const sentence = document.querySelector('[data-increment-sentence]')
    expect(sentence?.previousElementSibling?.textContent).toBe('What this section adds')
  })
})

describe('the compact viewport opens on the pane the step is worked in', () => {
  const COMPACT_WIDTH = 600
  let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect
  let originalResizeObserver: typeof ResizeObserver | undefined

  beforeEach(() => {
    originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function measured(this: HTMLElement) {
      const rect = originalGetBoundingClientRect.call(this)
      if (/^Hemodynamics lesson workspace/.test(this.getAttribute('aria-label') ?? '')) {
        return { ...rect, width: COMPACT_WIDTH, left: 0 }
      }
      return rect
    }
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  })

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    globalThis.ResizeObserver = originalResizeObserver as typeof ResizeObserver
  })

  function visiblePane(): string {
    const visible = [...document.querySelectorAll<HTMLElement>('[role="region"]')].filter(
      (region) => /panel$/.test(region.getAttribute('aria-label') ?? '') && !region.hidden,
    )
    expect(visible).toHaveLength(1)
    return visible[0].querySelector('[data-pane]')?.getAttribute('data-pane') ?? ''
  }

  it('follows a step whose work is in the teaching pane', () => {
    window.history.replaceState(null, '', '/icu-hemodynamics/learn?activity=waveform-components')
    render(<HemodynamicsStageHost sectionId="waveform-components" />)
    act(() => {
      jest.runOnlyPendingTimers()
    })
    expect(hemodynamicsStageLesson('waveform-components').steps[0].lookIn?.pane).toBe('teaching')
    expect(visiblePane()).toBe('teaching')
    // The learner may still switch panes themselves; the preference is followed, not forced.
    fireEvent.click(
      [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
        (tab) => tab.textContent === 'Steps',
      )!,
    )
    expect(visiblePane()).toBe('task')
  })

  it('shows the steps for a prediction answered on the card, and the simulator for one answered on the map', () => {
    window.history.replaceState(
      null,
      '',
      '/icu-hemodynamics/learn?activity=waveform-interpretation',
    )
    render(<HemodynamicsStageHost sectionId="waveform-interpretation" />)
    act(() => {
      jest.runOnlyPendingTimers()
    })
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(3)
    // The walk is worked from the card and read on the map; its location is the card.
    expect(visiblePane()).toBe('task')
    for (let stop = 0; stop < 4; stop += 1) clickPrimary()
    clickPrimary()
    // Where is the tip? Answered by the pins, which are in the simulator pane.
    expect(document.querySelector('[data-catheter-map-answer]')).not.toBeNull()
    expect(visiblePane()).toBe('simulator')
  })
})
