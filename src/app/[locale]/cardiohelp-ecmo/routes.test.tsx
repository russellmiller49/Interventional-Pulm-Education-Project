import type React from 'react'
import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/features/cardiohelp-ecmo/components/CardiohelpHub', () => ({
  __esModule: true,
  CardiohelpHub: ({ locale }: { locale: string }) => (
    <div data-testid="cardiohelp-hub">{locale}</div>
  ),
}))

jest.mock('@/features/cardiohelp-ecmo/components/CardiohelpWorkbench', () => ({
  __esModule: true,
  CardiohelpWorkbench: ({ section, locale }: { section: string; locale: string }) => (
    <div data-testid="cardiohelp-workbench" data-section={section}>
      {locale}
    </div>
  ),
}))

jest.mock('@/features/cardiohelp-ecmo/components/CardiohelpLearnLanding', () => ({
  __esModule: true,
  CardiohelpLearnLanding: ({ supportMode }: { supportMode: string }) => (
    <div data-testid="cardiohelp-learn-landing" data-track={supportMode} />
  ),
}))

jest.mock('@/features/cardiohelp-ecmo/components/EcmoFoundationLessonActivity', () => ({
  __esModule: true,
  EcmoFoundationLessonActivity: ({
    sectionId,
    supportMode,
    initialPhase,
  }: {
    sectionId: string
    supportMode: string
    initialPhase?: string
  }) => (
    <div
      data-testid="ecmo-foundation-activity"
      data-section-id={sectionId}
      data-track={supportMode}
      data-initial-phase={initialPhase}
    />
  ),
}))

jest.mock('@/features/cardiohelp-ecmo/components/EcmoFoundationSectionView', () => ({
  __esModule: true,
  EcmoFoundationSectionView: ({
    sectionId,
    supportMode,
  }: {
    sectionId: string
    supportMode: string
  }) => (
    <div
      data-testid="ecmo-foundation-section"
      data-section-id={sectionId}
      data-track={supportMode}
    />
  ),
}))

jest.mock('@/features/cardiohelp-ecmo/components/CardiohelpModuleFrame', () => ({
  __esModule: true,
  CardiohelpModuleFrame: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="cardiohelp-module-frame">{children}</div>
  ),
}))

jest.mock('@/i18n/handoff-server', () => ({
  localizeHandoffServerValue: async (_locale: string, value: unknown) => value,
}))

import CardiohelpEcmoPage, { generateMetadata as hubMetadata } from './page'
import CardiohelpEcmoLearnPage, { generateMetadata as learnMetadata } from './learn/page'
import CardiohelpEcmoPracticePage, { generateMetadata as practiceMetadata } from './practice/page'
import CardiohelpEcmoAssessPage, { generateMetadata as assessMetadata } from './assess/page'

describe('CARDIOHELP ECMO routes', () => {
  const setRequestLocaleMock = jest.mocked(setRequestLocale)

  beforeEach(() => setRequestLocaleMock.mockClear())

  it('keeps every section noindexed while the module is unlisted', async () => {
    const params = Promise.resolve({ locale: 'en' })
    for (const generateMetadata of [hubMetadata, learnMetadata, practiceMetadata, assessMetadata]) {
      const metadata = await generateMetadata({ params })
      expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    }
    expect((await hubMetadata({ params })).title).toMatch(
      /ECMO Management · CARDIOHELP console lab/i,
    )
    expect((await learnMetadata({ params })).title).toMatch(/^Learn ·/)
    expect((await practiceMetadata({ params })).title).toMatch(/^Practice ·/)
    expect((await assessMetadata({ params })).title).toMatch(/^Challenge ·/)
  })

  it.each(['en', 'es', 'zh-CN'])('renders the hub with the %s locale', async (locale) => {
    render(await CardiohelpEcmoPage({ params: Promise.resolve({ locale }) }))
    expect(setRequestLocaleMock).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('cardiohelp-hub')).toHaveTextContent(locale)
  })

  it.each([
    ['practice', CardiohelpEcmoPracticePage],
    ['assess', CardiohelpEcmoAssessPage],
  ] as const)('mounts the %s workbench section', async (section, Page) => {
    render(await Page({ params: Promise.resolve({ locale: 'en' }) }))
    expect(setRequestLocaleMock).toHaveBeenCalledWith('en')
    const workbench = screen.getByTestId('cardiohelp-workbench')
    expect(workbench).toHaveAttribute('data-section', section)
    expect(workbench).toHaveTextContent('en')
  })

  it.each(['vv', 'va'] as const)('opens the %s Learn pathway landing by default', async (track) => {
    render(
      await CardiohelpEcmoLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ track }),
      }),
    )
    expect(screen.getByTestId('cardiohelp-learn-landing')).toHaveAttribute('data-track', track)
  })

  it.each(['vv', 'va'] as const)(
    'opens the foundation workspace for a shared section on the %s reference',
    async (track) => {
      render(
        await CardiohelpEcmoLearnPage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve({ lesson: 'circuit-flow-path', track }),
        }),
      )
      const activity = screen.getByTestId('ecmo-foundation-activity')
      expect(activity).toHaveAttribute('data-section-id', 'circuit-flow-path')
      expect(activity).toHaveAttribute('data-track', track)
      expect(screen.queryByTestId('ecmo-foundation-section')).not.toBeInTheDocument()
      expect(screen.queryByTestId('cardiohelp-workbench')).not.toBeInTheDocument()
    },
  )

  it.each([
    'why-extracorporeal-support',
    'circuit-flow-path',
    'pump-and-pressure-zones',
    'blood-flow-versus-sweep',
    'vv-series-physiology',
    'vv-normal-state',
    'vv-integration-capstone',
  ])('routes the interactive foundation section %s to the workspace activity', async (lesson) => {
    render(
      await CardiohelpEcmoLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ lesson, track: 'vv' }),
      }),
    )
    expect(screen.getByTestId('ecmo-foundation-activity')).toHaveAttribute(
      'data-section-id',
      lesson,
    )
    expect(screen.queryByTestId('ecmo-foundation-section')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cardiohelp-workbench')).not.toBeInTheDocument()
  })

  it.each(['vv-series-physiology', 'vv-normal-state', 'vv-integration-capstone'])(
    'canonicalizes a VA track on the VV-only section %s instead of loading a VA circuit',
    async (lesson) => {
      await expect(
        CardiohelpEcmoLearnPage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve({ lesson, track: 'va' }),
        }),
      ).rejects.toMatchObject({
        digest: expect.stringContaining(`/en/cardiohelp-ecmo/learn?lesson=${lesson}&track=vv`),
      })
      expect(screen.queryByTestId('ecmo-foundation-activity')).not.toBeInTheDocument()
    },
  )

  it.each(['vv-series-physiology', 'vv-normal-state', 'vv-integration-capstone'])(
    'renders %s directly once the track is already VV, so the redirect cannot loop',
    async (lesson) => {
      render(
        await CardiohelpEcmoLearnPage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve({ lesson, track: 'vv' }),
        }),
      )
      expect(screen.getByTestId('ecmo-foundation-activity')).toHaveAttribute('data-track', 'vv')
    },
  )

  it.each(['banana', '', 'VA', 'vv,va'])(
    'restores VV for a VV-only section when the track value is stale or malformed (%s)',
    async (track) => {
      render(
        await CardiohelpEcmoLearnPage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve({ lesson: 'vv-normal-state', track }),
        }),
      )
      expect(screen.getByTestId('ecmo-foundation-activity')).toHaveAttribute('data-track', 'vv')
    },
  )

  it('opens a lesson at its first phase when no phase is asked for', async () => {
    render(
      await CardiohelpEcmoLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ lesson: 'circuit-flow-path', track: 'vv' }),
      }),
    )
    expect(screen.getByTestId('ecmo-foundation-activity')).toHaveAttribute(
      'data-initial-phase',
      'recognize',
    )
  })

  it.each(['recognize', 'predict', 'act', 'observe', 'explain', 'transfer'])(
    'resumes a lesson at the requested phase %s without redirecting',
    async (phase) => {
      render(
        await CardiohelpEcmoLearnPage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve({ lesson: 'circuit-flow-path', track: 'vv', phase }),
        }),
      )
      expect(screen.getByTestId('ecmo-foundation-activity')).toHaveAttribute(
        'data-initial-phase',
        phase,
      )
    },
  )

  it.each(['banana', '', 'Recognize', 'act,observe', 'reflect'])(
    'canonicalizes a stale or malformed phase value (%s) back to the first phase',
    async (phase) => {
      await expect(
        CardiohelpEcmoLearnPage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve({ lesson: 'circuit-flow-path', track: 'vv', phase }),
        }),
      ).rejects.toMatchObject({
        digest: expect.stringContaining(
          '/en/cardiohelp-ecmo/learn?lesson=circuit-flow-path&track=vv&phase=recognize',
        ),
      })
      expect(screen.queryByTestId('ecmo-foundation-activity')).not.toBeInTheDocument()
    },
  )

  it('adds no phase parameter when canonicalizing a track that had none', async () => {
    // The phase is optional. A track-only fix must leave the URL as short as it arrived, or every
    // plain lesson link in the resource would acquire a parameter it never asked for.
    await expect(
      CardiohelpEcmoLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ lesson: 'vv-normal-state', track: 'va' }),
      }),
    ).rejects.toMatchObject({
      digest: expect.not.stringContaining('phase'),
    })
  })

  it('fixes a stale track and a stale phase in the same redirect', async () => {
    await expect(
      CardiohelpEcmoLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({
          lesson: 'vv-normal-state',
          track: 'va',
          phase: 'banana',
        }),
      }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining(
        '/en/cardiohelp-ecmo/learn?lesson=vv-normal-state&track=vv&phase=recognize',
      ),
    })
  })

  it('carries a valid phase through a track canonicalization', async () => {
    await expect(
      CardiohelpEcmoLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({
          lesson: 'vv-normal-state',
          track: 'va',
          phase: 'explain',
        }),
      }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining(
        '/en/cardiohelp-ecmo/learn?lesson=vv-normal-state&track=vv&phase=explain',
      ),
    })
  })

  it('renders the canonical phase URL directly, so the redirect cannot loop', async () => {
    render(
      await CardiohelpEcmoLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({
          lesson: 'vv-normal-state',
          track: 'vv',
          phase: 'recognize',
        }),
      }),
    )
    expect(screen.getByTestId('ecmo-foundation-activity')).toHaveAttribute(
      'data-initial-phase',
      'recognize',
    )
  })

  it('keeps the working track toggle for a shared section on the VA reference', async () => {
    render(
      await CardiohelpEcmoLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ lesson: 'circuit-flow-path', track: 'va' }),
      }),
    )
    expect(screen.getByTestId('ecmo-foundation-activity')).toHaveAttribute('data-track', 'va')
  })

  it.each(['va-parallel-physiology', 'va-normal-state', 'va-integration-capstone'])(
    'routes the VA foundation section %s to the workspace activity',
    async (lesson) => {
      render(
        await CardiohelpEcmoLearnPage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve({ lesson, track: 'va' }),
        }),
      )
      const activity = screen.getByTestId('ecmo-foundation-activity')
      expect(activity).toHaveAttribute('data-section-id', lesson)
      expect(activity).toHaveAttribute('data-track', 'va')
      expect(screen.queryByTestId('ecmo-foundation-section')).not.toBeInTheDocument()
      expect(screen.queryByTestId('cardiohelp-workbench')).not.toBeInTheDocument()
    },
  )

  it.each(['va-parallel-physiology', 'va-normal-state', 'va-integration-capstone'])(
    'canonicalizes a VV track on the VA-only section %s instead of loading a VV circuit',
    async (lesson) => {
      await expect(
        CardiohelpEcmoLearnPage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve({ lesson, track: 'vv' }),
        }),
      ).rejects.toMatchObject({
        digest: expect.stringContaining(`/en/cardiohelp-ecmo/learn?lesson=${lesson}&track=va`),
      })
      expect(screen.queryByTestId('ecmo-foundation-activity')).not.toBeInTheDocument()
    },
  )

  it.each(['va-parallel-physiology', 'va-normal-state', 'va-integration-capstone'])(
    'renders %s directly once the track is already VA, so the redirect cannot loop',
    async (lesson) => {
      render(
        await CardiohelpEcmoLearnPage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve({ lesson, track: 'va' }),
        }),
      )
      expect(screen.getByTestId('ecmo-foundation-activity')).toHaveAttribute('data-track', 'va')
    },
  )

  it.each(['banana', '', 'VV', 'va,vv'])(
    'canonicalizes a VA-only section to VA when the track value is stale or malformed (%s)',
    async (track) => {
      // A malformed track resolves to VV, which for a VA-only section is not the mode it runs in,
      // so the URL is canonicalized rather than the section being rendered under a VV query.
      await expect(
        CardiohelpEcmoLearnPage({
          params: Promise.resolve({ locale: 'en' }),
          searchParams: Promise.resolve({ lesson: 'va-normal-state', track }),
        }),
      ).rejects.toMatchObject({
        digest: expect.stringContaining(
          '/en/cardiohelp-ecmo/learn?lesson=va-normal-state&track=va',
        ),
      })
    },
  )

  it('carries a valid phase through a VA track canonicalization', async () => {
    await expect(
      CardiohelpEcmoLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({
          lesson: 'va-integration-capstone',
          track: 'vv',
          phase: 'observe',
        }),
      }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining(
        '/en/cardiohelp-ecmo/learn?lesson=va-integration-capstone&track=va&phase=observe',
      ),
    })
  })

  it('opens the guided workbench for a drill section', async () => {
    render(
      await CardiohelpEcmoLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ lesson: 'vv-recirculation', track: 'vv' }),
      }),
    )
    expect(screen.getByTestId('cardiohelp-workbench')).toHaveAttribute('data-section', 'learn')
  })
})
