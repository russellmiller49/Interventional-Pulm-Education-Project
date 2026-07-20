import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/features/socrates-demo/components/SocratesDemo', () => ({
  SocratesDemo: () => <div data-testid="socrates-demo">Functional demo</div>,
}))

import SocratesDemoPage, { metadata } from './page'

describe('SOCRATES localized unlisted route', () => {
  it('is explicitly noindex, nofollow, and noarchive', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    expect(metadata.description).toMatch(/Unlisted functional demonstration/i)
  })

  it.each(['en', 'es', 'zh-CN'])('sets the %s locale and renders the demo', async (locale) => {
    render(await SocratesDemoPage({ params: Promise.resolve({ locale }) }))

    expect(jest.mocked(setRequestLocale)).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('socrates-demo')).toBeVisible()
  })
})
