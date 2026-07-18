import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/features/baxter-crrt/components/BaxterCrrtLab', () => ({
  __esModule: true,
  default: ({ locale }: { locale: string }) => <div data-testid="baxter-crrt-lab">{locale}</div>,
}))

import BaxterCrrtPage, { metadata } from './page'

describe('Baxter CRRT localized route', () => {
  const setRequestLocaleMock = jest.mocked(setRequestLocale)

  beforeEach(() => setRequestLocaleMock.mockClear())

  it('derives noindex metadata from the private SME-review release stage', () => {
    expect(metadata.robots).toEqual({
      index: false,
      follow: false,
      noarchive: true,
    })
    expect(metadata.description).toMatch(/18 cases/i)
    expect(metadata.description).toMatch(/PrisMax Mastery/i)
  })

  it.each(['en', 'es', 'zh-CN'])('sets and passes the %s locale', async (locale) => {
    render(await BaxterCrrtPage({ params: Promise.resolve({ locale }) }))
    expect(setRequestLocaleMock).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('baxter-crrt-lab')).toHaveTextContent(locale)
  })
})
