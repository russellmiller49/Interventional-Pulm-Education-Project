import { render, screen } from '@testing-library/react'

import { SlotOptionReviewQueue } from '../components/SlotOptionReviewQueue'
import {
  filterSlotOptionReviewRows,
  getSlotOptionReviewArtifactSummary,
  getSlotOptionReviewRows,
  summarizeSlotOptionReviewRows,
} from '../data/slot-option-proposals.server'

describe('exact-slot proposal review data', () => {
  it('loads the protected artifact as a unique, nonselectable review queue', () => {
    const rows = getSlotOptionReviewRows()
    const summary = summarizeSlotOptionReviewRows(rows, getSlotOptionReviewArtifactSummary())

    expect(summary).toMatchObject({
      totalProposals: 429,
      affectedProducts: 192,
      affectedSlots: 40,
      requiredProposals: 287,
      notInDistribution: 4,
      conflictingDistribution: 2,
      unknownDistribution: 0,
    })
    expect(new Set(rows.map((row) => `${row.slot_id}\u0000${row.product_id}`)).size).toBe(
      rows.length,
    )
    expect(
      rows.every(
        (row) =>
          row.proposal_status === 'unreviewed' &&
          row.selectable === false &&
          row.visible_by_default === false,
      ),
    ).toBe(true)
  })

  it('filters by exact procedure, requiredness, and distribution evidence', () => {
    const rows = getSlotOptionReviewRows()
    const filtered = filterSlotOptionReviewRows(rows, {
      procedure: 'EBV',
      requiredness: 'required',
      distribution: 'not_in_distribution',
    })

    expect(filtered.length).toBeGreaterThan(0)
    expect(
      filtered.every(
        (row) =>
          row.procedure_code === 'EBV' &&
          row.requiredness === 'required' &&
          row.current_distribution_status === 'not_in_distribution',
      ),
    ).toBe(true)

    const conflicting = filterSlotOptionReviewRows(rows, { distribution: 'conflicting' })
    expect(conflicting).toHaveLength(2)
    expect(conflicting.every((row) => row.distributionEvidence === 'conflicting')).toBe(true)
  })
})

describe('exact-slot proposal review UI', () => {
  it('labels proposals as inspection-only and links to product evidence without apply controls', () => {
    const allRows = getSlotOptionReviewRows()
    const compatible = allRows.find((row) => row.role_fit === 'Compatible')!
    const conflicting =
      allRows.find((row) => row.distributionEvidence === 'conflicting' && row !== compatible) ??
      allRows.find((row) => row.distributionEvidence === 'conflicting')!
    const rows = [compatible, conflicting]
    render(
      <SlotOptionReviewQueue
        rows={rows}
        summary={summarizeSlotOptionReviewRows(allRows, getSlotOptionReviewArtifactSummary())}
        locale="en"
      />,
    )

    expect(screen.getAllByText('Unreviewed · nonselectable')).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: /Review evidence/i })).toHaveLength(2)
    expect(screen.getAllByText(/canonical authored option set is unchanged/i)).toHaveLength(2)
    expect(screen.getAllByText(/Role fit: Compatible/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Conflicting distribution records')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /accept|approve|apply/i })).not.toBeInTheDocument()
  })
})
