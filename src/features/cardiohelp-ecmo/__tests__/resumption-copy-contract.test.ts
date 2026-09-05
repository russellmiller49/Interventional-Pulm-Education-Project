import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
import { requireEcmoLearnPrediction } from '../content/learnPredictionItems'
import { cardiohelpScenarioById } from '../content/scenarios'

/**
 * What the module may and may not say about coming back from an air event.
 *
 * The canonical teaching is five steps: recognise the event and the device stop, isolate the
 * patient, identify and correct the air source, de-air and verify the circuit, then resume support
 * according to the current manufacturer instructions for use and the unit's approved ECMO
 * air-emergency protocol. The fifth is where this contract lives — the module does not teach where
 * clamp opening, pump restart and console reset fall relative to one another, and no learner-facing
 * string may imply that it does.
 *
 * Asserted against the authored content and the rendered source text rather than against a
 * component, because the risk is a sentence surviving in a corner nobody renders in a test.
 */

const BUBBLE_SCENARIOS = ['arterial-bubble-stop', 'va-arterial-bubble-stop'] as const
const BUBBLE_CASES = [
  'clinical-vv-circuit-air-embolism',
  'va-clinical-circuit-air-embolism',
] as const

/** Every file that carries learner-facing copy about the air event. */
const COPY_SOURCES: readonly string[] = [
  'src/features/cardiohelp-ecmo/content/learnLessons.ts',
  'src/features/cardiohelp-ecmo/content/learnPredictionItems.ts',
  'src/features/cardiohelp-ecmo/content/scenarios.ts',
  'src/features/cardiohelp-ecmo/content/clinicalCases.ts',
  'src/features/cardiohelp-ecmo/content/practiceSupport.ts',
  'src/features/cardiohelp-ecmo/components/teaching/drills/ArterialBubbleStopPanel.tsx',
  'src/features/cardiohelp-ecmo/components/EcmoCircuit3D.tsx',
  // The stage's control resolver carries the bounded-resumption instruction the drill steps show.
  'src/features/cardiohelp-ecmo/components/stage/drillControlResolver.ts',
  'src/features/cardiohelp-ecmo/components/stage/DrillStageHost.tsx',
  'src/features/cardiohelp-ecmo/components/stage/DrillStepTeaching.tsx',
  'src/features/cardiohelp-ecmo/engine/reducer.ts',
  'src/features/cardiohelp-ecmo/engine/types.ts',
  'src/features/critical-care/content/learningPathways.ts',
  // The shared circuit grammar. It carries no resumption copy today, and it is scanned so that a
  // later package adding an air-event row to it cannot quietly teach a clamp order here instead.
  'src/features/cardiohelp-ecmo/content/circuitSegments.ts',
  'src/features/cardiohelp-ecmo/content/localizationCards.ts',
  // The per-drill debrief shapes. The two air drills' knob strips are the one place outside the
  // lessons where a sentence about clamps, the stopped pump and resuming support is written, so
  // they are scanned here rather than trusted to stay clear of a resumption order.
  'src/features/cardiohelp-ecmo/content/drillSpecs.ts',
  'src/features/cardiohelp-ecmo/content/controlPanel.ts',
  'src/features/cardiohelp-ecmo/content/circuitPresentation.ts',
  'src/features/cardiohelp-ecmo/components/teaching/EcmoLocalizationCard.tsx',
  'src/features/cardiohelp-ecmo/components/circuit-map/circuitMapEmphasis.tsx',
  // The Practice surfaces: the stage panels and their buttons, the Now card the header and the
  // help dialog read from, the dialog itself, and the debrief that renders the authored workflow.
  'src/features/cardiohelp-ecmo/components/PracticeCasePlayer.tsx',
  'src/features/cardiohelp-ecmo/components/practice/nowCard.ts',
  'src/features/cardiohelp-ecmo/components/practice/EcmoCaseDebrief.tsx',
  'src/features/cardiohelp-ecmo/components/shell/EcmoHelpDialog.tsx',
  'docs/cardiohelp-ecmo/e5-model-limitations.md',
  'docs/cardiohelp-ecmo/b3-b4-novice-think-aloud-script.md',
]

/**
 * Phrasings that either teach a resumption order or overclaim what the simulator checked.
 *
 * "verified … protocol" is banned in both directions: the protocol is not something this module
 * verified, and completing a bounded action is not evidence a learner followed a real one.
 */
const BANNED: readonly { readonly pattern: RegExp; readonly why: string }[] = [
  { pattern: /deliberate last step/i, why: 'implies reset is universally last' },
  { pattern: /one bounded sequence for consistency/i, why: 'implies the module teaches one order' },
  { pattern: /resume in order/i, why: 'implies the module teaches a resumption order' },
  { pattern: /ordered resumption/i, why: 'implies the module teaches a resumption order' },
  { pattern: /verified (manufacturer|protocol|resumption)/i, why: 'overclaims what was verified' },
  { pattern: /on the verified/i, why: 'overclaims what was verified' },
  { pattern: /bring the circuit back and reset/i, why: 'establishes a resumption order' },
  { pattern: /unclamp in order/i, why: 'establishes a resumption order' },
  {
    pattern: /reset(?:ting)? (?:is|comes|falls) (?:the )?last\b/i,
    why: 'implies reset is universally last',
  },
  {
    pattern: /open (?:the )?drainage(?: limb)?,? then (?:the )?return/i,
    why: 'teaches a resumption clamp order',
  },
  // B6-003: the phrasings the Practice copy actually used to teach an unclamping order.
  { pattern: /reopened in order/i, why: 'teaches a resumption clamp order' },
  { pattern: /resume support in order/i, why: 'implies the module teaches a resumption order' },
  { pattern: /ordered unclamping/i, why: 'teaches a resumption clamp order' },
  { pattern: /bounded, ordered sequence/i, why: 'implies the module teaches one order' },
  {
    pattern: /re-establish (?:VA )?support in the correct order/i,
    why: 'implies the module teaches a resumption order',
  },
  // B6-015: the simulator has no backup-console or emergency-drive state, so no button, step or
  // finding may claim one was verified.
  {
    pattern: /verif(?:y|ied) backup/i,
    why: 'credits a backup check the simulator does not represent',
  },
]

function sourceOf(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

/** Every learner-facing string the two bubble lessons and their predictions actually render. */
function bubbleLearnerCopy(): readonly { readonly where: string; readonly text: string }[] {
  const copy: { where: string; text: string }[] = []
  for (const scenarioId of BUBBLE_SCENARIOS) {
    const lesson = cardiohelpLearnLessonByScenarioId.get(scenarioId)
    if (!lesson) throw new Error(`No lesson for ${scenarioId}`)
    copy.push({ where: `${scenarioId}.title`, text: lesson.title })
    for (const objective of lesson.learningObjectives) {
      copy.push({ where: `${scenarioId}.objective`, text: objective })
    }
    for (const step of lesson.steps) {
      copy.push({ where: `${step.id}.title`, text: step.title })
      copy.push({ where: `${step.id}.instruction`, text: step.instruction })
      copy.push({ where: `${step.id}.rationale`, text: step.rationale })
      copy.push({ where: `${step.id}.actionLabel`, text: step.actionLabel })
      for (const response of step.expectedResponse) {
        copy.push({ where: `${step.id}.expectedResponse`, text: response })
      }
    }

    const scenario = cardiohelpScenarioById.get(scenarioId)
    if (!scenario) throw new Error(`No scenario ${scenarioId}`)
    copy.push({ where: `${scenarioId}.summary`, text: scenario.summary })
    for (const note of scenario.debrief.safetyNotes) {
      copy.push({ where: `${scenarioId}.safetyNote`, text: note })
    }
    for (const step of scenario.debrief.correctWorkflow) {
      copy.push({ where: `${scenarioId}.correctWorkflow`, text: step })
    }

    const prediction = requireEcmoLearnPrediction(scenarioId)
    copy.push({ where: `${scenarioId}.explanation`, text: prediction.item.explanation })
    for (const choice of prediction.item.choices) {
      copy.push({ where: `${scenarioId}.choice`, text: choice.label })
      if (choice.rationale) copy.push({ where: `${scenarioId}.rationale`, text: choice.rationale })
    }
  }

  for (const caseId of BUBBLE_CASES) {
    const scenario = clinicalPracticeScenarioById.get(caseId)
    if (!scenario) throw new Error(`No clinical case ${caseId}`)
    const clinicalCase = scenario.clinicalCase
    if (!clinicalCase) throw new Error(`${caseId} has no clinical case`)
    copy.push({ where: `${caseId}.summary`, text: scenario.summary })
    // Everything the case says before, during and after the plan: the presentation and the
    // patient line, the narrative, the task, the objectives, the data and the two outcomes.
    copy.push({ where: `${caseId}.presentationTitle`, text: clinicalCase.presentationTitle ?? '' })
    copy.push({ where: `${caseId}.patientLabel`, text: clinicalCase.patientLabel })
    copy.push({ where: `${caseId}.openingNarrative`, text: clinicalCase.openingNarrative })
    copy.push({ where: `${caseId}.decisionPrompt`, text: clinicalCase.decisionPrompt })
    for (const objective of clinicalCase.learningObjectives) {
      copy.push({ where: `${caseId}.objective`, text: objective })
    }
    for (const item of clinicalCase.data) {
      copy.push({ where: `${caseId}.data.${item.label}`, text: item.value })
    }
    copy.push({ where: `${caseId}.completionResponse`, text: clinicalCase.completionResponse })
    copy.push({
      where: `${caseId}.deteriorationResponse`,
      text: clinicalCase.deteriorationResponse,
    })
    for (const note of scenario.debrief.safetyNotes) {
      copy.push({ where: `${caseId}.safetyNote`, text: note })
    }
    for (const step of scenario.debrief.correctWorkflow) {
      copy.push({ where: `${caseId}.correctWorkflow`, text: step })
    }
    copy.push({ where: `${caseId}.diagnosis`, text: scenario.debrief.diagnosis })
    for (const intervention of scenario.clinicalCase?.interventions ?? []) {
      copy.push({ where: `${caseId}.${intervention.id}.label`, text: intervention.label })
      copy.push({
        where: `${caseId}.${intervention.id}.description`,
        text: intervention.description,
      })
      copy.push({ where: `${caseId}.${intervention.id}.response`, text: intervention.response })
      for (const finding of intervention.reveals ?? []) {
        copy.push({ where: `${caseId}.${intervention.id}.reveals`, text: finding })
      }
      if (intervention.simulatorAction) {
        copy.push({
          where: `${caseId}.${intervention.id}.instruction`,
          text: intervention.simulatorAction.instruction,
        })
      }
    }
    for (const hint of scenario.hints ?? []) {
      copy.push({ where: `${caseId}.hint.title`, text: hint.title })
      copy.push({ where: `${caseId}.hint.text`, text: hint.text })
    }
    // The reassessment prompts and every option a learner can pick, with its rationale: the one
    // place an "expected finding" could describe a resumption order as the modeled response.
    const reassessment = scenario.reassessment
    if (reassessment) {
      copy.push({ where: `${caseId}.reassessment.instruction`, text: reassessment.instruction })
      for (const domain of ['device', 'circuit', 'patient'] as const) {
        const question = reassessment[domain]
        copy.push({ where: `${caseId}.${domain}.prompt`, text: question.prompt })
        for (const option of question.options) {
          copy.push({ where: `${caseId}.${domain}.${option.id}.label`, text: option.label })
          if (option.rationale) {
            copy.push({
              where: `${caseId}.${domain}.${option.id}.rationale`,
              text: option.rationale,
            })
          }
        }
      }
    }
  }
  return copy
}

describe('the module never claims to teach a resumption order', () => {
  it.each(COPY_SOURCES)('%s carries no banned resumption phrasing', (relativePath) => {
    const source = sourceOf(relativePath)
    for (const { pattern, why } of BANNED) {
      const match = source.match(pattern)
      expect(`${relativePath}: ${match?.[0] ?? 'clean'} (${why})`).toBe(
        `${relativePath}: clean (${why})`,
      )
    }
  })

  it('says nothing order-teaching in any authored bubble string', () => {
    for (const { where, text } of bubbleLearnerCopy()) {
      for (const { pattern, why } of BANNED) {
        const match = text.match(pattern)
        expect(`${where}: ${match?.[0] ?? 'clean'} (${why})`).toBe(`${where}: clean (${why})`)
      }
    }
  })

  it('never says reset is universally last', () => {
    const everything = COPY_SOURCES.map(sourceOf).join('\n')
    expect(everything).not.toMatch(/reset.{0,40}\b(?:always|universally)\b.{0,20}last/i)
    expect(everything).not.toMatch(/\blast step\b/i)
  })

  it('never claims the simulator verified a real protocol', () => {
    const everything = COPY_SOURCES.map(sourceOf).join('\n')
    // Neither "the protocol was verified" nor "you followed a verified protocol".
    expect(everything).not.toMatch(
      /verified\s+(?:manufacturer|local|unit|real|approved)?\s*protocol/i,
    )
    expect(everything).not.toMatch(/followed (?:a|the) (?:real|verified) protocol/i)
  })
})

describe('what the module does still teach', () => {
  it.each(BUBBLE_SCENARIOS)(
    '%s keeps the return-then-drainage isolation sequence',
    (scenarioId) => {
      const lesson = cardiohelpLearnLessonByScenarioId.get(scenarioId)
      if (!lesson) throw new Error(`No lesson for ${scenarioId}`)
      const actions = lesson.steps.flatMap((step) => step.actions)
      const closeReturn = actions.findIndex(
        (action) =>
          action.type === 'TOGGLE_CIRCUIT_CLAMP' &&
          action.limb === 'return' &&
          (action.closed ?? true),
      )
      const closeDrainage = actions.findIndex(
        (action) =>
          action.type === 'TOGGLE_CIRCUIT_CLAMP' &&
          action.limb === 'drainage' &&
          (action.closed ?? true),
      )
      // Isolation is taught explicitly, and this cleanup did not touch it.
      expect(closeReturn).toBeGreaterThanOrEqual(0)
      expect(closeDrainage).toBeGreaterThan(closeReturn)
    },
  )

  it.each(BUBBLE_SCENARIOS)('%s keeps correction and clearance as prerequisites', (scenarioId) => {
    const lesson = cardiohelpLearnLessonByScenarioId.get(scenarioId)
    if (!lesson) throw new Error(`No lesson for ${scenarioId}`)
    const actions = lesson.steps.flatMap((step) => step.actions)
    const correct = actions.findIndex(
      (action) => action.type === 'CORRECT_FAULT' && action.fault === 'arterial-bubble',
    )
    const resume = actions.findIndex((action) => action.type === 'RESUME_SUPPORT_AFTER_BUBBLE')
    expect(correct).toBeGreaterThanOrEqual(0)
    expect(resume).toBeGreaterThan(correct)
  })

  it.each(BUBBLE_CASES)('%s keeps its isolation and de-airing requirements', (caseId) => {
    const scenario = clinicalPracticeScenarioById.get(caseId)
    if (!scenario) throw new Error(`No clinical case ${caseId}`)
    const required = scenario.clinicalCase?.requiredInterventionIds ?? []
    const prefix = caseId.startsWith('va-') ? 'va-' : ''
    expect(required).toContain(`${prefix}air-clamp-return`)
    expect(required).toContain(`${prefix}air-clamp-drainage`)
    expect(required).toContain(`${prefix}air-deair`)
    expect(required).toContain(`${prefix}air-resume-support`)
    // The resumption still comes last, and still depends on the de-airing.
    const resume = scenario.clinicalCase?.interventions.find(
      (intervention) => intervention.id === `${prefix}air-resume-support`,
    )
    expect(resume?.prerequisites).toContain(`${prefix}air-deair`)
  })

  it('names the bounded action as an abstraction wherever it is described', () => {
    const abstraction =
      /single simulated action stands in for the device- and program-specific\s+resumption sequence; it does not reproduce or teach that sequence/i
    for (const relativePath of [
      'src/features/cardiohelp-ecmo/content/learnLessons.ts',
      'src/features/cardiohelp-ecmo/content/clinicalCases.ts',
      'src/features/cardiohelp-ecmo/components/teaching/drills/ArterialBubbleStopPanel.tsx',
      'docs/cardiohelp-ecmo/e5-model-limitations.md',
    ]) {
      expect(`${relativePath}: ${abstraction.test(sourceOf(relativePath))}`).toBe(
        `${relativePath}: true`,
      )
    }
    // The bedside control says the same thing in its own words, beside the button. A language audit
    // in September 2026 replaced "a bounded simulation abstraction" with "a deliberate
    // simplification" — same hedge, without the module's internal vocabulary — so this now pins the
    // substance that follows it rather than the label alone.
    expect(sourceOf('src/features/cardiohelp-ecmo/components/EcmoCircuit3D.tsx')).toMatch(
      /deliberate simplification\. It stands in for the device- and program-specific/i,
    )
  })

  it('uses the canonical IFU wording rather than an invented shorthand', () => {
    const lesson = cardiohelpLearnLessonByScenarioId.get('arterial-bubble-stop')
    const resume = lesson?.steps.find((step) =>
      step.actions.some((action) => action.type === 'RESUME_SUPPORT_AFTER_BUBBLE'),
    )
    expect(resume?.instruction).toMatch(
      /current manufacturer instructions for use \(IFU\).{0,60}approved ECMO air-emergency protocol/i,
    )
    expect(resume?.actionLabel).toMatch(/current IFU and approved local protocol/i)
  })

  it('records the resumption in history as a simulation abstraction', () => {
    const reducer = sourceOf('src/features/cardiohelp-ecmo/engine/reducer.ts')
    expect(reducer).toMatch(/Completed the simulation's protocol-governed resumption abstraction/)
  })

  it('describes the clamp refusal exactly as the code behaves', () => {
    // The comment used to say "refused rather than charged", which is not what the code does.
    const reducer = sourceOf('src/features/cardiohelp-ecmo/engine/reducer.ts')
    expect(reducer).not.toMatch(/Refused rather than charged/i)
    expect(reducer).toMatch(/the transition is always refused/i)
    expect(reducer).toMatch(/additionally charged while air remains outstanding/i)
    expect(reducer).toMatch(/no further safety penalty/i)
  })
})
