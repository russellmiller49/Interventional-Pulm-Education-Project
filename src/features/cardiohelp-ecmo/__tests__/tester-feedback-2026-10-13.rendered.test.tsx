/**
 * Tester feedback, 13 October 2026 — the hub and the first two Learn sections.
 *
 * A beta tester walked the hub, "Why extracorporeal support exists" and the circuit walk, and left
 * twenty-one reports. They fall into five complaints, and each block below holds one of them:
 *
 *   1. The hub asked the learner to read three screens before starting.
 *   2. Notes about the simulator stood where teaching should be.
 *   3. Controls were offered that could do nothing on the step they were on.
 *   4. The same text appeared twice.
 *   5. The way to the next task was two screens down.
 *
 * These are rendered checks: each one mounts the real host and reads what a learner would see.
 *
 * Block 6 holds her second batch, five reports later the same day on the pressure tasks of the
 * circuit walk and the speed comparison of the pump section.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { CardiohelpHub } from '../components/CardiohelpHub'
import { FoundationStageHost } from '../components/stage/FoundationStageHost'
import { ecmoCircuitWalkStopsForSection } from '../content/circuitWalk'
import { resolveEcmoModeText } from '../content/circuitSegments'
import { ecmoFoundationTeachingTasks } from '../content/foundationTeachingTasks'
import {
  currentFoundationStep,
  reachFoundationStep,
  submitFoundationAnswer,
} from '../test-support/foundationJourney'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))
// The one permitted mock: the 3D canvas needs WebGL. Every other surface renders for real.
jest.mock('../components/EcmoCircuit3D', () => ({
  EcmoCircuit3D: () => <div data-testid="ecmo-circuit-3d" />,
}))

const OXYGEN = 'why-extracorporeal-support'
const WALK = 'circuit-flow-path'
const PUMP = 'pump-and-pressure-zones'

function mount(sectionId: typeof OXYGEN | typeof WALK | typeof PUMP) {
  return render(<FoundationStageHost sectionId={sectionId} supportMode="vv" />)
}

function pageText(): string {
  return document.body.textContent ?? ''
}

function supportRow(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-optional-support]')
}

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(cleanup)

describe('1. the hub opens on the one thing to do', () => {
  it('keeps the start action and the track choice together, and folds the rest away', () => {
    const { container } = render(<CardiohelpHub />)
    // The frame has a header of its own; the hero is the hub's.
    const hero = container.querySelector<HTMLElement>('header[class*="hubHero"]')!
    expect(within(hero).getByRole('link', { name: /^Start —/ })).toBeInTheDocument()
    // The track choice is the other decision the page asks for, so it sits in the same card.
    expect(within(hero).getByRole('radiogroup', { name: 'ECMO support mode' })).toBeInTheDocument()

    // How the module is organised, the device profile and the sources open on request.
    const about = container.querySelector<HTMLDetailsElement>('details[data-hub-about]')!
    expect(about.open).toBe(false)
    expect(within(about).getByText('About this module')).toBeInTheDocument()
    expect(within(about).getByText(/cases per track/)).toBeInTheDocument()
    expect(within(about).getByLabelText('Fixed device profile')).toBeInTheDocument()
    expect(within(about).getByRole('heading', { name: 'Sources and reference values' })).toBe(
      about.querySelector('#sources-heading'),
    )
    // Nothing of that reference material is left outside the disclosure.
    const outside = container.cloneNode(true) as HTMLElement
    outside.querySelector('details[data-hub-about]')?.remove()
    expect(outside.textContent).not.toMatch(/Sources and reference values|U\.S\. IFU|thApp/)
    expect(outside.textContent).not.toMatch(/Grouped by unit|personal history stays local/)
  })

  it('states the module’s boundary once, as a disclosure rather than a banner', () => {
    const { container } = render(<CardiohelpHub />)
    const notes = container.querySelectorAll<HTMLDetailsElement>('details[data-ecmo-boundary]')
    expect(notes).toHaveLength(1)
    const note = notes[0]!
    expect(note.open).toBe(false)
    expect(note.querySelector('summary')?.textContent).toMatch(/^Teaching simulator/)
    // The statement itself is unchanged and stays in the page.
    expect(note.textContent).toMatch(/not a clinical device or a\s+patient-specific guide/)
    expect(note.textContent).toMatch(/not manufactured, sponsored or\s+endorsed/)
  })
})

describe('2. teaching stands where notes about the simulator stood', () => {
  it('opens the oxygen section on the relationship, in plain sentences', () => {
    mount(OXYGEN)
    const text = pageText()
    expect(text).toMatch(
      /How much is delivered depends on two\s+things: how much blood reaches the tissue, and how much oxygen that blood is carrying\./,
    )
    expect(text).toMatch(
      /VV ECMO supports gas exchange\. VA ECMO supports gas exchange and the circulation\./,
    )
    expect(text).not.toMatch(/Supplied teaching values|not a patient you have met/)
    expect(text).not.toMatch(/Current components and model detail/)
    expect(document.querySelector('[data-model-boundary]')).toBeNull()
  })

  it('says what the worked example shows instead of "does not settle the balance"', () => {
    mount(OXYGEN)
    reachFoundationStep(OXYGEN, 'worked-example')
    expect(pageText()).toMatch(/yet delivery no longer keeps up with\s+demand/)
    expect(pageText()).not.toMatch(/does not settle the balance|conceptual example/)
  })

  it('asks its questions without a card about the reference circuit', () => {
    const questions = [
      [OXYGEN, ['predict', 'act', 'transfer']],
      // The second of these is answered on the circuit map, with the circuit on screen.
      [WALK, ['predict', 'transfer']],
    ] as const
    for (const [sectionId, taskIds] of questions) {
      cleanup()
      mount(sectionId)
      for (const taskId of taskIds) {
        reachFoundationStep(sectionId, taskId)
        expect(pageText()).not.toMatch(
          /reference circuit is\s+not the case|not this patient’s|separate teaching case/i,
        )
        expect(document.querySelector('[data-independent-application]')).toBeNull()
        // Nothing stands in the teaching column, so the stylesheet gives its width to the question.
        expect(document.querySelector('[data-pane="teaching"]')?.childElementCount).toBe(0)
      }
    }
  })

  it('gives instructions that say what to do, not how a form works', () => {
    const instructions = [
      ...ecmoFoundationTeachingTasks[OXYGEN],
      ...ecmoFoundationTeachingTasks[WALK],
    ]
      .map((task) => task.instruction)
      .join(' ')
    expect(instructions).not.toMatch(/Choose an answer, then submit it/)
    expect(instructions).not.toMatch(/existing circuit map/)
  })

  it('describes the pump as a centrifugal pump', () => {
    const pump = ecmoCircuitWalkStopsForSection(WALK).find((stop) => stop.id === 'walk-pump')!
    const analogy = resolveEcmoModeText(pump.analogy, 'vv')
    expect(analogy).toMatch(/^A centrifugal pump\./)
    expect(analogy).toMatch(/draws blood in at its centre and throws it outward/)
    expect(analogy).not.toMatch(/spinning cone/)
  })

  it('points the walk card at the map before anything else on it', () => {
    mount(WALK)
    const card = document.querySelector('[data-circuit-walk]')!
    const pointer = card.querySelector('[data-walk-scene-labels]')!
    expect(pointer.textContent).toMatch(/^Highlighted in yellow on the circuit map/)
    // Directly under the stop's title, ahead of the analogy and the short list.
    expect(card.querySelector('h3')?.nextElementSibling).toBe(pointer)
    expect(card.textContent).not.toMatch(/What to check at this place/)
    expect(card.textContent).toMatch(/If drainage is poor, check/)
  })
})

describe('3. no control is offered that cannot act', () => {
  it('draws no answer or skip row on a reading step', () => {
    mount(OXYGEN)
    expect(currentFoundationStep()).toBe(`${OXYGEN}-recognize`)
    expect(supportRow()).toBeNull()
    expect(pageText()).not.toMatch(/Optional practice/)

    cleanup()
    mount(WALK)
    expect(supportRow()).toBeNull()
  })

  it('offers the answer and a skip on a question, then only another attempt', () => {
    mount(OXYGEN)
    reachFoundationStep(OXYGEN, 'predict')
    const before = within(supportRow()!)
      .getAllByRole('button')
      .map((button) => button.textContent)
    expect(before).toEqual(['Show answer', 'Skip'])
    expect(pageText()).not.toMatch(/Optional practice/)

    submitFoundationAnswer()
    const after = within(supportRow()!)
      .getAllByRole('button')
      .map((button) => button.textContent)
    expect(after).toEqual(['Try again'])
  })

  it('leaves the inspection button off a circuit that is shown for reading', () => {
    mount(WALK)
    expect(document.getElementById('cardiohelp-circuit-check')).toBeNull()
    expect(pageText()).not.toMatch(/Perform tip-to-tip circuit and sensor check/)
  })
})

describe('4. nothing is said twice', () => {
  it('shows the delivery arithmetic on the first task only', () => {
    mount(OXYGEN)
    expect(document.querySelector('[data-oxygen-delivery-explorer]')).not.toBeNull()
    reachFoundationStep(OXYGEN, 'worked-example')
    expect(document.querySelector('[data-oxygen-delivery-explorer]')).toBeNull()
  })

  it('does not restate the stop as a paragraph, or its own count as a sentence', () => {
    mount(WALK)
    const card = document.querySelector('[data-circuit-walk]')!
    expect(card.querySelector('[data-walk-text-equivalent]')).toBeNull()
    expect(card.textContent).not.toMatch(/Read this stop as one paragraph/)
    expect(card.textContent).not.toMatch(/first stop in this section/i)
  })

  it('brings each note in at the stop it belongs to', () => {
    mount(WALK)
    const stops = ecmoCircuitWalkStopsForSection(WALK).map((stop) => stop.id)
    const seen: Record<string, { names: boolean; returnNote: boolean }> = {}
    for (const stopId of stops) {
      expect(document.querySelector('[data-circuit-walk]')?.getAttribute('data-walk-stop')).toBe(
        stopId,
      )
      seen[stopId] = {
        names: document.querySelector('[data-first-use="venous-line-saturation"]') !== null,
        returnNote: document.querySelector('[data-walk-return-note]') !== null,
      }
      // The vocabulary note and the measurement guides belong to later tasks of the section.
      expect(document.querySelector('[data-channel-vocabulary]')).toBeNull()
      expect(pageText()).not.toMatch(/More about flow and saturation measurements/)
      fireEvent.click(document.querySelector<HTMLButtonElement>('[data-now-primary]')!)
    }
    expect(seen).toEqual({
      'walk-drainage': { names: false, returnNote: false },
      'walk-pump': { names: false, returnNote: false },
      'walk-membrane': { names: true, returnNote: false },
      'walk-return': { names: false, returnNote: true },
    })
    // …and they are still taught, on the tasks they are about.
    reachFoundationStep(WALK, 'pressure-sites')
    expect(document.querySelector('[data-channel-vocabulary]')).not.toBeNull()
    reachFoundationStep(WALK, 'observe')
    expect(pageText()).toMatch(/More about flow and saturation measurements/)
  })
})

describe('5. the way forward stays in view', () => {
  it.each([OXYGEN, WALK] as const)('%s: pins the step’s action row on every task', (sectionId) => {
    mount(sectionId)
    for (const task of ecmoFoundationTeachingTasks[sectionId]) {
      reachFoundationStep(sectionId, task.id)
      const footer = document.querySelector('[data-now-card] > [data-now-footer]')
      // A map question submits beside the map, so its card has no action row of its own.
      if (!footer) {
        expect(document.querySelector('[data-map-question-actions] button')).not.toBeNull()
        continue
      }
      expect(footer.getAttribute('data-now-footer')).toBe('pinned')
      expect(footer.querySelector('[data-now-primary]')).not.toBeNull()
      // Last in the card, so nothing sits under a row that rides the bottom of the view.
      expect(footer.nextElementSibling).toBeNull()
    }
  })

  it('names the next stop’s action on the walk, and the next task at its end', () => {
    mount(WALK)
    const primary = () => document.querySelector<HTMLButtonElement>('[data-now-primary]')!
    expect(primary().textContent).toBe('Follow blood to the next stop')
    for (let stop = 0; stop < 3; stop += 1) fireEvent.click(primary())
    expect(primary().textContent).toBe('Continue to the gas path')
    expect(screen.getByRole('button', { name: 'Continue to the gas path' })).toBeEnabled()
  })
})

describe('6. the second batch: the pressure tasks and the speed comparison', () => {
  it('says the circuit is not operated here, in place of "Model reference … clock held"', () => {
    // "When do I click on this simulator?"
    mount(WALK)
    reachFoundationStep(WALK, 'pressure-sites')
    const card = document.querySelector('[data-model-reference="compact"]')!
    expect(card.textContent).toMatch(/You don’t operate the circuit in these sections/)
    expect(pageText()).not.toMatch(/Model reference for this task|About this model|clock held/)
    // The instruction names the controls that are on screen, and where.
    expect(document.querySelector('[data-now-card] h2 + p')?.textContent).toMatch(
      /^Select pVen, pInt, pArt and Δp on the left/,
    )
  })

  it('lights the two readings the comparison is about, and says it once', () => {
    // "Not sure where to direct my attention first"
    mount(WALK)
    reachFoundationStep(WALK, 'observe')
    expect(document.querySelector('[data-patient-signal="map"]')).toHaveAttribute(
      'data-emphasis',
      'true',
    )
    expect(document.querySelector('[data-map-emphasis-caption]')?.textContent).toMatch(
      /Ringed on the map: return pressure \(pArt\)/,
    )
    const card = document.querySelector('[data-active-foundation-block="circuit-patient"]')!
    expect(card.textContent).not.toMatch(/The word “arterial” in this device label/)
    expect(card.textContent).not.toMatch(/does not establish the patient/)
    expect(card.querySelectorAll('[data-circuit-pressure-identity]')).toHaveLength(1)
  })

  it('reads the speed comparison on the task that runs it, with no second task for the table', () => {
    // "this is the same as the previous task"
    expect(ecmoFoundationTeachingTasks[PUMP].map((task) => task.id)).not.toContain('observe')
    mount(PUMP)
    reachFoundationStep(PUMP, 'act')
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-comparison-run]')!)
    expect(document.querySelector('[data-foundation-comparison]')).toHaveAttribute(
      'data-comparison-complete',
      'true',
    )
    // How to read it sits under the table on the same task.
    expect(pageText()).toMatch(/Drawing that extra blood takes more suction/)
    expect(pageText()).toMatch(/so a rise after a speed change is not, by itself, new\s+membrane/)
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-now-primary]')!)
    expect(currentFoundationStep()).toBe(`${PUMP}-loading`)
  })

  it('drops the notes under the comparison and keeps the step short', () => {
    // "maybe not necessary" and "way too much text here"
    mount(PUMP)
    reachFoundationStep(PUMP, 'act')
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-comparison-run]')!)
    const text = pageText()
    expect(text).not.toMatch(/All values are simulated/)
    expect(text).not.toMatch(/Teaching comparison: the Run button/)
    expect(text).not.toMatch(/modeled time/)
    expect(text).not.toMatch(/Comparison saved\. Review Before/)
    expect(text).toMatch(/After is read 6 seconds after the change\./)
    expect(document.querySelector('[data-teaching-run-note]')).toBeNull()
    // Said once on the task, by the table, rather than three times.
    expect(
      document.querySelectorAll('[data-now-card] [data-circuit-pressure-identity]'),
    ).toHaveLength(1)
    // The pressure-patterns reference sits on the two tasks it is about, not this one.
    expect(text).not.toMatch(/More about pressure patterns/)
    reachFoundationStep(PUMP, 'loading')
    expect(pageText()).toMatch(/More about pressure patterns/)
  })
})
