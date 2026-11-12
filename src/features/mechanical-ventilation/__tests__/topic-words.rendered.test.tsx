import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, render } from '@testing-library/react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { PathwayNav } from '@/features/learning-module/curriculum/PathwayNav'

import { VentilationPathwayAccordion } from '../components/VentilationPathwayAccordion'
import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import {
  ventilationSectionSpec,
  ventilationSectionSpecErrors,
  ventilationSectionSpecs,
} from '../content/sectionSpecs'
import { emptySelfPacedProgress } from '../engine/selfPacedProgress'

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
  useRouter: () => ({ push: jest.fn() }),
}))

afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

/**
 * A section can be found by name.
 *
 * Reviewed in November 2026: most section titles are questions with no topic word in them ("Do the
 * two breath clocks agree?"), and the short names beside them were not the words a fellow looks a
 * subject up by ("Patient and machine timing"). Each section now has a topic word in the clinical
 * term, and it leads the question wherever sections are listed or opened.
 *
 * A topic word is on screen before any answer, in every section, so it is held to every section's
 * answer-leak list. That is why Section 7 is "Expiratory time" and not the name of what the
 * learner is about to find there.
 */
describe('the topic words', () => {
  const topics = ventilationLearningUnits.map((unit) => unit.shortTitle)

  it('gives every section its own short topic, which is not a question', () => {
    expect(new Set(topics).size).toBe(ventilationLearningUnits.length)
    for (const unit of ventilationLearningUnits) {
      expect(unit.shortTitle.length).toBeLessThanOrEqual(40)
      expect(unit.shortTitle).not.toMatch(/[?.]$/)
      expect(unit.shortTitle).not.toBe(unit.title)
    }
  })

  it('passes every section’s answer-leak list, not only its own', () => {
    expect(ventilationSectionSpecErrors(ventilationSectionSpecs)).toEqual([])
    for (const unit of ventilationLearningUnits)
      for (const pattern of ventilationSectionSpec(unit.id).precommitDenyPatterns)
        for (const topic of topics) expect(topic).not.toMatch(pattern)
  })

  it('is refused by that list when it names what the air-trapping section is about to show', () => {
    const patterns = ventilationSectionSpec('expiration-and-air-trapping').precommitDenyPatterns
    for (const withheld of ['Air trapping', 'Auto-PEEP', 'Dynamic hyperinflation'])
      expect(patterns.some((pattern) => pattern.test(withheld))).toBe(true)
    expect(
      ventilationLearningUnits.find((unit) => unit.id === 'expiration-and-air-trapping')!
        .shortTitle,
    ).toBe('Expiratory time')
  })
})

describe('where the topic word is shown', () => {
  it('leads each question in the Sections menu', () => {
    render(
      <PathwayNav
        pathway={criticalCareLearningPathway('mechanical-ventilation')}
        label="Mechanical ventilation pathway"
        activeSectionId="lung-protection"
        onSelect={() => {}}
      />,
    )
    for (const unit of ventilationLearningUnits) {
      const row = document.querySelector(`button[data-section="${unit.id}"]`)!
      expect(row.querySelector('strong')!.textContent).toBe(unit.shortTitle)
      expect(row.querySelector('small')!.textContent).toBe(
        unit.stage === 'integration' ? 'Integration capstone' : unit.title,
      )
    }
  })

  it('leads each question on the Learn page', () => {
    render(
      <VentilationPathwayAccordion
        progress={emptySelfPacedProgress()}
        visitedCaseIds={new Set<string>()}
      />,
    )
    ventilationLearningUnits.forEach((unit, index) => {
      const chip = document.querySelector(`[data-kind="section"][href*="activity=${unit.id}"]`)!
      const name = chip.querySelector('[data-section-name]')!.textContent!
      expect(name).toBe(`${index + 1}. ${unit.shortTitle} · ${unit.title}`)
    })
  })

  it.each(ventilationLearningUnits.map((unit, index) => [index + 1, unit.id, unit] as const))(
    'is in the header line of section %i (%s), above its question',
    (number, unitId, unit) => {
      localStorage.clear()
      jest.useFakeTimers()
      render(<VentilationStageHost unitId={unitId} />)
      act(() => jest.advanceTimersByTime(10))
      const heading = document.querySelector('h1')!
      expect(heading.textContent).toBe(unit.title)
      expect(heading.previousElementSibling!.textContent).toContain(
        `Section ${number} of ${ventilationLearningUnits.length} · ${unit.shortTitle} · ${unit.minutes} min`,
      )
    },
  )
})
