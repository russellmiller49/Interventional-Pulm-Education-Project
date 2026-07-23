import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/features/critical-care/components/CriticalCarePathways', () => ({
  CriticalCarePathwayDetail: ({ pathway }: { pathway: { id: string } }) => (
    <div data-testid="critical-care-pathway-detail">{pathway.id}</div>
  ),
}))

jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))

import CriticalCarePathwayPage, { generateMetadata, generateStaticParams } from './page'

describe('critical-care pathway detail route', () => {
  it('prebuilds each catalog pathway and keeps detail metadata unlisted', async () => {
    expect(generateStaticParams()).toHaveLength(5)
    expect(generateStaticParams()).toContainEqual({ pathwayId: 'shock-and-perfusion' })

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'en', pathwayId: 'shock-and-perfusion' }),
    })
    expect(metadata.title).toBe('Shock and perfusion · Critical Care Learning Center')
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
  })

  it('sets the locale and renders a known pathway', async () => {
    render(
      await CriticalCarePathwayPage({
        params: Promise.resolve({ locale: 'es', pathwayId: 'acute-respiratory-failure' }),
      }),
    )
    expect(jest.mocked(setRequestLocale)).toHaveBeenCalledWith('es')
    expect(screen.getByTestId('critical-care-pathway-detail')).toHaveTextContent(
      'acute-respiratory-failure',
    )
  })

  it('rejects an unknown pathway', async () => {
    await expect(
      CriticalCarePathwayPage({
        params: Promise.resolve({ locale: 'en', pathwayId: 'not-a-pathway' }),
      }),
    ).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
  })
})
