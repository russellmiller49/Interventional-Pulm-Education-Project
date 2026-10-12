/**
 * MCS-PRE-REVIEW-04 — self-paced teaching, sources and flow, through the real host and workbench.
 *
 * The paths a self-paced learner actually takes: answer nothing and keep going, answer wrongly and
 * read why, read the explanation first, open the reflection's worked response, skip everything and
 * still reach a recap. Each test checks that nothing is required, nothing is counted and nothing
 * is stored beyond location, and that the simulator's own controls still work.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)
jest.mock('../components/EcmoCannulationPreview', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').ecmoPreviewModule(),
)
jest.mock('../components/ImpellaVariantPreview', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').impellaPreviewModule(),
)

import { McsHub } from '../components/McsHub'
import { McsWorkbench } from '../components/McsWorkbench'
import { PanelSection, TextEquivalent } from '../components/teaching/shared'
import { mcsCasePredictionReasoning } from '../content/casePredictionReasoning'
import { mcsExplainReflection } from '../content/explainReflections'
import { MCS_HUB_OBJECTIVES } from '../content/hubObjectives'
import { mcsCapstoneScenarios, mcsPracticeScenarios } from '../content/scenarios'
import { buildMcsStageLesson, mcsStageLessonIds } from '../content/stageLessons'
import { mcsStepHint } from '../content/stepHints'
import {
  answerIdentification,
  completeIntroductorySteps,
  currentStepId,
  mountSection,
  nowCard,
  nowStatus,
  performAction,
  setupMcsStage,
  storedLessonIds,
  teardownMcsStage,
} from '../test-support/mcsStage'

const PROGRESS_KEY = 'interventionalpulm:mcs-progress:v1'
const SCORE_LANGUAGE =
  /\b\d+\s+of\s+\d+\s+(correct|answered|predictions)|\bscore\b|\bpercent correct\b|first[- ]attempt|\bpassed?\b|\bfailed\b|competen/i

beforeEach(() => setupMcsStage())
afterEach(() => {
  cleanup()
  teardownMcsStage()
})

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function stageText(): string {
  return document.querySelector('[data-mcs-stage]')?.textContent ?? ''
}

/** The envelope is `{ version, selfPaced }`; everything this module stores is under `selfPaced`. */
function storedEnvelope(): {
  readonly top: readonly string[]
  readonly selfPaced: readonly string[]
} {
  const raw = window.localStorage.getItem(PROGRESS_KEY)
  if (!raw) return { top: [], selfPaced: [] }
  const parsed = JSON.parse(raw) as { selfPaced?: Record<string, unknown> }
  return {
    top: Object.keys(parsed).sort(),
    selfPaced: Object.keys(parsed.selfPaced ?? {}).sort(),
  }
}

function goToKind(sectionId: string, kind: string) {
  const lesson = buildMcsStageLesson(sectionId)
  const target = lesson.steps.find((step) => step.interaction.kind === kind)
  if (!target) throw new Error(`${sectionId} has no ${kind} step`)
  for (let guard = 0; guard < 40 && currentStepId() !== target.id; guard += 1) {
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-step-bar-continue]')!)
  }
  expect(currentStepId()).toBe(target.id)
  return target
}

describe('F02 — the hub', () => {
  it('leads with the audience, the objectives, one way in and an optional refresher', async () => {
    render(<McsHub />)
    await settle()
    expect(document.querySelector('[data-hub-audience]')).toHaveTextContent(/adult-ICU clinicians/)
    const objectives = document.querySelectorAll('[data-hub-objective]')
    expect(objectives).toHaveLength(MCS_HUB_OBJECTIVES.length)
    for (const objective of objectives) {
      expect(objective.querySelectorAll('a').length).toBeGreaterThan(0)
    }
    const start = document.querySelector<HTMLAnchorElement>('[data-mcs-continue]')!
    expect(start).toHaveTextContent(/^Start — /)
    expect(start.getAttribute('href')).toMatch(/learn\?lesson=mcs-foundations-signals/)

    const refresher = document.querySelector('[data-hub-refresher]')!
    expect(refresher).toHaveTextContent(/Optional refresher/)
    expect(refresher).toHaveTextContent(/not required/)
    expect(within(refresher as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      '/icu-hemodynamics',
    )
    // The refresher is a link, not a gate: Start does not route through it.
    expect(start.getAttribute('href')).not.toMatch(/hemodynamics/)
    expect(document.querySelector('[data-hub-time-note]')).toHaveTextContent(
      /Minutes are estimates for the main path/,
    )
  })

  it('resumes a returning learner without resetting anything', async () => {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        version: 1,
        selfPaced: {
          visitedLessonIds: ['mcs-foundations-signals', 'iabp-timing-triggering'],
          visitedCaseIds: [],
          lastActivityId: 'iabp-timing-triggering',
          lastSection: 'learn',
          lastDevice: 'iabp',
          lastPhase: 'predict',
          locationUpdatedAt: new Date('2026-10-01T12:00:00.000Z').toISOString(),
        },
      }),
    )
    const before = window.localStorage.getItem(PROGRESS_KEY)
    render(<McsHub />)
    await settle()
    expect(document.querySelector('[data-mcs-continue]')).toHaveTextContent(/^Resume — /)
    expect(window.localStorage.getItem(PROGRESS_KEY)).toBe(before)
  })

  it('states that this is a teaching simulator after the pathway, with no review status', async () => {
    render(<McsHub />)
    await settle()
    const reviewer = document.querySelector<HTMLElement>('[data-review-governance]')!
    expect(reviewer).toHaveTextContent(/This is a teaching simulator\./)
    expect(reviewer).not.toHaveTextContent(/pending clinical review|NOT REVIEWED/i)
    expect(document.querySelector('[data-reviewer-layer]')).toBeNull()
    // It follows the reference material rather than standing between the hero and the pathway.
    const pathway = document.querySelector('#mcs-hub-pathway')!
    expect(
      pathway.compareDocumentPosition(reviewer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(document.querySelector('[data-reference="glossary"] [data-naming-table]')).not.toBeNull()
  })
})

describe('the no-answer and skip-all paths', () => {
  it.each(mcsStageLessonIds)(
    '%s can be read end to end without answering, and ends on a recap that counts nothing',
    (sectionId) => {
      mountSection(sectionId)
      const lesson = buildMcsStageLesson(sectionId)
      const last = lesson.steps[lesson.steps.length - 1]
      for (let guard = 0; guard < 40 && currentStepId() !== last.id; guard += 1) {
        const button = document.querySelector<HTMLButtonElement>('[data-step-bar-continue]')!
        expect(button).toBeEnabled()
        fireEvent.click(button)
      }
      expect(currentStepId()).toBe(last.id)
      expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0)

      const recap = document.querySelector<HTMLElement>('[data-section-recap]')!
      expect(recap).not.toBeNull()
      expect(recap).toHaveTextContent(lesson.spec.objective)
      expect(recap.querySelectorAll('[data-recap-distinctions] li')).toHaveLength(3)
      expect(recap.querySelector('[data-recap-limit]')).toHaveTextContent(
        lesson.contract.whatThisDoesNotEstablish,
      )
      expect(recap.querySelectorAll('[data-recap-step]')).toHaveLength(lesson.steps.length)
      expect(recap.textContent).not.toMatch(SCORE_LANGUAGE)
      expect(stageText()).not.toMatch(SCORE_LANGUAGE)

      // Only location and the visit are stored: no answer, action, count or free text.
      expect(storedEnvelope().top).toEqual(['selfPaced', 'version'])
      expect(storedEnvelope().selfPaced).toEqual([
        'lastActivityId',
        'lastDevice',
        'lastPhase',
        'lastSection',
        'locationUpdatedAt',
        'visitedCaseIds',
        'visitedLessonIds',
      ])
      // The visit is a location aid; no completion is recorded for a section read by skipping.
      const stored = JSON.parse(window.localStorage.getItem(PROGRESS_KEY)!) as {
        selfPaced: { visitedLessonIds: readonly string[] }
      }
      expect(stored.selfPaced.visitedLessonIds).toEqual([sectionId])
      expect(storedLessonIds()).toEqual([])
      expect(global.fetch).not.toHaveBeenCalled()
    },
  )

  it('lets the recap take a learner back to any step', () => {
    const sectionId = 'iabp-efficacy-limits'
    mountSection(sectionId)
    const lesson = goToKind(sectionId, 'transfer') && buildMcsStageLesson(sectionId)
    const explain = lesson.steps.find((step) => step.interaction.kind === 'explain')!
    fireEvent.click(document.querySelector<HTMLElement>(`[data-recap-step="${explain.id}"]`)!)
    expect(currentStepId()).toBe(explain.id)
  })
})

describe('F11 — Hint, Help, Try again and the reflection', () => {
  it('opens this item’s nudge under Hint, and the instruction under Help', () => {
    const sectionId = 'mcs-foundations-signals'
    mountSection(sectionId)
    const step = goToKind(sectionId, 'identify')

    fireEvent.click(within(nowCard()).getByRole('button', { name: 'Hint' }))
    const hintDialog = screen.getByRole('dialog', { name: 'Hint' })
    expect(hintDialog).toHaveTextContent(mcsStepHint(sectionId, 'identify')!)
    expect(hintDialog).not.toHaveTextContent(step.instruction)
    fireEvent.click(within(hintDialog).getByRole('button', { name: /close/i }))

    fireEvent.click(screen.getByRole('button', { name: /what do i do now|help/i }))
    const helpDialog = screen.getByRole('dialog', { name: 'What do I do now?' })
    expect(helpDialog).toHaveTextContent(step.instruction)
    expect(helpDialog).not.toHaveTextContent(mcsStepHint(sectionId, 'identify')!)
  })

  it('offers Try again only once there is an answer to try again', () => {
    const sectionId = 'mcs-foundations-signals'
    mountSection(sectionId)
    completeIntroductorySteps(sectionId)
    expect(within(nowCard()).queryByRole('button', { name: 'Try again' })).toBeNull()

    answerIdentification(sectionId, 'wrong')
    const feedback = document.querySelector('[data-identify-feedback]')!
    expect(feedback).toHaveAttribute('data-verdict-outcome', 'not-correct')
    expect(feedback).toHaveTextContent(/What holds:/)
    expect(document.querySelector('[data-try-again-note]')).toHaveTextContent(
      /clears your answer to this question only/i,
    )

    fireEvent.click(within(nowCard()).getByRole('button', { name: 'Try again' }))
    expect(document.querySelector('[data-identify-feedback]')).toBeNull()
    expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0)
    expect(within(nowCard()).queryByRole('button', { name: 'Try again' })).toBeNull()
    // Nothing about the wrong answer or the retry was stored.
    expect(window.localStorage.getItem(PROGRESS_KEY)).not.toMatch(/organs-perfused|retry|attempt/)
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-step-bar-continue]')!)
    expect(currentStepId()).toBe(`${sectionId}-predict`)
  })

  it('lets a learner read the explanation first and still answer or skip', () => {
    const sectionId = 'mcs-foundations-signals'
    mountSection(sectionId)
    completeIntroductorySteps(sectionId)
    fireEvent.click(within(nowCard()).getByRole('button', { name: 'Show explanation' }))
    expect(document.querySelector('[data-provided-explanation]')).toHaveTextContent(
      /does not submit an answer/,
    )
    expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0)
    expect(document.querySelector('[data-identify-feedback]')).toBeNull()
    for (const radio of document.querySelectorAll<HTMLInputElement>(
      'fieldset[data-prediction-choices] input[type="radio"]',
    )) {
      expect(radio.closest('fieldset')).not.toBeDisabled()
    }
    answerIdentification(sectionId)
    expect(document.querySelector('[data-identify-feedback]')).toHaveAttribute(
      'data-verdict-outcome',
      'correct',
    )
  })

  it.each(mcsStageLessonIds)(
    '%s: the Explain question is an optional reflection with a worked response and no text box',
    (sectionId) => {
      mountSection(sectionId)
      const step = goToKind(sectionId, 'explain')
      const lesson = buildMcsStageLesson(sectionId)
      const reflection = document.querySelector<HTMLElement>('[data-optional-reflection]')!
      expect(reflection).toHaveTextContent(/Optional reflection/i)
      expect(reflection.querySelector('[data-reflection-prompt]')).toHaveTextContent(
        lesson.contract.reassessmentPrompt,
      )
      const worked = reflection.querySelector<HTMLDetailsElement>('[data-worked-response]')!
      expect(worked.open).toBe(false)
      for (const line of mcsExplainReflection(sectionId).workedResponse) {
        expect(worked).toHaveTextContent(line)
      }
      // No typed response anywhere on the stage, so nothing to persist and nothing claimed saved.
      const stage = document.querySelector('[data-mcs-stage]')!
      expect(stage.querySelectorAll('textarea, input[type="text"]')).toHaveLength(0)
      expect(stageText()).not.toMatch(/response saved|answer saved/i)
      expect(nowStatus()).toMatch(/Nothing is typed or saved/)

      // The card's own instruction is the step's work, not the unanswerable question.
      expect(nowCard().querySelector('h2 + p')).toHaveTextContent(step.instruction)
      expect(within(nowCard()).queryByRole('button', { name: 'Try again' })).toBeNull()
      expect(within(nowCard()).queryByRole('button', { name: 'Show explanation' })).toBeNull()
      const hasSort = step.interaction.kind === 'explain' && Boolean(step.interaction.sort)
      expect(Boolean(within(nowCard()).queryByRole('button', { name: 'Hint' }))).toBe(hasSort)
    },
  )
})

describe('F07 — a worked explanation is labelled as one', () => {
  it('says the explanation is on the page before the optional question', () => {
    const sectionId = 'mcs-foundations-signals'
    mountSection(sectionId)
    completeIntroductorySteps(sectionId)
    expect(document.querySelector('[data-worked-explanation-label]')).toHaveTextContent(
      /Worked explanation · open before, during or after the optional question/,
    )
    expect(nowStatus()).toMatch(/worked explanation is already on this page/)
    expect(nowStatus()).toMatch(/nothing is counted/)
    expect(stageText()).not.toMatch(/covered until you commit|appears after submission/)
  })
})

describe('F13 and F15 — the three flow lines, as arithmetic, and the sort under its own name', () => {
  it('prints device, native and effective deltas that close, from the captured records', () => {
    const sectionId = 'mcs-foundations-mechanisms'
    mountSection(sectionId)
    goToKind(sectionId, 'action')
    expect(document.querySelector('[data-flow-arithmetic]')).toHaveAttribute(
      'data-flow-arithmetic',
      'awaiting',
    )
    performAction(sectionId)
    const arithmetic = document.querySelector<HTMLElement>('[data-flow-arithmetic="captured"]')!
    for (const device of ['impella', 'lvad']) {
      const row = arithmetic.querySelector<HTMLElement>(
        `[data-flow-arithmetic-device="${device}"]`,
      )!
      const value = (name: string) =>
        Number(row.querySelector(`[data-delta="${name}"]`)!.textContent!.replace('−', '-'))
      expect(value('device')).toBeGreaterThan(0)
      expect(value('native')).toBeLessThan(0)
      expect(value('effective')).toBeGreaterThan(0)
      // Effective rises by less than the pump number, and the three close to the hundredth.
      expect(value('effective')).toBeLessThan(value('device'))
      expect(Math.abs(value('device') + value('native') - value('effective'))).toBeLessThan(0.011)
      expect(row).toHaveTextContent(/rose by less than the pump number/)
    }
    // The table still carries the three lines as three separate rows.
    for (const metric of ['nativeFlowLMin', 'deviceFlowLMin', 'effectiveSystemicFlowLMin']) {
      expect(document.querySelector(`[data-comparison-metric="${metric}"]`)).not.toBeNull()
    }
    expect(stageText()).not.toMatch(/does not move by the size of the device number/)
    expect(stageText()).not.toMatch(/mcs-reference-patient-v1\./)
  })

  it('heads the sort with the sort, and keeps the flow question as the reflection beneath it', () => {
    const sectionId = 'mcs-foundations-mechanisms'
    mountSection(sectionId)
    goToKind(sectionId, 'explain')
    expect(nowCard().querySelector('h2')).toHaveTextContent(/What can be set/)
    expect(nowCard().querySelector('h2 + p')).toHaveTextContent(/^Sort each item/)
    expect(document.querySelector('[data-control-panel-sort]')).not.toBeNull()
    const reflection = document.querySelector('[data-optional-reflection]')!
    expect(reflection).toHaveTextContent(/native contribution fell by the same amount/)
    expect(
      document.querySelector('[data-control-panel-sort]')!.compareDocumentPosition(reflection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe('F42 — the glossary from inside a lesson', () => {
  it('opens over the step and returns to it with the answer and the model untouched', () => {
    const sectionId = 'mcs-foundations-signals'
    mountSection(sectionId)
    completeIntroductorySteps(sectionId)
    const first = document.querySelector<HTMLInputElement>(
      'fieldset[data-prediction-choices] input[type="radio"]',
    )!
    fireEvent.click(first)
    const identity = document.querySelector('[data-session-identity]')!.textContent
    const step = currentStepId()

    fireEvent.click(screen.getByRole('button', { name: 'Glossary' }))
    const dialog = screen.getByRole('dialog', { name: 'Glossary' })
    expect(dialog.querySelectorAll('[data-term-id]')).toHaveLength(8)
    expect(dialog.querySelector('[data-glossary-abbreviations]')).toHaveTextContent(/PAPi/)
    expect(dialog.querySelector('[data-naming-row="impella-rp"]')).toHaveTextContent(/RP Flex/)
    expect(dialog.querySelector('[data-naming-row="lvad"]')).toHaveTextContent(
      /controller works as the HeartMate 3 controller does/,
    )
    fireEvent.click(within(dialog).getByRole('button', { name: /close/i }))

    expect(currentStepId()).toBe(step)
    expect(first.checked).toBe(true)
    expect(document.querySelector('[data-session-identity]')!.textContent).toBe(identity)
  })

  it('is on every step of every section', () => {
    for (const sectionId of mcsStageLessonIds) {
      const view = mountSection(sectionId)
      expect(document.querySelectorAll('[data-glossary-trigger]')).toHaveLength(1)
      view.unmount()
    }
  })
})

describe('F06, F30 and F39 — progressive disclosure that everyone can open', () => {
  it('folds a text equivalent behind “In words” instead of hiding it from sighted readers', () => {
    render(<TextEquivalent>Mean pressure reads 76 mm Hg.</TextEquivalent>)
    const details = document.querySelector<HTMLDetailsElement>('[data-text-equivalent]')!
    expect(details.tagName).toBe('DETAILS')
    expect(details.open).toBe(false)
    expect(within(details).getByText('In words').tagName).toBe('SUMMARY')
    expect(details).toHaveTextContent('Mean pressure reads 76 mm Hg.')
    // Not clipped, not aria-hidden: a native disclosure any reader can open.
    expect(details.className).not.toMatch(/sr-only|visually/)
    expect(details.closest('[aria-hidden="true"]')).toBeNull()
  })

  it('folds a reference panel section behind its own heading and leaves a working one open', () => {
    render(
      <>
        <PanelSection title="Scaffold" id="p04-open">
          <p>worked from</p>
        </PanelSection>
        <PanelSection title="Lookup" id="p04-ref" reference>
          <p>looked up</p>
        </PanelSection>
      </>,
    )
    expect(document.querySelector('[data-panel-section="p04-open"]')!.tagName).toBe('SECTION')
    const reference = document.querySelector<HTMLDetailsElement>('[data-panel-section="p04-ref"]')!
    expect(reference.tagName).toBe('DETAILS')
    expect(reference.open).toBe(false)
    expect(within(reference).getByRole('heading', { name: 'Lookup' })).toBeInTheDocument()
    expect(reference).toHaveTextContent('looked up')
  })

  it('keeps Section 9’s seven-question scaffold open and folds the four lookup blocks around it', () => {
    mountSection('mcs-device-selection-integration')
    const open = (id: string) => {
      const section = document.querySelector(`[data-panel-section="${id}"]`)!
      return section.tagName === 'SECTION' || (section as HTMLDetailsElement).open
    }
    expect(open('integration-congestion')).toBe(true)
    expect(open('integration-questions')).toBe(true)
    expect(document.querySelector('[data-common-model-answers]')).not.toBeNull()
    for (const id of [
      'integration-congestion-evidence',
      'integration-flow',
      'integration-guides',
      'integration-strategy',
    ]) {
      expect(open(id)).toBe(false)
    }
    // What to read the pattern with stays in the open with the open block.
    expect(document.querySelector('[data-congestion-reconcile]')!.closest('details')).toBeNull()
  })

  it('draws the ladder with one number per rung and organ response as the top', () => {
    mountSection('mcs-foundations-signals')
    goToKind('mcs-foundations-signals', 'walk')
    const ladder = document.querySelector<HTMLElement>('[data-causal-ladder]')!
    expect(ladder.style.listStyle).toBe('none')
    expect(
      [...ladder.querySelectorAll(':scope > li > p:first-child')].map((node) => node.textContent),
    ).toEqual([
      '1. Pressure',
      '2. Flow — three separate lines',
      '3. Oxygen delivery',
      '4. Organ response',
    ])
    expect(document.querySelector('[data-ladder-orientation]')).toHaveTextContent(
      /pressure is the first rung and organ response is the top/,
    )
    expect(document.querySelector('[data-ladder-rung="organ-response"]')).toHaveTextContent(
      /The top rung/,
    )
    // The three flow lines are still three lines.
    expect(
      document.querySelectorAll('[data-ladder-rung="flow"] [data-flow-line]').length,
    ).toBeGreaterThanOrEqual(3)
  })

  it('shows the ladder on the first stop of the walk and folds it on the stops after', () => {
    mountSection('mcs-foundations-signals')
    goToKind('mcs-foundations-signals', 'walk')
    const panelBlock = () =>
      document.querySelector<HTMLElement>('[data-teaching-block="live-panel"]')!
    expect(panelBlock().closest('details')).toBeNull()
    fireEvent.click(within(nowCard()).getByRole('button', { name: 'Next stop' }))
    const folded = panelBlock().closest<HTMLDetailsElement>('details')
    expect(folded).not.toBeNull()
    expect(folded!.open).toBe(false)
  })
})

describe('F18 — an optional clean timing view that hides no alarm', () => {
  it('hides the landmark letters on request and brings them back at once', () => {
    const sectionId = 'iabp-timing-triggering'
    mountSection(sectionId)
    goToKind(sectionId, 'identify')
    const letters = () => document.querySelectorAll('[data-iabp-landmark]').length
    const alarm = () => document.querySelector('[data-context-strip], [data-stage-alarm]')
    expect(letters()).toBeGreaterThan(0)
    const alarmBefore = stageText().includes('Inflation before aortic-valve closure')
    expect(alarmBefore).toBe(true)

    const toggle = screen.getByRole('checkbox', { name: /Optional clean view/ })
    fireEvent.click(toggle)
    expect(letters()).toBe(0)
    expect(document.querySelector('[data-timing-clean-view]')).toHaveTextContent(
      /alarm and the balloon band stay on screen/,
    )
    // The model's alarm is still named: nothing was withheld to make the question harder.
    expect(stageText()).toContain('Inflation before aortic-valve closure')
    expect(alarm).toBeDefined()

    fireEvent.click(toggle)
    expect(letters()).toBeGreaterThan(0)
  })
})

describe('F36 — Mechanism Studio is an open sandbox on the reference patient', () => {
  it('says so, drops the stage stepper scope, and keeps every control working', async () => {
    render(<McsWorkbench section="practice" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Explore mechanisms' }))
    await settle()

    const scope = document.querySelector('[data-mcs-workbench-scope]')!
    expect(scope).toHaveAttribute('data-mcs-studio', 'true')
    const studio = document.querySelector<HTMLElement>('[data-mechanism-studio]')!
    expect(studio).toHaveTextContent(/An open sandbox on the reference patient/)
    expect(studio).toHaveTextContent(/There is no case to solve and nothing here is recorded/)
    expect(document.body.textContent).not.toMatch(/no patient and no debrief/)
    expect(document.querySelector('[data-case-workflow]')).toBeNull()
    expect(document.querySelector('[data-worked-explanation]')).toBeNull()
    expect(document.body.textContent).toMatch(/None\. Nothing in the Studio is a task/)

    // An ordinary simulator control still acts on the model.
    const preload = screen.getByRole('slider', { name: 'Preload' }) as HTMLInputElement
    const before = preload.value
    fireEvent.change(preload, { target: { value: '70' } })
    expect((screen.getByRole('slider', { name: 'Preload' }) as HTMLInputElement).value).not.toBe(
      before,
    )
    // Nothing is stored for the sandbox: no visit, no answer, no location.
    expect(window.localStorage.getItem(PROGRESS_KEY)).toBeNull()
  })

  it('keeps the stepper scope off whenever a case is loaded', async () => {
    render(<McsWorkbench section="practice" initialActivityId="IABP-01" />)
    await settle()
    expect(document.querySelector('[data-mcs-workbench-scope]')).not.toHaveAttribute(
      'data-mcs-studio',
    )
  })
})

describe('F31, F32 and F33 — a case, by its own description', () => {
  const scenarios = [...mcsPracticeScenarios, ...mcsCapstoneScenarios]

  it.each(scenarios)(
    '$id: reasoning for every option, with no verdict total and no stored answer',
    async (scenario) => {
      render(
        <McsWorkbench
          section={scenario.kind === 'capstone' ? 'assess' : 'practice'}
          initialActivityId={scenario.id}
        />,
      )
      await settle()
      expect(document.querySelector('[data-case-kind]')).toHaveTextContent(/worked teaching case/i)
      expect(screen.queryByRole('button', { name: 'Try prediction again' })).toBeNull()

      const wrong = scenario.predictionOptions.find(
        (option) => option.id !== scenario.correctPredictionId,
      )!
      fireEvent.click(screen.getByRole('radio', { name: wrong.label }))
      fireEvent.click(screen.getByRole('button', { name: 'Compare prediction' }))

      const reasoning = document.querySelector<HTMLElement>('[data-prediction-reasoning-list]')!
      expect(reasoning).toHaveTextContent(`Your prediction: ${wrong.label}`)
      const selected = reasoning.querySelector(`[data-prediction-reasoning="${wrong.id}"]`)!
      expect(selected).toHaveAttribute('data-fits', 'false')
      expect(selected).toHaveTextContent('Why this does not fit this patient')
      expect(selected).toHaveTextContent(mcsCasePredictionReasoning(scenario.id, wrong.id)!)
      for (const option of scenario.predictionOptions) {
        expect(reasoning).toHaveTextContent(mcsCasePredictionReasoning(scenario.id, option.id)!)
      }
      expect(
        reasoning.querySelector(`[data-prediction-reasoning="${scenario.correctPredictionId}"]`),
      ).toHaveTextContent('Why this fits this patient')
      expect(reasoning.textContent).not.toMatch(SCORE_LANGUAGE)

      // Retry is offered now, and clears the answer without touching the model.
      fireEvent.click(screen.getByRole('button', { name: 'Try prediction again' }))
      expect(document.querySelector('[data-prediction-reasoning-list]')).toBeNull()
      expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0)

      // The worked explanation needs no answer and still carries every option's reasoning.
      fireEvent.click(screen.getByRole('button', { name: 'Open worked explanation' }))
      const explanation = document.querySelector<HTMLElement>('[data-worked-explanation]')!
      expect(explanation).toHaveTextContent('No prediction submitted.')
      expect(explanation.querySelectorAll('[data-option-reasoning]')).toHaveLength(
        scenario.predictionOptions.length,
      )
      expect(explanation.textContent).not.toMatch(SCORE_LANGUAGE)
      // Every condition still prints its class; held conditions are still held.
      expect(explanation.querySelectorAll('[data-condition-class]')).toHaveLength(
        scenario.successCriteria.length,
      )
      const raw = window.localStorage.getItem(PROGRESS_KEY) ?? ''
      expect(raw).not.toContain(wrong.id)
      expect(global.fetch).not.toHaveBeenCalled()
    },
  )

  it('names the actions of a run and keeps the stored ids as attributes only', async () => {
    render(<McsWorkbench section="practice" initialActivityId="IMP-01" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Filling & RV' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Preload' }), { target: { value: '90' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open worked explanation' }))
    const run = document.querySelector<HTMLElement>('[data-debrief-run]')!
    const rows = [...run.querySelectorAll<HTMLElement>('[data-run-actions] li')]
    expect(rows.map((row) => row.getAttribute('data-action-id'))).toEqual([
      'inspect:preload',
      'patient:set-preload',
    ])
    expect(rows.map((row) => row.textContent)).toEqual([
      'Read the filling pressures and right-ventricular readings',
      'Changed simulated preload',
    ])
    expect(run.querySelector('[data-run-actions]')!.textContent).not.toMatch(/[a-z]:[a-z]/)
  })

  it('keeps the atrial-fibrillation limit where it was, without packet ids or review status', async () => {
    render(<McsWorkbench section="practice" initialActivityId="IABP-02" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Open worked explanation' }))
    const held = document.querySelector('[data-condition-held="true"]')!
    expect(held).toHaveTextContent(/Not used as a result/)
    expect(held).not.toHaveTextContent(/MCS-03-05|NOT REVIEWED/)
    expect(document.querySelector('[data-option-reasoning="trigger"]')).toHaveTextContent(
      /rates pressure triggering above ECG triggering, which the supplied Cardiosave material advises against/,
    )
  })

  it('orders a case’s evidence with the opened document first and the synthesis last', async () => {
    render(<McsWorkbench section="practice" initialActivityId="IABP-01" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Evidence' }))
    const text = document.body.textContent ?? ''
    const opened = text.indexOf('CARDIOSAVE Hybrid Operating Instructions')
    const registered = text.indexOf('ISHLT/HFSA Guideline on Acute Mechanical Circulatory Support')
    const synthesis = text.indexOf('Master Hemodynamics and Hemodynamic Monitoring Reference')
    expect(opened).toBeGreaterThan(-1)
    expect(opened).toBeLessThan(registered)
    expect(registered).toBeLessThan(synthesis)
    expect(text).toContain('Authoring provenance — not independent clinical evidence')
  })

  it('lists the sources behind a case’s statements under its worked explanation, with no review status', async () => {
    render(<McsWorkbench section="practice" initialActivityId="IMP-01" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Open worked explanation' }))
    const checks = document.querySelector<HTMLElement>(
      '[data-worked-explanation] [data-claim-source-checks]',
    )!
    expect(checks.querySelector('[data-claim-check="MCS-04-C07"]')).toHaveAttribute(
      'data-claim-disposition',
      'wording-narrowed-to-source',
    )
    expect(checks.querySelector('[data-claim-check-status]')).toBeNull()
    expect(checks).not.toHaveTextContent(/NOT REVIEWED|MCS-04-C\d+/)
    expect(checks).toHaveTextContent(/Printed page 7\.17/)
  })
})

describe('F10 — the section footer says what each source is', () => {
  it('labels every source by class and lists authoring provenance last', () => {
    mountSection('impella-unloading-placement')
    const rows = [...document.querySelectorAll<HTMLElement>('[data-mcs-source-list] li')]
    expect(rows.length).toBeGreaterThan(3)
    const classes = rows.map((row) => row.getAttribute('data-source-class'))
    expect(classes[0]).toBe('primary-clinical-device')
    expect(rows[0]).toHaveAttribute('data-source-id', 'impella-cp-ifu-rev-v-supplied')
    expect(classes[classes.length - 1]).toBe('authoring-provenance')
    const synthesis = rows.find(
      (row) => row.getAttribute('data-source-id') === 'master-hemodynamics-reference',
    )!
    expect(synthesis.querySelector('[data-source-class-label]')).toHaveTextContent(
      /Authoring provenance — not independent clinical evidence/,
    )
    for (const row of rows) {
      expect(row.querySelector('[data-source-class-label]')).toHaveTextContent(
        /Read first-hand|Listed for reference/,
      )
    }
    const checks = document.querySelector('[data-mcs-stage] [data-claim-source-checks]')!
    expect(checks.querySelectorAll('[data-claim-check]')).toHaveLength(3)
  })
})
