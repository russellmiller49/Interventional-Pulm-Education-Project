import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { assertNoUniversalTargetLanguage } from '@/features/critical-care/test-support/teachingPanelContract'
import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'
import type { LearningPathway } from '@/features/learning-module/curriculum/types'

import {
  ecmoLearningPathways,
  ecmoObjectiveActionVerbPattern,
  ecmoSectionSpec,
  ecmoSectionSpecById,
  ecmoSectionSpecs,
  ecmoSectionSpecsForTrack,
  ecmoSharedSectionIds,
  ecmoTrackIds,
  validateEcmoSectionSpecs,
  type EcmoSectionSpec,
} from '../content/sectionSpecs'
import { ECMO_TRACK_INCREMENTS, validateEcmoTrackIncrements } from '../content/trackIncrements'

/**
 * The ladder, checked as authored content.
 *
 * A ladder loses two things silently. The first is order: a section that assumes something taught
 * later reads as a difficulty cliff and nothing in a pathway file notices. The second is the
 * shared/track boundary: a section both tracks show assuming a concept only one of them teaches
 * leaves the other track's learner with a hole they cannot name. Both are checked against the
 * pathways themselves rather than against a second copy of the order.
 */

const PATHWAYS: readonly LearningPathway[] = ecmoLearningPathways()

function index(pathway: LearningPathway, sectionId: string): number {
  return pathway.sections.findIndex((section) => section.id === sectionId)
}

function learnerFacingStrings(definition: EcmoSectionSpec): readonly string[] {
  return [
    definition.newConcept,
    definition.objective,
    ...(definition.incrementSentence ? [definition.incrementSentence] : []),
  ]
}

describe('every pathway section has a spec, and nothing else does', () => {
  it('validates cleanly at import and by explicit call', () => {
    expect(validateEcmoSectionSpecs()).toEqual([])
    expect(validateEcmoTrackIncrements()).toEqual([])
  })

  it('covers both tracks, seventeen sections each, with the shared ones filed once', () => {
    for (const track of ecmoTrackIds) {
      const pathway = criticalCareLearningPathway('cardiohelp-ecmo', track)
      expect(pathway.sections).toHaveLength(17)
      for (const section of pathway.sections) {
        expect(ecmoSectionSpecById.has(section.id)).toBe(true)
      }
      expect(ecmoSectionSpecsForTrack(track).map((definition) => definition.sectionId)).toEqual(
        pathway.sections.map((section) => section.id),
      )
    }
    // Seventeen per track with four shared: thirty specs, each declared once.
    const shared = ecmoSharedSectionIds()
    expect([...shared]).toEqual([
      'why-extracorporeal-support',
      'circuit-flow-path',
      'pump-and-pressure-zones',
      'blood-flow-versus-sweep',
    ])
    expect(ecmoSectionSpecs).toHaveLength(17 * 2 - shared.length)
    const ids = ecmoSectionSpecs.map((definition) => definition.sectionId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('registers no spec for a section on neither pathway', () => {
    const pathwayIds = new Set(PATHWAYS.flatMap((pathway) => pathway.sections.map((s) => s.id)))
    for (const definition of ecmoSectionSpecs) {
      expect(`${definition.sectionId}: ${pathwayIds.has(definition.sectionId)}`).toBe(
        `${definition.sectionId}: true`,
      )
    }
  })

  it('throws rather than returning undefined for a section that does not exist', () => {
    expect(() => ecmoSectionSpec('vv-weaning')).toThrow(/vv-weaning/)
  })

  it('gives every section exactly one new concept and one objective', () => {
    for (const definition of ecmoSectionSpecs) {
      expect(definition.newConcept.trim().length).toBeGreaterThan(0)
      expect(definition.objective.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('the prerequisite graph', () => {
  it('resolves every prerequisite to a section that has its own spec', () => {
    for (const definition of ecmoSectionSpecs) {
      for (const prerequisite of definition.prerequisiteSectionIds) {
        expect(`${definition.sectionId} → ${prerequisite}`).toBe(
          `${definition.sectionId} → ${ecmoSectionSpecById.has(prerequisite) ? prerequisite : 'nothing'}`,
        )
      }
    }
  })

  it('places every prerequisite earlier on every pathway carrying both', () => {
    for (const pathway of PATHWAYS) {
      for (const section of pathway.sections) {
        const definition = ecmoSectionSpec(section.id)
        for (const prerequisite of definition.prerequisiteSectionIds) {
          const at = index(pathway, prerequisite)
          if (at < 0) continue
          expect(
            `${pathway.trackId} ${section.id} after ${prerequisite}: ${at < index(pathway, section.id)}`,
          ).toBe(`${pathway.trackId} ${section.id} after ${prerequisite}: true`)
        }
      }
    }
  })

  it('never lets a shared section assume something only one track teaches', () => {
    for (const sectionId of ecmoSharedSectionIds()) {
      for (const prerequisite of ecmoSectionSpec(sectionId).prerequisiteSectionIds) {
        for (const pathway of PATHWAYS) {
          expect(
            `${sectionId} assumes ${prerequisite} on ${pathway.trackId}: ${index(pathway, prerequisite) >= 0}`,
          ).toBe(`${sectionId} assumes ${prerequisite} on ${pathway.trackId}: true`)
        }
      }
    }
  })

  it('starts each pathway at the one section that assumes nothing', () => {
    const roots = ecmoSectionSpecs.filter(
      (definition) => definition.prerequisiteSectionIds.length === 0,
    )
    expect(roots.map((definition) => definition.sectionId)).toEqual(['why-extracorporeal-support'])
    for (const pathway of PATHWAYS) {
      expect(pathway.sections[0]?.id).toBe('why-extracorporeal-support')
    }
  })

  it('has no cycle: every section is reachable in an order that respects its prerequisites', () => {
    const settled = new Set<string>()
    let progressed = true
    while (progressed) {
      progressed = false
      for (const definition of ecmoSectionSpecs) {
        if (settled.has(definition.sectionId)) continue
        if (definition.prerequisiteSectionIds.every((id) => settled.has(id))) {
          settled.add(definition.sectionId)
          progressed = true
        }
      }
    }
    expect(settled.size).toBe(ecmoSectionSpecs.length)
  })

  it('makes each capstone assume exactly its own track application drills', () => {
    for (const pathway of PATHWAYS) {
      const applications = pathway.sections
        .filter((section) => section.stage === 'application')
        .map((section) => section.id)
      expect(applications).toHaveLength(9)
      const capstone = pathway.sections.find((section) => section.stage === 'integration')
      expect(capstone).toBeDefined()
      expect([...ecmoSectionSpec(capstone!.id).prerequisiteSectionIds].sort()).toEqual(
        [...applications].sort(),
      )
    }
  })
})

describe('an objective names a discrimination, not an action', () => {
  it('never opens with the action a drill ends in', () => {
    for (const definition of ecmoSectionSpecs) {
      expect(
        `${definition.sectionId}: ${ecmoObjectiveActionVerbPattern.test(definition.objective)}`,
      ).toBe(`${definition.sectionId}: false`)
    }
    // The rule is a real filter, not a pattern nothing could match.
    expect(
      ecmoObjectiveActionVerbPattern.test('Reduce pump speed before correcting the cause'),
    ).toBe(true)
  })

  it('runs to two sentences at most', () => {
    for (const definition of ecmoSectionSpecs) {
      const sentences = definition.objective
        .split(/(?<=[.!?])\s+/)
        .filter((part) => part.trim().length > 0)
      expect(`${definition.sectionId}: ${sentences.length <= 2}`).toBe(
        `${definition.sectionId}: true`,
      )
    }
  })

  it('carries no number, and no reviewed learner-copy term an override does not name', () => {
    for (const definition of ecmoSectionSpecs) {
      for (const value of learnerFacingStrings(definition)) {
        expect(`${definition.sectionId}: ${value}`).not.toMatch(/\d/)
        const reason = definition.learnerCopyOverrideReason?.toLowerCase() ?? ''
        const unexcused = flaggedLearnerCopyTerms(value).filter(
          (term) => reason.length === 0 || !reason.includes(term),
        )
        expect(`${definition.sectionId}: ${unexcused.join()}`).toBe(`${definition.sectionId}: `)
      }
    }
  })

  it('phrases nothing as a universal bedside target', () => {
    for (const definition of ecmoSectionSpecs) {
      for (const value of learnerFacingStrings(definition)) assertNoUniversalTargetLanguage(value)
    }
  })

  it('records a reason wherever a reviewed term is used in its clinical sense', () => {
    // One objective in the approved ladder says "correct", of an acidemia. The reason names the
    // term it excuses, so it cannot quietly cover a second one arriving later.
    const withOverride = ecmoSectionSpecs.filter(
      (definition) => definition.learnerCopyOverrideReason !== undefined,
    )
    expect(withOverride.map((definition) => definition.sectionId)).toEqual(['acute-hypercapnia'])
    for (const definition of withOverride) {
      const flagged = flaggedLearnerCopyTerms(`${definition.newConcept} ${definition.objective}`)
      expect(flagged.length).toBeGreaterThan(0)
      for (const term of flagged) {
        expect(definition.learnerCopyOverrideReason?.toLowerCase()).toContain(term)
      }
    }
  })
})

describe('the named increment is one sentence, in one place', () => {
  it('is the registered VA sentence, carried by the section that opens the VA track', () => {
    const opening = ecmoSectionSpec('va-normal-state')
    expect(opening.incrementSentence).toBe(ECMO_TRACK_INCREMENTS.va.sentence)
    // Identity, not a copy: the spec imports the registry rather than restating it.
    expect(opening.incrementSentence).toMatch(/VA is VV plus exactly two ideas/)
  })

  it('counts the two ideas out loud, and registers exactly two', () => {
    expect(ECMO_TRACK_INCREMENTS.va.ideas).toHaveLength(2)
    expect(ECMO_TRACK_INCREMENTS.va.ideas.map((idea) => idea.id)).toEqual([
      'artery-pushes-back',
      'two-circulations',
    ])
    expect(ECMO_TRACK_INCREMENTS.va.sentence).toMatch(/exactly two/i)
  })

  it('gives the base track no increment, because there is nothing for it to be plus', () => {
    expect('vv' in ECMO_TRACK_INCREMENTS).toBe(false)
  })

  it('is carried by exactly one section, and that section is on the VA pathway only', () => {
    const carriers = ecmoSectionSpecs.filter(
      (definition) => definition.incrementSentence === ECMO_TRACK_INCREMENTS.va.sentence,
    )
    expect(carriers.map((definition) => definition.sectionId)).toEqual(['va-normal-state'])
    const va = criticalCareLearningPathway('cardiohelp-ecmo', 'va')
    const vv = criticalCareLearningPathway('cardiohelp-ecmo', 'vv')
    expect(index(va, 'va-normal-state')).toBeGreaterThanOrEqual(0)
    expect(index(vv, 'va-normal-state')).toBe(-1)
  })

  it('names a registered source for the increment and for each idea', () => {
    expect([...ECMO_TRACK_INCREMENTS.va.sourceIds]).toEqual([
      'elso-adult-va-2021',
      'elso-dual-circulation-2024',
    ])
    for (const idea of ECMO_TRACK_INCREMENTS.va.ideas) {
      expect(idea.sourceIds.length).toBeGreaterThan(0)
    }
  })
})

describe('the section-spec validator catches what it claims to', () => {
  const replace = (sectionId: string, change: (definition: EcmoSectionSpec) => EcmoSectionSpec) =>
    ecmoSectionSpecs.map((definition) =>
      definition.sectionId === sectionId ? change(definition) : definition,
    )

  it('rejects a prerequisite taught after the section that assumes it', () => {
    const errors = validateEcmoSectionSpecs(
      replace('circuit-flow-path', (definition) => ({
        ...definition,
        prerequisiteSectionIds: ['blood-flow-versus-sweep'],
      })),
    ).join('\n')
    expect(errors).toContain('does not precede it on the vv pathway')
  })

  it('rejects a shared section assuming something only one track teaches', () => {
    const errors = validateEcmoSectionSpecs(
      replace('blood-flow-versus-sweep', (definition) => ({
        ...definition,
        prerequisiteSectionIds: [...definition.prerequisiteSectionIds, 'vv-normal-state'],
      })),
    ).join('\n')
    expect(errors).toContain(
      'a shared section assumes vv-normal-state, which only one track teaches',
    )
  })

  it('rejects an objective that opens with an action', () => {
    const errors = validateEcmoSectionSpecs(
      replace('preload-drainage-collapse', (definition) => ({
        ...definition,
        objective: 'Reduce pump speed before looking for the cause',
      })),
    ).join('\n')
    expect(errors).toContain('opens with an action rather than a discrimination')
  })

  it('rejects a number in an objective', () => {
    const errors = validateEcmoSectionSpecs(
      replace('vv-normal-state', (definition) => ({
        ...definition,
        objective: 'Tell a value that has moved from a baseline that sat near 4',
      })),
    ).join('\n')
    expect(errors).toContain('a number appears in learner-facing copy')
  })

  it('rejects a section spec for something on no ECMO pathway', () => {
    const errors = validateEcmoSectionSpecs([
      ...ecmoSectionSpecs,
      {
        sectionId: 'vv-weaning',
        newConcept: 'coming off support',
        objective: 'Tell a readiness signal from a stable one',
        prerequisiteSectionIds: ['vv-normal-state'],
      },
    ]).join('\n')
    expect(errors).toContain('spec for a section on no ECMO pathway')
  })

  it('rejects a pathway section that loses its spec', () => {
    const errors = validateEcmoSectionSpecs(
      ecmoSectionSpecs.filter((definition) => definition.sectionId !== 'va-lv-loading'),
    ).join('\n')
    expect(errors).toContain('va-lv-loading: pathway section has no spec')
  })

  it('rejects an increment sentence that is not the registered one', () => {
    const errors = validateEcmoSectionSpecs(
      replace('va-normal-state', (definition) => ({
        ...definition,
        incrementSentence: 'VA is VV plus exactly two ideas, roughly speaking.',
      })),
    ).join('\n')
    expect(errors).toContain('carries an increment sentence that is not registered')
  })

  it('rejects the increment moving onto a section both tracks show', () => {
    const errors = validateEcmoSectionSpecs(
      replace('blood-flow-versus-sweep', (definition) => ({
        ...definition,
        incrementSentence: ECMO_TRACK_INCREMENTS.va.sentence,
      })),
    ).join('\n')
    expect(errors).toContain('a shared section cannot open the va track')
    expect(errors).toContain('carried by 2 sections, not one')
  })

  it('rejects a capstone that stops assuming one of its application drills', () => {
    const errors = validateEcmoSectionSpecs(
      replace('vv-integration-capstone', (definition) => ({
        ...definition,
        prerequisiteSectionIds: definition.prerequisiteSectionIds.filter(
          (id) => id !== 'vv-recirculation',
        ),
      })),
    ).join('\n')
    expect(errors).toContain("does not assume exactly the track's application drills")
  })
})
