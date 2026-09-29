import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))
jest.mock('@/features/medical-thoracoscopy/components/hub/MedicalThoracoscopyHub', () => ({
  MedicalThoracoscopyHub: () => <h1 data-testid="thoracoscopy-hub">Hub</h1>,
}))
jest.mock('@/features/medical-thoracoscopy/components/hub/LearnLanding', () => ({
  LearnLanding: ({ requestedSection }: { requestedSection?: string }) => (
    <h1 data-testid="thoracoscopy-learn" data-requested={requestedSection ?? ''}>
      Learn
    </h1>
  ),
}))
jest.mock('@/features/medical-thoracoscopy/components/lesson/SectionLesson', () => ({
  SectionLesson: ({ sectionId }: { sectionId: string }) => (
    <h1 data-testid="thoracoscopy-lesson" data-section={sectionId}>
      Lesson
    </h1>
  ),
}))
jest.mock('@/features/medical-thoracoscopy/components/hub/PracticeLanding', () => ({
  PracticeLanding: () => <h1 data-testid="thoracoscopy-practice">Practice</h1>,
}))
jest.mock('@/features/medical-thoracoscopy/components/hub/CasesLanding', () => ({
  CasesLanding: () => <h1 data-testid="thoracoscopy-cases">Cases</h1>,
}))
jest.mock('@/features/medical-thoracoscopy/components/MedicalThoracoscopyModuleFrame', () => ({
  MedicalThoracoscopyModuleFrame: ({
    activeHref,
    locale,
    children,
  }: {
    activeHref: string
    locale?: string
    children: React.ReactNode
  }) => (
    <div data-testid="thoracoscopy-frame" data-active={activeHref} data-locale={locale}>
      {children}
    </div>
  ),
}))

import MedicalThoracoscopyCasesPage, { generateMetadata as casesMetadata } from './assess/page'
import MedicalThoracoscopyLearnPage, { generateMetadata as learnMetadata } from './learn/page'
import MedicalThoracoscopyPage, { generateMetadata as overviewMetadata } from './page'
import MedicalThoracoscopyPracticePage, {
  generateMetadata as practiceMetadata,
} from './practice/page'
import MedicalThoracoscopyReferencePage, {
  generateMetadata as referenceMetadata,
} from './reference/page'

const params = (locale: string) => Promise.resolve({ locale })

const pages = [
  ['Overview', MedicalThoracoscopyPage, '/medical-thoracoscopy'],
  ['Learn', MedicalThoracoscopyLearnPage, '/medical-thoracoscopy/learn'],
  ['Practice', MedicalThoracoscopyPracticePage, '/medical-thoracoscopy/practice'],
  ['Cases', MedicalThoracoscopyCasesPage, '/medical-thoracoscopy/assess'],
  ['Reference', MedicalThoracoscopyReferencePage, '/medical-thoracoscopy/reference'],
] as const

describe('medical thoracoscopy route family', () => {
  const localeMock = jest.mocked(setRequestLocale)

  beforeEach(() => localeMock.mockClear())

  it('keeps every page noindex, nofollow and noarchive', async () => {
    for (const generate of [
      overviewMetadata,
      learnMetadata,
      practiceMetadata,
      casesMetadata,
      referenceMetadata,
    ]) {
      const metadata = await generate({ params: params('en') })
      expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
      expect(metadata.title).toMatch(/Medical Thoracoscopy/)
    }
  })

  it.each(pages)('renders %s inside the frame, under its own tab', async (_name, Page, href) => {
    render(await Page({ params: params('en') }))

    expect(screen.getByTestId('thoracoscopy-frame')).toHaveAttribute('data-active', href)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it.each(['en', 'es', 'zh-CN'])('passes the locale %s to the frame', async (locale) => {
    render(await MedicalThoracoscopyPage({ params: params(locale) }))

    expect(localeMock).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('thoracoscopy-frame')).toHaveAttribute('data-locale', locale)
  })

  it('hands the Learn landing the requested section, taking the first of a repeated key', async () => {
    const plain = render(await MedicalThoracoscopyLearnPage({ params: params('en') }))
    expect(screen.getByTestId('thoracoscopy-learn')).toHaveAttribute('data-requested', '')
    plain.unmount()

    const unknown = render(
      await MedicalThoracoscopyLearnPage({
        params: params('en'),
        searchParams: Promise.resolve({ section: 'not-a-section' }),
      }),
    )
    expect(screen.getByTestId('thoracoscopy-learn')).toHaveAttribute(
      'data-requested',
      'not-a-section',
    )
    unknown.unmount()

    render(
      await MedicalThoracoscopyLearnPage({
        params: params('en'),
        searchParams: Promise.resolve({ section: ['entry', 'other'] }),
      }),
    )
    expect(screen.getByTestId('thoracoscopy-learn')).toHaveAttribute('data-requested', 'entry')
  })

  it('opens a written section as its lesson, and a section in preparation as the landing', async () => {
    const open = render(
      await MedicalThoracoscopyLearnPage({
        params: params('en'),
        searchParams: Promise.resolve({ section: 'four-controls' }),
      }),
    )
    expect(screen.getByTestId('thoracoscopy-lesson')).toHaveAttribute(
      'data-section',
      'four-controls',
    )
    expect(screen.queryByTestId('thoracoscopy-learn')).toBeNull()
    open.unmount()

    render(
      await MedicalThoracoscopyLearnPage({
        params: params('en'),
        searchParams: Promise.resolve({ section: 'entry' }),
      }),
    )
    expect(screen.getByTestId('thoracoscopy-learn')).toHaveAttribute('data-requested', 'entry')
    expect(screen.queryByTestId('thoracoscopy-lesson')).toBeNull()
  })

  it('renders each page body once, inside the frame', async () => {
    for (const [testId, Page] of [
      ['thoracoscopy-hub', MedicalThoracoscopyPage],
      ['thoracoscopy-practice', MedicalThoracoscopyPracticePage],
      ['thoracoscopy-cases', MedicalThoracoscopyCasesPage],
    ] as const) {
      const { unmount } = render(await Page({ params: params('en') }))
      expect(screen.getByTestId('thoracoscopy-frame')).toContainElement(screen.getByTestId(testId))
      unmount()
    }
    render(await MedicalThoracoscopyReferencePage({ params: params('en') }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Reference')
  })
})
