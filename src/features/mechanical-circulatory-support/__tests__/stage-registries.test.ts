/**
 * The content registries the rebuild stands on, and the rules they are held to at import.
 *
 * The specs' validator is exercised with mutated copies so each rule is shown to be a real
 * filter; the spine, the control panel, the increments and the map-answer rule are pinned; the
 * one door is resolved for a fresh learner, a returning one and a finished one; and the answer
 * order is shown not to reward "pick the first" or "pick the longest".
 */
import { choiceOrderOffset, orderChoices } from '@/features/learning-module/stage/choiceOrder'

import { mcsPresentationTitle, validateMcsCasePresentation } from '../content/casePresentation'
import { MCS_CONTROL_PANEL, validateMcsControlPanel } from '../content/controlPanel'
import { MCS_CONTROL_PANEL_SORT, validateMcsControlPanelSort } from '../content/controlPanelSort'
import { MCS_DEVICE_INCREMENTS, validateMcsDeviceIncrements } from '../content/deviceIncrements'
import { mcsLessons } from '../content/lessons'
import { mcsLessonTransfers } from '../content/lessonTransfers'
import {
  mcsMapAnswerSectionIds,
  mcsMapAnswerTargets,
  validateMcsMapAnswerMappings,
} from '../content/mapAnswerTargets'
import {
  mcsGroupSummaryLine,
  mcsPathway,
  mcsPathwayComposition,
  mcsPathwayGroups,
  nextIncompleteMcsSectionLink,
  resolveNextIncompleteMcsSection,
} from '../content/pathwayResolver'
import { mcsCapstoneScenarios, mcsPracticeScenarios } from '../content/scenarios'
import { mcsSectionLearningContracts } from '../content/sectionLearningContracts'
import {
  mcsObjectiveActionVerbPattern,
  mcsSectionSpec,
  mcsSectionSpecs,
  validateMcsSectionSpecs,
  type McsSectionSpec,
} from '../content/sectionSpecs'
import { mcsStageLessons } from '../content/stageLessons'
import { mcsStageSources } from '../content/stageSources'
import { mcsStoryProblems } from '../content/storyProblems'
import {
  MCS_SUPPORT_SPINE,
  mcsSpineStopIds,
  validateMcsSupportSpine,
} from '../content/supportSpine'

function mutate(sectionId: string, patch: Partial<McsSectionSpec>): readonly McsSectionSpec[] {
  return mcsSectionSpecs.map((spec) =>
    spec.sectionId === sectionId ? { ...spec, ...patch } : spec,
  )
}

describe('section specs — the ladder', () => {
  it('has one spec per section and validates clean', () => {
    expect(validateMcsSectionSpecs()).toEqual([])
    expect(mcsSectionSpecs.map((spec) => spec.sectionId)).toEqual(
      mcsLessons.map((lesson) => lesson.id),
    )
  })

  it('has exactly one root, and every prerequisite is taught earlier', () => {
    const order = mcsLessons.map((lesson) => lesson.id)
    const roots = mcsSectionSpecs.filter((spec) => spec.prerequisiteSectionIds.length === 0)
    expect(roots.map((spec) => spec.sectionId)).toEqual(['mcs-foundations-signals'])
    for (const spec of mcsSectionSpecs) {
      for (const prerequisite of spec.prerequisiteSectionIds) {
        expect(order.indexOf(prerequisite)).toBeLessThan(order.indexOf(spec.sectionId))
      }
    }
  })

  it('is acyclic and resolves every prerequisite', () => {
    const settled = new Set<string>()
    let progress = true
    while (progress) {
      progress = false
      for (const spec of mcsSectionSpecs) {
        if (settled.has(spec.sectionId)) continue
        if (spec.prerequisiteSectionIds.every((id) => settled.has(id))) {
          settled.add(spec.sectionId)
          progress = true
        }
      }
    }
    expect(settled.size).toBe(mcsSectionSpecs.length)
  })

  it('makes the integration section assume exactly the application sections', () => {
    const integration = mcsSectionSpec('mcs-device-selection-integration')
    expect([...integration.prerequisiteSectionIds].sort()).toEqual(
      ['iabp-efficacy-limits', 'impella-suction-purge-rv', 'lvad-alarms-emergencies'].sort(),
    )
  })

  it('names a discrimination in every objective, never the action, in at most two sentences', () => {
    for (const spec of mcsSectionSpecs) {
      expect(spec.objective).not.toMatch(mcsObjectiveActionVerbPattern)
      expect(spec.objective.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(2)
      expect(spec.objective).not.toMatch(/\d/)
      expect(spec.newConcept).not.toMatch(/\d/)
    }
    // The pattern is a real filter.
    expect('Raise the level until the flow comes back.').toMatch(mcsObjectiveActionVerbPattern)
  })

  it('marks exactly one section as walking the loop, at every stop', () => {
    const walkers = mcsSectionSpecs.filter((spec) => spec.walksTheLoop)
    expect(walkers.map((spec) => spec.sectionId)).toEqual(['mcs-foundations-mechanisms'])
    expect(walkers[0].stopIds).toEqual([...mcsSpineStopIds])
  })

  it('covers the flow account only on the section whose prediction is what it will show', () => {
    expect(
      mcsSectionSpecs
        .filter((spec) => spec.withholdsFlowAccountUntilCommit)
        .map((s) => s.sectionId),
    ).toEqual(['mcs-foundations-signals'])
  })

  it('refuses the ladder defects it exists to catch', () => {
    const cases: readonly [string, readonly McsSectionSpec[], RegExp][] = [
      [
        'a prerequisite taught later',
        mutate('iabp-timing-triggering', { prerequisiteSectionIds: ['iabp-efficacy-limits'] }),
        /not taught earlier/,
      ],
      [
        'an objective that opens with the action',
        mutate('iabp-timing-triggering', { objective: 'Move inflation to the notch and watch.' }),
        /opens with the action/,
      ],
      [
        'a digit in learner copy',
        mutate('iabp-timing-triggering', { newConcept: 'timing at 100 ms' }),
        /number appears/,
      ],
      [
        'a strip that marks another device’s control',
        mutate('iabp-timing-triggering', { controlStrip: { 'lvad-speed': 'no-setting' } }),
        /control on another device/,
      ],
      [
        'a step title that matches its own deny pattern',
        mutate('iabp-timing-triggering', {
          stepTitles: {
            ...mcsSectionSpec('iabp-timing-triggering').stepTitles,
            predict: 'Synchrony returns',
          },
        }),
        /matches its own deny pattern/,
      ],
      [
        'a table row the spec claims but the table does not',
        mutate('iabp-timing-triggering', { grammarRowIds: ['timing', 'upstream-inflow'] }),
        /the spec disagrees/,
      ],
      [
        'an integration section that forgets an application',
        mutate('mcs-device-selection-integration', {
          prerequisiteSectionIds: ['iabp-efficacy-limits', 'impella-suction-purge-rv'],
        }),
        /exactly the application sections/,
      ],
      [
        'a pairing with a case on another device',
        mutate('iabp-timing-triggering', {
          practicePairing: { caseId: 'LVAD-01', kind: 'mechanism-match' },
        }),
        /case on another device/,
      ],
    ]
    for (const [, specs, message] of cases) {
      expect(validateMcsSectionSpecs(specs).join('\n')).toMatch(message)
    }
  })
})

describe('the spine, the control panel, the increments, the sort', () => {
  it('validate clean', () => {
    expect(validateMcsSupportSpine()).toEqual([])
    expect(validateMcsControlPanel()).toEqual([])
    expect(validateMcsControlPanelSort()).toEqual([])
    expect(validateMcsDeviceIncrements()).toEqual([])
    expect(validateMcsCasePresentation()).toEqual([])
    expect(validateMcsMapAnswerMappings()).toEqual([])
  })

  it('walks five stops that between them cover every segment of the map, each once', () => {
    const segments = MCS_SUPPORT_SPINE.stops.flatMap((stop) => stop.segmentIds)
    expect(new Set(segments).size).toBe(segments.length)
    expect(segments.length).toBe(11)
    for (const stop of MCS_SUPPORT_SPINE.stops) {
      expect(stop.checklist.length).toBeLessThanOrEqual(4)
      expect(stop.analogy.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(3)
    }
  })

  it('says the panel in one sentence that names every setting, and that the rest is monitoring', () => {
    for (const control of MCS_CONTROL_PANEL.controls) {
      expect(MCS_CONTROL_PANEL.sentence.toLowerCase()).toContain(control.plainName.toLowerCase())
    }
    expect(MCS_CONTROL_PANEL.sentence).toMatch(/monitoring/)
    expect(MCS_CONTROL_PANEL.controls).toHaveLength(4)
    expect(MCS_CONTROL_PANEL_SORT.candidates).toHaveLength(7)
  })

  it('counts each increment out loud, and opens each track with it', () => {
    for (const increment of MCS_DEVICE_INCREMENTS) {
      const carrier = mcsSectionSpec(increment.carrierSectionId)
      if (increment.track === 'integration') {
        expect(increment.ideas).toHaveLength(0)
        expect(increment.sentence).toMatch(/no new mechanism/)
        continue
      }
      expect(carrier.track).toBe(increment.track)
      const firstOnTrack = mcsLessons.find((lesson) => lesson.device === increment.track)
      expect(firstOnTrack?.id).toBe(increment.carrierSectionId)
      expect(increment.sentence).toMatch(
        increment.ideas.length === 1 ? /one new idea/ : /exactly two new ideas/,
      )
    }
    expect(
      validateMcsDeviceIncrements([
        { ...MCS_DEVICE_INCREMENTS[1], ideas: [MCS_DEVICE_INCREMENTS[1].ideas[0]] },
      ]).join('\n'),
    ).toMatch(/out loud/)
  })
})

describe('the map-answer rule', () => {
  it('admits exactly the two sections whose every identification answer is a place', () => {
    expect(mcsMapAnswerSectionIds()).toEqual([
      'impella-suction-purge-rv',
      'mcs-device-selection-integration',
    ])
    for (const sectionId of mcsMapAnswerSectionIds()) {
      const contract = mcsSectionLearningContracts.find((c) => c.sectionId === sectionId)!
      const targets = mcsMapAnswerTargets(sectionId)!
      expect(targets.map((t) => t.optionId).sort()).toEqual(
        contract.recognizeOptions.map((o) => o.id).sort(),
      )
      const firstSegments = targets.map((t) => t.segmentIds[0])
      expect(new Set(firstSegments).size).toBe(firstSegments.length)
    }
  })
})

describe('one door', () => {
  const fresh = { completedLessonIds: [], masteredCaseIds: [] }

  it('sends a fresh learner to section one, a returning one to the first incomplete, and a finished one back to one', () => {
    const order = mcsPathway().sections.map((section) => section.id)
    expect(nextIncompleteMcsSectionLink(fresh)).toMatchObject({
      state: 'start',
      section: { id: order[0] },
    })
    const returning = { completedLessonIds: [order[0], order[1], order[3]], masteredCaseIds: [] }
    expect(resolveNextIncompleteMcsSection(returning)?.id).toBe(order[2])
    expect(nextIncompleteMcsSectionLink(returning).label).toMatch(/^Continue — /)
    const finished = { completedLessonIds: order, masteredCaseIds: [] }
    expect(nextIncompleteMcsSectionLink(finished)).toMatchObject({
      state: 'complete',
      section: null,
    })
    expect(nextIncompleteMcsSectionLink(finished).href).toContain(order[0])
  })

  it('ignores completed ids that are not sections', () => {
    expect(
      resolveNextIncompleteMcsSection({
        completedLessonIds: ['IABP-01', 'nothing'],
        masteredCaseIds: [],
      })?.id,
    ).toBe(mcsPathway().sections[0].id)
  })

  it('derives the composition from the registry', () => {
    const composition = mcsPathwayComposition()
    expect(composition.total).toBe(mcsLessons.length)
    expect(
      composition.foundations +
        composition.mechanisms +
        composition.applications +
        composition.integrations,
    ).toBe(composition.total)
    expect(composition.sentence).toContain(`${composition.total} sections`)
    expect(composition.sentence).toContain(`${composition.minutes} min`)
  })

  it('groups the pathway into contiguous runs that flatten back to the canonical order', () => {
    const groups = mcsPathwayGroups()
    expect(groups.map((group) => group.id)).toEqual([
      'foundations',
      'iabp',
      'impella',
      'lvad',
      'choosing',
    ])
    expect(groups.flatMap((group) => group.sections.map((section) => section.id))).toEqual(
      mcsPathway().sections.map((section) => section.id),
    )
    for (const group of groups) {
      if (group.device) {
        expect(group.cases.every((scenario) => scenario.device === group.device)).toBe(true)
        expect(group.capstone?.device).toBe(group.device)
      }
      expect(mcsGroupSummaryLine(group)).toMatch(/min$/)
    }
    expect(mcsGroupSummaryLine(groups[1])).toBe(
      'Sections 3–4 · 2 sections · 3 cases · 1 challenge · 24 min',
    )
  })
})

describe('presentation before diagnosis', () => {
  it('names every case by what the learner sees, never by the scenario title', () => {
    for (const scenario of [...mcsPracticeScenarios, ...mcsCapstoneScenarios]) {
      expect(mcsPresentationTitle(scenario)).not.toBe(scenario.title)
      expect(mcsPresentationTitle(scenario)).not.toMatch(/\d/)
    }
  })

  it('pairs every device section with a case on its device, by mechanism where one exists', () => {
    for (const lesson of mcsStageLessons()) {
      if (lesson.spec.track === 'shared' && lesson.index < 2) {
        expect(lesson.practicePairing).toBeUndefined()
        continue
      }
      expect(lesson.practicePairing).toBeDefined()
      expect(lesson.practicePairing?.title).not.toMatch(
        /thrombosis|hypertension|malposition|late deflation/i,
      )
    }
  })
})

describe('stage sources', () => {
  it('collects every registered source a section rests on, each once, lesson sources first', () => {
    for (const lesson of mcsLessons) {
      const { sourceIds } = mcsStageSources(lesson.id)
      expect(new Set(sourceIds).size).toBe(sourceIds.length)
      expect(sourceIds.slice(0, lesson.sourceIds.length)).toEqual([...lesson.sourceIds])
      const contract = mcsSectionLearningContracts.find((c) => c.sectionId === lesson.id)!
      for (const id of contract.predictionItem.evidenceIds) expect(sourceIds).toContain(id)
      const transfer = mcsLessonTransfers.find((t) => t.lessonId === lesson.id)!
      for (const id of transfer.item.evidenceIds) expect(sourceIds).toContain(id)
      for (const story of mcsStoryProblems.filter((s) => s.sectionId === lesson.id)) {
        for (const id of story.item.evidenceIds) expect(sourceIds).toContain(id)
      }
    }
    expect(mcsStageSources('mcs-foundations-mechanisms').sourceIds).toContain(
      'mcs-educational-model-v1',
    )
  })
})

describe('answer order', () => {
  const families = [
    [
      'identifications',
      mcsSectionLearningContracts.map((c) => ({
        id: `${c.sectionId}-recognize`,
        choices: c.recognizeOptions,
        bestId: c.recognizeOptions.find((o) => o.correct)!.id,
      })),
    ],
    [
      'predictions',
      mcsSectionLearningContracts.map((c) => ({
        id: c.predictionItem.id,
        choices: c.predictionItem.choices,
        bestId: c.predictionItem.choices.find((o) => o.plausibility === 'best')!.id,
      })),
    ],
    [
      'transfers',
      mcsLessonTransfers.map((t) => ({
        id: t.item.id,
        choices: t.item.choices,
        bestId: t.item.choices.find((o) => o.plausibility === 'best')!.id,
      })),
    ],
    [
      'stories',
      mcsStoryProblems.map((s) => ({
        id: s.item.id,
        choices: s.item.choices,
        bestId: s.item.choices.find((o) => o.plausibility === 'best')!.id,
      })),
    ],
  ] as const

  it.each(families)(
    '%s: "pick the first" and "pick the longest" score no better than chance plus a tenth',
    (_name, items) => {
      const chance = items.reduce((sum, item) => sum + 1 / item.choices.length, 0) / items.length
      const first =
        items.filter(
          (item) =>
            orderChoices<{ readonly id: string }>(item.id, item.choices)[0].id === item.bestId,
        ).length / items.length
      const longest =
        items.filter((item) => {
          const max = Math.max(...item.choices.map((choice) => choice.label.length))
          return item.choices.find((choice) => choice.id === item.bestId)!.label.length === max
        }).length / items.length
      expect(first).toBeLessThanOrEqual(chance + 0.1 + 1 / items.length)
      expect(longest).toBeLessThanOrEqual(chance + 0.1 + 1 / items.length)
      const offsets = new Set(items.map((item) => choiceOrderOffset(item.id, item.choices.length)))
      if (items.length > 4) expect(offsets.size).toBeGreaterThan(1)
    },
  )
})
