import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CellPopulationLab } from '../components/CellPopulationLab'

describe('CellPopulationLab', () => {
  it('teaches population components through clickable schematic hotspots', async () => {
    const user = userEvent.setup()
    render(<CellPopulationLab onContinue={jest.fn()} />)

    expect(
      screen.getByRole('heading', {
        name: /Cell ID lab: know the population before naming the process/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Schematic—not a photomicrograph/i)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)

    await user.click(screen.getByRole('button', { name: /Macrophage Histiocytic cell/i }))

    expect(screen.getByRole('heading', { name: 'Alveolar macrophage' })).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /abundant foamy vacuolated cytoplasm/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Inspect Vacuoles or ingested material' }))
    expect(
      screen.getByText(/Clear spaces and pigment reflect phagocytic activity/i),
    ).toBeInTheDocument()
  })

  it('keeps identity hidden until commitment and supports retrying the population', async () => {
    const user = userEvent.setup()
    render(<CellPopulationLab onContinue={jest.fn()} />)

    expect(
      screen.getByRole('img', {
        name: 'Unlabeled schematic cell population for identification practice.',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Correct identification')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ciliated bronchial epithelial cells' }))
    await user.click(screen.getByRole('button', { name: /Reveal cell identity/i }))

    expect(screen.getByText('Compare the defining features')).toBeInTheDocument()
    expect(
      screen.getByText(/The illustrated population is Small mature lymphocyte/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Retry this population/i }))
    await user.click(screen.getByRole('button', { name: 'Small mature lymphocyte' }))
    await user.click(screen.getByRole('button', { name: /Reveal cell identity/i }))

    expect(screen.getByText('Correct identification')).toBeInTheDocument()
  })
})
