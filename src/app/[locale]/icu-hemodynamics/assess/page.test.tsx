import { render, screen } from '@testing-library/react'

jest.mock('@/features/icu-hemodynamics/components/HemodynamicCaseActivity', () => ({
  HemodynamicCaseActivity: ({ caseId, mode }: { caseId: string; mode: string }) => (
    <div data-testid="case-activity">
      {caseId}:{mode}
    </div>
  ),
}))

jest.mock('@/features/icu-hemodynamics/components/IcuHemodynamicsAssessLandingV2', () => ({
  IcuHemodynamicsAssessLandingV2: () => <div data-testid="assess-landing" />,
}))

jest.mock('@/features/icu-hemodynamics/components/IcuHemodynamicsModuleFrameV2', () => ({
  IcuHemodynamicsModuleFrameV2: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

import IcuHemodynamicsAssessPage, { metadata } from './page'

describe('ICU hemodynamics assess route', () => {
  it('does not award or launch assessment on a page visit', async () => {
    render(
      await IcuHemodynamicsAssessPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({}),
      }),
    )
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    expect(screen.getByTestId('assess-landing')).toBeInTheDocument()
  })

  it('launches the seeded masked capstone only after an explicit start', async () => {
    render(
      await IcuHemodynamicsAssessPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ start: '1' }),
      }),
    )
    expect(screen.getByTestId('case-activity')).toHaveTextContent('HD-07:challenge')
  })
})
