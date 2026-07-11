import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { RoseLearningModule } from '../components/RoseLearningModule'

describe('RoseLearningModule', () => {
  it('starts with the high-yield adequacy framework instead of the slide gallery', () => {
    render(<RoseLearningModule />)

    expect(
      screen.getByRole('heading', { name: /Adequacy, triage, and the next pass/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: /Three adequacy checks\. Six moves\. One clear call\./i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Representative' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Interpretable' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sufficient for the endpoint' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Pass strategy is a separate decision/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Protect the staging map/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cell ID lab/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Lung adenocarcinoma/i })).not.toBeInTheDocument()
  })

  it('places cell-population teaching between the core playbook and decision cases', async () => {
    const user = userEvent.setup()
    render(<RoseLearningModule />)

    await user.click(screen.getByRole('button', { name: /Learn the cell populations/i }))

    expect(
      screen.getByRole('heading', {
        name: /Cell ID lab: know the population before naming the process/i,
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /ROSE decision lab/i })).not.toBeInTheDocument()
  })

  it('keeps case answers and image provenance hidden until both decisions are committed', async () => {
    const user = userEvent.setup()
    render(<RoseLearningModule />)

    await user.click(screen.getByRole('button', { name: /Decision lab/i }))

    expect(screen.getByText('Answers hidden')).toBeInTheDocument()
    expect(
      screen.getByText(/ROSE communicates what is represented.*proceduralist decides/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Illustrative reference image—not from this vignette/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: /one with distorted dark cellular material and one with an orderly sheet/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: /without a lesional population/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        /Blood and benign bronchial cells only; the targeted nodule is not represented/i,
      ),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/WHO lung cytopathology review — insufficient\/inadequate examples/i),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Dolezal et al.*interactive teaching context added/i),
    ).toBeInTheDocument()

    const checkButton = screen.getByRole('button', { name: /Check both decisions/i })
    expect(checkButton).toBeDisabled()

    await user.click(
      screen.getByRole('button', {
        name: /Nonrepresentative \/ non-diagnostic for the targeted nodule/i,
      }),
    )
    await user.click(
      screen.getByRole('button', {
        name: /Report nonrepresentation; re-check targeting and obtain more material/i,
      }),
    )
    expect(checkButton).toBeEnabled()

    await user.click(checkButton)

    expect(screen.getByText('Both decisions correct')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Blood and benign bronchial cells only; the targeted nodule is not represented/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/WHO lung cytopathology review — insufficient\/inadequate examples/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /without a lesional population/i })).toBeInTheDocument()
  })

  it('identifies the correct answers explicitly after an incorrect commitment', async () => {
    const user = userEvent.setup()
    render(<RoseLearningModule />)

    await user.click(screen.getByRole('button', { name: /Decision lab/i }))
    await user.click(screen.getByRole('button', { name: 'Benign nodule' }))
    await user.click(screen.getByRole('button', { name: 'Stop because benign cells are present' }))
    await user.click(screen.getByRole('button', { name: /Check both decisions/i }))

    expect(screen.getAllByText('Correct answer')).toHaveLength(2)
    expect(screen.getAllByText('Your choice')).toHaveLength(2)
    expect(
      screen.getByText(
        /Correct answer: Nonrepresentative \/ non-diagnostic for the targeted nodule/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Correct answer: Report nonrepresentation; re-check targeting/i),
    ).toBeInTheDocument()
  })

  it('uses a licensed answer-hidden morphology atlas without developer notes', async () => {
    const user = userEvent.setup()
    render(<RoseLearningModule />)

    await user.click(screen.getByRole('button', { name: /Morphology lab/i }))

    expect(screen.getByRole('heading', { name: 'Morphology lab' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Direct-smear morphology exercise 1' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quiz mode' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /Lung adenocarcinoma: Diff-Quik/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Annotation workflow notes')).not.toBeInTheDocument()
  })
})
