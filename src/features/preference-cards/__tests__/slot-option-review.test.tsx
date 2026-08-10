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

    // Taxonomy v2 added 369 net-new proposals; all 429 prior ones survive unchanged.
    expect(summary).toMatchObject({
      totalProposals: 831, // owner-review corrections 2026-08-09: F-10 adds proposal-only flex-core rows (813 -> 831)
      affectedProducts: 401, // 192 -> 396 distinct products carry a proposal
      affectedSlots: 108, // owner-review corrections 2026-08-09: the three new flex-core rows carry proposals (105 -> 108)
      requiredProposals: 426, // 287 -> 426 of the proposals sit on required slots
      notInDistribution: 32, // 28 of the new proposals are on not_in_distribution products (4 -> 32)
      conflictingDistribution: 7, // 5 new proposals hit products with conflicting GUDID records (2 -> 7)
      unknownDistribution: 231, // new proposals reach 131 products with no GUDID distribution evidence (0 -> 214)
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
    expect(conflicting).toHaveLength(7) // 2 -> 7: taxonomy v2 proposals reached 5 more conflicting-GUDID products
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
