import { cleanup } from '@testing-library/react'

import { HEMODYNAMICS_NEXT_MODULE } from '../content/moduleHandOffs'
import { hemodynamicsPathway } from '../content/pathwayResolver'
import { installDom, leaveTask, mountSection } from '../test-support/stageHarness'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  installDom()
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as never
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

/** Leave every task, as a learner paging through would, until the section says it is finished. */
function finish(sectionId: string) {
  mountSection(sectionId)
  let guard = 80
  while (!document.querySelector('[data-stage-completion]') && guard-- > 0) leaveTask()
  return document.querySelector('[data-stage-completion]') as HTMLElement
}

/**
 * The course's hand-off (critical care plan, round 3).
 *
 * The last section ended on "Open the applied case" and said nothing of where its readings are
 * used next. Its finished card now names Mechanical Circulatory Support and links to it.
 */
describe('where hemodynamics hands on', () => {
  const sections = hemodynamicsPathway.sections.map((section) => section.id)
  const last = sections.at(-1)!

  it('is on the last section’s finished card, with a link to the module', () => {
    const done = finish(last)
    expect(done).not.toBeNull()
    const line = done.querySelector('[data-next-module]') as HTMLElement
    expect(line).toHaveAttribute('data-next-module', '/mechanical-circulatory-support')
    expect(line.textContent).toBe(
      `${HEMODYNAMICS_NEXT_MODULE.line} Open Mechanical Circulatory Support`,
    )
    const link = line.querySelector('a')!
    expect(link).toHaveAttribute('href', '/mechanical-circulatory-support')
    expect(link.textContent).toBe('Open Mechanical Circulatory Support')
    // The section's own way on is still there, after it.
    expect(done.textContent).toContain('Open the applied case')
  })

  it('is not on a section that has a next section', () => {
    const done = finish(sections[1])
    expect(done.querySelector('[data-next-section]')).not.toBeNull()
    expect(done.querySelector('[data-next-module]')).toBeNull()
  })

  it('says where the readings are used, and names no finding or answer', () => {
    expect(HEMODYNAMICS_NEXT_MODULE.line).toMatch(/^Where these readings are used next: /)
    expect(HEMODYNAMICS_NEXT_MODULE.line).not.toMatch(/\d|should|must|simulat/i)
  })
})
