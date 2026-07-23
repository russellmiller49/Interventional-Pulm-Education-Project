import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

import { criticalCareActivities } from '@/features/critical-care/content/activities'
import { criticalCareCatalogActivityHref } from '@/features/critical-care/content/activityRoutes'

jest.mock(
  '@/features/mechanical-ventilation/components/MechanicalVentilationModuleFrameV2',
  () => ({
    MechanicalVentilationModuleFrameV2: ({
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
  }),
)
jest.mock('@/features/mechanical-ventilation/components/MechanicalVentilationOverviewV2', () => ({
  MechanicalVentilationOverviewV2: () => <div data-testid="ventilation-overview" />,
}))
jest.mock(
  '@/features/mechanical-ventilation/components/MechanicalVentilationLearnLandingV2',
  () => ({ MechanicalVentilationLearnLandingV2: () => <div data-testid="ventilation-learn" /> }),
)
jest.mock(
  '@/features/mechanical-ventilation/components/MechanicalVentilationLessonActivity',
  () => ({
    MechanicalVentilationLessonActivity: ({
      lesson,
      locale,
    }: {
      lesson: { id: string }
      locale: string
    }) => <div data-testid="ventilation-lesson" data-id={lesson.id} data-locale={locale} />,
  }),
)
jest.mock(
  '@/features/mechanical-ventilation/components/MechanicalVentilationPracticeSetupV2',
  () => ({
    MechanicalVentilationPracticeSetupV2: ({
      compatibilityNotice,
    }: {
      compatibilityNotice?: string
    }) => <div data-testid="ventilation-practice-setup">{compatibilityNotice}</div>,
  }),
)
jest.mock(
  '@/features/mechanical-ventilation/components/MechanicalVentilationAssessSetupV2',
  () => ({
    MechanicalVentilationAssessSetupV2: ({
      compatibilityNotice,
    }: {
      compatibilityNotice?: string
    }) => <div data-testid="ventilation-assess-setup">{compatibilityNotice}</div>,
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
    expect(screen.getByTestId('ventilation-frame')).toHaveAttribute(
      'data-active',
      '/mechanical-ventilation',
    )
    expect(screen.getByTestId('ventilation-overview')).toBeInTheDocument()
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
    expect(screen.getByTestId('ventilation-learn')).toBeInTheDocument()
    expect(screen.getByText(/Unknown lesson/i)).toBeInTheDocument()
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
    expect(screen.getByTestId('ventilation-assess-setup')).toHaveTextContent(
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

  it('lands the masked assessment catalog entry on setup without a malformed case query', async () => {
    const assessment = criticalCareActivities.find(
      (activity) => activity.id === 'ventilation:assess:masked-seeded',
    )
    if (!assessment) throw new Error('Expected the ventilation assessment catalog entry.')
    expect(criticalCareCatalogActivityHref(assessment)).toBe('/mechanical-ventilation/assess')

    render(
      await MechanicalVentilationAssessPage({
        params: Promise.resolve({ locale: 'en' }),
      }),
    )
    expect(screen.getByTestId('ventilation-assess-setup')).toBeInTheDocument()
    expect(screen.getByTestId('ventilation-assess-setup')).toBeEmptyDOMElement()
  })
})
