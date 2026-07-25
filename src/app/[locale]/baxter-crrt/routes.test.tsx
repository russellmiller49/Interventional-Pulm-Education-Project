import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

import { criticalCareActivities } from '@/features/critical-care/content/activities'

jest.mock('@/features/baxter-crrt/components/BaxterCrrtHub', () => ({
  BaxterCrrtHub: ({ locale }: { locale: string }) => <div data-testid="crrt-hub">{locale}</div>,
}))
jest.mock('@/features/baxter-crrt/components/BaxterCrrtLearn', () => ({
  BaxterCrrtLearn: ({ locale, initialLessonId }: { locale: string; initialLessonId?: string }) => (
    <div data-testid="crrt-learn" data-initial={initialLessonId}>
      {locale}
    </div>
  ),
}))
jest.mock('@/features/baxter-crrt/components/BaxterCrrtPractice', () => ({
  BaxterCrrtPractice: ({ locale, initialCaseId }: { locale: string; initialCaseId?: string }) => (
    <div data-testid="crrt-practice" data-initial={initialCaseId}>
      {locale}
    </div>
  ),
}))
jest.mock('@/features/baxter-crrt/components/BaxterCrrtAssess', () => ({
  BaxterCrrtAssess: ({ locale }: { locale: string }) => (
    <div data-testid="crrt-assess">{locale}</div>
  ),
}))
jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))

import BaxterCrrtPage, { generateMetadata as hubMetadata } from './page'
import BaxterCrrtAssessPage, { generateMetadata as assessMetadata } from './assess/page'
import BaxterCrrtLearnPage, { generateMetadata as learnMetadata } from './learn/page'
import BaxterCrrtPracticePage, { generateMetadata as practiceMetadata } from './practice/page'

describe('Baxter CRRT routes', () => {
  const setRequestLocaleMock = jest.mocked(setRequestLocale)

  beforeEach(() => setRequestLocaleMock.mockClear())

  it('keeps every section noindexed during SME review', async () => {
    const params = Promise.resolve({ locale: 'en' })
    for (const metadata of [hubMetadata, learnMetadata, practiceMetadata, assessMetadata]) {
      expect((await metadata({ params })).robots).toEqual({
        index: false,
        follow: false,
        noarchive: true,
      })
    }
    expect((await hubMetadata({ params })).title).toMatch(/CRRT · PrisMax console lab/i)
    expect((await learnMetadata({ params })).title).toMatch(/^Learn ·/)
    expect((await practiceMetadata({ params })).title).toMatch(/^Practice ·/)
    expect((await assessMetadata({ params })).title).toMatch(/^Challenge ·/)
  })

  it.each(['en', 'es', 'zh-CN'])('renders the hub with the %s locale', async (locale) => {
    render(await BaxterCrrtPage({ params: Promise.resolve({ locale }) }))
    expect(setRequestLocaleMock).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('crrt-hub')).toHaveTextContent(locale)
  })

  it('passes validated query candidates into Learn and Practice', async () => {
    render(
      await BaxterCrrtLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ lesson: 'crrt-circuit-pressures' }),
      }),
    )
    expect(screen.getByTestId('crrt-learn')).toHaveAttribute(
      'data-initial',
      'crrt-circuit-pressures',
    )

    render(
      await BaxterCrrtPracticePage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ case: 'CRRT-13' }),
      }),
    )
    expect(screen.getByTestId('crrt-practice')).toHaveAttribute('data-initial', 'CRRT-13')
  })

  it('mounts the Assess client component', async () => {
    render(await BaxterCrrtAssessPage({ params: Promise.resolve({ locale: 'en' }) }))
    expect(screen.getByTestId('crrt-assess')).toHaveTextContent('en')
  })

  it('maps every CRRT catalog query to the exact runtime selector', async () => {
    const activities = criticalCareActivities.filter(
      (activity) => activity.moduleId === 'baxter-crrt',
    )
    for (const activity of activities) {
      const section = activity.id.split(':')[1]
      const sourceId = activity.id.split(':').slice(2).join(':')
      if (section === 'assess') {
        expect(activity.query).toBeUndefined()
        continue
      }
      const result = render(
        section === 'learn'
          ? await BaxterCrrtLearnPage({
              params: Promise.resolve({ locale: 'en' }),
              searchParams: Promise.resolve(activity.query ?? {}),
            })
          : await BaxterCrrtPracticePage({
              params: Promise.resolve({ locale: 'en' }),
              searchParams: Promise.resolve(activity.query ?? {}),
            }),
      )
      expect(
        screen.getByTestId(section === 'learn' ? 'crrt-learn' : 'crrt-practice'),
      ).toHaveAttribute('data-initial', sourceId)
      result.unmount()
    }
  })
})
