/** @jest-environment node */
import { curriculumSections, type CurriculumSection } from '../content/curriculum'
import {
  chapterGroups,
  chapterSummaryLine,
  nextStep,
  reviewedSectionIds,
  sectionLinkTarget,
  visitedSectionIds,
} from '../content/pathwayResolver'
import { createEmptyProgress, type ThoracoscopyProgress } from '../engine/selfPacedProgress'

function withOpen(...ids: string[]): readonly CurriculumSection[] {
  return curriculumSections.map((section) =>
    ids.includes(section.id) ? { ...section, state: 'available' as const } : section,
  )
}

function progress(change: Partial<ThoracoscopyProgress> = {}): ThoracoscopyProgress {
  return { ...createEmptyProgress(), ...change }
}

describe('the one door', () => {
  it('points nowhere while no section can be opened', () => {
    expect(nextStep(progress())).toEqual({ kind: 'none-open' })
    // A record naming sections still in preparation changes nothing.
    expect(
      nextStep(
        progress({
          lastLocation: { kind: 'section', id: 'four-controls' },
          visitedSectionIds: ['four-controls'],
        }),
      ),
    ).toEqual({ kind: 'none-open' })
  })

  it('starts a fresh learner at the first open section', () => {
    const sections = withOpen('normal-pleural-space', 'four-controls', 'systematic-survey')
    const step = nextStep(progress(), sections)

    expect(step).toMatchObject({ kind: 'section', fresh: true, resumed: false })
    expect(step.kind === 'section' && step.section.id).toBe('normal-pleural-space')
  })

  it('offers back a section left before it was marked reviewed', () => {
    const sections = withOpen('normal-pleural-space', 'four-controls', 'systematic-survey')
    const step = nextStep(
      progress({
        lastLocation: { kind: 'section', id: 'four-controls' },
        visitedSectionIds: ['normal-pleural-space', 'four-controls'],
        reviewedSectionIds: ['normal-pleural-space'],
      }),
      sections,
    )

    expect(step).toMatchObject({ kind: 'section', resumed: true })
    expect(step.kind === 'section' && step.section.id).toBe('four-controls')
  })

  it('moves on past reviewed sections, and says when every open one is reviewed', () => {
    const sections = withOpen('normal-pleural-space', 'four-controls')
    const reviewedOne = progress({ reviewedSectionIds: ['normal-pleural-space'] })

    const step = nextStep(reviewedOne, sections)
    expect(step.kind === 'section' && step.section.id).toBe('four-controls')
    expect(step).toMatchObject({ fresh: false, resumed: false })
    expect(
      nextStep(
        progress({ reviewedSectionIds: ['normal-pleural-space', 'four-controls'] }),
        sections,
      ),
    ).toEqual({ kind: 'all-reviewed' })
  })

  it('never counts a section in preparation as opened or reviewed', () => {
    const stored = progress({
      visitedSectionIds: ['four-controls', 'entry', 'not-a-section'],
      reviewedSectionIds: ['four-controls', 'entry'],
    })
    const sections = withOpen('four-controls')

    expect([...visitedSectionIds(stored, sections)]).toEqual(['four-controls'])
    expect([...reviewedSectionIds(stored, sections)]).toEqual(['four-controls'])
    expect([...visitedSectionIds(stored)]).toEqual([])
  })

  it('links a section by its id on the Learn page', () => {
    expect(sectionLinkTarget('four-controls')).toEqual({
      pathname: '/medical-thoracoscopy/learn',
      query: { section: 'four-controls' },
    })
  })
})

describe('chapter groups', () => {
  it('tile the canonical order, and count their own summary lines', () => {
    const groups = chapterGroups()

    expect(groups.flatMap((group) => group.sections.map((section) => section.id))).toEqual(
      curriculumSections.map((section) => section.id),
    )
    expect(groups.map(chapterSummaryLine)).toEqual([
      'Sections 1–2 · 2 sections · about 13 min',
      'Sections 3–6 · 4 sections · about 34 min',
      'Sections 7–10 · 4 sections · about 32 min',
      'Sections 11–16 · 6 sections · about 53 min',
      'Sections 17–19 · 3 sections · about 22 min',
    ])
    expect(groups.every((group) => group.openCount === 0)).toBe(true)
  })
})
