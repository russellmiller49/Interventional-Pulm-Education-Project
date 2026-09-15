import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import type { LearningPathwaySection } from '@/features/learning-module/curriculum/types'

import { cardiohelpCurriculum } from '../content/curriculum'
import { ecmoDrillSpec, ecmoDrillSpecs } from '../content/drillSpecs'
import { ecmoFoundationSections } from '../content/foundationLessons'
import {
  cardiohelpLearnLessonByScenarioId,
  cardiohelpLearnLessons,
  ECMO_SCAFFOLDED_TRANSFER_PREFIX,
  ECMO_TRANSFER_STEP_TITLE,
  validateGuidedLessonRegistry,
} from '../content/learnLessons'
import { ecmoSectionSpec } from '../content/sectionSpecs'
import type { GuidedWalkthroughStep, SupportMode } from '../engine/types'

/**
 * ECMO-02: course names and objectives are teaching, not answer-security surfaces. The
 * remaining deny patterns describe only the local optional observation/prediction variation.
 * ECMO-01 rendered self-paced tests pin direct reveal, retry and skipping without an answer.
 * Registry identity, authored transfer setup and duration checks remain here.
 */

const TRACKS: readonly SupportMode[] = ['vv', 'va']

interface DrillUnderTest {
  readonly scenarioId: string
  readonly track: SupportMode
  readonly section: LearningPathwaySection
  readonly patterns: readonly RegExp[]
}

function sectionOf(track: SupportMode, sectionId: string): LearningPathwaySection {
  const section = criticalCareLearningPathway('cardiohelp-ecmo', track).sections.find(
    (candidate) => candidate.id === sectionId,
  )
  if (!section) throw new Error(`No ${track} pathway section ${sectionId}`)
  return section
}

const drills: readonly DrillUnderTest[] = cardiohelpLearnLessons.map((lesson) => ({
  scenarioId: lesson.scenarioId,
  track: lesson.supportMode,
  section: sectionOf(lesson.supportMode, lesson.scenarioId),
  patterns: ecmoDrillSpec(lesson.scenarioId).precommitDenyPatterns,
}))

/** The lesson whose transfer step opens onto this drill, if any lesson's does. */
function lessonTransferringInto(scenarioId: string) {
  return cardiohelpLearnLessons.find((lesson) =>
    lesson.steps.some(
      (step) => step.phase === 'transfer' && step.transferScenarioId === scenarioId,
    ),
  )
}

function transferStepOf(lesson: (typeof cardiohelpLearnLessons)[number]): GuidedWalkthroughStep {
  const step = lesson.steps.find((candidate) => candidate.phase === 'transfer')
  if (!step) throw new Error(`${lesson.id} has no transfer step`)
  return step
}

/** Every string of the step a learner reads, labelled by where it sits. */
function stepSurfaces(step: GuidedWalkthroughStep): readonly { where: string; text: string }[] {
  return [
    { where: `${step.id}.title`, text: step.title },
    { where: `${step.id}.instruction`, text: step.instruction },
    { where: `${step.id}.rationale`, text: step.rationale },
    { where: `${step.id}.actionLabel`, text: step.actionLabel },
    ...step.expectedResponse.map((text) => ({ where: `${step.id}.expectedResponse`, text })),
  ]
}

function expectClean(
  patterns: readonly RegExp[],
  surfaces: readonly { where: string; text: string }[],
) {
  const leaks = surfaces.flatMap(({ where, text }) =>
    patterns.flatMap((pattern) => {
      const match = text.match(pattern)
      return match ? [`${where}: "${match[0]}" (${pattern})`] : []
    }),
  )
  expect(leaks).toEqual([])
}

describe('the registries validate and cover every drill', () => {
  it('passes the guided-lesson registry validator', () => {
    expect(validateGuidedLessonRegistry()).toEqual([])
  })

  it('holds a drill spec and a pathway row for all twenty lessons', () => {
    expect(drills).toHaveLength(20)
    expect(Object.keys(ecmoDrillSpecs).sort()).toEqual(
      drills.map((drill) => drill.scenarioId).sort(),
    )
    for (const drill of drills) expect(drill.patterns.length).toBeGreaterThan(0)
  })
})

describe('named lessons stay aligned with the open shared pathway', () => {
  it.each(drills.map((drill) => [drill.scenarioId, drill] as const))(
    '%s: lesson title, objective and catalog retain the same teaching identity',
    (_id, drill) => {
      const lesson = cardiohelpLearnLessonByScenarioId.get(drill.scenarioId)
      expect(lesson?.title).toBe(drill.section.title)
      expect(lesson?.learningObjectives).toEqual([ecmoSectionSpec(drill.scenarioId).objective])
      expect(criticalCareActivityById.get(drill.section.activityId)?.title).toBe(
        drill.section.title,
      )
      expect(drill.section.shortTitle.trim().length).toBeGreaterThan(0)
    },
  )

  it.each([
    ['vv', 'preload-drainage-collapse', /drainage insufficiency/i],
    ['vv', 'afterload-return-obstruction', /return obstruction/i],
    ['vv', 'afterload-oxygenator-resistance', /oxygenator resistance/i],
    ['vv', 'vv-recirculation', /recirculation/i],
    ['vv', 'gas-source-interruption', /sweep-gas interruption/i],
    ['va', 'va-differential-hypoxemia', /differential hypoxemia/i],
    ['va', 'va-lv-loading', /ventricular loading/i],
  ] as const)(
    '%s / %s names the concept taught without an answer commitment',
    (track, id, topic) => {
      expect(sectionOf(track, id).title).toMatch(topic)
    },
  )
})

describe('the observe step reads, and does not explain', () => {
  it.each(drills.map((drill) => [drill.scenarioId, drill] as const))(
    '%s: every observe-phase surface is clean',
    (_id, drill) => {
      const lesson = cardiohelpLearnLessonByScenarioId.get(drill.scenarioId)
      if (!lesson) throw new Error(`No lesson for ${drill.scenarioId}`)
      const observe = lesson.steps.filter((step) => step.phase === 'observe')
      expect(observe.length).toBeGreaterThan(0)
      expectClean(drill.patterns, observe.flatMap(stepSurfaces))
    },
  )

  it.each(drills.map((drill) => [drill.scenarioId, drill] as const))(
    '%s: nothing read before the prediction is the answer',
    (_id, drill) => {
      // The console tours carry several orientation steps between the observe step and the
      // prediction; a learner reads all of them first. The same rule covers them.
      const lesson = cardiohelpLearnLessonByScenarioId.get(drill.scenarioId)
      if (!lesson) throw new Error(`No lesson for ${drill.scenarioId}`)
      const predictionIndex = lesson.steps.findIndex((step) => step.predictionScenarioId)
      expect(predictionIndex).toBeGreaterThan(0)
      expectClean(drill.patterns, lesson.steps.slice(0, predictionIndex).flatMap(stepSurfaces))
    },
  )
})

describe('the previous lesson’s transfer step does not answer the drill it opens onto', () => {
  it('chains every drill to exactly one transfer step', () => {
    for (const drill of drills) {
      const sources = cardiohelpLearnLessons.filter((lesson) =>
        lesson.steps.some(
          (step) => step.phase === 'transfer' && step.transferScenarioId === drill.scenarioId,
        ),
      )
      expect(sources.map((lesson) => lesson.id)).toHaveLength(1)
    }
  })

  it.each(drills.map((drill) => [drill.scenarioId, drill] as const))(
    '%s: the transfer into it is clean, or is an explicit worked example',
    (_id, drill) => {
      const previous = lessonTransferringInto(drill.scenarioId)
      if (!previous) throw new Error(`No lesson transfers into ${drill.scenarioId}`)
      const step = transferStepOf(previous)

      expect(step.title).toBe(ECMO_TRANSFER_STEP_TITLE)
      expect(step.rationale).toBe(ecmoDrillSpec(previous.scenarioId).transferPrinciple)

      const scaffolded = step.instruction.startsWith(ECMO_SCAFFOLDED_TRANSFER_PREFIX)
      // The instruction and its button are the disclosure a worked example makes on purpose;
      // the title, the rationale and what the learner is told to expect are never allowed to be.
      const alwaysClean = [
        { where: `${step.id}.title`, text: step.title },
        { where: `${step.id}.rationale`, text: step.rationale },
        ...step.expectedResponse.map((text) => ({ where: `${step.id}.expectedResponse`, text })),
      ]
      const cleanUnlessDisclosed = [
        { where: `${step.id}.instruction`, text: step.instruction },
        { where: `${step.id}.actionLabel`, text: step.actionLabel },
      ]
      expectClean(
        drill.patterns,
        scaffolded ? alwaysClean : [...alwaysClean, ...cleanUnlessDisclosed],
      )
    },
  )

  it('discloses exactly the transfers into the gas-path and air drills', () => {
    const disclosed = cardiohelpLearnLessons
      .map(transferStepOf)
      .filter((step) => step.instruction.startsWith(ECMO_SCAFFOLDED_TRANSFER_PREFIX))
      .map((step) => step.transferScenarioId)
      .sort()
    expect(disclosed).toEqual([
      'arterial-bubble-stop',
      'gas-source-interruption',
      'va-arterial-bubble-stop',
      'va-gas-source-interruption',
    ])
  })

  it('never previews the next scenario’s safety notes or causal chain on the transfer step', () => {
    for (const lesson of cardiohelpLearnLessons) {
      const step = transferStepOf(lesson)
      const target = drills.find((drill) => drill.scenarioId === step.transferScenarioId)
      if (!target) throw new Error(`${lesson.id} transfers into an unknown drill`)
      // The previous form rendered the next scenario's debrief here, which is that drill's
      // answer stated as a result. The step now carries observable signals on the new circuit.
      expect(step.expectedResponse.length).toBeGreaterThan(0)
      expect(step.rationale).not.toContain('recirculation')
      expect(step.expectedResponse.join(' ')).not.toMatch(
        /critical|treatment for|is not equivalent/i,
      )
    }
  })
})

describe('curriculum summaries advertise optional integrated cases', () => {
  it.each(TRACKS)(
    '%s retains its case identity without prerequisites or independence claims',
    (track) => {
      const unit = cardiohelpCurriculum[track].find((item) => item.capstoneScenarioId)!
      expect(unit.title).toBe(`${track.toUpperCase()} integrated case`)
      expect(unit.summary).toMatch(/open this case directly/i)
      expect(unit.summary).toMatch(/reveal the reasoning at any time/i)
      expect(unit.summary).not.toMatch(
        /no prompting|comes first|required|independent|mastery|exam/i,
      )
    },
  )
})

describe('the other surfaces that name a section agree with the pathway', () => {
  it('registers every activity with the pathway row’s title, description and minutes', () => {
    for (const track of TRACKS) {
      for (const section of criticalCareLearningPathway('cardiohelp-ecmo', track).sections) {
        const activity = criticalCareActivityById.get(section.activityId)
        expect(activity).toBeDefined()
        expect(activity?.title).toBe(section.title)
        expect(activity?.description).toBe(section.description)
        expect(activity?.estimatedMinutes).toBe(section.minutes)
      }
    }
  })

  it('names every foundation section as its pathway row does', () => {
    for (const section of ecmoFoundationSections) {
      const track = section.supportMode ?? 'vv'
      const row = sectionOf(track, section.id)
      expect(section.title).toBe(row.title)
      expect(section.shortTitle).toBe(row.shortTitle)
      expect(section.minutes).toBe(row.minutes)
      expect(section.summary).toBe(row.description)
    }
  })

  it('does not let the circuit-walk summary place a pressure channel', () => {
    // The section's own prediction asks where pInt is reported; the summary may not say.
    const walk = ecmoFoundationSections.find((section) => section.id === 'circuit-flow-path')
    expect(walk).toBeDefined()
    expect(`${walk?.summary} ${sectionOf('vv', 'circuit-flow-path').description}`).not.toMatch(
      /pInt|pArt|pVen/,
    )
  })

  it('carries the honest minutes on both tracks', () => {
    const minutes = (track: SupportMode) =>
      Object.fromEntries(
        criticalCareLearningPathway('cardiohelp-ecmo', track).sections.map((section) => [
          section.id,
          section.minutes,
        ]),
      )
    expect(minutes('vv')).toEqual({
      'why-extracorporeal-support': 8,
      'circuit-flow-path': 10,
      'pump-and-pressure-zones': 10,
      'blood-flow-versus-sweep': 10,
      'vv-normal-state': 8,
      'vv-series-physiology': 10,
      'startup-sensor-orientation': 12,
      'preload-drainage-collapse': 10,
      'afterload-return-obstruction': 10,
      'afterload-oxygenator-resistance': 10,
      'vv-recirculation': 10,
      'acute-hypercapnia': 8,
      'compensated-hypercapnia': 8,
      'gas-source-interruption': 10,
      'arterial-bubble-stop': 12,
      'transport-power-loss': 8,
      'vv-integration-capstone': 18,
    })
    expect(minutes('va')).toEqual({
      'why-extracorporeal-support': 8,
      'circuit-flow-path': 10,
      'pump-and-pressure-zones': 10,
      'blood-flow-versus-sweep': 10,
      'va-normal-state': 10,
      'va-parallel-physiology': 12,
      'va-startup-sensor-orientation': 12,
      'va-preload-drainage-collapse': 10,
      'va-afterload-arterial-return-obstruction': 10,
      'va-afterload-oxygenator-resistance': 10,
      'va-differential-hypoxemia': 12,
      'va-lv-loading': 10,
      'va-acute-hypercapnia': 8,
      'va-gas-source-interruption': 10,
      'va-arterial-bubble-stop': 12,
      'va-transport-power-loss': 8,
      'va-integration-capstone': 18,
    })
  })
})
