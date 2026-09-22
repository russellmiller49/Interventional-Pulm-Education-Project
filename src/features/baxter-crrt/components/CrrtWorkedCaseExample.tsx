'use client'

import { BrainCircuit } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  isResolvableCrrtSourceId,
  resolveCrrtLearnerFacingSource,
} from '../content/learnerSourceMap'
import type {
  CrrtWorkedCaseExample,
  CrrtWorkedCheck,
  CrrtWorkedRunContext,
} from '../content/workedCaseExamples'
import type { CrrtLearningSessionState } from '../engine/learningSession'
import {
  crrtWorkedFilterTermIds,
  crrtWorkedPressureLocationSignals,
  crrtWorkedSignalIds,
  crrtWorkedSignals,
  formatCrrtWorkedClock,
  formatCrrtWorkedDifference,
  formatCrrtWorkedValue,
  resolveCrrtInterventionIdBySuffix,
  selectCrrtWorkedComparison,
  selectCrrtWorkedFilterTerms,
  selectCrrtWorkedPressureLocations,
  selectCrrtWorkedRunObservation,
  selectCrrtWorkedRunStart,
  snapshotCrrtWorkedSignals,
  type CrrtWorkedPressureLocationSignal,
  type CrrtWorkedSignalId,
} from '../workedCaseModel'
import playerStyles from './crrt-case-player.module.css'
import styles from './crrt-worked-case.module.css'

const directionLabels = { higher: 'Higher', lower: 'Lower', unchanged: 'No change' } as const

const locationSignalLabels: Readonly<Record<CrrtWorkedPressureLocationSignal, string>> = {
  access: 'Access',
  filter: 'Filter',
  return: 'Return',
  tmp: 'TMP',
  'filter-drop': 'Filter drop',
}

function citationText(sourceIds: readonly string[]): string {
  return sourceIds
    .filter(isResolvableCrrtSourceId)
    .map((id) => {
      const source = resolveCrrtLearnerFacingSource(id)
      const location = source.pageOrSection?.includes('http') ? null : source.pageOrSection
      return [source.sourceTitle, source.documentVersion, location].filter(Boolean).join(' · ')
    })
    .join('; ')
}

function runContext(session: CrrtLearningSessionState): CrrtWorkedRunContext {
  const snapshot = snapshotCrrtWorkedSignals(session.simulation)
  const formatted = Object.fromEntries(
    crrtWorkedSignalIds.map((id) => [id, formatCrrtWorkedValue(id, snapshot.values[id])]),
  ) as Record<CrrtWorkedSignalId, string>
  const prescription = session.simulation.prescription
  return {
    formatted,
    modalityLabel:
      prescription.status === 'configured' ? prescription.modality.toUpperCase() : 'Unavailable',
    anticoagulationListed:
      prescription.status === 'configured' && prescription.anticoagulation !== 'none',
  }
}

function WorkedCheck({ check, idBase }: { check: CrrtWorkedCheck; idBase: string }) {
  const [choiceId, setChoiceId] = useState<string | null>(null)
  const [checkedId, setCheckedId] = useState<string | null>(null)
  const [hintVisible, setHintVisible] = useState(false)
  const [explanationVisible, setExplanationVisible] = useState(false)
  const checked = check.options.find((option) => option.id === checkedId)

  return (
    <section className={styles.check} aria-labelledby={`${idBase}-heading`}>
      <h5 id={`${idBase}-heading`}>Try predicting · optional</h5>
      <p className={styles.caption}>{check.teachingPurpose}</p>
      <fieldset disabled={Boolean(checked)}>
        <legend>{check.prompt}</legend>
        {check.options.map((option) => (
          <label key={option.id}>
            <input
              type="radio"
              name={idBase}
              value={option.id}
              checked={(checkedId ?? choiceId) === option.id}
              onChange={() => setChoiceId(option.id)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <div className={styles.checkActions}>
        {checked ? (
          <button
            type="button"
            onClick={() => {
              setCheckedId(null)
              setChoiceId(null)
            }}
          >
            Try again
          </button>
        ) : (
          <button
            type="button"
            data-primary="true"
            disabled={!choiceId}
            onClick={() => setCheckedId(choiceId)}
          >
            Check reasoning
          </button>
        )}
        <button
          type="button"
          aria-expanded={hintVisible}
          onClick={() => setHintVisible((visible) => !visible)}
        >
          {hintVisible ? 'Hide hint' : 'Show hint'}
        </button>
        <button
          type="button"
          aria-expanded={explanationVisible}
          onClick={() => setExplanationVisible((visible) => !visible)}
        >
          {explanationVisible ? 'Hide explanation' : 'Show explanation'}
        </button>
      </div>
      {hintVisible ? <p className={styles.status}>{check.hint}</p> : null}
      {checked ? (
        <div className={styles.feedback} role="status">
          <strong>Reasoning feedback</strong>
          <p>{checked.feedback}</p>
          <p className={styles.caption}>
            Try again, open the explanation, or continue with the case. Nothing is recorded.
          </p>
        </div>
      ) : null}
      {explanationVisible ? (
        <div className={styles.feedback}>
          <strong>
            {checked ? 'Worked explanation' : 'Worked explanation · no answer recorded.'}
          </strong>
          <p>{check.explanation}</p>
          {check.options.map((option) => (
            <p key={option.id}>
              <strong>{option.label}.</strong> {option.feedback}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function ModeledComparison({
  session,
  example,
}: {
  session: CrrtLearningSessionState
  example: CrrtWorkedCaseExample
}) {
  const { caseDefinition, experience } = session
  const comparison = useMemo(
    () => selectCrrtWorkedComparison(caseDefinition, example, experience),
    [caseDefinition, example, experience],
  )
  return (
    <section>
      <h5>Modeled comparison</h5>
      <p className={styles.caption}>
        Computed by running this case twice from the same start through the simulation you control.
        It is an example, not your run.
      </p>
      <div
        className={styles.tableRegion}
        role="region"
        aria-label="Modeled comparison; horizontally scrollable"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Signal</th>
              <th scope="col">
                {comparison.armLabels[0]} · {formatCrrtWorkedClock(comparison.clocks[0])}
              </th>
              <th scope="col">
                {comparison.armLabels[1]} · {formatCrrtWorkedClock(comparison.clocks[1])}
              </th>
              <th scope="col">Difference</th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                <td>{formatCrrtWorkedValue(row.id, row.first)}</td>
                <td>{formatCrrtWorkedValue(row.id, row.second)}</td>
                <td>{formatCrrtWorkedDifference(row.id, row.difference)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul>
        {example.comparison.interpretation.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  )
}

function PressureLocations() {
  const rows = selectCrrtWorkedPressureLocations()
  return (
    <section>
      <h5>Pressure location comparison</h5>
      <p className={styles.caption}>
        Direction only, from the module&apos;s pressure-location model with one added resistance at
        a time at an illustrative operating point. Sizes, alarm limits and causes are not implied.
        The effluent-line row imposes a higher effluent pressure reading to show the TMP
        relationship; its direction is not universal.
      </p>
      <div
        className={styles.tableRegion}
        role="region"
        aria-label="Pressure location comparison; horizontally scrollable"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Added resistance at</th>
              {crrtWorkedPressureLocationSignals.map((signal) => (
                <th key={signal} scope="col">
                  {locationSignalLabels[signal]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.site}>
                <th scope="row">{row.siteLabel}</th>
                {crrtWorkedPressureLocationSignals.map((signal) => (
                  <td key={signal} data-direction={row.directions[signal]}>
                    {directionLabels[row.directions[signal]]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * The domain table. It describes the current run and what the run can and cannot
 * verify, so it belongs with the task rather than behind "Explain this case": a
 * learner planning a response to recurrent filter loss needs to know which
 * contributors this run can speak to before choosing one (F-05).
 */
function FilterDomainTable({
  session,
  example,
}: {
  session: CrrtLearningSessionState
  example: CrrtWorkedCaseExample
}) {
  const demonstration = example.domainDemonstration
  if (!demonstration) return null
  const context = runContext(session)
  const terms = selectCrrtWorkedFilterTerms(session.simulation)
  const active = new Set(terms?.activeTermIds ?? [])
  const activeLabels = crrtWorkedFilterTermIds
    .filter((id) => active.has(id))
    .map((id) => demonstration.filterTermLabels[id])
  const inactiveLabels = crrtWorkedFilterTermIds
    .filter((id) => !active.has(id))
    .map((id) => demonstration.filterTermLabels[id])

  return (
    <section>
      <h5>Contributors, domain by domain</h5>
      <div
        className={styles.tableRegion}
        role="region"
        aria-label="Filter-loss domains; horizontally scrollable"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Domain</th>
              <th scope="col">This run now</th>
              <th scope="col">Can the run verify it?</th>
              <th scope="col">Decided by</th>
            </tr>
          </thead>
          <tbody>
            {demonstration.domains.map((domain) => (
              <tr key={domain.id}>
                <th scope="row">{domain.label}</th>
                <td>{domain.thisRun(context)}</td>
                <td>{domain.canVerify}</td>
                <td>{domain.decidedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {terms ? (
        <p className={styles.caption}>
          Filter-burden terms active in the simulator now:{' '}
          {activeLabels.length > 0 ? activeLabels.join(', ') : 'none'}. Inactive:{' '}
          {inactiveLabels.length > 0 ? inactiveLabels.join(', ') : 'none'}. This is the
          simulator&apos;s weighting, not a clinical ranking.
        </p>
      ) : null}
    </section>
  )
}

/** The authored summary itself, which stays with the worked explanation. */
function FilterDomainTeamSummary({
  session,
  example,
}: {
  session: CrrtLearningSessionState
  example: CrrtWorkedCaseExample
}) {
  const demonstration = example.domainDemonstration
  if (!demonstration) return null
  const context = runContext(session)
  return (
    <section>
      <h5>Worked team summary from this run</h5>
      <ul>
        {demonstration.teamSummary(context).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  )
}

/** Expected (modeled) and observed (this session) side by side; shared by the guide and debrief. */
export function CrrtWorkedRunComparison({
  session,
  example,
  heading = 'Your run',
}: {
  session: CrrtLearningSessionState
  example: CrrtWorkedCaseExample
  heading?: string
}) {
  const { caseDefinition, fixture, experience, roleLens, attempt } = session
  const deviceId = session.simulation.deviceId
  const start = useMemo(
    () =>
      selectCrrtWorkedRunStart({
        caseDefinition,
        fixture,
        experience,
        roleLens,
        attempt,
        deviceId,
      }),
    [caseDefinition, fixture, experience, roleLens, attempt, deviceId],
  )
  const comparison = useMemo(
    () => selectCrrtWorkedComparison(caseDefinition, example, experience),
    [caseDefinition, example, experience],
  )
  const observation = selectCrrtWorkedRunObservation(session, example, start)
  const missingActionLabels = observation.comparisonActionIds
    .filter((id) => !observation.performedComparisonActionIds.includes(id))
    .map((id) => caseDefinition.interventions.find((item) => item.id === id)?.label ?? id)
  const statusText =
    observation.status === 'not-started'
      ? 'No run yet: you have not performed a case action or advanced time. The modeled values are an example, not your observation.'
      : observation.status === 'actions-without-time'
        ? 'You performed case actions, but simulated time has not advanced. Advance time to observe a response.'
        : `Your run is at ${formatCrrtWorkedClock(observation.current.timeSeconds)}.${
            observation.comparisonActionIds.length === 0
              ? ''
              : missingActionLabels.length === 0
                ? ' You performed the comparison actions.'
                : ` Not performed in this run: ${missingActionLabels.join('; ')}.`
          }`
  const differenceById = new Map(comparison.rows.map((row) => [row.id, row.difference]))

  return (
    <section className={styles.runComparison}>
      <h5>{heading}</h5>
      <p className={styles.status}>{statusText}</p>
      <div
        className={styles.tableRegion}
        role="region"
        aria-label={`${heading}; horizontally scrollable`}
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Signal</th>
              <th scope="col">Start of your run</th>
              <th scope="col">
                Your run · {formatCrrtWorkedClock(observation.current.timeSeconds)}
              </th>
              <th scope="col">Your change</th>
              <th scope="col">Modeled difference</th>
            </tr>
          </thead>
          <tbody>
            {example.comparison.signalIds.map((id) => {
              const first = observation.start.values[id]
              const now = observation.current.values[id]
              return (
                <tr key={id}>
                  <th scope="row">{crrtWorkedSignals[id].label}</th>
                  <td>{formatCrrtWorkedValue(id, first)}</td>
                  <td>{formatCrrtWorkedValue(id, now)}</td>
                  <td>
                    {formatCrrtWorkedDifference(
                      id,
                      first === null || now === null ? null : now - first,
                    )}
                  </td>
                  <td>{formatCrrtWorkedDifference(id, differenceById.get(id) ?? null)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.caption}>
        Modeled difference: {comparison.armLabels[1]} compared with {comparison.armLabels[0]}.{' '}
        {example.comparison.runNote}
      </p>
      {example.comparison.signalIds.includes('urea-marker') ? (
        <p className={styles.caption}>
          The small-solute marker is a model pool advanced by delivered clearance alone. It is not a
          measured patient laboratory value, and this exercise does not model how a patient&rsquo;s
          chemistry would actually respond.
        </p>
      ) : null}
    </section>
  )
}

function WorkedExampleBody({
  session,
  example,
}: {
  session: CrrtLearningSessionState
  example: CrrtWorkedCaseExample
}) {
  const current = snapshotCrrtWorkedSignals(session.simulation)
  return (
    <section aria-label="Worked example" className={styles.example}>
      <section>
        <h5>Learning point</h5>
        <p className={styles.learningPoint}>{session.caseDefinition.hiddenMechanism.summary}</p>
      </section>
      <section>
        <h5>Read these values now</h5>
        <dl className={styles.values}>
          {example.readFirst.map((id) => (
            <div key={id}>
              <dt>{crrtWorkedSignals[id].label}</dt>
              <dd>{formatCrrtWorkedValue(id, current.values[id])}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.caption}>
          {example.readFirstNote} Simulated clock: {formatCrrtWorkedClock(current.timeSeconds)}.
        </p>
      </section>
      <ModeledComparison session={session} example={example} />
      {example.demonstration === 'pressure-locations' ? <PressureLocations /> : null}
      {example.demonstration === 'filter-domains' ? (
        <FilterDomainTeamSummary session={session} example={example} />
      ) : null}
      <CrrtWorkedRunComparison session={session} example={example} />
      <section>
        <h5>Taught here, not shown by the simulator</h5>
        <ul>
          {example.taughtNotShown.map((note) => (
            <li key={note.text}>
              {note.text}
              <span className={styles.citation}>
                {note.sourceIds.length > 0
                  ? citationText(note.sourceIds)
                  : 'No registered source yet; awaiting clinical review.'}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h5>What to reassess</h5>
        <ul>
          {example.reassess.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section>
        <h5>Acceptable alternatives and uncertainty</h5>
        <ul>
          {example.alternatives.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section>
        <h5>Awaiting clinical review</h5>
        <ul>
          {example.awaitingReview.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <p className={styles.caption}>
        Viewing this example records no answer, intervention, or observation. Clinical and device
        review remains pending.
      </p>
    </section>
  )
}

export function CrrtWorkedCaseGuide({
  session,
  example,
  scopedId,
}: {
  session: CrrtLearningSessionState
  example: CrrtWorkedCaseExample
  scopedId: (id: string) => string
}) {
  const [exampleVisible, setExampleVisible] = useState(false)
  const definition = session.caseDefinition
  const actionLabel = (suffix: string) => {
    const id = resolveCrrtInterventionIdBySuffix(definition, suffix)
    return definition.interventions.find((intervention) => intervention.id === id)?.label ?? id
  }

  return (
    <section
      className={playerStyles.predictionSection}
      aria-labelledby={scopedId('crrt-prediction-heading')}
    >
      <div className={playerStyles.workflowHeading}>
        <BrainCircuit aria-hidden="true" />
        <div>
          <span>Worked example</span>
          <h4 id={scopedId('crrt-prediction-heading')}>Understand this case</h4>
        </div>
      </div>
      <div className={styles.guide}>
        <p className={styles.goal}>{example.revision.goal}</p>
        <div className={styles.tryIt}>
          <h5>Try it in this run</h5>
          <ol>
            {example.tryIt.map((step) => (
              <li key={step.text}>
                {step.text}
                {step.actionSuffixes.length > 0 ? (
                  <span className={styles.citation}>
                    Case actions: {step.actionSuffixes.map(actionLabel).join(' → ')}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
        {example.demonstration === 'filter-domains' ? (
          <FilterDomainTable session={session} example={example} />
        ) : null}
        {example.check ? (
          <WorkedCheck check={example.check} idBase={scopedId(example.check.id)} />
        ) : null}
        <div>
          <button
            type="button"
            className={playerStyles.commitButton}
            aria-expanded={exampleVisible}
            onClick={() => setExampleVisible((visible) => !visible)}
          >
            {exampleVisible ? 'Hide worked example' : 'Explain this case'}
          </button>
        </div>
      </div>
      {exampleVisible ? <WorkedExampleBody session={session} example={example} /> : null}
    </section>
  )
}
