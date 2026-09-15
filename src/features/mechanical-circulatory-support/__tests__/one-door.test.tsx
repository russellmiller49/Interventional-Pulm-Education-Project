/**
 * One door, one map: the hub and the Learn landing resolve Continue through the one resolver,
 * show the pathway as the same groups, name cases by presentation, and carry counts derived from
 * the registry.
 */
import { act, render, screen, within } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .navigationModule(),
)
jest.mock('../components/EcmoCannulationPreview', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .ecmoPreviewModule(),
)
jest.mock('../components/ImpellaVariantPreview', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .impellaPreviewModule(),
)

import { McsHub } from '../components/McsHub'
import { McsLearnLanding } from '../components/McsLearnLanding'
import { mcsPathway, mcsPathwayComposition } from '../content/pathwayResolver'
import { mcsCapstoneScenarios, mcsPracticeScenarios } from '../content/scenarios'
import { mcsPresentationTitle } from '../content/casePresentation'
import { recordMcsVisit } from '../engine/learningProgress'

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
}

beforeEach(() => {
  window.localStorage.clear()
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  })
})

describe('the hub', () => {
  it('opens on one Continue that a fresh learner resolves to section one', async () => {
    render(<McsHub />)
    await settle()
    const cta = document.querySelector('[data-mcs-continue]')!
    expect(cta).toHaveAttribute('data-mcs-continue', 'resolved')
    expect(cta.textContent).toMatch(/^Start — /)
    expect(cta).toHaveAttribute(
      'href',
      expect.stringContaining(`lesson=${mcsPathway().sections[0].id}`),
    )
    expect(document.querySelectorAll('[data-mcs-continue]')).toHaveLength(1)
  })

  it('resumes the last visited lesson phase and labels visits honestly', async () => {
    const order = mcsPathway().sections.map((section) => section.id)
    for (const id of order.slice(0, 3)) recordMcsVisit(id, 'learn', 'iabp', 'explain')
    render(<McsHub />)
    await settle()
    const cta = document.querySelector('[data-mcs-continue]')!
    expect(cta.textContent).toMatch(/^Resume — /)
    expect(cta).toHaveAttribute('data-mcs-continue-section', order[2])
    const open = [...document.querySelectorAll('[data-pathway-accordion] details')].filter(
      (d) => (d as HTMLDetailsElement).open,
    )
    expect(open.map((d) => d.getAttribute('data-unit'))).toEqual(['iabp'])
    expect(document.querySelectorAll('[data-kind="section"][data-visited="true"]')).toHaveLength(3)
    expect(document.querySelector('[data-recommended="true"]')?.textContent).toContain('up next')
  })

  it('derives its composition and its groups from the registry', async () => {
    render(<McsHub />)
    await settle()
    expect(document.querySelector('[data-pathway-composition]')?.textContent).toBe(
      mcsPathwayComposition().sentence,
    )
    const accordion = document.querySelector('[data-pathway-accordion]')!
    const sections = accordion.querySelectorAll('[data-kind="section"]')
    expect(sections).toHaveLength(mcsPathway().sections.length)
    expect(accordion.querySelectorAll('[data-kind="case"]')).toHaveLength(
      mcsPracticeScenarios.length,
    )
    expect(accordion.querySelectorAll('[data-kind="capstone"]')).toHaveLength(
      mcsCapstoneScenarios.length,
    )
    // Flattening the groups reproduces the canonical order.
    expect([...sections].map((chip) => chip.querySelector('a')?.getAttribute('href'))).toEqual(
      mcsPathway().sections.map(
        (section) => `/mechanical-circulatory-support/learn?lesson=${section.id}`,
      ),
    )
  })

  it('names every case by its clinical teaching topic', async () => {
    render(<McsHub />)
    await settle()
    const text = document.querySelector('[data-pathway-accordion]')?.textContent ?? ''
    for (const scenario of [...mcsPracticeScenarios, ...mcsCapstoneScenarios]) {
      expect(text).toContain(mcsPresentationTitle(scenario))
    }
    expect(
      within(document.querySelector('[data-pathway-accordion]') as HTMLElement).getAllByRole('link')
        .length,
    ).toBeGreaterThan(9)
  })

  it('folds the reference material rather than opening on it', async () => {
    render(<McsHub />)
    await settle()
    const references = document.querySelectorAll('[data-reference]')
    expect(references).toHaveLength(4)
    for (const block of references) expect((block as HTMLDetailsElement).open).toBe(false)
    expect(screen.getByText(/9 sections, in one order/)).toBeInTheDocument()
  })
})

describe('the Learn landing', () => {
  it('is the same door and the same map', async () => {
    render(<McsLearnLanding />)
    await settle()
    const cta = document.querySelector('[data-mcs-continue]')!
    expect(cta.textContent).toMatch(/^Start — /)
    expect(document.querySelector('[data-pathway-accordion]')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-kind="section"]')).toHaveLength(
      mcsPathway().sections.length,
    )
  })
})
