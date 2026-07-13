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
      label: 'Airway Stent Mechanics & Failure Explorer',
      description:
        'Explore how architecture, lumen geometry, fit, motion, and changing airway conditions can produce clinically important failure patterns across freely navigable interactive stations.',
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
      screen.getByRole('region', { name: 'Airway Stent Mechanics & Failure Explorer' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Explore how architecture, lumen geometry, fit, motion, and changing airway conditions can produce clinically important failure patterns across freely navigable interactive stations.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Airway Stent Mechanics & Failure Explorer' }),
    ).toHaveAttribute('href', '/es/airway-stent-mechanics')
  })
})
