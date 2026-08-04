'use client'

import { useState } from 'react'

import {
  NORMAL_WAVEFORM_RANGE_CAVEAT,
  normalWaveformAtlasEntry,
  normalWaveformReference,
} from '../content'
import styles from './icu-hemodynamics.module.css'
import { WaveformAtlasFigure } from './WaveformAtlasFigure'

/**
 * The stable normal RA → RV → PA → PAWP reference (H0/H1 §4).
 *
 * This renders before any abnormal tracing in the waveform section, and before the learner is asked
 * to advance a simulated catheter in the section after it. A novice cannot recognize an abnormal
 * waveform without a normal one to hold it against, and cannot confirm a catheter transition
 * without knowing what the next chamber is supposed to look like.
 *
 * The figure, annotations, recognition cues, and pitfall all come from the existing atlas entry, so
 * there is exactly one authored description of each tracing. What this adds is the uniform set of
 * facets a first reference needs — location, morphology, ECG relation, pressure direction,
 * respiratory variation, technical distortion, and what makes the tracing unsafe to interpret.
 */
export function NormalWaveformReference() {
  const [activePosition, setActivePosition] = useState(normalWaveformReference[0]?.position ?? 'ra')
  const entry =
    normalWaveformReference.find((candidate) => candidate.position === activePosition) ??
    normalWaveformReference[0]
  if (!entry) return null
  const atlasEntry = normalWaveformAtlasEntry(entry)

  return (
    <section className={styles.normalReference} aria-labelledby="normal-reference-heading">
      <header>
        <span className={styles.paneEyebrow}>Normal reference, in insertion order</span>
        <h2 id="normal-reference-heading">What each chamber is supposed to look like</h2>
        <p className={styles.paneIntro}>
          Build this reference before reading abnormal tracings, and before advancing a catheter — a
          transition is only recognizable if you already know what you are advancing into.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Normal waveform reference, in insertion order"
        className={styles.referenceTabs}
      >
        {normalWaveformReference.map((candidate) => (
          <button
            key={candidate.position}
            type="button"
            role="tab"
            aria-selected={candidate.position === entry.position}
            className={styles.referenceTab}
            onClick={() => setActivePosition(candidate.position)}
          >
            {normalWaveformAtlasEntry(candidate).shortLabel}
          </button>
        ))}
      </div>

      <WaveformAtlasFigure entry={atlasEntry} />

      <section aria-live="polite">
        <h3>{atlasEntry.label}</h3>
        <dl className={styles.referenceFacets}>
          <div>
            <dt>Where the tip is</dt>
            <dd>{entry.physicalLocation}</dd>
          </div>
          <div>
            <dt>Expected morphology</dt>
            <dd>{entry.expectedMorphology}</dd>
          </div>
          <div>
            <dt>Against the ECG and the cardiac cycle</dt>
            <dd>{entry.ecgRelation}</dd>
          </div>
          <div>
            <dt>Which way the pressure should sit</dt>
            <dd>{entry.pressureDirection}</dd>
          </div>
          <div>
            <dt>Respiratory variation</dt>
            <dd>{entry.respiratoryVariation}</dd>
          </div>
          <div>
            <dt>Common technical distortion</dt>
            <dd>{entry.technicalDistortion}</dd>
          </div>
          <div data-unsafe="true">
            <dt>When it is not safe to interpret</dt>
            <dd>{entry.unsafeToInterpret}</dd>
          </div>
        </dl>
      </section>

      <p className={styles.paneCaveat}>{NORMAL_WAVEFORM_RANGE_CAVEAT}</p>
    </section>
  )
}
