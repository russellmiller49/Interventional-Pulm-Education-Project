import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/features/critical-care/components/CriticalCarePathways', () => ({
  CriticalCarePathwaysIndex: () => <div data-testid="critical-care-pathways" />,
}))

jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))

import CriticalCarePathwaysPage, { generateMetadata } from './page'

describe('critical-care pathways route', () => {
  it('is explicitly noindex, nofollow, and noarchive', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) })
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    expect(metadata.title).toBe('Clinical Pathways · Critical Care Learning Center')
  })

  it.each(['en', 'es', 'zh-CN'])('sets the %s locale and renders the pathways', async (locale) => {
    render(await CriticalCarePathwaysPage({ params: Promise.resolve({ locale }) }))
    expect(jest.mocked(setRequestLocale)).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('critical-care-pathways')).toBeInTheDocument()
  })
})
