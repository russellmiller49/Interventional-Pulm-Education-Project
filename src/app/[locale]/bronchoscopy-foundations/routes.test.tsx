import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

import { BRONCH_SECTION_IDS } from '@/features/bronchoscopy-foundations/content/pathway'

jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))
jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'}>{children}</a>
  ),
}))
jest.mock(
  '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsModuleFrame',
  () => ({
    BronchoscopyFoundationsModuleFrame: ({
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
        data-testid="bronch-frame"
        data-active={activeHref}
        data-locale={locale}
        data-activity={activityMode ? 'true' : 'false'}
      >
        {children}
      </div>
    ),
  }),
)
jest.mock('@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsHub', () => ({
  BronchoscopyFoundationsHub: () => <div data-testid="bronch-hub" />,
}))
jest.mock(
  '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsLearnLanding',
  () => ({
    BronchoscopyFoundationsLearnLanding: ({ unknownSection }: { unknownSection?: string }) => (
      <div data-testid="bronch-learn-landing" data-unknown={unknownSection ?? ''} />
    ),
  }),
)
jest.mock('@/features/bronchoscopy-foundations/components/stage/BronchStageHost', () => ({
  BronchStageHost: ({ sectionId, locale }: { sectionId: string; locale?: string }) => (
    <div data-testid="bronch-section" data-id={sectionId} data-locale={locale} />
  ),
}))
jest.mock(
  '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsPracticeLanding',
  () => ({
    BronchoscopyFoundationsPracticeLanding: () => <div data-testid="bronch-practice-landing" />,
  }),
)
jest.mock('@/features/bronchoscopy-foundations/components/BronchCaseActivity', () => ({
  BronchCaseActivity: ({ caseId }: { caseId: string }) => (
    <div data-testid="bronch-practice-case" data-id={caseId} />
  ),
}))
jest.mock(
  '@/features/bronchoscopy-foundations/components/BronchoscopyFoundationsAssessLanding',
  () => ({
    BronchoscopyFoundationsAssessLanding: () => <div data-testid="bronch-assess-landing" />,
  }),
)
jest.mock(
  '@/features/bronchoscopy-foundations/components/reference/BronchoscopyFoundationsReference',
  () => ({
    BronchoscopyFoundationsReference: () => <div data-testid="bronch-reference" />,
  }),
)
jest.mock('@/features/bronchoscopy-foundations/components/reference/AirwayStillAtlas', () => ({
  AirwayStillAtlas: () => <div data-testid="bronch-atlas" />,
}))

import BronchoscopyFoundationsPage, { generateMetadata as overviewMetadata } from './page'
import BronchoscopyFoundationsAssessPage, {
  generateMetadata as assessMetadata,
} from './assess/page'
import BronchoscopyFoundationsLearnPage, { generateMetadata as learnMetadata } from './learn/page'
import BronchoscopyFoundationsPracticePage, {
  generateMetadata as practiceMetadata,
} from './practice/page'
import BronchoscopyFoundationsAtlasPage, {
  generateMetadata as atlasMetadata,
} from './reference/airway-atlas/page'
import BronchoscopyFoundationsReferencePage, {
  generateMetadata as referenceMetadata,
} from './reference/page'

const params = (locale: string) => Promise.resolve({ locale })

describe('bronchoscopy foundations route family', () => {
  const localeMock = jest.mocked(setRequestLocale)

  beforeEach(() => localeMock.mockClear())

  it('keeps Overview, Learn, Practice, Assess, Reference and the atlas noindexed', async () => {
    for (const generate of [
      overviewMetadata,
      learnMetadata,
      practiceMetadata,
      assessMetadata,
      referenceMetadata,
      atlasMetadata,
    ]) {
      const metadata = await generate({ params: params('en') })
      expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
      expect(metadata.title).toMatch(/Bronchoscopy Foundations/)
    }
  })

  it.each(['en', 'es', 'zh-CN'])('renders the hub inside the frame for %s', async (locale) => {
    render(await BronchoscopyFoundationsPage({ params: params(locale) }))
    expect(localeMock).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('bronch-frame')).toHaveAttribute(
      'data-active',
      '/bronchoscopy-foundations',
    )
    expect(screen.getByTestId('bronch-frame')).toHaveAttribute('data-locale', locale)
    expect(screen.getByTestId('bronch-hub')).toBeInTheDocument()
  })

  it('opens a known section on the stage host and falls back to the landing for an unknown one', async () => {
    const first = BRONCH_SECTION_IDS[0]
    const known = render(
      await BronchoscopyFoundationsLearnPage({
        params: params('es'),
        searchParams: Promise.resolve({ section: first }),
      }),
    )
    expect(screen.getByTestId('bronch-section')).toHaveAttribute('data-id', first)
    expect(screen.getByTestId('bronch-section')).toHaveAttribute('data-locale', 'es')
    // The host carries its own frame; the page must not add a second one around it.
    expect(screen.queryByTestId('bronch-frame')).not.toBeInTheDocument()
    known.unmount()

    render(
      await BronchoscopyFoundationsLearnPage({
        params: params('en'),
        searchParams: Promise.resolve({ section: 'not-a-section' }),
      }),
    )
    expect(screen.getByTestId('bronch-learn-landing')).toHaveAttribute(
      'data-unknown',
      'not-a-section',
    )
    expect(screen.getByTestId('bronch-frame')).toHaveAttribute(
      'data-active',
      '/bronchoscopy-foundations/learn',
    )
  })

  it('renders the Learn landing with no section and takes the first of a repeated query key', async () => {
    const landing = render(await BronchoscopyFoundationsLearnPage({ params: params('en') }))
    expect(screen.getByTestId('bronch-learn-landing')).toHaveAttribute('data-unknown', '')
    landing.unmount()

    render(
      await BronchoscopyFoundationsLearnPage({
        params: params('en'),
        searchParams: Promise.resolve({ section: [BRONCH_SECTION_IDS[1], 'other'] }),
      }),
    )
    expect(screen.getByTestId('bronch-section')).toHaveAttribute('data-id', BRONCH_SECTION_IDS[1])
  })

  it('opens a known practice case and falls back to the list for an unknown one', async () => {
    const { bronchMicroCasesInPathwayOrder } = jest.requireActual<
      typeof import('@/features/bronchoscopy-foundations/content/microCases')
    >('@/features/bronchoscopy-foundations/content/microCases')
    const first = bronchMicroCasesInPathwayOrder()[0]

    const known = render(
      await BronchoscopyFoundationsPracticePage({
        params: params('en'),
        searchParams: Promise.resolve({ case: first.id }),
      }),
    )
    expect(screen.getByTestId('bronch-practice-case')).toHaveAttribute('data-id', first.id)
    expect(screen.queryByTestId('bronch-practice-landing')).not.toBeInTheDocument()
    known.unmount()

    render(
      await BronchoscopyFoundationsPracticePage({
        params: params('en'),
        searchParams: Promise.resolve({ case: 'not-a-case' }),
      }),
    )
    expect(screen.getByTestId('bronch-practice-landing')).toBeInTheDocument()
    expect(screen.queryByTestId('bronch-practice-case')).not.toBeInTheDocument()
  })

  it('renders Practice and Assess landings inside the frame with their nav hrefs', async () => {
    const practice = render(await BronchoscopyFoundationsPracticePage({ params: params('en') }))
    expect(screen.getByTestId('bronch-practice-landing')).toBeInTheDocument()
    expect(screen.getByTestId('bronch-frame')).toHaveAttribute(
      'data-active',
      '/bronchoscopy-foundations/practice',
    )
    practice.unmount()

    render(await BronchoscopyFoundationsAssessPage({ params: params('zh-CN') }))
    expect(screen.getByTestId('bronch-assess-landing')).toBeInTheDocument()
    expect(screen.getByTestId('bronch-frame')).toHaveAttribute(
      'data-active',
      '/bronchoscopy-foundations/assess',
    )
    expect(screen.getByTestId('bronch-frame')).toHaveAttribute('data-locale', 'zh-CN')
  })

  it('renders the Reference and the atlas inside the frame, both under the Reference nav item', async () => {
    const reference = render(await BronchoscopyFoundationsReferencePage({ params: params('en') }))
    expect(screen.getByTestId('bronch-reference')).toBeInTheDocument()
    expect(screen.getByTestId('bronch-frame')).toHaveAttribute(
      'data-active',
      '/bronchoscopy-foundations/reference',
    )
    reference.unmount()

    render(await BronchoscopyFoundationsAtlasPage({ params: params('es') }))
    expect(screen.getByTestId('bronch-atlas')).toBeInTheDocument()
    expect(screen.getByTestId('bronch-frame')).toHaveAttribute(
      'data-active',
      '/bronchoscopy-foundations/reference',
    )
    expect(screen.getByTestId('bronch-frame')).toHaveAttribute('data-locale', 'es')
  })
})
