/**
 * ECMO-FELLOW-04 — honest self-paced teaching and case flow.
 *
 * The fourth batch of the September 2026 fellow-walkthrough round. It changes what the module says,
 * not what it models: where a sentence promised that an answer was withheld, that a control held a
 * value, that a step stopped, or that a learner carried out a procedure, and the running module did
 * no such thing, the sentence now describes what happens. Nothing was hidden to make an old promise
 * true, and no gate, tally or stored answer was added.
 *
 * Each block names the walkthrough rows it holds. Blocks marked "preserved" are contracts earlier
 * batches (and PR #315) established; they pass on the pre-batch tree by design.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import {
  clinicalLearningItemSchema,
  flaggedGradingCopyTerms,
  flaggedLearnerCopyTerms,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity/clinicalLearningItem'

import { CardiohelpConsole } from '../components/CardiohelpConsole'
import { GasBlenderPanel } from '../components/CircuitAndMonitors'
import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import { ActionPanel, ReassessmentPanel } from '../components/PracticeCasePlayer'
import { EcmoCaseDebrief } from '../components/practice/EcmoCaseDebrief'
import { resolveNowCard } from '../components/practice/nowCard'
import { resolvePracticeStages } from '../components/practice/stages'
import { ECMO_VERDICT_FRAMES } from '../components/shell/EcmoOtherAnswers'
import { SourcesPanel } from '../components/SourcesPanel'
import {
  buildDrillStageLesson,
  resolveGuidedLesson,
} from '../components/stage/adapters/drillStageAdapter'
import { StageTeachingScope } from '../components/stage/StageTeachingScope'
import { BloodFlowVsSweepPanel } from '../components/teaching/BloodFlowVsSweepPanel'
import { CircuitFlowPathPanel } from '../components/teaching/CircuitFlowPathPanel'
import { OxygenDeliveryExplorer } from '../components/teaching/OxygenDeliveryExplorer'
import { PumpPressureZonesPanel } from '../components/teaching/PumpPressureZonesPanel'
import { VvNormalStatePanel } from '../components/teaching/VvNormalStatePanel'
import { WhyExtracorporealSupportPanel } from '../components/teaching/WhyExtracorporealSupportPanel'
import { ecmoSensorSite } from '../content/circuitSegments'
import { pairedCaseForLesson, caseMechanismByCaseId, lessonMechanism } from '../content/curriculum'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { ecmoDeliveryAttribution } from '../content/deliveryAttribution'
import { cardiohelpEvidence } from '../content/evidence'
import { ecmoFoundationLearningItemsFor } from '../content/foundationLearningItems'
import { ecmoFoundationLessonRuntime } from '../content/foundationLessonRuntime'
import { isEcmoFoundationSectionId, ecmoFoundationSections } from '../content/foundationLessons'
import { ecmoFoundationTeachingTasks } from '../content/foundationTeachingTasks'
import { ECMO_INTEGRATED_CASE_SCOPE } from '../content/integratedCaseScope'
import {
  cardiohelpLearnLessonByScenarioId,
  cardiohelpLearnLessons,
  ECMO_PREDICTION_STEP_TITLE,
} from '../content/learnLessons'
import { ecmoLearnPredictions } from '../content/learnPredictionItems'
import { cardiohelpScenarioById } from '../content/scenarios'
import { resolveScenarioReassessment as reassessmentForReview } from '../content/practiceSupport'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { ECMO_MODULE_REVIEW_LINE } from '../content/sourceReviewMetadata'
import {
  createInitialSimulationState,
  createReferenceSimulationState,
  ecmoSimulationReducer,
  selectScenarioOutcome,
} from '../engine'
import { reachFoundationStep } from '../test-support/foundationJourney'
import {
  latestState,
  mountDrill,
  predictionChoice,
  predictionRadios,
  resetStageHarness,
} from '../test-support/learnStageHarness'

const mockReviewPush = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mockReviewPush, replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))
// The one permitted mock: the 3D canvas needs WebGL. Every other surface renders for real.
jest.mock('../components/EcmoCircuit3D', () => ({
  EcmoCircuit3D: () => <div data-testid="ecmo-circuit-3d" />,
}))

const ECMO_ROOT = path.join(process.cwd(), 'src/features/cardiohelp-ecmo')

/** Every authored and rendered source a learner's words come from; tests and the engine excluded. */
function learnerFacingSources(): readonly { readonly file: string; readonly text: string }[] {
  const walk = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) return walk(target)
      return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [target] : []
    })
  return ['content', 'components'].flatMap((folder) =>
    walk(path.join(ECMO_ROOT, folder)).map((file) => ({
      file: path.relative(ECMO_ROOT, file),
      text: readFileSync(file, 'utf8'),
    })),
  )
}

function itemCopy(item: ClinicalLearningItem): string {
  return [
    item.stem,
    item.explanation,
    ...item.choices.flatMap((choice) => [choice.label, choice.rationale]),
  ].join(' ')
}

function pageText(): string {
  return document.body.textContent ?? ''
}

function openStep(stepId: string) {
  const button = document.querySelector<HTMLButtonElement>(`[data-step-id="${stepId}"] button`)
  if (!button) throw new Error(`No task-list row for ${stepId}`)
  fireEvent.click(button)
}

beforeEach(() => {
  resetStageHarness()
  mockReviewPush.mockClear()
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn().mockResolvedValue({ ok: true }),
  })
})

afterEach(cleanup)

/* ------------------------------------------------------------------------------------------ *
 * 1. False exam promises: S2-1, S8-1, S9-1, S9-2, S10-1, S11-1, S12-1, S17-3, VA12-1, VA17-2
 * ------------------------------------------------------------------------------------------ */

describe('a prediction step promises no gate, because there is none', () => {
  const predictionSteps = cardiohelpLearnLessons.map((lesson) => {
    const step = lesson.steps.find((candidate) => candidate.predictionScenarioId !== undefined)
    if (!step) throw new Error(`${lesson.id} has no prediction step`)
    return [lesson.scenarioId, step] as const
  })

  it('covers every drill on both tracks', () => {
    expect(predictionSteps).toHaveLength(20)
  })

  it.each(predictionSteps)(
    '%s says the prediction is optional and the teaching stays',
    (_id, step) => {
      expect(step.title).toBe(ECMO_PREDICTION_STEP_TITLE)
      expect(step.title).toMatch(/^Optional prediction/)
      const copy = `${step.title} ${step.instruction}`
      expect(copy).not.toMatch(/held back/i)
      expect(copy).not.toMatch(/before you act/i)
      expect(copy).not.toMatch(/commit to a prediction/i)
      expect(step.instruction).toMatch(/teaching for this pattern stays on this page/)
      expect(step.instruction).toMatch(/open the explanation without answering/)
      // The action still names what pressing it does; the #315 journeys press it by this name.
      expect(step.actionLabel).toBe('Commit this prediction')
    },
  )

  it('the data-driven drill shows its explanation before any answer, and says so truthfully', async () => {
    const scenarioId = 'afterload-return-obstruction'
    await mountDrill(scenarioId)
    const lesson = buildDrillStageLesson(resolveGuidedLesson(scenarioId), 'vv')
    openStep(lesson.steps[lesson.predictionStepIndex].id)

    expect(screen.getByRole('heading', { name: ECMO_PREDICTION_STEP_TITLE })).toBeInTheDocument()
    // Explanation before the answer: the mechanism and the fitting response are on the page.
    const explain = document.querySelector(`[data-drill-explain="${scenarioId}"]`)
    expect(explain).toHaveTextContent('What explains it')
    expect(explain).toHaveTextContent('The response that fits')
    expect(explain?.closest('details')).toBeNull()
    expect(latestState().scenario.prediction.committed).toBe(false)
    expect(predictionRadios().length).toBeGreaterThan(1)
    expect(pageText()).not.toMatch(/held back until you have chosen/)

    // The explanation path, with no answer and nothing recorded.
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation without answering' }))
    expect(document.querySelector('[data-optional-explanation]')).not.toBeNull()
    expect(latestState().scenario.prediction.committed).toBe(false)
  })

  it('an authored-panel drill keeps its mechanism one disclosure away, with no answer needed', async () => {
    const scenarioId = 'preload-drainage-collapse'
    await mountDrill(scenarioId)
    const lesson = buildDrillStageLesson(resolveGuidedLesson(scenarioId), 'vv')
    openStep(lesson.steps[lesson.predictionStepIndex].id)

    const block = document.querySelector('details[data-stage-block="after-commitment"]')
    expect(block).not.toBeNull()
    expect(block?.querySelector('summary')).toHaveTextContent(
      'What explains it, and the response that fits',
    )
    expect(block?.textContent ?? '').toMatch(/What best explains it/)
    expect(latestState().scenario.prediction.committed).toBe(false)
  })

  it.each(['vv-integration-capstone', 'va-integration-capstone'] as const)(
    '%s: the capstone prediction no longer says "before looking further"',
    (sectionId) => {
      const predict = ecmoFoundationLessonRuntime(sectionId).phases.predict
      const copy = `${predict.objective} ${predict.requiredAction}`
      expect(copy).not.toMatch(/before looking further/i)
      expect(copy).not.toMatch(/then read the comparison/i)
      expect(predict.objective).toMatch(/^Optional prediction/)
      expect(predict.requiredAction).toMatch(/comparison .* stays open on this page/)
      expect(predict.requiredAction).toMatch(/does not advance when you commit/)
    },
  )

  it.each([
    'vv-normal-state',
    'vv-series-physiology',
    'va-normal-state',
    'va-parallel-physiology',
  ] as const)('%s: the prediction instruction describes an optional answer', (sectionId) => {
    const predict = ecmoFoundationLessonRuntime(sectionId).phases.predict
    expect(predict.requiredAction).not.toMatch(/^Commit a prediction/)
    expect(predict.requiredAction).toMatch(/^Optional:/)
    expect(predict.requiredAction).toMatch(/opened without answering/)
  })

  it('the pump-speed prediction no longer asks for an answer "before reading the explanation"', () => {
    const task = ecmoFoundationTeachingTasks['pump-and-pressure-zones'].find(
      (candidate) => candidate.id === 'predict',
    )
    expect(task?.instruction).not.toMatch(/before reading the explanation/i)
    expect(task?.instruction).toMatch(/opened without answering/)
  })
})

describe('S2-1: the map question says what the map shows', () => {
  const task = ecmoFoundationTeachingTasks['circuit-flow-path'].find(
    (candidate) => candidate.id === 'predict',
  )

  it('claims neither a clean map nor a recall from memory', () => {
    expect(task?.title).not.toMatch(/from memory/i)
    expect(task?.instruction).not.toMatch(/omits/i)
    expect(task?.instruction).toMatch(/keeps its pressure labels/)
  })

  it.each(['vv', 'va'] as const)('%s: the labelled map is on screen for that task', (track) => {
    render(<EcmoFoundationLessonActivity sectionId="circuit-flow-path" supportMode={track} />)
    reachFoundationStep('circuit-flow-path', 'predict')
    const svg = document.querySelector('#cardiohelp-diagnostic-view svg')
    // The observations are not hidden to make the question harder: every sensor flag is drawn.
    expect(svg?.querySelector('[data-sensor-flag="pInt"]')).not.toBeNull()
    expect(svg?.querySelector('[data-sensor-flag="pVen"]')).not.toBeNull()
    expect(svg?.querySelector('[data-delta-bracket]')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Locate a measurement on the map' })).toBeVisible()
    expect(pageText()).not.toMatch(/now omits pressure labels/)
    expect(document.querySelector('fieldset[data-prediction-choices]')).not.toBeDisabled()
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 2. Wrong-answer feedback and retry, and unsafe wording that claims no stop: VA6-2
 * ------------------------------------------------------------------------------------------ */

describe('VA6-2: an unsafe answer is called unsafe, and nothing is said to stop', () => {
  it('the module-owned frames never say "Stopping here"', () => {
    for (const frame of Object.values(ECMO_VERDICT_FRAMES)) {
      expect(frame).not.toMatch(/stopping here/i)
    }
    expect(ECMO_VERDICT_FRAMES.unsafe).toBe('This action could harm a real patient.')
  })

  it('a foundation question: unsafe verdict, the lesson continues, the reasoning stays', () => {
    render(<EcmoFoundationLessonActivity sectionId="why-extracorporeal-support" supportMode="vv" />)
    reachFoundationStep('why-extracorporeal-support', 'predict')
    const item = ecmoFoundationLearningItemsFor('why-extracorporeal-support').prediction
    const unsafe = item.choices.find((choice) => choice.plausibility === 'unsafe')
    if (!unsafe) throw new Error('the item has no unsafe choice')
    fireEvent.click(
      document.querySelector<HTMLInputElement>(
        `fieldset[data-prediction-choices] input[value="${unsafe.id}"]`,
      )!,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }))

    const verdict = document.querySelector('[data-verdict]')
    expect(verdict).toHaveTextContent('Not correct, and unsafe.')
    expect(verdict).toHaveTextContent('This action could harm a real patient.')
    expect(verdict?.textContent ?? '').not.toMatch(/stopping here/i)
    // Truthful feedback, with the explanation and the sources still on the card.
    expect(verdict).toHaveTextContent(unsafe.rationale)
    expect(verdict).toHaveTextContent('How to distinguish it')
    // Nothing stopped: the learner can go on, or try again.
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
  })

  it('a drill prediction: unsafe verdict, retry restores the question', async () => {
    const scenarioId = 'afterload-return-obstruction'
    await mountDrill(scenarioId)
    const lesson = buildDrillStageLesson(resolveGuidedLesson(scenarioId), 'vv')
    openStep(lesson.steps[lesson.predictionStepIndex].id)
    fireEvent.click(
      screen.getByRole('radio', { name: predictionChoice(scenarioId, 'unsafe').label }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit this prediction' }))

    const verdict = document.querySelector('[data-answer-verdict]')
    expect(verdict).toHaveAttribute('data-plausibility', 'unsafe')
    expect(verdict).toHaveTextContent('Not correct, and unsafe.')
    expect(verdict).toHaveTextContent('This action could harm a real patient')
    expect(pageText()).not.toMatch(/stopping here/i)
    // The shared card's corrected comparison heading is consumed, not re-implemented.
    expect(verdict).toHaveTextContent('How the other answers compare')

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
    expect(document.querySelector('fieldset[data-prediction-choices]')).not.toBeDisabled()
    expect(predictionRadios().every((radio) => !(radio as HTMLInputElement).checked)).toBe(true)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 3. Vocabulary and context at first relevant use
 * ------------------------------------------------------------------------------------------ */

describe('S1-3, S1-4, S1-6: the first section says only what is on its own page', () => {
  it('S1-3: sweep gas is introduced where it is first named, and the answer is unchanged', () => {
    const attribution = ecmoDeliveryAttribution('why-extracorporeal-support')
    const candidate = attribution?.candidates.find(
      (entry) => entry.id === 'raise-sweep-oxygen-fraction',
    )
    expect(candidate?.label).toMatch(/the gas the external blender sends through the membrane lung/)
    expect(candidate?.label).toMatch(/introduced later, with the control panel/)
    expect(candidate?.componentId).toBe('oxygen-content')
  })

  it('S1-4: consumption is a part of the oxygen balance, not a component of delivery', () => {
    const { prediction } = ecmoFoundationLearningItemsFor('why-extracorporeal-support')
    expect(prediction.explanation).toMatch(/^The oxygen balance has three separable parts\./)
    expect(prediction.explanation).not.toMatch(/Oxygen delivery has three separable components/)
    expect(prediction.explanation).toMatch(/the two together make up oxygen delivery/)
    // The arithmetic and the key did not move.
    expect(prediction.correctChoiceIds).toEqual(['content-and-flow-still-unknown'])
    expect(clinicalLearningItemSchema.safeParse(prediction).success).toBe(true)
  })

  it.each(['vv', 'va'] as const)(
    'S1-6 %s: no sentence points at a circuit "beside you"',
    (track) => {
      const state = createReferenceSimulationState(`${track}-reference`)
      const view = render(
        <>
          <WhyExtracorporealSupportPanel state={state} />
          <OxygenDeliveryExplorer state={state} sourceIds={[]} />
        </>,
      )
      expect(view.container.textContent ?? '').not.toMatch(/beside you/i)
      expect(view.container.textContent ?? '').toMatch(/Supplied teaching values/)
    },
  )

  it('S1-6: the transfer case refers to the earlier case, not to how the section opened', () => {
    const { transfer } = ecmoFoundationLearningItemsFor('why-extracorporeal-support')
    expect(transfer.explanation).not.toMatch(/This section opened with a patient/)
    expect(transfer.explanation).toMatch(/^The earlier case in this section had a patient/)
    expect(transfer.correctChoiceIds).toEqual(['content-via-hemoglobin'])
    expect(clinicalLearningItemSchema.safeParse(transfer).success).toBe(true)
  })
})

describe('S2-7: one reading, named once', () => {
  it('ties the console label to the names the lessons use, and to what it is not', () => {
    const view = render(
      <CircuitFlowPathPanel state={createReferenceSimulationState('vv-reference')} />,
    )
    const note = view.container.querySelector('[data-first-use="venous-line-saturation"]')
    expect(note).toHaveTextContent('SvO₂')
    expect(note).toHaveTextContent('pre-oxygenator')
    expect(note).toHaveTextContent('venous-line')
    expect(note).toHaveTextContent('drainage-line')
    expect(note).toHaveTextContent(
      /not a direct measurement of the patient.s mixed-venous saturation/,
    )
    // Visible teaching, not something folded away.
    expect(note?.closest('details')).toBeNull()
  })
})

describe('S2-8: one symbol for the pressure drop across the membrane', () => {
  it('uses the device symbol everywhere a learner reads it', () => {
    const offenders = learnerFacingSources().filter(
      ({ text }) => text.includes('ΔP') || /\bdelta-p\b/i.test(text),
    )
    expect(offenders.map((entry) => entry.file)).toEqual([])
    expect(ecmoSensorSite('deltaP').deviceLabel).toBe('Δp')
  })

  it('says at first use what the symbol is and how the readout names it', () => {
    const task = ecmoFoundationTeachingTasks['circuit-flow-path'].find(
      (candidate) => candidate.id === 'pressure-sites',
    )
    expect(task?.instruction).toMatch(
      /Δp, the pressure drop the console calculates between pInt and pArt/,
    )
    expect(task?.instruction).toMatch(/Δp trend/)
  })
})

describe('S4-4: the blender setting, and re-drainage, are explained where they are first met', () => {
  // The stage shows this section one teaching block at a time; render the block the task selects.
  function controlPanelBlock(foundationBlock: string): string {
    const view = render(
      <StageTeachingScope
        value={{
          phase: 'recognize',
          predictionCommitted: false,
          stepId: 'blood-flow-versus-sweep-recognize',
          foundationBlock,
        }}
      >
        <BloodFlowVsSweepPanel state={createReferenceSimulationState('vv-reference')} />
      </StageTeachingScope>,
    )
    const text = view.container.textContent ?? ''
    view.unmount()
    return text
  }

  it('the control-panel section separates the blender FiO₂ from the ventilator FiO₂ by name', () => {
    const controls = controlPanelBlock('controls')
    expect(controls).toMatch(/the gas panel in this module labels that control “Sweep-gas FiO₂”/)
    expect(controls).toMatch(
      /describe gas delivered to different sites: the membrane lung and the native lungs/,
    )
    expect(controlPanelBlock('control-pump')).toMatch(
      /Re-drainage is blood the circuit returns and then drains again/,
    )
  })

  it('the gas panel says so beside the control itself', () => {
    const view = render(
      <GasBlenderPanel
        state={createReferenceSimulationState('vv-reference')}
        dispatch={jest.fn()}
        controlsEnabled
      />,
    )
    expect(view.container.textContent ?? '').toMatch(
      /Sweep-gas FiO₂ is the oxygen fraction of the gas sent to the membrane lung, not the ventilator FiO₂/,
    )
  })

  it('the baseline table says what its recirculation row is before the section that teaches it', () => {
    const view = render(
      <VvNormalStatePanel state={createReferenceSimulationState('vv-reference')} />,
    )
    expect(
      view.container.querySelector('[data-first-use="recirculation-adjusted-flow"]'),
    ).toHaveTextContent(/a term the next section teaches/)
  })
})

describe('S7-5: the step uses the name on the console', () => {
  it('says "Alarm list", as the console menu and the device manual do', () => {
    const lessons = readFileSync(path.join(ECMO_ROOT, 'content/learnLessons.ts'), 'utf8')
    expect(lessons).not.toMatch(/Alarm history'|alarm history'/)
    const step = cardiohelpLearnLessonByScenarioId
      .get('startup-sensor-orientation')
      ?.steps.find((candidate) => candidate.id === 'startup-screen-alarm-history')
    expect(step?.title).toBe('Use the alarm list as context')
    expect(step?.instruction).toMatch(/^Open the Alarm list, which keeps the last six alarms\./)
    expect(step?.actionLabel).toBe('Open the Alarm list')
    // The step, its id and what it does are unchanged.
    expect(step?.actions).toEqual([{ type: 'SET_SCREEN', screen: 'alarm-history' }])
  })
})

describe('S12-2: a blood gas is read where the simulator shows one', () => {
  const transferOf = (scenarioId: string) =>
    cardiohelpLearnLessonByScenarioId
      .get(scenarioId)
      ?.steps.find((candidate) => candidate.phase === 'transfer')

  it('the console Blood parameters screen carries no PaCO₂, pH or bicarbonate', () => {
    const state = ecmoSimulationReducer(createInitialSimulationState('compensated-hypercapnia'), {
      type: 'SET_SCREEN',
      screen: 'blood',
    })
    const view = render(<CardiohelpConsole state={state} dispatch={jest.fn()} controlsEnabled />)
    const tiles = view.container.textContent ?? ''
    expect(tiles).toMatch(/SvO₂/)
    expect(tiles).toMatch(/TArt/)
    expect(tiles).not.toMatch(/PaCO₂/)
    expect(tiles).not.toMatch(/HCO₃/)
    expect(screen.queryByText('pH')).toBeNull()
  })

  it('so the step sends the learner to the independent monitor for the acid–base picture', () => {
    const step = transferOf('acute-hypercapnia')
    expect(step?.instruction).not.toMatch(
      /Open Blood parameters and read the whole acid–base picture/,
    )
    expect(step?.instruction).toMatch(
      /read PaCO₂, pH and bicarbonate on the independent bedside monitor and blood gas panel/,
    )
    expect(step?.expectedResponse?.join(' ')).toMatch(/console blood parameters, no blood gas/)
    // Same step, same simulator action: only where the instruction points changed.
    expect(step?.actionLabel).toBe('Open Blood parameters for the new patient')
  })

  it('and the VA counterpart reads the right-arm and femoral samples on the patient monitor', () => {
    const step = transferOf('va-afterload-oxygenator-resistance')
    expect(step?.instruction).toMatch(/on the independent patient monitor, where those are shown/)
    expect(step?.expectedResponse?.join(' ')).not.toMatch(/Post-membrane saturation read beside/)
  })
})

describe('S16-1 / VA16-1: the battery reading carries its typed unit, on both tracks', () => {
  const vv = ecmoLearnPredictions['transport-power-loss'].item
  const va = ecmoLearnPredictions['va-transport-power-loss'].item

  it('VA: the stem states the scenario’s own batteryPercent, with its unit', () => {
    const batteryPercent =
      cardiohelpScenarioById.get('va-transport-power-loss')?.initialState?.device?.batteryPercent
    expect(batteryPercent).toBe(24)
    const reading = va.stem.match(/the battery reserve reads (\d+(?:\.\d+)?) (\w+)/)
    expect(Number(reading?.[1])).toBe(batteryPercent)
    expect(reading?.[2]).toBe('percent')
    // A charge is not a duration: nothing in the item converts one into the other.
    expect(itemCopy(va)).not.toMatch(/\bminutes? (?:of battery|remaining|left)\b/i)
    expect(itemCopy(va)).toMatch(/rather than a duration/)
  })

  it('VA: the exception is one token, in one item, and the shared guard is untouched', () => {
    const copy = itemCopy(va)
    expect(flaggedLearnerCopyTerms(copy)).toEqual(['percent'])
    expect(copy.match(/\bpercent\b/gi)).toHaveLength(1)
    expect(copy).not.toContain('%')
    expect(clinicalLearningItemSchema.safeParse(va).success).toBe(true)
    expect(
      clinicalLearningItemSchema.safeParse({ ...va, learnerCopyOverrideReason: undefined }).success,
    ).toBe(false)
    expect(va.correctChoiceIds).toEqual(['verified-source-with-backup-alongside'])
  })

  it('only the two transport items carry an exception, each its own', () => {
    const overridden = Object.entries(ecmoLearnPredictions)
      .filter(([, prediction]) => prediction.item.learnerCopyOverrideReason !== undefined)
      .map(([id]) => id)
      .sort()
    expect(overridden).toEqual(['transport-power-loss', 'va-transport-power-loss'])
    expect(va.learnerCopyOverrideReason).not.toBe(vv.learnerCopyOverrideReason)
    for (const item of [vv, va]) {
      expect(flaggedLearnerCopyTerms(itemCopy(item))).toEqual(['percent'])
    }
  })

  it('preserved (#315): the venovenous item still reads "24 percent"', () => {
    expect(vv.stem).toContain('a battery reserve reading of 24 percent')
    expect(cardiohelpScenarioById.get('transport-power-loss')?.initialState?.device).toMatchObject({
      batteryPercent: 24,
    })
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 4. Teaching before the optional question; recap; where a section leads next
 * ------------------------------------------------------------------------------------------ */

describe('S5-3, S5-4, VA5-2: the baseline teaching comes before the optional prediction', () => {
  it.each([
    [
      'vv-normal-state',
      'vv',
      'Normal is a stable relationship among signals, not a set of universal numbers.',
    ],
    [
      'va-normal-state',
      'va',
      'A stable circuit display does not by itself establish a stable VA state.',
    ],
  ] as const)('%s: the first task carries the section’s key points', (sectionId, track, point) => {
    render(<EcmoFoundationLessonActivity sectionId={sectionId} supportMode={track} />)
    expect(document.querySelector('[data-ecmo-shell="learn"]')?.getAttribute('data-stage')).toBe(
      `${sectionId}-recognize`,
    )
    const keyPoints = document.querySelector('[data-lesson-key-points]')
    expect(keyPoints).toHaveTextContent(point)
    expect(keyPoints?.closest('details')).toBeNull()
    // Teaching first: no question is on this task.
    expect(document.querySelector('[data-prediction-choices]')).toBeNull()
  })

  it.each(['vv-normal-state', 'va-normal-state'] as const)(
    '%s: a task that offers no decision does not ask for one',
    (sectionId) => {
      const recognize = ecmoFoundationLessonRuntime(sectionId).phases.recognize
      expect(recognize.objective).not.toMatch(/^Decide/)
      expect(recognize.objective).toMatch(/^Read which signals belong/)
    },
  )
})

describe('S1-7: an optional recap built only from points the section already holds', () => {
  it('a recap adds no claim: every line is one of the section’s own key points', () => {
    for (const section of ecmoFoundationSections) {
      for (const point of section.recap ?? []) {
        expect(section.bullets).toContain(point)
      }
    }
  })

  it('only the first section carries one', () => {
    expect(
      ecmoFoundationSections.filter((section) => section.recap).map((section) => section.id),
    ).toEqual(['why-extracorporeal-support'])
  })

  it('is folded on the last task and never stands in the way of it', () => {
    render(<EcmoFoundationLessonActivity sectionId="why-extracorporeal-support" supportMode="vv" />)
    expect(document.querySelector('[data-section-recap]')).toBeNull()
    reachFoundationStep('why-extracorporeal-support', 'transfer')
    const recap = document.querySelector<HTMLDetailsElement>('details[data-section-recap]')
    expect(recap).not.toBeNull()
    expect(recap?.open).toBe(false)
    expect(recap?.querySelectorAll('li')).toHaveLength(3)
    expect(recap).toHaveTextContent('Delivery is flow multiplied by content')
    expect(document.querySelector('fieldset[data-prediction-choices]')).not.toBeDisabled()
  })
})

describe('S9-3: where a reviewed section leads, and what "reviewed" means', () => {
  async function skipToTheEnd(scenarioId: string) {
    const { lesson } = await mountDrill(scenarioId)
    const stage = buildDrillStageLesson(lesson, lesson.supportMode)
    const last = stage.steps[stage.steps.length - 1]
    openStep(last.id)
    fireEvent.click(screen.getByRole('button', { name: 'Continue without doing this step' }))
    const completion = document.querySelector<HTMLElement>('[data-stage-completion]')
    if (!completion) throw new Error('no completion card')
    return { completion, last }
  }

  it('a case on a different mechanism follows the next section, and both are offered', async () => {
    expect(pairedCaseForLesson('afterload-return-obstruction').kind).toBe('next-in-unit')
    const { completion, last } = await skipToTheEnd('afterload-return-obstruction')
    const buttons = Array.from(completion.querySelectorAll('button'))
    expect(completion.querySelector('[data-completion-lead]')).toHaveAttribute(
      'data-completion-lead',
      'section',
    )
    expect(buttons[0]).toHaveAttribute('data-next-section')
    expect(buttons[0]).toHaveTextContent(/^Continue to next section: Oxygenator resistance/)
    expect(buttons[1]).toHaveAttribute('data-practice-pairing', 'next-in-unit')
    expect(buttons[0]).toBeEnabled()
    expect(buttons[1]).toBeEnabled()
    // Skipped is not performed, and the card says what the word on it means.
    expect(completion).toHaveTextContent(
      'It does not record that a step was performed or answered.',
    )
    expect(document.querySelector(`[data-step-id="${last.id}"]`)).not.toHaveAttribute(
      'data-step-state',
      'done',
    )
    expect(latestState().scenario.prediction.committed).toBe(false)
  })

  it('preserved: a case that applies this lesson still leads its card', async () => {
    expect(pairedCaseForLesson('preload-drainage-collapse').kind).toBe('mechanism-match')
    const { completion } = await skipToTheEnd('preload-drainage-collapse')
    const buttons = Array.from(completion.querySelectorAll('button'))
    expect(buttons[0]).toHaveAttribute('data-practice-pairing', 'mechanism-match')
    expect(buttons[1]).toHaveAttribute('data-next-section')
  })
})

describe('VA7-1: the VA console tour says which part is the VV tour repeated', () => {
  const vv = cardiohelpLearnLessonByScenarioId.get('startup-sensor-orientation')
  const va = cardiohelpLearnLessonByScenarioId.get('va-startup-sensor-orientation')

  it('leads with the VA tracing and says the shared tour can be passed over', () => {
    const first = va?.steps[0]
    expect(first?.instruction).toMatch(/^Trace femoral venous drainage/)
    expect(first?.instruction).toMatch(/repeat that tour on this circuit/)
    expect(first?.instruction).toMatch(/use the task list to move ahead to the prediction/)
  })

  it('preserved: no step was removed, renamed or reordered', () => {
    expect(va?.steps.map((step) => step.id)).toEqual(vv?.steps.map((step) => `va-${step.id}`))
    expect(va?.steps).toHaveLength(vv?.steps.length ?? -1)
    expect(va?.steps.length).toBeGreaterThan(10)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 5. Integrated cases: IV-1, IV-2, IV-3, IA-1, IA-2
 * ------------------------------------------------------------------------------------------ */

describe('IV-2, IA-2: the review checklist is teaching, not a requirement', () => {
  it.each(['vv-off-sweep-capstone', 'va-mixed-circulation-capstone'] as const)(
    '%s: the checklist is readable before any answer and is not called required',
    (scenarioId) => {
      const scenario = cardiohelpScenarioById.get(scenarioId)!
      const state = createInitialSimulationState(scenarioId, 'guided')
      const view = render(
        <ReassessmentPanel
          state={state}
          scenario={scenario}
          dispatch={jest.fn()}
          onReveal={jest.fn()}
          onShowStage={jest.fn()}
          stageNumber={3}
        />,
      )
      expect(view.container.textContent ?? '').not.toMatch(/Required review domains/i)
      const checklist = view.container.querySelector('[data-review-checklist]')
      expect(checklist).toHaveTextContent('Review checklist for this case')
      expect(checklist).toHaveTextContent('nothing depends on completing it')
      expect(checklist).toHaveTextContent('a guided comparison, not a hidden key')
      // The teaching itself is still there, before anything is selected.
      expect(checklist).toHaveTextContent(scenario.assessmentPolicy!.reassessmentGuidance!.patient)
      expect(state.scenario.reassessment).toBeNull()
      expect(view.container.textContent).not.toMatch(
        /Choose the observed|response selected|Reassessment submitted/,
      )
      expect(view.container.textContent).toMatch(/review statement/)
      expect(reassessmentForReview(scenario).instruction).toMatch(/checklist/)
      for (const domain of ['device', 'circuit', 'patient'] as const) {
        const question = reassessmentForReview(scenario)[domain]
        expect(question.prompt).toMatch(/review statement/)
        const keyed = question.options.find(
          (candidate) => candidate.id === question.correctOptionId,
        )!
        expect(keyed.rationale).toMatch(/checklist/)
        expect(keyed.rationale).not.toMatch(/matches the .* response this case expects/)
      }
    },
  )

  it('the stage card stops asking for a monitor reading the selections do not take', () => {
    const scenario = cardiohelpScenarioById.get('vv-off-sweep-capstone')!
    const state = createInitialSimulationState(scenario.id, 'guided')
    const noop = jest.fn()
    const card = (reassessmentIsChecklist: boolean) =>
      resolveNowCard({
        facts: resolvePracticeStages(state, scenario, true),
        activeStage: 'reassess',
        activityMode: 'practice',
        reassessmentIsChecklist,
        actions: {
          beginCase: noop,
          focusControl: noop,
          openStage: noop,
          advanceSeconds: noop,
          reveal: noop,
          restart: noop,
          replay: noop,
        },
      })
    expect(card(true).body).not.toMatch(/you actually see on the monitor/)
    expect(card(true).body).toMatch(/The checklist above the questions is the teaching/)
    // A case with authored observations keeps the instruction it had.
    expect(card(false).body).toMatch(/you actually see on the monitor/)
  })
})

describe('IV-1, IV-3, IA-1: an integrated case says what it rehearses and where it stops', () => {
  it('scope notes exist for the two integrated cases and for nothing else', () => {
    expect(Object.keys(ECMO_INTEGRATED_CASE_SCOPE).sort()).toEqual([
      'va-mixed-circulation-capstone',
      'vv-off-sweep-capstone',
    ])
    for (const scope of Object.values(ECMO_INTEGRATED_CASE_SCOPE)) {
      // No verdict vocabulary: the notes bound an exercise, they do not grade one.
      expect(flaggedGradingCopyTerms(`${scope.rehearses} ${scope.cannotEstablish}`)).toEqual([])
    }
  })

  it('VV: the action sits beside what the exercise cannot establish', () => {
    const scenario = cardiohelpScenarioById.get('vv-off-sweep-capstone')!
    const view = render(
      <ActionPanel
        state={createInitialSimulationState(scenario.id, 'guided')}
        scenario={scenario}
        dispatch={jest.fn()}
        stageNumber={2}
        showTeachingFeedback
        onFocusControl={jest.fn()}
      />,
    )
    const scope = view.container.querySelector('[data-integrated-case-scope]')
    expect(scope).toHaveTextContent('No lesson in this track teaches separation from VV support')
    expect(scope).toHaveTextContent(
      'does not decide whether a trial off sweep has succeeded, how long one should run, or when to restore the sweep',
    )
    expect(scope).toHaveTextContent('it records no such call')
    // The exercise's own action is still there, unchanged.
    expect(
      screen.getByRole('button', { name: /Set sweep to zero; maintain circuit blood flow/ }),
    ).toBeEnabled()
  })

  it('VA: the single action is named as an authored composite, not as procedures performed', () => {
    const scenario = cardiohelpScenarioById.get('va-mixed-circulation-capstone')!
    const view = render(
      <ActionPanel
        state={createInitialSimulationState(scenario.id, 'guided')}
        scenario={scenario}
        dispatch={jest.fn()}
        stageNumber={2}
        showTeachingFeedback
        onFocusControl={jest.fn()}
      />,
    )
    const scope = view.container.querySelector('[data-integrated-case-scope]')
    expect(scope).toHaveTextContent('The one management action is an authored composite')
    expect(scope).toHaveTextContent('it performs no configuration change')
    expect(scope).toHaveTextContent('The right-arm reading stays low afterwards')
  })

  it('VV debrief: an empty safety log is not a verdict, and the paired lesson is scoped', () => {
    const scenario = cardiohelpScenarioById.get('vv-off-sweep-capstone')!
    let state = createInitialSimulationState(scenario.id, 'guided')
    state = ecmoSimulationReducer(state, { type: 'SET_SWEEP', sweep: 0 })
    for (let second = 0; second < 30; second += 1) {
      state = ecmoSimulationReducer(state, { type: 'STEP' })
    }
    state = ecmoSimulationReducer(state, { type: 'REVEAL_DEBRIEF' })
    const view = render(
      <EcmoCaseDebrief
        state={state}
        scenario={scenario}
        outcome={selectScenarioOutcome(state)}
        supportMode="vv"
        onReplay={jest.fn()}
      />,
    )
    const text = view.container.textContent ?? ''
    // Preserved (Prompt 01): what the empty log is a statement about, with the readings beside it.
    expect(text).toMatch(/it says nothing about how the patient is doing/)
    expect(screen.getByLabelText('Patient state at the reveal')).toBeInTheDocument()
    // New: the same scope the Manage stage states, and what the linked lesson does not teach.
    expect(view.container.querySelector('[data-integrated-case-scope]')).toHaveTextContent(
      'What it cannot establish.',
    )
    expect(view.container.querySelector('[data-paired-lesson-note]')).toHaveTextContent(
      'It does not teach separation from support.',
    )
    // The trial's own readings are printed as they stand: nothing is rounded into "normal".
    expect(state.patient.spo2).toBeLessThan(95)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 6. OV-2: less repetition on the hub, and the review status still in plain sight
 * ------------------------------------------------------------------------------------------ */

describe('OV-2: the hub folds per-source provenance without folding the review status', () => {
  it.each(['draft', 'published'] as const)('%s: the status is outside the disclosure', (status) => {
    const view = render(<SourcesPanel publicationStatus={status} />)
    const registry = view.container.querySelector<HTMLDetailsElement>(
      'details[data-source-registry]',
    )
    expect(registry).not.toBeNull()
    expect(registry?.open).toBe(false)
    // Every source row is still rendered, each with its own review line, inside the registry.
    expect(registry?.querySelectorAll('[data-evidence-id]')).toHaveLength(cardiohelpEvidence.length)
    // The fact that nothing has been reviewed is stated where no disclosure can hide it.
    const badge = view.container.querySelector('[data-review-status]')
    expect(badge).toHaveTextContent(ECMO_MODULE_REVIEW_LINE)
    expect(badge?.closest('details')).toBeNull()
    const line = view.container.querySelector('[data-source-registry-status]')
    expect(line).toHaveTextContent('No source has a clinical or device review on record')
    expect(line?.closest('details')).toBeNull()
    expect(view.container.textContent ?? '').not.toMatch(/clinically reviewed|device reviewed/i)
  })
})

/* ------------------------------------------------------------------------------------------ *
 * 7. S3-4: an instruction names the control by the words on it
 * ------------------------------------------------------------------------------------------ */

describe('S3-4: the speed comparison is run from the control the page actually shows', () => {
  it('names the control by its own label, not as a "Run control"', () => {
    const view = render(
      <StageTeachingScope
        value={{
          phase: 'act',
          predictionCommitted: false,
          stepId: 'pump-and-pressure-zones-act',
          foundationBlock: 'pump-speed',
        }}
      >
        <PumpPressureZonesPanel state={createReferenceSimulationState('vv-reference')} />
      </StageTeachingScope>,
    )
    const text = view.container.textContent ?? ''
    expect(text).not.toMatch(/teaching Run control/)
    expect(text).toMatch(/Use the “Increase pump speed by 300 rpm” control for this task/)
    // The task's own instruction and its guided action carry the same words.
    const task = ecmoFoundationTeachingTasks['pump-and-pressure-zones'].find(
      (candidate) => candidate.id === 'act',
    )
    expect(task?.instruction).toMatch(/^Use Increase pump speed by 300 rpm below\./)
    expect(
      ecmoFoundationLessonRuntime('pump-and-pressure-zones').guidedActions.find(
        (action) => action.id === task?.actionId,
      )?.label,
    ).toBe('Increase pump speed by 300 rpm')
  })
})

// Independent PR #327 review: exercise the state and rendered contracts behind the copy.
describe('adversarial review: local feedback preserves every rationale truthfully', () => {
  it.each(['incorrect-mechanism', 'reasonable-but-incomplete', 'unsafe', 'best'] as const)(
    '%s: the comparison can contain the key without calling it wrong; retry stays open',
    (plausibility) => {
      render(
        <EcmoFoundationLessonActivity sectionId="why-extracorporeal-support" supportMode="vv" />,
      )
      reachFoundationStep('why-extracorporeal-support', 'predict')
      const item = ecmoFoundationLearningItemsFor('why-extracorporeal-support').prediction
      const chosen = item.choices.find((choice) => choice.plausibility === plausibility)!
      expect(chosen).toBeDefined()
      fireEvent.click(
        document.querySelector<HTMLInputElement>(
          `fieldset[data-prediction-choices] input[value="${chosen.id}"]`,
        )!,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }))
      const comparison = document.querySelector('[data-other-answers-panel]')!
      expect(comparison).toHaveTextContent('How the other answers compare')
      expect(comparison).not.toHaveTextContent('Why the other answers do not fit')
      for (const choice of item.choices.filter((candidate) => candidate.id !== chosen.id)) {
        expect(comparison.querySelector(`[data-other-answer="${choice.id}"]`)).toHaveTextContent(
          choice.rationale,
        )
      }
      expect(comparison.querySelector(`[data-other-answer="${chosen.id}"]`)).toBeNull()
      expect(document.querySelector('[data-ecmo-shell]')).toHaveAttribute(
        'data-stage',
        'why-extracorporeal-support-predict',
      )
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(document.querySelector('[data-other-answers-panel]')).toBeNull()
      expect(document.querySelector('fieldset[data-prediction-choices]')).not.toBeDisabled()
    },
  )
})

describe('adversarial review: all six narrative sections teach before an optional self-check', () => {
  it.each([
    ['vv-normal-state', 'vv'],
    ['vv-series-physiology', 'vv'],
    ['vv-integration-capstone', 'vv'],
    ['va-normal-state', 'va'],
    ['va-parallel-physiology', 'va'],
    ['va-integration-capstone', 'va'],
  ] as const)(
    '%s keeps its key points and an explanation path without an answer',
    (sectionId, mode) => {
      render(<EcmoFoundationLessonActivity sectionId={sectionId} supportMode={mode} />)
      const section = ecmoFoundationSections.find((candidate) => candidate.id === sectionId)!
      const points = document.querySelector('[data-lesson-key-points]')
      for (const bullet of section.bullets ?? []) expect(points).toHaveTextContent(bullet)
      reachFoundationStep(sectionId, 'predict')
      expect(pageText()).not.toMatch(
        /before (?:you )?look(?:ing)? further|held back until|commit before|before measuring/i,
      )
      expect(
        screen.getByRole('button', { name: 'Show explanation without answering' }),
      ).toBeEnabled()
      fireEvent.click(screen.getByRole('button', { name: 'Show explanation without answering' }))
      expect(document.querySelector('[data-optional-explanation]')).not.toBeNull()
      expect(
        document.querySelectorAll('fieldset[data-prediction-choices] input:checked'),
      ).toHaveLength(0)
    },
  )
})

describe('adversarial review: every changed end-card pairing uses the pathway resolver', () => {
  const changed = cardiohelpLearnLessons.filter(
    (lesson) => pairedCaseForLesson(lesson.scenarioId).kind === 'next-in-unit',
  )
  it('enumerates the six affected pairings', () => {
    expect(changed.map((lesson) => lesson.scenarioId).sort()).toEqual([
      'acute-hypercapnia',
      'afterload-return-obstruction',
      'compensated-hypercapnia',
      'transport-power-loss',
      'va-afterload-arterial-return-obstruction',
      'va-transport-power-loss',
    ])
  })
  it.each(changed.map((lesson) => [lesson.scenarioId, lesson.supportMode] as const))(
    '%s offers both real destinations after skipping the last step',
    async (id, mode) => {
      const { lesson } = await mountDrill(id)
      const stage = buildDrillStageLesson(lesson, mode)
      openStep(stage.steps.at(-1)!.id)
      fireEvent.click(screen.getByRole('button', { name: 'Continue without doing this step' }))
      const pairing = pairedCaseForLesson(id)
      if (pairing.kind !== 'next-in-unit') throw new Error('expected different mechanism')
      const next = nextPathwaySection(criticalCareLearningPathway('cardiohelp-ecmo', mode), id)
      expect(next).toBeDefined()
      expect(clinicalPracticeScenarioById.has(pairing.caseId)).toBe(true)
      expect(caseMechanismByCaseId.get(pairing.caseId)).not.toBe(lessonMechanism(id))
      const card = document.querySelector('[data-stage-completion]')!
      const choices = card.querySelectorAll('button')
      expect(choices[0]).toHaveTextContent(next!.title)
      expect(choices[0]).toBeEnabled()
      expect(choices[1]).toHaveTextContent(clinicalPracticeScenarioById.get(pairing.caseId)!.title)
      expect(choices[1]).toBeEnabled()
      expect(latestState().scenario.prediction.committed).toBe(false)
      expect(card).toHaveTextContent('in either order')
      fireEvent.click(choices[1])
      expect(mockReviewPush).toHaveBeenLastCalledWith({
        pathname: '/cardiohelp-ecmo/practice',
        query: { case: pairing.caseId, track: mode },
      })
      fireEvent.click(choices[0])
      if (isEcmoFoundationSectionId(next!.id)) {
        expect(mockReviewPush).toHaveBeenLastCalledWith({
          pathname: '/cardiohelp-ecmo/learn',
          query: { lesson: next!.id, track: mode },
        })
      } else {
        expect(latestState().scenario.scenarioId).toBe(next!.id)
      }
    },
  )
})

describe('adversarial review: integrated scope matches raw simulation state', () => {
  it('VA recognition leaves the fault active and does not improve the patient relative to no action', () => {
    let untreated = createInitialSimulationState('va-mixed-circulation-capstone', 'guided')
    let recognised = ecmoSimulationReducer(untreated, {
      type: 'CORRECT_FAULT',
      fault: 'differential-hypoxemia',
    })
    expect(recognised.patient).toEqual(untreated.patient)
    expect(recognised.supportMode).toBe('va')
    expect(recognised.scenario.activeFaults).toContain('differential-hypoxemia')
    for (let second = 0; second < 60; second++) {
      untreated = ecmoSimulationReducer(untreated, { type: 'STEP' })
      recognised = ecmoSimulationReducer(recognised, { type: 'STEP' })
      expect(recognised.patient).toEqual(untreated.patient)
      expect(recognised.patient.rightRadialSpo2).toBeLessThan(90)
      expect(recognised.scenario.activeFaults).toContain('differential-hypoxemia')
    }
  })
  it('VV turns only sweep off and keeps blood flow and the restore-sweep control available', () => {
    const initial = createInitialSimulationState('vv-off-sweep-capstone', 'guided')
    const changed = ecmoSimulationReducer(initial, { type: 'SET_SWEEP', sweep: 0 })
    expect(initial.circuit.bloodFlow).toBeGreaterThan(0)
    expect(changed.gas.sweepLpm).toBe(0)
    expect(changed.device.rpmSetpoint).toBe(initial.device.rpmSetpoint)
    expect(changed.circuit.bloodFlow).toBe(initial.circuit.bloodFlow)
    expect(changed.patient).toEqual(initial.patient)
    const restored = ecmoSimulationReducer(changed, { type: 'SET_SWEEP', sweep: 3 })
    expect(restored.gas.sweepLpm).toBe(3)
  })
})

describe('adversarial review: checklist submission is not a measured reassessment', () => {
  it.each(['vv-off-sweep-capstone', 'va-mixed-circulation-capstone'] as const)(
    '%s labels submitted selections in both surfaces',
    (id) => {
      const scenario = cardiohelpScenarioById.get(id)!
      const questions = reassessmentForReview(scenario)
      let state = createInitialSimulationState(id, 'guided')
      state = ecmoSimulationReducer(state, {
        type: 'COMMIT_REASSESSMENT',
        answers: {
          deviceOptionId: questions.device.correctOptionId,
          circuitOptionId: questions.circuit.options.find(
            (option) => option.id !== questions.circuit.correctOptionId,
          )!.id,
          patientOptionId: questions.patient.correctOptionId,
        },
      })
      const panel = render(
        <ReassessmentPanel
          state={state}
          scenario={scenario}
          dispatch={jest.fn()}
          onReveal={jest.fn()}
          onShowStage={jest.fn()}
          stageNumber={3}
        />,
      )
      expect(panel.container).toHaveTextContent('Checklist comparison submitted')
      expect(panel.container.textContent).not.toMatch(/Reassessment submitted|Choose the observed/)
      panel.unmount()
      state = ecmoSimulationReducer(state, { type: 'REVEAL_DEBRIEF' })
      const debrief = render(
        <EcmoCaseDebrief
          state={state}
          scenario={scenario}
          outcome={selectScenarioOutcome(state)}
          supportMode={scenario.supportMode}
          onReplay={jest.fn()}
        />,
      )
      const comparison = Array.from(debrief.container.querySelectorAll('[data-domain]'))
        .map((node) => node.textContent)
        .join(' ')
      expect(comparison).toMatch(/You selected:/)
      expect(comparison).toMatch(/matches the review checklist/)
      expect(comparison).toMatch(/The review checklist states:/)
      expect(comparison).not.toMatch(/You recorded:|response this case expects/)
    },
  )
  it('preserves observed-response language for an authored reassessment', () => {
    const scenario = clinicalPracticeScenarioById.get('clinical-vv-gas-disconnection')!
    expect(scenario.reassessment).toBeDefined()
    const state = createInitialSimulationState(scenario.id, 'guided')
    const view = render(
      <ReassessmentPanel
        state={state}
        scenario={scenario}
        dispatch={jest.fn()}
        onReveal={jest.fn()}
        onShowStage={jest.fn()}
        stageNumber={3}
      />,
    )
    expect(view.container).toHaveTextContent(
      'Choose the observed device, circuit/gas, and patient responses.',
    )
    expect(view.container).not.toHaveTextContent('checklist selections')
    expect(reassessmentForReview(scenario)).toBe(scenario.reassessment)
  })
})
