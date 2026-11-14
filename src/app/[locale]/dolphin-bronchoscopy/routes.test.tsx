import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))
jest.mock('@/features/dolphin-bronchoscopy/components/DolphinModuleFrame', () => ({
  DolphinModuleFrame: ({
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
      data-testid="dolphin-frame"
      data-active={activeHref}
      data-locale={locale}
      data-activity={activityMode ? 'true' : 'false'}
    >
      {children}
    </div>
  ),
}))
jest.mock('@/features/dolphin-bronchoscopy/components/DolphinHub', () => ({
  DolphinHub: () => <div data-testid="dolphin-hub" />,
}))
jest.mock('@/features/dolphin-bronchoscopy/components/DolphinLearnLanding', () => ({
  DolphinLearnLanding: ({ unknownSection }: { unknownSection?: string }) => (
    <div data-testid="dolphin-learn-landing" data-unknown={unknownSection ?? ''} />
  ),
}))
jest.mock('@/features/dolphin-bronchoscopy/components/stage/DolphinStageHost', () => ({
  DolphinStageHost: ({ sectionId, locale }: { sectionId: string; locale?: string }) => (
    <div data-testid="dolphin-section" data-id={sectionId} data-locale={locale} />
  ),
}))
jest.mock('@/features/dolphin-bronchoscopy/components/practice/DolphinPracticeLanding', () => ({
  DolphinPracticeLanding: () => <div data-testid="dolphin-practice-landing" />,
}))
jest.mock('@/features/dolphin-bronchoscopy/components/practice/DolphinCaseActivity', () => ({
  DolphinCaseActivity: ({ caseId }: { caseId: string }) => (
    <div data-testid="dolphin-practice-case" data-id={caseId} />
  ),
}))
jest.mock('@/features/dolphin-bronchoscopy/components/practice/DolphinFrameDrill', () => ({
  DolphinFrameDrill: ({ drillId }: { drillId: string }) => (
    <div data-testid="dolphin-frame-drill" data-id={drillId} />
  ),
}))
jest.mock('@/features/dolphin-bronchoscopy/components/practice/DolphinBranchDrill', () => ({
  DolphinBranchDrill: ({ setId }: { setId: string }) => (
    <div data-testid="dolphin-branch-drill" data-id={setId} />
  ),
}))
jest.mock(
  '@/features/dolphin-bronchoscopy/components/assess/DolphinIntegratedCasesLanding',
  () => ({
    DolphinIntegratedCasesLanding: ({ unknownCase }: { unknownCase?: string }) => (
      <div data-testid="dolphin-integrated-landing" data-unknown={unknownCase ?? ''} />
    ),
  }),
)
jest.mock(
  '@/features/dolphin-bronchoscopy/components/assess/DolphinIntegratedCaseActivity',
  () => ({
    DolphinIntegratedCaseActivity: ({ caseId }: { caseId: string }) => (
      <div data-testid="dolphin-integrated-case" data-id={caseId} />
    ),
  }),
)
jest.mock('@/features/dolphin-bronchoscopy/components/reference/DolphinReference', () => ({
  DolphinReference: () => <div data-testid="dolphin-reference" />,
}))

import { DOLPHIN_INTEGRATED_CASES } from '@/features/dolphin-bronchoscopy/content/integratedCases'
import { DOLPHIN_MICRO_CASES } from '@/features/dolphin-bronchoscopy/content/microCases'
import { dolphinSectionIds } from '@/features/dolphin-bronchoscopy/content/pathway'

import DolphinBronchoscopyPage, { generateMetadata as overviewMetadata } from './page'
import DolphinAssessPage, { generateMetadata as assessMetadata } from './assess/page'
import DolphinLearnPage, { generateMetadata as learnMetadata } from './learn/page'
import DolphinPracticePage, { generateMetadata as practiceMetadata } from './practice/page'
import DolphinReferencePage, { generateMetadata as referenceMetadata } from './reference/page'

const params = (locale: string) => Promise.resolve({ locale })

describe('dolphin bronchoscopy route family', () => {
  const localeMock = jest.mocked(setRequestLocale)
  beforeEach(() => localeMock.mockClear())

  it('keeps every page noindexed and names the module', async () => {
    for (const generate of [
      overviewMetadata,
      learnMetadata,
      practiceMetadata,
      assessMetadata,
      referenceMetadata,
    ]) {
      const metadata = await generate({ params: params('en') })
      expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
      expect(metadata.title).toMatch(/Dolphin Bronchoscopy/)
    }
  })

  it.each(['en', 'es', 'zh-CN'])('renders the hub inside the frame for %s', async (locale) => {
    render(await DolphinBronchoscopyPage({ params: params(locale) }))
    expect(localeMock).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('dolphin-frame')).toHaveAttribute(
      'data-active',
      '/dolphin-bronchoscopy',
    )
    expect(screen.getByTestId('dolphin-frame')).toHaveAttribute('data-locale', locale)
    expect(screen.getByTestId('dolphin-hub')).toBeInTheDocument()
  })

  it('opens a section on the stage host, without a second frame, and the landing otherwise', async () => {
    const first = dolphinSectionIds[0]
    const known = render(
      await DolphinLearnPage({
        params: params('es'),
        searchParams: Promise.resolve({ section: first }),
      }),
    )
    expect(screen.getByTestId('dolphin-section')).toHaveAttribute('data-id', first)
    expect(screen.queryByTestId('dolphin-frame')).not.toBeInTheDocument()
    known.unmount()

    render(
      await DolphinLearnPage({
        params: params('en'),
        searchParams: Promise.resolve({ section: 'not-a-section' }),
      }),
    )
    expect(screen.getByTestId('dolphin-learn-landing')).toHaveAttribute(
      'data-unknown',
      'not-a-section',
    )
    expect(screen.getByTestId('dolphin-frame')).toHaveAttribute(
      'data-active',
      '/dolphin-bronchoscopy/learn',
    )
  })

  it('opens a practice case, a frame drill and a branch drill, and the landing for anything else', async () => {
    const caseId = DOLPHIN_MICRO_CASES[0].id
    const one = render(
      await DolphinPracticePage({
        params: params('en'),
        searchParams: Promise.resolve({ case: caseId }),
      }),
    )
    expect(screen.getByTestId('dolphin-practice-case')).toHaveAttribute('data-id', caseId)
    one.unmount()
    const two = render(
      await DolphinPracticePage({
        params: params('en'),
        searchParams: Promise.resolve({ drill: 'where-is-the-tip' }),
      }),
    )
    expect(screen.getByTestId('dolphin-frame-drill')).toHaveAttribute('data-id', 'where-is-the-tip')
    two.unmount()
    const three = render(
      await DolphinPracticePage({
        params: params('en'),
        searchParams: Promise.resolve({ branches: 'near-branches' }),
      }),
    )
    expect(screen.getByTestId('dolphin-branch-drill')).toHaveAttribute('data-id', 'near-branches')
    three.unmount()
    render(
      await DolphinPracticePage({
        params: params('en'),
        searchParams: Promise.resolve({ case: 'nope' }),
      }),
    )
    expect(screen.getByTestId('dolphin-practice-landing')).toBeInTheDocument()
  })

  it('opens an integrated case with no prerequisite and falls back to the list', async () => {
    const id = DOLPHIN_INTEGRATED_CASES[0].id
    const known = render(
      await DolphinAssessPage({
        params: params('en'),
        searchParams: Promise.resolve({ case: [id, 'x'] }),
      }),
    )
    expect(screen.getByTestId('dolphin-integrated-case')).toHaveAttribute('data-id', id)
    known.unmount()
    render(
      await DolphinAssessPage({
        params: params('en'),
        searchParams: Promise.resolve({ case: 'nope' }),
      }),
    )
    expect(screen.getByTestId('dolphin-integrated-landing')).toHaveAttribute('data-unknown', 'nope')
  })

  it('renders the Reference inside the frame', async () => {
    render(await DolphinReferencePage({ params: params('en') }))
    expect(screen.getByTestId('dolphin-reference')).toBeInTheDocument()
    expect(screen.getByTestId('dolphin-frame')).toHaveAttribute(
      'data-active',
      '/dolphin-bronchoscopy/reference',
    )
  })
})
