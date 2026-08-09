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
import styles from './icu-hemodynamics.module.css'
import { WaveformAtlasFigure } from './WaveformAtlasFigure'

/**
 * The interaction that stops the reference from producing confident misreaders (H2 §5).
 *
 * Each card draws one of the four normal tracings through one authored display fault, asks the
 * learner to commit, and only then shows the reasoning. The chamber readout never names a chamber:
 * before the commitment it says the reading has not been made yet, and afterwards it says plainly
 * that this display cannot support one. That is the whole lesson — a recognizable shape on an
 * untrustworthy display is not a recognized chamber.
 *
 * Nothing here gates. Skipping every card leaves the rest of the section, and every other station,
 * exactly as reachable as before.
 */

interface ChallengeProgress {
  readonly choiceId: string | null
  readonly committed: boolean
}

const EMPTY_PROGRESS: ChallengeProgress = { choiceId: null, committed: false }

function ChallengeCard({
  challenge,
  progress,
  onChoiceChange,
  onCommit,
}: {
  readonly challenge: NormalWaveformValidityChallenge
  readonly progress: ChallengeProgress
  readonly onChoiceChange: (choiceId: string) => void
  readonly onCommit: () => void
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
        data-withheld="true"
        role="status"
        aria-live="polite"
      >
        <span>Chamber readout</span>
        <strong>
          {progress.committed
            ? NORMAL_WAVEFORM_INTERPRETATION_WITHHELD
            : 'Not established yet — commit your reading first'}
        </strong>
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

      {progress.committed && progress.choiceId ? (
        <div className={styles.validityChallengeReveal}>
          <AnswerVerdict
            item={challenge.commitment}
            choiceId={progress.choiceId}
            timing="immediate-after-commit"
            theme="dark"
          />
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
              <dt>Why no chamber can be named</dt>
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
      ) : (
        <button
          type="button"
          className={styles.paneButton}
          disabled={progress.choiceId === null}
          onClick={onCommit}
        >
          Commit this reading
        </button>
      )}
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
  const committedCount = normalWaveformValidityChallenges.filter(
    (candidate) => progressById[candidate.id]?.committed,
  ).length

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
          physiology underneath is normal every time. Commit to a reading before the reasoning
          appears.
        </p>
        <p className={styles.validityChallengeCount} role="status" aria-live="polite">
          Display problem {index + 1} of {normalWaveformValidityChallenges.length} ·{' '}
          {committedCount} worked through
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
            aria-label={`${candidate.label}${progressById[candidate.id]?.committed ? ' — worked through' : ''}`}
            onClick={() => setIndex(candidateIndex)}
          >
            <span aria-hidden="true">{candidateIndex + 1}</span>
            {candidate.label}
            {progressById[candidate.id]?.committed ? <em aria-hidden="true">✓</em> : null}
          </button>
        ))}
      </div>

      <ChallengeCard
        key={challenge.id}
        challenge={challenge}
        progress={progress}
        onChoiceChange={(choiceId) => update({ ...progress, choiceId })}
        onCommit={() => update({ ...progress, committed: true })}
      />

      <p className={styles.atlasBoundary} role="note">
        These are display problems drawn onto normal tracings, using the same distortion behavior
        the live monitor applies. Nothing here is a calibrated device trace, and a real monitor
        filters and damps differently.
      </p>
    </section>
  )
}
