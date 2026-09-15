import { fireEvent, render, screen } from '@testing-library/react'
jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
import { McsStoryProblems } from '../components/stage/McsStoryProblems'
import { mcsStoryProblems, runMcsStory } from '../content/storyProblems'
beforeEach(() => window.localStorage.clear())
it.each(mcsStoryProblems)(
  '$id reveals a labeled example without answering, changing current progress, or penalizing retry',
  (story) => {
    const before = window.localStorage.length
    render(<McsStoryProblems stories={[story]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    expect(screen.getByText(story.axisVerdict)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation and worked example' }))
    expect(document.querySelectorAll('input:checked')).toHaveLength(0)
    expect(screen.getByText(story.item.explanation)).toBeInTheDocument()
    expect(screen.getByText(/Provided example on a separate model/)).toBeInTheDocument()
    const actual = runMcsStory(story)
    for (const reading of story.readings) {
      expect(document.querySelector('[data-story-run]')).toHaveTextContent(
        (actual.after.metrics[reading] as number).toFixed(1),
      )
    }
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(document.querySelector('[data-story-run]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Compare prediction' })).toBeDisabled()
    expect(screen.getAllByRole('radio').every((input) => !input.hasAttribute('disabled'))).toBe(
      true,
    )
    expect(window.localStorage.length).toBe(before)
  },
)
