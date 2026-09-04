import { fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import {
  OxygenDeliveryExplorer,
  oxygenDeliveryFigures,
} from '../components/teaching/OxygenDeliveryExplorer'
import {
  ecmoDeliveryAttribution,
  ecmoDeliveryComponents,
  validateEcmoDeliveryAttributions,
} from '../content/deliveryAttribution'
import { createReferenceSimulationState, ecmoSimulationReducer } from '../engine'
import type { EcmoSimulationState } from '../engine/types'

/**
 * The interactive part of the first foundation section, and the claim it exists to demonstrate.
 *
 * An owner review found that section's Act step promising a selection the interface did not offer,
 * and four consecutive steps showing identical content. The explorer is the fix, so what it computes
 * has to be checked rather than trusted: the arithmetic against the equations, and the teaching claim
 * — a saturation near its ceiling has little room to give, while the carrier and the flow are
 * proportional — against the numbers the component actually renders.
 */

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
}))

const SOURCES = ['ecmo-book-ch9', 'bounded-educational-model']

function settledReference(seconds = 8): EcmoSimulationState {
  let state = createReferenceSimulationState('vv-reference')
  for (let tick = 0; tick < seconds; tick += 1) {
    state = ecmoSimulationReducer(state, { type: 'STEP' })
  }
  return state
}

describe('the oxygen-delivery arithmetic', () => {
  it('computes content as the hemoglobin carrying its saturation', () => {
    // 1.34 mL/g x 10 g/dL x 1.00 = 13.4 mL/dL.
    expect(
      oxygenDeliveryFigures({ hemoglobin: 10, saturation: 100, cardiacOutput: 5 }).content,
    ).toBeCloseTo(13.4, 5)
    // Halving the saturation halves the bound content.
    expect(
      oxygenDeliveryFigures({ hemoglobin: 10, saturation: 50, cardiacOutput: 5 }).content,
    ).toBeCloseTo(6.7, 5)
  })

  it('computes delivery as that content multiplied by the flow carrying it', () => {
    // 13.4 mL/dL x 5 L/min x 10 dL/L = 670 mL/min.
    expect(
      oxygenDeliveryFigures({ hemoglobin: 10, saturation: 100, cardiacOutput: 5 }).delivery,
    ).toBeCloseTo(670, 5)
  })

  it('is proportional in the carrier and in the flow, and in nothing else', () => {
    const base = { hemoglobin: 10, saturation: 90, cardiacOutput: 4 }
    const doubleCarrier = oxygenDeliveryFigures({ ...base, hemoglobin: 20 })
    const doubleFlow = oxygenDeliveryFigures({ ...base, cardiacOutput: 8 })
    const baseline = oxygenDeliveryFigures(base)
    expect(doubleCarrier.delivery).toBeCloseTo(baseline.delivery * 2, 5)
    expect(doubleFlow.delivery).toBeCloseTo(baseline.delivery * 2, 5)
  })

  /**
   * The section's whole claim, as arithmetic.
   *
   * From a saturation of 99 there is one per cent of headroom and nine points of fall available, so
   * the saturation cannot move delivery far in either direction. The carrier and the flow can halve
   * it. If this ever stops being true the lesson is teaching something the numbers do not support.
   */
  it('shows a near-ceiling saturation moving delivery far less than the carrier or the flow', () => {
    const opening = { hemoglobin: 10, saturation: 99, cardiacOutput: 4.5 }
    const baseline = oxygenDeliveryFigures(opening).delivery

    const saturationDrop = baseline - oxygenDeliveryFigures({ ...opening, saturation: 90 }).delivery
    const halvedCarrier = baseline - oxygenDeliveryFigures({ ...opening, hemoglobin: 5 }).delivery
    const halvedFlow =
      baseline - oxygenDeliveryFigures({ ...opening, cardiacOutput: 2.25 }).delivery

    expect(halvedCarrier).toBeCloseTo(baseline / 2, 5)
    expect(halvedFlow).toBeCloseTo(baseline / 2, 5)
    expect(saturationDrop).toBeLessThan(halvedCarrier / 4)
    expect(saturationDrop).toBeLessThan(halvedFlow / 4)
    // And raising an already-high saturation to its ceiling buys almost nothing.
    const ceilingGain = oxygenDeliveryFigures({ ...opening, saturation: 100 }).delivery - baseline
    expect(ceilingGain).toBeLessThan(baseline * 0.02)
  })
})

describe('the explorer as the learner drives it', () => {
  function renderExplorer() {
    const state = settledReference()
    const view = render(<OxygenDeliveryExplorer state={state} sourceIds={SOURCES} />)
    return { state, view }
  }

  it('opens on this patient’s own values and reports both figures', () => {
    const { state } = renderExplorer()
    const hemoglobin = screen.getByLabelText('Hemoglobin') as HTMLInputElement
    const saturation = screen.getByLabelText(/Arterial oxygen saturation/i) as HTMLInputElement
    const cardiacOutput = screen.getByLabelText(/^Cardiac output/) as HTMLInputElement

    expect(Number(hemoglobin.value)).toBeCloseTo(Math.round(state.circuit.hemoglobin * 10) / 10, 5)
    expect(Number(saturation.value)).toBe(Math.round(state.patient.spo2))
    expect(Number(cardiacOutput.value)).toBeCloseTo(
      Math.round(state.patient.nativeCardiacOutputLpm * 10) / 10,
      5,
    )

    const expected = oxygenDeliveryFigures({
      hemoglobin: Number(hemoglobin.value),
      saturation: Number(saturation.value),
      cardiacOutput: Number(cardiacOutput.value),
    })
    expect(document.querySelector('[data-delivery-content]')?.textContent).toContain(
      expected.content.toFixed(1),
    )
    expect(document.querySelector('[data-delivery-total]')?.textContent).toContain(
      expected.delivery.toFixed(0),
    )
  })

  it('recomputes both figures when the learner moves a control', () => {
    renderExplorer()
    const before = document.querySelector('[data-delivery-total]')?.textContent
    fireEvent.change(screen.getByLabelText('Hemoglobin'), { target: { value: '5' } })
    const after = document.querySelector('[data-delivery-total]')?.textContent
    expect(after).not.toBe(before)
    const saturation = Number(
      (screen.getByLabelText(/Arterial oxygen saturation/i) as HTMLInputElement).value,
    )
    const cardiacOutput = Number(
      (screen.getByLabelText(/^Cardiac output/) as HTMLInputElement).value,
    )
    expect(after).toContain(
      oxygenDeliveryFigures({ hemoglobin: 5, saturation, cardiacOutput }).delivery.toFixed(0),
    )
  })

  it('demonstrates the claim from the presets alone, without the learner doing arithmetic', () => {
    renderExplorer()
    const read = () =>
      Number(document.querySelector('[data-delivery-total]')?.textContent?.replace(/[^\d.]/g, ''))
    const opening = read()

    fireEvent.click(screen.getByRole('button', { name: /Lower the saturation by ten/i }))
    const afterSaturation = read()
    fireEvent.click(screen.getByRole('button', { name: /Halve the hemoglobin/i }))
    const afterCarrier = read()
    fireEvent.click(screen.getByRole('button', { name: /Halve the cardiac output/i }))
    const afterFlow = read()

    expect(opening - afterSaturation).toBeLessThan((opening - afterCarrier) / 3)
    expect(opening - afterSaturation).toBeLessThan((opening - afterFlow) / 3)
    expect(afterCarrier).toBeLessThan(opening * 0.6)
    expect(afterFlow).toBeLessThan(opening * 0.6)
  })

  it('returns to this patient, and the reset is inert until something has moved', () => {
    renderExplorer()
    const reset = document.querySelector('[data-delivery-reset]') as HTMLButtonElement
    expect(reset).toBeDisabled()
    const opening = document.querySelector('[data-delivery-total]')?.textContent

    fireEvent.click(screen.getByRole('button', { name: /Halve the hemoglobin/i }))
    expect(reset).toBeEnabled()
    expect(document.querySelector('[data-delivery-total]')?.textContent).not.toBe(opening)

    fireEvent.click(reset)
    expect(document.querySelector('[data-delivery-total]')?.textContent).toBe(opening)
    expect(reset).toBeDisabled()
  })

  /**
   * The no-invented-threshold rule, enforced on the one surface most likely to break it.
   *
   * A calculator invites a verdict — a target line, a green zone, an "adequate" label — and every one
   * of those would be a number this module has no source for. The component may report what the
   * equations give and nothing more.
   */
  it('reports the figures without ever judging them', () => {
    const { view } = renderExplorer()
    // Everything except the model boundary, which is where the component is *allowed* to say
    // "no target delivery is shown" — a denial, not a claim. Scanning the whole card would flag
    // the very sentence that keeps the rule.
    const boundary = view.container.querySelector('[data-model-boundary]')
    const clone = view.container.cloneNode(true) as HTMLElement
    clone.querySelector('[data-model-boundary]')?.remove()
    const judged = clone.textContent ?? ''
    for (const forbidden of [
      /\btargets?\b/i,
      /\badequate\b/i,
      /\binadequate\b/i,
      /\bnormal range\b/i,
      /\bgoals?\b/i,
      /\bshould be\b/i,
      /\bacceptable\b/i,
      /\bcritical(?:ly)? low\b/i,
    ]) {
      expect(judged).not.toMatch(forbidden)
    }
    // It says out loud that it is not making that judgement...
    expect(judged).toMatch(/says anything on its own about whether/i)
    // ...and the boundary is the one place a target may be mentioned, only to deny showing one.
    expect(boundary?.textContent).toMatch(/no target delivery is shown/i)
  })

  it('carries a model boundary that names both simplifications, and its sources', () => {
    const { view } = renderExplorer()
    const text = view.container.textContent ?? ''
    expect(text).toMatch(/dissolved in plasma/i)
    expect(text).toMatch(/published values differ slightly/i)
    expect(view.container.querySelector('[data-evidence-id]')).not.toBeNull()
  })

  it('uses no banned learner-copy term', () => {
    const { view } = renderExplorer()
    const text = view.container.textContent ?? ''
    for (const term of [
      'score',
      'points',
      'grade',
      'pass',
      'fail',
      'correct',
      'incorrect',
      'wrong',
      'mastery',
      'exam',
      'quiz',
      'assessment',
      'competency',
    ]) {
      expect(text.toLowerCase()).not.toContain(term)
    }
  })
})

describe('the delivery-attribution registry', () => {
  it('validates, and the first section authors one', () => {
    expect(validateEcmoDeliveryAttributions()).toEqual([])
    expect(ecmoDeliveryAttribution('why-extracorporeal-support')).not.toBeNull()
    expect(ecmoDeliveryAttribution('circuit-flow-path')).toBeNull()
  })

  it('gives every offered component at least one candidate that acts on it', () => {
    const attribution = ecmoDeliveryAttribution('why-extracorporeal-support')!
    for (const component of attribution.components) {
      expect(
        attribution.candidates.some((candidate) => candidate.componentId === component.id),
      ).toBe(true)
    }
    expect(attribution.components).toHaveLength(ecmoDeliveryComponents.length)
  })

  /**
   * Two candidates act on oxygen content by different routes — transfusing raises the carrier,
   * raising the sweep-gas oxygen fraction raises how loaded it is. That is the discrimination the
   * step is for, so a future edit that collapses it to one candidate per component should fail here.
   */
  it('keeps two routes to oxygen content, so the step discriminates rather than pattern-matches', () => {
    const attribution = ecmoDeliveryAttribution('why-extracorporeal-support')!
    const contentCandidates = attribution.candidates.filter(
      (candidate) => candidate.componentId === 'oxygen-content',
    )
    expect(contentCandidates.length).toBeGreaterThanOrEqual(2)
    expect(contentCandidates.map((candidate) => candidate.id)).toContain('transfuse-red-cells')
    expect(contentCandidates.map((candidate) => candidate.id)).toContain(
      'raise-sweep-oxygen-fraction',
    )
  })

  it('uses clinical language, with no internal-framework vocabulary and no banned term', () => {
    const attribution = ecmoDeliveryAttribution('why-extracorporeal-support')!
    const text = [
      attribution.prompt,
      ...attribution.components.flatMap((component) => [component.label, component.definition]),
      ...attribution.candidates.flatMap((candidate) => [candidate.label, candidate.rationale]),
    ]
      .join(' ')
      .toLowerCase()
    for (const forbidden of [
      'ledger',
      'given way',
      'the term',
      'reducer',
      'engine',
      'correct',
      'score',
    ]) {
      expect(text).not.toContain(forbidden)
    }
  })
})
