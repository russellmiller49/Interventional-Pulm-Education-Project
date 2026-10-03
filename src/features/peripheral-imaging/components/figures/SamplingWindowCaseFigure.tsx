'use client'

import {
  SAMPLING_CASE_FIGURE,
  samplingCaseReadouts,
  type CaseFigureDeclaration,
} from '../../content/caseFigures'
import { MPR } from '../Diagrams'
import styles from './figures.module.css'

const PLANES = [
  { plane: 'Axial', position: SAMPLING_CASE_FIGURE.planes.axial },
  { plane: 'Coronal', position: SAMPLING_CASE_FIGURE.planes.coronal },
  { plane: 'Sagittal', position: SAMPLING_CASE_FIGURE.planes.sagittal },
] as const

/**
 * Integrated case 5's figure (QS-8): the Section 15 multiplanar model at one authored geometry.
 * The planes carry the evidence; the model's own relationship readout, which states the answer,
 * appears only with the explanation or after an answer is checked (OD4-04 rule 5).
 */
export function SamplingWindowCaseFigure({
  declaration,
  revealed,
}: {
  readonly declaration: CaseFigureDeclaration
  readonly revealed: boolean
}) {
  const readouts = samplingCaseReadouts()
  return (
    <figure
      className={styles.figure}
      data-case-figure={declaration.identity}
      data-case-figure-evidence={declaration.evidence}
      data-case-figure-medium={declaration.medium}
      data-figure-state="ready"
      data-figure-revealed={revealed ? 'true' : 'false'}
    >
      <p className={styles.modelLabel} data-model-label>
        {declaration.label}
      </p>
      <div className={styles.panelGrid} data-sampling-case-planes>
        {PLANES.map(({ plane, position }) => (
          <figure key={plane} className={styles.panel} data-figure-panel={plane.toLowerCase()}>
            <MPR plane={plane} position={position} tip={SAMPLING_CASE_FIGURE.tip} slab={false} />
            <figcaption>
              <strong>{plane}</strong> thin plane, linked to the others
            </figcaption>
          </figure>
        ))}
      </div>
      <p className={styles.note} data-sampling-legend>
        Amber outline: the modeled lesion · green: the needle’s side-cutting window · white: the
        shaft, ending at the tip. The CT behind them is low-resolution context for orientation.
      </p>
      {revealed ? (
        <dl className={styles.readouts} data-case-figure-readouts>
          <dt>Side-cutting window, by the model’s own readout</dt>
          <dd data-readout="window">{readouts.label}</dd>
          <dt>Needle tip</dt>
          <dd data-readout="tip">
            {readouts.tipInside
              ? 'Inside the modeled lesion'
              : `Outside the modeled lesion, about ${Math.round(readouts.tipFromSurfaceMm)} mm beyond its surface`}
          </dd>
          <dt>What this does not establish</dt>
          <dd>
            A model intersection is geometry. It does not establish diagnostic tissue or a safe
            sampling decision.
          </dd>
        </dl>
      ) : null}
    </figure>
  )
}
