import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { BronchCaseActivity } from '../components/BronchCaseActivity'
import { BronchoscopyFoundationsPracticeLanding } from '../components/BronchoscopyFoundationsPracticeLanding'
import { IMAGE_BANK_ROWS } from '../content/imageBank'
import { bronchMicroCaseById, vignetteCasesForTopic } from '../content/microCases'
import { NUMBER_REGISTER, numberIdsIn } from '../content/numbers'
import { imageShareBlockers } from '../content/sectionNumbers'
import { BRONCH_SECTION_IDS } from '../content/sectionIds'
import { BRONCH_SECTIONS } from '../content/sections'
import type { BronchSectionDefinition } from '../content/types'
import { sectionNumberIds } from '../content/sectionNumbers'
import { vignetteErrors, VIGNETTES_PER_TOPIC } from '../content/vignetteRules'
import { VIGNETTE_TOPIC_TITLES, VIGNETTES, type VignetteTopic } from '../content/vignettes'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname: string; query?: Record<string, string> }
    children: React.ReactNode
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}?${new URLSearchParams(href.query).toString()}`
      }
      {...rest}
    >
      {children}
    </a>
  ),
}))

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const TOPICS = Object.keys(VIGNETTE_TOPIC_TITLES) as VignetteTopic[]

let rawSections: readonly BronchSectionDefinition[] = []
beforeAll(async () => {
  rawSections = await Promise.all(
    BRONCH_SECTION_IDS.map(
      async (id) =>
        ((await import(`../content/sections/${id}`)) as { section: BronchSectionDefinition })
          .section,
    ),
  )
})

describe('the vignettes with numbers', () => {
  it('holds every vignette to the copy rules, with no cue to the key', () => {
    expect(vignetteErrors()).toEqual([])
  })

  it('has five to a topic, forty in all, each a patient with numbers and one keyed move', () => {
    expect(TOPICS).toHaveLength(8)
    expect(VIGNETTES).toHaveLength(TOPICS.length * VIGNETTES_PER_TOPIC)
    for (const topic of TOPICS)
      expect(vignetteCasesForTopic(topic)).toHaveLength(VIGNETTES_PER_TOPIC)
    for (const vignette of VIGNETTES) {
      expect(vignette.situation).toMatch(/\d+-year-old|weighs \d+ kg|\d+ kg/)
      expect(vignette.choices.filter((choice) => choice.plausibility === 'best')).toHaveLength(1)
    }
  })

  it('tests only numbers a section already teaches, taken from the register', () => {
    // The registry holds resolved copy, so the tokens are read from the sections as written.
    const taught = new Set(rawSections.flatMap((section) => sectionNumberIds(section)))
    // Taught by the section on deterioration once the teaching-gaps change lands; in the register now.
    const pending = new Set(['methb-treat-symptomatic', 'methb-treat-asymptomatic'])
    const used = new Set<string>()
    for (const vignette of VIGNETTES) {
      const ids = numberIdsIn(
        [vignette.explanation, ...vignette.choices.map((choice) => choice.rationale)].join(' '),
      )
      for (const id of ids) {
        used.add(id)
        expect(NUMBER_REGISTER[id]).toBeDefined()
        expect([vignette.id, id, taught.has(id) || pending.has(id)]).toEqual([
          vignette.id,
          id,
          true,
        ])
      }
      // The resolved case carries the register's wording and no token.
      const item = bronchMicroCaseById.get(vignette.id)!.stage.item
      expect(JSON.stringify(item)).not.toMatch(/\{\{num:/)
    }
    expect(used.size).toBeGreaterThanOrEqual(25)
    // No rescue dose that the sections withhold: lipid emulsion and methylene blue stay names.
    for (const id of used) expect(id).not.toMatch(/^last-|^methylene-blue-/)
  })

  it('adds to the questions counted, without adding an image', () => {
    expect(imageShareBlockers(BRONCH_SECTIONS, IMAGE_BANK_ROWS.length, VIGNETTES.length)).toEqual(
      [],
    )
    expect(imageShareBlockers(BRONCH_SECTIONS, 0, VIGNETTES.length)[0]).toMatch(
      /^29 of the course's 137 questions/,
    )
  })

  it('lists them by topic on the Practice landing, after the sections’ cases', () => {
    render(<BronchoscopyFoundationsPracticeLanding />)
    const group = document.querySelector('[data-practice-vignettes]')!
    expect(group.querySelectorAll('[data-practice-vignette-topic]')).toHaveLength(TOPICS.length)
    expect(
      [...group.querySelectorAll('[data-practice-case-link]')].map((link) =>
        link.getAttribute('data-practice-case-link'),
      ),
    ).toEqual(VIGNETTES.map((vignette) => vignette.id))
    expect(group).toHaveTextContent(`${VIGNETTES.length} cases in ${TOPICS.length} topics`)
  })

  it('opens a vignette as a case: the patient, four choices, the reason and the number', () => {
    const vignette = VIGNETTES.find((entry) => entry.id === 'vg-platelets-between')!
    render(<BronchCaseActivity caseId={vignette.id} />)
    expect(screen.getByRole('heading', { name: vignette.presentationTitle })).toBeVisible()
    expect(document.body).toHaveTextContent('Platelets are 28,000/µL')
    expect(document.querySelectorAll('[data-prediction-choices] input')).toHaveLength(4)
    const key = vignette.choices.find((choice) => choice.plausibility === 'best')!
    fireEvent.click(document.querySelector(`[data-prediction-choices] input[value="${key.id}"]`)!)
    fireEvent.click(screen.getByRole('button', { name: 'Check my answer' }))
    const verdict = document.querySelector('[data-answer-verdict]')!
    expect(verdict).toHaveTextContent(key.rationale)
    expect(verdict).toHaveTextContent('A lavage needs 20,000/µL. A biopsy needs 50,000/µL.')
    expect(localStorage.length).toBe(0)
  })
})
