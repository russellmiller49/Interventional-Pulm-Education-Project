/**
 * Tester feedback, 23 October 2026 — the hub and the circuit walk, a fourth round.
 *
 * The same tester as `tester-feedback-2026-10-13.rendered.test.tsx` left seven reports, one block
 * each below:
 *
 *   1. The hub was three boxes; make it one, with "Browse all 17 sections" in the top box.
 *   2. "Get rid of this": the "VV reference circuit. You don't operate the circuit…" card.
 *   3. The "VV femoral-femoral configuration" box beside the circuit heading: not a standalone box;
 *      its sentence belongs at the start of the module.
 *   4. "Redundant banner": the Save & exit sentence under every section header, and in sections the
 *      learner does not operate, the mode / flow / speed / sweep / alarm strip.
 *   5. "More about flow and saturation measurements": not needed for the task.
 *   6. The map question read as step-by-step text; give it a question card of its own.
 *   7. Sweep gas appeared in an answer option without having been taught.
 *
 * Rendered checks: each mounts the real host and reads what a learner would see.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { CardiohelpHub } from '../components/CardiohelpHub'
import { FoundationStageHost } from '../components/stage/FoundationStageHost'
import { ecmoFoundationLearningItems } from '../content/foundationLearningItems'
import { ecmoFoundationTeachingTasks } from '../content/foundationTeachingTasks'
import { mountDrill, resetStageHarness } from '../test-support/learnStageHarness'
import { currentFoundationStep, reachFoundationStep } from '../test-support/foundationJourney'

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

const WALK = 'circuit-flow-path'
const SHARED = [
  'why-extracorporeal-support',
  'circuit-flow-path',
  'pump-and-pressure-zones',
  'blood-flow-versus-sweep',
] as const
const TRACKS = ['vv', 'va'] as const

function mount(sectionId: (typeof SHARED)[number], track: 'vv' | 'va' = 'vv') {
  return render(<FoundationStageHost sectionId={sectionId} supportMode={track} />)
}

function pageText(): string {
  return document.body.textContent ?? ''
}

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(cleanup)

describe('1. the hub is one card', () => {
  it('holds the start action, the browse button, the track choice and About in one box', () => {
    const { container } = render(<CardiohelpHub />)
    const cards = container.querySelectorAll('[data-hub-card]')
    expect(cards).toHaveLength(1)
    const card = cards[0] as HTMLElement
    expect(within(card).getByRole('link', { name: /^Start —/ })).toBeInTheDocument()
    expect(within(card).getByRole('radiogroup', { name: 'ECMO support mode' })).toBeInTheDocument()
    expect(card.querySelector('details[data-hub-about]')).not.toBeNull()
    // The second box ("VV pathway" with its own browse button) is gone; the browse button sits
    // beside Start, and the list it opens is inside the same card.
    expect(container.querySelector('[class*="hubCurriculum"]')).toBeNull()
    const browse = within(card).getByRole('button', { name: /^Browse all \d+ sections$/ })
    const start = within(card).getByRole('link', { name: /^Start —/ })
    expect(browse.parentElement).toBe(start.parentElement)
    fireEvent.click(browse)
    const list = container.querySelector('[data-pathway-accordion]')!
    expect(card).toContainElement(list as HTMLElement)
    expect(within(card).getByRole('heading', { name: 'VV pathway' })).toBeInTheDocument()
    // Nothing of the page's own content sits outside the card.
    const hub = card.parentElement!
    for (const child of Array.from(hub.children)) expect(child).toBe(card)
  })
})

describe('2. no card about the model beside the circuit', () => {
  it.each(TRACKS)('%s: no task of the circuit walk carries it', (track) => {
    mount(WALK, track)
    for (const task of ecmoFoundationTeachingTasks[WALK]) {
      reachFoundationStep(WALK, task.id)
      expect(document.querySelector('[data-circuit-role]')).toBeNull()
      expect(document.querySelector('[data-model-reference]')).toBeNull()
      expect(pageText()).not.toMatch(/You don’t operate the circuit|reference circuit\./)
    }
  })

  it.each(SHARED)('%s: the loaded state is still stamped on the task', (sectionId) => {
    mount(sectionId)
    expect(
      document.querySelector('[data-now-focus]')?.getAttribute('data-active-state-variant'),
    ).toBeTruthy()
    expect(document.querySelector('[data-model-reference]')).toBeNull()
  })
})

describe('3. the configuration opens the walk instead of boxing the circuit heading', () => {
  it.each([
    [
      'vv',
      'This circuit is femoral–femoral VV ECMO. Blood drains from a femoral vein, passes through the centrifugal pump and then the membrane oxygenator, and returns through a femoral vein to the right atrium.',
    ],
    [
      'va',
      'This circuit is peripheral femoral VA ECMO. Blood drains from a femoral vein, passes through the centrifugal pump and then the membrane oxygenator, and returns through a femoral artery, flowing retrograde up the aorta toward the heart.',
    ],
  ] as const)('%s: says it once, at the first stop', (track, sentence) => {
    mount(WALK, track)
    const configuration = document.querySelector(`[data-circuit-configuration="${track}"]`)
    expect(configuration?.textContent).toBe(sentence)
    // Ahead of the walk card, so it is the first thing read.
    const walk = document.querySelector('[data-circuit-walk]')!
    expect(
      configuration!.compareDocumentPosition(walk) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // The box beside the circuit heading, its mode pill, the badge and the VA pill are gone.
    expect(pageText()).not.toMatch(/femoral-femoral configuration|BOUNDED MODEL/i)
    expect(pageText()).not.toMatch(/Modeled configuration/)
    // Later stops do not repeat it.
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-now-primary]')!)
    expect(document.querySelector('[data-circuit-configuration]')).toBeNull()
  })

  it('no longer boxes the configuration on any task', () => {
    mount(WALK)
    for (const task of ecmoFoundationTeachingTasks[WALK]) {
      reachFoundationStep(WALK, task.id)
      expect(pageText()).not.toMatch(/femoral-femoral configuration/i)
    }
  })
})

describe('4. no banner lines under the section header', () => {
  it.each(SHARED)('%s: no Save & exit sentence on screen and no status strip', (sectionId) => {
    mount(sectionId)
    const save = screen.getByRole('button', { name: 'Save & exit' })
    // Still the button's description, for a screen reader and as a tooltip.
    expect(save).toHaveAccessibleDescription(/^Save & exit saves your location/)
    expect(document.querySelector('[data-ecmo-save-location-note]')).toHaveClass('sr-only')
    for (const task of ecmoFoundationTeachingTasks[sectionId]) {
      reachFoundationStep(sectionId, task.id)
      expect(document.querySelector('[data-context-line]')).toBeNull()
    }
  })

  it('keeps the status strip in a drill, where the learner runs the console', async () => {
    resetStageHarness()
    await mountDrill('startup-sensor-orientation')
    expect(document.querySelector('[data-context-line]')).not.toBeNull()
    expect(document.querySelector('[data-ecmo-save-location-note]')).toHaveClass('sr-only')
  })
})

describe('5. the circuit-and-patient task ends on its point', () => {
  it.each(TRACKS)('%s: no flow and saturation disclosure', (track) => {
    mount(WALK, track)
    reachFoundationStep(WALK, 'observe')
    expect(pageText()).not.toMatch(/More about flow and saturation measurements/)
    expect(document.querySelector('[data-derived-value]')).toBeNull()
    expect(document.querySelector('[data-part-map-sites]')).not.toBeNull()
  })
})

describe('6. the map question is a question card', () => {
  it.each(TRACKS)('%s: question, places, Submit, Show answer and Skip in one card', (track) => {
    mount(WALK, track)
    reachFoundationStep(WALK, 'predict')
    const card = document.querySelector<HTMLElement>('[data-map-question-callout]')!
    expect(card).not.toBeNull()
    expect(card.textContent).toMatch(
      /^QuestionWhere in the blood path does the circuit report pInt\?/,
    )
    // The stem is the radio group's visible legend.
    const group = within(card).getByRole('group', {
      name: 'Where in the blood path does the circuit report pInt?',
    })
    expect(within(group).getAllByRole('radio')).toHaveLength(4)
    expect(within(card).getByRole('button', { name: 'Submit answer' })).toBeDisabled()
    expect(within(card).getByRole('button', { name: 'Show answer' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Skip' })).toBeInTheDocument()
    // Nothing of the question is left under the map, and it is not asked twice.
    const circuit = document.querySelector('#cardiohelp-circuit-panel')!
    expect(circuit.querySelector('[data-map-answer-legend]')).toBeNull()
    expect(circuit.querySelector('[data-optional-support]')).toBeNull()
    expect(document.querySelectorAll('[data-optional-support]')).toHaveLength(1)
    expect(
      pageText().match(/Where in the blood path does the circuit report pInt\?/g),
    ).toHaveLength(1)
    // The labels stay withheld until the answer is in, then return with it.
    expect(circuit).toHaveAttribute('data-location-disclosure', 'withheld')
    fireEvent.click(
      circuit.querySelector<HTMLElement>('[data-map-answer-choice="after-membrane"]')!,
    )
    expect(within(card).getByRole('radio', { checked: true })).toHaveAttribute(
      'value',
      'after-membrane',
    )
    fireEvent.click(within(card).getByRole('button', { name: 'Submit answer' }))
    expect(circuit).not.toHaveAttribute('data-location-disclosure', 'withheld')
    expect(card.querySelector('[data-verdict]')).not.toBeNull()
    expect(within(card).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    fireEvent.click(within(card).getByRole('button', { name: 'Continue' }))
    expect(currentFoundationStep()).toBe(`${WALK}-transfer`)
  })

  it('points at the card from the task line, and keeps the labels promise', () => {
    const task = ecmoFoundationTeachingTasks[WALK].find((candidate) => candidate.id === 'predict')!
    expect(task.instruction).toBe(
      'Answer the question below, using the circuit map. The map’s sensor labels are hidden until you answer.',
    )
  })
})

describe('7. sweep gas is taught before a question leans on it', () => {
  it('defines sweep gas and what it does on the gas-path task', () => {
    mount(WALK)
    reachFoundationStep(WALK, 'gas-path')
    expect(document.querySelector('[data-sweep-definition]')?.textContent).toBe(
      'Sweep gas is the gas that ventilates the membrane lung: oxygen, or a blend of oxygen and air. It flows through the inside of the hollow fibres while blood flows around the outside. Gas and blood never mix: across the fibre walls, oxygen moves from the gas into the blood and CO₂ moves from the blood into the gas.',
    )
    expect(document.querySelector('[data-sweep-effect]')?.textContent).toBe(
      'The sweep flow rate mainly sets CO₂ removal: more sweep clears more CO₂ and lowers the PaCO₂. Oxygenation depends mostly on blood flow and the sweep gas’s oxygen fraction, not on how fast the sweep runs.',
    )
  })

  it('comes before both questions that offer sweep gas as an answer', () => {
    const tasks = ecmoFoundationTeachingTasks[WALK].map((task) => task.id)
    const taught = tasks.indexOf('gas-path')
    const items = ecmoFoundationLearningItems[WALK]
    for (const [taskId, item] of [
      ['predict', items.prediction],
      ['transfer', items.transfer],
    ] as const) {
      expect(item.choices.some((choice) => /sweep[- ]gas/i.test(choice.label))).toBe(true)
      expect(tasks.indexOf(taskId)).toBeGreaterThan(taught)
    }
  })
})
