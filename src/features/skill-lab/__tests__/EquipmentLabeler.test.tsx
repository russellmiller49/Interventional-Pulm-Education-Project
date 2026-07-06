import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { EquipmentLabeler } from '../components/EquipmentLabeler'
import type { EquipmentMap } from '../engine/types'

const map: EquipmentMap = {
  id: 'demo',
  title: 'Demo map',
  imageSrc: 'data:image/svg+xml,%3Csvg%2F%3E',
  imageAlt: 'Neutral schematic',
  hotspots: [
    { id: 'h1', label: 'Part one', xPct: 20, yPct: 50, description: 'Function of part one.' },
    { id: 'h2', label: 'Part two', xPct: 80, yPct: 50, description: 'Function of part two.' },
  ],
}

describe('EquipmentLabeler', () => {
  it('renders neutral alt text that does not leak the labels', () => {
    render(<EquipmentLabeler map={map} />)
    const image = screen.getByAltText('Neutral schematic')
    expect(image).toBeInTheDocument()
    // The alt text must not contain any hotspot label.
    expect(image.getAttribute('alt')).not.toMatch(/Part one|Part two/)
  })

  it('places labels on markers and grades all correct', async () => {
    const user = userEvent.setup()
    render(<EquipmentLabeler map={map} />)

    // Select the "Part one" token, then click marker 1 (index 0 → h1).
    await user.click(screen.getByRole('button', { name: 'Part one' }))
    await user.click(screen.getByRole('button', { name: /^Marker 1/ }))

    // Select the "Part two" token, then click marker 2 (index 1 → h2).
    await user.click(screen.getByRole('button', { name: 'Part two' }))
    await user.click(screen.getByRole('button', { name: /^Marker 2/ }))

    await user.click(screen.getByRole('button', { name: 'Check labels' }))

    expect(screen.getByText('2 of 2 labels placed correctly.')).toBeInTheDocument()
    // A correctly placed label reveals its teaching note.
    expect(screen.getByText('Function of part one.')).toBeInTheDocument()
  })

  it('grades a mismatch as incorrect', async () => {
    const user = userEvent.setup()
    render(<EquipmentLabeler map={map} />)

    // Put "Part one" on marker 2 (h2) — a mismatch.
    await user.click(screen.getByRole('button', { name: 'Part one' }))
    await user.click(screen.getByRole('button', { name: /^Marker 2/ }))
    await user.click(screen.getByRole('button', { name: 'Check labels' }))

    expect(screen.getByText('0 of 2 labels placed correctly.')).toBeInTheDocument()
  })
})
