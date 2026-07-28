import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/features/icu-simulation/components', () => ({
  IcuSimulatorHub: ({ locale }: { locale: string }) => (
    <div data-testid="icu-simulator-hub">{locale}</div>
  ),
  IcuSimulatorLab: ({ mode, locale }: { mode: string; locale: string }) => (
    <div data-testid="icu-simulator-lab" data-mode={mode}>
      {locale}
    </div>
  ),
  IcuCapstoneEntry: ({
    mode,
    locale,
    requestedScenarioId,
  }: {
    mode: string
    locale: string
    requestedScenarioId?: string
  }) => (
    <div data-testid="icu-capstone-entry" data-mode={mode} data-scenario={requestedScenarioId}>
      {locale}
    </div>
  ),
  IcuLearnLanding: () => <div data-testid="icu-learn-landing" />,
  IcuWorkspaceOrientation: () => <div data-testid="icu-workspace-orientation" />,
}))

import IcuSimulationPage from './page'
import IcuSimulationAssessPage from './assess/page'
import IcuSimulationLearnPage from './learn/page'
import IcuSimulationPracticePage from './practice/page'
import IcuSimulationSandboxPage from './sandbox/page'

describe('ICU Simulator route family', () => {
  const localeMock = jest.mocked(setRequestLocale)

  beforeEach(() => localeMock.mockClear())

  it.each(['en', 'es', 'zh-CN'])('mounts the localized hub for %s', async (locale) => {
    render(await IcuSimulationPage({ params: Promise.resolve({ locale }) }))

    expect(localeMock).toHaveBeenCalledWith(locale)
    expect(screen.getByTestId('icu-simulator-hub')).toHaveTextContent(locale)
  })

  it('mounts the sandbox lab', async () => {
    render(await IcuSimulationSandboxPage({ params: Promise.resolve({ locale: 'es' }) }))

    expect(localeMock).toHaveBeenCalledWith('es')
    expect(screen.getByTestId('icu-simulator-lab')).toHaveAttribute('data-mode', 'sandbox')
    expect(screen.getByTestId('icu-simulator-lab')).toHaveTextContent('es')
  })

  it('opens the Learn pathway landing when no section is requested', async () => {
    render(await IcuSimulationLearnPage({ params: Promise.resolve({ locale: 'es' }) }))

    expect(localeMock).toHaveBeenCalledWith('es')
    expect(screen.getByTestId('icu-learn-landing')).toBeInTheDocument()
  })

  it('opens the authored orientation section', async () => {
    render(
      await IcuSimulationLearnPage({
        params: Promise.resolve({ locale: 'es' }),
        searchParams: Promise.resolve({ activity: 'workspace-orientation' }),
      }),
    )

    expect(screen.getByTestId('icu-workspace-orientation')).toBeInTheDocument()
  })

  it('opens the coached lab for any other requested Learn section', async () => {
    render(
      await IcuSimulationLearnPage({
        params: Promise.resolve({ locale: 'es' }),
        searchParams: Promise.resolve({ activity: 'hemorrhagic' }),
      }),
    )

    expect(screen.getByTestId('icu-simulator-lab')).toHaveAttribute('data-mode', 'learn')
  })

  it.each([
    ['practice', IcuSimulationPracticePage],
    ['assess', IcuSimulationAssessPage],
  ] as const)('mounts the %s capstone entry and forwards its case query', async (mode, Page) => {
    render(
      await Page({
        params: Promise.resolve({ locale: 'es' }),
        searchParams: Promise.resolve({ case: ['tamponade', 'ignored'] }),
      }),
    )

    expect(localeMock).toHaveBeenCalledWith('es')
    expect(screen.getByTestId('icu-capstone-entry')).toHaveAttribute('data-mode', mode)
    expect(screen.getByTestId('icu-capstone-entry')).toHaveAttribute('data-scenario', 'tamponade')
    expect(screen.getByTestId('icu-capstone-entry')).toHaveTextContent('es')
  })
})
