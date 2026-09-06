import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'

import { VentilationPathwayAccordion } from '../components/VentilationPathwayAccordion'
import { ventilationLearningUnits, ventilationUnitHref } from '../content/learningCurriculum'
import {
  nextIncompleteVentilationSection,
  ventilationCompositionLine,
  ventilationPathwayComposition,
  ventilationPathwayGroups,
} from '../content/pathwayResolver'
import { emptyLabProgress, type LabCheckpoint, type LabProgress } from '../engine/learningLab'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}?${new URLSearchParams(href.query).toString()}`
      }
      {...props}
    >
      {children}
    </a>
  ),
}))

function completed(unitId: string): LabCheckpoint {
  return {
    version: 1,
    unitId,
    round: 1,
    phase: 'complete',
    device: 'hamilton-c6',
    time: 0,
    events: [],
    evidence: [
      { completedAt: '2026-09-05T00:00:00.000Z' },
      { completedAt: '2026-09-05T00:00:00.000Z' },
    ],
    observedHolds: [],
    readySince: null,
    completedAt: '2026-09-05T00:00:00.000Z',
  }
}

function progressWith(...unitIds: string[]): LabProgress {
  return { version: 1, units: Object.fromEntries(unitIds.map((id) => [id, completed(id)])) }
}

describe('one door, one map', () => {
  it('sends a fresh learner to section one, and a returning learner to the first section not worked', () => {
    const fresh = nextIncompleteVentilationSection(emptyLabProgress())
    expect(fresh?.unit.id).toBe(ventilationLearningUnits[0].id)
    expect(fresh?.index).toBe(0)
    expect(fresh?.href).toBe(ventilationUnitHref(ventilationLearningUnits[0].id))
    const later = nextIncompleteVentilationSection(
      progressWith(ventilationLearningUnits[0].id, ventilationLearningUnits[1].id),
    )
    expect(later?.unit.id).toBe(ventilationLearningUnits[2].id)
    // A gap is honoured: the first incomplete section wins, whatever was done after it.
    const gap = nextIncompleteVentilationSection(
      progressWith(ventilationLearningUnits[0].id, ventilationLearningUnits[5].id),
    )
    expect(gap?.unit.id).toBe(ventilationLearningUnits[1].id)
    expect(
      nextIncompleteVentilationSection(progressWith(...ventilationLearningUnits.map((u) => u.id))),
    ).toBeNull()
  })

  it('derives every count from the registry and flattens the groups to the canonical order', () => {
    const composition = ventilationPathwayComposition()
    expect(composition.total).toBe(ventilationLearningUnits.length)
    expect(composition.byStage.reduce((sum, entry) => sum + entry.count, 0)).toBe(composition.total)
    expect(composition.minutes).toBe(
      ventilationLearningUnits.reduce((sum, unit) => sum + unit.minutes, 0),
    )
    expect(ventilationCompositionLine()).toBe(
      `${composition.total} sections · 1 orientation · 2 foundations · 7 mechanisms · 3 applications · 1 capstone · ${composition.minutes} min`,
    )
    const flattened = ventilationPathwayGroups().flatMap((group) =>
      group.units.map((unit) => unit.id),
    )
    expect(flattened).toEqual(ventilationLearningUnits.map((unit) => unit.id))
  })

  it('opens exactly the group holding the next section, and marks that section Up next', () => {
    const progress = progressWith(
      ventilationLearningUnits[0].id,
      ventilationLearningUnits[1].id,
      ventilationLearningUnits[2].id,
    )
    render(
      <VentilationPathwayAccordion progress={progress} completedCaseIds={new Set(['MV-13'])} />,
    )
    const open = document.querySelectorAll('[data-pathway-accordion] details[open]')
    expect(open).toHaveLength(1)
    expect(open[0].getAttribute('data-unit')).toBe('mechanism')
    const next = document.querySelector('[data-recommended="true"]')!
    expect(next.textContent).toContain(ventilationLearningUnits[3].title)
    expect(next.textContent).toContain('Up next')
    expect(next.getAttribute('href')).toContain(`activity=${ventilationLearningUnits[3].id}`)
    // Worked sections say so in words; a worked case too.
    expect(screen.getAllByText(/✓ worked through/).length).toBeGreaterThanOrEqual(3)
    const caseChip = document.querySelector('[data-kind="case"][data-complete="true"]')!
    expect(caseChip.textContent).toMatch(/high-pressure alarm/i)
    // No case is named by its diagnosis.
    for (const chip of document.querySelectorAll('[data-kind="case"]')) {
      expect(chip.textContent).not.toMatch(
        /pneumothorax|COPD|asthma|ARDS|reverse triggering|autotriggering|premature cycling|delayed cycling/i,
      )
    }
    // Every section appears exactly once.
    const sectionChips = [...document.querySelectorAll('[data-kind="section"]')].map((chip) =>
      chip.getAttribute('href'),
    )
    expect(sectionChips).toHaveLength(ventilationLearningUnits.length)
    expect(new Set(sectionChips).size).toBe(ventilationLearningUnits.length)
    within(open[0] as HTMLElement).getByText(/Sections 4–10 · 7 sections/)
  })
})
