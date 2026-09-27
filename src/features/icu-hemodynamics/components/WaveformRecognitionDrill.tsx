'use client'

import { useId, useState } from 'react'

import {
  NORMAL_WAVEFORM_INTERPRETATION_WITHHELD,
  validityWithheldHeading,
} from '../content/normalWaveformValidityChallenges'
import {
  recognitionPracticeExampleById,
  recognitionPracticeExamples,
  recognitionReadingById,
  recognitionReadings,
  type RecognitionPracticeExample,
  type RecognitionReading,
} from '../content/recognitionPractice'
import { WaveformAtlasFigure, type WaveformFigureFault } from './WaveformAtlasFigure'
import styles from './icu-hemodynamics.module.css'

/**
 * Where the learner is in the recognition practice: which tracing is open, and what they have done
 * with it on this visit.
 *
 * HD-02 (self-paced): the tracing changes only when the learner picks another one, so the trace they
 * are inspecting stays put while they try a reading, open the hint, show the labels or compare it.
 * Nothing here is saved, counted or sent to the simulation, and nothing decides whether the learner
 * may move on.
 */
export interface RecognitionRecord {
  readonly exampleId: string
  readonly selected: RecognitionReading | null
  readonly checked: boolean
  readonly labelsShown: boolean
  readonly hintShown: boolean
  readonly compareShown: boolean
}

export function emptyRecognitionRecord(
  exampleId: string = recognitionPracticeExamples[0].id,
): RecognitionRecord {
  return {
    exampleId,
    selected: null,
    checked: false,
    labelsShown: false,
    hintShown: false,
    compareShown: false,
  }
}

function figureFault(example: RecognitionPracticeExample): WaveformFigureFault | undefined {
  const fault = example.displayFault?.fault
  if (!fault) return undefined
  return {
    levelOffsetMmHg: fault.levelOffsetMmHg,
    scaleMaxMmHg: fault.scaleMaxMmHg,
    artifact: fault.artifact,
    dampingRatio: fault.dampingRatio,
    naturalFrequencyHz: fault.naturalFrequencyHz,
  }
}

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

interface WaveformRecognitionDrillProps {
  readonly enabled?: boolean
  readonly record?: RecognitionRecord
  readonly onRecord?: (record: RecognitionRecord) => void
}

export function WaveformRecognitionDrill({
  enabled = true,
  record,
  onRecord,
}: WaveformRecognitionDrillProps) {
  const headingId = useId()
  const compareHeadingId = useId()
  const groupName = useId()
  const [localRecord, setLocalRecord] = useState<RecognitionRecord>(() => emptyRecognitionRecord())
  const current = record ?? localRecord
  const update = onRecord ?? setLocalRecord

  const example =
    recognitionPracticeExampleById.get(current.exampleId) ?? recognitionPracticeExamples[0]
  const index = recognitionPracticeExamples.indexOf(example)
  const total = recognitionPracticeExamples.length
  const partner = recognitionPracticeExampleById.get(example.compareWithId)!
  const reading = recognitionReadingById.get(example.reading)!
  const revealed = current.checked || current.labelsShown
  const matches = current.checked && current.selected === example.reading

  function open(exampleId: string) {
    if (enabled) update(emptyRecognitionRecord(exampleId))
  }

  function patch(next: Partial<RecognitionRecord>) {
    if (enabled) update({ ...current, ...next })
  }

  function optionState(optionId: RecognitionReading): 'correct' | 'incorrect' | undefined {
    if (optionId === example.reading) return 'correct'
    if (optionId === current.selected) return 'incorrect'
    return undefined
  }

  const headline = !current.checked
    ? `Shown without an answer: this is ${reading.sentence}.`
    : matches
      ? `That matches: this is ${reading.sentence}.`
      : `Not this one: this is ${reading.sentence}.`

  const mismatchNote = (() => {
    if (!current.checked || matches || current.selected === null) return null
    if (example.displayFault) {
      return 'The shape still looks like a place, but on this display it cannot be trusted to name one.'
    }
    if (current.selected === 'cannot-name') {
      return 'No display fault is drawn on this model tracing, so its shape can name the place.'
    }
    if (current.selected === partner.reading) {
      const confusion = recognitionReadingById.get(partner.reading)!.sentence
      return `${sentenceCase(confusion)} is the easy confusion here. ${example.contrast}`
    }
    return 'Read the shape against the labels now drawn on it, then compare it with the tracing it is most easily confused with.'
  })()

  return (
    <section
      className={styles.recognitionDrill}
      aria-labelledby={headingId}
      data-recognition-example={example.id}
    >
      <header className={styles.atlasPanelHeader}>
        <div>
          <span>Optional practice · model tracings</span>
          <h3 id={headingId}>Name the tracing</h3>
        </div>
        <p className={styles.recognitionPosition} role="status" aria-live="polite">
          <strong>
            Tracing {index + 1} of {total}
          </strong>
          <span>Nothing here is saved or counted.</span>
        </p>
      </header>
      <p className={styles.recognitionIntro}>
        Pick any tracing. Try a reading with the labels hidden, or show the labels and explanation
        straight away, then compare it with the tracing it is most easily confused with. Repeat any
        tracing, and continue in Steps whenever you like.
      </p>

      <div className={styles.recognitionPicker} role="group" aria-label="Suggested tracings">
        {recognitionPracticeExamples.map((candidate, candidateIndex) => (
          <button
            key={candidate.id}
            type="button"
            aria-pressed={candidate.id === example.id}
            disabled={!enabled}
            onClick={() => open(candidate.id)}
          >
            Tracing {candidateIndex + 1}
          </button>
        ))}
      </div>

      <WaveformAtlasFigure
        key={example.id}
        entry={
          revealed
            ? example.entry
            : // The labels, range and depth stay hidden until the learner checks a reading or shows them.
              {
                ...example.entry,
                label: 'Unidentified tracing',
                normalRange: null,
                insertionDepth: null,
              }
        }
        annotated={revealed}
        ecgLandmarks
        readable
        fault={figureFault(example)}
        figureDescription={
          revealed
            ? example.displayFault
              ? `${example.entry.label}. ${example.displayFault.figureTextEquivalent}`
              : undefined
            : `${example.unlabelledDescription} Axis 0–${example.entry.scaleMaxMmHg} mmHg. The labels are hidden until you check a reading or show them.`
        }
      />

      {current.hintShown && !revealed ? (
        <p className={styles.drillHint} role="note" data-recognition-hint>
          <strong>Hint:</strong> {example.hint}
        </p>
      ) : null}

      <fieldset className={styles.drillOptions} disabled={!enabled || revealed}>
        <legend>Optional try: which reading does this tracing support?</legend>
        {recognitionReadings.map((option) => (
          <label key={option.id} data-state={revealed ? optionState(option.id) : undefined}>
            <input
              type="radio"
              name={groupName}
              value={option.id}
              checked={current.selected === option.id}
              onChange={() => patch({ selected: option.id })}
            />
            <span>{option.label}</span>
            {revealed && option.id === example.reading ? (
              <span className={styles.optionStateText}>Labelled reading</span>
            ) : current.checked && option.id === current.selected ? (
              <span className={styles.optionStateText}>Your reading</span>
            ) : null}
          </label>
        ))}
      </fieldset>

      <div className={styles.drillControls} role="group" aria-label="Practice actions">
        {revealed ? (
          <>
            <button
              type="button"
              aria-expanded={current.compareShown}
              disabled={!enabled}
              onClick={() => patch({ compareShown: !current.compareShown })}
            >
              {current.compareShown ? 'Hide the comparison' : 'Compare with another tracing'}
            </button>
            <button type="button" disabled={!enabled} onClick={() => open(example.id)}>
              Try this tracing again
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={!enabled || current.selected === null}
              onClick={() => patch({ checked: true })}
            >
              Check answer
            </button>
            <button
              type="button"
              aria-expanded={current.hintShown}
              disabled={!enabled}
              onClick={() => patch({ hintShown: !current.hintShown })}
            >
              {current.hintShown ? 'Hide the hint' : 'Hint'}
            </button>
            <button
              type="button"
              disabled={!enabled}
              onClick={() => patch({ labelsShown: true, selected: null })}
            >
              Show the labels and explanation
            </button>
          </>
        )}
        <button
          type="button"
          disabled={!enabled || index === 0}
          onClick={() => open(recognitionPracticeExamples[index - 1].id)}
        >
          Previous tracing
        </button>
        <button
          type="button"
          disabled={!enabled}
          onClick={() => open(recognitionPracticeExamples[(index + 1) % total].id)}
        >
          Next tracing
        </button>
      </div>

      {revealed ? (
        <div
          className={styles.drillFeedback}
          data-correct={matches || undefined}
          data-recognition-reveal={current.checked ? 'checked' : 'shown'}
          role="status"
        >
          <strong>{headline}</strong>
          {mismatchNote ? <p>{mismatchNote}</p> : null}
          <p className={styles.drillOrigin} data-recognition-origin={example.origin}>
            {example.originNote}
          </p>
          {example.displayFault ? (
            <>
              <p>{NORMAL_WAVEFORM_INTERPRETATION_WITHHELD}.</p>
              <dl className={styles.recognitionFaultFacts}>
                <div>
                  <dt>What you see</dt>
                  <dd>{example.displayFault.whatYouSee}</dd>
                </div>
                <div>
                  <dt>{validityWithheldHeading(example.displayFault)}</dt>
                  <dd>{example.displayFault.whyInterpretationIsWithheld}</dd>
                </div>
                <div>
                  <dt>Repair or re-read first</dt>
                  <dd>{example.displayFault.repairFirst}</dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <p>{example.entry.summary}</p>
              {/* The cues are a list, and say so: the same heading the atlas panel gives them. */}
              <h4>What identifies it</h4>
              <ul>
                {example.entry.recognitionCues.map((cue) => (
                  <li key={cue}>{cue}</li>
                ))}
              </ul>
              {example.entry.pitfall ? (
                <p className={styles.drillPitfall}>{example.entry.pitfall}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {revealed && current.compareShown ? (
        <section
          className={styles.recognitionCompare}
          aria-labelledby={compareHeadingId}
          data-recognition-compare={partner.id}
        >
          <h4 id={compareHeadingId}>Compare: {partner.entry.label}</h4>
          <p>{example.contrast}</p>
          <WaveformAtlasFigure
            entry={partner.entry}
            annotated={partner.displayFault === undefined}
            ecgLandmarks
            readable
            showLegend={false}
            scaleMaxMmHg={example.entry.scaleMaxMmHg}
            fault={figureFault(partner)}
          />
          <p className={styles.drillOrigin} data-recognition-origin={partner.origin}>
            {partner.originNote}
          </p>
          <button type="button" disabled={!enabled} onClick={() => open(partner.id)}>
            Open the comparison tracing
          </button>
        </section>
      ) : null}

      <p className={styles.atlasBoundary} role="note">
        Every tracing here is drawn by this module’s waveform model, the same one behind the live
        monitor. None is a patient recording or a calibrated device trace. Once its labels are
        shown, each tracing says whether it is a reference, a model variant or a display fault drawn
        onto a normal tracing.
      </p>
    </section>
  )
}
