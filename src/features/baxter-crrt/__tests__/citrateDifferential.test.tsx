import { fireEvent, render, screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import {
  CrrtCitrateDifferential,
  crrtCitrateComparisonTextEquivalent,
} from '../components/CrrtCitrateDifferential'
import { crrtCitrateCalciumTermById, crrtCitrateCalciumTerms } from '../content/circuitModel'
import {
  crrtCitrateMechanismWalk,
  crrtCitrateComparisonRows,
  crrtCitrateDifferentialCategories,
  CRRT_CITRATE_DIFFERENTIAL_IDS,
  unresolvedCrrtCitrateSourceIds,
} from '../content/citrateDifferential'
import { crrtSourceSupportsClaim } from '../content/learnerSourceMap'
import { crrtCitrateSourceReferences } from '../content/citrateSources'
import { sourceReferenceSchema } from '../content/schema'

describe('sourced citrate teaching', () => {
  it('reuses all canonical terms and preserves the original seven identities', () => {
    const walk = crrtCitrateMechanismWalk()
    expect(walk.map((s) => s.termId).sort()).toEqual(
      crrtCitrateCalciumTerms.map((t) => t.id).sort(),
    )
    walk.forEach((s) => expect(s.term).toBe(crrtCitrateCalciumTermById.get(s.termId)))
    expect(walk.map((s) => s.termId)).toContain('systemic-metabolism')
    expect(walk.slice(-2).map((s) => s.termId)).toEqual(['circuit-sample', 'systemic-sample'])
  })
  it('registers exact claim locators, population context and pending reviewer status', () => {
    crrtCitrateSourceReferences.forEach((source) => {
      expect(sourceReferenceSchema.safeParse(source).success).toBe(true)
      expect(source.pageOrSection).toMatch(/Section|principles|diagnoses/)
      expect(source.value).toMatch(/Critically ill adults/)
      expect(source.reviewStatus).toBe('pending')
      expect(source.reviewer).toBeNull()
      expect(source.sourceType).not.toBe('local-protocol')
    })
    expect(unresolvedCrrtCitrateSourceIds()).toEqual([])
  })
  it('separates sourced physiology from unresolved inference with no medication quantities', () => {
    expect(crrtCitrateDifferentialCategories.map((c) => c.id)).toEqual([
      ...CRRT_CITRATE_DIFFERENTIAL_IDS,
    ])
    for (const category of crrtCitrateDifferentialCategories) {
      for (const row of crrtCitrateComparisonRows) {
        const field = row.read(category)
        if (field.support === 'clinical-publication') {
          expect(field.sourceIds?.length).toBeGreaterThan(0)
          field.sourceIds!.forEach((id) =>
            expect(crrtSourceSupportsClaim(id, field.topic!)).toBe(true),
          )
        }
      }
    }
    const text = crrtCitrateComparisonTextEquivalent()
    expect(text).toMatch(/metabolism is impaired/)
    expect(text).toMatch(/metabolism is preserved/)
    expect(text).toMatch(/insufficient systemic buffer delivery/)
    expect(text).toMatch(/Other protocols use an approved return-line site/)
    expect(text).not.toMatch(
      /\b\d+(\.\d+)?\s*(mmol|mEq|mg|mL|µmol|umol)|every\s+\d+\s*h|increase by|decrease by|\b2\.5\b/i,
    )
  })
  it('requires all actual path selections including both sampling domains for guided readiness', async () => {
    const onReviewed = jest.fn()
    const view = render(
      <CrrtCitrateDifferential presentation="mechanism" onReviewed={onReviewed} />,
    )
    expect(onReviewed).not.toHaveBeenCalled()
    const picker = screen.getByRole('group', { name: 'Citrate path and sampling selection' })
    for (const b of within(picker).getAllByRole('button').slice(0, -1)) fireEvent.click(b)
    expect(onReviewed).not.toHaveBeenCalled()
    fireEvent.click(within(picker).getByRole('button', { name: /Systemic sample/ }))
    expect(onReviewed).toHaveBeenCalledWith('citrate-path-and-samples-reviewed')
    expect(
      view.container.querySelector(
        '[data-node="systemic-sampling-domain"][data-highlighted="true"]',
      ),
    ).toBeTruthy()
    expect(screen.getByText(/8 of 8 locations selected/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Systemic sample' })).toBeInTheDocument()
    expect(await axe(view.container)).toHaveNoViolations()
  })
  it('shows all four comparisons after real selection, with publication support in words', async () => {
    const onReviewed = jest.fn()
    const view = render(
      <CrrtCitrateDifferential presentation="comparison" onReviewed={onReviewed} />,
    )
    const picker = screen.getByRole('group', { name: 'Citrate comparison categories' })
    for (const b of within(picker).getAllByRole('button')) fireEvent.click(b)
    expect(onReviewed).toHaveBeenCalledWith('four-citrate-patterns-reviewed')
    expect(
      screen.getByRole('heading', { name: 'Citrate-related metabolic alkalosis' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/calcium indices can remain stable/)).toBeInTheDocument()
    expect(
      screen.getAllByText('Clinical-publication support · review pending').length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole('note')).toHaveTextContent(/not a bedside algorithm/)
    expect(await axe(view.container)).toHaveNoViolations()
  })
  it('keeps the complete text reference aligned with every category and unresolved limitation', () => {
    const text = crrtCitrateComparisonTextEquivalent()
    for (const c of crrtCitrateDifferentialCategories) {
      expect(text).toContain(c.name)
      expect(text).toContain(c.whatOneFindingCannotEstablish)
      crrtCitrateComparisonRows.forEach((r) => expect(text).toContain(r.read(c).statement))
    }
    render(<CrrtCitrateDifferential />)
    expect(screen.getByText('Read the whole comparison as text')).toBeInTheDocument()
  })
})
