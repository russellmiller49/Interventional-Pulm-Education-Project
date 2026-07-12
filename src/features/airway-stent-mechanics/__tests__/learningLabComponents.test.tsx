import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AssessmentPanel } from '../components/learning-lab/AssessmentPanel'
import { LessonStepper } from '../components/learning-lab/LessonStepper'
import { PredictionCard } from '../components/learning-lab/PredictionCard'
import { stentAssessmentItems } from '../content/learningLabCopy'

const prompt = {
  id: 'test-prediction',
  title: 'Choose the controlling variable',
  prompt: 'What should be inspected before increasing diameter?',
  choices: [
    {
      id: 'force',
      label: 'Peak force alone',
      rationale: 'A peak value does not describe bend-area retention.',
    },
    {
      id: 'area',
      label: 'Bend-area retention and end loading',
      rationale: 'This connects the imposed bend to lumen and tissue consequences.',
    },
  ],
  correctChoiceId: 'area',
  explanation: 'Inspect the coupled airway, lesion, architecture, and time horizon.',
}

describe('airway stent learning lab interactions', () => {
  it('keeps prediction rationales hidden until the learner commits', async () => {
    const user = userEvent.setup()
    const onSelect = jest.fn()
    const onCommit = jest.fn()
    const { rerender } = render(
      <PredictionCard committed={false} onCommit={onCommit} onSelect={onSelect} prompt={prompt} />,
    )

    expect(screen.queryByText(/peak value does not describe/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commit and reveal' })).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: 'Bend-area retention and end loading' }))
    expect(onSelect).toHaveBeenCalledWith('area')

    rerender(
      <PredictionCard
        committed={false}
        onCommit={onCommit}
        onSelect={onSelect}
        prompt={prompt}
        selectedChoiceId="area"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Commit and reveal' }))
    expect(onCommit).toHaveBeenCalledTimes(1)

    rerender(
      <PredictionCard
        committed
        onCommit={onCommit}
        onSelect={onSelect}
        prompt={prompt}
        selectedChoiceId="area"
      />,
    )
    expect(screen.getByText(/peak value does not describe/i)).toBeVisible()
    expect(screen.getByText(/prediction matches the evidence/i)).toBeVisible()
  })

  it('keeps every lesson openly navigable and announces completion state', async () => {
    const user = userEvent.setup()
    const onSelect = jest.fn()

    render(
      <LessonStepper
        activeLessonId="orient"
        completedLessonIds={['orient']}
        lessons={[
          { id: 'orient', label: 'Orient', shortLabel: 'Orient' },
          { id: 'architectures', label: 'Architectures', shortLabel: 'Architectures' },
          { id: 'force-lab', label: 'Force lab', shortLabel: 'Force lab' },
          { id: 'tissue-time', label: 'Tissue and time', shortLabel: 'Tissue + time' },
          {
            id: 'evidence-decisions',
            label: 'Evidence to decisions',
            shortLabel: 'Evidence',
          },
          { id: 'assessment', label: 'Assessment', shortLabel: 'Assessment' },
        ]}
        onSelect={onSelect}
      />,
    )

    expect(screen.getByRole('button', { name: /Orient Completed/i })).toHaveAttribute(
      'aria-current',
      'step',
    )
    await user.click(screen.getByRole('button', { name: /Force lab Open lesson/i }))
    expect(onSelect).toHaveBeenCalledWith('force-lab')
  })

  it('scores all six committed cases, awards mastery at five, and permits retry', async () => {
    const user = userEvent.setup()
    const onComplete = jest.fn()
    const onRetry = jest.fn()
    const items = stentAssessmentItems.map((item) => ({
      id: item.id,
      title: 'Decision case',
      stem: item.stem,
      prompt: item.prompt,
      choices: item.choices.map((choice) => ({ ...choice })),
      correctChoiceId: item.correctChoiceId,
      explanation: item.explanation,
    }))

    render(
      <AssessmentPanel
        attempt={1}
        items={items}
        masteryThreshold={5}
        onComplete={onComplete}
        onRetry={onRetry}
      />,
    )

    for (const [index, item] of items.entries()) {
      const choiceId =
        index === items.length - 1
          ? item.choices.find((choice) => choice.id !== item.correctChoiceId)?.id
          : item.correctChoiceId
      const choice = item.choices.find((candidate) => candidate.id === choiceId)
      expect(choice).toBeDefined()
      await user.click(screen.getByRole('radio', { name: choice?.label }))

      const commitButtons = screen.getAllByRole('button', { name: 'Commit and reveal' })
      const enabledCommit = commitButtons.find((button) => !button.hasAttribute('disabled'))
      expect(enabledCommit).toBeDefined()
      await user.click(enabledCommit as HTMLButtonElement)
    }

    expect(screen.getByRole('button', { name: 'Submit assessment' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Submit assessment' }))

    expect(onComplete).toHaveBeenCalledWith({ attempt: 1, mastery: true, score: 5, total: 6 })
    expect(screen.getByText(/Mastery reached/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Retry all cases' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
