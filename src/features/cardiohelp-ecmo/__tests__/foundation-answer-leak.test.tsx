import { reachFoundationStep } from '../test-support/foundationJourney'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import { ecmoFoundationLearningItemsFor } from '../content/foundationLearningItems'
import type { SupportMode } from '../engine/types'
import { answerLeakMatch } from '../test-support/answerLeakMatchers'

/** Ordinary Learn teaching is available first. Only the explicitly unlabelled retrieval
 * task withholds locations in all DOM layers. Drill disclosure tests remain separate. */

const mockPush = jest.fn()

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
  useRouter: () => ({ push: mockPush, replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))
jest.mock('../components/CardiohelpConsole', () => ({
  CardiohelpConsole: () => <div data-testid="cardiohelp-console" />,
}))
// The one permitted mock: the 3D canvas needs WebGL. The rest of CircuitAndMonitors — the
// diagnostic SVG map, its description, the readout grid, both tabpanels — renders for real.
jest.mock('../components/EcmoCircuit3D', () => ({
  EcmoCircuit3D: () => <div data-testid="ecmo-circuit-3d" />,
}))

const TRACKS: readonly SupportMode[] = ['vv', 'va']

/*
 * The semantic equivalents themselves live in `test-support/answerLeakMatchers`, and the contract
 * that each one is still individually detected lives in `foundation-answer-leak-matchers.test.ts`.
 * This scan asks only whether the rendered activity leaks; it fires on the first matcher that
 * matches, so it can never tell a missing form from a redundant one, which is why that second
 * question is asked somewhere else.
 */

/**
 * Every unit of the disclosure surface, hidden DOM included: each text node on its own (SVG
 * `<title>`, `<desc>`, `<text>` labels, sr-only spans), each sentence of each prose container, and
 * every aria-label — from the entire composed document minus the prediction item itself, whose four
 * choices necessarily print every candidate location without identifying the keyed one.
 *
 * The item is found by `data-prediction-choices`, the marker its fieldset carries wherever it is
 * rendered. It used to be found by the `aria-labelledby` hook it had while it was always a list in
 * the task pane; this item is now answered by pointing at the circuit, so the fieldset is the pins
 * on the drawing and its label is the legend it prints there.
 */

/** The diagnostic map's SVG, wherever its tabpanel currently stands. */
function diagnosticSvg(): SVGSVGElement {
  const svg = document.querySelector<SVGSVGElement>('#cardiohelp-diagnostic-view svg')
  if (!svg) throw new Error('no diagnostic circuit svg rendered')
  return svg
}

function diagnosticPintFlag(): Element | null {
  return diagnosticSvg().querySelector('[data-sensor-flag="pInt"]')
}

function currentStage(): string {
  return document.querySelector('[data-ecmo-shell="learn"]')?.getAttribute('data-stage') ?? ''
}

/** From the opening step, the Now card's one action leads to the Predict step. */
function goToPredict() {
  reachFoundationStep('circuit-flow-path', 'predict')
}

/**
 * Commit the prediction the way a learner does: one option chosen by its id — the rendered order
 * is rotated, so "the first option" is not a stable thing — then the Now card's primary.
 */
function commitPrediction() {
  goToPredict()
  const { prediction } = ecmoFoundationLearningItemsFor('circuit-flow-path')
  const choice = document.querySelector<HTMLInputElement>(
    `fieldset[data-prediction-choices] input[value="${prediction.choices[0].id}"]`,
  )
  if (!choice) throw new Error('no prediction choice rendered')
  fireEvent.click(choice)
  fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }))
  expect(document.querySelector('[data-verdict]')).not.toBeNull()
}

function mountLesson(track: SupportMode, initialPhase?: 'act') {
  return render(
    <EcmoFoundationLessonActivity
      sectionId="circuit-flow-path"
      supportMode={track}
      initialPhase={initialPhase}
    />,
  )
}

afterEach(cleanup)

describe('ordinary teaching precedes the independent retrieval check', () => {
  it.each(TRACKS)(
    '%s: locations are visible and accessible before an answer is requested',
    (track) => {
      mountLesson(track)
      expect(currentStage()).toBe('circuit-flow-path-recognize')
      expect(diagnosticPintFlag()).not.toBeNull()
      const identity = document.querySelector('[data-circuit-measurement-note]')!
      expect(identity.closest('details')).toBeNull()
      expect(identity).toHaveTextContent(
        "pArt is pressure in the return-side circuit tubing, not the patient's arterial blood pressure.",
      )
      expect(diagnosticSvg().querySelector('desc')?.textContent).toMatch(/Pump outflow passes pInt/)
      reachFoundationStep('circuit-flow-path', 'pressure-sites')
      fireEvent.click(screen.getByRole('button', { name: /^pInt$/ }))
      const block = document.querySelector('[data-active-foundation-block="pressure-sites"]')!
      expect(block).toHaveTextContent('Between pump and oxygenator')
      expect(block.closest('details')).toBeNull()
      expect(document.querySelector('[data-prediction-choices]')).toBeNull()
    },
  )

  // ECMO-01: obsolete exam/deep-link restriction retired; replacement: self-paced.test.tsx.

  it('a direct URL begins with teaching and reconstructs no answer', () => {
    mountLesson('vv', 'act')
    expect(currentStage()).toBe('circuit-flow-path-recognize')
    expect(document.querySelector('[data-verdict]')).toBeNull()
    expect(document.querySelector('[data-map-answer-flag]')).toBeNull()
    expect(diagnosticPintFlag()).not.toBeNull()
  })

  // ECMO-01: obsolete exam/deep-link restriction retired; replacement: self-paced.test.tsx.

  // ECMO-01: obsolete exam/deep-link restriction retired; replacement: self-paced.test.tsx.
})

describe('after commitment, the full location teaching returns', () => {
  // The counterpart that keeps the leak test itself honest: if the detector were matching nothing
  // renderable, this would fail. The committed page must say the very things the gate withheld.
  it.each(TRACKS)('%s: Back restores the location teaching without erasing the answer', (track) => {
    mountLesson(track)
    commitPrediction()
    fireEvent.click(document.querySelector('[data-now-back]')!)
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(document.querySelector('[data-active-foundation-block="pressure-sites"]')).not.toBeNull()
    expect(document.querySelector('[data-pane="teaching"]')).toHaveTextContent(
      'Between pump and oxygenator',
    )
    goToPredict()
    expect(document.querySelector('fieldset[data-prediction-choices]')).toBeDisabled()
  })

  it.each(TRACKS)('%s: the diagnostic map places the channels again, in every layer', (track) => {
    mountLesson(track)
    commitPrediction()

    const svg = diagnosticSvg()
    expect(diagnosticPintFlag()).not.toBeNull()
    expect(svg.querySelector('[data-sensor-flag="pVen"]')).not.toBeNull()
    expect(svg.querySelector('[data-sensor-flag="pArt"]')).not.toBeNull()
    expect(svg.querySelector('[data-delta-bracket]')).not.toBeNull()
    const desc = svg.querySelector('desc')?.textContent ?? ''
    expect(desc).toMatch(/Pump outflow passes pInt, a pre-oxygenator access point/)
  })

  it('the detector recognises the committed copy as the answer it guards', () => {
    // Sanity for the patterns themselves, on both leak surfaces' committed wording, so a future
    // rewrite of the detector cannot quietly stop matching anything at all.
    const committedPane =
      'pVen is reported on the drainage limb, pInt between pump and membrane, pArt after the membrane on the return limb.'
    const committedDesc =
      'Pump outflow passes pInt, a pre-oxygenator access point, and the membrane oxygenator.'
    expect(answerLeakMatch(committedPane)).not.toBeNull()
    expect(answerLeakMatch(committedDesc)).not.toBeNull()
  })
})
