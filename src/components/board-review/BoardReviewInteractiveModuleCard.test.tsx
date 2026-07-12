import { render, screen } from '@testing-library/react'

import { boardReviewChapterMap } from '@/data/board-review'

import { BoardReviewInteractiveModuleCard } from './BoardReviewInteractiveModuleCard'

jest.mock('@/i18n/handoff', () => ({
  HandoffContent: ({ children }: { children: React.ReactNode }) => children,
}))

describe('BoardReviewInteractiveModuleCard', () => {
  it('configures the airway-stents chapter as the only Board Prep interactive bridge', () => {
    expect(boardReviewChapterMap['airway-stents'].interactiveModule).toEqual({
      href: '/airway-stent-mechanics',
      label: 'Practice in the Clinical Decision Lab',
      description:
        'Apply indication, architecture, lumen, fit, complication, surveillance, and exit decisions in the full interactive airway-stent course.',
    })

    expect(
      Object.values(boardReviewChapterMap).filter((chapter) => chapter.interactiveModule),
    ).toHaveLength(1)
  })

  it('renders an accessible locale-aware call to action', () => {
    const interactiveModule = boardReviewChapterMap['airway-stents'].interactiveModule

    expect(interactiveModule).toBeDefined()
    if (!interactiveModule) {
      return
    }

    render(<BoardReviewInteractiveModuleCard interactiveModule={interactiveModule} locale="es" />)

    expect(
      screen.getByRole('region', { name: 'Practice in the Clinical Decision Lab' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Apply indication, architecture, lumen, fit, complication, surveillance, and exit decisions in the full interactive airway-stent course.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Practice in the Clinical Decision Lab' }),
    ).toHaveAttribute('href', '/es/airway-stent-mechanics')
  })
})
