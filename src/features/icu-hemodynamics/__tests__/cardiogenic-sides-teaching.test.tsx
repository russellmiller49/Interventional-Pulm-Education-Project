import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { HemodynamicCaseActivity } from '../components/HemodynamicCaseActivity'
import { HemodynamicsShockProfiles } from '../components/HemodynamicsReferenceValues'
import {
  hemodynamicCaseById,
  hemodynamicCaseCardiogenicSide,
  hemodynamicCaseShockProfile,
} from '../content/cases'
import { hemodynamicsSources } from '../content/sources'
import {
  HEMODYNAMICS_CARDIOGENIC_PATTERNS,
  HEMODYNAMICS_NUMBER_ONLY_SOURCES,
  HEMODYNAMICS_SHOCK_PROFILES,
} from '../content/teachingNumbers'
import { HEMODYNAMIC_CLINICAL_THRESHOLDS } from '../content/clinicalThresholds'
import { createInitialHemodynamicState } from '../engine'
import { latentPhysiologicalEstimates } from '../engine/simulation'

/**
 * Cardiogenic shock is not one filling-pressure pattern.
 *
 * The pressure that rises is the one behind the ventricle that failed, and shock from right-sided
 * failure shows a normal to low wedge (Ragosta, 3rd ed., p. 227). HD-05 is right ventricular
 * failure from pre-capillary pulmonary hypertension: RAP near 12 and wedge near 8 mm Hg once the
 * transducer is zeroed. Its debrief used to hold those numbers against a row that said "High".
 */

jest.mock('@/features/critical-care/analytics', () => ({
  recordCriticalCareEvent: jest.fn(),
}))

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
  useRouter: () => ({ push: jest.fn() }),
}))

afterEach(() => {
  cleanup()
})

const cardiogenic = HEMODYNAMICS_SHOCK_PROFILES.find((profile) => profile.id === 'cardiogenic')!
const side = (id: (typeof HEMODYNAMICS_CARDIOGENIC_PATTERNS)[number]['id']) =>
  HEMODYNAMICS_CARDIOGENIC_PATTERNS.find((item) => item.id === id)!

/** The pressures the model holds for a case at its start, free of the transducer's offset. */
function modeled(caseId: string) {
  return latentPhysiologicalEstimates(
    createInitialHemodynamicState(hemodynamicCaseById.get(caseId)!, 'practice', 3469),
  )
}

describe('cardiogenic shock names the ventricle that failed', () => {
  it('no longer summarizes cardiogenic filling pressures as one word', () => {
    expect(cardiogenic.fillingPressures).not.toBe('High')
    expect(cardiogenic.fillingPressures).toMatch(/High on the failing side/)
    expect(cardiogenic.fillingPressures).toMatch(/wedge in LV failure/)
    expect(cardiogenic.fillingPressures).toMatch(/RAP in RV failure/)
  })

  it('teaches a high RAP with a low or normal wedge in right ventricular failure', () => {
    const right = side('right-ventricular')
    expect(right.reading).toMatch(/RAP high/)
    expect(right.reading).toMatch(/wedge low or normal/)
    expect(right.why).toMatch(/left heart is underfilled/)
    expect(right.why).toMatch(/pulmonary hypertension/)
  })

  it('teaches a high wedge in left ventricular failure and both high when both fail', () => {
    expect(side('left-ventricular').reading).toMatch(/Wedge high/)
    expect(side('biventricular').reading).toMatch(/RAP and wedge both high/)
  })

  it('traces every side to a source that resolves, with a year and a locator', () => {
    const sourceIds = new Set<string>([
      ...hemodynamicsSources.map((source) => source.id),
      ...HEMODYNAMICS_NUMBER_ONLY_SOURCES.map((source) => source.id),
    ])
    for (const item of HEMODYNAMICS_CARDIOGENIC_PATTERNS) {
      expect(item.sources.length).toBeGreaterThan(0)
      for (const source of item.sources) {
        expect({ id: source.sourceId, resolves: sourceIds.has(source.sourceId) }).toEqual({
          id: source.sourceId,
          resolves: true,
        })
        expect(Number.isInteger(source.year)).toBe(true)
        expect(source.locator.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('renders the sides under the table, marks the case’s own, and shows no source ids', () => {
    render(<HemodynamicsShockProfiles highlight="cardiogenic" highlightSide="right-ventricular" />)
    const row = document.querySelector('[data-shock-profile="cardiogenic"]')!
    expect(row.textContent).toContain(cardiogenic.fillingPressures)
    const sides = document.querySelector('[data-cardiogenic-patterns]')!
    const current = sides.querySelector('[data-current="true"]')!
    expect(current.getAttribute('data-cardiogenic-pattern')).toBe('right-ventricular')
    expect(current.textContent).toMatch(/\(this case\)/)
    expect(document.querySelector('[data-obstructive-patterns] [data-current="true"]')).toBeNull()
    const shown = document.querySelector('[data-shock-profiles]')!.textContent ?? ''
    expect(shown).not.toMatch(/TEXT-|LIT-/)
  })

  it('points each cardiogenic case at its own side', () => {
    const onTheRow = Object.entries(hemodynamicCaseShockProfile)
      .filter(([, profile]) => profile === 'cardiogenic')
      .map(([caseId]) => caseId)
    expect(Object.keys(hemodynamicCaseCardiogenicSide).sort()).toEqual(onTheRow.sort())
    expect(hemodynamicCaseCardiogenicSide).toEqual({
      'HD-03': 'left-ventricular',
      'HD-05': 'right-ventricular',
      'HD-06': 'biventricular',
    })
  })

  it('holds true of the pressures the three cases model', () => {
    const postCapillaryWedge =
      HEMODYNAMIC_CLINICAL_THRESHOLDS.pulmonaryHypertension.preCapillaryPawpMaxMmHg

    const left = modeled('HD-03')
    expect(left.pawpMmHg).toBeGreaterThan(postCapillaryWedge)

    const right = modeled('HD-05')
    expect(right.rapMmHg).toBeGreaterThan(10)
    expect(right.pawpMmHg).toBeLessThanOrEqual(postCapillaryWedge)
    expect(right.rapMmHg).toBeGreaterThan(right.pawpMmHg!)

    const both = modeled('HD-06')
    expect(both.rapMmHg).toBeGreaterThan(10)
    expect(both.pawpMmHg).toBeGreaterThan(postCapillaryWedge)

    for (const state of [left, right, both]) {
      expect(state.cardiacIndexLMinM2).toBeLessThan(2.2)
      expect(state.svo2Percent).toBeLessThan(60)
    }
  })
})

describe('the HD-05 debrief tells one story', () => {
  it('files the case under right ventricular failure on the cardiogenic row', async () => {
    render(<HemodynamicCaseActivity caseId="HD-05" mode="practice" />)
    expect(
      await screen.findByRole('heading', { name: hemodynamicCaseById.get('HD-05')!.title }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Orient to the patient and signals' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Go to the actions without recording a frame' }),
    )
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Case checkpoints' })).getByRole('button', {
        name: /Review your reasoning/,
      }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Show the teaching without recording a frame' }),
    )

    const profile = document.querySelector('[data-case-shock-profile="cardiogenic"]')!
    expect(profile.textContent).toMatch(/This case is the Cardiogenic profile/)
    const row = profile.querySelector('[data-shock-profile="cardiogenic"][data-current="true"]')!
    expect(row.textContent).toMatch(/RAP in RV failure/)
    const current = profile.querySelector('[data-cardiogenic-patterns] [data-current="true"]')!
    expect(current.getAttribute('data-cardiogenic-pattern')).toBe('right-ventricular')
    expect(current.textContent).toMatch(/RAP high; wedge low or normal/)
  })
})
