/**
 * The D3 timing contract, and the honesty rules the coaching has to hold once it is allowed to speak.
 *
 * Every rendered scenario is driven the way the real workspace drives it — a fresh Practice state, a
 * committed frame, a real `applyIntervention`, then `advanceSimulation` in the same steps the tick
 * loop takes — so the "before" the baseline captures is the one a learner would have been looking at.
 * Nothing here stubs the engine.
 */
import { useState } from 'react'
import { act, render, screen } from '@testing-library/react'

import { CaseWorkflow } from '../components/CaseWorkflow'
import { mechanicalVentilationCaseById, mechanicalVentilationCases } from '../content'
import {
  capturePostActionBaseline,
  coachedInterventionEffectIds,
  coachingReadingSnapshot,
  postActionObservation,
  ventilationPostActionCoaching,
  type PostActionBaseline,
} from '../content/postActionCoaching'
import { advanceSimulation, applyIntervention, createInitialSimulationState } from '../engine'
import { deriveEffectivePatient, isCaseResolved } from '../engine/physics'
import { ventilationSimulationReducer } from '../engine/reducer'
import type { VentilationCaseDefinition, VentilationSimulationState } from '../engine/types'

const COACHING = '[data-mv-post-action-coaching]'
const PENDING = '[data-mv-coaching-pending]'

function definitionFor(caseId: string): VentilationCaseDefinition {
  const definition = mechanicalVentilationCaseById.get(caseId)
  if (!definition) throw new Error(`Expected ${caseId}`)
  return definition
}

/**
 * The lowest Practice attempt on which a case selects a given branch.
 *
 * Same approach `ventilationLessonAttempt` uses: ask the engine rather than recompute its private
 * hash here. A test that pinned an attempt number by hand would silently start exercising a
 * different patient the moment the branch list changed.
 */
function attemptForBranch(caseId: string, branch: string): number {
  for (let attempt = 1; attempt <= 64; attempt += 1) {
    if (createInitialSimulationState(caseId, 'practice', attempt).branch === branch) return attempt
  }
  throw new Error(`No Practice attempt selects ${caseId}:${branch}`)
}

function committedPracticeState(
  definition: VentilationCaseDefinition,
  branch: string,
  baselineSeconds = 30,
): VentilationSimulationState {
  const initial = createInitialSimulationState(
    definition.id,
    'practice',
    attemptForBranch(definition.id, branch),
  )
  const committed = ventilationSimulationReducer(
    { ...initial, paused: false },
    {
      type: 'COMMIT_PREDICTION',
      mechanismId: definition.mechanismOptions[0].id,
      priorityId: definition.priorityOptions[0].id,
      responseId: definition.responseOptions[0].id,
    },
  )
  return advanceSimulation(committed, baselineSeconds, definition)
}

type Apply = (step: (state: VentilationSimulationState) => VentilationSimulationState) => void

function Harness({
  initial,
  definition,
  coachingEnabled,
  bind,
  dispatch,
}: {
  initial: VentilationSimulationState
  definition: VentilationCaseDefinition
  coachingEnabled: boolean
  bind: (apply: Apply) => void
  dispatch: () => void
}) {
  const [state, setState] = useState(initial)
  bind((step) => setState((current) => step(current)))
  return (
    <CaseWorkflow
      state={state}
      definition={definition}
      dispatch={dispatch}
      onResult={() => undefined}
      coachingEnabled={coachingEnabled}
    />
  )
}

interface Scenario {
  readonly container: HTMLElement
  readonly apply: Apply
  readonly definition: VentilationCaseDefinition
  readonly current: () => VentilationSimulationState
  readonly coachingText: () => string
}

function startScenario(
  caseId: string,
  branch: string,
  options: { coachingEnabled?: boolean; baselineSeconds?: number } = {},
): Scenario {
  const definition = definitionFor(caseId)
  const initial = committedPracticeState(definition, branch, options.baselineSeconds ?? 30)
  let apply!: Apply
  let latest = initial
  const wrapped: Apply = (step) =>
    apply((state) => {
      latest = step(state)
      return latest
    })
  const { container } = render(
    <Harness
      initial={initial}
      definition={definition}
      coachingEnabled={options.coachingEnabled ?? true}
      bind={(fn) => {
        apply = fn
      }}
      dispatch={() => undefined}
    />,
  )
  return {
    container,
    apply: (step) => act(() => wrapped(step)),
    definition,
    current: () => latest,
    coachingText: () => container.querySelector(COACHING)?.textContent ?? '',
  }
}

/**
 * Internal identifiers that must never reach a learner surface.
 *
 * Asked as "which identifiers appear" rather than "does the branch string appear", because several
 * branch tokens are also ordinary English words — MV-13's `secretions` is named in the case's own
 * title, and MV-08's `condensate` is in the label of the button the learner just pressed. Those are
 * clinical vocabulary. What must not appear is the token *as an identifier*: the hyphenated and
 * colon-joined forms, the phenotype, the effect and intervention keys, and the metric paths.
 */
function internalIdentifiersIn(text: string, definition: VentilationCaseDefinition): string[] {
  const identifiers = [
    definition.phenotype,
    definition.stationId,
    ...definition.branchOptions,
    ...definition.interventions.map((item) => item.id),
    ...definition.interventions.map((item) => String(item.effectId)),
    ...definition.successConditions.map((condition) => condition.metric),
    'PERFORM_INTERVENTION',
    'COMMIT_PREDICTION',
    'effectId',
    'interventionId',
    'autotriggerFraction',
    'ineffectiveEffortFraction',
    'relaxedPlateauPressureCmH2O',
  ]
  return [
    ...new Set(
      identifiers.filter((identifier) => /[-:.]/.test(identifier) && text.includes(identifier)),
    ),
  ]
}

function perform(scenario: Scenario, interventionId: string): void {
  scenario.apply((state) => applyIntervention(state, scenario.definition, interventionId))
}

function advance(scenario: Scenario, seconds: number): void {
  scenario.apply((state) => advanceSimulation(state, seconds, scenario.definition))
}

/* ------------------------------------------------------------------------------------------------
 * 1 — nothing is released by the commitment itself
 * ---------------------------------------------------------------------------------------------- */

describe('Practice prediction releases nothing', () => {
  it('shows no coaching, no verdict, and no answer key after the frame is committed', () => {
    const scenario = startScenario('MV-13', 'secretions')
    advance(scenario, 120)

    expect(scenario.container.querySelector(COACHING)).toBeNull()
    expect(scenario.container.querySelector(PENDING)).toBeNull()

    const rendered = scenario.container.textContent ?? ''
    const definition = scenario.definition
    const answerKey = [
      definition.mechanismOptions.find((item) => item.id === definition.correctMechanismId)?.label,
      definition.priorityOptions.find((item) => item.id === definition.correctPriorityId)?.label,
      definition.responseOptions.find((item) => item.id === definition.correctResponseId)?.label,
      ...definition.expectedActions,
      definition.debrief,
    ].filter((item): item is string => Boolean(item))
    for (const leak of answerKey) {
      expect(rendered).not.toContain(leak)
    }
    expect(rendered).not.toContain(String(scenario.current().seed))
    expect(internalIdentifiersIn(rendered, scenario.definition)).toEqual([])
  })

  it('cannot produce coaching from a commitment alone, however long the clock runs', () => {
    const definition = definitionFor('MV-13')
    const state = advanceSimulation(
      committedPracticeState(definition, 'secretions'),
      600,
      definition,
    )
    expect(state.interventions).toHaveLength(0)

    /*
     * The defect this reconstructs is the obvious one: coach at the moment of commitment. Its
     * cheapest expression is a baseline whose observation interval has already elapsed — so the
     * timing gate cannot be what refuses it, and the refusal has to come from there being no action
     * to coach.
     */
    const alreadyElapsed: PostActionBaseline = {
      recordId: 'prediction-phase',
      interventionId: 'prediction-phase',
      effectId: 'suction-airway',
      actionLabel: 'Commit prediction',
      actionSeconds: 0,
      effectiveAtSeconds: 0,
      settleSeconds: 0,
      readings: coachingReadingSnapshot(state),
      criticalErrorCount: 0,
      settingsFingerprint: JSON.stringify(state.ventilator.settings),
    }
    expect(postActionObservation(state, alreadyElapsed).complete).toBe(true)
    expect(ventilationPostActionCoaching(state, definition, alreadyElapsed)).toBeNull()
  })
})

/* ------------------------------------------------------------------------------------------------
 * 2 — the observation interval
 * ---------------------------------------------------------------------------------------------- */

describe('the observation interval', () => {
  it('withholds coaching from the moment of the action until the interval completes', () => {
    const scenario = startScenario('MV-08', 'condensate')
    perform(scenario, 'inspect-circuit')
    advance(scenario, 30)
    perform(scenario, 'drain-condensate')

    // The action is recorded and nothing has been said about it.
    expect(scenario.current().interventions.at(-1)?.interventionId).toBe('drain-condensate')
    expect(scenario.container.querySelector(COACHING)).toBeNull()
    expect(scenario.container.querySelector(PENDING)).not.toBeNull()

    // The case's own latency for this action has not elapsed.
    advance(scenario, 5)
    expect(scenario.container.querySelector(COACHING)).toBeNull()

    // It has now, but not one of this patient's breaths since.
    advance(scenario, 5.1)
    expect(scenario.container.querySelector(COACHING)).toBeNull()
    expect(scenario.container.querySelector(PENDING)).not.toBeNull()
  })

  it('shows the coaching as soon as the interval completes, and drops the waiting notice', () => {
    const scenario = startScenario('MV-08', 'condensate')
    perform(scenario, 'inspect-circuit')
    advance(scenario, 30)
    perform(scenario, 'drain-condensate')
    advance(scenario, 10.1)
    expect(scenario.container.querySelector(COACHING)).toBeNull()

    advance(scenario, 3)
    expect(scenario.container.querySelector(COACHING)).not.toBeNull()
    expect(scenario.container.querySelector(PENDING)).toBeNull()
  })

  it('never lets the interval collapse to the instant of the action, in any case', () => {
    for (const definition of mechanicalVentilationCases) {
      const state = committedPracticeState(definition, definition.branchOptions[0], 20)
      for (const intervention of definition.interventions) {
        if (intervention.prerequisites?.length) continue
        const acted = applyIntervention(state, definition, intervention.id)
        const record = acted.interventions.at(-1)
        if (!record) continue
        const baseline = capturePostActionBaseline(state, definition, record)
        const observation = postActionObservation(acted, baseline)
        expect({
          case: definition.id,
          action: intervention.id,
          completesAfterAction: observation.completeAtSeconds > record.time,
          completeAtAction: observation.complete,
        }).toEqual({
          case: definition.id,
          action: intervention.id,
          completesAfterAction: true,
          completeAtAction: false,
        })
      }
    }
  })

  it('does not advance while the simulation is paused', () => {
    const scenario = startScenario('MV-08', 'condensate')
    perform(scenario, 'inspect-circuit')
    advance(scenario, 30)
    perform(scenario, 'drain-condensate')
    // A paused TICK is a no-op in the reducer, so the workspace cannot tick past the interval.
    scenario.apply((state) =>
      ventilationSimulationReducer(
        { ...state, paused: true },
        {
          type: 'TICK',
          seconds: 60,
        },
      ),
    )
    expect(scenario.container.querySelector(COACHING)).toBeNull()
    expect(scenario.container.querySelector(PENDING)).not.toBeNull()
  })
})

/* ------------------------------------------------------------------------------------------------
 * 3 — what the coaching says
 * ---------------------------------------------------------------------------------------------- */

function coachedScenario(
  caseId: string,
  branch: string,
  actions: readonly string[],
  settleSeconds: number,
): Scenario {
  const scenario = startScenario(caseId, branch)
  actions.forEach((id, index) => {
    perform(scenario, id)
    advance(scenario, index === actions.length - 1 ? settleSeconds : 30)
  })
  return scenario
}

describe('branch-specific coaching', () => {
  it('separates a response from a non-response on the same action and the same case', () => {
    const responded = coachedScenario(
      'MV-08',
      'condensate',
      ['inspect-circuit', 'drain-condensate'],
      40,
    )
    const notResponded = coachedScenario(
      'MV-08',
      'leak',
      ['inspect-circuit', 'drain-condensate'],
      40,
    )

    const respondedText = responded.coachingText()
    const notRespondedText = notResponded.coachingText()
    expect(respondedText).not.toBe('')
    expect(notRespondedText).not.toBe('')
    expect(respondedText).not.toEqual(notRespondedText)

    expect(respondedText).toContain('had been reading that movement as the start of a breath')
    expect(notRespondedText).toContain(
      'does not support water at the sensor as the operative trigger source',
    )
    expect(notRespondedText).toContain('evidence against condensate being the trigger source')
    // The response variant must not carry the non-response caveat, and vice versa.
    expect(respondedText).not.toContain('evidence against condensate being the trigger source')
    expect(notRespondedText).not.toContain(
      'had been reading that movement as the start of a breath',
    )
    expect(respondedText).not.toContain('does not support water at the sensor')
  })

  it('never prints the response-path identifier, the reproducibility key, or model bookkeeping', () => {
    // The settle time is each action's own authored latency plus room for a breath — a bronchodilator
    // does not reach the model for five simulated minutes, and coaching correctly says nothing until
    // it has.
    const runs = [
      {
        caseId: 'MV-08',
        branch: 'condensate',
        actions: ['inspect-circuit', 'drain-condensate'],
        settle: 40,
      },
      {
        caseId: 'MV-08',
        branch: 'leak',
        actions: ['inspect-circuit', 'drain-condensate'],
        settle: 40,
      },
      { caseId: 'MV-13', branch: 'hme-or-ett', actions: ['suction-airway'], settle: 90 },
      { caseId: 'MV-13', branch: 'bronchospasm', actions: ['bronchodilator'], settle: 360 },
      {
        caseId: 'MV-15',
        branch: 'pain-bladder-delirium',
        actions: ['deepen-sedation'],
        settle: 90,
      },
    ] as const
    for (const run of runs) {
      const scenario = coachedScenario(run.caseId, run.branch, run.actions, run.settle)
      const text = scenario.coachingText()
      const state = scenario.current()
      expect(text).not.toBe('')
      expect(internalIdentifiersIn(text, scenario.definition)).toEqual([])
      expect(text).not.toContain(String(state.seed))
      for (const forbidden of ['samples', 'buffer', 'reducer', 'burden', 'branch']) {
        expect(text.toLowerCase()).not.toContain(forbidden)
      }
      for (const burden of Object.values(state.risk)) {
        expect(text).not.toContain(burden.toFixed(1))
      }
    }
  })

  it('reports different readings for two versions of the same case', () => {
    const secretions = coachedScenario('MV-13', 'secretions', ['suction-airway'], 60)
    const tube = coachedScenario('MV-13', 'hme-or-ett', ['suction-airway'], 60)
    expect(secretions.coachingText()).not.toEqual(tube.coachingText())
    // Both name the same action; what separates them is what the patient did.
    expect(secretions.coachingText()).toContain('Trapped end-expiratory pressure')
    expect(tube.coachingText()).not.toContain('Trapped end-expiratory pressure')
  })
})

describe('successful, ineffective, and harmful responses', () => {
  it('credits a response, refuses to credit a non-response, and names the cost of a harmful one', () => {
    const successful = coachedScenario('MV-14', 'unstable', ['decompress-pneumothorax'], 40)
    const ineffective = coachedScenario(
      'MV-08',
      'leak',
      ['inspect-circuit', 'drain-condensate'],
      40,
    )
    const harmful = coachedScenario('MV-15', 'pain-bladder-delirium', ['deepen-sedation'], 90)

    expect(successful.coachingText()).toContain(
      'the circulation was being obstructed rather than merely underfilled',
    )
    expect(ineffective.coachingText()).toContain(
      'does not support water at the sensor as the operative trigger source',
    )
    expect(harmful.coachingText()).toContain('Quiet is not correction')

    const texts = [successful.coachingText(), ineffective.coachingText(), harmful.coachingText()]
    expect(new Set(texts).size).toBe(3)
  })

  it('answers the stabilization question from what is on screen, both ways', () => {
    const unstable = coachedScenario('MV-15', 'pain-bladder-delirium', ['deepen-sedation'], 90)
    const stable = coachedScenario('MV-13', 'secretions', ['suction-airway'], 60)

    expect(
      unstable.container.querySelector('[data-coaching-claim="stabilization"]'),
    ).toHaveAttribute('data-stabilization-required', 'true')
    expect(unstable.coachingText()).toContain('takes precedence')
    expect(stable.container.querySelector('[data-coaching-claim="stabilization"]')).toHaveAttribute(
      'data-stabilization-required',
      'false',
    )
    expect(stable.coachingText()).toContain(
      'No active safety interruption or high-priority ventilator alarm is shown',
    )
  })
})

describe('unchanged physiology', () => {
  it('is reported as unchanged rather than credited as an improvement', () => {
    const definition = definitionFor('MV-13')
    const state = committedPracticeState(definition, 'hme-or-ett')
    const acted = applyIntervention(state, definition, 'suction-airway')
    const record = acted.interventions.at(-1)
    if (!record) throw new Error('Expected an intervention record')

    /*
     * Baseline taken from the state *after* the action rather than before it, so before and after are
     * the same numbers by construction. This is the honesty question on its own: given a patient who
     * did not move, what does the coaching say?
     */
    const settled = advanceSimulation(acted, 90, definition)
    const flatBaseline: PostActionBaseline = {
      ...capturePostActionBaseline(settled, definition, record),
      readings: coachingReadingSnapshot(settled),
    }
    const coaching = ventilationPostActionCoaching(settled, definition, flatBaseline)
    if (!coaching) throw new Error('Expected coaching once the interval has elapsed')

    expect(coaching.verdict).toBe('unchanged')
    expect(coaching.verdictLabel).toBe('No better, no worse')
    expect(coaching.observedSummary).toContain('None of the readings above is printing a different')
    expect(coaching.interpretation).toContain(
      'does not support material in the lumen as the dominant narrowing over this interval',
    )
    expect(coaching.interpretation).not.toContain('was part of what the same breath')
    expect(coaching.observed.every((reading) => reading.direction === 'held')).toBe(true)
  })

  it('does not claim a plateau split it could not measure', () => {
    const scenario = coachedScenario('MV-01', 'standard', ['inspiratory-hold'], 25)
    const text = scenario.coachingText()
    expect(text).toContain('not interpretable: patient effort')
    // The maneuver is a measurement: it must not be reported as having moved the patient.
    expect(text).toContain('an occlusion measures, it does not treat')
    expect(text).not.toContain('separated')
  })

  it('does not report a continuously derived reading as one the maneuver produced', () => {
    /*
     * `intrinsicPeepCmH2O` is derived every sample and is on the console whether or not the valves
     * ever closed, so an expiratory hold cannot move it. Keying the maneuver on it printed "this
     * occlusion has not produced a usable trapped-pressure reading" directly under the row showing
     * that reading, on every case that offers the maneuver.
     */
    for (const caseId of ['MV-05', 'MV-06', 'MV-10']) {
      const scenario = coachedScenario(
        caseId,
        definitionFor(caseId).branchOptions[0],
        ['expiratory-hold'],
        40,
      )
      const text = scenario.coachingText()
      expect(text).not.toBe('')
      expect(text).not.toContain('has not produced a usable trapped-pressure reading')
      expect(text).not.toContain('A reading that did not come out')
    }
  })
})

describe('what the readings actually did', () => {
  it('separates a reading that moved the wrong way from one that did not move', () => {
    /*
     * Disconnecting is aimed at trapped pressure falling. A first version of the classifier returned
     * a boolean, so a trapped pressure that *rose* selected the same copy as one that had not moved
     * — printing "releasing it changed nothing" under a reading that had plainly changed.
     *
     * Driven from a hand-set baseline rather than a run, so the two cases differ in exactly one
     * number: the trapped pressure the learner was looking at when they acted.
     */
    const definition = definitionFor('MV-06')
    const state = advanceSimulation(
      applyIntervention(
        committedPracticeState(definition, 'unstable-asthma'),
        definition,
        'disconnect-bag',
      ),
      60,
      definition,
    )
    const record = state.interventions.at(-1)
    if (!record) throw new Error('Expected an intervention record')
    const measured = capturePostActionBaseline(state, definition, record)
    const now = coachingReadingSnapshot(state)['intrinsic-peep'] ?? 0

    const held = ventilationPostActionCoaching(state, definition, {
      ...measured,
      readings: { ...measured.readings, 'intrinsic-peep': now },
    })
    const opposed = ventilationPostActionCoaching(state, definition, {
      ...measured,
      readings: { ...measured.readings, 'intrinsic-peep': now - 5 },
    })
    if (!held || !opposed) throw new Error('Expected coaching once the interval has elapsed')

    expect(held.interpretation).toContain(
      'does not support trapped gas as the dominant load on this patient',
    )
    expect(opposed.interpretation).toContain('moved the other way instead')
    expect(opposed.interpretation).not.toContain('does not support trapped gas')
    expect(opposed.observed.find((reading) => reading.targeted)?.direction).toBe('rose')
  })

  it('keys an action on a reading its own effect can move', () => {
    // Lightening sedation does not move the patient's own rate on a reverse-triggered patient; it
    // moves the sedation level, which the bedside prints. Keying it on the rate made the block tell
    // a learner who had just resolved MV-04 that their action was evidence against itself.
    const scenario = coachedScenario('MV-04', 'entrainment-1:2', ['reduce-sedation'], 130)
    const text = scenario.coachingText()
    expect(text).not.toBe('')
    expect(scenario.container.querySelector('[data-reading="sedation"]')).not.toBeNull()
    expect(text).toContain('less suppressed than they were')
    expect(text).not.toContain('sedation is where it was')
  })

  it('does not call a newly available reading the first one', () => {
    /*
     * `lastAbgAt` is a single slot: once a second gas is ordered the model no longer knows that an
     * earlier one had resulted, so "for the first time" would sometimes be false. What is always
     * true is that the value was not on the screen when the learner acted.
     */
    const definition = definitionFor('MV-01')
    const scenario = coachedScenario('MV-01', 'standard', ['order-abg'], 70)
    const text = scenario.coachingText()
    expect(text).not.toBe('')
    expect(scenario.container.querySelector('[data-reading="paco2"]')).toHaveAttribute(
      'data-direction',
      'revealed',
    )
    expect(text).toContain('was not available when you acted, and is now')
    expect(text).not.toContain('for the first time')
    expect(definition.interventions.some((item) => item.effectId === 'order-abg')).toBe(true)
  })
})

describe('the block is a report, not a second monitor', () => {
  it('latches when the interval closes and does not rewrite itself afterwards', () => {
    const scenario = coachedScenario('MV-13', 'secretions', ['suction-airway'], 65)
    const atRelease = scenario.coachingText()
    expect(atRelease).not.toBe('')

    for (let step = 0; step < 20; step += 1) advance(scenario, 5)
    expect(scenario.coachingText()).toBe(atRelease)
  })

  it('says so when a ventilator setting was changed while the response was developing', () => {
    const scenario = startScenario('MV-13', 'secretions')
    perform(scenario, 'suction-airway')
    scenario.apply((state) =>
      ventilationSimulationReducer(state, {
        type: 'SET_CONTROL',
        control: 'peepCmH2O',
        value: state.ventilator.settings.peepCmH2O + 3,
      }),
    )
    advance(scenario, 65)

    const text = scenario.coachingText()
    expect(text).not.toBe('')
    expect(text).toContain('A ventilator setting was also changed while this was developing')
  })

  it('does not point at a safety interruption as being above it', () => {
    // The interruption box is hidden once the debrief opens and the errors move below the block, so
    // the stabilization answer names the interruption without claiming where it is.
    const scenario = coachedScenario('MV-15', 'pain-bladder-delirium', ['deepen-sedation'], 90)
    const text = scenario.coachingText()
    expect(text).toContain('A safety interruption is open on this case')
    expect(text).not.toContain('interruption above')
  })
})

/* ------------------------------------------------------------------------------------------------
 * 4 — the rest of the workflow is untouched
 * ---------------------------------------------------------------------------------------------- */

describe('the surrounding workflow', () => {
  it('keeps the safety interruption immediate, before any coaching is due', () => {
    const scenario = startScenario('MV-15', 'pain-bladder-delirium')
    perform(scenario, 'deepen-sedation')

    expect(screen.getByRole('alert')).toHaveTextContent('Safety interruption')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Deep sedation before assessing pain, dyspnea, and delirium',
    )
    expect(scenario.container.querySelector(COACHING)).toBeNull()
  })

  it('leaves the full debrief where it was', () => {
    const scenario = coachedScenario('MV-13', 'secretions', ['suction-airway'], 60)
    expect(scenario.container.querySelector(COACHING)).not.toBeNull()

    scenario.apply((state) => ventilationSimulationReducer(state, { type: 'REVEAL_DEBRIEF' }))
    expect(screen.getByText(scenario.definition.debrief)).toBeInTheDocument()
    expect(screen.getByText('Causal debrief')).toBeInTheDocument()
    for (const expected of scenario.definition.expectedActions) {
      expect(screen.getByText(expected)).toBeInTheDocument()
    }
  })

  it('gives the Assess section no in-case coaching at all', () => {
    const scenario = startScenario('MV-08', 'condensate', { coachingEnabled: false })
    perform(scenario, 'inspect-circuit')
    advance(scenario, 30)
    perform(scenario, 'drain-condensate')
    advance(scenario, 90)

    expect(scenario.container.querySelector(COACHING)).toBeNull()
    expect(scenario.container.querySelector(PENDING)).toBeNull()
  })

  it('says nothing in a guided run, where the mechanism is already on the screen', () => {
    const definition = definitionFor('MV-13')
    const guided = advanceSimulation(
      { ...createInitialSimulationState('MV-13', 'learn', 1), paused: false },
      30,
      definition,
    )
    const acted = applyIntervention(guided, definition, 'suction-airway')
    const record = acted.interventions.at(-1)
    if (!record) throw new Error('Expected an intervention record')
    const baseline = capturePostActionBaseline(guided, definition, record)
    const settled = advanceSimulation(acted, 90, definition)
    expect(postActionObservation(settled, baseline).complete).toBe(true)
    expect(ventilationPostActionCoaching(settled, definition, baseline)).toBeNull()
  })

  it('changes no engine state, no outcome, and dispatches nothing of its own', () => {
    const dispatch = jest.fn()
    const definition = definitionFor('MV-13')
    const initial = committedPracticeState(definition, 'secretions')
    let apply!: Apply
    render(
      <Harness
        initial={initial}
        definition={definition}
        coachingEnabled
        bind={(fn) => {
          apply = fn
        }}
        dispatch={dispatch}
      />,
    )
    let withCoaching = initial
    act(() =>
      apply((state) => {
        withCoaching = applyIntervention(state, definition, 'suction-airway')
        return withCoaching
      }),
    )
    act(() =>
      apply((state) => {
        withCoaching = advanceSimulation(state, 90, definition)
        return withCoaching
      }),
    )

    const headless = advanceSimulation(
      applyIntervention(initial, definition, 'suction-airway'),
      90,
      definition,
    )
    expect(withCoaching).toEqual(headless)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('speaks for every action any case can offer', () => {
    const covered = new Set(coachedInterventionEffectIds)
    const missing = mechanicalVentilationCases.flatMap((definition) =>
      definition.interventions
        .filter((intervention) => !covered.has(intervention.effectId))
        .map((intervention) => `${definition.id}:${intervention.effectId}`),
    )
    expect(missing).toEqual([])
  })

  it('says nothing about an action that was already performed when the workspace mounted', () => {
    // A resumed session: the replay hands the component a state whose action has already taken
    // effect, so there is no "before" left to compare with and no honest change to report.
    const definition = definitionFor('MV-08')
    const resumed = advanceSimulation(
      applyIntervention(
        advanceSimulation(
          applyIntervention(
            committedPracticeState(definition, 'condensate'),
            definition,
            'inspect-circuit',
          ),
          30,
          definition,
        ),
        definition,
        'drain-condensate',
      ),
      90,
      definition,
    )
    let apply!: Apply
    const { container } = render(
      <Harness
        initial={resumed}
        definition={definition}
        coachingEnabled
        bind={(fn) => {
          apply = fn
        }}
        dispatch={() => undefined}
      />,
    )
    expect(resumed.interventions).toHaveLength(2)
    expect(container.querySelector(COACHING)).toBeNull()
    expect(container.querySelector(PENDING)).toBeNull()

    // The next action, taken on this device, is coached normally.
    act(() => apply((state) => applyIntervention(state, definition, 'assess-patient')))
    act(() => apply((state) => advanceSimulation(state, 30, definition)))
    expect(container.querySelector(COACHING)).not.toBeNull()
  })

  it('ignores a baseline that belongs to an earlier action', () => {
    const definition = definitionFor('MV-08')
    const state = committedPracticeState(definition, 'condensate')
    const first = applyIntervention(state, definition, 'inspect-circuit')
    const firstRecord = first.interventions.at(-1)
    if (!firstRecord) throw new Error('Expected a first record')
    const staleBaseline = capturePostActionBaseline(state, definition, firstRecord)
    const second = advanceSimulation(
      applyIntervention(advanceSimulation(first, 30, definition), definition, 'drain-condensate'),
      60,
      definition,
    )
    expect(postActionObservation(second, staleBaseline).complete).toBe(true)
    expect(ventilationPostActionCoaching(second, definition, staleBaseline)).toBeNull()
  })
})

/* ------------------------------------------------------------------------------------------------
 * 5 — the branch a treatment reaches, read off the patient
 * ---------------------------------------------------------------------------------------------- */

/**
 * Run one MV-13 branch through one treatment and stop exactly where the learner is shown the block.
 *
 * Everything comes from the real engine: the branch is whatever attempt selects it, the prerequisite
 * inspection is performed where the case requires one, and the clock is advanced in the 0.1 s steps
 * the workspace ticks in until `postActionObservation` says the interval has closed. No settle time
 * is chosen by hand, so a change to the authored latency or to the trace window moves this with it.
 */
function runHighResistance(branch: string, interventionId: string) {
  const definition = definitionFor('MV-13')
  let state = committedPracticeState(definition, branch)
  const intervention = definition.interventions.find((item) => item.id === interventionId)
  if (!intervention) throw new Error(`MV-13 has no ${interventionId}`)
  if (intervention.prerequisites?.length) {
    state = advanceSimulation(
      applyIntervention(state, definition, 'inspect-circuit'),
      30,
      definition,
    )
  }
  const resistanceBefore = deriveEffectivePatient(state, definition).mechanics.resistanceCmH2OPerLps
  const acted = applyIntervention(state, definition, interventionId)
  const record = acted.interventions.at(-1)
  if (!record) throw new Error(`${interventionId} produced no record`)
  const baseline = capturePostActionBaseline(acted, definition, record)
  let settled = acted
  for (
    let guard = 0;
    !postActionObservation(settled, baseline).complete && guard < 8000;
    guard += 1
  ) {
    settled = advanceSimulation(settled, 0.1, definition)
  }
  const coaching = ventilationPostActionCoaching(settled, definition, baseline)
  if (!coaching)
    throw new Error(`${branch}/${interventionId}: no coaching at the observation point`)
  return {
    definition,
    settled,
    coaching,
    resistanceBefore,
    resistanceAfter: deriveEffectivePatient(settled, definition).mechanics.resistanceCmH2OPerLps,
    target: coaching.observed.find((reading) => reading.targeted),
    branchCorrected: isCaseResolved(settled, definition),
  }
}

/** Every branch of MV-13, with the treatment that reaches it and the ones that do not. */
const HIGH_RESISTANCE_MATRIX = [
  { branch: 'secretions', matching: 'suction-airway' },
  { branch: 'hme-or-ett', matching: 'remove-hme' },
  { branch: 'hme-or-ett', matching: 'reposition-ett' },
  { branch: 'bronchospasm', matching: 'bronchodilator' },
] as const

const HIGH_RESISTANCE_MISMATCHES = [
  { branch: 'secretions', action: 'bronchodilator' },
  { branch: 'secretions', action: 'remove-hme' },
  { branch: 'secretions', action: 'reposition-ett' },
  { branch: 'hme-or-ett', action: 'suction-airway' },
  { branch: 'hme-or-ett', action: 'bronchodilator' },
  { branch: 'bronchospasm', action: 'suction-airway' },
  { branch: 'bronchospasm', action: 'remove-hme' },
  { branch: 'bronchospasm', action: 'reposition-ett' },
] as const

describe('MV-13 — a treatment only reaches the narrowing this patient has', () => {
  it.each(HIGH_RESISTANCE_MATRIX)(
    'moves the target and satisfies the branch rule: $branch + $matching',
    ({ branch, matching }) => {
      const run = runHighResistance(branch, matching)
      expect({
        resistanceFell: run.resistanceAfter < run.resistanceBefore,
        target: run.target?.id,
        direction: run.target?.direction,
        branchCorrected: run.branchCorrected,
      }).toEqual({
        resistanceFell: true,
        target: 'peak-pressure',
        direction: 'fell',
        branchCorrected: true,
      })
      expect(run.coaching.interpretation).not.toContain('does not support')
    },
  )

  it.each(HIGH_RESISTANCE_MISMATCHES)(
    'produces no false response and credits nothing: $branch + $action',
    ({ branch, action }) => {
      const run = runHighResistance(branch, action)
      expect({
        resistanceUnchanged: run.resistanceAfter === run.resistanceBefore,
        direction: run.target?.direction,
        branchCorrected: run.branchCorrected,
      }).toEqual({
        resistanceUnchanged: true,
        direction: 'held',
        branchCorrected: false,
      })
      // The block must not read a mechanism off a response that did not happen.
      expect(run.coaching.interpretation).toContain('does not support')
      for (const credit of [
        'was part of what the same breath was being pushed through',
        'the obstruction was in the apparatus',
        'the tube was the narrowing',
        'constricted airways were part of the resistance',
      ]) {
        expect(run.coaching.interpretation).not.toContain(credit)
      }
    },
  )

  it('leaves the intended response intact outside the high-resistance phenotype', () => {
    // MV-05, MV-06 and MV-10 declare no competing cause, so their partial effects are unchanged.
    for (const caseId of ['MV-05', 'MV-06', 'MV-10']) {
      const definition = definitionFor(caseId)
      const state = committedPracticeState(definition, definition.branchOptions[0])
      const before = deriveEffectivePatient(state, definition).mechanics.resistanceCmH2OPerLps
      for (const action of ['suction-airway', 'bronchodilator']) {
        const acted = advanceSimulation(
          applyIntervention(state, definition, action),
          400,
          definition,
        )
        const after = deriveEffectivePatient(acted, definition).mechanics.resistanceCmH2OPerLps
        expect({ caseId, action, lowered: after < before }).toEqual({
          caseId,
          action,
          lowered: true,
        })
      }
    }
  })
})

describe('MV-14 — securing the space is judged on the mechanics, not the blood pressure', () => {
  it('does not call drainage ineffective when the blood pressure holds', () => {
    const definition = definitionFor('MV-14')
    let state = committedPracticeState(definition, 'unstable')

    // The rescue first, watched to its own observation point.
    const rescue = applyIntervention(state, definition, 'decompress-pneumothorax')
    const rescueRecord = rescue.interventions.at(-1)
    if (!rescueRecord) throw new Error('Expected a decompression record')
    const rescueBaseline = capturePostActionBaseline(rescue, definition, rescueRecord)
    state = rescue
    for (let g = 0; !postActionObservation(state, rescueBaseline).complete && g < 8000; g += 1) {
      state = advanceSimulation(state, 0.1, definition)
    }
    const rescueCoaching = ventilationPostActionCoaching(state, definition, rescueBaseline)
    if (!rescueCoaching) throw new Error('Expected coaching for the decompression')
    expect(rescueCoaching.observed.find((reading) => reading.targeted)?.id).toBe('map')

    // Then the definitive drainage, again watched to its own observation point.
    const drained = applyIntervention(state, definition, 'pleural-drainage')
    const record = drained.interventions.at(-1)
    if (!record) throw new Error('Expected a drainage record')
    const baseline = capturePostActionBaseline(drained, definition, record)
    let settled = drained
    for (let g = 0; !postActionObservation(settled, baseline).complete && g < 20000; g += 1) {
      settled = advanceSimulation(settled, 0.1, definition)
    }
    const coaching = ventilationPostActionCoaching(settled, definition, baseline)
    if (!coaching) throw new Error('Expected coaching for the drainage')

    const target = coaching.observed.find((reading) => reading.targeted)
    expect(target?.id).toBe('peak-pressure')
    expect(target?.direction).toBe('fell')
    expect(coaching.interpretation).toContain(
      'the same breath is being delivered for less pressure',
    )
    expect(coaching.reassess).toContain('the rescue that raised it was the decompression')

    /*
     * The load-bearing assertion: hold the blood pressure exactly where the decompression left it and
     * the drainage is still reported as having responded. Before this correction the profile was
     * keyed on the blood pressure, so a patient whose circulation had already been rescued read as a
     * drainage that had failed.
     */
    const mapHeld = ventilationPostActionCoaching(settled, definition, {
      ...baseline,
      readings: { ...baseline.readings, map: coachingReadingSnapshot(settled).map },
    })
    if (!mapHeld) throw new Error('Expected coaching with the blood pressure held')
    expect(mapHeld.observed.find((reading) => reading.id === 'map')?.direction).toBe('held')
    expect(mapHeld.interpretation).toBe(coaching.interpretation)
    expect(mapHeld.interpretation).not.toContain('does not support')
  })
})

describe('clinical copy', () => {
  it('does not offer blockade as a way of obtaining a plateau', () => {
    const scenario = coachedScenario('MV-03', 'short-machine-ti', ['neuromuscular-blockade'], 60)
    const text = scenario.coachingText()
    expect(text).not.toBe('')
    expect(text).toContain('If blockade is complete and the hold is technically valid')
    expect(text).toContain('Blockade is not a way of obtaining a plateau')
    expect(text).toContain('immediate lung protection while the cause is corrected')
    expect(text).not.toContain('the one condition in which the elastic and resistive split')
  })

  it('does not turn the absence of an alarm into a conclusion about the patient', () => {
    const scenario = coachedScenario('MV-13', 'secretions', ['suction-airway'], 60)
    const stabilization = scenario.container.querySelector('[data-coaching-claim="stabilization"]')
    expect(stabilization).toHaveAttribute('data-stabilization-required', 'false')
    const text = stabilization?.textContent ?? ''
    expect(text).toContain(
      'No active safety interruption or high-priority ventilator alarm is shown',
    )
    expect(text).toContain('Continue immediate bedside reassessment')
    expect(text).toContain('do not establish that no stabilization or escalation is needed')
    expect(text).not.toContain('continue localizing rather than escalating')
  })

  it('never claims a mechanism is absent because one action did not move one reading', () => {
    /*
     * Sweep every action of every case at the pure non-response point and read both claims the block
     * makes about it. A treatment that did not move its reading is evidence about what is *dominant
     * over this interval*; it is not a demonstration that the mechanism is not there, and it must not
     * be written as one.
     *
     * Asked as a ban on the categorical phrasings rather than as a requirement for one sentence,
     * because several honest non-responses name no mechanism at all: sedation that has not moved is a
     * statement about the dose, and a communication board is not expected to move a monitor.
     */
    const categorical = [
      /\bis not what\b/,
      /\bis not the\b/,
      /\bare not the\b/,
      /\bis not coming from\b/,
      /\bwas not what\b/,
      /\bthere is none\b/,
    ]
    const offenders: string[] = []
    let treatmentsSwept = 0
    for (const definition of mechanicalVentilationCases) {
      for (const intervention of definition.interventions) {
        if (intervention.prerequisites?.length) continue
        const state = committedPracticeState(definition, definition.branchOptions[0])
        const acted = applyIntervention(state, definition, intervention.id)
        const record = acted.interventions.at(-1)
        if (!record) continue
        // Baseline taken from the settled state so nothing moves: the pure non-response case.
        let settled = acted
        const probe = capturePostActionBaseline(acted, definition, record)
        for (let g = 0; !postActionObservation(settled, probe).complete && g < 20000; g += 1) {
          settled = advanceSimulation(settled, 0.1, definition)
        }
        const coaching = ventilationPostActionCoaching(settled, definition, {
          ...probe,
          readings: coachingReadingSnapshot(settled),
        })
        if (!coaching || coaching.kind !== 'treatment') continue
        treatmentsSwept += 1
        for (const claim of [coaching.interpretation, coaching.notDemonstrated]) {
          const hit = categorical.find((pattern) => pattern.test(claim))
          if (hit) offenders.push(`${definition.id}/${intervention.id}: ${hit} in "${claim}"`)
        }
      }
    }
    expect(offenders).toEqual([])
    expect(treatmentsSwept).toBeGreaterThan(20)
  })

  it('uses the hedged shape wherever a non-response names a mechanism', () => {
    for (const [caseId, branch, action, phrase] of [
      ['MV-13', 'secretions', 'bronchodilator', 'does not support constricted airway muscle'],
      ['MV-13', 'hme-or-ett', 'suction-airway', 'does not support material in the lumen'],
      ['MV-08', 'leak', 'drain-condensate', 'does not support water at the sensor'],
      ['MV-06', 'unstable-asthma', 'disconnect-bag', 'does not support trapped gas'],
    ] as const) {
      const definition = definitionFor(caseId)
      let state = committedPracticeState(definition, branch)
      if (definition.interventions.find((item) => item.id === action)?.prerequisites?.length) {
        state = advanceSimulation(
          applyIntervention(state, definition, 'inspect-circuit'),
          30,
          definition,
        )
      }
      const acted = applyIntervention(state, definition, action)
      const record = acted.interventions.at(-1)
      if (!record) throw new Error(`${caseId}/${action} produced no record`)
      let settled = acted
      const probe = capturePostActionBaseline(acted, definition, record)
      for (let g = 0; !postActionObservation(settled, probe).complete && g < 20000; g += 1) {
        settled = advanceSimulation(settled, 0.1, definition)
      }
      const coaching = ventilationPostActionCoaching(settled, definition, {
        ...probe,
        readings: coachingReadingSnapshot(settled),
      })
      if (!coaching) throw new Error(`${caseId}/${action}: no coaching`)
      expect({ caseId, action, hedged: coaching.interpretation.includes(phrase) }).toEqual({
        caseId,
        action,
        hedged: true,
      })
      expect(coaching.interpretation).toContain('over this interval')
    }
  })
})
