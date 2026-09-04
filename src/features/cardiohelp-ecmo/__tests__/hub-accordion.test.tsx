import { fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

import { CardiohelpHub } from '../components/CardiohelpHub'
import { EcmoPathwayAccordion, summaryLine } from '../components/EcmoPathwayAccordion'
import { presentationTitle } from '../content/casePresentation'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { ecmoPathwayGroups, ecmoPathwaySectionKind } from '../content/pathwayResolver'
import { CARDIOHELP_PROGRESS_STORAGE_KEY, createDefaultProgress } from '../engine/progress'
import type { ProgressV2, SupportMode } from '../engine/types'

/**
 * One map (skill principle 12): seven units as native disclosures, one open at a time on load, every
 * count derived, every section once, cases named by presentation.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}${
            href.query && Object.keys(href.query).length > 0
              ? `?${new URLSearchParams(href.query).toString()}`
              : ''
          }`
    return (
      <a href={resolved} {...props}>
        {children}
      </a>
    )
  },
}))

const TRACKS: readonly SupportMode[] = ['vv', 'va']

function progressWith(worked: readonly string[]): ProgressV2 {
  const drills = worked.filter((id) => ecmoPathwaySectionKind(id) === 'drill')
  const foundations = worked.filter((id) => ecmoPathwaySectionKind(id) === 'foundation-workspace')
  return {
    ...createDefaultProgress(),
    completedLearnLessonIds: drills,
    ...(foundations.length > 0 ? { completedFoundationSectionIds: foundations } : {}),
  }
}

function openUnits(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLDetailsElement>('details[data-unit]'))
    .filter((details) => details.open)
    .map((details) => details.dataset.unit ?? '')
}

beforeEach(() => {
  window.localStorage.clear()
})

describe.each(TRACKS)('the %s pathway accordion', (track) => {
  const sections = criticalCareLearningPathway('cardiohelp-ecmo', track).sections
  const groups = ecmoPathwayGroups(track)

  it('opens exactly the unit holding the first section for a fresh learner', () => {
    const { container } = render(
      <EcmoPathwayAccordion track={track} progress={createDefaultProgress()} />,
    )
    expect(openUnits(container)).toEqual([groups[0]!.unitId])
  })

  it('opens exactly the unit holding the next section part-way through', () => {
    const worked = sections.slice(0, 8).map((section) => section.id)
    const { container } = render(
      <EcmoPathwayAccordion track={track} progress={progressWith(worked)} />,
    )
    const nextId = sections[8]!.id
    const expected = groups.find((group) => group.sections.some((s) => s.id === nextId))!.unitId
    expect(openUnits(container)).toEqual([expected])
    expect(container.querySelector('[data-recommended="true"]')?.getAttribute('href')).toContain(
      `lesson=${nextId}`,
    )
  })

  it('lists every section exactly once, in canonical order, and every case by presentation', () => {
    const { container } = render(
      <EcmoPathwayAccordion track={track} progress={createDefaultProgress()} />,
    )
    const sectionIds = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('a[data-kind="section"]'),
    ).map((link) => new URLSearchParams(link.getAttribute('href')!.split('?')[1]).get('lesson'))
    expect(sectionIds).toEqual(sections.map((section) => section.id))

    for (const group of groups) {
      for (const caseId of group.caseScenarioIds) {
        const definition = clinicalPracticeScenarioById.get(caseId)!
        const chip = container.querySelector(`a[data-kind="case"][href*="case=${caseId}"]`)
        expect(chip?.textContent).toContain(presentationTitle(definition))
        expect(chip?.textContent).not.toContain(definition.title)
      }
    }
  })

  it('derives every summary count from the registries', () => {
    const { container } = render(
      <EcmoPathwayAccordion track={track} progress={createDefaultProgress()} />,
    )
    const summaries = Array.from(container.querySelectorAll('summary'))
    expect(summaries).toHaveLength(groups.length)
    groups.forEach((group, index) => {
      expect(summaries[index]?.textContent).toContain(summaryLine(group, sections))
      expect(summaries[index]?.textContent).toContain(group.title)
    })
    // A summary is the native disclosure control: keyboard-operable with no script.
    for (const summary of summaries) expect(summary.parentElement?.tagName).toBe('DETAILS')
  })
})

describe('the hub browses the map in place', () => {
  it('reveals the accordion under the browse button and keeps the composition line', () => {
    const { container } = render(<CardiohelpHub />)
    const toggle = screen.getByRole('button', { name: /^Browse all \d+ sections$/ })
    expect(container.querySelector('[data-pathway-accordion]')).toBeNull()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const accordion = container.querySelector('[data-pathway-accordion]') as HTMLElement
    expect(accordion).not.toBeNull()
    expect(openUnits(container)).toHaveLength(1)
    expect(within(accordion).getAllByRole('link').length).toBeGreaterThan(17)
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens the unit the stored progress points at', () => {
    const vv = criticalCareLearningPathway('cardiohelp-ecmo', 'vv').sections
    window.localStorage.setItem(
      CARDIOHELP_PROGRESS_STORAGE_KEY,
      JSON.stringify(progressWith(vv.slice(0, 8).map((section) => section.id))),
    )
    const { container } = render(<CardiohelpHub />)
    fireEvent.click(screen.getByRole('button', { name: /^Browse all \d+ sections$/ }))
    const groups = ecmoPathwayGroups('vv')
    const expected = groups.find((group) => group.sections.some((s) => s.id === vv[8]!.id))!.unitId
    expect(openUnits(container)).toEqual([expected])
  })
})
