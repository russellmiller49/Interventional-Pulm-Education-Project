import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

import { peripheralImagingSectionIds } from '@/features/peripheral-imaging/content/pathway'

jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))
jest.mock('@/features/peripheral-imaging/components/PeripheralImagingModuleFrame', () => ({
  PeripheralImagingModuleFrame: ({
    activeHref,
    locale,
    activityMode,
    children,
  }: {
    activeHref: string
    locale?: string
    activityMode?: boolean
    children: React.ReactNode
  }) => (
    <div
      data-testid="imaging-frame"
      data-active={activeHref}
      data-locale={locale}
      data-activity={activityMode ? 'true' : 'false'}
    >
      {children}
    </div>
  ),
}))
jest.mock('@/features/peripheral-imaging/components/PeripheralImagingHub', () => ({
  PeripheralImagingHub: () => <div data-testid="imaging-hub" />,
}))
jest.mock('@/features/peripheral-imaging/components/PeripheralImagingLearnLanding', () => ({
  PeripheralImagingLearnLanding: ({ unknownSection }: { unknownSection?: string }) => (
    <div data-testid="imaging-learn-landing" data-unknown={unknownSection ?? ''} />
  ),
}))
jest.mock('@/features/peripheral-imaging/components/stage/ImagingStageHost', () => ({
  ImagingStageHost: ({ sectionId, locale }: { sectionId: string; locale?: string }) => (
    <div data-testid="imaging-section" data-id={sectionId} data-locale={locale} />
  ),
}))
jest.mock('@/features/peripheral-imaging/components/PeripheralImagingPracticeLanding', () => ({
  PeripheralImagingPracticeLanding: () => <div data-testid="imaging-practice-landing" />,
}))
jest.mock('@/features/peripheral-imaging/components/PeripheralImagingAssessLanding', () => ({
  PeripheralImagingAssessLanding: () => <div data-testid="imaging-assess-landing" />,
}))

import PeripheralImagingPage, { generateMetadata as overviewMetadata } from './page'
import PeripheralImagingAssessPage, { generateMetadata as assessMetadata } from './assess/page'
import PeripheralImagingLearnPage, { generateMetadata as learnMetadata } from './learn/page'
import PeripheralImagingPracticePage, {
  generateMetadata as practiceMetadata,
} from './practice/page'

const params = (locale: string) => Promise.resolve({ locale })

describe('peripheral imaging route family', () => {
  const localeMock = jest.mocked(setRequestLocale)

  beforeEach(() => localeMock.mockClear())

  it('keeps Overview, Learn, Practice, and Assess noindexed', async () => {
    for (const generate of [overviewMetadata, learnMetadata, practiceMetadata, assessMetadata]) {
      const metadata = await generate({ params: params('en') })
      expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
      expect(metadata.title).toMatch(/Peripheral Bronchoscopy Imaging/)
    }
  })

  it.each(['en', 'es', 'zh-CN'])('renders the hub inside the frame for %s', async (locale) => {
    render(await PeripheralImagingPage({ params: params(locale) }))
    expect(localeMock).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('imaging-frame')).toHaveAttribute(
      'data-active',
      '/peripheral-imaging',
    )
    expect(screen.getByTestId('imaging-frame')).toHaveAttribute('data-locale', locale)
    expect(screen.getByTestId('imaging-hub')).toBeInTheDocument()
  })

  it('opens a known section on the stage host and falls back to the landing for an unknown one', async () => {
    const first = peripheralImagingSectionIds[0]
    const known = render(
      await PeripheralImagingLearnPage({
        params: params('es'),
        searchParams: Promise.resolve({ section: first }),
      }),
    )
    expect(screen.getByTestId('imaging-section')).toHaveAttribute('data-id', first)
    expect(screen.getByTestId('imaging-section')).toHaveAttribute('data-locale', 'es')
    // The host carries its own frame; the page must not add a second one around it.
    expect(screen.queryByTestId('imaging-frame')).not.toBeInTheDocument()
    known.unmount()

    render(
      await PeripheralImagingLearnPage({
        params: params('en'),
        searchParams: Promise.resolve({ section: 'not-a-section' }),
      }),
    )
    expect(screen.getByTestId('imaging-learn-landing')).toHaveAttribute(
      'data-unknown',
      'not-a-section',
    )
    expect(screen.getByTestId('imaging-frame')).toHaveAttribute(
      'data-active',
      '/peripheral-imaging/learn',
    )
  })

  it('renders the Learn landing with no section and takes the first of a repeated query key', async () => {
    const landing = render(await PeripheralImagingLearnPage({ params: params('en') }))
    expect(screen.getByTestId('imaging-learn-landing')).toHaveAttribute('data-unknown', '')
    landing.unmount()

    render(
      await PeripheralImagingLearnPage({
        params: params('en'),
        searchParams: Promise.resolve({ section: [peripheralImagingSectionIds[1], 'other'] }),
      }),
    )
    expect(screen.getByTestId('imaging-section')).toHaveAttribute(
      'data-id',
      peripheralImagingSectionIds[1],
    )
  })

  it('renders Practice and Assess landings inside the frame with their nav hrefs', async () => {
    const practice = render(await PeripheralImagingPracticePage({ params: params('en') }))
    expect(screen.getByTestId('imaging-practice-landing')).toBeInTheDocument()
    expect(screen.getByTestId('imaging-frame')).toHaveAttribute(
      'data-active',
      '/peripheral-imaging/practice',
    )
    practice.unmount()

    render(await PeripheralImagingAssessPage({ params: params('zh-CN') }))
    expect(screen.getByTestId('imaging-assess-landing')).toBeInTheDocument()
    expect(screen.getByTestId('imaging-frame')).toHaveAttribute(
      'data-active',
      '/peripheral-imaging/assess',
    )
    expect(screen.getByTestId('imaging-frame')).toHaveAttribute('data-locale', 'zh-CN')
  })
})
