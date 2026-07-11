import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { RapidOnsiteCytologyModule } from '../components/RapidOnsiteCytologyModule'

describe('RapidOnsiteCytologyModule', () => {
  it('updates the learn-mode interpretation from hover, focus, and licensed slide changes', async () => {
    const user = userEvent.setup()

    render(<RapidOnsiteCytologyModule />)

    expect(
      screen.getByRole('heading', { name: /Rapid onsite cytology interpretation/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/education and slide-interpretation practice only/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Crowded three-dimensional epithelial group' }),
    ).toBeInTheDocument()

    await user.hover(screen.getByRole('button', { name: /Inspect Nuclear crowding and overlap/i }))
    expect(
      screen.getByRole('heading', { name: 'Nuclear crowding and overlap' }),
    ).toBeInTheDocument()

    fireEvent.focus(screen.getByRole('button', { name: /Inspect Dispersed background cells/i }))
    expect(screen.getByRole('heading', { name: 'Dispersed background cells' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /ROSE montage/i }))
    expect(
      screen.getByRole('heading', {
        name: /ROSE Diff-Quik examples: carcinoma and granulomatous inflammation/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Cohesive glandular epithelial pattern' }),
    ).toBeInTheDocument()
  })

  it('starts the embedded atlas answer-hidden, then reveals teaching after commitment', async () => {
    const user = userEvent.setup()

    render(<RapidOnsiteCytologyModule embedded />)

    expect(screen.getByRole('button', { name: 'Quiz mode' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Direct-smear morphology exercise 1' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: 'Unlabeled high-magnification Diff-Quik cytology image for morphology practice.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Classify hotspot 1' })).toBeInTheDocument()
    expect(screen.queryByText('Malignant glandular epithelial cells')).not.toBeInTheDocument()
    expect(screen.queryByText(/File:Lung adenocarcinoma/i)).not.toBeInTheDocument()
    expect(
      screen.getByText('Licensed source link appears after answer submission.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /source image or article/i })).not.toBeInTheDocument()
    expect(screen.getByText('CC BY-SA 3.0')).toBeInTheDocument()
    expect(screen.getByText(/Librepath, via Wikimedia Commons/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Malignant epithelial pattern' }))

    expect(screen.getByText(/Correct\. Review the explanation below\./i)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Lung adenocarcinoma: Diff-Quik high magnification/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Malignant glandular epithelial cells')).toBeInTheDocument()
    expect(screen.getByText(/representative, interpretable lesional sampling/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /File:Lung adenocarcinoma/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Hide/i }))
    expect(
      screen.queryByRole('button', { name: /Inspect quiz hotspot 1/i }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Show/i }))
    expect(screen.getByRole('button', { name: /Inspect quiz hotspot 1/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByText('125%')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset zoom and pan' }))
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('keeps the learn/quiz toggle available in the embedded atlas', async () => {
    const user = userEvent.setup()
    render(<RapidOnsiteCytologyModule embedded />)

    await user.click(screen.getByRole('button', { name: 'Learn mode' }))

    expect(
      screen.getByRole('heading', { name: /Lung adenocarcinoma: Diff-Quik high magnification/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Inspect Crowded three-dimensional epithelial group: Malignant glandular epithelial cells/i,
      }),
    ).toBeInTheDocument()
  })
})
