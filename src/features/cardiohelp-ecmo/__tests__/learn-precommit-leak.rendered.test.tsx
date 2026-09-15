import { fireEvent, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import {
  buildDrillStageLesson,
  resolveGuidedLesson,
} from '../components/stage/adapters/drillStageAdapter'
import { ecmoDrillSpecs } from '../content/drillSpecs'
import { latestState, mountDrill, resetStageHarness } from '../test-support/learnStageHarness'

// ECMO-01 replaces examination disclosure restrictions. The former scanner and blocked evidence
// remain in Git at 034648ad; all engine, source, alarm, and bubble safety suites remain active.
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

beforeEach(() => {
  resetStageHarness()
  global.fetch = jest.fn().mockResolvedValue({ ok: true })
})

it.each(Object.keys(ecmoDrillSpecs))(
  '%s exposes its complete outline and optional explanation without inventing a prediction',
  async (id) => {
    await mountDrill(id)
    const lesson = buildDrillStageLesson(resolveGuidedLesson(id), latestState().supportMode)
    for (const step of lesson.steps) {
      const row = document.querySelector(`[data-step-id="${step.id}"]`)
      expect(row).toHaveTextContent(step.title)
      expect(row?.querySelector('button')).toBeEnabled()
    }
    const prediction = lesson.steps[lesson.predictionStepIndex]
    fireEvent.click(document.querySelector(`[data-step-id="${prediction.id}"] button`)!)
    const before = latestState()
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation without answering' }))
    expect(document.querySelector('[data-optional-explanation]')).not.toBeNull()
    expect(latestState().scenario.prediction).toEqual({
      committed: false,
      goalId: null,
      control: null,
      direction: null,
    })
    expect(latestState().history).toEqual(before.history)
    fireEvent.click(screen.getByRole('button', { name: 'Continue without doing this step' }))
    expect(latestState().scenario.prediction.committed).toBe(false)
    expect(document.querySelector(`[data-step-id="${prediction.id}"]`)).not.toHaveAttribute(
      'data-step-state',
      'done',
    )
    expect(global.fetch).not.toHaveBeenCalled()
  },
)
