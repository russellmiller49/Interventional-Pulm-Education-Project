import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { render } from '@testing-library/react'

import { SourcesPanel } from '../components/SourcesPanel'
import { EcmoDrillTeachingPanel } from '../components/teaching/EcmoDrillTeachingPanel'
import { clinicalPracticeScenarioById, clinicalPracticeScenarios } from '../content/clinicalCases'
import { cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
import { clinicalPracticeSupportByScenarioId } from '../content/practiceSupport'
import { cardiohelpScenarioById, cardiohelpScenarios } from '../content/scenarios'
import {
  ECMO_AIR_FIRST_MOVES,
  ECMO_AIR_RESUME,
  ECMO_AIR_RESUME_SENTENCE,
  ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES,
  ECMO_EMERGENCY_DRIVE_SENTENCE,
} from '../content/teachingNumbers'
import { createInitialSimulationState } from '../engine'

/**
 * ECMO-HONESTY-02: the module may defer to local protocol, but never describe it as reviewed.
 *
 * ECMO-03 recorded that nothing in this repository establishes a reviewed or approved local
 * policy for ECMO — no reviewer, no role, no date, no registered document — while the clinical
 * copy said "approved local protocol", "the reviewed local process", "the reviewed exchange
 * process" and similar in 49 places. The clinical instruction behind each of those is sound and
 * is kept; only the status adjective was unsupported, and it is what this suite pins down.
 *
 * Deliberately two checks. The source scan catches a phrase written into a corner nobody renders
 * in a test; the authored-copy scan catches one that reaches a learner through a registry.
 */

const MODULE_ROOT = join(process.cwd(), 'src/features/cardiohelp-ecmo')

/**
 * Wording that asserts a local protocol, process or pathway has been reviewed or approved.
 *
 * Each pattern needs the status word *adjacent to* the policy noun, so a learner reviewing a
 * cannula position, a patient reviewed at the next round, or a source record that denies review
 * ("none recorded", "not a validated bedside method") is not caught by it.
 */
const UNSUPPORTED_STATUS: readonly { readonly pattern: RegExp; readonly why: string }[] = [
  {
    pattern: /\bapproved\s+(?:local|unit|institutional|ECMO)\b/i,
    why: 'claims a local policy was approved',
  },
  {
    pattern:
      /\breviewed\s+(?:local|unit|institutional|emergency|exchange|circuit|configuration|response)\b/i,
    why: 'claims a local policy was reviewed',
  },
  {
    pattern: /\b(?:your|the|a|an|our|its)\s+approved\s+(?:protocol|polic|process|pathway)/i,
    why: 'claims a local policy was approved',
  },
  {
    pattern: /\bapproved\s+protocols?\b/i,
    why: 'claims a local policy was approved',
  },
  {
    pattern: /\bapproved\s+objective\b/i,
    why: 'claims an authored objective was approved',
  },
]

function moduleSourceFiles(): readonly string[] {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        if (entry === '__tests__') continue
        walk(full)
        continue
      }
      if (/\.(ts|tsx)$/.test(entry)) files.push(full)
    }
  }
  walk(MODULE_ROOT)
  return files.sort()
}

/** Every authored string a learner can reach through the case, drill and lesson registries. */
function authoredLearnerCopy(): readonly { readonly where: string; readonly text: string }[] {
  const copy: { where: string; text: string }[] = []
  const push = (where: string, text: string | undefined) => {
    if (text) copy.push({ where, text })
  }

  for (const scenario of cardiohelpScenarios) {
    push(`${scenario.id}.summary`, scenario.summary)
    for (const line of scenario.debrief.correctWorkflow) push(`${scenario.id}.workflow`, line)
    for (const note of scenario.debrief.safetyNotes) push(`${scenario.id}.safetyNote`, note)
    push(`${scenario.id}.diagnosis`, scenario.debrief.diagnosis)
  }

  for (const scenario of clinicalPracticeScenarios) {
    push(`${scenario.id}.summary`, scenario.summary)
    for (const line of scenario.debrief.correctWorkflow) push(`${scenario.id}.workflow`, line)
    for (const note of scenario.debrief.safetyNotes) push(`${scenario.id}.safetyNote`, note)
    const clinicalCase = scenario.clinicalCase
    if (clinicalCase) {
      push(`${scenario.id}.decisionPrompt`, clinicalCase.decisionPrompt)
      push(`${scenario.id}.completionResponse`, clinicalCase.completionResponse)
      for (const objective of clinicalCase.learningObjectives) {
        push(`${scenario.id}.objective`, objective)
      }
      for (const intervention of clinicalCase.interventions) {
        push(`${scenario.id}.${intervention.id}.label`, intervention.label)
        push(`${scenario.id}.${intervention.id}.description`, intervention.description)
        push(`${scenario.id}.${intervention.id}.response`, intervention.response)
        push(
          `${scenario.id}.${intervention.id}.instruction`,
          intervention.simulatorAction?.instruction,
        )
      }
    }
    const support = clinicalPracticeSupportByScenarioId[scenario.id]
    for (const hint of support?.hints ?? []) push(`${scenario.id}.hint`, hint.text)
    const reassessment = support?.reassessment
    if (reassessment) {
      push(`${scenario.id}.reassessment`, reassessment.instruction)
      for (const domain of ['device', 'circuit', 'patient'] as const) {
        for (const option of reassessment[domain].options) {
          push(`${scenario.id}.${domain}.${option.id}.label`, option.label)
          push(`${scenario.id}.${domain}.${option.id}.rationale`, option.rationale)
        }
      }
    }
  }

  for (const lesson of cardiohelpLearnLessonByScenarioId.values()) {
    for (const step of lesson.steps) {
      push(`${lesson.scenarioId}.${step.id}.title`, step.title)
      push(`${lesson.scenarioId}.${step.id}.instruction`, step.instruction)
      push(`${lesson.scenarioId}.${step.id}.rationale`, step.rationale)
      push(`${lesson.scenarioId}.${step.id}.actionLabel`, step.actionLabel)
      for (const response of step.expectedResponse) {
        push(`${lesson.scenarioId}.${step.id}.expectedResponse`, response)
      }
    }
  }

  return copy
}

describe('ECMO never describes a local protocol as reviewed or approved', () => {
  it.each(moduleSourceFiles().map((file) => [file.slice(process.cwd().length + 1), file] as const))(
    '%s',
    (relative, absolute) => {
      const source = readFileSync(absolute, 'utf8')
      for (const { pattern, why } of UNSUPPORTED_STATUS) {
        const match = source.match(pattern)
        expect(`${relative}: ${match?.[0] ?? 'clean'} (${why})`).toBe(`${relative}: clean (${why})`)
      }
    },
  )

  it('says nothing of the kind in any authored case, drill or lesson string', () => {
    const copy = authoredLearnerCopy()
    expect(copy.length).toBeGreaterThan(300)
    for (const { where, text } of copy) {
      for (const { pattern, why } of UNSUPPORTED_STATUS) {
        const match = text.match(pattern)
        expect(`${where}: ${match?.[0] ?? 'clean'} (${why})`).toBe(`${where}: clean (${why})`)
      }
    }
  })
})

/*
  Until the teaching-first redo (docs/teaching-first-rules.md, 2026-10-08) this block required the
  deferrals: resumption "per the current IFU and local protocol", a note that the module "holds no
  copy of that protocol", and a hub row declaring that no local protocol is recorded. Those are
  reversed. What is asserted now is that the teaching which replaced each deferral is present, and
  that none of the wording invents a review or an approval in passing.
*/
describe('the deferrals are replaced by the teaching', () => {
  it.each([
    ['clinical-vv-circuit-air-embolism', 'air-resume-support'],
    ['va-clinical-circuit-air-embolism', 'va-air-resume-support'],
  ] as const)('%s teaches the resumption from the register', (caseId, resumeId) => {
    const scenario = clinicalPracticeScenarioById.get(caseId)
    const resume = scenario?.clinicalCase?.interventions.find(
      (intervention) => intervention.id === resumeId,
    )
    expect(resume).toBeDefined()
    expect(resume?.label).toBe(ECMO_AIR_RESUME.label)
    expect(resume?.description).toBe(ECMO_AIR_RESUME_SENTENCE)
    expect(resume?.description).not.toMatch(/local protocol|does not reproduce or teach/i)
  })

  it.each(['arterial-bubble-stop', 'va-arterial-bubble-stop'] as const)(
    '%s puts the call for help and the backup circuit in its safety notes',
    (scenarioId) => {
      const scenario = cardiohelpScenarioById.get(scenarioId)
      const notes = (scenario?.debrief.safetyNotes ?? []).join(' ')
      expect(notes).toMatch(/call for help and the primed backup circuit/i)
      expect(notes).toMatch(/premature reset/i)
      expect(notes).not.toMatch(/holds no copy of that protocol/i)
    },
  )

  it.each(['clinical-vv-circuit-air-embolism', 'va-clinical-circuit-air-embolism'] as const)(
    '%s teaches the emergency drive on the case debrief',
    (caseId) => {
      const notes = clinicalPracticeScenarioById.get(caseId)?.debrief.safetyNotes ?? []
      expect(notes).toContain(ECMO_EMERGENCY_DRIVE_SENTENCE)
      expect(notes.join(' ')).not.toMatch(/holds no copy of that protocol/i)
    },
  )

  /*
    Rendered rather than read off the module: these boxes sit in the drill teaching column, so the
    render is the evidence that a learner meets the sequence beside the air emergency rather than
    only in the source.
  */
  it('the VV air drill panel shows the first moves and the resume order on screen', () => {
    const state = createInitialSimulationState('arterial-bubble-stop')
    const { container } = render(<EcmoDrillTeachingPanel state={state} />)
    const box = container.querySelector('[data-first-moves="air"]')
    expect(box).not.toBeNull()
    const moves = [...(box?.querySelectorAll('li') ?? [])].map((node) => node.textContent)
    expect(moves).toEqual([...ECMO_AIR_FIRST_MOVES.massiveVv, ...ECMO_AIR_RESUME.conditions])
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/holds no copy of|does not hold a copy of/i)
    expect(text).not.toMatch(/approved|reviewed local/i)
  })

  it('the VA differential-hypoxemia panel shows how it is found and the moves in order', () => {
    const state = createInitialSimulationState('va-differential-hypoxemia')
    const { container } = render(<EcmoDrillTeachingPanel state={state} />)
    const box = container.querySelector('[data-first-moves="differential-hypoxemia"]')
    expect(box).not.toBeNull()
    expect(box?.textContent).toContain(ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES.recognize)
    expect([...(box?.querySelectorAll('li') ?? [])].map((node) => node.textContent)).toEqual([
      ...ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES.moves,
    ])
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/escalation through your local protocol/i)
    expect(text).not.toMatch(/reviewed local protocol/i)
  })

  it.each(['draft', 'published'] as const)(
    'the %s hub carries no local-protocol or review row',
    (publicationStatus) => {
      const { container } = render(<SourcesPanel publicationStatus={publicationStatus} />)
      const terms = [...container.querySelectorAll('dt')].map((node) => node.textContent)
      expect(terms).not.toContain('Local protocol')
      expect(terms).not.toContain('Clinical and device review')
      expect(terms).not.toContain('Publication')
      const text = container.textContent ?? ''
      expect(text).not.toMatch(/none recorded/i)
      expect(text).not.toMatch(/local protocol (?:reviewed|approved)/i)
    },
  )
})
