import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import type { SupportMode } from '../engine/types'

/**
 * The composed-DOM answer-leak contract for the flow-path section.
 *
 * The independent review's finding A was not in the walk card: `EcmoCircuitWalk` withheld its
 * reading names correctly while the sibling `CircuitFlowPathPanel`, three sections below it in the
 * same pane, printed "pInt between pump and membrane". The re-review then found the same defect one
 * pane over again: this suite's first version mocked `CircuitAndMonitors` wholesale, and the real
 * component's diagnostic map placed pInt on pump outflow — visibly, in its SVG description, and in
 * hidden mounted DOM one tab-click from exposure. A leak test earns nothing by scanning a mock, so
 * the only module mocked here is `EcmoCircuit3D`, the WebGL leaf jsdom genuinely cannot render;
 * everything else is the real learner activity.
 *
 * The keyed prediction is "Where in the blood path does the circuit report pInt?", and the leak is
 * any content that locates pInt after the pump and before the membrane — not one exact sentence,
 * which is why the detector matches semantic equivalents. Scanning is done at two granularities:
 * per text node (SVG labels and descriptions are single nodes, and concatenating the whole page
 * would let unrelated labels form false adjacencies) and per sentence within prose containers.
 * There is no negation exception: a unit that matches fails, full stop.
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
// The one permitted mock: the 3D canvas needs WebGL. The rest of CircuitAndMonitors — the
// diagnostic SVG map, its description, the readout grid, both tabpanels — renders for real.
jest.mock('../components/EcmoCircuit3D', () => ({
  EcmoCircuit3D: () => <div data-testid="ecmo-circuit-3d" />,
}))

const TRACKS: readonly SupportMode[] = ['vv', 'va']

/**
 * Semantic equivalents of the keyed answer, each applied to one scanned unit at a time.
 *
 * The first five are the original teaching-pane forms; the rest are the diagnostic-map forms the
 * re-review reproduced — pInt tied to the pre-oxygenator access point, to pump outflow, or placed
 * before the membrane/oxygenator in any wording.
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
  {
    name: 'pInt … pre-oxygenator',
    pattern: /\bpInt\b.*pre-?oxygenator|pre-?oxygenator.*\bpInt\b/i,
  },
  { name: 'pump outflow … pInt', pattern: /pump outflow.*\bpInt\b|\bpInt\b.*pump outflow/i },
  { name: 'pInt … access point', pattern: /\bpInt\b.*access point|access point.*\bpInt\b/i },
  {
    name: 'pInt before the membrane/oxygenator',
    pattern:
      /\bpInt\b[^.!?]*before the (?:membrane|oxygenator)|passes \bpInt\b[^.!?]*(?:membrane|oxygenator)/i,
  },
]

/**
 * Every unit of the disclosure surface, hidden DOM included: each text node on its own (SVG
 * `<title>`, `<desc>`, `<text>` labels, sr-only spans), each sentence of each prose container, and
 * every aria-label — from the entire composed document minus the prediction item itself, whose four
 * choices necessarily print every candidate location without identifying the keyed one.
 */
function disclosureUnits(): readonly string[] {
  const root = document.body.cloneNode(true) as HTMLElement
  root.querySelector('[aria-labelledby="prediction-heading"]')?.remove()

  const units: string[] = []
  const push = (text: string | null | undefined) => {
    for (const sentence of (text ?? '').split(/(?<=[.!?])\s+/)) {
      if (sentence.trim().length > 0) units.push(sentence)
    }
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) push(node.textContent)
  // Prose containers re-joined: a paragraph broken into several JSX text nodes must still be
  // scanned as its sentences, or a leak written across an expression boundary would slip through.
  for (const element of Array.from(root.querySelectorAll('p, li, desc, title, text'))) {
    push(element.textContent)
  }
  for (const element of Array.from(root.querySelectorAll('[aria-label]'))) {
    push(element.getAttribute('aria-label'))
  }
  return units
}

function expectNoLeak() {
  for (const unit of disclosureUnits()) {
    for (const { name, pattern } of LEAK_PATTERNS) {
      if (pattern.test(unit)) {
        throw new Error(`leak (${name}) in: "${unit.trim().slice(0, 160)}"`)
      }
    }
  }
}

/** The diagnostic map's SVG, wherever its tabpanel currently stands. */
function diagnosticSvg(): SVGSVGElement {
  const svg = document.querySelector<SVGSVGElement>('#cardiohelp-diagnostic-view svg')
  if (!svg) throw new Error('no diagnostic circuit svg rendered')
  return svg
}

function diagnosticPintFlag(): Element | null {
  return diagnosticSvg().querySelector('[data-sensor-flag="pInt"]')
}

function commitPrediction() {
  fireEvent.click(screen.getByRole('button', { name: 'predict' }))
  const choice = document.querySelector<HTMLElement>('#prediction-heading + div button')
  if (!choice) throw new Error('no prediction choice rendered')
  fireEvent.click(choice)
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

describe('before commitment, nothing in the composed activity locates pInt', () => {
  it.each(TRACKS)(
    '%s: the recognize phase discloses no equivalent of the keyed answer',
    (track) => {
      mountLesson(track)
      expectNoLeak()
      // The precommit surface is not silent about the withholding: it says when the locations come.
      expect(document.body.textContent).toMatch(/once you have committed/i)
    },
  )

  it.each(TRACKS)(
    '%s: the predict phase, with the stem on screen, still discloses nothing',
    (track) => {
      mountLesson(track)
      fireEvent.click(screen.getByRole('button', { name: 'predict' }))
      expect(document.body.textContent).toMatch(/Where in the blood path does the circuit report/i)
      expectNoLeak()
    },
  )

  it('a direct URL into a later phase discloses nothing either', () => {
    mountLesson('vv', 'act')
    expectNoLeak()
  })

  it.each(TRACKS)(
    '%s: the diagnostic map withholds the channel placements, in every layer',
    (track) => {
      mountLesson(track)

      // The hidden-but-mounted tabpanel is part of the disclosure surface: expectNoLeak() above
      // already scanned it, and these are the structural halves of the same claim.
      const svg = diagnosticSvg()
      // No visible pInt marker placed on the drawing…
      expect(diagnosticPintFlag()).toBeNull()
      expect(
        Array.from(svg.querySelectorAll('text')).filter((node) =>
          /\bpInt\b/.test(node.textContent ?? ''),
        ),
      ).toHaveLength(0)
      // …no Δp bracket spanning the membrane with the pInt − pArt formula…
      expect(svg.querySelector('[data-delta-bracket]')).toBeNull()
      // …and the accessible description does not walk the channels along the path.
      const desc = svg.querySelector('desc')?.textContent ?? ''
      expect(desc).not.toMatch(/\bpInt\b/)
      expect(desc).not.toMatch(/\bpVen\b/)
      expect(desc).not.toMatch(/\bpArt\b/)
      expect(desc).toMatch(/committed/i)
    },
  )

  it('selecting the Pressure-zone map tab before committing exposes nothing', () => {
    mountLesson('vv')

    fireEvent.click(screen.getByRole('tab', { name: 'Pressure-zone map' }))
    const panel = document.querySelector('#cardiohelp-diagnostic-view')
    expect(panel).not.toBeNull()
    expect(panel!.hasAttribute('hidden')).toBe(false)

    expect(diagnosticPintFlag()).toBeNull()
    expectNoLeak()
  })
})

describe('after commitment, the full location teaching returns', () => {
  // The counterpart that keeps the leak test itself honest: if the detector were matching nothing
  // renderable, this would fail. The committed page must say the very things the gate withheld.
  it.each(TRACKS)('%s: the text equivalent places pInt between pump and membrane', (track) => {
    mountLesson(track)
    commitPrediction()

    const teaching = document.querySelector('[data-pane="teaching"]')
    expect(teaching?.textContent).toMatch(/pInt between pump and membrane/i)
    // And the pInt guide, withheld before, renders its full location teaching.
    expect(teaching?.textContent).toMatch(/pre-membrane, internal pressure/i)
    expect(teaching?.textContent).toMatch(/after the pump and before the membrane/i)
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
    expect(LEAK_PATTERNS.some(({ pattern }) => pattern.test(committedPane))).toBe(true)
    expect(LEAK_PATTERNS.some(({ pattern }) => pattern.test(committedDesc))).toBe(true)
  })
})
