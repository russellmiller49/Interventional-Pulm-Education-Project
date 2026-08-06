'use client'

import { useEffect, useId, useState } from 'react'

import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'

import {
  PAWP_BALLOON_NUMBERS_BOUNDARY,
  PAWP_BOUNDARY_NOTICE,
  pawpCaptureSteps,
  pawpOcclusionOutcomes,
  pawpPlausibilityCommitment,
  pawpRecoveryCommitment,
  pawpRecoveryOutcomes,
  waveformAtlasById,
} from '../content'
import type { HemodynamicSimulationState } from '../engine'
import styles from './icu-hemodynamics.module.css'
import { WaveformAtlasFigure } from './WaveformAtlasFigure'

/**
 * PAWP acquisition with its safety loop closed (H3 §7).
 *
 * The station's live controls stay where they were — inflate, cursor, store, deflate are still real
 * actions on the simulation. What this adds is the judging: the plausibility of the occlusion
 * tracing has to be committed to before its reasoning appears, and the return of the
 * pulmonary-artery waveform has to be *answered* rather than read.
 *
 * The last part is why the recovery check shows two tracings. The simulation's own deflation always
 * restores the pulmonary-artery waveform, so if the only state a learner ever met were the live one,
 * "did it come back?" would be a question with one possible answer and no teaching in it. The second
 * tracing is an authored teaching state, labelled as one, in which the occlusion morphology persists
 * after deflation — and it is the state in which continuation is withheld.
 *
 * The balloon state is shown as words in both places it appears: the live readout at the top and the
 * text equivalent of each figure.
 */

const PA_RETURN_CHECK = 'pa-waveform-return-confirmed'

export { PA_RETURN_CHECK }

function balloonStateLine(state: HemodynamicSimulationState): {
  readonly words: string
  readonly inflated: boolean
} {
  const { catheter } = state
  if (catheter.floatBalloonInflated) {
    return {
      words:
        'Flow-directed balloon INFLATED for passage through the right heart. This is not the occlusion inflation, and no occlusion pressure may be sampled from it.',
      inflated: true,
    }
  }
  if (catheter.balloonInflated) {
    return {
      words:
        'Occlusion balloon INFLATED. An occlusion is running right now and is meant to be brief.',
      inflated: true,
    }
  }
  return {
    words:
      'Balloon DEFLATED. No balloon inflation accounts for an occlusion waveform. Persistent occlusion morphology after deflation is abnormal and requires reassessment — deflating the balloon does not by itself establish that distal occlusion has ended.',
    inflated: false,
  }
}

function OcclusionOutcomes() {
  const [choiceId, setChoiceId] = useState<string | null>(null)
  const [committed, setCommitted] = useState(false)
  const groupName = useId()

  return (
    <section className={styles.pawpSubsection} aria-label="What a brief occlusion can produce">
      <h4>Three things an occlusion can produce</h4>
      <fieldset className={styles.pawpChoices}>
        <legend>{pawpPlausibilityCommitment.stem}</legend>
        {pawpPlausibilityCommitment.choices.map((choice) => (
          <label key={choice.id}>
            <input
              type="radio"
              name={groupName}
              checked={choiceId === choice.id}
              disabled={committed}
              onChange={() => setChoiceId(choice.id)}
            />
            <span>{choice.label}</span>
          </label>
        ))}
        {committed ? null : (
          <button
            type="button"
            className={styles.paneButton}
            disabled={choiceId === null}
            onClick={() => setCommitted(true)}
          >
            Commit this judgement
          </button>
        )}
      </fieldset>

      {committed && choiceId ? (
        <>
          <AnswerVerdict
            item={pawpPlausibilityCommitment}
            choiceId={choiceId}
            timing="immediate-after-commit"
            theme="dark"
          />
          <ul className={styles.pawpOutcomeList}>
            {pawpOcclusionOutcomes.map((outcome) => {
              const atlasEntry = waveformAtlasById.get(outcome.atlasEntryId)
              return (
                <li
                  key={outcome.id}
                  data-occlusion-outcome={outcome.id}
                  data-interpretable={outcome.plausiblyInterpretable ? 'true' : 'false'}
                >
                  <div className={styles.pawpOutcomeHead}>
                    <strong>{outcome.label}</strong>
                    <span>
                      {outcome.plausiblyInterpretable
                        ? 'Plausibly interpretable'
                        : 'Not interpretable'}
                    </span>
                  </div>
                  {atlasEntry ? (
                    <WaveformAtlasFigure entry={atlasEntry} annotated={false} beats={3} compact />
                  ) : null}
                  <p>{outcome.whatYouSee}</p>
                  <p>
                    <em>Verdict: </em>
                    {outcome.verdict}
                  </p>
                  <p>
                    <em>Next: </em>
                    {outcome.nextAction}
                  </p>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
    </section>
  )
}

function RecoveryCheck({ onConfirmed }: { readonly onConfirmed: () => void }) {
  const groupName = useId()
  const [answers, setAnswers] = useState<Readonly<Record<string, boolean>>>({})
  const [choiceId, setChoiceId] = useState<string | null>(null)
  const [committed, setCommitted] = useState(false)

  const allAnsweredAsAuthored = pawpRecoveryOutcomes.every(
    (outcome) => answers[outcome.id] === outcome.paWaveformReturned,
  )
  const confirmed = allAnsweredAsAuthored && committed

  useEffect(() => {
    if (confirmed) onConfirmed()
  }, [confirmed, onConfirmed])

  return (
    <section
      className={styles.pawpSubsection}
      aria-label="Confirm the pulmonary-artery waveform returns"
    >
      <h4>After deflation: has the pulmonary-artery waveform come back?</h4>
      <p className={styles.pawpTeachingState}>
        Two post-deflation tracings. The first is what this simulation produces when you deflate.
        The second is an authored teaching state — the simulation will not generate it for you, and
        it is the one the sequence exists to catch.
      </p>

      <ul className={styles.pawpOutcomeList}>
        {pawpRecoveryOutcomes.map((outcome) => {
          const atlasEntry = waveformAtlasById.get(outcome.atlasEntryId)
          const answered = answers[outcome.id]
          const answeredAsAuthored = answered === outcome.paWaveformReturned
          return (
            <li
              key={outcome.id}
              data-recovery-outcome={outcome.id}
              data-continuation={outcome.continuationPermitted ? 'permitted' : 'withheld'}
            >
              <div className={styles.pawpOutcomeHead}>
                <strong>{outcome.label}</strong>
                <span>Balloon DEFLATED · depth unchanged</span>
              </div>
              {atlasEntry ? (
                <WaveformAtlasFigure
                  // The atlas entry supplies the shape only. Its caption metadata belongs to the
                  // state it was authored for — the wedge entry's own caption reads "balloon
                  // inflated at the pulmonary artery position", which is the opposite of the state
                  // this card is about and sat directly beneath a "balloon deflated" label.
                  entry={{ ...atlasEntry, normalRange: null, insertionDepth: null }}
                  annotated={false}
                  beats={3}
                  compact
                  channelLabel="PA · after deflation"
                  figureDescription={`Tracing on the pulmonary-artery channel after the balloon has been deflated. ${outcome.whatYouSee}`}
                />
              ) : null}
              <p>{outcome.whatYouSee}</p>

              <fieldset className={styles.pawpChoices}>
                <legend>Has the pulmonary-artery waveform returned?</legend>
                {[
                  {
                    id: 'yes',
                    label: 'Yes — pulsatility and the dicrotic notch are back',
                    value: true,
                  },
                  { id: 'no', label: 'No — the occlusion morphology is still there', value: false },
                ].map((option) => (
                  <label key={option.id}>
                    <input
                      type="radio"
                      name={`${groupName}-${outcome.id}`}
                      checked={answers[outcome.id] === option.value}
                      onChange={() =>
                        setAnswers((current) => ({ ...current, [outcome.id]: option.value }))
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>

              {answered !== undefined ? (
                <p
                  className={styles.pawpRecoveryVerdict}
                  data-withheld={outcome.continuationPermitted ? undefined : 'true'}
                  role="status"
                >
                  {answeredAsAuthored ? (
                    <>
                      <strong>
                        {outcome.continuationPermitted
                          ? 'Return confirmed — the sequence may go on.'
                          : 'No return — continuation is withheld here.'}
                      </strong>{' '}
                      {outcome.whatItMeans} {outcome.requiredResponse}
                    </>
                  ) : (
                    <strong>
                      Look again at the tracing above before answering: the question is whether
                      pulsatility and the dicrotic notch are present.
                    </strong>
                  )}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>

      <fieldset className={styles.pawpChoices}>
        <legend>{pawpRecoveryCommitment.stem}</legend>
        {pawpRecoveryCommitment.choices.map((choice) => (
          <label key={choice.id}>
            <input
              type="radio"
              name={groupName}
              checked={choiceId === choice.id}
              disabled={committed}
              onChange={() => setChoiceId(choice.id)}
            />
            <span>{choice.label}</span>
          </label>
        ))}
        {committed ? null : (
          <button
            type="button"
            className={styles.paneButton}
            disabled={choiceId === null || !allAnsweredAsAuthored}
            onClick={() => setCommitted(true)}
          >
            Commit what follows
          </button>
        )}
      </fieldset>

      {committed && choiceId ? (
        <AnswerVerdict
          item={pawpRecoveryCommitment}
          choiceId={choiceId}
          timing="immediate-after-commit"
          theme="dark"
        />
      ) : null}

      <p className={styles.pawpRecoveryStatus} role="status" aria-live="polite">
        {confirmed
          ? 'Return of the pulmonary-artery waveform has been assessed in both states. This station will accept completion.'
          : 'Return of the pulmonary-artery waveform has not been assessed yet. Completion is withheld until it is.'}
      </p>
    </section>
  )
}

export function PawpSafetySequencePanel({
  state,
  onRecoveryConfirmed,
}: {
  readonly state: HemodynamicSimulationState
  readonly onRecoveryConfirmed: () => void
}) {
  const headingId = useId()
  const balloon = balloonStateLine(state)

  return (
    <section className={styles.pawpPanel} aria-labelledby={headingId}>
      <header>
        <span className={styles.paneEyebrow}>Brief occlusion, closed loop</span>
        <h2 id={headingId}>Acquire a PAWP, and then prove the occlusion ended</h2>
        <p className={styles.paneIntro}>
          The actions are in the live controls. The judgements are here, and the sequence is not
          finished when the balloon comes down — it is finished when you have confirmed the
          pulmonary-artery waveform came back.
        </p>
      </header>

      <p
        className={styles.pawpBalloonState}
        data-inflated={balloon.inflated ? 'true' : 'false'}
        role="status"
        aria-live="polite"
      >
        <span>Balloon state</span>
        <strong>{balloon.words}</strong>
      </p>

      <ol className={styles.pawpSteps} aria-label="PAWP acquisition safety sequence">
        {pawpCaptureSteps.map((step) => (
          <li key={step.id} className={styles.pawpStep}>
            <div className={styles.pawpStepHead}>
              <span className={styles.advanceStepOrdinal}>{step.order}</span>
              <h3>{step.shortLabel}</h3>
            </div>
            <p className={styles.pawpStepQuestion}>{step.question}</p>
            <dl>
              <div>
                <dt>What you do: </dt>
                <dd>{step.whatYouDo}</dd>
              </div>
              <div>
                <dt>What it establishes: </dt>
                <dd>{step.whatItEstablishes}</dd>
              </div>
              <div>
                <dt>What it does not: </dt>
                <dd>{step.whatItDoesNotEstablish}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>

      <OcclusionOutcomes />
      <RecoveryCheck onConfirmed={onRecoveryConfirmed} />

      <p className={styles.paneCaveat}>{PAWP_BALLOON_NUMBERS_BOUNDARY}</p>
      <p className={styles.paneCaveat}>{PAWP_BOUNDARY_NOTICE}</p>
    </section>
  )
}
