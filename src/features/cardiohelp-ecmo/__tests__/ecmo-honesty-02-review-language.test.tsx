import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { render } from '@testing-library/react'

import { SourcesPanel } from '../components/SourcesPanel'
import { EcmoDrillTeachingPanel } from '../components/teaching/EcmoDrillTeachingPanel'
import { clinicalPracticeScenarioById, clinicalPracticeScenarios } from '../content/clinicalCases'
import { cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
import { clinicalPracticeSupportByScenarioId } from '../content/practiceSupport'
import { cardiohelpScenarioById, cardiohelpScenarios } from '../content/scenarios'
import { ECMO_LOCAL_PROTOCOL_LINE } from '../content/sourceReviewMetadata'
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

describe('the clinical instruction behind the wording is unchanged', () => {
  it.each([
    ['clinical-vv-circuit-air-embolism', 'air-resume-support'],
    ['va-clinical-circuit-air-embolism', 'va-air-resume-support'],
  ] as const)('%s still defers resumption to the IFU and local protocol', (caseId, resumeId) => {
    const scenario = clinicalPracticeScenarioById.get(caseId)
    const resume = scenario?.clinicalCase?.interventions.find(
      (intervention) => intervention.id === resumeId,
    )
    expect(resume).toBeDefined()
    // Both authorities are still named, and the module still disclaims the choreography.
    expect(resume?.description).toMatch(/instructions for use \(IFU\)/i)
    expect(resume?.description).toMatch(/ECMO air-emergency protocol/i)
    expect(resume?.description).toMatch(/does not reproduce or teach that sequence/i)
    expect(resume?.label).toMatch(/current IFU and local protocol/i)
  })

  it.each(['arterial-bubble-stop', 'va-arterial-bubble-stop'] as const)(
    '%s marks the local-policy dependency as unavailable rather than inventing one',
    (scenarioId) => {
      const scenario = cardiohelpScenarioById.get(scenarioId)
      const notes = (scenario?.debrief.safetyNotes ?? []).join(' ')
      expect(notes).toMatch(/holds no copy of that protocol/i)
      expect(notes).toMatch(/Isolation is taught explicitly/i)
    },
  )

  it.each(['clinical-vv-circuit-air-embolism', 'va-clinical-circuit-air-embolism'] as const)(
    '%s keeps the same dependency note on the case debrief',
    (caseId) => {
      const notes = (clinicalPracticeScenarioById.get(caseId)?.debrief.safetyNotes ?? []).join(' ')
      expect(notes).toMatch(/holds no copy of that protocol/i)
    },
  )

  /*
    Rendered rather than read off the module: these two paragraphs sit in the drill teaching column,
    which the in-app browser pane could not hold in its viewport, so the render is the evidence that
    a learner meets the dependency note beside the air emergency rather than only in the source.
  */
  it('the VV air drill panel says on screen that no local protocol is held here', () => {
    const state = createInitialSimulationState('arterial-bubble-stop')
    const { container } = render(<EcmoDrillTeachingPanel state={state} />)
    const text = container.textContent ?? ''
    expect(text).toMatch(/local protocols differ on it, and this module holds no copy of one/i)
    expect(text).toMatch(/ECMO air-emergency protocol, which this module does not hold a copy of/i)
    expect(text).not.toMatch(/approved|reviewed local/i)
  })

  it('the VA escalation panel points at the learner’s own protocol', () => {
    const state = createInitialSimulationState('va-differential-hypoxemia')
    const { container } = render(<EcmoDrillTeachingPanel state={state} />)
    const text = container.textContent ?? ''
    expect(text).toMatch(/escalation through your local protocol/i)
    expect(text).toMatch(/belongs to the ECMO team under your local protocol/i)
    expect(text).not.toMatch(/reviewed local protocol/i)
  })

  it.each(['draft', 'published'] as const)(
    'the %s hub declares that no local protocol is recorded',
    (publicationStatus) => {
      const { container } = render(<SourcesPanel publicationStatus={publicationStatus} />)
      const text = container.textContent ?? ''
      expect(text).toContain('Local protocol')
      expect(text).toContain(ECMO_LOCAL_PROTOCOL_LINE)
      // The line reports an absence; it must never read as a recorded approval.
      expect(ECMO_LOCAL_PROTOCOL_LINE).toMatch(/^None recorded\./)
      expect(text).not.toMatch(/local protocol (?:reviewed|approved)/i)
    },
  )
})
