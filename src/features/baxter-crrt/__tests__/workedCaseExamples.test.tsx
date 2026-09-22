import { fireEvent, render, screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { useReducer } from 'react'

import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity'

import { CrrtCasePlayer } from '../components/CrrtCasePlayer'
import { getBaxterCrrtCase } from '../content/completeCases'
import { crrtSourceSupportsClaim, isResolvableCrrtSourceId } from '../content/learnerSourceMap'
import { normalizeRuntimeCrrtCaseToEngineFixture } from '../content/runtimeCaseNormalization'
import {
  CRRT_WORKED_CASE_EXAMPLE_VERSION,
  crrtWorkedCaseExamples,
  getCrrtWorkedCaseExample,
  type CrrtWorkedCaseExample,
  type CrrtWorkedRunContext,
} from '../content/workedCaseExamples'
import { selectCrrtConsoleControls } from '../engine/consoleControls'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningExperience,
  type CrrtLearningSessionState,
} from '../engine/learningSession'
import { crrtSimulationReducer } from '../engine/reducer'
import {
  CRRT_WORKED_EQUIVALENCE_TOLERANCE,
  crrtWorkedSignalIds,
  resolveCrrtInterventionIdBySuffix,
  runCrrtWorkedArm,
  selectCrrtWorkedComparison,
  selectCrrtWorkedFilterTerms,
  selectCrrtWorkedPressureLocations,
  selectCrrtWorkedRetiredIds,
  snapshotCrrtWorkedSignals,
} from '../workedCaseModel'

const workedCaseIds = ['CRRT-05', 'CRRT-15', 'CRRT-16'] as const
type WorkedCaseId = (typeof workedCaseIds)[number]

const implementationTerms =
  /\b(?:synthetic|authored|candidate|reviewer|private learning|assessment gate|deterministic|canonical|device adapter|engine fixture|calibration|projection|source-mapped|bounded|model-derived|engine|pending SME|informational provenance)\b/i

function exampleFor(caseId: WorkedCaseId): CrrtWorkedCaseExample {
  const example = getCrrtWorkedCaseExample(caseId)
  if (!example) throw new Error(`Missing worked example for ${caseId}`)
  return example
}

function experienceFor(caseId: WorkedCaseId): CrrtLearningExperience {
  return caseId === 'CRRT-16' ? 'mastery' : 'practice'
}

function freshSession(caseId: WorkedCaseId): CrrtLearningSessionState {
  return createCrrtLearningSession({
    caseDefinition: getBaxterCrrtCase(caseId),
    experience: experienceFor(caseId),
    roleLens: 'integrated',
    attempt: 1,
    deviceId: 'prismax-aw8035-2xx',
  })
}

function sampleContext(caseId: WorkedCaseId): CrrtWorkedRunContext {
  return {
    formatted: Object.fromEntries(
      crrtWorkedSignalIds.map((id) => [id, `${caseId} ${id}`]),
    ) as CrrtWorkedRunContext['formatted'],
    modalityLabel: 'CVVHDF',
    anticoagulationListed: false,
  }
}

function authoredCopy(example: CrrtWorkedCaseExample): string[] {
  const { revision, check, comparison } = example
  return [
    example.learningPoint,
    example.readFirstNote,
    ...example.tryIt.map(({ text }) => text),
    ...comparison.arms.map(({ label }) => label),
    ...comparison.interpretation,
    comparison.runNote,
    ...example.taughtNotShown.map(({ text }) => text),
    ...example.reassess,
    ...example.alternatives,
    ...example.awaitingReview,
    example.retired.reason,
    ...(check
      ? [
          check.teachingPurpose,
          check.prompt,
          check.hint,
          check.explanation,
          ...check.options.flatMap(({ label, feedback }) => [label, feedback]),
        ]
      : []),
    ...(example.domainDemonstration
      ? [
          ...example.domainDemonstration.domains.flatMap(({ label, canVerify, decidedBy }) => [
            label,
            canVerify,
            decidedBy,
          ]),
          ...Object.values(example.domainDemonstration.filterTermLabels),
        ]
      : []),
    revision.goal,
    ...(revision.patientDescription ? [revision.patientDescription] : []),
    ...(revision.visibleFindings ?? []),
    ...revision.hints,
    ...Object.values(revision.interventions).flatMap((copy) =>
      [copy.label, copy.description, copy.response].filter((text): text is string => !!text),
    ),
    revision.reassessmentLabel,
    revision.debrief.summary,
    revision.debrief.trendReview,
    ...revision.debrief.causalChain,
    revision.debrief.transferQuestion,
  ]
}

describe('CRRT-02 worked case content', () => {
  it('covers exactly CRRT-05, CRRT-15 and the former capstone CRRT-16', () => {
    expect(crrtWorkedCaseExamples.map(({ caseId }) => caseId)).toEqual([...workedCaseIds])
    expect(CRRT_WORKED_CASE_EXAMPLE_VERSION).toBe('crrt-02-worked-examples-2026-09-14')
    expect(getCrrtWorkedCaseExample('CRRT-04')).toBeUndefined()
  })

  it.each(workedCaseIds)(
    '%s runtime copy is the authored worked-case teaching, unaltered',
    (id) => {
      const example = exampleFor(id)
      const definition = getBaxterCrrtCase(id)
      const { revision } = example

      expect(definition.hiddenMechanism.summary).toBe(example.learningPoint)
      expect(definition.hiddenMechanism.causalChain).toEqual(revision.debrief.causalChain)
      expect(
        definition.goalOptions.find(
          ({ id: optionId }) => optionId === definition.hiddenMechanism.correctGoalOptionId,
        )?.label,
      ).toBe(revision.goal)
      expect(
        [...definition.hintLadder]
          .sort((left, right) => left.sequence - right.sequence)
          .map(({ text }) => text),
      ).toEqual(revision.hints)
      expect(definition.debrief).toMatchObject({
        summary: revision.debrief.summary,
        trendReview: revision.debrief.trendReview,
        causalChain: revision.debrief.causalChain,
        transferQuestion: revision.debrief.transferQuestion,
      })
      const [requiredReassessmentId] = definition.requiredReassessmentIds
      expect(
        definition.reassessmentOptions.find(
          ({ id: optionId }) => optionId === requiredReassessmentId,
        )?.label,
      ).toBe(revision.reassessmentLabel)
      for (const [suffix, copy] of Object.entries(revision.interventions)) {
        const intervention = definition.interventions.find(({ id: actionId }) =>
          actionId.endsWith(suffix),
        )
        expect(intervention).toMatchObject(copy)
      }
      if (revision.patientDescription) {
        expect(definition.patientDescription).toBe(revision.patientDescription)
      }
      if (revision.visibleFindings)
        expect(definition.visibleFindings).toEqual(revision.visibleFindings)
    },
  )

  it.each(workedCaseIds)('%s copy stays clinical, ungraded and free of software terms', (id) => {
    const example = exampleFor(id)
    const copy = authoredCopy(example)
    for (const text of copy) {
      expect({ text, flagged: flaggedLearnerCopyTerms(text) }).toEqual({ text, flagged: [] })
      expect(text).not.toMatch(implementationTerms)
    }
    const dynamic = example.domainDemonstration
      ? [
          ...example.domainDemonstration.domains.map(({ thisRun }) => thisRun(sampleContext(id))),
          ...example.domainDemonstration.teamSummary(sampleContext(id)),
        ]
      : []
    for (const text of dynamic) expect(text).not.toMatch(implementationTerms)
  })

  it.each(workedCaseIds)('%s cites resolvable sources and claims only audited topics', (id) => {
    for (const note of exampleFor(id).taughtNotShown) {
      for (const sourceId of note.sourceIds) expect(isResolvableCrrtSourceId(sourceId)).toBe(true)
      for (const topic of note.claimTopics) {
        expect(note.sourceIds.some((sourceId) => crrtSourceSupportsClaim(sourceId, topic))).toBe(
          true,
        )
      }
    }
  })

  it('keeps each retained check optional reinforcement with explanation, hint and one modeled match', () => {
    for (const example of crrtWorkedCaseExamples) {
      const { check } = example
      if (example.caseId === 'CRRT-16') {
        expect(check).toBeNull()
        continue
      }
      expect(check).not.toBeNull()
      if (!check) continue
      expect(check.options.length).toBeGreaterThanOrEqual(3)
      expect(new Set(check.options.map(({ id }) => id)).size).toBe(check.options.length)
      expect(check.options.filter(({ matchesExample }) => matchesExample)).toHaveLength(1)
      for (const text of [check.teachingPurpose, check.hint, check.explanation]) {
        expect(text.length).toBeGreaterThan(30)
      }
      for (const option of check.options) expect(option.feedback.length).toBeGreaterThan(60)
    }
  })

  it.each(workedCaseIds)('%s retires only generic options that still exist in the record', (id) => {
    const definition = getBaxterCrrtCase(id)
    const retired = selectCrrtWorkedRetiredIds(definition, exampleFor(id))
    expect([...retired.interventionIds]).toEqual([
      resolveCrrtInterventionIdBySuffix(definition, 'action-unsafe-candidate'),
    ])
    expect(definition.unsafeActions.map(({ actionId }) => actionId)).toEqual([
      ...retired.interventionIds,
    ])
    expect(retired.reassessmentOptionIds.size).toBe(1)
    for (const optionId of retired.reassessmentOptionIds) {
      expect(definition.requiredReassessmentIds).not.toContain(optionId)
    }
  })
})

function rowsById(caseId: WorkedCaseId) {
  const comparison = selectCrrtWorkedComparison(
    getBaxterCrrtCase(caseId),
    exampleFor(caseId),
    experienceFor(caseId),
  )
  return new Map(comparison.rows.map((row) => [row.id, row]))
}

describe('CRRT-02 explanations match the simulation', () => {
  it('CRRT-05: only the flow split differs, and the baseline is unchanged by the added source', () => {
    const rows = rowsById('CRRT-05')
    expect(rows.get('pre-replacement-flow')).toMatchObject({ first: 0, second: 900 })
    expect(rows.get('post-replacement-flow')).toMatchObject({ first: 1_200, second: 300 })
    for (const [id, row] of rows) {
      if (id === 'pre-replacement-flow' || id === 'post-replacement-flow') continue
      expect({ id, difference: row.difference }).toEqual({ id, difference: expect.any(Number) })
      expect(Math.abs(row.difference ?? Number.NaN)).toBeLessThanOrEqual(
        CRRT_WORKED_EQUIVALENCE_TOLERANCE,
      )
    }
    expect(rows.get('delivered-dose')?.second).toBeCloseTo(1_250 / 76, 6)
    expect(rows.get('downtime')?.second).toBe(0)

    // Values recorded from the case before the pre-filter source was added (probe, 2026-09-14).
    expect(rows.get('prescribed-dose')?.first).toBeCloseTo(16.447, 3)
    expect(rows.get('urea-marker')?.first).toBeCloseTo(23.213, 3)
    expect(rows.get('filter-pressure')?.first).toBeCloseTo(80.099, 3)
    expect(rows.get('tmp')?.first).toBeCloseTo(59.549, 3)
  })

  it('CRRT-05: without a pre-filter source, the same split would have stopped all delivery', () => {
    const definition = getBaxterCrrtCase('CRRT-05')
    const fixture = normalizeRuntimeCrrtCaseToEngineFixture(definition)
    let session = createCrrtLearningSession({
      caseDefinition: definition,
      fixture: {
        ...fixture,
        bags: (fixture.bags ?? []).filter(({ flowTerm }) => flowTerm !== 'pre-replacement'),
      },
      experience: 'practice',
      roleLens: 'integrated',
      attempt: 1,
    })
    for (const suffix of ['action-assess', 'action-safe-candidate']) {
      session = crrtLearningSessionReducer(session, {
        type: 'PERFORM_INTERVENTION',
        interventionId: resolveCrrtInterventionIdBySuffix(definition, suffix),
      })
    }
    session = crrtLearningSessionReducer(session, { type: 'ADVANCE_TIME', seconds: 3_600 })
    expect(session.simulation.deliveredTherapy.deliveredDoseMlKgHour).toBe(0)
    expect(session.simulation.deliveredTherapy.cumulativeDowntimeSeconds).toBe(3_600)
  })

  it('CRRT-05: the split is a real machine control and the dose display does not move', () => {
    const session = freshSession('CRRT-05')
    const splitId = resolveCrrtInterventionIdBySuffix(
      session.caseDefinition,
      'action-safe-candidate',
    )
    expect(selectCrrtConsoleControls(session).settingActions.map(({ id }) => id)).toEqual([splitId])
    const check = exampleFor('CRRT-05').check
    const match = check?.options.find(({ matchesExample }) => matchesExample)
    expect(match?.id).toBe('unchanged')
    expect(rowsById('CRRT-05').get('prescribed-dose')?.difference).toBe(0)
  })

  it('CRRT-15: six hours give a filter-side pattern well under 1 mmHg, with TMP moving half as far', () => {
    const rows = rowsById('CRRT-15')
    const filterRise = rows.get('filter-pressure')?.difference ?? Number.NaN
    expect(filterRise).toBeGreaterThan(0)
    expect(filterRise).toBeLessThan(1)
    expect(rows.get('filter-drop')?.difference).toBeCloseTo(filterRise, 9)
    expect(rows.get('tmp')?.difference).toBeCloseTo(filterRise / 2, 9)
    for (const id of ['access-pressure', 'return-pressure', 'effluent-pressure'] as const) {
      expect(rows.get(id)?.difference).toBe(0)
    }
    const after = snapshotCrrtWorkedSignals(
      runCrrtWorkedArm(getBaxterCrrtCase('CRRT-15'), exampleFor('CRRT-15').comparison.arms[1])
        .simulation,
    )
    expect(after.values['delivered-dose']).toBeCloseTo(after.values['prescribed-dose'] ?? 0, 9)
    expect(after.values.downtime).toBe(0)
  })

  it('CRRT-15: no case action raises the low-effective-flow term above its starting value', () => {
    const definition = getBaxterCrrtCase('CRRT-15')
    const start = freshSession('CRRT-15').simulation.circuit.filter.lowEffectiveBloodFlowFraction
    expect(start).toBe(0)
    for (const intervention of definition.interventions) {
      let session = freshSession('CRRT-15')
      for (const id of [...intervention.prerequisites, intervention.id]) {
        session = crrtLearningSessionReducer(session, {
          type: 'PERFORM_INTERVENTION',
          interventionId: id,
        })
      }
      expect(session.performedInterventionIds).toContain(intervention.id)
      expect(session.simulation.circuit.filter.lowEffectiveBloodFlowFraction).toBeLessThanOrEqual(
        start,
      )
    }
  })

  it('CRRT-15: the location check feedback follows the pressure-location model', () => {
    const signatures = new Map(selectCrrtWorkedPressureLocations().map((row) => [row.site, row]))
    const check = exampleFor('CRRT-15').check
    expect(check?.options.map(({ id }) => id)).toEqual([
      'access-catheter',
      'filter',
      'return-line',
      'effluent-line',
    ])
    for (const option of check?.options ?? []) {
      const row = signatures.get(option.id as 'filter')
      expect(row).toBeDefined()
      const directions = row!.directions
      const matchesPrompt =
        directions.filter === 'higher' &&
        directions['filter-drop'] === 'higher' &&
        directions.return === 'unchanged'
      expect({ option: option.id, matchesPrompt }).toEqual({
        option: option.id,
        matchesPrompt: option.matchesExample,
      })
    }
    expect(signatures.get('access-catheter')?.directions).toMatchObject({
      access: 'lower',
      filter: 'unchanged',
      return: 'unchanged',
      'filter-drop': 'unchanged',
    })
    expect(signatures.get('return-line')?.directions).toMatchObject({
      filter: 'higher',
      return: 'higher',
      'filter-drop': 'unchanged',
    })
    const effluent = signatures.get('effluent-line')?.directions
    expect(effluent).toMatchObject({
      filter: 'unchanged',
      return: 'unchanged',
      'filter-drop': 'unchanged',
    })
    expect(effluent?.tmp).not.toBe('unchanged')
  })

  it('CRRT-16: recording the plan leaves every modeled signal unchanged', () => {
    for (const row of rowsById('CRRT-16').values()) {
      expect({ id: row.id, difference: row.difference }).toEqual({ id: row.id, difference: 0 })
    }
    const definition = getBaxterCrrtCase('CRRT-16')
    expect(definition.interventions.flatMap(({ effects }) => effects)).toEqual([])
  })

  it('CRRT-16: filter-burden terms at the start are access, filtration and hematocrit, as stated', () => {
    const session = freshSession('CRRT-16')
    const terms = selectCrrtWorkedFilterTerms(session.simulation)
    expect(terms?.activeTermIds).toEqual(['access', 'filtration', 'hematocrit'])
    const sum = Object.values(terms?.termRiskIndex ?? {}).reduce((total, value) => total + value, 0)
    expect(sum).toBeCloseTo(terms?.unprotectedRiskIndex ?? Number.NaN, 12)

    const parameters = session.simulation.scenario.modelConfiguration.filter
    const advanced = crrtLearningSessionReducer(session, { type: 'ADVANCE_TIME', seconds: 60 })
    expect(advanced.simulation.circuit.filter.foulingBurdenFraction).toBeCloseTo(
      (parameters?.foulingFractionPerHourAtRiskOne ?? Number.NaN) *
        (terms?.unprotectedRiskIndex ?? Number.NaN) *
        (60 / 3_600),
      12,
    )

    const paused = crrtSimulationReducer(session.simulation, {
      type: 'SET_DELIVERY_STATE',
      deliveryState: 'paused',
    })
    expect(selectCrrtWorkedFilterTerms(paused)?.activeTermIds).toContain('interruption')

    const rows = rowsById('CRRT-16')
    const sixHours = snapshotCrrtWorkedSignals(
      runCrrtWorkedArm(
        definitionFor('CRRT-16'),
        exampleFor('CRRT-16').comparison.arms[0],
        'mastery',
      ).simulation,
    )
    const start = snapshotCrrtWorkedSignals(session.simulation)
    const filterRise =
      (sixHours.values['filter-pressure'] ?? 0) - (start.values['filter-pressure'] ?? 0)
    expect(filterRise).toBeGreaterThan(0)
    expect(filterRise).toBeLessThan(1)
    expect(rows.size).toBe(exampleFor('CRRT-16').comparison.signalIds.length)
  })
})

function definitionFor(caseId: WorkedCaseId) {
  return getBaxterCrrtCase(caseId)
}

function Player({ caseId }: { caseId: WorkedCaseId }) {
  const [session, dispatch] = useReducer(
    crrtLearningSessionReducer,
    {
      caseDefinition: getBaxterCrrtCase(caseId),
      experience: experienceFor(caseId),
      roleLens: 'integrated' as const,
      attempt: 1,
      deviceId: 'prismax-aw8035-2xx' as const,
    },
    createCrrtLearningSession,
  )
  return (
    <>
      <CrrtCasePlayer
        session={session}
        dispatch={dispatch}
        onRoleChange={() => {}}
        onReset={() => dispatch({ type: 'RESET', attempt: session.attempt + 1 })}
        idNamespace={`worked-${caseId}`}
        showSharedStepper={false}
      />
      <output data-testid="session-facts">
        {JSON.stringify({
          prediction: session.prediction,
          actions: session.performedInterventionIds,
          reassessment: session.reassessment,
          time: session.simulation.simulationTimeSeconds,
        })}
      </output>
    </>
  )
}

const facts = () => JSON.parse(screen.getByTestId('session-facts').textContent ?? '{}')
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

function checkSection() {
  return screen.getByRole('heading', { name: 'Try predicting · optional' }).closest('section')!
}

function actionArticle(label: string) {
  const actions = screen
    .getByRole('heading', { name: 'Choose and sequence clinical actions' })
    .closest('section')!
  const article = within(actions)
    .getAllByRole('article')
    .find((candidate) => candidate.textContent?.includes(label))
  if (!article) throw new Error(`No action article for ${label}`)
  return article
}

describe('CRRT-02 worked cases in the case player', () => {
  beforeEach(() => window.localStorage.clear())

  it.each(workedCaseIds)(
    '%s teaches from context through explanation with no answer, run or stored record',
    async (caseId) => {
      const example = exampleFor(caseId)
      const definition = getBaxterCrrtCase(caseId)
      const retired = selectCrrtWorkedRetiredIds(definition, example)
      render(<Player caseId={caseId} />)
      const initial = facts()

      expect(screen.getByText(example.revision.goal)).toBeInTheDocument()
      for (const id of retired.interventionIds) {
        const label = definition.interventions.find((item) => item.id === id)?.label ?? id
        expect(screen.queryByText(label)).toBeNull()
      }
      expect(screen.queryByText('Do not reassess after the intervention')).toBeNull()

      click('Explain this case')
      const region = screen.getByRole('region', { name: 'Worked example' })
      expect(region).toHaveTextContent(example.learningPoint)
      expect(region).toHaveTextContent('Modeled comparison')
      expect(region).toHaveTextContent('It is an example, not your run.')
      expect(region).toHaveTextContent('No run yet')
      expect(region).toHaveTextContent('no answer, intervention, or observation')
      for (const line of example.comparison.interpretation) expect(region).toHaveTextContent(line)
      expect(await axe(region)).toHaveNoViolations()

      click('Reveal hint 1')
      expect(screen.getAllByText(example.revision.hints[0]).length).toBeGreaterThan(0)
      expect(facts()).toEqual(initial)

      click('End run and review debrief')
      expect(screen.getByText('Debrief opened · no run performed')).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: 'Expected and observed in this case' }),
      ).toBeVisible()
      expect(facts()).toEqual(initial)
      expect(window.localStorage).toHaveLength(0)
    },
  )

  it('CRRT-05 check allows explanation first, a hint, a different answer, retry and continue', () => {
    render(<Player caseId="CRRT-05" />)
    const initial = facts()
    const check = within(checkSection())

    fireEvent.click(check.getByRole('button', { name: 'Show explanation' }))
    expect(check.getByText('Worked explanation · no answer recorded.')).toBeInTheDocument()
    expect(check.queryByRole('radio', { checked: true })).toBeNull()
    fireEvent.click(check.getByRole('button', { name: 'Show hint' }))
    expect(check.getByText(exampleFor('CRRT-05').check!.hint)).toBeInTheDocument()

    expect(check.getByRole('button', { name: 'Check reasoning' })).toBeDisabled()
    fireEvent.click(check.getByRole('radio', { name: 'It falls, because the blood is diluted' }))
    fireEvent.click(check.getByRole('button', { name: 'Check reasoning' }))
    expect(check.getByRole('status')).toHaveTextContent(
      'The dilution is real, but the display is built from the effluent rate',
    )
    fireEvent.click(check.getByRole('button', { name: 'Try again' }))
    expect(check.queryByRole('radio', { checked: true })).toBeNull()
    expect(check.queryByRole('status')).toBeNull()
    expect(facts()).toEqual(initial)
    expect(window.localStorage).toHaveLength(0)
  })

  it('CRRT-05 compares the actual split and clock with the modeled difference', () => {
    render(<Player caseId="CRRT-05" />)
    const split = actionArticle('Change the pre/post replacement split')
    expect(within(split).getByRole('button')).toBeDisabled()
    fireEvent.click(
      within(actionArticle('Complete the initial clinical assessment')).getByRole('button'),
    )
    fireEvent.click(within(split).getByRole('button'))
    click('Explain this case')
    expect(screen.getByRole('region', { name: 'Worked example' })).toHaveTextContent(
      'You performed case actions, but simulated time has not advanced.',
    )
    click('+1 hr')
    const region = screen.getByRole('region', { name: 'Worked example' })
    expect(region).toHaveTextContent('Your run is at 1 hr. You performed the comparison actions.')
    const yourRun = within(region).getByRole('region', {
      name: 'Your run; horizontally scrollable',
    })
    const preRow = within(yourRun)
      .getByRole('rowheader', { name: 'Pre-filter replacement' })
      .closest('tr')!
    expect(within(preRow).getAllByText('+900 mL/h')).toHaveLength(2)
    const doseRow = within(yourRun)
      .getByRole('rowheader', { name: 'Prescribed effluent dose' })
      .closest('tr')!
    expect(within(doseRow).getAllByText('No change')).toHaveLength(2)

    click('End run and review debrief')
    expect(
      screen.getByText(/^Debrief opened · \d+ recorded events? in this run$/),
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('region', {
          name: 'Expected and observed in this case; horizontally scrollable',
        }),
      ).getAllByText('+900 mL/h'),
    ).toHaveLength(2)
  })

  it('CRRT-15 location feedback and comparison table follow the model', () => {
    render(<Player caseId="CRRT-15" />)
    const check = within(checkSection())
    fireEvent.click(check.getByRole('radio', { name: 'Return line' }))
    fireEvent.click(check.getByRole('button', { name: 'Check reasoning' }))
    expect(check.getByRole('status')).toHaveTextContent('Here return pressure did not change.')

    click('Explain this case')
    const table = screen.getByRole('region', {
      name: 'Pressure location comparison; horizontally scrollable',
    })
    const filterRow = within(table).getByRole('rowheader', { name: 'Filter' }).closest('tr')!
    expect(
      within(filterRow)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['No change', 'Higher', 'No change', 'Higher', 'Higher'])
    expect(
      screen.queryByText('Label the trend as anticoagulation failure and escalate blindly'),
    ).toBeNull()
  })

  it('CRRT-16 domain table and team summary say the recorded plan leaves the circuit unchanged', () => {
    render(<Player caseId="CRRT-16" />)
    expect(screen.queryByRole('heading', { name: 'Try predicting · optional' })).toBeNull()
    // The domain table describes the current run and what the run can verify, so it
    // is in the task before any reveal; only the authored team summary is behind it.
    const domains = screen.getByRole('region', {
      name: 'Filter-loss domains; horizontally scrollable',
    })
    expect(within(domains).getAllByRole('row')).toHaveLength(6)
    expect(domains).toHaveTextContent(
      'No anticoagulation method is listed in this case prescription.',
    )
    expect(
      screen.getByText(
        /Filter-burden terms active in the simulator now: Access dysfunction, Filtration fraction, Hematocrit\./,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Worked team summary from this run')).toBeNull()
    click('Explain this case')
    const region = screen.getByRole('region', { name: 'Worked example' })
    expect(region).toHaveTextContent('Worked team summary from this run')
    expect(region).toHaveTextContent(
      'delivered dose not yet charted against 20.6 mL/kg/h prescribed',
    )
    expect(screen.getAllByText(/do not change the simulated circuit/).length).toBeGreaterThan(0)
  })
})
