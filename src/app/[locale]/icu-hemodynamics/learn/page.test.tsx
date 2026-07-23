import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

jest.mock('@/features/icu-hemodynamics/components/IcuHemodynamicsLearnLandingV2', () => ({
  IcuHemodynamicsLearnLandingV2: () => <div data-testid="learn-landing" />,
}))

jest.mock('@/features/icu-hemodynamics/components/IcuHemodynamicsModuleFrameV2', () => ({
  IcuHemodynamicsModuleFrameV2: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="module-frame">{children}</div>
  ),
}))

jest.mock('@/features/icu-hemodynamics/components/PacSignalValidationActivity', () => ({
  PacSignalValidationActivity: ({ locale }: { locale: string }) => (
    <div data-testid="pac-signal-activity">{locale}</div>
  ),
}))

jest.mock('@/features/icu-hemodynamics/components/PacGuidedSkillActivity', () => ({
  PacGuidedSkillActivity: ({ skillId, locale }: { skillId: string; locale: string }) => (
    <div data-testid="pac-guided-skill">
      {skillId}:{locale}
    </div>
  ),
}))

import IcuHemodynamicsLearnPage, { metadata } from './page'

describe('ICU hemodynamics learn route', () => {
  it('remains noindex and renders the catalog landing by default', async () => {
    render(
      await IcuHemodynamicsLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({}),
      }),
    )
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })
    expect(setRequestLocale).toHaveBeenCalledWith('en')
    expect(screen.getByTestId('module-frame')).toContainElement(screen.getByTestId('learn-landing'))
  })

  it('selects only the known signal-validation activity query', async () => {
    render(
      await IcuHemodynamicsLearnPage({
        params: Promise.resolve({ locale: 'es' }),
        searchParams: Promise.resolve({ activity: 'pac-signal-validation' }),
      }),
    )
    expect(screen.getByTestId('pac-signal-activity')).toHaveTextContent('es')
    expect(screen.queryByTestId('learn-landing')).not.toBeInTheDocument()
  })

  it('opens each cataloged focused PAC skill', async () => {
    render(
      await IcuHemodynamicsLearnPage({
        params: Promise.resolve({ locale: 'zh-CN' }),
        searchParams: Promise.resolve({ activity: 'derived-hemodynamics' }),
      }),
    )
    expect(screen.getByTestId('pac-guided-skill')).toHaveTextContent('derived-hemodynamics:zh-CN')
  })

  it('falls back to the Learn catalog for an unknown activity query', async () => {
    render(
      await IcuHemodynamicsLearnPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ activity: 'unknown-client-reference' }),
      }),
    )
    expect(screen.getByTestId('module-frame')).toContainElement(screen.getByTestId('learn-landing'))
    expect(screen.queryByTestId('pac-guided-skill')).not.toBeInTheDocument()
  })
})
