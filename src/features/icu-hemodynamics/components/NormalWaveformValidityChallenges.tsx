'use client'

import { useId, useState } from 'react'

import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'

import {
  NORMAL_WAVEFORM_INTERPRETATION_WITHHELD,
  NORMAL_WAVEFORM_RESPIRATORY_CONTEXT,
  NORMAL_WAVEFORM_SHARED_SCALE_MAX_MMHG,
  normalWaveformAtlasEntry,
  normalWaveformReferenceEntry,
  normalWaveformValidityChallenges,
  type NormalWaveformValidityChallenge,
} from '../content'
import { validityWithheldHeading } from '../content/normalWaveformValidityChallenges'
import styles from './icu-hemodynamics.module.css'
import { HemodynamicsExplanation } from './stage/HemodynamicsQuestion'
import { WaveformAtlasFigure } from './WaveformAtlasFigure'

/**
 * The interaction that stops the reference from producing confident misreaders (H2 §5).
 *
 * Each card draws one of the four normal tracings through one authored display fault and asks for a
 * reading. The reasoning appears when the learner checks one or asks to see it — it never waits on
 * an answer (HD-01). Before a reading or a reveal the readout names nothing. Afterwards it gives two
 * separate answers (HD-PRE-REVIEW-02, report L3-09): whether the shape still names the chamber, and
 * whether the number can be used. An off-level transducer leaves a right-atrial shape that names
 * the right atrium and a number that cannot be used; damping takes both. A recognizable shape on
 * an untrustworthy display is a recognized chamber only when the fault left the shape alone — and
 * never a usable number by itself.
 *
 * Nothing here gates. Skipping every card leaves the rest of the section, and every other station,
 * exactly as reachable as before.
 */

interface ChallengeProgress {
  readonly choiceId: string | null
  readonly committed: boolean
  readonly shown: boolean
}

const EMPTY_PROGRESS: ChallengeProgress = { choiceId: null, committed: false, shown: false }

function ChallengeCard({
  challenge,
  progress,
  onChoiceChange,
  onCommit,
  onShow,
  onTryAgain,
}: {
  readonly challenge: NormalWaveformValidityChallenge
  readonly progress: ChallengeProgress
  readonly onChoiceChange: (choiceId: string) => void
  readonly onCommit: () => void
  readonly onShow: () => void
  readonly onTryAgain: () => void
}) {
  const entry = normalWaveformReferenceEntry(challenge.position)
  const atlasEntry = normalWaveformAtlasEntry(entry)
  const groupName = useId()
  const readoutId = useId()

  const isRespiratory = challenge.faultKind === 'respiratory-phase-mismatch'

  return (
    <article className={styles.validityChallengeCard}>
      <header>
        <span className={styles.paneEyebrow}>{challenge.label}</span>
        <p className={styles.validityChallengeChannel}>
          Displayed channel: <strong>{challenge.displayedChannelLabel}</strong> · axis 0–
          {challenge.fault.scaleMaxMmHg ?? NORMAL_WAVEFORM_SHARED_SCALE_MAX_MMHG}{' '}
          {entry.displayUnit}
        </p>
      </header>

      <WaveformAtlasFigure
        entry={atlasEntry}
        channelLabel={challenge.displayedChannelLabel}
        scaleMaxMmHg={NORMAL_WAVEFORM_SHARED_SCALE_MAX_MMHG}
        annotated={false}
        ecgLandmarks
        respiration={{
          swingMmHg: entry.respiratorySwingMmHg,
          cyclesPerStrip: NORMAL_WAVEFORM_RESPIRATORY_CONTEXT.cyclesPerStrip,
          endExpirationPhase: NORMAL_WAVEFORM_RESPIRATORY_CONTEXT.endExpirationPhase,
          modeLabel: NORMAL_WAVEFORM_RESPIRATORY_CONTEXT.mode,
          readAtStripFraction: challenge.fault.readAtStripFraction,
          readMarkerLabel: isRespiratory ? 'reading taken here' : undefined,
        }}
        fault={{
          levelOffsetMmHg: challenge.fault.levelOffsetMmHg,
          scaleMaxMmHg: challenge.fault.scaleMaxMmHg,
          artifact: challenge.fault.artifact,
          dampingRatio: challenge.fault.dampingRatio,
          naturalFrequencyHz: challenge.fault.naturalFrequencyHz,
        }}
        figureDescription={challenge.figureTextEquivalent}
      />

      <p
        id={readoutId}
        className={styles.validityChallengeReadout}
        data-withheld={
          progress.committed || progress.shown
            ? challenge.readout.chamber.identifiable
              ? 'value-only'
              : 'true'
            : 'true'
        }
        role="status"
        aria-live="polite"
      >
        <span>Chamber readout</span>
        {progress.committed || progress.shown ? (
          <>
            <strong
              data-chamber-reading={challenge.readout.chamber.identifiable ? 'named' : 'withheld'}
            >
              Chamber:{' '}
              {challenge.readout.chamber.identifiable
                ? challenge.readout.chamber.words
                : `${NORMAL_WAVEFORM_INTERPRETATION_WITHHELD} — ${challenge.readout.chamber.words}`}
            </strong>
            <strong data-value-reading>Value: {challenge.readout.value}</strong>
          </>
        ) : (
          <strong>Not established yet — check a reading or show the reasoning</strong>
        )}
      </p>

      <fieldset className={styles.validityChallengeChoices}>
        <legend>{challenge.commitment.stem}</legend>
        {challenge.commitment.choices.map((choice) => (
          <label key={choice.id}>
            <input
              type="radio"
              name={groupName}
              checked={progress.choiceId === choice.id}
              disabled={progress.committed}
              aria-describedby={readoutId}
              onChange={() => onChoiceChange(choice.id)}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </fieldset>

      {(progress.committed && progress.choiceId) || progress.shown ? (
        <div className={styles.validityChallengeReveal}>
          {progress.committed && progress.choiceId ? (
            <AnswerVerdict
              item={challenge.commitment}
              choiceId={progress.choiceId}
              timing="immediate-after-commit"
              theme="dark"
            />
          ) : (
            <HemodynamicsExplanation item={challenge.commitment} />
          )}
          <dl>
            <div>
              <dt>What you see</dt>
              <dd>{challenge.whatYouSee}</dd>
            </div>
            <div>
              <dt>What it invites</dt>
              <dd>{challenge.whatItInvites}</dd>
            </div>
            <div>
              <dt>{validityWithheldHeading(challenge)}</dt>
              <dd>{challenge.whyInterpretationIsWithheld}</dd>
            </div>
            <div>
              <dt>Repair or re-read first</dt>
              <dd>{challenge.repairFirst}</dd>
            </div>
          </dl>
          <details>
            <summary>Read this display as text</summary>
            <p>{challenge.figureTextEquivalent}</p>
          </details>
        </div>
      ) : null}
      <div role="group" aria-label="Reading actions" data-validity-actions>
        {progress.committed ? (
          <button type="button" className={styles.paneButton} onClick={onTryAgain}>
            Try again
          </button>
        ) : (
          <>
            <button
              type="button"
              className={styles.paneButton}
              disabled={progress.choiceId === null}
              onClick={onCommit}
            >
              Check this reading
            </button>
            <button
              type="button"
              className={styles.paneButton}
              aria-expanded={progress.shown}
              onClick={onShow}
            >
              {progress.shown ? 'Hide the reasoning' : 'Show the reasoning'}
            </button>
          </>
        )}
      </div>
    </article>
  )
}

export function NormalWaveformValidityChallenges() {
  const headingId = useId()
  const [index, setIndex] = useState(0)
  const [progressById, setProgressById] = useState<Readonly<Record<string, ChallengeProgress>>>({})

  const challenge = normalWaveformValidityChallenges[index]
  if (!challenge) return null
  const progress = progressById[challenge.id] ?? EMPTY_PROGRESS

  function update(next: ChallengeProgress) {
    setProgressById((current) => ({ ...current, [challenge!.id]: next }))
  }

  return (
    <section className={styles.validityChallengePanel} aria-labelledby={headingId}>
      <header>
        <span className={styles.paneEyebrow}>Recognize before you interpret</span>
        <h3 id={headingId}>Can you name the chamber from this display?</h3>
        <p className={styles.paneIntro}>
          Each of these draws one of the four normal tracings through a display problem. The
          physiology underneath is normal every time. Check a reading, or open the reasoning
          directly.
        </p>
        <p className={styles.validityChallengeCount} role="status" aria-live="polite">
          Display problem {index + 1} of {normalWaveformValidityChallenges.length}
        </p>
      </header>

      <div
        className={styles.validityChallengeNav}
        role="group"
        aria-label="Choose a display problem"
      >
        {normalWaveformValidityChallenges.map((candidate, candidateIndex) => (
          <button
            key={candidate.id}
            type="button"
            aria-current={candidateIndex === index ? 'true' : undefined}
            aria-label={candidate.label}
            onClick={() => setIndex(candidateIndex)}
          >
            <span aria-hidden="true">{candidateIndex + 1}</span>
            {candidate.label}
          </button>
        ))}
      </div>

      <ChallengeCard
        key={challenge.id}
        challenge={challenge}
        progress={progress}
        onChoiceChange={(choiceId) => update({ ...progress, choiceId })}
        onCommit={() => update({ ...progress, committed: true })}
        onShow={() => update({ ...progress, shown: !progress.shown })}
        onTryAgain={() => update({ ...progress, committed: false, choiceId: null })}
      />

      <p className={styles.atlasBoundary} role="note">
        These are display problems drawn onto normal tracings, using the same distortion behavior
        the live monitor applies. Nothing here is a calibrated device trace, and a real monitor
        filters and damps differently.
      </p>
    </section>
  )
}
