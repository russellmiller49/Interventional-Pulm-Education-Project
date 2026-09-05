import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

import { criticalCareActivities } from '@/features/critical-care/content/activities'
import { criticalCareCatalogActivityHref } from '@/features/critical-care/content/activityRoutes'

jest.mock('@/features/mechanical-ventilation/components/MechanicalVentilationModuleFrame', () => ({
  MechanicalVentilationModuleFrame: ({
    activeHref,
    children,
  }: {
    activeHref: string
    children: React.ReactNode
  }) => (
    <div data-testid="ventilation-frame" data-active={activeHref}>
      {children}
    </div>
  ),
}))
jest.mock('@/features/mechanical-ventilation/components/MechanicalVentilationHub', () => ({
  MechanicalVentilationHub: ({ locale }: { locale: string }) => (
    <div data-testid="ventilation-hub" data-locale={locale} />
  ),
}))
jest.mock('@/features/mechanical-ventilation/components/MechanicalVentilationLearnLanding', () => ({
  MechanicalVentilationLearnLanding: ({
    locale,
    unknownActivity,
  }: {
    locale: string
    unknownActivity?: string
  }) => (
    <div data-testid="ventilation-learn-landing" data-locale={locale}>
      {unknownActivity ? 'Unknown section' : null}
    </div>
  ),
}))
jest.mock('@/features/mechanical-ventilation/components/stage/VentilationStageHost', () => ({
  VentilationStageHost: ({ unitId, locale }: { unitId: string; locale: string }) => (
    <div data-testid="ventilation-lesson" data-id={unitId} data-locale={locale} />
  ),
}))
jest.mock(
  '@/features/mechanical-ventilation/components/MechanicalVentilationPracticePicker',
  () => ({
    MechanicalVentilationPracticePicker: ({
      compatibilityNotice,
      requestedCaseId,
    }: {
      compatibilityNotice?: string
      requestedCaseId?: string
    }) => (
      <div data-testid="ventilation-practice-setup" data-case={requestedCaseId}>
        {compatibilityNotice}
      </div>
    ),
  }),
)
jest.mock('@/features/mechanical-ventilation/components/MechanicalVentilationCourseCheck', () => ({
  MechanicalVentilationCourseCheck: ({ kind }: { kind: string }) => (
    <div data-testid="ventilation-assess-setup" data-kind={kind} />
  ),
}))
jest.mock(
  '@/features/mechanical-ventilation/components/MechanicalVentilationAssessSetupV2',
  () => ({
    MechanicalVentilationAssessSetupV2: ({
      compatibilityNotice,
    }: {
      compatibilityNotice?: string
    }) => <div data-testid="ventilation-challenge-setup">{compatibilityNotice}</div>,
  }),
)
jest.mock(
  '@/features/mechanical-ventilation/components/MechanicalVentilationCaseActivityLoader',
  () => ({
    MechanicalVentilationCaseActivityLoader: (props: {
      locale: string
      caseId: string
      deviceId: string
      mode: string
      section: string
      seedToken?: string
    }) => (
      <div
        data-testid="ventilation-case"
        data-locale={props.locale}
        data-case={props.caseId}
        data-device={props.deviceId}
        data-mode={props.mode}
        data-section={props.section}
        data-seed={props.seedToken}
      />
    ),
  }),
)

import MechanicalVentilationPage, { metadata as overviewMetadata } from './page'
import MechanicalVentilationAssessPage, { metadata as assessMetadata } from './assess/page'
import MechanicalVentilationLearnPage, { metadata as learnMetadata } from './learn/page'
import MechanicalVentilationPracticePage, { metadata as practiceMetadata } from './practice/page'

describe('mechanical ventilation route family', () => {
  const localeMock = jest.mocked(setRequestLocale)

  beforeEach(() => localeMock.mockClear())

  it('keeps Overview, Learn, Practice, and Assess noindexed', () => {
    for (const metadata of [overviewMetadata, learnMetadata, practiceMetadata, assessMetadata]) {
      expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    }
  })

  it.each(['en', 'es', 'zh-CN'])('renders the localized overview for %s', async (locale) => {
    render(await MechanicalVentilationPage({ params: Promise.resolve({ locale }) }))
    expect(localeMock).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('ventilation-hub')).toHaveAttribute('data-locale', locale)
  })

  it('opens a known focused lesson and safely falls back for an unknown lesson', async () => {
    const known = await MechanicalVentilationLearnPage({
      params: Promise.resolve({ locale: 'es' }),
      searchParams: Promise.resolve({ activity: 'waveform-reading-sequence' }),
    })
    const knownRender = render(known)
    expect(screen.getByTestId('ventilation-lesson')).toHaveAttribute(
      'data-id',
      'waveform-reading-sequence',
    )
    expect(screen.getByTestId('ventilation-lesson')).toHaveAttribute('data-locale', 'es')
    knownRender.unmount()

    render(
      await MechanicalVentilationLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ activity: 'unknown' }),
      }),
    )
    expect(screen.getByTestId('ventilation-learn-landing')).toBeInTheDocument()
    expect(screen.getByText(/Unknown section/i)).toBeInTheDocument()
  })

  it('loads a validated fixed-device practice case and rejects incomplete deep links', async () => {
    const validRender = render(
      await MechanicalVentilationPracticePage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({
          case: 'MV-15',
          device: 'carefusion-avea',
          mode: 'practice',
        }),
      }),
    )
    expect(screen.getByTestId('ventilation-case')).toHaveAttribute('data-case', 'MV-15')
    expect(screen.getByTestId('ventilation-case')).toHaveAttribute('data-device', 'carefusion-avea')
    expect(screen.getByTestId('ventilation-case')).toHaveAttribute('data-mode', 'practice')
    validRender.unmount()

    render(
      await MechanicalVentilationPracticePage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ case: 'MV-15', device: 'unknown' }),
      }),
    )
    expect(screen.getByTestId('ventilation-practice-setup')).toHaveTextContent(
      /missing or incompatible/i,
    )
  })

  it('draws a seeded masked challenge without exposing a selectable case query', async () => {
    const validRender = render(
      await MechanicalVentilationAssessPage({
        params: Promise.resolve({ locale: 'zh-CN' }),
        searchParams: Promise.resolve({
          case: 'masked-seeded',
          seed: 'assessment-42',
          device: 'hamilton-c6',
        }),
      }),
    )
    expect(screen.getByTestId('ventilation-case')).toHaveAttribute(
      'data-case',
      expect.stringMatching(/^MV-\d{2}$/),
    )
    expect(screen.getByTestId('ventilation-case')).toHaveAttribute('data-mode', 'challenge')
    expect(screen.getByTestId('ventilation-case')).toHaveAttribute('data-section', 'assess')
    expect(screen.getByTestId('ventilation-case')).toHaveAttribute('data-seed', 'assessment-42')
    validRender.unmount()

    render(
      await MechanicalVentilationAssessPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ case: 'MV-01', seed: 'bad seed', device: 'hamilton-c6' }),
      }),
    )
    expect(screen.getByTestId('ventilation-assess-setup')).toHaveAttribute('data-kind', 'final')
    expect(screen.getByTestId('ventilation-challenge-setup')).toHaveTextContent(
      /missing or incompatible/i,
    )
  })

  it('turns every ventilation Practice catalog entry into an actionable safe-default route', async () => {
    const practiceActivities = criticalCareActivities.filter(
      (activity) =>
        activity.moduleId === 'mechanical-ventilation' &&
        activity.id.startsWith('ventilation:practice:'),
    )

    for (const activity of practiceActivities) {
      const href = new URL(criticalCareCatalogActivityHref(activity), 'https://example.test')
      expect(href.searchParams.get('case')).toBe(activity.id.split(':').at(-1))
      expect(href.searchParams.get('device')).toBe('hamilton-c6')
      expect(href.searchParams.get('mode')).toBe('practice')

      const result = render(
        await MechanicalVentilationPracticePage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve(Object.fromEntries(href.searchParams)),
        }),
      )
      expect(screen.getByTestId('ventilation-case')).toHaveAttribute(
        'data-case',
        activity.id.split(':').at(-1),
      )
      result.unmount()
    }
  })

  it('opens the stable ventilation challenge catalog entry directly', async () => {
    const assessment = criticalCareActivities.find(
      (activity) => activity.id === 'ventilation:assess:masked-seeded',
    )
    if (!assessment) throw new Error('Expected the ventilation assessment catalog entry.')
    const href = new URL(criticalCareCatalogActivityHref(assessment), 'https://example.test')
    expect(href.pathname).toBe('/mechanical-ventilation/assess')
    expect(href.searchParams.get('case')).toBe('masked-seeded')
    expect(href.searchParams.get('seed')).toBe('catalog-challenge-v1')
    expect(href.searchParams.get('device')).toBe('hamilton-c6')

    render(
      await MechanicalVentilationAssessPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve(Object.fromEntries(href.searchParams)),
      }),
    )
    expect(screen.getByTestId('ventilation-case')).toHaveAttribute('data-mode', 'challenge')
    expect(screen.getByTestId('ventilation-case')).toHaveAttribute('data-section', 'assess')
    expect(screen.getByTestId('ventilation-case')).toHaveAttribute(
      'data-seed',
      'catalog-challenge-v1',
    )
  })
})
