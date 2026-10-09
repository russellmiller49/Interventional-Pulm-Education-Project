import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
import { requireEcmoLearnPrediction } from '../content/learnPredictionItems'
import { cardiohelpScenarioById } from '../content/scenarios'
import {
  ECMO_AIR_FIRST_MOVES,
  ECMO_AIR_RESUME,
  ECMO_AIR_RESUME_SENTENCE,
  ECMO_NUMBERS,
  ECMO_NUMBER_ONLY_SOURCES,
} from '../content/teachingNumbers'
import { cardiohelpEvidence } from '../content/evidence'

/**
 * What the module teaches about coming back from an air event.
 *
 * Until the teaching-first redo (docs/teaching-first-rules.md, 2026-10-08) this file locked a
 * hedge: the module was not allowed to say where clamp opening, pump restart and console reset fall
 * relative to one another, and had to defer the whole step to "the current IFU and local protocol".
 * That is reversed. The CARDIOHELP-i Instructions for Use print the reset and the clamp rules, the
 * numbers register carries them (`ECMO_AIR_RESUME`, `ECMO_AIR_FIRST_MOVES`), and this contract now
 * requires the copy to teach them: drainage clamp open, bubble stop reset, return clamp open last.
 *
 * What did not change, and is still asserted: isolation is return limb then drainage limb, the
 * source is corrected and the circuit cleared before anything resumes, the module never claims the
 * simulator verified a real protocol, and "call for help" is a step in the sequence rather than the
 * keyed answer on its own.
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
 * Phrasings that overclaim what the simulator checked, or that contradict the taught order.
 *
 * The order itself is taught now, so the old bans on naming one are gone. What stays refused is a
 * claim that a protocol was verified, a credit for a backup check the simulator does not represent,
 * and any sentence that puts the reset or the drainage clamp after the return clamp.
 */
const BANNED: readonly { readonly pattern: RegExp; readonly why: string }[] = [
  { pattern: /verified (manufacturer|protocol|resumption)/i, why: 'overclaims what was verified' },
  { pattern: /on the verified/i, why: 'overclaims what was verified' },
  {
    pattern: /reset(?:ting)? (?:is|comes|falls) (?:the )?last\b/i,
    why: 'contradicts the taught order: the return clamp is last, not the reset',
  },
  {
    pattern: /open (?:the )?return(?: limb| clamp)?,? then (?:the )?drainage/i,
    why: 'contradicts the taught order: the drainage clamp opens before the return clamp',
  },
  // B6-015: the simulator has no backup-console or emergency-drive state, so no button, step or
  // finding may claim one was verified.
  {
    pattern: /verif(?:y|ied) backup/i,
    why: 'credits a backup check the simulator does not represent',
  },
]

/**
 * The hedges the redo removed stay out of everything a learner reads. The two project documents in
 * `COPY_SOURCES` are not learner-facing and are not held to this.
 */
const RETIRED_HEDGES: readonly { readonly pattern: RegExp; readonly why: string }[] = [
  {
    pattern: /single simulated action stands in for the device- and program-specific/i,
    why: 'the retired resumption hedge',
  },
  { pattern: /per (?:the )?current IFU and (?:your )?local protocol/i, why: 'defers the order' },
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

describe('the air-event copy neither overclaims nor contradicts the taught order', () => {
  it.each(COPY_SOURCES)('%s carries no banned phrasing', (relativePath) => {
    const source = sourceOf(relativePath)
    for (const { pattern, why } of BANNED) {
      const match = source.match(pattern)
      expect(`${relativePath}: ${match?.[0] ?? 'clean'} (${why})`).toBe(
        `${relativePath}: clean (${why})`,
      )
    }
  })

  it.each(COPY_SOURCES.filter((path) => path.startsWith('src/')))(
    '%s no longer carries the retired resumption hedge',
    (relativePath) => {
      const source = sourceOf(relativePath)
      for (const { pattern, why } of RETIRED_HEDGES) {
        const match = source.match(pattern)
        expect(`${relativePath}: ${match?.[0] ?? 'clean'} (${why})`).toBe(
          `${relativePath}: clean (${why})`,
        )
      }
    },
  )

  it('says nothing banned in any authored bubble string', () => {
    for (const { where, text } of bubbleLearnerCopy()) {
      for (const { pattern, why } of [...BANNED, ...RETIRED_HEDGES]) {
        const match = text.match(pattern)
        expect(`${where}: ${match?.[0] ?? 'clean'} (${why})`).toBe(`${where}: clean (${why})`)
      }
    }
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

describe('the resumption is taught from the register', () => {
  const sourceIds = new Set<string>([
    ...cardiohelpEvidence.map((source) => source.id),
    ...ECMO_NUMBER_ONLY_SOURCES.map((source) => source.id),
  ])

  it('gives the order: source fixed, drainage clamp, reset, return clamp last', () => {
    const conditions = ECMO_AIR_RESUME.conditions
    const index = (pattern: RegExp) => conditions.findIndex((line) => pattern.test(line))
    const cleared = index(/source of the air is fixed.*free of bubbles/i)
    const drainage = index(/open the drainage clamp/i)
    const reset = index(/Bubbles, then Reset, then Confirm/i)
    const returnClamp = index(/open the return clamp last/i)
    expect(cleared).toBe(0)
    expect(drainage).toBeGreaterThan(cleared)
    expect(reset).toBeGreaterThan(drainage)
    expect(returnClamp).toBeGreaterThan(reset)
    expect(returnClamp).toBe(conditions.length - 1)
    // The clamp-release pressure is read from the register, not typed.
    expect(conditions[returnClamp]).toContain(ECMO_NUMBERS.value('clamp-release-pressure'))
    expect(ECMO_AIR_RESUME_SENTENCE).toContain(ECMO_NUMBERS.value('clamp-release-pressure'))
    expect(ECMO_AIR_RESUME_SENTENCE).toMatch(
      /source is fixed.*open the drainage clamp.*reset the bubble stop.*return clamp last/i,
    )
  })

  it('cites registered sources for the resumption and for the first moves', () => {
    expect(ECMO_AIR_RESUME.sources.length).toBeGreaterThan(0)
    for (const source of [...ECMO_AIR_RESUME.sources, ECMO_AIR_FIRST_MOVES.source]) {
      expect({ id: source.sourceId, registered: sourceIds.has(source.sourceId) }).toEqual({
        id: source.sourceId,
        registered: true,
      })
      expect(source.locator.trim().length).toBeGreaterThan(0)
    }
  })

  it.each(BUBBLE_SCENARIOS)('%s teaches the resume step from the register', (scenarioId) => {
    const lesson = cardiohelpLearnLessonByScenarioId.get(scenarioId)
    const resume = lesson?.steps.find((step) =>
      step.actions.some((action) => action.type === 'RESUME_SUPPORT_AFTER_BUBBLE'),
    )
    expect(resume?.actionLabel).toBe(ECMO_AIR_RESUME.label)
    expect(resume?.instruction).toBe(ECMO_AIR_RESUME_SENTENCE)
    // The deferral this step used to carry is gone, and nothing calls a protocol approved.
    expect(resume?.instruction).not.toMatch(/local protocol|approved/i)
    expect(resume?.actionLabel).not.toMatch(/local protocol|approved|reviewed/i)
    // The debrief workflow ends on the same sentence.
    const workflow = cardiohelpScenarioById.get(scenarioId)?.debrief.correctWorkflow ?? []
    expect(workflow.some((line) => line.includes(ECMO_AIR_RESUME_SENTENCE))).toBe(true)
  })

  it.each(BUBBLE_CASES)('%s offers the resume action under the register label', (caseId) => {
    const scenario = clinicalPracticeScenarioById.get(caseId)
    const prefix = caseId.startsWith('va-') ? 'va-' : ''
    const resume = scenario?.clinicalCase?.interventions.find(
      (intervention) => intervention.id === `${prefix}air-resume-support`,
    )
    expect(resume?.label).toBe(ECMO_AIR_RESUME.label)
    expect(resume?.description).toBe(ECMO_AIR_RESUME_SENTENCE)
    expect(
      scenario?.debrief.correctWorkflow.some((line) => line.includes(ECMO_AIR_RESUME_SENTENCE)),
    ).toBe(true)
  })

  it('puts the same label on the bedside control', () => {
    expect(sourceOf('src/features/cardiohelp-ecmo/components/EcmoCircuitControls.tsx')).toMatch(
      /\{ECMO_AIR_RESUME\.label\}/,
    )
  })
})

describe('massive air is keyed on the first moves, in order', () => {
  it('lists a sequence for each mode that starts with the hands, not with a call', () => {
    for (const moves of [ECMO_AIR_FIRST_MOVES.massiveVa, ECMO_AIR_FIRST_MOVES.massiveVv]) {
      expect(moves.length).toBeGreaterThanOrEqual(4)
      const call = moves.findIndex((move) => /call for help/i.test(move))
      // "Call for help" is in the sequence, and it is not the first move.
      expect(call).toBeGreaterThan(0)
      expect(moves.some((move) => /clamp/i.test(move))).toBe(true)
      expect(moves.some((move) => /aspirate/i.test(move))).toBe(true)
    }
    expect(ECMO_AIR_FIRST_MOVES.massiveVa[0]).toMatch(/clamp the circuit and stop the pump/i)
  })

  it.each(BUBBLE_SCENARIOS)('%s keys its prediction on clamping', (scenarioId) => {
    const { item } = requireEcmoLearnPrediction(scenarioId)
    const keyed = item.choices.filter((choice) => item.correctChoiceIds.includes(choice.id))
    expect(keyed.length).toBeGreaterThan(0)
    for (const choice of keyed) {
      expect(choice.label).toMatch(/clamp the (?:arterial )?return limb, then the drainage limb/i)
    }
    // "Call for help" is never the answer on its own: no option is only a call.
    for (const choice of item.choices) {
      expect(choice.label).not.toMatch(/^\s*(?:call|ask|page|escalate)\b[^.;,]*[.]?\s*$/i)
    }
    expect(item.explanation).toMatch(/call for help/i)
    expect(item.explanation).toMatch(/return clamp open last|open the return clamp last/i)
  })

  it.each(BUBBLE_CASES)('%s requires the clamps, not only the call', (caseId) => {
    const scenario = clinicalPracticeScenarioById.get(caseId)
    const prefix = caseId.startsWith('va-') ? 'va-' : ''
    const interventions = scenario?.clinicalCase?.interventions ?? []
    const call = interventions.find((intervention) => /call for help/i.test(intervention.label))
    // The call is offered, it follows isolation in the authored order, and it also does something.
    expect(call).toBeDefined()
    expect(call?.label).toMatch(/;\s*raise patient support/i)
    const order = interventions.map((intervention) => intervention.id)
    expect(order.indexOf(`${prefix}air-clamp-return`)).toBeLessThan(order.indexOf(call?.id ?? ''))
    expect(order.indexOf(`${prefix}air-clamp-drainage`)).toBeLessThan(order.indexOf(call?.id ?? ''))
    expect(scenario?.clinicalCase?.requiredInterventionIds).toEqual(
      expect.arrayContaining([`${prefix}air-clamp-return`, `${prefix}air-clamp-drainage`]),
    )
  })
})
