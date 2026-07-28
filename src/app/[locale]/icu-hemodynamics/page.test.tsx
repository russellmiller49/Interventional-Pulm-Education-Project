import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/features/icu-hemodynamics/components/IcuHemodynamicsModuleFrameV2', () => ({
  IcuHemodynamicsModuleFrameV2: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="icu-hemodynamics-frame">{children}</div>
  ),
}))

jest.mock('@/features/icu-hemodynamics/components/IcuHemodynamicsOverviewV2', () => ({
  IcuHemodynamicsOverviewV2: () => <div data-testid="icu-hemodynamics-overview" />,
}))

import IcuHemodynamicsPage, { metadata } from './page'

describe('ICU hemodynamics localized unlisted route', () => {
  it('is explicitly noindex, nofollow, and noarchive', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    expect(metadata.description).toMatch(/Unlisted educational preview/i)
  })

  it.each(['en', 'es', 'zh-CN'])('sets and passes the %s locale', async (locale) => {
    render(await IcuHemodynamicsPage({ params: Promise.resolve({ locale }) }))
    expect(jest.mocked(setRequestLocale)).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('icu-hemodynamics-frame')).toBeInTheDocument()
    expect(screen.getByTestId('icu-hemodynamics-overview')).toBeInTheDocument()
  })
})
