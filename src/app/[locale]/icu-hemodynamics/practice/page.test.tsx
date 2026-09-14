import { render, screen } from '@testing-library/react'

jest.mock('@/features/icu-hemodynamics/components/HemodynamicCaseActivity', () => ({
  HemodynamicCaseActivity: ({
    caseId,
    mode,
    nextLearn,
  }: {
    caseId: string
    mode: string
    nextLearn?: string
  }) => (
    <div data-testid="case-activity" data-next-learn={nextLearn}>
      {caseId}:{mode}
    </div>
  ),
}))

jest.mock('@/features/icu-hemodynamics/components/IcuHemodynamicsModuleFrameV2', () => ({
  IcuHemodynamicsModuleFrameV2: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="module-frame">{children}</div>
  ),
}))

jest.mock('@/features/icu-hemodynamics/components/IcuHemodynamicsPracticeLandingV2', () => ({
  IcuHemodynamicsPracticeLandingV2: () => <div data-testid="practice-landing" />,
}))

import IcuHemodynamicsPracticePage, { metadata } from './page'

describe('ICU hemodynamics practice route', () => {
  it('lists cases by default and remains noindex', async () => {
    render(
      await IcuHemodynamicsPracticePage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({}),
      }),
    )
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    expect(screen.getByTestId('practice-landing')).toBeInTheDocument()
  })

  it('opens each known case without accepting an unknown case ID', async () => {
    const { rerender } = render(
      await IcuHemodynamicsPracticePage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ case: 'HD-08', nextLearn: 'catheter-advancement' }),
      }),
    )
    expect(screen.getByTestId('case-activity')).toHaveTextContent('HD-08:practice')
    expect(screen.getByTestId('case-activity')).toHaveAttribute(
      'data-next-learn',
      'catheter-advancement',
    )
    for (const nextLearn of ['unknown-section', ['pressure-system', 'why-measure']]) {
      rerender(
        await IcuHemodynamicsPracticePage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve({ case: 'HD-08', nextLearn }),
        }),
      )
      expect(screen.getByTestId('case-activity')).not.toHaveAttribute('data-next-learn')
    }

    rerender(
      await IcuHemodynamicsPracticePage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ case: 'unknown' }),
      }),
    )
    expect(screen.getByTestId('practice-landing')).toBeInTheDocument()
  })
})
