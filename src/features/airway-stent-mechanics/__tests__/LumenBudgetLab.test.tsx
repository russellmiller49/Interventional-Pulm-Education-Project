import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LumenBudgetLab } from '../components/clinical/LumenBudgetLab'

describe('LumenBudgetLab', () => {
  async function commitPrediction(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      screen.getByRole('radio', { name: 'Reduce inner diameter and lumen-area fraction' }),
    )
    await user.click(screen.getByRole('button', { name: 'Commit and reveal geometry' }))
  }

  it('gates then shows a same-scale, text-equivalent comparison with the requested readouts', async () => {
    const user = userEvent.setup()
    render(<LumenBudgetLab />)

    expect(screen.getByRole('heading', { name: 'Lumen Budget Lab' })).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText(/remain hidden until you commit a prediction/i)).toBeVisible()

    await commitPrediction(user)

    expect(
      screen.getByRole('img', { name: /Same-scale airway-stent lumen cross-sections/i }),
    ).toBeVisible()
    expect(screen.getByText(/Both drawings use the same scale/i)).toBeVisible()

    const silicone = screen.getByTestId('lumen-budget-generic-silicone-tube')
    expect(
      within(silicone).getByRole('heading', { name: 'Generic thicker-wall silicone tube' }),
    ).toBeVisible()
    expect(within(silicone).getByText('11.0 mm')).toBeVisible()
    expect(within(silicone).getByText('95.0 mm²')).toBeVisible()
    expect(within(silicone).getByText('61.7%')).toBeVisible()

    const scaffold = screen.getByTestId('lumen-budget-generic-thin-wall-scaffold')
    expect(
      within(scaffold).getByRole('heading', { name: 'Generic thin-wall scaffold' }),
    ).toBeVisible()
    expect(within(scaffold).getByText('13.0 mm')).toBeVisible()
    expect(within(scaffold).getByText('132.7 mm²')).toBeVisible()
    expect(within(scaffold).getByText('86.2%')).toBeVisible()

    expect(screen.getByText(/lower inner-to-outer diameter ratio/i)).toBeVisible()
    expect(
      screen.getByText(/should not be translated directly into an airflow, symptom/i),
    ).toBeVisible()
    expect(
      screen.getByText(/illustrative wall thicknesses, not product specifications/i),
    ).toBeVisible()
    expect(
      screen.getByText(/For professional education and device-size comparison only/i),
    ).toBeVisible()
  })

  it('updates both models from one editable outer diameter and keeps native controls keyboard reachable', async () => {
    const user = userEvent.setup()
    render(<LumenBudgetLab />)

    const numberInput = screen.getByRole('spinbutton', { name: 'Shared outer diameter' })
    const rangeInput = screen.getByRole('slider', {
      name: 'Adjust the same outer diameter for both models',
    })

    await user.tab()
    expect(numberInput).toHaveFocus()
    await user.tab()
    expect(rangeInput).toHaveFocus()

    await user.click(numberInput)
    await user.clear(numberInput)
    await user.type(numberInput, '16{Enter}')

    expect(screen.getByText('16.0 mm shared OD')).toBeVisible()
    expect(rangeInput).toHaveValue('16')

    await commitPrediction(user)

    const silicone = screen.getByTestId('lumen-budget-generic-silicone-tube')
    expect(within(silicone).getByText('13.0 mm')).toBeVisible()
    expect(within(silicone).getByText('132.7 mm²')).toBeVisible()
    expect(within(silicone).getByText('66.0%')).toBeVisible()

    const scaffold = screen.getByTestId('lumen-budget-generic-thin-wall-scaffold')
    expect(within(scaffold).getByText('15.0 mm')).toBeVisible()
    expect(within(scaffold).getByText('176.7 mm²')).toBeVisible()
    expect(within(scaffold).getByText('87.9%')).toBeVisible()
  })
})
