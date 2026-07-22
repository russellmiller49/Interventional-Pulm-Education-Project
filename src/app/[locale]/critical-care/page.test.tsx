import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/features/critical-care/components/CriticalCareHub', () => ({
  CriticalCareHub: () => <div data-testid="critical-care-hub" />,
}))

jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))

import CriticalCarePage, { generateMetadata } from './page'

describe('critical care parent route', () => {
  it('is explicitly noindex, nofollow, and noarchive', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) })
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    expect(metadata.title).toBe('Critical Care Learning Center')
  })

  it.each(['en', 'es', 'zh-CN'])('sets the %s locale and renders the hub', async (locale) => {
    render(await CriticalCarePage({ params: Promise.resolve({ locale }) }))
    expect(jest.mocked(setRequestLocale)).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('critical-care-hub')).toBeInTheDocument()
  })
})
