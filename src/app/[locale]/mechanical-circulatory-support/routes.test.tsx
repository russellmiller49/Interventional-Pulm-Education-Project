import type React from 'react'
import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

import { criticalCareActivities } from '@/features/critical-care/content/activities'
import { mcsLessons } from '@/features/mechanical-circulatory-support/content/lessons'

jest.mock('@/features/mechanical-circulatory-support/components/McsHub', () => ({
  McsHub: ({ locale }: { locale: string }) => <div data-testid="mcs-hub">{locale}</div>,
}))
jest.mock('@/features/mechanical-circulatory-support/components/McsWorkbench', () => ({
  McsWorkbench: ({
    section,
    locale,
    initialDevice,
    initialActivityId,
  }: {
    section: string
    locale: string
    initialDevice?: string
    initialActivityId?: string
  }) => (
    <div
      data-testid="mcs-workbench"
      data-section={section}
      data-device={initialDevice}
      data-activity={initialActivityId}
    >
      {locale}
    </div>
  ),
}))
jest.mock('@/features/mechanical-circulatory-support/components/McsLearnLanding', () => ({
  McsLearnLanding: () => <div data-testid="mcs-learn-landing" />,
}))
jest.mock('@/features/mechanical-circulatory-support/components/stage/McsStageHost', () => ({
  McsStageHost: ({
    sectionId,
    initialPhase,
    locale,
  }: {
    sectionId: string
    initialPhase?: string
    locale?: string
  }) => (
    <div data-testid="mcs-stage" data-section-id={sectionId} data-initial-phase={initialPhase}>
      {locale}
    </div>
  ),
}))
jest.mock('@/features/mechanical-circulatory-support/components/McsModuleFrame', () => ({
  McsModuleFrame: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mcs-module-frame">{children}</div>
  ),
}))
jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))

import HubPage, { generateMetadata as hubMetadata } from './page'
import LearnPage, { generateMetadata as learnMetadata } from './learn/page'
import PracticePage, { generateMetadata as practiceMetadata } from './practice/page'
import AssessPage, { generateMetadata as assessMetadata } from './assess/page'

describe('mechanical circulatory support route family', () => {
  const localeMock = jest.mocked(setRequestLocale)
  beforeEach(() => localeMock.mockClear())

  it('keeps every localized page noindexed during unlisted preview', async () => {
    const params = Promise.resolve({ locale: 'en' })
    for (const metadata of [hubMetadata, learnMetadata, practiceMetadata, assessMetadata]) {
      expect((await metadata({ params })).robots).toEqual({
        index: false,
        follow: false,
        noarchive: true,
      })
    }
    expect((await hubMetadata({ params })).title).toMatch(/Mechanical Circulatory Support/i)
    expect((await learnMetadata({ params })).title).toMatch(/^Learn ·/)
    expect((await practiceMetadata({ params })).title).toMatch(/^Practice ·/)
    expect((await assessMetadata({ params })).title).toMatch(/^Challenge ·/)
  })

  it.each(['en', 'es', 'zh-CN'])('mounts the localized hub for %s', async (locale) => {
    render(await HubPage({ params: Promise.resolve({ locale }) }))
    expect(localeMock).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('mcs-hub')).toHaveTextContent(locale)
  })

  it.each([
    ['practice', PracticePage],
    ['assess', AssessPage],
  ] as const)('mounts the %s workbench', async (section, Page) => {
    render(await Page({ params: Promise.resolve({ locale: 'en' }) }))
    expect(screen.getByTestId('mcs-workbench')).toHaveAttribute('data-section', section)
  })

  it('opens the Learn pathway landing when no section or track is requested', async () => {
    render(await LearnPage({ params: Promise.resolve({ locale: 'en' }) }))
    expect(screen.getByTestId('mcs-learn-landing')).toBeInTheDocument()
    expect(screen.queryByTestId('mcs-stage')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mcs-workbench')).not.toBeInTheDocument()
  })

  it('puts a requested section on the lesson stage, at its first step', async () => {
    render(
      await LearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ lesson: 'mcs-foundations-signals' }),
      }),
    )
    const stage = screen.getByTestId('mcs-stage')
    expect(stage).toHaveAttribute('data-section-id', 'mcs-foundations-signals')
    expect(stage).toHaveAttribute('data-initial-phase', 'recognize')
    expect(stage).toHaveTextContent('en')
    // The stage renders its own frame, so the landing frame does not wrap it.
    expect(screen.queryByTestId('mcs-module-frame')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mcs-learn-landing')).not.toBeInTheDocument()
  })

  it.each(['recognize', 'predict', 'act', 'observe', 'explain', 'transfer'])(
    'opens a section at the requested phase %s',
    async (phase) => {
      render(
        await LearnPage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve({ lesson: 'iabp-timing-triggering', phase }),
        }),
      )
      expect(screen.getByTestId('mcs-stage')).toHaveAttribute('data-initial-phase', phase)
    },
  )

  it.each(['banana', '', 'Recognize', 'act,observe', 'reflect'])(
    'opens a section at its first step when the phase value is stale or malformed (%s)',
    async (phase) => {
      render(
        await LearnPage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve({ lesson: 'iabp-timing-triggering', phase }),
        }),
      )
      expect(screen.getByTestId('mcs-stage')).toHaveAttribute('data-initial-phase', 'recognize')
    },
  )

  it.each(['iabp', 'impella', 'lvad'] as const)(
    "sends a %s track with no section named to that track's first section",
    async (device) => {
      // The one door: a device link opens on the track's first section rather than on a rail.
      const first = mcsLessons.find((lesson) => lesson.device === device)!
      await expect(
        LearnPage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve({ device }),
        }),
      ).rejects.toMatchObject({
        digest: expect.stringContaining(
          `/en/mechanical-circulatory-support/learn?lesson=${first.id}`,
        ),
      })
      expect(screen.queryByTestId('mcs-stage')).not.toBeInTheDocument()
      expect(screen.queryByTestId('mcs-learn-landing')).not.toBeInTheDocument()
    },
  )

  it('redirects a device track under the locale it was asked for', async () => {
    const first = mcsLessons.find((lesson) => lesson.device === 'impella')!
    await expect(
      LearnPage({
        params: Promise.resolve({ locale: 'es' }),
        searchParams: Promise.resolve({ device: 'impella' }),
      }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining(
        `/es/mechanical-circulatory-support/learn?lesson=${first.id}`,
      ),
    })
  })

  it('lets a named section win over a device hint instead of redirecting', async () => {
    render(
      await LearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ lesson: 'lvad-alarms-emergencies', device: 'iabp' }),
      }),
    )
    expect(screen.getByTestId('mcs-stage')).toHaveAttribute(
      'data-section-id',
      'lvad-alarms-emergencies',
    )
  })

  it('falls back to the pathway landing for an invalid track query', async () => {
    render(
      await LearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ device: 'unknown' }),
      }),
    )
    expect(screen.getByTestId('mcs-learn-landing')).toBeInTheDocument()
    expect(screen.queryByTestId('mcs-stage')).not.toBeInTheDocument()
  })

  it('falls back to the pathway landing for a section id this module does not own', async () => {
    render(
      await LearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ lesson: 'not-a-section' }),
      }),
    )
    expect(screen.getByTestId('mcs-learn-landing')).toBeInTheDocument()
    expect(screen.queryByTestId('mcs-stage')).not.toBeInTheDocument()
  })

  it('maps every MCS catalog query to its exact Learn, Practice, or Assess selection', async () => {
    const activities = criticalCareActivities.filter(
      (activity) => activity.moduleId === 'mechanical-circulatory-support',
    )

    for (const activity of activities) {
      const section = activity.id.split(':')[1]
      const Page =
        section === 'learn' ? LearnPage : section === 'practice' ? PracticePage : AssessPage
      const result = render(
        await Page({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve(activity.query ?? {}),
        }),
      )
      const activityId = activity.id.split(':').slice(2).join(':')
      if (section === 'learn') {
        expect(screen.getByTestId('mcs-stage')).toHaveAttribute('data-section-id', activityId)
      } else {
        expect(screen.getByTestId('mcs-workbench')).toHaveAttribute('data-activity', activityId)
      }
      result.unmount()
    }
  })

  it('ignores array-valued activity queries instead of guessing a target', async () => {
    render(
      await PracticePage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ case: ['IABP-01', 'IMP-01'] }),
      }),
    )
    expect(screen.getByTestId('mcs-workbench')).not.toHaveAttribute('data-activity')
  })
})
