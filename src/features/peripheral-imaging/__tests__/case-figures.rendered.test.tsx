import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

import { ImagingCaseActivity } from '../components/ImagingCaseActivity'
import { ImagingIntegratedCaseActivity } from '../components/ImagingIntegratedCaseActivity'
import { CASE_FIGURE_RENDERERS } from '../components/figures/CaseFigure'
import { neutralPriorPlane } from '../components/figures/DtsAbsenceFigure'
import { STANDING_PLAN, standingPositionY } from '../components/figures/StandingPositionsPlan'
import { caseFigureDeclarations, validateCaseFigures } from '../content/caseFigures'
import { imagingMicroCasesInPathwayOrder } from '../content/microCases'
import { IMAGING_PROGRESS_STORAGE_KEY } from '../engine/selfPacedProgress'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}))

// A synthetic teaching volume (uniform lung-like), so the figures reach their ready state here.
jest.mock('../lib/anatomy', () => {
  const actual = jest.requireActual<typeof import('../lib/anatomy')>('../lib/anatomy')
  const [sx, sy, sz] = actual.ANATOMY.sizeXyz
  const volume = new Uint8Array(sx * sy * sz).fill(20)
  return { ...actual, loadAnatomyVolume: () => Promise.resolve(volume) }
})

// jsdom has no 2D canvas; the figures already treat a missing context as "nothing to draw".
beforeAll(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
beforeEach(() => localStorage.clear())
afterEach(cleanup)

const figure = () => document.querySelector('[data-case-figure]')
const readouts = () => document.querySelector('[data-case-figure-readouts]')
const showExplanation = () => fireEvent.click(document.querySelector('[data-show-explanation]')!)
function choose(choiceId: string) {
  fireEvent.click(document.querySelector(`[data-prediction-choices] input[value="${choiceId}"]`)!)
}
const check = () => fireEvent.click(document.querySelector('[data-now-primary]')!)
const tryAgain = () => fireEvent.click(document.querySelector('[data-answer-again]')!)

describe('case figures are declared, not defaulted (OD4-04)', () => {
  it('declares every figure a case renders, each with its own evidence class, and validates clean', () => {
    expect(validateCaseFigures()).toEqual([])
    const declarations = caseFigureDeclarations()
    expect(declarations.map((declaration) => declaration.identity).sort()).toEqual(
      Object.keys(CASE_FIGURE_RENDERERS).sort(),
    )
    expect(
      declarations.map((declaration) => [
        declaration.identity,
        declaration.evidence,
        declaration.medium,
      ]),
    ).toEqual([
      ['practice:dts-interpretation-practice-1:figure', 'depicts-the-question', 'teaching-model'],
      ['capstone:case-5-v2:figure', 'depicts-the-question', 'teaching-model'],
      ['practice:staff-protection-practice-1:figure', 'depicts-the-question', 'schematic'],
    ])
    for (const declaration of declarations) {
      expect(declaration.label).toMatch(/Not a /)
      if (declaration.medium === 'teaching-model')
        expect(declaration.label).toMatch(/^Teaching model:.*Not a patient acquisition/)
    }
  })

  it('leaves every other case without a figure, and the practice 1–3 cartoon exactly as it was', () => {
    render(<ImagingIntegratedCaseActivity caseId="case-1" />)
    expect(figure()).toBeNull()
    cleanup()
    for (const caseId of ['signal-practice-1', 'signal-practice-2', 'field-practice-1']) {
      render(<ImagingCaseActivity caseId={caseId} />)
      expect(figure()).toBeNull()
      expect(document.querySelector('[data-case-image]')).toHaveTextContent(
        'Draft synthetic teaching illustration, not a device capture or a calibrated scatter model. Use the clinical context supplied with the image; appearance alone does not identify its cause.',
      )
      cleanup()
    }
  })
})

describe('practice case 9 shows the planes, and waits to say where they came from (QS-5)', () => {
  it('draws five labelled model panels, neutral, with no answer before the learner asks for it', async () => {
    render(<ImagingCaseActivity caseId="dts-interpretation-practice-1" />)
    const node = figure()!
    expect(node).toHaveAttribute(
      'data-case-figure',
      'practice:dts-interpretation-practice-1:figure',
    )
    expect(node).toHaveAttribute('data-case-figure-evidence', 'depicts-the-question')
    expect(node.querySelector('[data-model-label]')).toHaveTextContent(
      'Teaching model: CT-derived images with an authored nodule and a modeled catheter. Not a patient acquisition.',
    )
    // The figure sits above the choices, after the situation.
    expect(
      node.compareDocumentPosition(document.querySelector('[data-prediction-choices]')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    await waitFor(() => expect(node).toHaveAttribute('data-figure-state', 'ready'), {
      timeout: 15_000,
    })
    expect(
      [...node.querySelectorAll('[data-figure-panel]')].map((panel) =>
        panel.getAttribute('data-figure-panel'),
      ),
    ).toEqual(['projection', 'plane-1', 'plane-2', 'plane-3', 'planning-ct'])
    expect(node.querySelectorAll('[data-figure-canvas="drawn"]')).toHaveLength(5)
    // Before any answer or explanation, nothing on the figure says the planes are prior-derived.
    expect(readouts()).toBeNull()
    expect(node).toHaveAttribute('data-figure-revealed', 'false')
    expect(node.textContent).not.toMatch(
      /prior|drawn from|come from|derived from|another acquisition/i,
    )
    expect(document.body.textContent).not.toMatch(/right lower lobe|lobulated/i)
  }, 20_000)

  it('shows the provenance with the explanation, hides it again, and never on a mere selection', async () => {
    render(<ImagingCaseActivity caseId="dts-interpretation-practice-1" />)
    choose('b')
    expect(readouts()).toBeNull()
    showExplanation()
    expect(readouts()).toHaveTextContent(/drawn from the planning CT/)
    expect(figure()).toHaveAttribute('data-figure-revealed', 'true')
    showExplanation()
    expect(readouts()).toBeNull()
    check()
    expect(readouts()).not.toBeNull()
    tryAgain()
    expect(readouts()).toBeNull()
    // Nothing about the answer or the reveal is stored.
    const stored = localStorage.getItem(IMAGING_PROGRESS_STORAGE_KEY) ?? ''
    expect(stored).not.toMatch(/choice|correct|answer|reveal|explanation/i)
  })

  it('draws the planning-CT planes in neutral gray, the colour of no answer', () => {
    const volume = new Uint8Array(192 ** 3).fill(120)
    const pixels = neutralPriorPlane(volume, 0)
    for (let i = 0; i < pixels.length; i += 4 * 997) {
      expect(pixels[i]).toBe(pixels[i + 1])
      expect(pixels[i + 1]).toBe(pixels[i + 2])
    }
  })
})

describe('integrated case 5 reads the sampling window off linked planes (QS-8)', () => {
  it('shows three labelled thin planes and hides the model’s relationship readout until revealed', () => {
    render(<ImagingIntegratedCaseActivity caseId="case-5-v2" />)
    const node = figure()!
    expect(node).toHaveAttribute('data-case-figure', 'capstone:case-5-v2:figure')
    expect(node).toHaveAttribute('data-case-figure-evidence', 'depicts-the-question')
    expect(node.querySelector('[data-model-label]')).toHaveTextContent(/^Teaching model:/)
    expect(node.querySelector('[data-model-label]')).toHaveTextContent(/Not a patient acquisition/)
    expect(node.querySelectorAll('[data-sampling-case-planes] svg[role="img"]')).toHaveLength(3)
    expect(node.textContent).toMatch(/Axial · -1 mm/)
    expect(node.textContent).toMatch(/Coronal · 2 mm/)
    expect(node.textContent).toMatch(/Sagittal · 7 mm/)
    expect(node.querySelector('[data-sampling-legend]')).toHaveTextContent(
      /modeled lesion.*side-cutting window.*ending at the tip/,
    )
    expect(readouts()).toBeNull()
    expect(node.textContent).not.toMatch(/partly intersects|beyond its surface|tip inside/i)
    choose('a')
    expect(readouts()).toBeNull()
  })

  it('reveals the model readouts with the explanation or a checked answer, separating tip, window and adequacy', () => {
    render(<ImagingIntegratedCaseActivity caseId="case-5-v2" />)
    showExplanation()
    expect(document.querySelector('[data-readout="window"]')).toHaveTextContent(
      'Sampling window partly intersects the modeled lesion',
    )
    expect(document.querySelector('[data-readout="tip"]')).toHaveTextContent(
      'Outside the modeled lesion, about 10 mm beyond its surface',
    )
    expect(readouts()).toHaveTextContent(/does not establish diagnostic tissue/)
    expect(document.querySelector('[data-explanation-reveal]')).toHaveTextContent(
      /the window partly inside the modeled lesion and the tip beyond it/,
    )
    showExplanation()
    choose('c')
    check()
    expect(readouts()).not.toBeNull()
    tryAgain()
    expect(readouts()).toBeNull()
  })
})

describe('practice case 15’s floor plan is geometry, not dosimetry (OD4-12)', () => {
  it('draws the three positions: two on the tube side, the second farther along, all equally far from the table', () => {
    render(<ImagingCaseActivity caseId="staff-protection-practice-1" />)
    const node = figure()!
    expect(node).toHaveAttribute('data-case-figure-medium', 'schematic')
    const [one, two, three] = STANDING_PLAN.positions
    expect([one.side, two.side, three.side]).toEqual(['near', 'near', 'far'])
    // Position 2: farther along the table's long axis on the tube side, same distance from it.
    expect(two.x).toBeGreaterThan(one.x)
    expect(standingPositionY(two.side)).toBe(standingPositionY(one.side))
    const { table } = STANDING_PLAN
    expect(standingPositionY('near') - (table.y + table.height)).toBe(
      table.y - standingPositionY('far'),
    )
    // The tube is on the near side, the detector across.
    expect(STANDING_PLAN.tube.y).toBeGreaterThan(table.y + table.height - STANDING_PLAN.tube.height)
    expect(STANDING_PLAN.detector.y + STANDING_PLAN.detector.height).toBeLessThan(table.y)
    expect(node.querySelectorAll('[data-standing-position]')).toHaveLength(3)
    expect(node.querySelector('[data-standing-legend]')).toHaveTextContent(
      /1 · beside the tube housing.*2 · farther along the table, tube side.*3 · across, on the detector side/,
    )
  })

  it('carries no numbers, colour scale, contours or dose words, and keeps the side rule for the explanation', () => {
    render(<ImagingCaseActivity caseId="staff-protection-practice-1" />)
    const svg = figure()!.querySelector('svg[data-standing-plan]')!
    expect(svg.querySelectorAll('linearGradient, radialGradient, pattern')).toHaveLength(0)
    const svgText = svg.textContent ?? ''
    expect(svgText.replace(/[123]/g, '')).not.toMatch(/\d/)
    expect(svgText).not.toMatch(/mGy|µSv|uSv|Sv\b|dose|isodose|contour|%/i)
    expect(figure()!.textContent).not.toMatch(/detector side often receive less/)
    showExplanation()
    expect(readouts()).toHaveTextContent(
      'In lateral projections, positions on the detector side often receive less than the beam-entrance (tube) side.',
    )
  })

  it('does not change the case: title, situation, stem and choices are the ones the practice list shows', () => {
    const practice = imagingMicroCasesInPathwayOrder().find(
      (microCase) => microCase.id === 'staff-protection-practice-1',
    )!
    render(<ImagingCaseActivity caseId="staff-protection-practice-1" />)
    expect(document.querySelector('[data-case-situation]')).toHaveTextContent(practice.situation)
    expect(document.querySelector('[data-prediction-choices] legend')).toHaveTextContent(
      practice.item.stem,
    )
  })
})
