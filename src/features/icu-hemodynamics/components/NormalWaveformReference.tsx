'use client'

import { useId, useRef, useState, type KeyboardEvent } from 'react'

import {
  NORMAL_WAVEFORM_RANGE_CAVEAT,
  NORMAL_WAVEFORM_RESPIRATORY_CONTEXT,
  normalWaveformAtlasEntry,
  normalWaveformReference,
  normalWaveformReferenceTextEquivalent,
  normalWaveformScaleOption,
  normalWaveformScaleOptions,
  type NormalWaveformReferenceEntry,
  type NormalWaveformScaleId,
} from '../content'
import styles from './icu-hemodynamics.module.css'
import { NormalWaveformAnatomyFigure } from './NormalWaveformAnatomyFigure'
import { WaveformAtlasFigure } from './WaveformAtlasFigure'

/**
 * The canonical normal RA → RV → PA → PAWP reference (H2 §5).
 *
 * Everything the learner sees for one state comes from one record and is drawn on one set of axes:
 * the anatomy schematic, the pressure trace, the ECG lane and its P/QRS/T markers, the respiratory
 * envelope and its end-expiratory marker, the axis and its unit, and the explanatory text all move
 * together when the state changes, because they are all derived from the same entry.
 *
 * Two things are deliberate and easy to lose in a later edit:
 *
 * 1. **The scale is pinned across states.** The atlas draws the right atrium and the wedge against
 *    20 mmHg and the right ventricle and pulmonary artery against 40, which is right for a figure
 *    seen alone and wrong for four figures compared in sequence — a wedge and a pulmonary artery
 *    tracing would be drawn the same height. Here all four share one axis, and the only way to
 *    change it is a labelled control that announces the change and says explicitly that no pressure
 *    moved.
 * 2. **Nothing is carried by colour.** The tip position is named in words, the scale state is named
 *    in words, the reading point is labelled on the trace, and the whole figure has a text
 *    equivalent assembled from the same authored facets rather than written a second time.
 */
export function NormalWaveformReference() {
  const headingId = useId()
  const panelId = useId()
  const tabIdPrefix = useId()
  const scaleNoticeId = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const [activePosition, setActivePosition] = useState<NormalWaveformReferenceEntry['position']>(
    normalWaveformReference[0]?.position ?? 'ra',
  )
  const [scaleId, setScaleId] = useState<NormalWaveformScaleId>('shared')

  const entry =
    normalWaveformReference.find((candidate) => candidate.position === activePosition) ??
    normalWaveformReference[0]
  if (!entry) return null
  const atlasEntry = normalWaveformAtlasEntry(entry)
  const scale = normalWaveformScaleOption(scaleId)
  const activeIndex = normalWaveformReference.indexOf(entry)

  function moveTab(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const last = normalWaveformReference.length - 1
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : event.key === 'ArrowLeft'
            ? (activeIndex + last) % normalWaveformReference.length
            : (activeIndex + 1) % normalWaveformReference.length
    const target = normalWaveformReference[next]
    if (!target) return
    setActivePosition(target.position)
    tabRefs.current[next]?.focus()
  }

  return (
    <section className={styles.normalReference} aria-labelledby={headingId}>
      <header>
        <span className={styles.paneEyebrow}>Normal reference, in insertion order</span>
        <h2 id={headingId}>What each chamber is supposed to look like</h2>
        <p className={styles.paneIntro}>
          Build this reference before reading abnormal tracings, and before advancing a catheter — a
          transition is only recognizable if you already know what you are advancing into. The
          anatomy, the trace, the ECG, the breath, and the axis below all describe the same moment.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Normal waveform reference, in insertion order"
        className={styles.referenceTabs}
        onKeyDown={moveTab}
      >
        {normalWaveformReference.map((candidate, index) => (
          <button
            key={candidate.position}
            ref={(node) => {
              tabRefs.current[index] = node
            }}
            id={`${tabIdPrefix}-${candidate.position}`}
            type="button"
            role="tab"
            aria-selected={candidate.position === entry.position}
            aria-controls={panelId}
            tabIndex={candidate.position === entry.position ? 0 : -1}
            className={styles.referenceTab}
            onClick={() => setActivePosition(candidate.position)}
          >
            <span aria-hidden="true">{candidate.order}</span>
            {normalWaveformAtlasEntry(candidate).shortLabel}
          </button>
        ))}
      </div>

      <fieldset className={styles.referenceScaleControl}>
        <legend>Displayed axis</legend>
        {normalWaveformScaleOptions.map((option) => (
          <label key={option.id}>
            <input
              type="radio"
              name={`${tabIdPrefix}-scale`}
              checked={option.id === scale.id}
              aria-describedby={scaleNoticeId}
              onChange={() => setScaleId(option.id)}
            />
            <span>{option.label}</span>
            <small>{option.whyItExists}</small>
          </label>
        ))}
        <p
          id={scaleNoticeId}
          className={styles.referenceScaleNotice}
          data-changed={scale.id === 'shared' ? undefined : 'true'}
          role="status"
          aria-live="polite"
        >
          {scale.notice}
        </p>
      </fieldset>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${tabIdPrefix}-${entry.position}`}
        tabIndex={0}
        className={styles.referencePanel}
      >
        <p className={styles.referenceStateLine}>
          State {entry.order} of {normalWaveformReference.length} · {atlasEntry.label} · axis 0–
          {scale.maxMmHg} {entry.displayUnit} · {NORMAL_WAVEFORM_RESPIRATORY_CONTEXT.mode}
        </p>

        <div className={styles.referenceSynchronizedFigures}>
          <NormalWaveformAnatomyFigure
            position={entry.position}
            physicalLocation={entry.physicalLocation}
          />
          <WaveformAtlasFigure
            key={`${entry.position}-${scale.id}`}
            entry={atlasEntry}
            scaleMaxMmHg={scale.maxMmHg}
            ecgLandmarks
            respiration={{
              swingMmHg: entry.respiratorySwingMmHg,
              cyclesPerStrip: NORMAL_WAVEFORM_RESPIRATORY_CONTEXT.cyclesPerStrip,
              endExpirationPhase: NORMAL_WAVEFORM_RESPIRATORY_CONTEXT.endExpirationPhase,
              modeLabel: NORMAL_WAVEFORM_RESPIRATORY_CONTEXT.mode,
            }}
            figureDescription={normalWaveformReferenceTextEquivalent(entry, scale)}
          />
        </div>

        <p className={styles.paneCaveat}>
          {NORMAL_WAVEFORM_RESPIRATORY_CONTEXT.renderingBoundary}{' '}
          {NORMAL_WAVEFORM_RESPIRATORY_CONTEXT.spontaneousContrast}
        </p>

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
              <dt>What should change from the state before</dt>
              <dd>{entry.expectedChangeFromPrevious}</dd>
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
            <div>
              <dt>What it still does not establish</dt>
              <dd>{entry.cannotEstablish}</dd>
            </div>
          </dl>
        </section>

        <section
          className={styles.referenceDistortions}
          aria-label={`Distortions that mimic ${atlasEntry.label} physiology`}
        >
          <h4>Distortion that mimics physiology here</h4>
          <ul>
            {entry.technicalDistortions.map((distortion) => (
              <li key={distortion.id}>
                <strong>{distortion.label}</strong>
                <span>
                  <em>You see:</em> {distortion.whatYouSee}
                </span>
                <span>
                  <em>Mistaken for:</em> {distortion.whatItMimics}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <details className={styles.referenceTextEquivalent}>
          <summary>Read this state as text</summary>
          <p>{normalWaveformReferenceTextEquivalent(entry, scale)}</p>
        </details>
      </div>

      <p className={styles.paneCaveat}>{NORMAL_WAVEFORM_RANGE_CAVEAT}</p>
    </section>
  )
}
