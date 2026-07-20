import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/features/icu-hemodynamics/components/IcuHemodynamicsLab', () => ({
  __esModule: true,
  default: ({ locale }: { locale: string }) => (
    <div data-testid="icu-hemodynamics-lab">{locale}</div>
  ),
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
    expect(screen.getByTestId('icu-hemodynamics-lab')).toHaveTextContent(locale)
  })
})
