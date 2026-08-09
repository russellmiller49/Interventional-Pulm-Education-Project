'use client'

import { useId, useState } from 'react'

import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'

import {
  PAC_ADVANCEMENT_UNSOURCED_BOUNDARY_NOTICE,
  advancementMayContinue,
  advancementStopReasons,
  normalWaveformReferenceEntry,
  pacAdvancementCommitmentLabels,
  pacAdvancementScenarios,
  pacAdvancementStopReasonLabels,
  prebriefStopConditionFor,
  safeAdvancementCommitments,
  type PacAdvancementCommitment,
  type PacAdvancementScenario,
} from '../content'
import styles from './icu-hemodynamics.module.css'

/**
 * Advancement as a decision, not a button (H3 §6).
 *
 * The chain is rendered in full before the learner commits: signal validity, the current tracing,
 * what the reference says should change next, the rhythm, and the patient. Resistance, balloon
 * state, and the depth readout are shown too — an observable that only appeared after the decision
 * would teach that it did not need to be part of it.
 *
 * The commitment is made before anything is revealed, and the panel never advances itself. Whether
 * continuing is safe is read from `advancementStopReasons`, which does not look at whether the
 * waveform matched — so an expected morphology cannot cancel a stop condition here, and could not be
 * made to without changing that function.
 */

interface ScenarioProgress {
  readonly choiceId: string | null
  readonly committed: boolean
}

const EMPTY: ScenarioProgress = { choiceId: null, committed: false }

function ObservationRow({
  ordinal,
  label,
  statement,
  concerning,
  okWord = 'Nothing objects',
  concernWord = 'Reason to stop',
}: {
  readonly ordinal: number
  readonly label: string
  readonly statement: string
  readonly concerning: boolean
  readonly okWord?: string
  readonly concernWord?: string
}) {
  return (
    <li className={styles.advanceStep} data-concerning={concerning || undefined}>
      <div className={styles.advanceStepHead}>
        <span className={styles.advanceStepOrdinal}>{ordinal}</span>
        <h4>{label}</h4>
        <span className={styles.advanceStepStatus} data-concerning={concerning || undefined}>
          {concerning ? concernWord : okWord}
        </span>
      </div>
      <p>{statement}</p>
    </li>
  )
}

function ScenarioChain({
  scenario,
  progress,
  onChoiceChange,
  onCommit,
  onContinue,
  hasNext,
}: {
  readonly scenario: PacAdvancementScenario
  readonly progress: ScenarioProgress
  readonly onChoiceChange: (choiceId: string) => void
  readonly onCommit: () => void
  readonly onContinue: () => void
  readonly hasNext: boolean
}) {
  const groupName = useId()
  const stopReasons = advancementStopReasons(scenario)
  const mayContinue = advancementMayContinue(scenario)
  const safeCommitments = safeAdvancementCommitments(scenario)
  const prebriefCondition = prebriefStopConditionFor(scenario)
  const nextEntry = scenario.nextPosition
    ? normalWaveformReferenceEntry(scenario.nextPosition)
    : null
  const chosenWasSafe =
    progress.choiceId !== null &&
    safeCommitments.includes(progress.choiceId as PacAdvancementCommitment)

  return (
    <div className={styles.advanceChain}>
      <ol className={styles.advanceSteps}>
        <ObservationRow
          ordinal={1}
          label="Is the pressure signal trustworthy?"
          statement={scenario.signalValidity.statement}
          concerning={scenario.signalValidity.concerning}
          okWord="Trustworthy"
          concernWord="Not trustworthy"
        />
        <ObservationRow
          ordinal={2}
          label="What is the current tracing, and where does that put the tip?"
          statement={scenario.currentTracing.statement}
          concerning={scenario.currentTracing.concerning}
          okWord={
            scenario.currentTracing.matchesPosition
              ? `Matches the ${scenario.currentTracing.matchesPosition.toUpperCase()} reference`
              : 'No chamber claimed'
          }
          concernWord="Not what this position predicts"
        />
        <li className={styles.advanceStep}>
          <div className={styles.advanceStepHead}>
            <span className={styles.advanceStepOrdinal}>3</span>
            <h4>What should change next?</h4>
            <span className={styles.advanceStepStatus}>
              {nextEntry ? `Next: ${nextEntry.position.toUpperCase()}` : 'Destination reached'}
            </span>
          </div>
          <p>
            {nextEntry
              ? nextEntry.expectedChangeFromPrevious
              : 'Nothing further. The pulmonary artery is where the catheter rests between measurements, and any wedge maneuver is a separate sequence from a confirmed position here.'}
          </p>
        </li>
        <ObservationRow
          ordinal={4}
          label="Rhythm, watched continuously"
          statement={scenario.rhythm.statement}
          concerning={scenario.rhythm.concerning}
        />
        <ObservationRow
          ordinal={4}
          label="The patient, as distinct from the tracing"
          statement={scenario.patient.statement}
          concerning={scenario.patient.concerning}
        />
        <ObservationRow
          ordinal={4}
          label="Does the catheter move freely?"
          statement={scenario.resistance.statement}
          concerning={scenario.resistance.concerning}
        />
        <ObservationRow
          ordinal={4}
          label="Balloon state"
          statement={scenario.balloon.statement}
          concerning={scenario.balloon.concerning}
        />
        <ObservationRow
          ordinal={4}
          label="Depth readout, against the waveform"
          statement={scenario.depth.statement}
          concerning={scenario.depth.concerning}
        />
      </ol>

      <fieldset className={styles.advanceCommit}>
        <legend>
          <span className={styles.advanceStepOrdinal}>5</span>
          {scenario.commitment.stem}
        </legend>
        {scenario.commitment.choices.map((choice) => (
          <label key={choice.id}>
            <input
              type="radio"
              name={groupName}
              checked={progress.choiceId === choice.id}
              disabled={progress.committed}
              onChange={() => onChoiceChange(choice.id)}
            />
            <span>
              <strong>
                {pacAdvancementCommitmentLabels[choice.id as PacAdvancementCommitment] ?? choice.id}
              </strong>
              {choice.label}
            </span>
          </label>
        ))}
        {progress.committed ? null : (
          <button
            type="button"
            className={styles.paneButton}
            disabled={progress.choiceId === null}
            onClick={onCommit}
          >
            Commit this decision
          </button>
        )}
      </fieldset>

      {progress.committed && progress.choiceId ? (
        <div className={styles.advanceReveal}>
          <AnswerVerdict
            item={scenario.commitment}
            choiceId={progress.choiceId}
            timing="immediate-after-commit"
            theme="dark"
          />

          <ol className={styles.advanceSteps} start={6}>
            <li className={styles.advanceStep}>
              <div className={styles.advanceStepHead}>
                <span className={styles.advanceStepOrdinal}>6</span>
                <h4>What followed</h4>
              </div>
              <p>{scenario.observed}</p>
            </li>
            <li className={styles.advanceStep}>
              <div className={styles.advanceStepHead}>
                <span className={styles.advanceStepOrdinal}>7</span>
                <h4>Reconciling waveform, depth, rhythm, patient, resistance, and balloon</h4>
              </div>
              <p>{scenario.reconciliation}</p>
            </li>
            <li
              className={styles.advanceStep}
              data-concerning={mayContinue ? undefined : true}
              data-continuation={mayContinue ? 'permitted' : 'withheld'}
            >
              <div className={styles.advanceStepHead}>
                <span className={styles.advanceStepOrdinal}>8</span>
                <h4>Is continuing safe here?</h4>
                <span
                  className={styles.advanceStepStatus}
                  data-concerning={mayContinue ? undefined : true}
                >
                  {mayContinue ? 'Continuing is defensible' : 'Continuing is not safe'}
                </span>
              </div>
              <p>{scenario.justification}</p>
              {stopReasons.length > 0 ? (
                <ul className={styles.advanceStopReasons} aria-label="Reasons to stop here">
                  {stopReasons.map((reason) => (
                    <li key={reason} data-stop-reason={reason}>
                      {pacAdvancementStopReasonLabels[reason]}
                    </li>
                  ))}
                </ul>
              ) : null}
              {scenario.currentTracing.matchesPosition && stopReasons.length > 0 ? (
                <p className={styles.advanceOverridePoint}>
                  The tracing matches the {scenario.currentTracing.matchesPosition.toUpperCase()}{' '}
                  reference and that changes nothing here. A waveform confirms which chamber the tip
                  is in. It is never evidence about the rhythm, the patient, the resistance, the
                  balloon, or the depth.
                </p>
              ) : null}
              <p className={styles.advanceCommitmentVerdict} role="status">
                {chosenWasSafe
                  ? 'The decision you committed to is one this situation supports.'
                  : 'The decision you committed to is not one this situation supports. Read the reasoning above before moving on.'}
              </p>
            </li>
          </ol>

          {prebriefCondition ? (
            <section
              className={styles.advancePrebriefEcho}
              aria-label="The prebrief stop condition this exercises"
            >
              <h4>From the safety prebrief</h4>
              <p>
                <strong>{prebriefCondition.trigger}</strong>
              </p>
              <p>{prebriefCondition.response}</p>
            </section>
          ) : null}

          {scenario.unsourcedBoundary ? (
            <section
              className={styles.advanceBoundary}
              aria-label="What this module does not teach here"
            >
              <h4>Not covered here</h4>
              <p>{scenario.unsourcedBoundary}</p>
              <p>{PAC_ADVANCEMENT_UNSOURCED_BOUNDARY_NOTICE}</p>
            </section>
          ) : null}

          <button type="button" className={styles.paneButton} onClick={onContinue}>
            {hasNext ? 'Continue to the next situation' : 'Finish the last situation and stay here'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function PacAdvancementReasoningPanel({
  onWorkedThroughAll,
}: {
  readonly onWorkedThroughAll?: () => void
}) {
  const headingId = useId()
  const [index, setIndex] = useState(0)
  const [progressById, setProgressById] = useState<Readonly<Record<string, ScenarioProgress>>>({})

  const scenario = pacAdvancementScenarios[index]
  if (!scenario) return null
  const progress = progressById[scenario.id] ?? EMPTY
  const committedCount = pacAdvancementScenarios.filter(
    (candidate) => progressById[candidate.id]?.committed,
  ).length
  const hasNext = index < pacAdvancementScenarios.length - 1

  function commit() {
    if (!scenario) return
    const next = { ...progress, committed: true }
    const updated = { ...progressById, [scenario.id]: next }
    setProgressById(updated)
    if (pacAdvancementScenarios.every((candidate) => updated[candidate.id]?.committed)) {
      onWorkedThroughAll?.()
    }
  }

  return (
    <section className={styles.advancePanel} aria-labelledby={headingId}>
      <header>
        <span className={styles.paneEyebrow}>Every step, every time</span>
        <h3 id={headingId}>Decide before you move</h3>
        <p className={styles.paneIntro}>
          Recognizing the expected waveform tells you where the tip is. It does not tell you whether
          to keep going. Read the whole situation, commit, and only then see what followed.
        </p>
        <p className={styles.advanceCount} role="status" aria-live="polite">
          Situation {index + 1} of {pacAdvancementScenarios.length} · {committedCount} worked
          through
        </p>
      </header>

      <div className={styles.advanceNav} role="group" aria-label="Choose an advancement situation">
        {pacAdvancementScenarios.map((candidate, candidateIndex) => (
          <button
            key={candidate.id}
            type="button"
            aria-current={candidateIndex === index ? 'true' : undefined}
            aria-label={`${candidate.title}${progressById[candidate.id]?.committed ? ' — worked through' : ''}`}
            onClick={() => setIndex(candidateIndex)}
          >
            <span aria-hidden="true">{candidateIndex + 1}</span>
            {candidate.title}
            {progressById[candidate.id]?.committed ? <em aria-hidden="true">✓</em> : null}
          </button>
        ))}
      </div>

      <ScenarioChain
        key={scenario.id}
        scenario={scenario}
        progress={progress}
        hasNext={hasNext}
        onChoiceChange={(choiceId) =>
          setProgressById((current) => ({
            ...current,
            [scenario.id]: { ...progress, choiceId },
          }))
        }
        onCommit={commit}
        onContinue={() =>
          setIndex((current) => Math.min(pacAdvancementScenarios.length - 1, current + 1))
        }
      />

      <p className={styles.atlasBoundary} role="note">
        Supervised simulation. Working through these situations does not establish the ability to
        place or manage a pulmonary-artery catheter, and a real procedure requires the current
        manufacturer instructions for the catheter in use, your local protocol, continuous
        monitoring, and direct supervision.
      </p>
    </section>
  )
}
