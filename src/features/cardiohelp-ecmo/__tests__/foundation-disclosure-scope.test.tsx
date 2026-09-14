import { reachFoundationStep, submitFoundationAnswer } from '../test-support/foundationJourney'
import { cleanup, render } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import {
  EcmoFoundationLessonActivity,
  foundationCircuitLocationDisclosure,
} from '../components/EcmoFoundationLessonActivity'
import {
  ecmoInteractiveFoundationSectionIds,
  isEcmoVaOnlyFoundationSectionId,
  isEcmoVvOnlyFoundationSectionId,
  type EcmoInteractiveFoundationSectionId,
} from '../content/foundationLessonRuntime'
import type { SupportMode } from '../engine/types'

/** All Learn references show pressure locations. Only the circuit lesson's explicit
 * uncommitted retrieval task omits them; every other section keeps its existing map. */

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
jest.mock('../components/EcmoCircuit3D', () => ({
  EcmoCircuit3D: () => <div data-testid="ecmo-circuit-3d" />,
}))

/** The one section whose prediction is the placements. Everything else teaches from them. */
const KEYED_SECTION: EcmoInteractiveFoundationSectionId = 'circuit-flow-path'

/**
 * The track(s) a section actually runs in.
 *
 * A track-fixed section is only mounted in its own mode: `?track=va` on a VV-only section is
 * clamped by the runtime, and mounting it here in VA would assert against teaching copy the
 * activity never shows.
 */
function supportedTracks(sectionId: EcmoInteractiveFoundationSectionId): readonly SupportMode[] {
  if (isEcmoVvOnlyFoundationSectionId(sectionId)) return ['vv']
  if (isEcmoVaOnlyFoundationSectionId(sectionId)) return ['va']
  return ['vv', 'va']
}

const MATRIX: readonly {
  readonly sectionId: EcmoInteractiveFoundationSectionId
  readonly track: SupportMode
}[] = ecmoInteractiveFoundationSectionIds.flatMap((sectionId) =>
  supportedTracks(sectionId).map((track) => ({ sectionId, track })),
)

function mount(sectionId: EcmoInteractiveFoundationSectionId, track: SupportMode) {
  return render(<EcmoFoundationLessonActivity sectionId={sectionId} supportMode={track} />)
}

function circuitPanel(): HTMLElement {
  const panel = document.querySelector<HTMLElement>('#cardiohelp-circuit-panel')
  if (!panel) throw new Error('no circuit panel rendered')
  return panel
}

function renderedDisclosure(): string | null {
  return circuitPanel().getAttribute('data-location-disclosure')
}

function diagnosticSvg(): SVGSVGElement {
  const svg = document.querySelector<SVGSVGElement>('#cardiohelp-diagnostic-view svg')
  if (!svg) throw new Error('no diagnostic circuit svg rendered')
  return svg
}

function currentStage(): string {
  return document.querySelector('[data-ecmo-shell="learn"]')?.getAttribute('data-stage') ?? ''
}

/**
 * Commit the prediction the way a learner does: the Now card's Continue into the Predict step,
 * one option chosen by its id (the rendered order is rotated), then the Now card's primary. The
 * stage stays on the Predict step: the disclosure follows the commitment, not the step.
 */
function commitPrediction(sectionId: EcmoInteractiveFoundationSectionId) {
  reachFoundationStep(sectionId, 'predict')
  submitFoundationAnswer()
  expect(currentStage()).toBe(`${sectionId}-predict`)
}

afterEach(cleanup)

describe('foundationCircuitLocationDisclosure', () => {
  it.each(ecmoInteractiveFoundationSectionIds)('%s, uncommitted', (sectionId) => {
    expect(foundationCircuitLocationDisclosure(sectionId, false)).toBe('full')
  })

  it.each(ecmoInteractiveFoundationSectionIds)('%s, committed', (sectionId) => {
    expect(foundationCircuitLocationDisclosure(sectionId, true)).toBe('full')
  })

  it('only permits withholding on the explicit circuit retrieval task', () => {
    const withheld = ecmoInteractiveFoundationSectionIds.filter(
      (sectionId) => foundationCircuitLocationDisclosure(sectionId, false, true) === 'withheld',
    )
    expect(withheld).toEqual([KEYED_SECTION])
  })
})

describe('the composed activity renders that scope', () => {
  it.each(MATRIX)('$sectionId / $track, uncommitted', ({ sectionId, track }) => {
    mount(sectionId, track)
    const panel = document.querySelector('#cardiohelp-circuit-panel')
    // A concept task has no map. Every mounted orientation map must still disclose its locations.
    if (panel) expect(panel).toHaveAttribute('data-location-disclosure', 'full')
    else expect(document.querySelector('[data-ecmo-flow]')).not.toBeNull()
  })

  it.each(supportedTracks(KEYED_SECTION))(
    'circuit-flow-path / %s discloses in full once the prediction is committed',
    (track) => {
      mount(KEYED_SECTION, track)
      expect(renderedDisclosure()).toBe('full')
      reachFoundationStep(KEYED_SECTION, 'predict')
      expect(renderedDisclosure()).toBe('withheld')
      commitPrediction(KEYED_SECTION)
      expect(renderedDisclosure()).toBe('full')
    },
  )

  /*
   * The product failure the review named, stated as the section's own teaching requirement rather
   * than as an attribute: `pump-and-pressure-zones` is about where the pressure zones are, and it
   * opened with all four flags, the Δp bracket, the legend row and the channel walk withheld.
   */
  it.each(supportedTracks('pump-and-pressure-zones'))(
    'pump-and-pressure-zones / %s opens with its channels placed and named',
    (track) => {
      mount('pump-and-pressure-zones', track)

      const svg = diagnosticSvg()
      expect(svg.querySelectorAll('[data-sensor-flag]')).toHaveLength(4)
      for (const channel of ['pVen', 'pInt', 'pArt', 'flow-bubble']) {
        expect(svg.querySelector(`[data-sensor-flag="${channel}"]`)).not.toBeNull()
      }
      expect(svg.querySelector('[data-delta-bracket]')).not.toBeNull()
      expect(svg.querySelector('desc')?.textContent ?? '').toMatch(
        /Pump outflow passes pInt, a pre-oxygenator access point/,
      )
      expect(
        Array.from(document.querySelectorAll('li')).some((item) =>
          /Pressure or flow sensor/i.test(item.textContent ?? ''),
        ),
      ).toBe(true)
      // And the withholding explanation belongs to the section that withholds, not to this one.
      expect(document.querySelector('[data-location-withheld-note]')).toBeNull()
    },
  )
})
