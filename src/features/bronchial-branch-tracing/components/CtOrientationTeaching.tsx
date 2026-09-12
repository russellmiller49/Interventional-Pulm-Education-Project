import type { CtTrace } from '../content/ct-types'
import { nativeImageUrl, ORIENTATION_NOTES } from '../geometry/native-ct'
import {
  orientationFor,
  orientationLabels,
  orientationName,
  orientationTransform,
  STANDARD_ORIENTATION,
  type CtOrientation,
} from '../geometry/orientation'
import styles from './branch-tracing.module.css'

function OrientationImage({ trace, orientation }: { trace: CtTrace; orientation: CtOrientation }) {
  const labels = orientationLabels(orientation)
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Parent airway on CT: ${orientationName(orientation)}. Top ${labels.top}, right ${labels.right}, bottom ${labels.bottom}, left ${labels.left}.`}
    >
      <g
        transform={`translate(50 50) ${orientationTransform(orientation)} scale(${100 / 110}) translate(${-trace.anchor.pixel[0]} ${-trace.anchor.pixel[1]})`}
      >
        <image
          href={nativeImageUrl(trace.anchor.slice)}
          x={-0.5}
          y={-0.5}
          width="512"
          height="512"
        />
      </g>
      <circle cx="50" cy="50" r="4" fill="none" stroke="#f6c66c" strokeWidth=".7" />
      {[
        { text: labels.top, x: 50, y: 9 },
        { text: labels.right, x: 94, y: 52 },
        { text: labels.bottom, x: 50, y: 96 },
        { text: labels.left, x: 6, y: 52 },
      ].map((v) => (
        <text
          key={v.text}
          x={v.x}
          y={v.y}
          textAnchor="middle"
          fill="white"
          fontSize="7"
          stroke="#020507"
          strokeWidth="1.5"
          paintOrder="stroke"
        >
          {v.text}
        </text>
      ))}
    </svg>
  )
}
export function CtOrientationTeaching({ trace }: { trace: CtTrace }) {
  const expected = orientationFor(trace.preset)
  return (
    <section>
      <h2>Turn the CT into the tracing convention</h2>
      <p>
        Standard axial looks from the feet: patient R appears on your left, with A at the top. The
        bronchoscope looks from the parent toward the daughter branches.
      </p>
      <figure className={styles.orientationDiagram}>
        <div>
          <OrientationImage trace={trace} orientation={STANDARD_ORIENTATION} />
          <span aria-hidden="true">→</span>
          <OrientationImage trace={trace} orientation={expected} />
        </div>
        <figcaption>
          <strong>Standard axial → {orientationName(expected).toLowerCase()}.</strong> The ring
          identifies the same parent lumen. Follow the direction letters as the image turns.
        </figcaption>
      </figure>
      <p>{ORIENTATION_NOTES[trace.preset]}</p>
      <p>
        <strong>Try it in the paired viewer:</strong> use the rotate or flip buttons. “Show book
        convention” demonstrates the result; “Reset to standard” lets you repeat it.
      </p>
      <p>
        A reflection swaps left and right while keeping anterior at the top. A rotation turns all
        four directions. Neither changes the patient’s anatomy.
      </p>
      <p>
        Then compare the neighboring branch openings in virtual bronchoscopy. The CT is a
        cross-section; the scope looks along the lumen. Horizontal branches still require you to
        reason from the parent’s direction.
      </p>
    </section>
  )
}

export function CtOrientationFeedback({
  trace,
  first,
  used,
}: {
  trace: CtTrace
  first: CtOrientation
  used: CtOrientation
}) {
  return (
    <p>
      <strong>Orientation:</strong> first choice {orientationName(first).toLowerCase()}; recorded{' '}
      {orientationName(used).toLowerCase()}. The book convention for this region is{' '}
      {orientationName(orientationFor(trace.preset)).toLowerCase()}. This compares a display
      convention, not bronchoscopy competence.
    </p>
  )
}
