import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

import { cardiohelpCurriculum } from '../content/curriculum'
import {
  ecmoLearnSectionHref,
  ecmoPathwayComposition,
  ecmoPathwayGroups,
  ecmoPathwaySectionKind,
  ecmoWorkedSectionIds,
  nextIncompleteSectionLink,
  resolveNextIncompleteSection,
} from '../content/pathwayResolver'
import { createDefaultProgress } from '../engine/progress'
import type { ProgressV2, SupportMode } from '../engine/types'

const TRACKS: readonly SupportMode[] = ['vv', 'va']

function sectionIds(track: SupportMode): readonly string[] {
  return criticalCareLearningPathway('cardiohelp-ecmo', track).sections.map((section) => section.id)
}

/** A progress envelope in which exactly these sections have been worked. */
function progressWith(...workedSectionIds: readonly string[]): ProgressV2 {
  const drills = workedSectionIds.filter((id) => ecmoPathwaySectionKind(id) === 'drill')
  const foundations = workedSectionIds.filter(
    (id) => ecmoPathwaySectionKind(id) === 'foundation-workspace',
  )
  return {
    ...createDefaultProgress(),
    completedLearnLessonIds: drills,
    ...(foundations.length > 0 ? { completedFoundationSectionIds: foundations } : {}),
  }
}

describe('the next incomplete section', () => {
  it.each(TRACKS)('sends a fresh %s learner to the first section of the pathway', (track) => {
    const next = resolveNextIncompleteSection(track, createDefaultProgress())

    expect(next?.section.id).toBe('why-extracorporeal-support')
    expect(next?.index).toBe(0)
    expect(next?.total).toBe(17)
  })

  it.each(TRACKS)('walks the %s runway one section at a time', (track) => {
    const ids = sectionIds(track)
    let worked: string[] = []
    for (const expected of ids) {
      expect(resolveNextIncompleteSection(track, progressWith(...worked))?.section.id).toBe(
        expected,
      )
      worked = [...worked, expected]
    }
  })

  it.each(TRACKS)('returns null once every %s section has been worked', (track) => {
    expect(resolveNextIncompleteSection(track, progressWith(...sectionIds(track)))).toBeNull()
    expect(nextIncompleteSectionLink(track, progressWith(...sectionIds(track)))).toBeNull()
  })

  it('offers the earliest gap, not the furthest point reached', () => {
    // A learner who jumped straight to a drill has not worked the physiology it assumes. The
    // pathway's claim is that section three is what makes section eight legible, so section three
    // is what is offered — while every section stays reachable from the landing regardless.
    const jumpedAhead = progressWith(
      'why-extracorporeal-support',
      'circuit-flow-path',
      'startup-sensor-orientation',
      'preload-drainage-collapse',
    )
    expect(resolveNextIncompleteSection('vv', jumpedAhead)?.section.id).toBe(
      'pump-and-pressure-zones',
    )
  })

  it('carries a shared section across both tracks, because it is one section', () => {
    // The first four sections are the same sections, not copies: one id, one record.
    const worked = progressWith('why-extracorporeal-support')
    expect(resolveNextIncompleteSection('vv', worked)?.section.id).toBe('circuit-flow-path')
    expect(resolveNextIncompleteSection('va', worked)?.section.id).toBe('circuit-flow-path')
  })

  it('resolves the two tracks independently past the shared runway', () => {
    const sharedPlusVv = progressWith(
      'why-extracorporeal-support',
      'circuit-flow-path',
      'pump-and-pressure-zones',
      'blood-flow-versus-sweep',
      'vv-normal-state',
    )
    expect(resolveNextIncompleteSection('vv', sharedPlusVv)?.section.id).toBe(
      'vv-series-physiology',
    )
    // The same envelope leaves the VA track at its own first unshared section.
    expect(resolveNextIncompleteSection('va', sharedPlusVv)?.section.id).toBe('va-normal-state')
  })

  it('ignores stored ids that are no longer in the registry', () => {
    const stale = progressWith('why-extracorporeal-support')
    const withRetiredIds: ProgressV2 = {
      ...stale,
      completedLearnLessonIds: [...stale.completedLearnLessonIds, 'retired-drill-id'],
      completedFoundationSectionIds: [
        ...(stale.completedFoundationSectionIds ?? []),
        'retired-section-id',
      ],
    }
    expect(resolveNextIncompleteSection('vv', withRetiredIds)?.section.id).toBe('circuit-flow-path')
  })

  it('will not let a section be marked worked under the wrong kind', () => {
    // A hand-edited envelope that lists a foundation section among the drills proves nothing about
    // that section, and vice versa.
    const miscategorised: ProgressV2 = {
      ...createDefaultProgress(),
      completedLearnLessonIds: ['why-extracorporeal-support'],
      completedFoundationSectionIds: ['startup-sensor-orientation'],
    }
    expect(ecmoWorkedSectionIds(miscategorised).size).toBe(0)
    expect(resolveNextIncompleteSection('vv', miscategorised)?.section.id).toBe(
      'why-extracorporeal-support',
    )
  })

  it('builds the deep link in the shape the module already uses', () => {
    const link = nextIncompleteSectionLink('vv', createDefaultProgress())

    expect(link?.href).toBe('/cardiohelp-ecmo/learn?lesson=why-extracorporeal-support&track=vv')
    expect(link?.linkTarget).toEqual({
      pathname: '/cardiohelp-ecmo/learn',
      query: { lesson: 'why-extracorporeal-support', track: 'vv' },
    })
    expect(ecmoLearnSectionHref('va-lv-loading', 'va')).toBe(
      '/cardiohelp-ecmo/learn?lesson=va-lv-loading&track=va',
    )
  })
})

describe('the composition line', () => {
  it.each(TRACKS)('counts the %s track from the registry', (track) => {
    expect(ecmoPathwayComposition(track)).toEqual({
      total: 17,
      foundations: 6,
      consoleOrientation: 1,
      drills: 9,
      capstone: 1,
    })
  })

  it.each(TRACKS)('accounts for every %s section exactly once in its parts', (track) => {
    const { total, foundations, consoleOrientation, drills, capstone } =
      ecmoPathwayComposition(track)
    expect(foundations + consoleOrientation + drills + capstone).toBe(total)
    expect(total).toBe(sectionIds(track).length)
  })

  it('agrees with the curriculum registry about how many drills there are', () => {
    for (const track of TRACKS) {
      const { consoleOrientation, drills } = ecmoPathwayComposition(track)
      const authoredDrills = cardiohelpCurriculum[track].flatMap((unit) => unit.lessonScenarioIds)
      expect(consoleOrientation + drills).toBe(authoredDrills.length)
    }
  })
})

describe('the unit grouping is a presentation of the canonical order', () => {
  it.each(TRACKS)('flattens back to the %s pathway, in order', (track) => {
    const flattened = ecmoPathwayGroups(track).flatMap((group) => group.sections)
    expect(flattened.map((section) => section.id)).toEqual(sectionIds(track))
  })

  it.each(TRACKS)('places every %s section in exactly one group', (track) => {
    const flattened = ecmoPathwayGroups(track).flatMap((group) => group.sections)
    expect(new Set(flattened.map((section) => section.id)).size).toBe(17)
    expect(flattened).toHaveLength(17)
  })

  it.each(TRACKS)('keeps one group per %s curriculum unit, in unit order', (track) => {
    const groups = ecmoPathwayGroups(track)
    expect(groups.map((group) => group.unitId)).toEqual(
      cardiohelpCurriculum[track].map((unit) => unit.id),
    )
    expect(groups).toHaveLength(7)
    for (const group of groups) expect(group.sections.length).toBeGreaterThan(0)
  })

  it.each(TRACKS)('opens the first %s group on the first section', (track) => {
    // If the grouped view began anywhere else it would be a second table of contents again, which
    // is the defect this whole package exists to remove.
    expect(ecmoPathwayGroups(track)[0]?.sections[0]?.id).toBe('why-extracorporeal-support')
  })

  it.each(TRACKS)('gives each %s group a contiguous run of the order', (track) => {
    const ids = sectionIds(track)
    let cursor = 0
    for (const group of ecmoPathwayGroups(track)) {
      expect(group.sections.map((section) => section.id)).toEqual(
        ids.slice(cursor, cursor + group.sections.length),
      )
      cursor += group.sections.length
    }
    expect(cursor).toBe(ids.length)
  })

  it('puts the runway in the first group and the integration section with the capstone', () => {
    const groups = ecmoPathwayGroups('vv')

    // Six foundation sections plus the console tour, so the physiology is visible on the hub
    // instead of being skipped by it.
    expect(groups[0]?.sections.map((section) => section.id)).toEqual([
      'why-extracorporeal-support',
      'circuit-flow-path',
      'pump-and-pressure-zones',
      'blood-flow-versus-sweep',
      'vv-normal-state',
      'vv-series-physiology',
      'startup-sensor-orientation',
    ])

    const last = groups[groups.length - 1]
    expect(last?.sections.map((section) => section.id)).toEqual(['vv-integration-capstone'])
    expect(last?.capstoneScenarioId).toBe('vv-off-sweep-capstone')
  })

  it('keeps each group pointing at the Practice cases its unit already owned', () => {
    for (const track of TRACKS) {
      const groups = ecmoPathwayGroups(track)
      for (const [index, unit] of cardiohelpCurriculum[track].entries()) {
        expect(groups[index]?.caseScenarioIds).toEqual(unit.caseScenarioIds)
      }
    }
  })
})
