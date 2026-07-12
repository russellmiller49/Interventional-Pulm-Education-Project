import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AssessmentPanel, type AssessmentResult } from '../components/learning-lab/AssessmentPanel'
import { LessonStepper } from '../components/learning-lab/LessonStepper'
import { PredictionCard } from '../components/learning-lab/PredictionCard'
import { clinicalAssessmentItems as stentAssessmentItems } from '../content/clinicalModuleCopy'
import {
  createDefaultStentProgress,
  isModuleComplete,
  markLessonCompleted,
  recordAssessmentResult,
} from '../engine/learningLabProgress'
import { STENT_LESSON_IDS } from '../engine/learningLabTypes'

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
        activeLessonId="indication"
        completedLessonIds={['indication']}
        lessons={[
          { id: 'indication', label: 'Indication', shortLabel: 'Indication' },
          { id: 'clinical-job', label: 'Clinical job', shortLabel: 'Clinical job' },
          {
            id: 'architecture-choice',
            label: 'Architecture',
            shortLabel: 'Architecture',
          },
          { id: 'fit-behavior', label: 'Fit and behavior', shortLabel: 'Fit' },
          {
            id: 'complications-surveillance',
            label: 'Complications and surveillance',
            shortLabel: 'Complications',
          },
          { id: 'assessment', label: 'Assessment', shortLabel: 'Assessment' },
        ]}
        onSelect={onSelect}
      />,
    )

    expect(screen.getByRole('button', { name: /Indication Completed/i })).toHaveAttribute(
      'aria-current',
      'step',
    )
    await user.click(screen.getByRole('button', { name: /Architecture Open lesson/i }))
    expect(onSelect).toHaveBeenCalledWith('architecture-choice')
  })

  it('requires missed-domain review and a defensible revision before awarding 5/6 mastery', async () => {
    const user = userEvent.setup()
    let progress = createDefaultStentProgress()
    for (const lessonId of STENT_LESSON_IDS.filter((lessonId) => lessonId !== 'assessment')) {
      progress = markLessonCompleted(progress, lessonId)
    }
    const onComplete = jest.fn((result: AssessmentResult) => {
      progress = recordAssessmentResult(progress, result.score, result.total, 5)
    })
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

    expect(onComplete).not.toHaveBeenCalled()
    expect(progress.completedLessonIds).not.toContain('assessment')
    expect(progress.assessment.mastery).toBe(false)
    expect(isModuleComplete(progress)).toBe(false)
    expect(screen.getByText(/Mastery threshold reached · remediation required/i)).toBeVisible()
    expect(
      screen.getByRole('group', { name: 'Review and revise missed decision domains' }),
    ).toBeVisible()

    const missedItem = items.at(-1)
    const initialIncorrectChoice = missedItem?.choices.find(
      (choice) => choice.id !== missedItem.correctChoiceId,
    )
    const correctChoice = missedItem?.choices.find(
      (choice) => choice.id === missedItem.correctChoiceId,
    )
    expect(missedItem).toBeDefined()
    expect(initialIncorrectChoice).toBeDefined()
    expect(correctChoice).toBeDefined()

    const remediation = screen.getByTestId(`assessment-remediation-${missedItem?.id}`)
    const remediationCommit = within(remediation).getByRole('button', {
      name: 'Commit revised answer',
    })
    const remediationRadios = within(remediation).getAllByRole('radio')
    for (const radio of remediationRadios) {
      expect(radio).toBeDisabled()
    }
    expect(remediationCommit).toBeDisabled()

    await user.click(within(remediation).getByRole('checkbox'))
    await user.click(
      within(remediation).getByRole('radio', { name: initialIncorrectChoice?.label }),
    )
    await user.click(remediationCommit)

    expect(onComplete).not.toHaveBeenCalled()
    expect(
      screen.getByText(/This revision still misses the controlling relationship/i),
    ).toBeVisible()

    await user.click(within(remediation).getByRole('radio', { name: correctChoice?.label }))
    await user.click(remediationCommit)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith({ attempt: 1, mastery: true, score: 5, total: 6 })
    expect(progress.completedLessonIds).toContain('assessment')
    expect(progress.assessment.mastery).toBe(true)
    expect(isModuleComplete(progress)).toBe(true)
    expect(screen.getByText(/Mastery reached/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Retry all cases' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('requires review of every missed domain before a nonmastery retry', async () => {
    const user = userEvent.setup()
    const onComplete = jest.fn()
    const onRetry = jest.fn()
    const items = stentAssessmentItems.map((item) => ({
      id: item.id,
      title: item.prompt,
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

    for (const item of items) {
      const incorrectChoice = item.choices.find((choice) => choice.id !== item.correctChoiceId)
      expect(incorrectChoice).toBeDefined()
      await user.click(screen.getByRole('radio', { name: incorrectChoice?.label }))

      const enabledCommit = screen
        .getAllByRole('button', { name: 'Commit and reveal' })
        .find((button) => !button.hasAttribute('disabled'))
      expect(enabledCommit).toBeDefined()
      await user.click(enabledCommit as HTMLButtonElement)
    }

    await user.click(screen.getByRole('button', { name: 'Submit assessment' }))

    expect(onComplete).toHaveBeenCalledWith({ attempt: 1, mastery: false, score: 0, total: 6 })
    expect(screen.getByText(/Module completion remains open/i)).toBeVisible()
    expect(screen.getByRole('group', { name: 'Review missed decision domains' })).toBeVisible()
    const retry = screen.getByRole('button', { name: 'Retry all cases' })
    expect(retry).toBeDisabled()

    const reviewChecks = screen.getAllByRole('checkbox')
    expect(reviewChecks).toHaveLength(items.length)
    for (const [index, reviewCheck] of reviewChecks.entries()) {
      expect(screen.getAllByText(items[index].explanation).length).toBeGreaterThan(0)
      await user.click(reviewCheck)
    }

    expect(retry).toBeEnabled()
    await user.click(retry)
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Submit assessment' })).toBeDisabled()
  })
})
