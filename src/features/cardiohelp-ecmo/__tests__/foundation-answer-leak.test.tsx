import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import type { SupportMode } from '../engine/types'

/**
 * The composed-DOM answer-leak contract for the flow-path section.
 *
 * The independent review's finding A was not in the walk card: `EcmoCircuitWalk` withheld its
 * reading names correctly while the sibling `CircuitFlowPathPanel`, three sections below it in the
 * same pane, printed "pInt between pump and membrane" in its text equivalent and again in the pInt
 * value guide. A leak test that scans one component proves nothing about the pane the learner
 * actually reads, so this one mounts the whole activity and scans the composed output.
 *
 * The keyed prediction is "Where in the blood path does the circuit report pInt?", and the leak is
 * any sentence that locates pInt after the pump and before the membrane — not the exact wording,
 * which is why the detector matches semantic equivalents sentence by sentence. There is no
 * negation exception: a sentence that matches fails, full stop. If copy ever needs a structurally
 * negated statement here, the detector has to learn to verify the negation, not to substring it
 * away.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
jest.mock('../components/CardiohelpConsole', () => ({
  CardiohelpConsole: () => <div data-testid="cardiohelp-console" />,
}))
jest.mock('../components/CircuitAndMonitors', () => ({
  CircuitAndMonitors: () => <div data-testid="circuit-and-monitors" />,
}))

const TRACKS: readonly SupportMode[] = ['vv', 'va']

/**
 * Semantic equivalents of the keyed answer, each applied to one sentence at a time.
 *
 * Per-sentence matching is what keeps "the blood path runs … pump → pre-oxygenator → membrane …"
 * legal (generic path order, no channel placed) while catching any sentence that puts pInt on the
 * pre-membrane side in different words.
 */
const LEAK_PATTERNS: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: 'between … pump … membrane', pattern: /\bbetween\b.*\bpump\b.*\bmembrane\b/i },
  {
    name: 'after … pump … before … membrane',
    pattern: /\bafter\b.*\bpump\b.*\bbefore\b.*\bmembrane\b/i,
  },
  { name: 'pInt … after the pump', pattern: /\bpInt\b.*after the pump|after the pump.*\bpInt\b/i },
  { name: 'pre-membrane … pInt', pattern: /pre-?membrane.*\bpInt\b|\bpInt\b.*pre-?membrane/i },
  { name: 'pInt … pump outlet … membrane', pattern: /\bpInt\b.*pump outlet.*\bmembrane\b/i },
]

/**
 * Every sentence of the disclosure surface: visible text, hidden and screen-reader-only text, and
 * aria labels, from the entire composed document — minus the prediction item itself, whose four
 * choices necessarily print every candidate location without identifying the keyed one.
 */
function disclosureSentences(): readonly string[] {
  const root = document.body.cloneNode(true) as HTMLElement
  root.querySelector('[aria-labelledby="prediction-heading"]')?.remove()

  const ariaLabels = Array.from(root.querySelectorAll('[aria-label]')).map(
    (element) => element.getAttribute('aria-label') ?? '',
  )
  const text = root.textContent ?? ''
  return [...text.split(/(?<=[.!?])\s+/), ...ariaLabels].filter((s) => s.trim().length > 0)
}

function expectNoLeak() {
  for (const sentence of disclosureSentences()) {
    for (const { name, pattern } of LEAK_PATTERNS) {
      if (pattern.test(sentence)) {
        throw new Error(`leak (${name}) in: "${sentence.trim()}"`)
      }
    }
  }
}

function commitPrediction() {
  fireEvent.click(screen.getByRole('button', { name: 'predict' }))
  const choice = document.querySelector<HTMLElement>('#prediction-heading + div button')
  if (!choice) throw new Error('no prediction choice rendered')
  fireEvent.click(choice)
}

afterEach(cleanup)

describe('before commitment, nothing in the composed activity locates pInt', () => {
  it.each(TRACKS)(
    '%s: the recognize phase discloses no equivalent of the keyed answer',
    (track) => {
      render(<EcmoFoundationLessonActivity sectionId="circuit-flow-path" supportMode={track} />)
      expectNoLeak()
      // The precommit surface is not silent about the withholding: it says when the locations come.
      expect(document.body.textContent).toMatch(/once you have committed/i)
    },
  )

  it.each(TRACKS)(
    '%s: the predict phase, with the stem on screen, still discloses nothing',
    (track) => {
      render(<EcmoFoundationLessonActivity sectionId="circuit-flow-path" supportMode={track} />)
      fireEvent.click(screen.getByRole('button', { name: 'predict' }))
      expect(document.body.textContent).toMatch(/Where in the blood path does the circuit report/i)
      expectNoLeak()
    },
  )

  it('a direct URL into a later phase discloses nothing either', () => {
    render(
      <EcmoFoundationLessonActivity
        sectionId="circuit-flow-path"
        supportMode="vv"
        initialPhase="act"
      />,
    )
    expectNoLeak()
  })
})

describe('after commitment, the full location teaching returns', () => {
  // The counterpart that keeps the leak test itself honest: if the detector were matching nothing
  // renderable, this would fail. The committed pane must say the very thing the gate withheld.
  it.each(TRACKS)('%s: the text equivalent places pInt between pump and membrane', (track) => {
    render(<EcmoFoundationLessonActivity sectionId="circuit-flow-path" supportMode={track} />)
    commitPrediction()

    const teaching = document.querySelector('[data-pane="teaching"]')
    expect(teaching?.textContent).toMatch(/pInt between pump and membrane/i)
    // And the pInt guide, withheld before, renders its full location teaching.
    expect(teaching?.textContent).toMatch(/pre-membrane, internal pressure/i)
    expect(teaching?.textContent).toMatch(/after the pump and before the membrane/i)
  })

  it('the detector recognises the committed copy as the answer it guards', () => {
    // Sanity for the patterns themselves: the committed sentence must trip the detector, so a
    // future rewrite of the detector cannot quietly stop matching anything at all.
    const committed =
      'pVen is reported on the drainage limb, pInt between pump and membrane, pArt after the membrane on the return limb.'
    expect(LEAK_PATTERNS.some(({ pattern }) => pattern.test(committed))).toBe(true)
  })
})
