import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

import { criticalCareFeatureFlags } from '@/features/critical-care/featureFlags'

jest.mock('@/features/critical-care/components/CriticalCareHub', () => ({
  CriticalCareHub: () => <div data-testid="critical-care-hub" />,
}))

jest.mock('@/features/critical-care/featureFlags', () => ({
  criticalCareFeatureFlags: {
    criticalCareDashboardV2: true,
  },
}))

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))

import CriticalCarePage, { generateMetadata } from './page'

describe('critical care parent route', () => {
  const featureFlags = criticalCareFeatureFlags as {
    criticalCareDashboardV2: boolean
  }

  afterEach(() => {
    featureFlags.criticalCareDashboardV2 = true
  })

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

  it('keeps direct access to every preserved public lab when the dashboard flag is off', async () => {
    featureFlags.criticalCareDashboardV2 = false

    render(await CriticalCarePage({ params: Promise.resolve({ locale: 'en' }) }))

    expect(screen.queryByTestId('critical-care-hub')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Open full lab' })).toHaveLength(4)
  })
})
